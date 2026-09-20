/**
 * 曲库扫描：把「一个目录」变成一批带元数据的曲目。
 *
 * 三条路径：
 * - Tauri：绝对路径 + fs 插件递归读取（性能最好，可持久化）；
 * - 浏览器（Chromium）：File System Access 句柄，可持久化；
 * - 兼容模式：webkitdirectory / 拖拽，拿到 File 列表（仅当前会话）。
 *
 * 扫描阶段不写数据库，只产出结果，便于先预览再入库。
 */

import { albumKeyOf, coverIdFor } from "./catalog";
import { parseAudioFile, type ParsedAudio } from "./metadata";
import {
  isTauriRuntime,
  readOriginFile,
  supportsDirectoryPicker,
} from "./sources";
import type { AudioOrigin, ScanProgress, Track } from "./types";

export const AUDIO_EXTENSIONS = [
  "mp3",
  "m4a",
  "m4b",
  "mp4",
  "aac",
  "flac",
  "ogg",
  "oga",
  "opus",
  "wav",
  "wave",
  "webm",
  "wma",
  "aif",
  "aiff",
  "ape",
  "mka",
  "dsf",
  "amr",
] as const;

const AUDIO_EXTENSION_SET = new Set<string>(AUDIO_EXTENSIONS);

export const SKIPPED_DIRECTORIES = new Set([
  "$recycle.bin",
  ".git",
  ".svn",
  "node_modules",
  "system volume information",
]);

export function isAudioFileName(fileName: string): boolean {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) return false;
  return AUDIO_EXTENSION_SET.has(fileName.slice(dot + 1).toLowerCase());
}
// ---------------------------------------------------------------- 候选文件

/** 扫描中间态：已定位到文件，但还没有解析标签。 */
export interface ScanCandidate {
  /** 稳定标识，用于生成曲目 ID 与去重。 */
  key: string;
  fileName: string;
  fileSize: number;
  origin: AudioOrigin;
  /** 用于展示的相对位置。 */
  displayPath: string;
}

export interface ScanFailure {
  fileName: string;
  reason: string;
}

export interface CollectResult {
  candidates: ScanCandidate[];
  failures: ScanFailure[];
  /** 遍历过程中无法读取的目录数量。 */
  skippedDirectories: number;
}

export interface WalkProgress {
  label: string;
  files: number;
}

/** 由字符串生成稳定 ID（FNV-1a 双轮，降低碰撞概率）。 */
function stableId(input: string): string {
  let first = 0x811c9dc5;
  let second = 0x01000193;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `${(first >>> 0).toString(36)}${(second >>> 0).toString(36)}`;
}

export function trackIdFor(sourceKey: string): string {
  return `t_${stableId(sourceKey)}`;
}

/** Windows 盘符路径大小写不敏感，统一小写后再作为去重键。 */
export function normalizePathKey(path: string): string {
  return /^[a-z]:[\\/]/i.test(path) ? path.toLowerCase() : path;
}

export function pathSourceKey(path: string): string {
  return `path:${normalizePathKey(path)}`;
}

export function handleSourceKey(rootName: string, relativePath: string): string {
  return `handle:${rootName}/${relativePath}`;
}

export function memorySourceKey(file: File): string {
  return `memory:${file.name}:${file.size}:${file.lastModified}`;
}

function joinPath(parent: string, name: string): string {
  const separator = parent.includes("\\") ? "\\" : "/";
  return `${parent.replace(/[\\/]+$/, "")}${separator}${name}`;
}

// ---------------------------------------------------------------- 目录遍历

/** Tauri：递归读取绝对路径下的音频文件。 */
export async function collectFromPath(
  rootPath: string,
  onProgress?: (progress: WalkProgress) => void,
): Promise<CollectResult> {
  const { readDir } = await import("@tauri-apps/plugin-fs");
  const candidates: ScanCandidate[] = [];
  const failures: ScanFailure[] = [];
  let skippedDirectories = 0;

  const queue: string[] = [rootPath];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    let entries;
    try {
      entries = await readDir(current);
    } catch (error) {
      skippedDirectories += 1;
      failures.push({
        fileName: current,
        reason: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    for (const entry of entries) {
      const fullPath = joinPath(current, entry.name);
      if (entry.isDirectory) {
        if (SKIPPED_DIRECTORIES.has(entry.name.toLowerCase())) continue;
        queue.push(fullPath);
        continue;
      }
      if (!entry.isFile || !isAudioFileName(entry.name)) continue;
      candidates.push({
        key: pathSourceKey(fullPath),
        fileName: entry.name,
        fileSize: 0,
        origin: { kind: "path", path: fullPath },
        displayPath: fullPath,
      });
      onProgress?.({ label: fullPath, files: candidates.length });
    }
  }

  return { candidates, failures, skippedDirectories };
}

/** 浏览器：递归遍历 File System Access 句柄。 */
export async function collectFromHandle(
  root: FileSystemDirectoryHandle,
  onProgress?: (progress: WalkProgress) => void,
): Promise<CollectResult> {
  const candidates: ScanCandidate[] = [];
  const failures: ScanFailure[] = [];
  let skippedDirectories = 0;

  const walk = async (
    directory: FileSystemDirectoryHandle,
    prefix: string,
  ): Promise<void> => {
    try {
      for await (const entry of directory.values()) {
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.kind === "directory") {
          if (SKIPPED_DIRECTORIES.has(entry.name.toLowerCase())) continue;
          await walk(entry, relativePath);
          continue;
        }
        if (!isAudioFileName(entry.name)) continue;
        let fileSize = 0;
        try {
          fileSize = (await entry.getFile()).size;
        } catch {
          // 拿不到大小不影响后续解析，留 0 即可。
        }
        candidates.push({
          key: handleSourceKey(root.name, relativePath),
          fileName: entry.name,
          fileSize,
          origin: { kind: "handle", handle: entry },
          displayPath: `${root.name}/${relativePath}`,
        });
        onProgress?.({ label: relativePath, files: candidates.length });
      }
    } catch (error) {
      skippedDirectories += 1;
      failures.push({
        fileName: prefix || directory.name,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  };

  await walk(root, "");
  return { candidates, failures, skippedDirectories };
}

/** 兼容模式：webkitdirectory / 拖拽得到的一批 File。 */
export function collectFromFiles(files: File[]): CollectResult {
  const candidates: ScanCandidate[] = [];

  for (const file of files) {
    if (!isAudioFileName(file.name)) continue;
    const relativePath =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
      file.name;
    const slash = relativePath.indexOf("/");
    const key =
      slash > 0
        ? handleSourceKey(relativePath.slice(0, slash), relativePath)
        : memorySourceKey(file);
    candidates.push({
      key,
      fileName: file.name,
      fileSize: file.size,
      origin: { kind: "memory", key: memorySourceKey(file) },
      displayPath: relativePath,
    });
  }

  return { candidates, failures: [], skippedDirectories: 0 };
}

// ---------------------------------------------------------------- 解析与入库

export interface ScanOutcome {
  added: Track[];
  updated: Track[];
  /** 文件未变化、直接复用已有记录的数量。 */
  unchanged: number;
  failures: ScanFailure[];
  covers: { id: string; blob: Blob }[];
}

export interface ScanOptions {
  onProgress?: (progress: ScanProgress) => void;
  /** 并发解析数量，默认 4。 */
  concurrency?: number;
  signal?: AbortSignal;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error("扫描已取消");
}

interface ParsedEntry {
  candidate: ScanCandidate;
  parsed: ParsedAudio;
}

/** 并发解析候选文件（受 concurrency 限制）。 */
async function parseCandidates(
  candidates: ScanCandidate[],
  options: ScanOptions,
): Promise<{ parsed: ParsedEntry[]; failures: ScanFailure[] }> {
  const { onProgress, signal } = options;
  const concurrency = Math.max(1, options.concurrency ?? 4);
  const parsed: ParsedEntry[] = [];
  const failures: ScanFailure[] = [];
  let cursor = 0;
  let processed = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      throwIfAborted(signal);
      const candidate = candidates[cursor];
      cursor += 1;
      if (!candidate) return;
      try {
        const file = await readOriginFile(candidate.origin, candidate.fileName);
        candidate.fileSize = file.size;
        const metadata = await parseAudioFile(file, candidate.fileName);
        parsed.push({ candidate, parsed: metadata });
      } catch (error) {
        failures.push({
          fileName: candidate.fileName,
          reason: error instanceof Error ? error.message : String(error),
        });
      } finally {
        processed += 1;
        onProgress?.({
          phase: "parsing",
          processed,
          total: candidates.length,
          label: candidate.fileName,
        });
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, candidates.length) }, () =>
      worker(),
    ),
  );

  return { parsed, failures };
}

/** 把解析结果转成曲目记录，并与已有曲库合并。 */
export function buildOutcome(
  parsed: ParsedEntry[],
  existingTracks: Track[],
): ScanOutcome {
  const existingById = new Map(existingTracks.map((track) => [track.id, track]));
  const added: Track[] = [];
  const updated: Track[] = [];
  const covers = new Map<string, Blob>();
  let unchanged = 0;

  for (const { candidate, parsed: metadata } of parsed) {
    const id = trackIdFor(candidate.key);
    const existing = existingById.get(id);

    // 文件大小一致即视为内容未变化，直接复用（同时保住封面与播放统计）。
    const needsBitDepthRefresh =
      existing != null && existing.lossless && existing.bitDepth == null;
    if (
      existing &&
      candidate.fileSize > 0 &&
      existing.fileSize === candidate.fileSize &&
      existing.duration > 0 &&
      !needsBitDepthRefresh
    ) {
      unchanged += 1;
      continue;
    }

    const track: Track = {
      id,
      title: metadata.title,
      artist: metadata.artist,
      albumArtist: metadata.albumArtist,
      composer: metadata.composer,
      album: metadata.album,
      genre: metadata.genre,
      releaseDate: metadata.releaseDate,
      trackNo: metadata.trackNo,
      discNo: metadata.discNo,
      duration: metadata.duration,
      bitrate: metadata.bitrate,
      sampleRate: metadata.sampleRate,
      bitDepth: metadata.bitDepth,
      lossless: metadata.lossless,
      copyright: metadata.copyright,
      fileName: candidate.fileName,
      fileSize: candidate.fileSize,
      addedAt: existing?.addedAt ?? Date.now(),
      origin: candidate.origin,
      coverId: null,
      playCount: existing?.playCount ?? 0,
      lastPlayedAt: existing?.lastPlayedAt ?? null,
    };

    const albumKey = albumKeyOf(track);
    track.coverId = existing?.coverId ?? coverIdFor(track, albumKey);

    if (metadata.cover && track.coverId && !covers.has(track.coverId)) {
      covers.set(track.coverId, metadata.cover);
    }

    if (existing) updated.push(track);
    else added.push(track);
  }

  return {
    added,
    updated,
    unchanged,
    failures: [],
    covers: [...covers].map(([id, blob]) => ({ id, blob })),
  };
}

// ---------------------------------------------------------------- 编排

export type DirectorySource =
  | { kind: "path"; path: string }
  | { kind: "handle"; handle: FileSystemDirectoryHandle };

/**
 * 让用户选择一个音乐目录。
 * Tauri 环境返回绝对路径（读取最快），浏览器返回可持久化的目录句柄；
 * 两者都不支持时返回 null，由调用方回退到 webkitdirectory。
 */
export async function pickLibraryDirectory(): Promise<DirectorySource | null> {
  if (isTauriRuntime()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      directory: true,
      multiple: false,
      recursive: true,
      title: "选择音乐文件夹",
    });
    return typeof selected === "string"
      ? { kind: "path", path: selected }
      : null;
  }

  if (supportsDirectoryPicker()) {
    const handle = await window.showDirectoryPicker?.({
      id: "konzert-library",
      mode: "read",
      startIn: "music",
    });
    return handle ? { kind: "handle", handle } : null;
  }

  return null;
}

export interface ScanRequest {
  source: DirectorySource;
  existingTracks: Track[];
  onProgress?: (progress: ScanProgress) => void;
  signal?: AbortSignal;
}

/** 扫描一个目录：遍历 → 解析 → 生成待写入的曲目与封面。 */
export async function scanDirectory(request: ScanRequest): Promise<ScanOutcome> {
  const { source, existingTracks, onProgress, signal } = request;

  onProgress?.({
    phase: "walking",
    processed: 0,
    total: 0,
    label: "正在遍历文件夹",
  });

  const reportWalk = (progress: WalkProgress) =>
    onProgress?.({
      phase: "walking",
      processed: progress.files,
      total: 0,
      label: progress.label,
    });

  const collected =
    source.kind === "path"
      ? await collectFromPath(source.path, reportWalk)
      : await collectFromHandle(source.handle, reportWalk);

  throwIfAborted(signal);

  if (collected.candidates.length === 0) {
    return {
      added: [],
      updated: [],
      unchanged: 0,
      failures: collected.failures,
      covers: [],
    };
  }

  onProgress?.({
    phase: "parsing",
    processed: 0,
    total: collected.candidates.length,
    label: "正在读取标签",
  });

  const { parsed, failures } = await parseCandidates(collected.candidates, {
    onProgress,
    signal,
  });
  throwIfAborted(signal);

  onProgress?.({
    phase: "saving",
    processed: parsed.length,
    total: collected.candidates.length,
    label: "正在写入本地曲库",
  });

  return {
    ...buildOutcome(parsed, existingTracks),
    failures: [...collected.failures, ...failures],
  };
}

export interface FileScanRequest {
  files: File[];
  existingTracks: Track[];
  onProgress?: (progress: ScanProgress) => void;
  signal?: AbortSignal;
}

/** 扫描一批已选中的文件（拖拽 / webkitdirectory）。 */
export async function scanFiles(request: FileScanRequest): Promise<ScanOutcome> {
  const { files, existingTracks, onProgress, signal } = request;
  const collected = collectFromFiles(files);

  if (collected.candidates.length === 0) {
    return { added: [], updated: [], unchanged: 0, failures: [], covers: [] };
  }

  onProgress?.({
    phase: "parsing",
    processed: 0,
    total: collected.candidates.length,
    label: "正在读取标签",
  });

  const { parsed, failures } = await parseCandidates(collected.candidates, {
    onProgress,
    signal,
  });
  throwIfAborted(signal);

  onProgress?.({
    phase: "saving",
    processed: parsed.length,
    total: collected.candidates.length,
    label: "正在写入本地曲库",
  });

  return {
    ...buildOutcome(parsed, existingTracks),
    failures,
  };
}
