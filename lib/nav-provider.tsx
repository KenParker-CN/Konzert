"use client";

/**
 * 极简视图导航。
 *
 * 应用是静态导出（Tauri 内嵌 out/），因此不做路由跳转：
 * 所有视图都在同一个页面里切换，播放器不会因切换而中断。
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CatalogReference } from "./catalog";

export type ViewName = "library" | "favorites" | "history" | "settings";

interface NavContextValue {
  view: ViewName;
  /** 非空时展示专辑详情。 */
  albumKey: string | null;
  /** 需要在艺术家视图中展开的艺术家。 */
  artistName: string | null;
  work: CatalogReference & { composer: string } | null;
  setView: (view: ViewName) => void;
  openAlbum: (albumKey: string) => void;
  openArtist: (artistName: string) => void;
  closeArtist: () => void;
  openWork: (work: CatalogReference & { composer: string }) => void;
  closeWork: () => void;
  closeAlbum: () => void;
}

const NavContext = createContext<NavContextValue | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const [view, setViewState] = useState<ViewName>("library");
  const [albumKey, setAlbumKey] = useState<string | null>(null);
  const [artistName, setArtistName] = useState<string | null>(null);
  const [work, setWork] = useState<(CatalogReference & { composer: string }) | null>(
    null,
  );

  const setView = useCallback((next: ViewName) => {
    setViewState(next);
    setAlbumKey(null);
    setArtistName(null);
    setWork(null);
  }, []);

  const openAlbum = useCallback((next: string) => {
    setAlbumKey(next);
    setArtistName(null);
    setWork(null);
  }, []);
  const openArtist = useCallback((next: string) => {
    setViewState("library");
    setAlbumKey(null);
    setArtistName(next);
    setWork(null);
  }, []);
  const closeArtist = useCallback(() => setArtistName(null), []);
  const openWork = useCallback((next: CatalogReference & { composer: string }) => {
    setViewState("library");
    setAlbumKey(null);
    setArtistName(null);
    setWork(next);
  }, []);
  const closeAlbum = useCallback(() => setAlbumKey(null), []);
  const closeWork = useCallback(() => setWork(null), []);

  const value = useMemo(
    () => ({
      view,
      albumKey,
      artistName,
      work,
      setView,
      openAlbum,
      openArtist,
      closeArtist,
      openWork,
      closeAlbum,
      closeWork,
    }),
    [view, albumKey, artistName, work, setView, openAlbum, openArtist, closeArtist, openWork, closeAlbum, closeWork],
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): NavContextValue {
  const context = useContext(NavContext);
  if (!context) throw new Error("useNav 必须在 NavProvider 内部使用");
  return context;
}