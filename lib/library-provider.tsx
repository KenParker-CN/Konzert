"use client";

/**
 * 曲库状态：本地读取/写入、导入扫描、收藏与播放历史。
 *
 * 全部数据保存在本机 IndexedDB，不依赖任何服务端。
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { groupAlbums } from "./catalog";
import {
  KV_FAVORITES,
  KV_HISTORY,
  KV_SETTINGS,
  deleteCovers,
  deleteTracks,
  loadFavorites,
  loadHistory,
  loadKv,
  loadTracks,
  resetDatabase,
  saveCovers,
  saveKv,
  saveTracks,
  storageAvailable,
} from "./db";
import { filesFromDataTransfer, pickFilesFromInput } from "./file-input";
import { pickLibraryDirectory, scanDirectory, scanFiles } from "./scan";
import { registerMemoryFiles, supportsDirectoryPicker } from "./sources";
import { FileWatcher, reparseTrackMetadata, type FileChangeEvent } from "./watch";
import {
  DEFAULT_SETTINGS,
  type AlbumSummary,
  type LibrarySettings,
  type PlayHistoryEntry,
  type RepeatMode,
  type ScanProgress,
  type Track,
} from "./types";

/** 历史记录上限，避免无限增长。 */
const HISTORY_LIMIT = 300;

function dedupeHistory(entries: PlayHistoryEntry[]): PlayHistoryEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.trackId)) return false;
    seen.add(entry.trackId);
    return true;
  });
}

export interface ScanSummary {
  added: number;
  updated: number;
  unchanged: number;
  failed: number;
  finishedAt: number;
}

export type StorageMode = "tauri" | "fs-access" | "session";

export interface LibraryContextValue {
  ready: boolean;
  tracks: Track[];
  albums: AlbumSummary[];
  /** 按加入时间倒序，用于「最近添加」。 */
  recentTracks: Track[];
  tracksById: Map<string, Track>;
  favorites: Set<string>;
  history: PlayHistoryEntry[];
  settings: LibrarySettings;
  scanning: boolean;
  progress: ScanProgress | null;
  lastScan: ScanSummary | null;
  error: string | null;
  storageMode: StorageMode;
  importFolder: () => Promise<void>;
  refreshLibrary: () => Promise<void>;
  importFiles: (files: File[]) => Promise<void>;
  importFromDrop: (transfer: DataTransfer) => Promise<void>;
  cancelScan: () => void;
  removeTracks: (ids: string[]) => Promise<void>;
  clearLibrary: () => Promise<void>;
  toggleFavorite: (trackId: string) => void;
  clearHistory: () => void;
  recordPlay: (trackId: string) => void;
  updateSettings: (patch: Partial<LibrarySettings>) => void;
  dismissError: () => void;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

function normalizeSettings(value: unknown): LibrarySettings {
  if (!value || typeof value !== "object") return DEFAULT_SETTINGS;
  const raw = value as Partial<LibrarySettings>;
  const repeat: RepeatMode =
    raw.repeat === "all" || raw.repeat === "one" || raw.repeat === "off"
      ? raw.repeat
      : DEFAULT_SETTINGS.repeat;
  return {
    volume:
      typeof raw.volume === "number" && Number.isFinite(raw.volume)
        ? Math.min(1, Math.max(0, raw.volume))
        : DEFAULT_SETTINGS.volume,
    muted: Boolean(raw.muted),
    shuffle: Boolean(raw.shuffle),
    repeat,
    language: raw.language === "en-US" ? "en-US" : "zh-CN",
    autoWatch: raw.autoWatch !== false,
    watchedFolders: Array.isArray(raw.watchedFolders)
      ? raw.watchedFolders.filter((path): path is string => typeof path === "string")
      : [],
    lastTrackId:
      typeof raw.lastTrackId === "string" ? raw.lastTrackId : null,
  };
}

function detectStorageMode(): StorageMode {
  if (typeof window === "undefined") return "session";
  if ((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
    return "tauri";
  }
  return supportsDirectoryPicker() ? "fs-access" : "session";
}

/** useSyncExternalStore 需要一个恒定的订阅函数：运行环境在本会话内不会变化。 */
const subscribeToNothing = () => () => {};
const serverStorageMode = (): StorageMode => "session";

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<PlayHistoryEntry[]>([]);
  const [settings, setSettings] = useState<LibrarySettings>(DEFAULT_SETTINGS);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [lastScan, setLastScan] = useState<ScanSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tracksRef = useRef<Track[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const fileWatcherRef = useRef<FileWatcher | null>(null);

  /**
   * 运行环境（Tauri / 文件夹句柄 / 兼容模式）只在客户端可判定：
   * 服务端快照固定为 session，避免首屏 hydration 不一致。
   */
  const storageMode = useSyncExternalStore(
    subscribeToNothing,
    detectStorageMode,
    serverStorageMode,
  );

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  // ------------------------------------------------------------ 文件系统监听

  /** 处理文件变更事件 */
  const handleFileChange = useCallback(async (event: FileChangeEvent) => {
    const currentTracks = tracksRef.current;

    // 查找匹配的曲目（通过路径）
    const { normalizePathKey, pathSourceKey } = await import("./scan");
    pathSourceKey(event.path);
    const targetTrack = currentTracks.find(
      (track) =>
        track.origin.kind === "path" &&
        normalizePathKey(track.origin.path) === normalizePathKey(event.path),
    );

    if (!targetTrack) return;

    if (event.kind === "remove") {
      // 文件被删除，从曲库中移除
      await deleteTracks([targetTrack.id]);
      setTracks((current) => current.filter((t) => t.id !== targetTrack.id));
      return;
    }

    // 文件被修改或创建，重新解析元数据
    const updated = await reparseTrackMetadata(targetTrack);
    if (updated) {
      await saveTracks([updated]);
      setTracks((current) =>
        current.map((t) => (t.id === updated.id ? updated : t)),
      );
    }
  }, []);

  /** 启动文件系统监听 */
  useEffect(() => {
    if (!FileWatcher.isSupported() || !ready || !settings.autoWatch) return;

    const currentTracks = tracksRef.current;
    if (currentTracks.length === 0) return;

    // 收集所有需要监听的目录（只监听 Tauri 路径来源的文件）
    const watchPaths = new Set<string>();
    for (const track of currentTracks) {
      if (track.origin.kind === "path") {
        const dirPath = track.origin.path.replace(/[^\\/]+$/, "");
        watchPaths.add(dirPath);
      }
    }

    if (watchPaths.size === 0) return;

    const watcher = new FileWatcher({
      paths: [...watchPaths],
      onEvent: handleFileChange,
      onError: (error) => {
        console.error("File watcher error:", error);
      },
    });

    fileWatcherRef.current = watcher;

    watcher.start().catch((error) => {
      console.error("Failed to start file watcher:", error);
      fileWatcherRef.current = null;
    });

    return () => {
      watcher.stop();
      fileWatcherRef.current = null;
    };
  }, [ready, handleFileChange, settings.autoWatch]);

  // ------------------------------------------------------------ 初始化

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (!storageAvailable()) {
        if (!cancelled) setReady(true);
        return;
      }
      try {
        const [storedTracks, storedFavorites, storedHistory, storedSettings] =
          await Promise.all([
            loadTracks(),
            loadFavorites(),
            loadHistory(),
            loadKv<LibrarySettings>(KV_SETTINGS),
          ]);
        if (cancelled) return;
        setTracks(storedTracks);
        setFavorites(new Set(storedFavorites));
        const normalizedHistory = dedupeHistory(storedHistory).slice(
          0,
          HISTORY_LIMIT,
        );
        setHistory(normalizedHistory);
        if (normalizedHistory.length !== storedHistory.length) {
          void saveKv(KV_HISTORY, normalizedHistory);
        }
        setSettings(normalizeSettings(storedSettings));
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "读取本地曲库失败",
          );
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  // ------------------------------------------------------------ 收藏/历史

  const toggleFavorite = useCallback((trackId: string) => {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      void saveKv(KV_FAVORITES, [...next]);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    void saveKv(KV_HISTORY, []);
  }, []);

  const recordPlay = useCallback((trackId: string) => {
    const at = Date.now();
    setHistory((current) => {
      const deduped = current.filter((entry) => entry.trackId !== trackId);
      const next = [{ trackId, at }, ...deduped].slice(0, HISTORY_LIMIT);
      void saveKv(KV_HISTORY, next);
      return next;
    });
    setTracks((current) => {
      const target = current.find((track) => track.id === trackId);
      if (!target) return current;
      const updated: Track = {
        ...target,
        playCount: target.playCount + 1,
        lastPlayedAt: at,
      };
      void saveTracks([updated]);
      return current.map((track) => (track.id === trackId ? updated : track));
    });
  }, []);

// ------------------------------------------------------------ 设置

  const updateSettings = useCallback((patch: Partial<LibrarySettings>) => {
    setSettings((current) => {
      const next = normalizeSettings({ ...current, ...patch });
      void saveKv(KV_SETTINGS, next);
      return next;
    });
  }, []);

  const dismissError = useCallback(() => setError(null), []);

  // ------------------------------------------------------------ 导入扫描

  const applyOutcome = useCallback(
    async (outcome: Awaited<ReturnType<typeof scanDirectory>>) => {
      const changed = [...outcome.added, ...outcome.updated];
      if (changed.length > 0) {
        await saveTracks(changed);
        setTracks((current) => {
          const merged = new Map(current.map((track) => [track.id, track]));
          for (const track of changed) merged.set(track.id, track);
          return [...merged.values()];
        });
      }
      if (outcome.covers.length > 0) {
        await saveCovers(outcome.covers);
      }
      setLastScan({
        added: outcome.added.length,
        updated: outcome.updated.length,
        unchanged: outcome.unchanged,
        failed: outcome.failures.length,
        finishedAt: Date.now(),
      });
      if (outcome.failures.length > 0) {
        const first = outcome.failures[0];
        setError(
          `有 ${outcome.failures.length} 个文件未能导入，例如「${first.fileName}」：${first.reason}`,
        );
      }
    },
    [],
  );

  const runScan = useCallback(
    async (
      execute: (
        onProgress: (value: ScanProgress) => void,
        signal: AbortSignal,
      ) => Promise<Awaited<ReturnType<typeof scanDirectory>>>,
    ) => {
      if (scanning) return;
      const controller = new AbortController();
      abortRef.current = controller;
      setScanning(true);
      setError(null);
      setProgress({ phase: "picking", processed: 0, total: 0, label: "准备中" });
      try {
        const outcome = await execute(setProgress, controller.signal);
        await applyOutcome(outcome);
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : "导入失败，请重试";
        if (message !== "扫描已取消") setError(message);
      } finally {
        setScanning(false);
        setProgress(null);
        abortRef.current = null;
      }
    },
    [applyOutcome, scanning],
  );

  const importFolder = useCallback(async () => {
    if (scanning) return;

    try {
      const source = await pickLibraryDirectory();
      if (source) {
        if (source.kind === "path") {
          updateSettings({
            watchedFolders: [...new Set([...settings.watchedFolders, source.path])],
          });
        }
        await runScan((onProgress, signal) =>
          scanDirectory({
            source,
            existingTracks: tracksRef.current,
            onProgress,
            signal,
          }),
        );
        return;
      }
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "无法打开文件夹选择器";
      // 用户主动取消不是错误。
      if (/abort|cancel/i.test(message)) return;
      setError(message);
      return;
    }

    // 回退：webkitdirectory（不支持目录句柄的环境）。
    const files = await pickFilesFromInput({ directory: true });
    if (files.length === 0) return;
    registerMemoryFiles(files);
    await runScan((onProgress, signal) =>
      scanFiles({
        files,
        existingTracks: tracksRef.current,
        onProgress,
        signal,
      }),
    );
  }, [runScan, scanning, settings.watchedFolders, updateSettings]);

  const refreshLibrary = useCallback(async () => {
    if (scanning) return;
    const folders = settings.watchedFolders;
    if (folders.length === 0) {
      setError("还没有固定监控的音乐文件夹，请先扫描一个文件夹。");
      return;
    }

    try {
      for (const path of folders) {
        await runScan((onProgress, signal) =>
          scanDirectory({
            source: { kind: "path", path },
            existingTracks: tracksRef.current,
            onProgress,
            signal,
          }),
        );
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "刷新音乐库失败");
    }
  }, [runScan, scanning, settings.watchedFolders]);

  const importFiles = useCallback(
    async (files: File[]) => {
      if (scanning || files.length === 0) return;
      registerMemoryFiles(files);
      await runScan((onProgress, signal) =>
        scanFiles({
          files,
          existingTracks: tracksRef.current,
          onProgress,
          signal,
        }),
      );
    },
    [runScan, scanning],
  );

  const importFromDrop = useCallback(
    async (transfer: DataTransfer) => {
      if (scanning) return;
      const files = await filesFromDataTransfer(transfer);
      await importFiles(files);
    },
    [importFiles, scanning],
  );

  const cancelScan = useCallback(() => {
    abortRef.current?.abort();
  }, []);

// ------------------------------------------------------------ 删除/清空

  const removeTracks = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const targetIds = new Set(ids);
    const current = tracksRef.current;
    const remaining = current.filter((track) => !targetIds.has(track.id));
    const usedCovers = new Set(
      remaining.map((track) => track.coverId).filter(Boolean) as string[],
    );
    const orphanCovers = [
      ...new Set(
        current
          .filter((track) => targetIds.has(track.id))
          .map((track) => track.coverId)
          .filter(
            (id): id is string =>
              typeof id === "string" && !usedCovers.has(id),
          ),
      ),
    ];

    await deleteTracks(ids);
    if (orphanCovers.length > 0) await deleteCovers(orphanCovers);
    setTracks(remaining);

    setFavorites((existing) => {
      const next = new Set(existing);
      for (const id of ids) next.delete(id);
      void saveKv(KV_FAVORITES, [...next]);
      return next;
    });

    setHistory((existing) => {
      const next = existing.filter((entry) => !targetIds.has(entry.trackId));
      if (next.length !== existing.length) void saveKv(KV_HISTORY, next);
      return next;
    });
  }, []);

  const clearLibrary = useCallback(async () => {
    await resetDatabase();
    setTracks([]);
    setFavorites(new Set());
    setHistory([]);
    setLastScan(null);
    setSettings((current) => {
      const next = { ...DEFAULT_SETTINGS, volume: current.volume };
      void saveKv(KV_SETTINGS, next);
      return next;
    });
  }, []);

  // ------------------------------------------------------------ 派生数据

  const albums = useMemo(() => groupAlbums(tracks), [tracks]);

  const recentTracks = useMemo(
    () => [...tracks].sort((a, b) => b.addedAt - a.addedAt),
    [tracks],
  );

  const tracksById = useMemo(
    () => new Map(tracks.map((track) => [track.id, track])),
    [tracks],
  );

  /**
   * 直接给上下文提供对象：本应用的 provider 状态更新频率很低
   * （仅在扫描/收藏/播放时变化），无需手动 memo，
   * 由 eslint-plugin-react-hooks 的新规则保持一致。
   */
  const value: LibraryContextValue = {
    ready,
    tracks,
    albums,
    recentTracks,
    tracksById,
    favorites,
    history,
    settings,
    scanning,
    progress,
    lastScan,
    error,
    storageMode,
    importFolder,
    refreshLibrary,
    importFiles,
    importFromDrop,
    cancelScan,
    removeTracks,
    clearLibrary,
    toggleFavorite,
    clearHistory,
    recordPlay,
    updateSettings,
    dismissError,
  };

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  );
}

export function useLibrary(): LibraryContextValue {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error("useLibrary 必须在 LibraryProvider 内部使用");
  }
  return context;
}