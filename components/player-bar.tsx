"use client";

import {
  Heart,
  ListMusic,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { CoverArt } from "@/components/cover-art";
import { formatDuration } from "@/lib/format";
import { useLibrary } from "@/lib/library-provider";
import { usePlayer } from "@/lib/player-provider";

interface PlayerBarProps {
  queueOpen: boolean;
  onToggleQueue: () => void;
}

export function PlayerBar({ queueOpen, onToggleQueue }: PlayerBarProps) {
  const player = usePlayer();
  const { favorites, toggleFavorite } = useLibrary();

  const track = player.current;
  const isFavorite = track ? favorites.has(track.id) : false;
  const progressMax = player.duration > 0 ? player.duration : 1;

  return (
    <div className="border-t border-zinc-200 bg-white/70 px-4 py-3 backdrop-blur-xl">
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 items-center gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
        {/* 当前曲目 */}
        <div className="flex min-w-0 items-center gap-3">
          {track ? (
            <>
              <CoverArt
                coverId={track.coverId}
                label={track.album}
                className="h-12 w-12 shrink-0 rounded-md shadow-lg shadow-zinc-900/15"
                labelClassName="text-sm"
              />
              <div className="min-w-0">
                <p className="truncate text-sm text-zinc-800" title={track.title}>
                  {track.title}
                </p>
                <p
                  className="truncate text-xs text-zinc-500"
                  title={`${track.artist} · ${track.album}`}
                >
                  {track.artist} · {track.album}
                </p>
              </div>
              <button
                type="button"
                aria-label={isFavorite ? "取消收藏" : "收藏"}
                onClick={() => toggleFavorite(track.id)}
                className={`ml-1 shrink-0 rounded p-1.5 transition ${
                  isFavorite
                    ? "text-rose-500"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                <Heart
                  className="h-4 w-4"
                  fill={isFavorite ? "currentColor" : "none"}
                />
              </button>
            </>
          ) : (
            <p className="text-sm text-zinc-500">
              还没有播放中的曲目，从曲库选一首开始吧
            </p>
          )}
        </div>

        {/* 播放控制 */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="随机播放"
              aria-pressed={player.shuffle}
              onClick={player.toggleShuffle}
              className={`rounded-full p-2 transition ${
                player.shuffle
                  ? "text-violet-600"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              <Shuffle className="h-4 w-4" />
            </button>

            <button
              type="button"
              aria-label="上一首"
              onClick={player.previous}
              disabled={!track}
              className="rounded-full p-2 text-zinc-600 transition hover:text-zinc-900"
            >
              <SkipBack className="h-5 w-5 fill-current" />
            </button>

            <button
              type="button"
              aria-label={player.isPlaying ? "暂停" : "播放"}
              onClick={player.toggle}
              disabled={!track}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 shadow-lg shadow-zinc-900/15 transition hover:scale-105 disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:scale-100"
            >
              {player.isPlaying ? (
                <Pause className="h-5 w-5 fill-current" />
              ) : (
                <Play className="ml-0.5 h-5 w-5 fill-current" />
              )}
            </button>

            <button
              type="button"
              aria-label="下一首"
              onClick={player.next}
              disabled={!track}
              className="rounded-full p-2 text-zinc-600 transition hover:text-zinc-900"
            >
              <SkipForward className="h-5 w-5 fill-current" />
            </button>

            <button
              type="button"
              aria-label={
                player.repeat === "one"
                  ? "单曲循环"
                  : player.repeat === "all"
                    ? "列表循环"
                    : "不循环"
              }
              onClick={player.cycleRepeat}
              className={`rounded-full p-2 transition ${
                player.repeat === "off"
                  ? "text-zinc-500 hover:text-zinc-700"
                  : "text-violet-600"
              }`}
            >
              {player.repeat === "one" ? (
                <Repeat1 className="h-4 w-4" />
              ) : (
                <Repeat className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="flex w-full items-center gap-2">
            <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-zinc-400">
              {formatDuration(player.currentTime)}
            </span>
            <input
              type="range"
              className="konzert-range h-4 w-full"
              min={0}
              max={progressMax}
              step={0.5}
              value={Math.min(player.currentTime, progressMax)}
              disabled={!track}
              aria-label="播放进度"
              onChange={(event) => player.seek(Number(event.target.value))}
            />
            <span className="w-10 shrink-0 text-[11px] tabular-nums text-zinc-400">
              {formatDuration(player.duration)}
            </span>
          </div>
        </div>

        {/* 队列与音量 */}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            aria-label="播放队列"
            aria-pressed={queueOpen}
            onClick={onToggleQueue}
            className={`rounded-full p-2 transition ${
              queueOpen
                ? "bg-zinc-950/5 text-zinc-800"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            <ListMusic className="h-4 w-4" />
          </button>

          <button
            type="button"
            aria-label={player.muted ? "取消静音" : "静音"}
            onClick={player.toggleMute}
            className="rounded-full p-2 text-zinc-500 transition hover:text-zinc-700"
          >
            {player.muted || player.volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>
          <input
            type="range"
            className="konzert-range h-4 w-24"
            min={0}
            max={1}
            step={0.01}
            value={player.muted ? 0 : player.volume}
            aria-label="音量"
            onChange={(event) => player.setVolume(Number(event.target.value))}
          />
        </div>
      </div>
    </div>
  );
}