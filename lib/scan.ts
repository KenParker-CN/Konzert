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
  fileModifiedAt?: number;
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
  const { readDir, stat } = await import("@tauri-apps/plugin-fs");
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
      let fileSize = 0;
      try {
        fileSize = (await stat(fullPath)).size;
      } catch {
        // stat 失败（无权限或文件被占用），大小留 0，后续解析时会重新获取。
      }
      candidates.push({
        key: pathSourceKey(fullPath),
        fileName: entry.name,
        fileSize,
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
  sourceId: string | undefined,
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
        let fileModifiedAt: number | undefined;
        try {
          const file = await entry.getFile();
          fileSize = file.size;
          fileModifiedAt = file.lastModified || undefined;
        } catch {
          // 拿不到大小不影响后续解析，留 0 即可。
        }
        candidates.push({
          key: handleSourceKey(root.name, relativePath),
          fileName: entry.name,
          fileSize,
          fileModifiedAt,
          origin: {
            kind: "handle",
            handle: entry,
            sourceId,
            rootName: root.name,
            relativePath,
          },
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
      fileModifiedAt: file.lastModified || undefined,
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
  /**
   * 在磁盘上已消失的曲目（仅在差异扫描时填充）。
   * 调用方负责从 IndexedDB 与状态中删除这些记录。
   */
  removed?: Track[];
}

export interface ScanOptions {
  onProgress?: (progress: ScanProgress) => void;
  /** 并发解析数量，默认 3，避免大量音频同时读取导致界面卡顿。 */
  concurrency?: number;
  signal?: AbortSignal;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error("扫描已取消");
}

export interface ParsedEntry {
  candidate: ScanCandidate;
  parsed: ParsedAudio;
}

/** 并发解析候选文件（受 concurrency 限制）。 */
async function parseCandidates(
  candidates: ScanCandidate[],
  options: ScanOptions,
): Promise<{ parsed: ParsedEntry[]; failures: ScanFailure[] }> {
  const { onProgress, signal } = options;
  const concurrency = Math.max(1, options.concurrency ?? 3);
  const parsed: ParsedEntry[] = [];
  const failures: ScanFailure[] = [];
  let cursor = 0;
  let processed = 0;
  let lastProgressAt = 0;
  let pendingProgress: ScanProgress | null = null;
  let progressTimer: ReturnType<typeof setTimeout> | null = null;

  const reportProgress = (progress: ScanProgress, force = false) => {
    pendingProgress = progress;
    const now = Date.now();
    if (!force && now - lastProgressAt < 120) {
      if (!progressTimer) {
        progressTimer = setTimeout(() => {
          progressTimer = null;
          if (pendingProgress) reportProgress(pendingProgress, true);
        }, 120 - (now - lastProgressAt));
      }
      return;
    }
    lastProgressAt = now;
    pendingProgress = null;
    onProgress?.(progress);
  };

  const worker = async (): Promise<void> => {
    for (;;) {
      throwIfAborted(signal);
      const candidate = candidates[cursor];
      cursor += 1;
      if (!candidate) return;
      try {
        const file = await readOriginFile(candidate.origin, candidate.fileName);
        candidate.fileSize = file.size;
        candidate.fileModifiedAt = file.lastModified || undefined;
        const metadata = await parseAudioFile(file, candidate.fileName);
        parsed.push({ candidate, parsed: metadata });
      } catch (error) {
        failures.push({
          fileName: candidate.fileName,
          reason: error instanceof Error ? error.message : String(error),
        });
      } finally {
        processed += 1;
        reportProgress({
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
  if (progressTimer) clearTimeout(progressTimer);
  if (pendingProgress) reportProgress(pendingProgress, true);

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

    // 文件大小和可用的修改时间一致时复用曲目与播放统计。
    const needsBitDepthRefresh =
      existing != null && existing.lossless && existing.bitDepth == null;
    const needsCopyrightRefresh =
      existing != null &&
      !existing.copyright?.trim() &&
      Boolean(metadata.copyright?.trim());
    if (
      existing &&
      candidate.fileSize > 0 &&
      existing.fileSize === candidate.fileSize &&
      (candidate.fileModifiedAt == null ||
        existing.fileModifiedAt === candidate.fileModifiedAt) &&
      existing.duration > 0 &&
      !needsBitDepthRefresh &&
      !needsCopyrightRefresh
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
      fileModifiedAt: candidate.fileModifiedAt ?? null,
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
  | { kind: "handle"; handle: FileSystemDirectoryHandle; sourceId?: string };

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
      : await collectFromHandle(source.handle, source.sourceId, reportWalk);

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

// ---------------------------------------------------------------- 差异扫描

/** 检查路径是否存在（Tauri 环境）。错误时返回 false。 */
export async function pathExists(path: string): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  try {
    const { exists } = await import("@tauri-apps/plugin-fs");
    return await exists(path);
  } catch {
    return false;
  }
}

export interface DiffScanRequest {
  source: DirectorySource;
  existingTracks: Track[];
  onProgress?: (progress: ScanProgress) => void;
  signal?: AbortSignal;
}

/**
 * 差异扫描：遍历目录，比较现有曲库，仅解析新增/修改的文件。
 *
 * - 新文件（不在曲库中）→ 解析并标记为 added
 * - 修改的文件（大小或可用的修改时间变化）→ 重新解析并标记为 updated
 * - 未变化的文件（大小、可用的修改时间相同且已有时长）→ 跳过解析
 * - 已删除的文件（在曲库但不在磁盘上）→ 标记为 removed
 *   （会先检查父目录是否存在，避免外接硬盘拔出时误删）
 */
export async function scanDirectoryDifferential(
  request: DiffScanRequest,
): Promise<ScanOutcome> {
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
      : await collectFromHandle(source.handle, source.sourceId, reportWalk);

  throwIfAborted(signal);

  // 建立现有 path 来源曲目的源键 → 曲目映射
  const existingByKey = new Map<string, Track>();
  const existingById = new Map(existingTracks.map((track) => [track.id, track]));
  for (const track of existingTracks) {
    if (track.origin.kind === "path") {
      existingByKey.set(pathSourceKey(track.origin.path), track);
    }
  }

  const onDiskKeys = new Set(collected.candidates.map((c) => c.key));

  // 划分需要解析与跳过不解析的候选文件
  const toParse: ScanCandidate[] = [];
  let unchanged = 0;

  for (const candidate of collected.candidates) {
    const existing =
      source.kind === "path"
        ? existingByKey.get(candidate.key)
        : existingById.get(trackIdFor(candidate.key));
    if (
      existing &&
      candidate.fileSize > 0 &&
      existing.fileSize === candidate.fileSize &&
      (candidate.fileModifiedAt == null ||
        existing.fileModifiedAt === candidate.fileModifiedAt) &&
      existing.duration > 0
    ) {
      unchanged += 1;
    } else {
      toParse.push(candidate);
    }
  }

  let added: Track[] = [];
  let updated: Track[] = [];
  let covers: { id: string; blob: Blob }[] = [];
  let parseFailures: ScanFailure[] = [];

  if (toParse.length > 0) {
    onProgress?.({
      phase: "parsing",
      processed: 0,
      total: toParse.length,
      label: "正在读取标签",
    });
    const { parsed, failures } = await parseCandidates(toParse, {
      onProgress,
      signal,
    });
    throwIfAborted(signal);
    parseFailures = failures;

    onProgress?.({
      phase: "saving",
      processed: parsed.length,
      total: toParse.length,
      label: "正在写入本地曲库",
    });

    const buildResult = buildOutcome(parsed, existingTracks);
    added = buildResult.added;
    updated = buildResult.updated;
    unchanged += buildResult.unchanged;
    covers = buildResult.covers;
  }

  // 查找已删除的文件（在曲库但不在磁盘上）
  const removed: Track[] = [];
  for (const track of existingTracks) {
    if (source.kind === "path" && track.origin.kind === "path") {
      const rootPath = normalizePathKey(source.path.replace(/[\\/]+$/, ""));
      const trackPath = normalizePathKey(track.origin.path);
      const separator = source.path.includes("\\") ? "\\" : "/";
      if (
        trackPath !== rootPath &&
        !trackPath.startsWith(`${rootPath}${separator}`)
      ) {
        continue;
      }
      const key = pathSourceKey(track.origin.path);
      if (!onDiskKeys.has(key)) {
        const dirPath = track.origin.path.replace(/[^\\/]+$/, "");
        try {
          if (await pathExists(dirPath)) removed.push(track);
        } catch {
          // 无法验证存在性，保守跳过
        }
      }
    } else if (
      source.kind === "handle" &&
      track.origin.kind === "handle" &&
      source.sourceId &&
      track.origin.sourceId === source.sourceId &&
      track.origin.relativePath &&
      collected.failures.length === 0 &&
      !onDiskKeys.has(
        handleSourceKey(
          track.origin.rootName ?? source.handle.name,
          track.origin.relativePath,
        ),
      )
    ) {
      removed.push(track);
    }
  }

  return {
    added,
    updated,
    removed,
    unchanged,
    failures: [...collected.failures, ...parseFailures],
    covers,
  };
}

/**
 * 解析单个路径上的音频文件并生成曲目记录（用于文件监听自动导入）。
 * 如果文件不是音频文件或解析失败，返回空结果。
 */
export async function importTrackFromPath(
  filePath: string,
  existingTracks: Track[],
): Promise<{
  added: Track[];
  updated: Track[];
  covers: { id: string; blob: Blob }[];
}> {
  const fileName = filePath.split(/[/\\]/).pop() ?? "";
  if (!isAudioFileName(fileName)) {
    return { added: [], updated: [], covers: [] };
  }

  const candidate: ScanCandidate = {
    key: pathSourceKey(filePath),
    fileName,
    fileSize: 0,
    origin: { kind: "path", path: filePath },
    displayPath: filePath,
  };

  try {
    const file = await readOriginFile(candidate.origin, candidate.fileName);
    candidate.fileSize = file.size;
    candidate.fileModifiedAt = file.lastModified || undefined;
    const metadata = await parseAudioFile(file, candidate.fileName);
    const outcome = buildOutcome(
      [{ candidate, parsed: metadata }],
      existingTracks,
    );
    return {
      added: outcome.added,
      updated: outcome.updated,
      covers: outcome.covers,
    };
  } catch (error) {
    console.error(
      `Failed to import file ${filePath}:`,
      error instanceof Error ? error.message : error,
    );
    return { added: [], updated: [], covers: [] };
  }
}
