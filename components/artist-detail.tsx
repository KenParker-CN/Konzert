"use client";

import { IconArrowLeft, IconHeart, IconPlayerPlay, IconArrowsShuffle } from "@tabler/icons-react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useState } from "react";
import { AlbumGrid } from "@/components/album-grid";
import { TrackList } from "@/components/track-list";
import { artistNamesOf, groupAlbums, splitArtists } from "@/lib/catalog";
import { formatDuration } from "@/lib/format";
import { useLibrary } from "@/lib/library-provider";
import { useNav } from "@/lib/nav-provider";
import { usePlayer } from "@/lib/player-provider";
import { artistFavoriteKey, type Track } from "@/lib/types";

export function ArtistDetail({ artistName }: { artistName: string }) {
  const { tracks, favorites, removeTracks, toggleFavorite } = useLibrary();
  const { closeArtist } = useNav();
  const player = usePlayer();
  const artistTracks = tracks.filter((track) =>
    artistNamesOf(track).some(
      (artist) => artist.toLocaleLowerCase() === artistName.toLocaleLowerCase(),
    ),
  );
  const artistKey = artistName.trim().toLocaleLowerCase();
  const isArtistFavorite = favorites.has(artistFavoriteKey(artistName));
  const albums = groupAlbums(
    artistTracks.filter((track) =>
      splitArtists(track.albumArtist).some(
        (artist) => artist.trim().toLocaleLowerCase() === artistKey,
      ),
    ),
  );
  const appearsOn = groupAlbums(
    artistTracks.filter(
      (track) =>
        !splitArtists(track.albumArtist).some(
          (artist) => artist.trim().toLocaleLowerCase() === artistKey,
        ),
    ),
  );
  const sortedTracks = [...artistTracks]
    .sort((a, b) => {
      if (b.playCount !== a.playCount) return b.playCount - a.playCount;
      if (b.releaseDate.sortValue !== a.releaseDate.sortValue) {
        return b.releaseDate.sortValue - a.releaseDate.sortValue;
      }
      return (
        a.album.localeCompare(b.album, "zh-Hans-CN", {numeric: true}) ||
        (a.discNo ?? 1) - (b.discNo ?? 1) ||
        (a.trackNo ?? Number.MAX_SAFE_INTEGER) -
          (b.trackNo ?? Number.MAX_SAFE_INTEGER) ||
        a.title.localeCompare(b.title, "zh-Hans-CN", {numeric: true})
      );
    });
  const TRACKS_PAGE_SIZE = 10;
  const [trackPage, setTrackPage] = useState(1);
  const trackPageCount = Math.max(
    1,
    Math.ceil(sortedTracks.length / TRACKS_PAGE_SIZE),
  );
  const safeTrackPage = Math.min(trackPage, trackPageCount);
  const featuredTracks = sortedTracks.slice(
    (safeTrackPage - 1) * TRACKS_PAGE_SIZE,
    safeTrackPage * TRACKS_PAGE_SIZE,
  );
  const duration = artistTracks.reduce((total, track) => total + track.duration, 0);

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={closeArtist}
        className="flex w-fit items-center gap-2 text-xs leading-4 text-zinc-500 transition hover:text-zinc-800"
      >
        <IconArrowLeft className="h-3.5 w-3.5" />
        返回曲库
      </button>

      <header className="flex flex-col gap-3">
        <div>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-900">
            {artistName}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {albums.length} 张专辑 · {artistTracks.length} 首曲目 ·{" "}
            {formatDuration(duration)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={isArtistFavorite ? "取消收藏艺术家" : "收藏艺术家"}
            aria-pressed={isArtistFavorite}
            onClick={() => toggleFavorite(artistFavoriteKey(artistName))}
            className={`rounded-full p-2 transition hover:bg-zinc-950/5 ${
              isArtistFavorite ? "text-rose-500" : "text-zinc-500"
            }`}
          >
            <IconHeart className="h-4 w-4" fill={isArtistFavorite ? "currentColor" : "none"} />
          </button>
          <button
            type="button"
            onClick={() => player.playQueue(artistTracks, 0)}
            className="flex items-center gap-2 rounded-full bg-app-accent px-5 py-2 text-sm font-medium text-white transition hover:brightness-90"
          >
            <IconPlayerPlay className="h-4 w-4 fill-current" />
            播放
          </button>
          <button
            type="button"
            onClick={() => player.playQueue(artistTracks, 0, { shuffle: true })}
            className="flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-950/5"
          >
            <IconArrowsShuffle className="h-4 w-4" />
            随机播放
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-6">
        <section className="flex min-w-0 flex-col gap-3">
          <h2 className="text-base font-medium text-zinc-800">精选曲目</h2>
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <TrackList
              tracks={featuredTracks}
              showIndex={false}
              showCoverArt
              queueTracks={artistTracks}
              onRemove={(track: Track) => void removeTracks([track.id])}
              emptyMessage="该艺术家没有曲目"
            />
            {trackPageCount > 1 ? (
              <div className="flex items-center justify-center gap-3 border-t border-zinc-200 px-3 py-2 text-xs text-zinc-500">
                <button
                  type="button"
                  onClick={() => setTrackPage((page) => page - 1)}
                  disabled={safeTrackPage <= 1}
                  className="flex items-center gap-1 rounded-full border border-zinc-300 px-3 py-1 transition hover:bg-zinc-950/5 disabled:opacity-40"
                >
                  <IconChevronLeft className="h-3.5 w-3.5" />
                  上一页
                </button>
                <span className="tabular-nums">
                  第 {safeTrackPage} / {trackPageCount} 页 · 共 {sortedTracks.length} 首
                </span>
                <button
                  type="button"
                  onClick={() => setTrackPage((page) => page + 1)}
                  disabled={safeTrackPage >= trackPageCount}
                  className="flex items-center gap-1 rounded-full border border-zinc-300 px-3 py-1 transition hover:bg-zinc-950/5 disabled:opacity-40"
                >
                  下一页
                  <IconChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
          </div>
        </section>

        <section className="flex min-w-0 flex-col gap-3">
          <h2 className="text-base font-medium text-zinc-800">Albums</h2>
          <AlbumGrid albums={albums} emptyMessage="该艺术家没有作为专辑艺术家的专辑" />
        </section>

        {appearsOn.length > 0 ? (
          <section className="flex min-w-0 flex-col gap-3">
            <h2 className="text-base font-medium text-zinc-800">Appears on</h2>
            <AlbumGrid albums={appearsOn} />
          </section>
        ) : null}
      </div>

      <footer className="rounded-2xl border border-zinc-200 bg-white/70 p-5">
        <p className="text-[11px] tracking-widest text-zinc-500 uppercase">
          WikiShortBio
        </p>
        <h2 className="mt-1 text-base font-medium text-zinc-800">
          {artistName}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600">
          {artistName} 在本地曲库中参与了 {artistTracks.length} 首曲目，
          收录于 {groupAlbums(artistTracks).length} 张专辑。
          这段简介基于当前设备上的音乐标签生成；如需 Wikipedia 的完整人物简介，
          可以在后续接入可选的在线资料源。
        </p>
      </footer>
    </div>
  );
}
