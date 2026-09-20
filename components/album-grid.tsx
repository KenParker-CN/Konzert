"use client";

import { IconHeart, IconPlaylistAdd, IconPlayerPlay, IconTrash } from "@tabler/icons-react";
import { CoverArt } from "@/components/cover-art";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { artistNamesOf } from "@/lib/catalog";
import { useLibrary } from "@/lib/library-provider";
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
  const { openAlbum, openArtist } = useNav();
  const player = usePlayer();
  const { favorites, toggleFavorite, removeTracks } = useLibrary();

  if (albums.length === 0) {
    return (
      <p className="px-4 py-12 text-center text-sm text-zinc-500">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {albums.map((album) => (
        <ContextMenu key={album.key}>
          <ContextMenuTrigger>
            <div className="group flex flex-col gap-2.5">
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
              className="absolute right-2.5 bottom-2.5 flex h-10 w-10 translate-y-1.5 items-center justify-center rounded-full bg-app-accent text-white opacity-0 shadow-xl shadow-zinc-900/20 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100"
            >
              <IconPlayerPlay className="ml-0.5 h-4.5 w-4.5 fill-current" />
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
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => player.playQueue(album.tracks, 0)}>
              <IconPlayerPlay />
              播放
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                const shouldFavorite = album.tracks.some(
                  (track) => !favorites.has(track.id),
                );
                for (const track of album.tracks) {
                  if (favorites.has(track.id) !== shouldFavorite) {
                    toggleFavorite(track.id);
                  }
                }
              }}
            >
              <IconHeart />
              {album.tracks.every((track) => favorites.has(track.id))
                ? "取消收藏"
                : "收藏"}
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                for (const track of album.tracks) player.addToQueue(track);
              }}
            >
              <IconPlaylistAdd />
              添加到播放列表
            </ContextMenuItem>
            <ContextMenuSub>
              <ContextMenuSubTrigger>前往艺术家</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {[...new Set(album.tracks.flatMap(artistNamesOf))].map(
                  (artist) => (
                    <ContextMenuItem
                      key={artist}
                      onClick={() => openArtist(artist)}
                    >
                      {artist}
                    </ContextMenuItem>
                  ),
                )}
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSeparator />
            <ContextMenuItem
              variant="destructive"
              onClick={() =>
                void removeTracks(album.tracks.map((track) => track.id))
              }
            >
              <IconTrash />
              从库中移除
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ))}
    </div>
  );
}
