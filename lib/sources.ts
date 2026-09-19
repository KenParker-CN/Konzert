/**
 * 音频来源解析：把「记录下来的文件来源」还原成可播放 URL 或可解析的 File。
 *
 * 支持三种来源：
 * - Tauri：绝对路径，播放走 asset 协议，读取走 fs 插件；
 * - 浏览器：File System Access 句柄（可持久化，重启后重新申请授权）；
 * - 内存：拖拽 / <input type="file"> 选中的文件，只在当前会话有效。
 */

import { convertFileSrc, isTauri } from "@tauri-apps/api/core";
import { decodeAudioFileToWav, needsSoftwareDecode } from "./decode";
import type { AudioOrigin, Track } from "./types";

export interface PlaybackSource {
  url: string;
  release: () => void;
}

const memoryFiles = new Map<string, File>();

const MIME_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  mp2: "audio/mpeg",
  m4a: "audio/mp4",
  m4b: "audio/mp4",
  mp4: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  wav: "audio/wav",
  wave: "audio/wav",
  webm: "audio/webm",
  wma: "audio/x-ms-wma",
  aif: "audio/aiff",
  aiff: "audio/aiff",
  ape: "audio/x-ape",
  mka: "audio/x-matroska",
  dsf: "audio/x-dsf",
  amr: "audio/amr",
};

export function mimeTypeForName(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return MIME_TYPES[extension] ?? "application/octet-stream";
}

export function isTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return isTauri();
  } catch {
    return false;
  }
}

export function supportsDirectoryPicker(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.showDirectoryPicker === "function"
  );
}

export function memoryFileKey(file: File): string {
  return `memory:${file.name}:${file.size}:${file.lastModified}`;
}

export function registerMemoryFiles(files: File[]): Map<string, File> {
  const registered = new Map<string, File>();
  for (const file of files) {
    const key = memoryFileKey(file);
    memoryFiles.set(key, file);
    registered.set(key, file);
  }
  return registered;
}

export function clearMemoryFiles(): void {
  memoryFiles.clear();
}

export function isMemoryFileAvailable(key: string): boolean {
  return memoryFiles.has(key);
}

/** 向用户重新申请句柄的读取权限（必须由用户手势触发）。 */
export async function ensureReadPermission(
  handle: FileSystemFileHandle,
): Promise<boolean> {
  const query = handle.queryPermission?.bind(handle);
  if (!query) return true;
  try {
    if ((await query({ mode: "read" })) === "granted") return true;
    const request = handle.requestPermission?.bind(handle);
    if (!request) return false;
    return (await request({ mode: "read" })) === "granted";
  } catch {
    return false;
  }
}

async function readTauriFile(path: string): Promise<Uint8Array> {
  const { readFile } = await import("@tauri-apps/plugin-fs");
  return readFile(path);
}

/** 低层读取：把任意来源还原成 File。 */
export async function readOriginFile(
  origin: AudioOrigin,
  fileName: string,
): Promise<File> {
  if (origin.kind === "memory") {
    const file = memoryFiles.get(origin.key);
    if (!file) {
      throw new Error(
        `《${fileName}》来自上次会话的文件选择，请重新导入后再使用`,
      );
    }
    return file;
  }

  if (origin.kind === "handle") {
    const granted = await ensureReadPermission(origin.handle);
    if (!granted) {
      throw new Error(`没有读取《${fileName}》的权限，请重新授权目录`);
    }
    return origin.handle.getFile();
  }

  if (!isTauriRuntime()) {
    throw new Error("当前环境不支持直接读取本地路径");
  }
  const bytes = await readTauriFile(origin.path);
  const buffer = Uint8Array.from(bytes).buffer;
  return new File([buffer], fileName, { type: mimeTypeForName(fileName) });
}

/**
 * 生成 <audio> 可用的 URL，并给出释放回调。
 *
 * options.decode 为 true（或曲目本身需要软解，如 ALAC）时，
 * 读取整个文件，用 @audio/decode-aac 解码为 WAV 再交给 <audio> 播放。
 */
export async function createPlaybackSource(
  track: Track,
  options: { decode?: boolean } = {},
): Promise<PlaybackSource> {
  const forceDecode = options.decode === true || needsSoftwareDecode(track);

  if (!forceDecode && track.origin.kind === "path") {
    if (!isTauriRuntime()) {
      throw new Error("当前环境不支持直接播放本地路径");
    }
    return { url: convertFileSrc(track.origin.path), release: () => {} };
  }

  const file = await readOriginFile(track.origin, track.fileName);

  if (forceDecode) {
    const { blob } = await decodeAudioFileToWav(file);
    const url = URL.createObjectURL(blob);
    return { url, release: () => URL.revokeObjectURL(url) };
  }

  const url = URL.createObjectURL(file);
  return {
    url,
    release: () => URL.revokeObjectURL(url),
  };
}

export function originLabel(origin: AudioOrigin): string {
  switch (origin.kind) {
    case "path":
      return origin.path;
    case "handle":
      return origin.handle.name;
    case "memory":
    default:
      return "仅当前会话可用";
  }
}
