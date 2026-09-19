"use client";

import { ListMusic, Trash, X } from "lucide-react";
import { CoverArt } from "@/components/cover-art";
import { formatDuration } from "@/lib/format";
import { usePlayer } from "@/lib/player-provider";

interface QueuePanelProps {
  open: boolean;
  onClose: () => void;
}

export function QueuePanel({ open, onClose }: QueuePanelProps) {
  const player = usePlayer();

  if (!open) return null;

  const upcoming = player.queue.slice(player.queueIndex + 1);

  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 z-30 flex w-full max-w-sm justify-end p-4">
      <div className="pointer-events-auto flex w-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white/85 shadow-2xl shadow-zinc-900/25 backdrop-blur-2xl">
        <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-zinc-800">播放队列</p>
            <p className="text-[11px] text-zinc-500">
              {player.queue.length} 首 · 待播 {upcoming.length} 首
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="清空队列"
              onClick={player.clearQueue}
              disabled={player.queue.length === 0}
              className="rounded p-1.5 text-zinc-500 transition hover:text-rose-600 disabled:opacity-40"
            >
              <Trash className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="关闭队列"
              onClick={onClose}
              className="rounded p-1.5 text-zinc-500 transition hover:text-zinc-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {player.queue.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center text-xs text-zinc-500">
              <ListMusic className="h-6 w-6 text-zinc-500" />
              队列是空的，从曲库选择曲目即可开始播放
            </div>
          ) : (
            player.queue.map((track, index) => {
              const isCurrent = index === player.queueIndex;
              return (
                <div
                  key={`${track.id}-${index}`}
                  className={`group flex items-center gap-2.5 rounded-lg px-2 py-1.5 ${
                    isCurrent ? "bg-blue-500/10" : "hover:bg-zinc-950/5"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => player.playQueue(player.queue, index)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    <CoverArt
                      coverId={track.coverId}
                      label={track.album}
                      className="h-9 w-9 shrink-0 rounded"
                      labelClassName="text-[10px]"
                    />
                    <span className="min-w-0">
                      <span
                        className={`block truncate text-xs ${
                          isCurrent ? "text-blue-700" : "text-zinc-600"
                        }`}
                      >
                        {track.title}
                      </span>
                      <span className="block truncate text-[11px] text-zinc-500">
                        {track.artist}
                      </span>
                    </span>
                  </button>
                  <span className="shrink-0 text-[11px] tabular-nums text-zinc-500">
                    {formatDuration(track.duration)}
                  </span>
                  <button
                    type="button"
                    aria-label="从队列移除"
                    onClick={() => player.removeFromQueue(index)}
                    className="shrink-0 rounded p-1 text-zinc-500 opacity-0 transition hover:text-rose-600 group-hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
