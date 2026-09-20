"use client";

import {useMemo} from "react";
import {ArrowLeft, Play, Shuffle} from "lucide-react";
import {CoverArt} from "@/components/cover-art";
import {CatalogTitle} from "@/components/catalog-title";
import {TrackList} from "@/components/track-list";
import {formatBitDepth, formatDuration, formatReleaseDate, formatSampleRate, formatTotalDuration,} from "@/lib/format";
import {
    artistNamesOf,
    groupTracksByDisc,
    groupWorks,
    movementTitleOf,
    splitArtists,
} from "@/lib/catalog";
import {useLibrary} from "@/lib/library-provider";
import {useNav} from "@/lib/nav-provider";
import {usePlayer} from "@/lib/player-provider";
import type {AlbumSummary, Track} from "@/lib/types";

export function AlbumDetail({album}: { album: AlbumSummary }) {
    const {closeAlbum} = useNav();
    const player = usePlayer();
    const {removeTracks} = useLibrary();

    // 古典作品分组：标题冒号前内容相同的乐章归到同一作品名下。
    const discs = useMemo(() => groupTracksByDisc(album.tracks), [album.tracks]);
    const showDiscHeadings = discs.length > 1;
    const albumArtists = new Set(
        splitArtists(album.albumArtist).map((artist) => artist.toLowerCase()),
    );
    const titleOf = (track: Track) => movementTitleOf(track.title);
    const trackArtist = (track: Track) => {
        const artists = artistNamesOf(track);
        const normalizedArtists = artists.map((artist) => artist.toLowerCase());
        const isAlbumArtist =
            normalizedArtists.length === albumArtists.size &&
            normalizedArtists.every((artist) => albumArtists.has(artist));
        return isAlbumArtist ? null : artists.join("/");
    };

    const bitDepthTrack = album.tracks.find((track) => track.bitDepth != null);
    const sampleRateTrack = album.tracks.find(
        (track) => track.sampleRate != null,
    );
    const releaseDate = formatReleaseDate(album.releaseDate);
    const audioDetails = [
        bitDepthTrack?.bitDepth != null
            ? formatBitDepth(bitDepthTrack.bitDepth)
            : null,
        sampleRateTrack?.sampleRate != null
            ? formatSampleRate(sampleRateTrack.sampleRate)
            : null,
    ].filter((value): value is string => Boolean(value));

    return (
        <div className="flex flex-col gap-6">
            <button
                type="button"
                onClick={closeAlbum}
                className="flex w-fit items-center gap-2 text-xs text-zinc-500 transition hover:text-zinc-800"
            >
                <ArrowLeft className="h-3.5 w-3.5"/>
                返回专辑列表
            </button>

            <div className="grid items-stretch gap-6 lg:h-[calc(100dvh-11rem)] lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.6fr)]">
                <div className="flex h-full min-w-0 flex-col gap-4">
                    <CoverArt
                        coverId={album.coverId}
                        label={album.album}
                        className="aspect-square w-full max-w-sm rounded-2xl shadow-2xl shadow-zinc-900/20"
                        labelClassName="text-5xl"
                    />
                    <div className="min-w-0">
                        <p className="text-[11px] tracking-widest text-zinc-500 uppercase">
                            专辑
                        </p>
                        <h1 className="mt-1 truncate text-2xl font-semibold text-zinc-900 sm:text-3xl">
                            {album.album}
                        </h1>
                        <p className="mt-1.5 truncate text-sm text-zinc-600">
                            {album.albumArtist}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => player.playQueue(album.tracks, 0)}
                            className="flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-zinc-50 transition hover:bg-zinc-700"
                        >
                            <Play className="h-4 w-4 fill-current"/>
                            播放
                        </button>
                        <button
                            type="button"
                            onClick={() => player.playQueue(album.tracks, 0, {shuffle: true})}
                            className="flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-950/5"
                        >
                            <Shuffle className="h-4 w-4"/>
                            随机播放
                        </button>
                    </div>
                    <div className="flex flex-col gap-1 text-xs text-zinc-500">
                        {audioDetails.length > 0 ? (
                            <p>{audioDetails.join(" / ")}</p>
                        ) : null}
                        {releaseDate ? <p>{releaseDate}</p> : null}
                        <p>
                            {album.tracks.length} 首曲目 ·{" "}
                            {formatTotalDuration(album.duration)}
                        </p>
                    </div>
                    {album.copyright ? (
                        <p className="text-xs leading-relaxed text-zinc-500">
                            {album.copyright}
                        </p>
                    ) : null}
                </div>

                <div className="h-full min-h-0 min-w-0 overflow-y-auto rounded-2xl border border-zinc-200 bg-white/70 p-3">
                    <div className="flex flex-col gap-3">
                        {discs.map((disc) => (
                            <section key={disc.discNo} className="flex flex-col gap-2">
                                {showDiscHeadings ? (
                                    <h2 className="px-1 text-sm font-medium text-zinc-800">
                                        CD {disc.discNo}
                                    </h2>
                                ) : null}
                                {groupWorks(disc.tracks).map((section) =>
                                    section.work ? (
                                        <section
                                            key={`${disc.discNo}-${section.key}`}
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
                                                    <CatalogTitle
                                                        title={section.work}
                                                        composer={section.tracks[0]?.composer ?? ""}
                                                    />
                                                    {section.composer ? (
                                                        <span className="font-normal text-zinc-500">
                      {" "}
                                                            · {section.composer}
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
                                                    titleOf={titleOf}
                                                    trackArtist={trackArtist}
                                                    trackAlbum={() => null}
                                                    onRemove={(track) => void removeTracks([track.id])}
                                                />
                                            </div>
                                        </section>
                                    ) : (
                                        <TrackList
                                            key={`${disc.discNo}-${section.key}`}
                                            tracks={section.tracks}
                                            showIndex
                                            queueTracks={album.tracks}
                                            trackArtist={trackArtist}
                                            trackAlbum={() => null}
                                            onRemove={(track) => void removeTracks([track.id])}
                                            emptyMessage="这张专辑没有可播放的曲目"
                                        />
                                    ),
                                )}
                            </section>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
