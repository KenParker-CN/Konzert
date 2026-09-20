"use client";

import {useMemo, useState} from "react";
import {IconArrowDown, IconArrowUp, IconChevronLeft, IconChevronRight, IconPlayerPlay, IconSearch, IconArrowsShuffle, IconX,} from "@tabler/icons-react";
import {AlbumDetail} from "@/components/album-detail";
import {ArtistDetail} from "@/components/artist-detail";
import {WorkDetail} from "@/components/work-detail";
import {AlbumGrid} from "@/components/album-grid";
import {EmptyState} from "@/components/empty-state";
import {TrackList} from "@/components/track-list";
import {Avatar, AvatarFallback} from "@/components/ui/avatar";
import {
    ALBUM_SORT_DEFAULT_DIR,
    ALBUM_SORT_LABELS,
    type AlbumSort,
    ARTIST_SORT_DEFAULT_DIR,
    ARTIST_SORT_LABELS,
    type ArtistSort,
    type ArtistSummary,
    groupAlbums,
    groupArtists,
    searchTracks,
    sortAlbums,
    sortArtists,
    type SortDir,
    sortTracks,
    TRACK_SORT_DEFAULT_DIR,
    TRACK_SORT_LABELS,
    type TrackSort,
} from "@/lib/catalog";
import {formatDuration} from "@/lib/format";
import {useLibrary} from "@/lib/library-provider";
import {useNav} from "@/lib/nav-provider";
import {usePlayer} from "@/lib/player-provider";

type Tab = "albums" | "songs" | "artists";

const TABS: { id: Tab; label: string }[] = [
    {id: "albums", label: "专辑"},
    {id: "artists", label: "艺术家"},
    {id: "songs", label: "歌曲"},

];

/** 歌曲列表分页大小；曲库大时避免一次性渲染过长列表。 */
const SONGS_PAGE_SIZE = 20;

export function LibraryView() {
    const {tracks, albums, importFolder, scanning, storageMode, removeTracks} =
        useLibrary();
    const {albumKey, artistName, work} = useNav();
    const player = usePlayer();

    const [tab, setTab] = useState<Tab>("albums");
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);

    const [sort, setSort] = useState<TrackSort>("added");
    const [sortDir, setSortDir] = useState<SortDir>(TRACK_SORT_DEFAULT_DIR.added);
    const [albumSort, setAlbumSort] = useState<AlbumSort>("date");
    const [albumSortDir, setAlbumSortDir] = useState<SortDir>(
        ALBUM_SORT_DEFAULT_DIR.date,
    );
    const [artistSort, setArtistSort] = useState<ArtistSort>("name");
    const [artistSortDir, setArtistSortDir] = useState<SortDir>(
        ARTIST_SORT_DEFAULT_DIR.name,
    );
    const matched = useMemo(() => searchTracks(tracks, query), [tracks, query]);
    const visibleTracks = useMemo(
        () => sortTracks(matched, sort, sortDir),
        [matched, sort, sortDir],
    );
    const visibleAlbums = useMemo(
        () => sortAlbums(groupAlbums(matched), albumSort, albumSortDir),
        [matched, albumSort, albumSortDir],
    );
    const artistGroups = useMemo(
        () => sortArtists(groupArtists(matched), artistSort, artistSortDir),
        [matched, artistSort, artistSortDir],
    );

    const pageCount = Math.max(
        1,
        Math.ceil(visibleTracks.length / SONGS_PAGE_SIZE),
    );
    const safePage = Math.min(page, pageCount);
    const pagedTracks = useMemo(
        () =>
            visibleTracks.slice(
                (safePage - 1) * SONGS_PAGE_SIZE,
                safePage * SONGS_PAGE_SIZE,
            ),
        [visibleTracks, safePage],
    );

    const openAlbum = albumKey
        ? albums.find((album) => album.key === albumKey)
        : undefined;

    if (openAlbum) {
        return <AlbumDetail album={openAlbum}/>;
    }
    if (work) {
        return <WorkDetail work={work}/>;
    }
    if (artistName) {
        return <ArtistDetail artistName={artistName}/>;
    }

    if (tracks.length === 0) {
        return (
            <EmptyState
                onImport={() => void importFolder()}
                scanning={scanning}
                storageMode={storageMode}
            />
        );
    }

    const updateQuery = (value: string) => {
        setQuery(value);
        setPage(1);
    };

    return (
        <div className="flex flex-col gap-5">
            <header className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1 rounded-full bg-zinc-950/5 p-1">
                        {TABS.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setTab(item.id)}
                                className={`rounded-full px-3.5 py-1.5 text-xs transition ${
                                    tab === item.id
                                        ? "bg-zinc-900 text-zinc-50"
                                        : "text-zinc-500 hover:text-zinc-800"
                                }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <IconSearch
                                className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"/>
                            <input
                                value={query}
                                onChange={(event) => updateQuery(event.target.value)}
                                placeholder="搜索标题、艺术家、专辑…"
                                className="w-56 rounded-full border border-zinc-200 bg-zinc-950/5 py-1.5 pr-8 pl-8 text-xs text-zinc-700 focus:outline-none"
                            />
                            {query ? (
                                <button
                                    type="button"
                                    aria-label="清空搜索"
                                    onClick={() => updateQuery("")}
                                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-zinc-500 hover:text-zinc-700"
                                >
                                    <IconX className="h-3.5 w-3.5"/>
                                </button>
                            ) : null}
                        </div>

                        <button
                            type="button"
                            onClick={() => player.playQueue(visibleTracks, 0)}
                            disabled={visibleTracks.length === 0}
                            className="flex items-center gap-1.5 rounded-full bg-app-accent px-3.5 py-1.5 text-xs font-medium text-white transition hover:brightness-90 disabled:opacity-40"
                        >
                            <IconPlayerPlay className="h-3.5 w-3.5 fill-current"/>
                            播放全部
                        </button>
                        <button
                            type="button"
                            onClick={() => player.playQueue(visibleTracks, 0, {shuffle: true})}
                            disabled={visibleTracks.length === 0}
                            className="flex items-center gap-1.5 rounded-full border border-zinc-300 px-3.5 py-1.5 text-xs text-zinc-700 transition hover:bg-zinc-950/5 disabled:opacity-40"
                        >
                            <IconArrowsShuffle className="h-3.5 w-3.5"/>
                            随机
                        </button>
                    </div>
                </div>

                {/* 概览与排序 */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-zinc-500">
                    <span>{visibleTracks.length} 首曲目</span>
                    <span className="text-zinc-300">·</span>
                    <span>{visibleAlbums.length} 张专辑</span>
                    <span className="text-zinc-300">·</span>
                    <span>{artistGroups.length} 位艺术家</span>
                    {query ? (
                        <span className="text-blue-600">已按「{query}」筛选</span>
                    ) : null}
                    {tab === "songs" ? (
                        <SortControl
                            value={sort}
                            labels={TRACK_SORT_LABELS}
                            dir={sortDir}
                            onChange={(value) => {
                                setSort(value);
                                setSortDir(TRACK_SORT_DEFAULT_DIR[value]);
                                setPage(1);
                            }}
                            onToggleDir={() =>
                                setSortDir((dir) => (dir === "asc" ? "desc" : "asc"))
                            }
                        />
                    ) : null}
                    {tab === "albums" ? (
                        <SortControl
                            value={albumSort}
                            labels={ALBUM_SORT_LABELS}
                            dir={albumSortDir}
                            onChange={(value) => {
                                setAlbumSort(value);
                                setAlbumSortDir(ALBUM_SORT_DEFAULT_DIR[value]);
                            }}
                            onToggleDir={() =>
                                setAlbumSortDir((dir) => (dir === "asc" ? "desc" : "asc"))
                            }
                        />
                    ) : null}
                    {tab === "artists" ? (
                        <SortControl
                            value={artistSort}
                            labels={ARTIST_SORT_LABELS}
                            dir={artistSortDir}
                            onChange={(value) => {
                                setArtistSort(value);
                                setArtistSortDir(ARTIST_SORT_DEFAULT_DIR[value]);
                            }}
                            onToggleDir={() =>
                                setArtistSortDir((dir) => (dir === "asc" ? "desc" : "asc"))
                            }
                        />
                    ) : null}
                </div>
            </header>

            {tab === "songs" ? (
                visibleTracks.length === 0 ? (
                    <EmptyState
                        filtered
                        onImport={() => void importFolder()}
                        scanning={scanning}
                        storageMode={storageMode}
                    />
                ) : (
                    <div className="flex flex-col gap-3">
                        <TrackList
                            tracks={pagedTracks}
                            queueTracks={visibleTracks}
                            showIndex={false}
                            onRemove={(track) => void removeTracks([track.id])}
                        />
                        <SongsPagination
                            page={safePage}
                            pageCount={pageCount}
                            total={visibleTracks.length}
                            onChange={setPage}
                        />
                    </div>
                )
            ) : null}

            {tab === "albums" ? (
                <AlbumGrid
                    albums={visibleAlbums}
                    emptyMessage={query ? "没有匹配的专辑" : undefined}
                />
            ) : null}

            {tab === "artists" ? (
                <ArtistGrid
                    artists={artistGroups}
                />
            ) : null}
        </div>
    );
}

interface SortControlProps<T extends string> {
    value: T;
    labels: Record<T, string>;
    dir: SortDir;
    onChange: (value: T) => void;
    onToggleDir: () => void;
}

function SortControl<T extends string>({
                                           value,
                                           labels,
                                           dir,
                                           onChange,
                                           onToggleDir,
                                       }: SortControlProps<T>) {
    return (
        <span className="ml-auto flex items-center gap-2 text-zinc-500">
      排序
      <select
          value={value}
          onChange={(event) => onChange(event.target.value as T)}
          className="rounded-lg border bg-zinc-950/5 px-2 py-1 text-xs text-zinc-700 focus:border-blue-500/40 focus:outline-none"
      >
        {(Object.entries(labels) as [T, string][]).map(([key, label]) => (
            <option key={key} value={key}>
                {label}
            </option>
        ))}
      </select>
      <button
          type="button"
          onClick={onToggleDir}
          aria-label={dir === "asc" ? "切换为降序" : "切换为升序"}
          title={dir === "asc" ? "升序" : "降序"}
          className="rounded-lg border bg-zinc-950/5 p-1 text-zinc-500 transition hover:text-zinc-800"
      >
        {dir === "asc" ? (
            <IconArrowUp className="h-3.5 w-3.5"/>
        ) : (
            <IconArrowDown className="h-3.5 w-3.5"/>
        )}
      </button>
    </span>
    );
}

interface SongsPaginationProps {
    page: number;
    pageCount: number;
    total: number;
    onChange: (page: number) => void;
}

function SongsPagination({
                             page,
                             pageCount,
                             total,
                             onChange,
                         }: SongsPaginationProps) {
    if (pageCount <= 1) return null;

    return (
        <div className="flex items-center justify-center gap-3 pt-1 text-xs text-zinc-500">
            <button
                type="button"
                onClick={() => onChange(page - 1)}
                disabled={page <= 1}
                className="flex items-center gap-1 rounded-full border border-zinc-300 px-3 py-1 transition hover:bg-zinc-950/5 disabled:opacity-40"
            >
                <IconChevronLeft className="h-3.5 w-3.5"/>
                上一页
            </button>
            <span className="tabular-nums">
        第 {page} / {pageCount} 页 · 共 {total} 首
      </span>
            <button
                type="button"
                onClick={() => onChange(page + 1)}
                disabled={page >= pageCount}
                className="flex items-center gap-1 rounded-full border border-zinc-300 px-3 py-1 transition hover:bg-zinc-950/5 disabled:opacity-40"
            >
                下一页
                <IconChevronRight className="h-3.5 w-3.5"/>
            </button>
        </div>
    );
}

interface ArtistGridProps {
    artists: ArtistSummary[];
}

function ArtistGrid({artists}: ArtistGridProps) {
    const {openArtist} = useNav();

    if (artists.length === 0) {
        return (
            <p className="px-4 py-12 text-center text-sm text-zinc-500">
                没有匹配的艺术家
            </p>
        );
    }

    return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {artists.map((artist) => {
                return (
                    <button
                        key={artist.name}
                        type="button"
                        onClick={() => openArtist(artist.name)}
                        className="group flex min-w-0 flex-col items-center gap-2 text-center"
                    >
                        <Avatar
                            size="lg"
                            className="size-24 border border-zinc-200 bg-zinc-100 text-2xl text-zinc-500 shadow-lg shadow-zinc-900/15 transition duration-200 group-hover:scale-105 group-hover:bg-zinc-200 sm:size-28"
                        >
                            <AvatarFallback>
                                {artist.name.trim().charAt(0).toUpperCase() || "?"}
                            </AvatarFallback>
                        </Avatar>
                        <span className="w-full truncate text-sm text-zinc-800">
                            {artist.name}
                        </span>
                        <span className="text-xs text-zinc-500">
                            {artist.tracks.length} 首 · {formatDuration(artist.duration)}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
