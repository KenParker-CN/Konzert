"use client";

import { IconArrowLeft, IconPlayerPlay, IconArrowsShuffle } from "@tabler/icons-react";
import { AlbumGrid } from "@/components/album-grid";
import { TrackList } from "@/components/track-list";
import { artistNamesOf, groupAlbums } from "@/lib/catalog";
import { formatDuration } from "@/lib/format";
import { useLibrary } from "@/lib/library-provider";
import { useNav } from "@/lib/nav-provider";
import { usePlayer } from "@/lib/player-provider";
import type { Track } from "@/lib/types";

export function ArtistDetail({ artistName }: { artistName: string }) {
  const { tracks, removeTracks } = useLibrary();
  const { closeArtist } = useNav();
  const player = usePlayer();
  const artistTracks = tracks.filter((track) =>
    artistNamesOf(track).some(
      (artist) => artist.toLocaleLowerCase() === artistName.toLocaleLowerCase(),
    ),
  );
  const albums = groupAlbums(artistTracks);
  const duration = artistTracks.reduce((total, track) => total + track.duration, 0);

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={closeArtist}
        className="flex w-fit items-center gap-2 text-xs text-zinc-500 transition hover:text-zinc-800"
      >
        <IconArrowLeft className="h-3.5 w-3.5" />
        返回曲库
      </button>

      <header className="flex flex-col gap-3">
        <div>
          <p className="text-[11px] tracking-widest text-zinc-500 uppercase">
            艺术家
          </p>
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

      <AlbumGrid albums={albums} emptyMessage="该艺术家没有专辑" />

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-medium text-zinc-800">曲目</h2>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <TrackList
            tracks={artistTracks}
            showIndex
            queueTracks={artistTracks}
            onRemove={(track: Track) => void removeTracks([track.id])}
          />
        </div>
      </section>
    </div>
  );
}
