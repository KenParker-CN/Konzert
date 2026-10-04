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
import { invoke } from "@tauri-apps/api/core";
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
import {
  importTrackFromPath,
  normalizePathKey,
  pickLibraryDirectory,
  scanDirectory,
  scanDirectoryDifferential,
  scanFiles,
  type DirectorySource,
} from "./scan";
import {
  ensureDirectoryReadPermission,
  registerMemoryFiles,
  supportsDirectoryPicker,
} from "./sources";
import { FileWatcher, reparseTrackMetadata, type FileChangeEvent } from "./watch";
import {
  DEFAULT_SETTINGS,
  type AlbumSummary,
  type LibrarySettings,
  type PlayHistoryEntry,
  type RepeatMode,
  type ScanProgress,
  type Track,
  trackFavoriteKey,
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
  selectMonitorFolder: () => Promise<void>;
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
    monitorFolder:
      raw.monitorFolder?.kind === "path" &&
      typeof raw.monitorFolder.path === "string"
        ? raw.monitorFolder
        : raw.monitorFolder?.kind === "handle" &&
            typeof raw.monitorFolder.id === "string" &&
            typeof raw.monitorFolder.name === "string" &&
            raw.monitorFolder.handle?.kind === "directory"
          ? raw.monitorFolder
          : null,
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
  const lastBrowserRefreshRef = useRef(0);

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

    const targetTrack = currentTracks.find(
      (track) =>
        track.origin.kind === "path" &&
        normalizePathKey(track.origin.path) === normalizePathKey(event.path),
    );

    if (event.kind === "remove") {
      if (!targetTrack) return;
      // 验证文件确实不存在，避免外接硬盘拔出时误删曲库记录。
      // exists 返回 false 为真实删除；抛出异常（如驱动器已拔出）则跳过。
      try {
        const { exists } = await import("@tauri-apps/plugin-fs");
        if (await exists(event.path)) return;
      } catch {
        console.warn(
          `Skipping deletion of ${event.path}: cannot verify existence`,
        );
        return;
      }
      await deleteTracks([targetTrack.id]);
      setTracks((current) => current.filter((t) => t.id !== targetTrack.id));
      return;
    }

    if (targetTrack) {
      // 现有曲目被修改，重新解析元数据
      const updated = await reparseTrackMetadata(targetTrack);
      if (updated) {
        await saveTracks([updated]);
        setTracks((current) =>
          current.map((t) => (t.id === updated.id ? updated : t)),
        );
      }
      return;
    }

    // 新文件导入（create 事件且没有匹配的现有曲目）
    const outcome = await importTrackFromPath(event.path, currentTracks);
    const track = outcome.added[0] ?? outcome.updated[0];
    if (track) {
      await saveTracks([track]);
      setTracks((current) => [...current, track]);
      if (outcome.covers.length > 0) {
        await saveCovers(outcome.covers);
      }
    }
  }, []);

  /** 启动文件系统监听 */
  useEffect(() => {
    if (!FileWatcher.isSupported() || !ready) return;
    const monitorFolder = settings.monitorFolder;
    if (monitorFolder?.kind !== "path") return;

    const watcher = new FileWatcher({
      paths: [monitorFolder.path],
      onEvent: handleFileChange,
      onError: (error) => {
        console.error("File watcher error:", error);
      },
    });

    fileWatcherRef.current = watcher;

    let cancelled = false;
    void (async () => {
      try {
        // Native dialog grants are transient; restore the saved folder's scope
        // before starting its watcher on subsequent app launches.
        await invoke("restore_monitor_folder_scope", {
          path: monitorFolder.path,
        });
        if (!cancelled) await watcher.start();
      } catch (error) {
        console.error("Unable to restore monitored folder access:", error);
      }
    })();

    return () => {
      cancelled = true;
      void watcher.stop();
      fileWatcherRef.current = null;
    };
  }, [ready, handleFileChange, settings.monitorFolder]);

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
        const migratedFavorites = storedFavorites.map((key) =>
          key.startsWith("track:") || key.startsWith("album:") || key.startsWith("artist:")
            ? key
            : trackFavoriteKey(key),
        );
        setFavorites(new Set(migratedFavorites));
        if (migratedFavorites.some((key, index) => key !== storedFavorites[index])) {
          void saveKv(KV_FAVORITES, migratedFavorites);
        }
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

  const toggleFavorite = useCallback((entityKey: string) => {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(entityKey)) next.delete(entityKey);
      else next.add(entityKey);
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
    async (
      outcome: Awaited<ReturnType<typeof scanDirectory>> & { removed?: Track[] },
    ) => {
      const changed = [
        ...outcome.added,
        ...outcome.updated,
        ...(outcome.relinked ?? []),
      ];
      if (changed.length > 0) {
        await saveTracks(changed);
        setTracks((current) => {
          const merged = new Map(current.map((track) => [track.id, track]));
          for (const track of changed) merged.set(track.id, track);
          return [...merged.values()];
        });
      }
      if (outcome.removed && outcome.removed.length > 0) {
        const removedIds = new Set(outcome.removed.map((t) => t.id));
        await deleteTracks([...removedIds]);

        // 清理孤儿封面（不再被任何曲目引用）
        const current = tracksRef.current;
        const remaining = current.filter((t) => !removedIds.has(t.id));
        const usedCovers = new Set(
          remaining.map((t) => t.coverId).filter(Boolean) as string[],
        );
        const orphanCovers = [
          ...new Set(
            outcome.removed
              .map((t) => t.coverId)
              .filter(
                (id): id is string =>
                  typeof id === "string" && !usedCovers.has(id),
              ),
          ),
        ];
        if (orphanCovers.length > 0) await deleteCovers(orphanCovers);

        // 从状态移除已删除曲目的封布
        setTracks((currentTracks) =>
          currentTracks.filter((t) => !removedIds.has(t.id)),
        );

        // 清理收藏
        setFavorites((existing) => {
          const next = new Set(existing);
          for (const id of removedIds) next.delete(trackFavoriteKey(id));
          void saveKv(KV_FAVORITES, [...next]);
          return next;
        });

        // 清理播放历史
        setHistory((existing) => {
          const next = existing.filter(
            (entry) => !removedIds.has(entry.trackId),
          );
          void saveKv(KV_HISTORY, next);
          return next;
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
        let scanSource = source;
        if (
          source.kind === "handle" &&
          settings.monitorFolder?.kind === "handle"
        ) {
          const folder = settings.monitorFolder;
          const sameEntry = folder.handle.isSameEntry
            ? await folder.handle.isSameEntry(source.handle)
            : folder.name === source.handle.name;
          if (sameEntry) scanSource = { ...source, sourceId: folder.id };
        }
        await runScan((onProgress, signal) =>
          scanDirectoryDifferential({
            source: scanSource,
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
      if (/abort|cancel/i.test(message)) return;
      setError(message);
      return;
    }

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
  }, [runScan, scanning, settings.monitorFolder]);

  const selectMonitorFolder = useCallback(async () => {
    if (scanning) return;

    try {
      const source = await pickLibraryDirectory();
      if (!source) {
        if (storageMode === "session") {
          setError("当前环境不支持选择要监控的文件夹");
        }
        return;
      }

      let monitorSource = source;
      if (source.kind === "path") {
        updateSettings({ monitorFolder: { kind: "path", path: source.path } });
      } else {
        const previous = settings.monitorFolder;
        const sameEntry =
          previous?.kind === "handle" &&
          (previous.handle.isSameEntry
            ? await previous.handle.isSameEntry(source.handle)
            : previous.name === source.handle.name);
        const folder = sameEntry && previous?.kind === "handle"
          ? previous
          : {
              kind: "handle" as const,
              id: crypto.randomUUID(),
              name: source.handle.name,
              handle: source.handle,
            };
        updateSettings({ monitorFolder: folder });
        monitorSource = { ...source, sourceId: folder.id };
      }

      await runScan((onProgress, signal) =>
        scanDirectoryDifferential({
          source: monitorSource,
          existingTracks: tracksRef.current,
          onProgress,
          signal,
        }),
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "无法选择监控文件夹";
      if (!/abort|cancel/i.test(message)) setError(message);
    }
  }, [runScan, scanning, settings.monitorFolder, storageMode, updateSettings]);

  const refreshLibrary = useCallback(async (requestPermission = true) => {
    if (scanning) return;
    const folder = settings.monitorFolder;
    if (!folder) {
      setError("请先选择一个要监控的音乐文件夹。");
      return;
    }

    try {
      const source: DirectorySource =
        folder.kind === "path"
          ? folder
          : { kind: "handle", handle: folder.handle, sourceId: folder.id };
      if (folder.kind === "handle") {
        const permitted = await ensureDirectoryReadPermission(
          folder.handle,
          requestPermission,
        );
        if (!permitted) {
          if (requestPermission) setError(`请重新授权读取文件夹「${folder.name}」`);
          return;
        }
      }
      await runScan((onProgress, signal) =>
        scanDirectoryDifferential({
          source,
          existingTracks: tracksRef.current,
          onProgress,
          signal,
        }),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "刷新音乐库失败");
    }
  }, [runScan, scanning, settings.monitorFolder]);

  useEffect(() => {
    if (!ready || settings.monitorFolder?.kind !== "handle") return;

    const refreshIfDue = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastBrowserRefreshRef.current < 60_000) return;
      lastBrowserRefreshRef.current = Date.now();
      void refreshLibrary(false);
    };
    const interval = window.setInterval(refreshIfDue, 60_000);
    window.addEventListener("focus", refreshIfDue);
    document.addEventListener("visibilitychange", refreshIfDue);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshIfDue);
      document.removeEventListener("visibilitychange", refreshIfDue);
    };
  }, [ready, refreshLibrary, settings.monitorFolder]);

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
    selectMonitorFolder,
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
