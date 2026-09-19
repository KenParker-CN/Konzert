"use client";

import { Heart, ListPlus, Pause, Play, Plus, Trash } from "lucide-react";
import { CoverArt } from "@/components/cover-art";
import { formatDuration } from "@/lib/format";
import { useLibrary } from "@/lib/library-provider";
import { usePlayer } from "@/lib/player-provider";
import type { Track } from "@/lib/types";

interface TrackListProps {
  tracks: Track[];
  /** 序号是否优先使用标签中的音轨号（否则显示列表位置）。 */
  showIndex?: boolean;
  /** 是否显示序号数字；隐藏后仍保留悬停播放按钮的占位。 */
  showNumber?: boolean;
  /** 点击播放时的队列；缺省用 tracks 本身（分页列表可传完整列表）。 */
  queueTracks?: Track[];
  /** 传入后显示「从曲库移除」按钮。 */
  onRemove?: (track: Track) => void;
  emptyMessage?: string;
}

export function TrackList({
  tracks,
  showIndex = true,
  showNumber = true,
  queueTracks,
  onRemove,
  emptyMessage = "这里还没有曲目",
}: TrackListProps) {
  const player = usePlayer();
  const { favorites, toggleFavorite, settings } = useLibrary();
  const queue = queueTracks ?? tracks;

  if (tracks.length === 0) {
    return (
      <p className="px-4 py-12 text-center text-sm text-zinc-500">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="flex flex-col">
      {tracks.map((track, index) => {
        const isCurrent = player.current?.id === track.id;
        const isPlayingThis = isCurrent && player.isPlaying;
        const isFavorite = favorites.has(track.id);
        const wasLastPlayed = settings.lastTrackId === track.id && !isCurrent;

        return (
          <div
            key={track.id}
            role="button"
            tabIndex={0}
            onClick={() => player.playTrack(track, queue)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                player.playTrack(track, queue);
              }
            }}
            className={`group grid cursor-default grid-cols-[2.25rem_1fr_auto] items-center gap-3 rounded-lg px-3 py-2 transition-colors sm:grid-cols-[2.25rem_minmax(0,2.2fr)_minmax(0,1.4fr)_4.5rem_auto] ${
              isCurrent
                ? "bg-blue-500/10 ring-1 ring-blue-500/25"
                : "hover:bg-zinc-950/5"
            }`}
          >
            {/* 序号 / 播放状态 / 播放按钮 */}
            <div className="flex h-7 w-7 items-center justify-center">
              {isPlayingThis ? (
                <>
                  <span className="flex h-4 items-end gap-0.5 group-hover:hidden">
                    <span className="konzert-eq-bar h-4 w-0.5 rounded-full bg-blue-500" />
                    <span className="konzert-eq-bar h-4 w-0.5 rounded-full bg-blue-500" />
                    <span className="konzert-eq-bar h-4 w-0.5 rounded-full bg-blue-500" />
                  </span>
                  <button
                    type="button"
                    aria-label="暂停"
                    onClick={(event) => {
                      event.stopPropagation();
                      player.toggle();
                    }}
                    className="hidden text-zinc-700 group-hover:block"
                  >
                    <Pause className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  {showNumber ? (
                    <span
                      className={`text-xs tabular-nums group-hover:hidden ${
                        isCurrent ? "text-blue-600" : "text-zinc-400"
                      }`}
                    >
                      {showIndex ? (track.trackNo ?? index + 1) : index + 1}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    aria-label={`播放 ${track.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      player.playTrack(track, tracks);
                    }}
                    className="hidden text-zinc-700 group-hover:block"
                  >
                    <Play className="h-4 w-4 fill-current" />
                  </button>
                </>
              )}
            </div>

            {/* 标题 + 艺术家 */}
            <div className="flex min-w-0 items-center gap-3">
              <CoverArt
                coverId={track.coverId}
                label={track.album}
                className="h-9 w-9 shrink-0 rounded"
                labelClassName="text-xs"
              />
              <div className="min-w-0">
                <p
                  className={`truncate text-sm ${
                    isCurrent ? "text-blue-700" : "text-zinc-800"
                  }`}
                  title={track.title}
                >
                  {track.title}
                </p>
                <p
                  className="truncate text-xs text-zinc-600"
                  title={track.artist}
                >
                  {wasLastPlayed ? `${track.artist} · 上次播放` : track.artist}
                </p>
              </div>
            </div>

            {/* 专辑 */}
            <p
              className="hidden truncate text-xs text-zinc-600 sm:block"
              title={track.album}
            >
              {track.album}
            </p>

            {/* 时长 */}
            <span className="hidden text-right text-xs tabular-nums text-zinc-400 sm:block">
              {formatDuration(track.duration)}
            </span>

            {/* 操作区 */}
            <div className="flex items-center justify-end gap-0.5">
              <button
                type="button"
                aria-label={isFavorite ? "取消收藏" : "收藏"}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleFavorite(track.id);
                }}
                className={`rounded p-1.5 transition ${
                  isFavorite
                    ? "text-rose-500"
                    : "text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-zinc-700"
                }`}
              >
                <Heart
                  className="h-4 w-4"
                  fill={isFavorite ? "currentColor" : "none"}
                />
              </button>
              <button
                type="button"
                aria-label="下一首播放"
                onClick={(event) => {
                  event.stopPropagation();
                  player.playNextInQueue(track);
                }}
                className="rounded p-1.5 text-zinc-500 opacity-0 transition hover:text-zinc-700 group-hover:opacity-100"
              >
                <ListPlus className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="加入队列"
                onClick={(event) => {
                  event.stopPropagation();
                  player.addToQueue(track);
                }}
                className="rounded p-1.5 text-zinc-500 opacity-0 transition hover:text-zinc-700 group-hover:opacity-100"
              >
                <Plus className="h-4 w-4" />
              </button>
              {onRemove ? (
                <button
                  type="button"
                  aria-label="从曲库移除"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemove(track);
                  }}
                  className="rounded p-1.5 text-zinc-500 opacity-0 transition hover:text-rose-600 group-hover:opacity-100"
                >
                  <Trash className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}