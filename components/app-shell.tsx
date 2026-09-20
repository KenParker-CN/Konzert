"use client";

import { useState, type DragEvent } from "react";
import { IconAlertCircle, IconLoader2, IconUpload, IconX } from "@tabler/icons-react";
import { PlayerBar } from "@/components/player-bar";
import { QueuePanel } from "@/components/queue-panel";
import { Sidebar } from "@/components/sidebar";
import { TitleBar } from "@/components/title-bar";
import { FavoritesView } from "@/components/views/favorites-view";
import { HistoryView } from "@/components/views/history-view";
import { LibraryView } from "@/components/views/library-view";
import { SettingsView } from "@/components/views/settings-view";
import { useLibrary } from "@/lib/library-provider";
import { useNav } from "@/lib/nav-provider";
import { usePlayer } from "@/lib/player-provider";
import type { ScanPhase } from "@/lib/types";

const PHASE_LABELS: Record<ScanPhase, string> = {
  idle: "准备中",
  picking: "等待选择文件夹",
  walking: "正在遍历文件夹",
  parsing: "正在读取音频标签",
  saving: "正在写入本地曲库",
};

export function AppShell() {
  const { view } = useNav();
  const {
    ready,
    progress,
    cancelScan,
    error,
    dismissError,
    importFromDrop,
    scanning,
  } = useLibrary();
  const player = usePlayer();
  const [queueOpen, setQueueOpen] = useState(false);
  const [dragging, setDragging] = useState(false);

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    if (!dragging) setDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    if (scanning) return;
    void importFromDrop(event.dataTransfer);
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />

        <main
          className="relative flex min-w-0 flex-1 flex-col"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* 扫描进度 */}
          {progress ? (
            <div className="flex items-center gap-3 border-b border-zinc-200 bg-blue-500/10 px-6 py-2.5 text-xs text-blue-700">
              <IconLoader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              <span className="shrink-0 font-medium">
                {PHASE_LABELS[progress.phase]}
              </span>
              {progress.total > 0 ? (
                <span className="shrink-0 tabular-nums text-blue-700/80">
                  {progress.processed}/{progress.total}
                </span>
              ) : progress.processed > 0 ? (
                <span className="shrink-0 tabular-nums text-blue-700/80">
                  已发现 {progress.processed}
                </span>
              ) : null}
              <span
                className="min-w-0 flex-1 truncate text-blue-700/60"
                title={progress.label}
              >
                {progress.label}
              </span>
              <button
                type="button"
                onClick={cancelScan}
                className="shrink-0 rounded-full border border-zinc-300 px-2.5 py-1 text-[11px] text-blue-700 transition hover:bg-zinc-950/5"
              >
                取消
              </button>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            {!ready ? (
              <p className="flex items-center gap-2 text-xs text-zinc-500">
                <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                正在读取本地曲库…
              </p>
            ) : view === "library" ? (
              <LibraryView />
            ) : view === "favorites" ? (
              <FavoritesView />
            ) : view === "history" ? (
              <HistoryView />
            ) : (
              <SettingsView />
            )}
          </div>

          <QueuePanel open={queueOpen} onClose={() => setQueueOpen(false)} />

          {/* 拖放提示 */}
          {dragging ? (
            <div className="pointer-events-none absolute inset-3 z-40 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-blue-500/50 bg-white/70 backdrop-blur-sm">
              <IconUpload className="h-7 w-7 text-blue-600" />
              <p className="text-sm text-blue-700">
                松开即可导入音频文件或整个文件夹
              </p>
            </div>
          ) : null}
        </main>
      </div>

      <PlayerBar
        queueOpen={queueOpen}
        onToggleQueue={() => setQueueOpen((open) => !open)}
      />

      {/* 提示信息 */}
      {error ? (
        <div className="pointer-events-none fixed right-4 bottom-28 z-50 w-full max-w-sm">
          <div className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-3 text-xs text-rose-800 shadow-2xl shadow-zinc-900/20 backdrop-blur-xl">
            <IconAlertCircle className="mt-px h-4 w-4 shrink-0 text-rose-600" />
            <p className="min-w-0 flex-1 leading-relaxed">{error}</p>
            <button
              type="button"
              aria-label="关闭提示"
              onClick={dismissError}
              className="shrink-0 rounded p-0.5 text-rose-600/70 transition hover:text-rose-900"
            >
              <IconX className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      {player.error ? (
        <div className="pointer-events-none fixed right-4 bottom-28 z-50 w-full max-w-sm">
          <div className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-xs text-amber-800 shadow-2xl shadow-zinc-900/20 backdrop-blur-xl">
            <IconAlertCircle className="mt-px h-4 w-4 shrink-0 text-amber-700" />
            <p className="min-w-0 flex-1 leading-relaxed">{player.error}</p>
            <button
              type="button"
              aria-label="关闭提示"
              onClick={player.dismissError}
              className="shrink-0 rounded p-0.5 text-amber-600/70 transition hover:text-amber-900"
            >
              <IconX className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}