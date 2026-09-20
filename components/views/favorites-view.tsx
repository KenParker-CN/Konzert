"use client";

import {IconClock, IconHeart, IconPlayerPlay, IconArrowsShuffle} from "@tabler/icons-react";
import {EmptyState} from "@/components/empty-state";
import {TrackList} from "@/components/track-list";
import {useLibrary} from "@/lib/library-provider";
import {usePlayer} from "@/lib/player-provider";

export function FavoritesView() {
    const {
        tracks,
        favorites,
        importFolder,
        scanning,
        storageMode,
        removeTracks,
    } = useLibrary();
    const player = usePlayer();

    const favoriteTracks = tracks.filter((track) => favorites.has(track.id));

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
                收藏保存在本机，删除曲库记录时也会一并移除
            </p>

            <TrackList
                tracks={favoriteTracks}
                showIndex={false}
                onRemove={(track) => void removeTracks([track.id])}
                emptyMessage="还没有收藏的曲目，在列表里点❤️即可收藏"
            />
        </div>
    );
}
