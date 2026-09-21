"use client";

import {IconClock, IconHeart, IconPlayerPlay, IconArrowsShuffle} from "@tabler/icons-react";
import {EmptyState} from "@/components/empty-state";
import {TrackList} from "@/components/track-list";
import {AlbumGrid} from "@/components/album-grid";
import {useLibrary} from "@/lib/library-provider";
import {usePlayer} from "@/lib/player-provider";
import {artistNamesOf} from "@/lib/catalog";
import {artistFavoriteKey, trackFavoriteKey} from "@/lib/types";

export function FavoritesView() {
    const {
        tracks, albums,
        favorites,
        importFolder,
        scanning,
        storageMode,
        removeTracks,
    } = useLibrary();
    const player = usePlayer();

    const favoriteTracks = tracks.filter((track) => favorites.has(trackFavoriteKey(track.id)));
    const favoriteAlbums = albums.filter((album) => favorites.has(`album:${album.key}`));
    const favoriteArtists = [...new Set(
        tracks.flatMap(artistNamesOf).filter((artist) => favorites.has(artistFavoriteKey(artist))),
    )];

    if (tracks.length === 0) {
        return (
            <EmptyState
                onImport={() => void importFolder()}
                scanning={scanning}
                storageMode={storageMode}
            />
        );
    }

    return (
        <div className="flex flex-col gap-5">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
                        <IconHeart className="h-4.5 w-4.5 text-rose-500" fill="currentColor"/>
                        我的收藏
                    </h1>
                    <p className="mt-1 text-xs text-zinc-600">
                        {favoriteTracks.length} 首曲目
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => player.playQueue(favoriteTracks, 0)}
                        disabled={favoriteTracks.length === 0}
                        className="flex items-center gap-1.5 rounded-full bg-app-accent px-3.5 py-1.5 text-xs font-medium text-white transition hover:brightness-90 disabled:opacity-40"
                    >
                        <IconPlayerPlay className="h-3.5 w-3.5 fill-current"/>
                        播放全部
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            player.playQueue(favoriteTracks, 0, {shuffle: true})
                        }
                        disabled={favoriteTracks.length === 0}
                        className="flex items-center gap-1.5 rounded-full border border-zinc-300 px-3.5 py-1.5 text-xs text-zinc-700 transition hover:bg-zinc-950/5 disabled:opacity-40"
                    >
                        <IconArrowsShuffle className="h-3.5 w-3.5"/>
                        随机
                    </button>
                </div>
            </header>

            <p className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <IconClock className="h-3 w-3"/>
                收藏保存在本机，可分别收藏专辑、艺术家和曲目
            </p>

            {favoriteArtists.length > 0 ? (
                <section className="flex flex-col gap-2">
                    <h2 className="text-base font-medium text-zinc-800">艺术家</h2>
                    <div className="flex flex-wrap gap-2">
                        {favoriteArtists.map((artist) => (
                            <span key={artist} className="rounded-full bg-app-accent-soft px-3 py-1 text-sm text-zinc-700">
                                {artist}
                            </span>
                        ))}
                    </div>
                </section>
            ) : null}
            {favoriteAlbums.length > 0 ? (
                <section className="flex flex-col gap-2">
                    <h2 className="text-base font-medium text-zinc-800">专辑</h2>
                    <AlbumGrid albums={favoriteAlbums} />
                </section>
            ) : null}
            <section className="flex flex-col gap-2">
                <h2 className="text-base font-medium text-zinc-800">曲目</h2>
                <TrackList
                    tracks={favoriteTracks}
                    showIndex={false}
                    onRemove={(track) => void removeTracks([track.id])}
                    emptyMessage="还没有收藏的曲目，在列表里点❤️即可收藏"
                />
            </section>
        </div>
    );
}
