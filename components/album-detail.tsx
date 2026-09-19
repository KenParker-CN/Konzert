"use client";

import { useMemo } from "react";
import { ArrowLeft, Play, Shuffle } from "lucide-react";
import { CoverArt } from "@/components/cover-art";
import { TrackList } from "@/components/track-list";
import { groupWorks } from "@/lib/catalog";
import {
  formatBitrate,
  formatDuration,
  formatSampleRate,
  formatTotalDuration,
} from "@/lib/format";
import { useLibrary } from "@/lib/library-provider";
import { useNav } from "@/lib/nav-provider";
import { usePlayer } from "@/lib/player-provider";
import type { AlbumSummary } from "@/lib/types";

export function AlbumDetail({ album }: { album: AlbumSummary }) {
  const { closeAlbum } = useNav();
  const player = usePlayer();
  const { removeTracks } = useLibrary();

  // 古典作品分组：标题冒号前内容相同的乐章归到同一作品名下。
  const sections = useMemo(() => groupWorks(album.tracks), [album.tracks]);

  const first = album.tracks[0];
  const lossless = album.tracks.every((track) => track.lossless);
  const details = [
    album.tracks.length > 0 ? `${album.tracks.length} 首` : null,
    album.duration > 0 ? formatTotalDuration(album.duration) : null,
    first?.codec ? first.codec.toUpperCase() : null,
    first && first.bitrate ? formatBitrate(first.bitrate) : null,
    first && first.sampleRate ? formatSampleRate(first.sampleRate) : null,
    lossless ? "无损" : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={closeAlbum}
        className="flex w-fit items-center gap-2 text-xs text-zinc-500 transition hover:text-zinc-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        返回专辑列表
      </button>

      <header className="flex flex-col gap-5 sm:flex-row sm:items-end">
        <CoverArt
          coverId={album.coverId}
          label={album.album}
          className="h-40 w-40 shrink-0 rounded-2xl shadow-2xl shadow-zinc-900/20"
          labelClassName="text-5xl"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] tracking-widest text-zinc-500 uppercase">
            专辑
          </p>
          <h1 className="mt-1 truncate text-2xl font-semibold text-zinc-900 sm:text-3xl">
            {album.album}
          </h1>
          <p className="mt-1.5 truncate text-sm text-zinc-600">
            {album.albumArtist}
            {album.year ? ` · ${album.year}` : ""}
          </p>
          <p className="mt-1 truncate text-xs text-zinc-500">
            {details.join(" · ")}
          </p>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => player.playQueue(album.tracks, 0)}
              className="flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-zinc-50 transition hover:bg-zinc-700"
            >
              <Play className="h-4 w-4 fill-current" />
              播放
            </button>
            <button
              type="button"
              onClick={() => player.playQueue(album.tracks, 0, { shuffle: true })}
              className="flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-950/5"
            >
              <Shuffle className="h-4 w-4" />
              随机播放
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-3">
        {sections.map((section) =>
          section.work ? (
            <section
              key={section.key}
              className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
            >
              <header className="flex items-baseline justify-between gap-3 border-b border-zinc-200 bg-zinc-950/3 px-4 py-2.5">
                <h2
                  className="truncate text-sm font-medium text-zinc-800"
                  title={
                    section.composer
                      ? `${section.work} · ${section.composer}`
                      : (section.work ?? "")
                  }
                >
                  {section.work}
                  {section.composer ? (
                    <span className="font-normal text-zinc-500">
                      {" "}
                      by {section.composer}
                    </span>
                  ) : null}
                </h2>
                <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                  {section.tracks.length} 乐章 · {formatDuration(section.duration)}
                </span>
              </header>
              <div className="p-1.5">
                <TrackList
                  tracks={section.tracks}
                  showIndex
                  queueTracks={album.tracks}
                  onRemove={(track) => void removeTracks([track.id])}
                />
              </div>
            </section>
          ) : (
            <TrackList
              key={section.key}
              tracks={section.tracks}
              showIndex
              queueTracks={album.tracks}
              onRemove={(track) => void removeTracks([track.id])}
              emptyMessage="这张专辑没有可播放的曲目"
            />
          ),
        )}
      </div>
    </div>
  );
}