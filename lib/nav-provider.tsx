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

export type ViewName = "library" | "favorites" | "history" | "settings";

interface NavContextValue {
  view: ViewName;
  /** 非空时展示专辑详情。 */
  albumKey: string | null;
  setView: (view: ViewName) => void;
  openAlbum: (albumKey: string) => void;
  closeAlbum: () => void;
}

const NavContext = createContext<NavContextValue | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const [view, setViewState] = useState<ViewName>("library");
  const [albumKey, setAlbumKey] = useState<string | null>(null);

  const setView = useCallback((next: ViewName) => {
    setViewState(next);
    setAlbumKey(null);
  }, []);

  const openAlbum = useCallback((next: string) => setAlbumKey(next), []);
  const closeAlbum = useCallback(() => setAlbumKey(null), []);

  const value = useMemo(
    () => ({ view, albumKey, setView, openAlbum, closeAlbum }),
    [view, albumKey, setView, openAlbum, closeAlbum],
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): NavContextValue {
  const context = useContext(NavContext);
  if (!context) throw new Error("useNav 必须在 NavProvider 内部使用");
  return context;
}