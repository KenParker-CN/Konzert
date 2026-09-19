"use client";

/**
 * 播放器状态：队列、播放控制、进度、音量。
 *
 * 偏好（音量/随机/循环/上次曲目）统一存在曲库的 settings 中，
 * 因此这里不重复维护，直接读写 LibraryProvider。
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { loadCover } from "./db";
import { useLibrary } from "./library-provider";
import { isM4aFamily, needsSoftwareDecode } from "./decode";
import { createPlaybackSource, type PlaybackSource } from "./sources";
import type { RepeatMode, Track } from "./types";

export interface PlayerContextValue {
  current: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  error: string | null;
  playTrack: (track: Track, context?: Track[]) => void;
  /** startIndex 默认 0；shuffle 缺省时沿用全局随机设置。 */
  playQueue: (
    tracks: Track[],
    startIndex?: number,
    options?: { shuffle?: boolean },
  ) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (time: number) => void;
  setVolume: (value: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  addToQueue: (track: Track) => void;
  playNextInQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  dismissError: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

/** 随机播放时把选定曲目放在最前面，其余打乱。 */
function shuffleFrom(tracks: Track[], startIndex: number): Track[] {
  const start = tracks[startIndex];
  const rest = tracks.filter((_, index) => index !== startIndex);
  return start ? [start, ...shuffled(rest)] : shuffled(tracks);
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { settings, updateSettings, recordPlay, tracksById, ready } =
    useLibrary();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sourceRef = useRef<PlaybackSource | null>(null);
  const loadedTrackIdRef = useRef<string | null>(null);
  /** 原生播放失败后改走软解重试的曲目，每首只重试一次。 */
  const retryDecodeRef = useRef<Set<string>>(new Set());
  const originalQueueRef = useRef<Track[]>([]);

  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const queueRef = useRef<Track[]>([]);
  const indexRef = useRef(0);
  const currentRef = useRef<Track | null>(null);

  const { volume, muted, shuffle, repeat } = settings;

  /**
   * 队列为空但记住了「上次播放」时，用它作为当前曲目占位：
   * 只展示信息，等用户按下播放才真正读取文件（避免启动即弹权限）。
   */
  const restoredTrack =
    queue.length === 0 && ready && settings.lastTrackId
      ? (tracksById.get(settings.lastTrackId) ?? null)
      : null;
  const current = restoredTrack ?? queue[queueIndex] ?? null;

  // 音频事件回调需要读取最新状态，统一在提交后同步进 ref（渲染期不写 ref）。
  useEffect(() => {
    queueRef.current = restoredTrack ? [restoredTrack] : queue;
    indexRef.current = restoredTrack ? 0 : queueIndex;
    currentRef.current = current;
  }, [queue, queueIndex, restoredTrack, current]);

  /** 释放上一个 Object URL，避免内存泄漏。 */
  const releaseSource = useCallback(() => {
    sourceRef.current?.release();
    sourceRef.current = null;
  }, []);

  useEffect(() => releaseSource, [releaseSource]);

  // ------------------------------------------------------------ 音量同步

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = muted;
  }, [volume, muted]);

  // ------------------------------------------------------------ 加载曲目

  const load = useCallback(
    async (track: Track, autoplay: boolean) => {
      const audio = audioRef.current;
      if (!audio) return;
      setError(null);
      setIsLoading(true);
      try {
        const source = await createPlaybackSource(track, {
          decode: retryDecodeRef.current.has(track.id),
        });
        releaseSource();
        sourceRef.current = source;
        loadedTrackIdRef.current = track.id;
        audio.src = source.url;
        audio.currentTime = 0;
        audio.load();
        setCurrentTime(0);
        setMediaDuration(track.duration || 0);
        if (autoplay) {
          await audio.play();
          recordPlay(track.id);
        }
      } catch (caught) {
        loadedTrackIdRef.current = null;
        setIsPlaying(false);
        setError(
          caught instanceof Error ? caught.message : "这首曲目暂时无法播放",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [recordPlay, releaseSource],
  );

  // 音频 error 事件的兜底重试在无依赖的监听 effect 里触发，这里同步最新的 load。
  const loadRef = useRef<((track: Track, autoplay: boolean) => Promise<void>) | null>(
    null,
  );
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  const startAtIndex = useCallback(
    (nextQueue: Track[], index: number, autoplay: boolean) => {
      const track = nextQueue[index];
      if (!track) return;
      setQueue(nextQueue);
      setQueueIndex(index);
      void load(track, autoplay);
    },
    [load],
  );

  const playQueue = useCallback(
    (tracks: Track[], startIndex = 0, options?: { shuffle?: boolean }) => {
      if (tracks.length === 0) return;
      const safeIndex = Math.min(Math.max(0, startIndex), tracks.length - 1);
      const useShuffle = options?.shuffle ?? settings.shuffle;
      originalQueueRef.current = tracks;
      const nextQueue = useShuffle ? shuffleFrom(tracks, safeIndex) : tracks;
      startAtIndex(nextQueue, useShuffle ? 0 : safeIndex, true);
    },
    [settings.shuffle, startAtIndex],
  );

  const playTrack = useCallback(
    (track: Track, context?: Track[]) => {
      const list = context && context.length > 0 ? context : [track];
      const index = list.findIndex((item) => item.id === track.id);
      playQueue(list, index < 0 ? 0 : index);
    },
    [playQueue],
  );

  // ------------------------------------------------------------ 播放控制

  const advance = useCallback(
    (direction: 1 | -1, auto: boolean) => {
      const list = queueRef.current;
      const audio = audioRef.current;
      if (list.length === 0) return;

      if (auto && repeat === "one") {
        if (audio) {
          audio.currentTime = 0;
          void audio.play();
        }
        return;
      }

      let nextIndex = indexRef.current + direction;
      if (nextIndex >= list.length) {
        if (repeat === "all") nextIndex = 0;
        else {
          audio?.pause();
          setIsPlaying(false);
          return;
        }
      } else if (nextIndex < 0) {
        nextIndex = repeat === "all" ? list.length - 1 : 0;
      }

      startAtIndex(list, nextIndex, true);
    },
    [repeat, startAtIndex],
  );

  const advanceRef = useRef<((direction: 1 | -1, auto: boolean) => void) | null>(
    null,
  );
  useEffect(() => {
    advanceRef.current = advance;
  }, [advance]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    const track = currentRef.current;
    if (!audio || !track) return;
    if (loadedTrackIdRef.current !== track.id) {
      void load(track, true);
      return;
    }
    if (audio.paused) void audio.play();
    else audio.pause();
  }, [load]);

  const next = useCallback(() => advance(1, false), [advance]);
  const previous = useCallback(() => {
    const audio = audioRef.current;
    // 播放超过 3 秒时，「上一首」先回到开头（与主流播放器一致）。
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    advance(-1, false);
  }, [advance]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  // ------------------------------------------------------------ 偏好

  const setVolume = useCallback(
    (value: number) => {
      const clamped = Math.min(1, Math.max(0, value));
      updateSettings({
        volume: clamped,
        muted: clamped === 0,
      });
    },
    [updateSettings],
  );

  const toggleMute = useCallback(() => {
    updateSettings({ muted: !muted });
  }, [muted, updateSettings]);

  const toggleShuffle = useCallback(() => {
    const enabled = !settings.shuffle;
    updateSettings({ shuffle: enabled });
    const list = queueRef.current;
    const index = indexRef.current;
    if (list.length === 0) return;

    if (enabled) {
      const reordered = shuffleFrom(list, index);
      setQueue(reordered);
      setQueueIndex(0);
      return;
    }

    const original =
      originalQueueRef.current.length > 0 ? originalQueueRef.current : list;
    const trackId = list[index]?.id;
    const restoredIndex = original.findIndex((track) => track.id === trackId);
    setQueue(original);
    setQueueIndex(restoredIndex < 0 ? 0 : restoredIndex);
  }, [settings.shuffle, updateSettings]);

  const cycleRepeat = useCallback(() => {
    const order: RepeatMode[] = ["off", "all", "one"];
    const position = order.indexOf(repeat);
    updateSettings({ repeat: order[(position + 1) % order.length] });
  }, [repeat, updateSettings]);

  // ------------------------------------------------------------ 队列操作

  const addToQueue = useCallback(
    (track: Track) => {
      setQueue((list) => {
        if (list.some((item) => item.id === track.id)) return list;
        return [...list, track];
      });
    },
    [],
  );

  const playNextInQueue = useCallback((track: Track) => {
    setQueue((list) => {
      const without = list.filter((item) => item.id !== track.id);
      const insertAt = Math.min(indexRef.current + 1, without.length);
      return [...without.slice(0, insertAt), track, ...without.slice(insertAt)];
    });
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setQueue((list) => {
      if (index < 0 || index >= list.length) return list;
      const nextList = list.filter((_, position) => position !== index);
      setQueueIndex((currentIndex) => {
        if (index < currentIndex) return currentIndex - 1;
        return Math.min(currentIndex, Math.max(0, nextList.length - 1));
      });
      return nextList;
    });
  }, []);

  const clearQueue = useCallback(() => {
    audioRef.current?.pause();
    releaseSource();
    loadedTrackIdRef.current = null;
    originalQueueRef.current = [];
    setQueue([]);
    setQueueIndex(0);
    setIsPlaying(false);
    setCurrentTime(0);
  }, [releaseSource]);

  const dismissError = useCallback(() => setError(null), []);

// ------------------------------------------------------------ 音频事件

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTime = () => setCurrentTime(audio.currentTime);
    const handleDuration = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setMediaDuration(audio.duration);
      }
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => advanceRef.current?.(1, true);
    const handleError = () => {
      const track = currentRef.current;
      if (!loadedTrackIdRef.current || !track) return;
      setIsPlaying(false);
      // 内核不支持的编码（例如元数据没标出的 ALAC）会在这里失败：
      // M4A 家族改走软解自动重试一次，仍失败才提示用户。
      if (
        !needsSoftwareDecode(track) &&
        isM4aFamily(track.fileName) &&
        !retryDecodeRef.current.has(track.id)
      ) {
        retryDecodeRef.current.add(track.id);
        void loadRef.current?.(track, true);
        return;
      }
      setError("音频无法解码，或文件已不可访问");
    };

    audio.addEventListener("timeupdate", handleTime);
    audio.addEventListener("durationchange", handleDuration);
    audio.addEventListener("loadedmetadata", handleDuration);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("timeupdate", handleTime);
      audio.removeEventListener("durationchange", handleDuration);
      audio.removeEventListener("loadedmetadata", handleDuration);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, []);

  // ------------------------------------------------------------ 记录上次播放

  useEffect(() => {
    if (!ready || !current) return;
    if (settings.lastTrackId === current.id) return;
    updateSettings({ lastTrackId: current.id });
  }, [current, ready, settings.lastTrackId, updateSettings]);

  // ------------------------------------------------------------ 系统媒体控制

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }
    const session = navigator.mediaSession;
    if (!current) {
      session.metadata = null;
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    const apply = (artwork?: MediaImage[]) => {
      session.metadata = new MediaMetadata({
        title: current.title,
        artist: current.artist,
        album: current.album,
        artwork,
      });
    };

    apply();
    if (current.coverId) {
      void loadCover(current.coverId)
        .then((blob) => {
          if (cancelled || !blob) return;
          objectUrl = URL.createObjectURL(blob);
          apply([{ src: objectUrl, sizes: "512x512", type: blob.type }]);
        })
        .catch(() => {
          // 封面不可用时忽略，系统面板仍会显示文字信息。
        });
    }

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [current]);

  const duration = mediaDuration || current?.duration || 0;

  const value = useMemo<PlayerContextValue>(
    () => ({
      current,
      queue,
      queueIndex,
      isPlaying,
      isLoading,
      currentTime,
      duration,
      volume,
      muted,
      shuffle,
      repeat,
      error,
      playTrack,
      playQueue,
      toggle,
      next,
      previous,
      seek,
      setVolume,
      toggleMute,
      toggleShuffle,
      cycleRepeat,
      addToQueue,
      playNextInQueue,
      removeFromQueue,
      clearQueue,
      dismissError,
    }),
    [
      current,
      queue,
      queueIndex,
      isPlaying,
      isLoading,
      currentTime,
      duration,
      volume,
      muted,
      shuffle,
      repeat,
      error,
      playTrack,
      playQueue,
      toggle,
      next,
      previous,
      seek,
      setVolume,
      toggleMute,
      toggleShuffle,
      cycleRepeat,
      addToQueue,
      playNextInQueue,
      removeFromQueue,
      clearQueue,
      dismissError,
    ],
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      {/* 播放内核常驻，保证切换视图时不中断播放。 */}
      <audio ref={audioRef} preload="metadata" />
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextValue {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("usePlayer 必须在 PlayerProvider 内部使用");
  }
  return context;
}