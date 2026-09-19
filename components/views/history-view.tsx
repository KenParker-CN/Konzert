"use client";

import {Play} from "lucide-react";
import {EmptyState} from "@/components/empty-state";
import {TrackList} from "@/components/track-list";
import {useLibrary} from "@/lib/library-provider";
import {usePlayer} from "@/lib/player-provider";
import type {Track} from "@/lib/types";

export function HistoryView() {
    const {
        tracks,
        history,
        tracksById,
        clearHistory,
        importFolder,
        scanning,
        storageMode,
    } = useLibrary();
    const player = usePlayer();

    const played = history
        .map((entry) => {
            const track = tracksById.get(entry.trackId);
            return track ? {track, at: entry.at} : null;
        })
        .filter((item): item is { track: Track; at: number } => item !== null);

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
                    <h1 className="text-lg font-semibold text-zinc-900">播放历史</h1>
                    <p className="mt-1 text-xs text-zinc-500">
                        最近播放 {played.length} 条记录
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() =>
                            player.playQueue(
                                played.map((item) => item.track),
                                0,
                            )
                        }
                        disabled={played.length === 0}
                        className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-zinc-50 transition hover:bg-zinc-700 disabled:opacity-40"
                    >
                        <Play className="h-3.5 w-3.5 fill-current"/>
                        继续播放
                    </button>
                    <button
                        type="button"
                        onClick={clearHistory}
                        disabled={played.length === 0}
                        className="rounded-full border border-zinc-300 px-3.5 py-1.5 text-xs text-zinc-500 transition hover:bg-zinc-950/5 disabled:opacity-40"
                    >
                        清空历史
                    </button>
                </div>
            </header>

            {played.length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-zinc-500">
                    还没有播放记录
                </p>
            ) : (
                <div className="flex flex-col gap-1.5">
                    {played.map((item) => (
                        <div
                            key={`${item.track.id}-${item.at}`}
                            className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
                        >

                            <TrackList tracks={[item.track]} showNumber={false}/>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}