/**
 * 文件系统监听：检测外部元数据变更并自动更新曲库。
 *
 * 只在 Tauri 环境下启用，使用 fs 插件的 watch 功能监听已导入的音频文件。
 * 当文件被外部工具（如 Mp3tag）修改时，自动重新解析元数据并更新 IndexedDB。
 */

import type { UnwatchFn, WatchEventKind } from "@tauri-apps/plugin-fs";
import { isTauriRuntime } from "./sources";
import type { Track } from "./types";

export interface FileChangeEvent {
  /** 文件绝对路径 */
  path: string;
  /** 事件类型 */
  kind: "modify" | "create" | "remove";
}

export interface WatchOptions {
  /** 监听的目录路径 */
  paths: string[];
  /** 文件变更回调 */
  onEvent: (event: FileChangeEvent) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
}

/** 防抖延迟：外部工具保存时可能触发多次事件，等待 500ms 后再处理。 */
const DEBOUNCE_MS = 500;

/** 重试延迟：文件可能被锁定，等待 1s 后重试。 */
const RETRY_MS = 1000;

/** 最大重试次数 */
const MAX_RETRIES = 3;

/**
 * 防抖器：合并短时间内对同一文件的多次事件。
 */
class Debouncer {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  schedule(key: string, callback: () => void): void {
    const existing = this.timers.get(key);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.timers.delete(key);
      callback();
    }, DEBOUNCE_MS);

    this.timers.set(key, timer);
  }
  cancelAll(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}

/**
 * 文件系统监听器。
 *
 * 只在 Tauri 环境下工作，监听指定目录下的音频文件变更。
 */
export class FileWatcher {
  private debouncer = new Debouncer();
  private watching = false;
  private unwatchCallbacks: UnwatchFn[] = [];

  constructor(private options: WatchOptions) {}

  /** 检查是否支持文件系统监听 */
  static isSupported(): boolean {
    return isTauriRuntime();
  }

  /** 开始监听 */
  async start(): Promise<void> {
    if (!FileWatcher.isSupported()) {
      throw new Error("文件系统监听仅在 Tauri 环境下可用");
    }

    if (this.watching) return;

    try {
      const { watch } = await import("@tauri-apps/plugin-fs");

      for (const path of this.options.paths) {
        const unwatch = await watch(
          path,
          (event) => {
            for (const path of event.paths) {
              this.handleEvent(event.type, path);
            }
          },
          { recursive: true, delayMs: DEBOUNCE_MS },
        );
        this.unwatchCallbacks.push(unwatch);
      }

      this.watching = true;
    } catch (error) {
      this.unwatchCallbacks = [];
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /** 停止监听 */
  async stop(): Promise<void> {
    for (const unwatch of this.unwatchCallbacks) {
      try {
        unwatch();
      } catch (error) {
        console.error("Error unwatching path:", error);
      }
    }
    this.unwatchCallbacks = [];
    this.debouncer.cancelAll();
    this.watching = false;
  }

  /**
   * 处理文件系统事件。
   *
   * WatchEvent.type 是 notify 的事件联合类型：只关心增/删/改；
   * access 类事件必须忽略，否则「重读文件 → 触发 access」会形成死循环。
   */
  private handleEvent(type: WatchEventKind, path: string): void {
    let kind: FileChangeEvent["kind"] | null = null;
    if (type === "any") {
      // 无法细分的 any 事件按「修改」保守处理。
      kind = "modify";
    } else if (type !== "other") {
      if ("modify" in type) kind = "modify";
      else if ("create" in type) kind = "create";
      else if ("remove" in type) kind = "remove";
    }
    if (!kind) return;

    const event: FileChangeEvent = { path, kind };

    // 使用路径作为防抖键
    this.debouncer.schedule(path, () => {
      this.options.onEvent(event);
    });
  }
}

/**
 * 重新读取单个文件的元数据。
 *
 * @param track - 要更新的曲目记录
 * @returns 更新后的曲目，如果文件不存在或解析失败则返回 null
 */
export async function reparseTrackMetadata(
  track: Track,
): Promise<Track | null> {
  const { readOriginFile } = await import("./sources");
  const { parseAudioFile } = await import("./metadata");
  const { albumKeyOf, coverIdFor } = await import("./catalog");

  let retries = 0;
  let lastError: Error | null = null;

  while (retries <= MAX_RETRIES) {
    try {
      const file = await readOriginFile(track.origin, track.fileName);
      const metadata = await parseAudioFile(file, track.fileName);

      // 保留原有的统计信息和添加时间
      const updated: Track = {
        ...track,
        title: metadata.title,
        artist: metadata.artist,
        albumArtist: metadata.albumArtist,
        album: metadata.album,
        genre: metadata.genre,
        year: metadata.year,
        trackNo: metadata.trackNo,
        discNo: metadata.discNo,
        duration: metadata.duration,
        bitrate: metadata.bitrate,
        sampleRate: metadata.sampleRate,
        codec: metadata.codec,
        lossless: metadata.lossless,
        fileSize: file.size,
      };

      // 如果封面变化，更新 coverId
      const albumKey = albumKeyOf(updated);
      const newCoverId = coverIdFor(updated, albumKey);
      if (metadata.cover && newCoverId !== track.coverId) {
        updated.coverId = newCoverId;
      }

      return updated;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      retries++;

      if (retries <= MAX_RETRIES) {
        // 等待后重试
        await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
      }
    }
  }

  // 所有重试都失败，返回 null 而不是抛出错误
  // 这样调用方可以决定是否删除或保留旧记录
  console.error(`Failed to reparse track ${track.id} after ${MAX_RETRIES} retries:`, lastError);
  return null;
}
