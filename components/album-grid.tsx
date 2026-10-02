"use client";

import { IconHeart, IconPlaylistAdd, IconPlayerPlay, IconTrash } from "@tabler/icons-react";
import { CoverArt } from "@/components/cover-art";
import { cn } from "@/lib/utils";
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
import { albumFavoriteKey, trackFavoriteKey } from "@/lib/types";

interface AlbumGridProps {
  albums: AlbumSummary[];
  emptyMessage?: string;
  layout?: "grid" | "column-carousel";
  carouselHeight?: number;
}

export function AlbumGrid({
  albums,
  emptyMessage = "还没有专辑，先导入音乐文件夹吧",
  layout = "grid",
  carouselHeight,
}: AlbumGridProps) {
  const { openAlbum, openArtist } = useNav();
  const player = usePlayer();
  const { favorites, toggleFavorite, removeTracks } = useLibrary();
  const carouselCoverSize =
    layout === "column-carousel" && carouselHeight
      ? Math.max(96, (carouselHeight - 32) / 2)
      : undefined;

  if (albums.length === 0) {
    return (
      <p
        className="px-4 py-12 text-center text-sm text-zinc-500"
        style={
          layout === "column-carousel" && carouselHeight
            ? { height: carouselHeight }
            : undefined
        }
      >
        {emptyMessage}
      </p>
    );
  }

  return (
    <div
      className={
        layout === "column-carousel"
          ? "box-border grid min-h-0 snap-x snap-mandatory grid-flow-col grid-rows-2 content-evenly items-start gap-x-4 gap-y-3 overflow-x-auto overflow-y-hidden pb-2"
          : "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
      }
      style={
        layout === "column-carousel"
          ? {
              height: carouselHeight || undefined,
              gridAutoColumns: carouselCoverSize
                ? `min(calc((100% - 1rem) / 1.5), ${carouselCoverSize}px)`
                : "calc((100% - 1rem) / 1.5)",
            }
          : undefined
      }
      aria-label={
        layout === "column-carousel"
          ? "Related albums carousel"
          : undefined
      }
      role={layout === "column-carousel" ? "region" : undefined}
      tabIndex={layout === "column-carousel" ? 0 : undefined}
    >
      {albums.map((album) => (
        <ContextMenu key={album.key}>
          <ContextMenuTrigger
            className={cn(
              layout === "column-carousel" && "w-full snap-start",
              layout === "grid" && "min-w-0",
            )}
          >
            <div
              className={cn(
                "group flex gap-3",
                layout !== "column-carousel" && "flex-col gap-2.5",
                layout === "column-carousel" && "flex-col gap-2",
              )}
            >
          <div
            className={cn(
              "relative",
              layout === "column-carousel" && "aspect-square w-full",
            )}
          >
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
                labelClassName={
                  layout === "column-carousel" ? "text-xl" : "text-3xl"
                }
              />
            </button>
            {layout === "column-carousel" ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-xl bg-linear-to-t from-black/85 via-black/55 to-transparent px-3 pt-10 pb-3 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <p className="truncate text-sm font-medium" title={album.album}>
                  {album.album}
                </p>
                <p
                  className="truncate text-xs text-white/80"
                  title={album.albumArtist}
                >
                  {album.albumArtist}
                </p>
              </div>
            ) : null}
            <button
              type="button"
              aria-label={`播放专辑 ${album.album}`}
              onClick={() => player.playQueue(album.tracks, 0)}
              className="absolute right-2.5 bottom-2.5 flex h-10 w-10 translate-y-1.5 items-center justify-center rounded-full bg-app-accent text-white opacity-0 shadow-xl shadow-zinc-900/20 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100"
            >
              <IconPlayerPlay className="ml-0.5 h-4.5 w-4.5 fill-current" />
            </button>
          </div>
          {layout === "grid" ? (
            <button
              type="button"
              onClick={() => openAlbum(album.key)}
              className="min-w-0 text-left"
            >
              <p className="truncate text-sm text-zinc-800" title={album.album}>
                {album.album}
              </p>
              <p
                className="truncate text-xs text-zinc-500"
                title={album.albumArtist}
              >
                {album.albumArtist}
              </p>
            </button>
          ) : null}
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
                  (track) => !favorites.has(trackFavoriteKey(track.id)),
                );
                for (const track of album.tracks) {
                  if (favorites.has(trackFavoriteKey(track.id)) !== shouldFavorite) {
                    toggleFavorite(trackFavoriteKey(track.id));
                  }
                }
              }}
            >
              <IconHeart />
              {album.tracks.every((track) => favorites.has(trackFavoriteKey(track.id)))
                ? "取消收藏曲目"
                : "收藏曲目"}
            </ContextMenuItem>
            <ContextMenuItem onClick={() => toggleFavorite(albumFavoriteKey(album.key))}>
              <IconHeart />
              {favorites.has(albumFavoriteKey(album.key)) ? "取消收藏专辑" : "收藏专辑"}
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
