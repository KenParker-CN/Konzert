"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Play, Search, Shuffle, X } from "lucide-react";
import { AlbumDetail } from "@/components/album-detail";
import { AlbumGrid } from "@/components/album-grid";
import { EmptyState } from "@/components/empty-state";
import { TrackList } from "@/components/track-list";
import {
  TRACK_SORT_LABELS,
  groupAlbums,
  searchTracks,
  sortTracks,
  uniqueArtists,
  type TrackSort,
} from "@/lib/catalog";
import { formatDuration } from "@/lib/format";
import { useLibrary } from "@/lib/library-provider";
import { useNav } from "@/lib/nav-provider";
import { usePlayer } from "@/lib/player-provider";
import type { Track } from "@/lib/types";

type Tab = "songs" | "albums" | "artists";

const TABS: { id: Tab; label: string }[] = [
  { id: "songs", label: "歌曲" },
  { id: "albums", label: "专辑" },
  { id: "artists", label: "艺术家" },
];

export function LibraryView() {
  const { tracks, albums, importFolder, scanning, storageMode, removeTracks } =
    useLibrary();
  const { albumKey } = useNav();
  const player = usePlayer();

  const [tab, setTab] = useState<Tab>("songs");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<TrackSort>("added");
  const [openArtist, setOpenArtist] = useState<string | null>(null);

  const matched = useMemo(() => searchTracks(tracks, query), [tracks, query]);
  const visibleTracks = useMemo(
    () => sortTracks(matched, sort),
    [matched, sort],
  );
  const visibleAlbums = useMemo(() => groupAlbums(matched), [matched]);
  const artists = useMemo(() => uniqueArtists(matched), [matched]);

  const openAlbum = albumKey
    ? albums.find((album) => album.key === albumKey)
    : undefined;

  if (openAlbum) {
    return <AlbumDetail album={openAlbum} />;
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
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索标题、艺术家、专辑…"
                className="w-56 rounded-full border border-zinc-200 bg-zinc-950/5 py-1.5 pr-8 pl-8 text-xs text-zinc-700 focus:outline-none"
              />
              {query ? (
                <button
                  type="button"
                  aria-label="清空搜索"
                  onClick={() => setQuery("")}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-zinc-500 hover:text-zinc-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => player.playQueue(visibleTracks, 0)}
              disabled={visibleTracks.length === 0}
              className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-zinc-50 transition hover:bg-zinc-700 disabled:opacity-40"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              播放全部
            </button>
            <button
              type="button"
              onClick={() => player.playQueue(visibleTracks, 0, { shuffle: true })}
              disabled={visibleTracks.length === 0}
              className="flex items-center gap-1.5 rounded-full border border-zinc-300 px-3.5 py-1.5 text-xs text-zinc-700 transition hover:bg-zinc-950/5 disabled:opacity-40"
            >
              <Shuffle className="h-3.5 w-3.5" />
              随机
            </button>
          </div>
        </div>

        {/* @@LIBRARY_BODY@@ */}
      {/* 概览 */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-zinc-500">
          <span>{visibleTracks.length} 首曲目</span>
          <span className="text-zinc-300">·</span>
          <span>{visibleAlbums.length} 张专辑</span>
          <span className="text-zinc-300">·</span>
          <span>{artists.length} 位艺术家</span>
          {query ? (
            <span className="text-blue-600">已按「{query}」筛选</span>
          ) : null}
          {tab === "songs" ? (
            <label className="ml-auto flex items-center gap-2 text-zinc-500">
              排序
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as TrackSort)}
                className="rounded-lg border bg-zinc-950/5 px-2 py-1 text-xs text-zinc-700 focus:border-blue-500/40 focus:outline-none"
              >
                {(
                  Object.entries(TRACK_SORT_LABELS) as [TrackSort, string][]
                ).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
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
          <TrackList
            tracks={visibleTracks}
            showIndex={false}
            onRemove={(track) => void removeTracks([track.id])}
          />
        )
      ) : null}

      {tab === "albums" ? (
        <AlbumGrid
          albums={visibleAlbums}
          emptyMessage={query ? "没有匹配的专辑" : undefined}
        />
      ) : null}

      {tab === "artists" ? (
        <ArtistSections
          artists={artists}
          tracks={matched}
          openArtist={openArtist}
          onToggleArtist={(artist) =>
            setOpenArtist((current) => (current === artist ? null : artist))
          }
          onRemove={(track) => void removeTracks([track.id])}
        />
      ) : null}
    </div>
  );
}

interface ArtistSectionsProps {
  artists: string[];
  tracks: Track[];
  openArtist: string | null;
  onToggleArtist: (artist: string) => void;
  onRemove: (track: Track) => void;
}

function ArtistSections({
  artists,
  tracks,
  openArtist,
  onToggleArtist,
  onRemove,
}: ArtistSectionsProps) {
  if (artists.length === 0) {
    return (
      <p className="px-4 py-12 text-center text-sm text-zinc-500">
        没有匹配的艺术家
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {artists.map((artist) => {
        const artistTracks = tracks.filter((track) => track.artist === artist);
        const open = openArtist === artist;
        const total = artistTracks.reduce(
          (sum, track) => sum + (track.duration || 0),
          0,
        );

        return (
          <div
            key={artist}
            className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
          >
            <button
              type="button"
              onClick={() => onToggleArtist(artist)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-100"
            >
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-zinc-500 transition ${
                  open ? "rotate-180" : ""
                }`}
              />
              <span className="flex-1 truncate text-sm text-zinc-800">
                {artist}
              </span>
              <span className="shrink-0 text-xs text-zinc-500">
                {artistTracks.length} 首 · {formatDuration(total)}
              </span>
            </button>
            {open ? (
              <div className="border-t border-zinc-200 p-1.5">
                <TrackList
                  tracks={artistTracks}
                  showIndex={false}
                  onRemove={onRemove}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}