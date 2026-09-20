"use client";

import { Play } from "lucide-react";
import { CoverArt } from "@/components/cover-art";
import { formatReleaseDate, formatTotalDuration } from "@/lib/format";
import { useNav } from "@/lib/nav-provider";
import { usePlayer } from "@/lib/player-provider";
import type { AlbumSummary } from "@/lib/types";

interface AlbumGridProps {
  albums: AlbumSummary[];
  emptyMessage?: string;
}

export function AlbumGrid({
  albums,
  emptyMessage = "还没有专辑，先导入音乐文件夹吧",
}: AlbumGridProps) {
  const { openAlbum } = useNav();
  const player = usePlayer();

  if (albums.length === 0) {
    return (
      <p className="px-4 py-12 text-center text-sm text-zinc-500">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {albums.map((album) => (
        <div key={album.key} className="group flex flex-col gap-2.5">
          <div className="relative">
            <button
              type="button"
              onClick={() => openAlbum(album.key)}
              className="block w-full"
              aria-label={`查看专辑 ${album.album}`}
            >
              <CoverArt
                coverId={album.coverId}
                label={album.album}
                className="aspect-square w-full rounded-xl shadow-lg shadow-zinc-900/15 transition duration-200 group-hover:brightness-110"
                labelClassName="text-3xl"
              />
            </button>
            <button
              type="button"
              aria-label={`播放专辑 ${album.album}`}
              onClick={() => player.playQueue(album.tracks, 0)}
              className="absolute right-2.5 bottom-2.5 flex h-10 w-10 translate-y-1.5 items-center justify-center rounded-full bg-blue-500 text-white opacity-0 shadow-xl shadow-zinc-900/20 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 hover:bg-blue-600"
            >
              <Play className="ml-0.5 h-4.5 w-4.5 fill-current" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => openAlbum(album.key)}
            className="min-w-0 text-left"
          >
            <p className="truncate text-sm text-zinc-800" title={album.album}>
              {album.album}
            </p>
            <p className="truncate text-xs text-zinc-500" title={album.albumArtist}>
              {album.albumArtist}
            </p>
          </button>
        </div>
      ))}
    </div>
  );
}
