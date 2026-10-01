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
  type ReactNode,
} from "react";
import type { CatalogReference } from "./catalog";

export type ViewName = "library" | "favorites" | "history" | "settings";

interface NavContextValue {
  pathname: string;
  view: ViewName;
  albumKey: string | null;
  artistName: string | null;
  work: CatalogReference & { composer: string } | null;
  setView: (view: ViewName) => void;
  openAlbum: (albumKey: string) => void;
  openArtist: (artistName: string) => void;
  closeArtist: () => void;
  openWork: (work: CatalogReference & { composer: string }) => void;
  closeWork: () => void;
  closeAlbum: () => void;
  backLabel: string;
}

const NavContext = createContext<NavContextValue | null>(null);

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

function backLabelForPath(pathname: string): string {
  const resource = pathname.split("/").filter(Boolean)[0];
  if (resource === "favorites") return "返回我的收藏";
  if (resource === "history") return "返回播放历史";
  if (resource === "albums") return "返回专辑详情";
  if (resource === "artists") return "返回艺术家详情";
  if (resource === "tracks") return "返回作品详情";
  return "返回曲库";
}

function routeState(pathname: string): {
  view: ViewName;
  albumKey: string | null;
  artistName: string | null;
  work: CatalogReference & { composer: string } | null;
} {
  const segments = pathname.split("/").filter(Boolean);
  const resource = segments[0];
  const id = segments.length === 2 ? decodeSegment(segments[1]) : null;

  if (resource === "settings") {
    return {view: "settings", albumKey: null, artistName: null, work: null};
  }
  if (resource === "favorites") {
    return {view: "favorites", albumKey: null, artistName: null, work: null};
  }
  if (resource === "history") {
    return {view: "history", albumKey: null, artistName: null, work: null};
  }
  if (resource === "albums" && id) {
    return {view: "library", albumKey: id, artistName: null, work: null};
  }
  if (resource === "artists" && id) {
    return {view: "library", albumKey: null, artistName: id, work: null};
  }
  if (resource === "tracks" && id) {
    const [system, number, composer] = id.split("|");
    if (system && number && composer) {
      return {
        view: "library",
        albumKey: null,
        artistName: null,
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

  return {view: "library", albumKey: null, artistName: null, work: null};
}

export function NavProvider({children}: { children: ReactNode }) {
  const [pathname, setPathname] = useState(() =>
    typeof window === "undefined"
      ? "/library"
      : normalizePathname(window.location.pathname),
  );
  const [detailOrigins, setDetailOrigins] = useState<Map<string, string>>(
    () => new Map(),
  );
  const state = useMemo(() => routeState(pathname), [pathname]);
  const backLabel = useMemo(
    () => backLabelForPath(detailOrigins.get(pathname) ?? "/library"),
    [detailOrigins, pathname],
  );

  useEffect(() => {
    const initialPath = window.location.pathname || "/library";
    if (initialPath === "/") {
      window.history.replaceState(null, "", "/library/");
    }

    const handlePopState = () => {
      setPathname(normalizePathname(window.location.pathname));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const push = useCallback((path: string) => {
    window.history.pushState(null, "", `${path}/`);
    setPathname(path);
  }, []);

  const setView = useCallback((view: ViewName) => {
    const path = view === "library" ? "/library" : `/${view}`;
    push(path);
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

  const openWork = useCallback((work: CatalogReference & { composer: string }) => {
    const resourceId = [work.system, work.number, work.composer].join("|");
    const path = `/tracks/${encodeURIComponent(resourceId)}`;
    setDetailOrigins((current) => new Map(current).set(path, pathname));
    push(path);
  }, [pathname, push]);

  const closeDetail = useCallback(() => {
    const target = detailOrigins.get(pathname) ?? "/library";
    window.history.replaceState(null, "", `${target}/`);
    setPathname(target);
  }, [detailOrigins, pathname]);

  const value = useMemo(
    () => ({
      ...state,
      pathname,
      setView,
      openAlbum,
      openArtist,
      closeArtist: closeDetail,
      openWork,
      closeAlbum: closeDetail,
      closeWork: closeDetail,
      backLabel,
    }),
    [state, pathname, setView, openAlbum, openArtist, openWork, closeDetail, backLabel],
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): NavContextValue {
  const context = useContext(NavContext);
  if (!context) throw new Error("useNav 必须在 NavProvider 内部使用");
  return context;
}
