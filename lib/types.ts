/**
 * Konzert 领域模型。
 *
 * 所有数据都保存在本机（IndexedDB），不依赖任何服务端。
 */

/**
 * 音频文件的来源。本地优先意味着我们只记录「指向文件的方式」，
 * 而不是把音频内容复制进数据库。
 */
export type AudioOrigin =
  /** Tauri（或任何拥有绝对路径的环境）下的本地文件路径。 */
  | { kind: "path"; path: string }
  /** 浏览器 File System Access API 得到的文件句柄，可持久化到 IndexedDB。 */
  | { kind: "handle"; handle: FileSystemFileHandle }
  /** 仅存在于当前会话内存中的文件（拖拽、<input type="file">）。 */
  | { kind: "memory"; key: string };

export interface Track {
  id: string;
  title: string;
  artist: string;
  albumArtist: string;
  album: string;
  genre: string;
  year: number | null;
  trackNo: number | null;
  discNo: number | null;
  /** 秒；无法解析时为 0。 */
  duration: number;
  bitrate: number | null;
  sampleRate: number | null;
  codec: string;
  lossless: boolean;
  fileName: string;
  fileSize: number;
  addedAt: number;
  origin: AudioOrigin;
  /** 指向 covers 存储中的封面；没有封面时为 null。 */
  coverId: string | null;
  playCount: number;
  lastPlayedAt: number | null;
}

export interface AlbumSummary {
  key: string;
  album: string;
  albumArtist: string;
  year: number | null;
  coverId: string | null;
  tracks: Track[];
  duration: number;
}

export interface PlayHistoryEntry {
  trackId: string;
  at: number;
}

export interface LibrarySettings {
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  /** 上次播放的曲目，便于下次启动还原。 */
  lastTrackId: string | null;
}

export type RepeatMode = "off" | "all" | "one";

export type ScanPhase = "idle" | "picking" | "walking" | "parsing" | "saving";

export interface ScanProgress {
  phase: ScanPhase;
  /** 已经处理的文件数。 */
  processed: number;
  /** 已知的文件总数（遍历阶段可能还在变化）。 */
  total: number;
  /** 当前正在处理的文件或目录名。 */
  label: string;
}

export const DEFAULT_SETTINGS: LibrarySettings = {
  volume: 1,
  muted: false,
  shuffle: false,
  repeat: "off",
  lastTrackId: null,
};

/** 顶层排序/展示用的占位值。 */
export const UNKNOWN_ARTIST = "未知艺术家";
export const UNKNOWN_ALBUM = "未知专辑";
