"use client";

import {
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconFolderPlus,
  IconHeart,
  IconLibrary,
  IconLoader2,
  IconSettings,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { AppIcon } from "@/components/app-icon";
import { formatTotalDuration } from "@/lib/format";
import { useLibrary } from "@/lib/library-provider";
import { useNav, type ViewName } from "@/lib/nav-provider";

const NAV_ITEMS: { id: ViewName; label: string; icon: typeof IconLibrary }[] = [
  { id: "library", label: "音乐库", icon: IconLibrary },
  { id: "favorites", label: "我的收藏", icon: IconHeart },
  { id: "history", label: "播放历史", icon: IconClock },
  { id: "settings", label: "设置", icon: IconSettings },
];

const STORAGE_LABELS: Record<string, string> = {
  tauri: "桌面模式 · 直接读取本地文件",
  "fs-access": "浏览器模式 · 已授权文件夹",
  session: "兼容模式 · 本次会话有效",
};

export function Sidebar() {
  const { view, setView, albumKey, closeAlbum } = useNav();
  const {
    tracks,
    albums,
    history,
    importFolder,
    scanning,
    progress,
    storageMode,
    ready,
  } = useLibrary();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setCollapsed(
        window.localStorage.getItem("konzert-sidebar-collapsed") === "true",
      );
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("konzert-sidebar-collapsed", String(next));
      return next;
    });
  };

  const activeView = albumKey ? "library" : view;

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-zinc-200 bg-zinc-950/5 backdrop-blur-xl transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div className={`flex items-center px-3 pt-5 pb-4 select-none ${
        collapsed ? "justify-center" : "gap-2.5"
      }`}>
        <AppIcon className="h-9 w-9 shrink-0 text-zinc-900" />
        <div className={collapsed ? "hidden" : ""}>
          <p className="text-sm font-semibold tracking-wide text-zinc-800">
            Konzert
          </p>
        </div>
      </div>

      <div className={collapsed ? "px-2" : "px-4"}>
        <button
          type="button"
          onClick={() => void importFolder()}
          title="导入音乐文件夹"
          disabled={scanning}
          className={`flex w-full items-center justify-center rounded-xl bg-zinc-950/5 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-950/10 disabled:cursor-not-allowed disabled:opacity-60 ${
            collapsed ? "" : "gap-2 px-3"
          }`}
        >
          {scanning ? (
            <IconLoader2 className="h-4 w-4 animate-spin" />
          ) : (
            <IconFolderPlus className="h-4 w-4" />
          )}
          <span className={collapsed ? "hidden" : ""}>
            {scanning ? "正在导入…" : "导入音乐文件夹"}
          </span>
        </button>
      </div>

      <nav className="mt-5 flex flex-col gap-1 px-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              title={item.label}
              onClick={() => {
                closeAlbum();
                setView(item.id);
              }}
              className={`flex items-center rounded-lg py-2 text-sm transition ${
                collapsed ? "justify-center px-0" : "gap-3 px-3"
              } ${
                active
                  ? "bg-zinc-950/5 text-zinc-800"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-600"
              }`}
            >
              <Icon
                className={`h-4 w-4 ${active ? "text-app-accent" : ""}`}
                fill={item.id === "favorites" && active ? "currentColor" : "none"}
              />
              <span className={collapsed ? "hidden" : ""}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-zinc-200 px-3 py-3 text-[11px] text-zinc-500">
        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? "展开导航" : "收起导航"}
          className="mb-2 flex w-full items-center justify-center rounded-lg py-2 text-zinc-500 transition hover:bg-zinc-950/5 hover:text-zinc-800"
        >
          {collapsed ? (
            <IconChevronRight className="h-4 w-4" />
          ) : (
            <IconChevronLeft className="h-4 w-4" />
          )}
        </button>
        <div className={collapsed ? "hidden" : "space-y-2"}>
        <p>
          {ready
            ? `${tracks.length} 首 · ${albums.length} 张专辑`
            : "正在读取本地曲库…"}
        </p>
        {tracks.length > 0 ? (
          <p>
            {history.length > 0
              ? `播放历史 ${history.length} 条 · `
              : ""}
            总时长 {formatTotalDuration(
              tracks.reduce((total, track) => total + (track.duration || 0), 0),
            )}
          </p>
        ) : null}
        <p title={progress?.label}>{STORAGE_LABELS[storageMode]}</p>
        </div>
      </div>
    </aside>
  );
}
