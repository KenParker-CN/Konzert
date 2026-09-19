"use client";

import {
  Clock,
  FolderPlus,
  Heart,
  Library,
  LoaderCircle,
  Settings,
} from "lucide-react";
import { AppIcon } from "@/components/app-icon";
import { formatTotalDuration } from "@/lib/format";
import { useLibrary } from "@/lib/library-provider";
import { useNav, type ViewName } from "@/lib/nav-provider";

const NAV_ITEMS: { id: ViewName; label: string; icon: typeof Library }[] = [
  { id: "library", label: "音乐库", icon: Library },
  { id: "favorites", label: "我的收藏", icon: Heart },
  { id: "history", label: "播放历史", icon: Clock },
  { id: "settings", label: "设置", icon: Settings },
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

  const activeView = albumKey ? "library" : view;

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-zinc-950/5 backdrop-blur-xl">
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4 select-none">
        <AppIcon className="h-9 w-9 shrink-0 text-zinc-900" />
        <div>
          <p className="text-sm font-semibold tracking-wide text-zinc-800">
            Konzert
          </p>
          <p className="text-[11px] text-zinc-500">本地音乐播放器</p>
        </div>
      </div>

      <div className="px-4">
        <button
          type="button"
          onClick={() => void importFolder()}
          disabled={scanning}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-950/5 px-3 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-950/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {scanning ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <FolderPlus className="h-4 w-4" />
          )}
          {scanning ? "正在导入…" : "导入音乐文件夹"}
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
              onClick={() => {
                closeAlbum();
                setView(item.id);
              }}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-zinc-950/5 text-zinc-800"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-600"
              }`}
            >
              <Icon
                className={`h-4 w-4 ${active ? "text-violet-600" : ""}`}
                fill={item.id === "favorites" && active ? "currentColor" : "none"}
              />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto space-y-2 border-t border-zinc-200 px-5 py-4 text-[11px] text-zinc-500">
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
    </aside>
  );
}