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

/** 发行信息。tag 中很少有完整日期，往往只有年份；
   * 若有完整日期则优先保留，否则仅保留年份，全无时为 null。
   */
export interface ReleaseInfo {
  /** 完整日期字符串（本地格式，如 `1973-04-23`），无法构成有效日期时为 null。
   */
  display: string | null;
  /** 年份（1973），无法得知时为 null。
   */
  year: number | null;
  /** 排序用数值：YYYYMMDD，不足位补 0（如无月日则落后于同年度的完整日期）。
   */
  sortValue: number;
}

export interface Track {

  id: string;
  title: string;
  artist: string;
  albumArtist: string;
  /** 作曲家；标签缺失时为空串（旧版入库记录亦为空串）。 */
  composer: string;
  album: string;
  genre: string;
  releaseDate: ReleaseInfo;
  trackNo: number | null;
  discNo: number | null;
  /** 秒；无法解析时为 0。 */
  duration: number;
  bitrate: number | null;
  sampleRate: number | null;
  bitDepth: number | null;
  lossless: boolean;
  fileName: string;
  fileSize: number;
  addedAt: number;
  origin: AudioOrigin;
  /** 指向 covers 存储中的封面；没有封面时为 null。 */
  coverId: string | null;
  playCount: number;
  lastPlayedAt: number | null;
  copyright: string | null;
}

export interface AlbumSummary {
  copyright: string;
  key: string;
  album: string;
  albumArtist: string;
  releaseDate: ReleaseInfo;
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
  language: "zh-CN" | "en-US";
  autoWatch: boolean;
  watchedFolders: string[];
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
  language: "zh-CN",
  autoWatch: true,
  watchedFolders: [],
  lastTrackId: null,
};

/** 顶层排序/展示用的占位值。 */
export const UNKNOWN_ARTIST = "未知艺术家";
export const UNKNOWN_ALBUM = "未知专辑";
