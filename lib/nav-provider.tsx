"use client";

/**
 * 基于 Next.js App Router 的客户端导航适配层。
 *
 * 页面仍由同一个静态 Shell 渲染；资源 ID 来自运行时 IndexedDB，
 * 因此不需要也不尝试在构建期生成动态页面。
 */

import {
  createContext,
  useEffect,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { CatalogReference } from "./catalog";
import type { Track } from "./types";

export type ViewName =
  | "library"
  | "albums"
  | "artists"
  | "composers"
  | "songs"
  | "favorites"
  | "history"
  | "settings";

interface NavContextValue {
  pathname: string;
  view: ViewName;
  albumKey: string | null;
  artistName: string | null;
  composerName: string | null;
  recordingKey: string | null;
  work: CatalogReference & { composer: string } | null;
  setView: (view: ViewName) => void;
  openAlbum: (albumKey: string) => void;
  openArtist: (artistName: string) => void;
  closeArtist: () => void;
  openComposer: (composerName: string) => void;
  closeComposer: () => void;
  openRecording: (track: Track) => void;
  closeRecording: () => void;
  openWork: (work: CatalogReference & { composer: string }) => void;
  closeWork: () => void;
  closeAlbum: () => void;
  backLabel: string;
}

const NavContext = createContext<NavContextValue | null>(null);
const NAVIGATION_EVENT = "konzert:navigate";

function subscribeToPathname(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(NAVIGATION_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(NAVIGATION_EVENT, onChange);
  };
}

function getPathname() {
  return normalizePathname(window.location.pathname);
}

function getServerPathname() {
  return "/library";
}

function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

function normalizePathname(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "");
  return normalized || "/library";
}

function fallbackPathForDetail(pathname: string): string {
  const resource = pathname.split("/").filter(Boolean)[0];
  if (resource === "artists") return "/artists";
  if (resource === "composers") return "/composers";
  if (resource === "tracks" || resource === "recordings") return "/songs";
  return "/albums";
}

function backLabelForPath(pathname: string): string {
  const resource = pathname.split("/").filter(Boolean)[0];
  if (resource === "library") return "返回 Library";
  if (resource === "favorites") return "返回我的收藏";
  if (resource === "history") return "返回播放历史";
  if (resource === "albums") {
    return pathname.split("/").filter(Boolean).length > 1
      ? "返回专辑详情"
      : "返回专辑列表";
  }
  if (resource === "artists") {
    return pathname.split("/").filter(Boolean).length > 1
      ? "返回艺术家详情"
      : "返回艺术家列表";
  }
  if (resource === "composers") {
    return pathname.split("/").filter(Boolean).length > 1
      ? "返回作曲家详情"
      : "返回作曲家列表";
  }
  if (resource === "songs") return "返回歌曲列表";
  if (resource === "tracks") return "返回作品详情";
  return "返回专辑列表";
}

function routeState(pathname: string): {
  view: ViewName;
  albumKey: string | null;
  artistName: string | null;
  composerName: string | null;
  recordingKey: string | null;
  work: CatalogReference & { composer: string } | null;
} {
  const segments = pathname.split("/").filter(Boolean);
  const resource = segments[0];
  const id = segments.length === 2 ? decodeSegment(segments[1]) : null;

  if (resource === "library") {
    return {view: "library", albumKey: null, artistName: null, composerName: null, recordingKey: null, work: null};
  }
  if (resource === "settings") {
    return {view: "settings", albumKey: null, artistName: null, composerName: null, recordingKey: null, work: null};
  }
  if (resource === "favorites") {
    return {view: "favorites", albumKey: null, artistName: null, composerName: null, recordingKey: null, work: null};
  }
  if (resource === "history") {
    return {view: "history", albumKey: null, artistName: null, composerName: null, recordingKey: null, work: null};
  }
  if (resource === "albums") {
    return {view: "albums", albumKey: id, artistName: null, composerName: null, recordingKey: null, work: null};
  }
  if (resource === "artists") {
    return {view: "artists", albumKey: null, artistName: id, composerName: null, recordingKey: null, work: null};
  }
  if (resource === "composers") {
    return {view: "composers", albumKey: null, artistName: null, composerName: id, recordingKey: null, work: null};
  }
  if (resource === "songs") {
    return {view: "songs", albumKey: null, artistName: null, composerName: null, recordingKey: null, work: null};
  }
  if (resource === "recordings" && id) {
    return {view: "songs", albumKey: null, artistName: null, composerName: null, recordingKey: id, work: null};
  }
  if (resource === "tracks" && id) {
    const [system, number, composer] = id.split("|");
    if (system && number && composer) {
      return {
        view: "songs",
        albumKey: null,
        artistName: null,
        composerName: null,
        recordingKey: null,
        work: {
          system,
          number,
          display: `${system} ${number}`,
          index: 0,
          composer,
        },
      };
    }
  }

  return {view: "library", albumKey: null, artistName: null, composerName: null, recordingKey: null, work: null};
}

export function NavProvider({children}: { children: ReactNode }) {
  const pathname = useSyncExternalStore(
    subscribeToPathname,
    getPathname,
    getServerPathname,
  );
  const [detailOrigins, setDetailOrigins] = useState<Map<string, string>>(
    () => new Map(),
  );
  const state = useMemo(() => routeState(pathname), [pathname]);
  const backLabel = useMemo(
    () =>
      backLabelForPath(
        detailOrigins.get(pathname) ?? fallbackPathForDetail(pathname),
      ),
    [detailOrigins, pathname],
  );

  useEffect(() => {
    if (window.location.pathname === "/") {
      window.history.replaceState(null, "", "/library/");
      window.dispatchEvent(new Event(NAVIGATION_EVENT));
    }
  }, []);

  const push = useCallback((path: string) => {
    window.history.pushState(null, "", `${path}/`);
    window.dispatchEvent(new Event(NAVIGATION_EVENT));
  }, []);

  const setView = useCallback((view: ViewName) => {
    push(`/${view}`);
  }, [push]);

  const openAlbum = useCallback((albumKey: string) => {
    const path = `/albums/${encodeURIComponent(albumKey)}`;
    setDetailOrigins((current) => new Map(current).set(path, pathname));
    push(path);
  }, [pathname, push]);

  const openArtist = useCallback((artistName: string) => {
    const path = `/artists/${encodeURIComponent(artistName)}`;
    setDetailOrigins((current) => new Map(current).set(path, pathname));
    push(path);
  }, [pathname, push]);

  const openComposer = useCallback((composerName: string) => {
    const path = `/composers/${encodeURIComponent(composerName)}`;
    setDetailOrigins((current) => new Map(current).set(path, pathname));
    push(path);
  }, [pathname, push]);

  const openRecording = useCallback((track: Track) => {
    const isrc = track.isrc?.trim();
    const key = isrc ? `isrc:${isrc}` : `track:${track.id}`;
    const path = `/recordings/${encodeURIComponent(key)}`;
    setDetailOrigins((current) => new Map(current).set(path, pathname));
    push(path);
  }, [pathname, push]);

  const openWork = useCallback((work: CatalogReference & { composer: string }) => {
    const resourceId = [work.system, work.number, work.composer].join("|");
    const path = `/tracks/${encodeURIComponent(resourceId)}`;
    setDetailOrigins((current) => new Map(current).set(path, pathname));
    push(path);
  }, [pathname, push]);

  const closeDetail = useCallback(() => {
    const target = detailOrigins.get(pathname) ?? fallbackPathForDetail(pathname);
    window.history.replaceState(null, "", `${target}/`);
    window.dispatchEvent(new Event(NAVIGATION_EVENT));
  }, [detailOrigins, pathname]);

  const value = useMemo(
    () => ({
      ...state,
      pathname,
      setView,
      openAlbum,
      openArtist,
      closeArtist: closeDetail,
      openComposer,
      closeComposer: closeDetail,
      openRecording,
      closeRecording: closeDetail,
      openWork,
      closeAlbum: closeDetail,
      closeWork: closeDetail,
      backLabel,
    }),
    [state, pathname, setView, openAlbum, openArtist, openComposer, openRecording, openWork, closeDetail, backLabel],
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): NavContextValue {
  const context = useContext(NavContext);
  if (!context) throw new Error("useNav 必须在 NavProvider 内部使用");
  return context;
}
