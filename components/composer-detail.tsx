import { IconArrowLeft, IconPlayerPlay } from "@tabler/icons-react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useLayoutEffect, useRef, useState } from "react";
import { AlbumGrid } from "@/components/album-grid";
import { ComposerWorks } from "@/components/composer-works";
import { TrackList } from "@/components/track-list";
import { composerNamesOf, groupAlbums } from "@/lib/catalog";
import { compareNames } from "@/lib/collation";
import { useLibrary } from "@/lib/library-provider";
import { useNav } from "@/lib/nav-provider";
import { usePlayer } from "@/lib/player-provider";
import type { Track } from "@/lib/types";

const TRACKS_PAGE_SIZE = 10;

export function ComposerDetail({composerName}: {composerName: string}) {
  const {tracks, removeTracks} = useLibrary();
  const {closeComposer, backLabel} = useNav();
  const player = usePlayer();
  const composerKey = composerName.trim().toLocaleLowerCase();
  const composerTracks = tracks.filter((track) =>
    composerNamesOf(track).some((name) => name.toLocaleLowerCase() === composerKey),
  );
  const albums = groupAlbums(composerTracks).sort((a, b) => {
    const dateA = a.releaseDate.sortValue;
    const dateB = b.releaseDate.sortValue;
    if (dateA === 0 && dateB !== 0) return 1;
    if (dateB === 0 && dateA !== 0) return -1;
    return dateB - dateA || compareNames(a.album, b.album);
  });
  const sortedTracks = [...composerTracks].sort((a, b) =>
    b.playCount - a.playCount ||
    b.releaseDate.sortValue - a.releaseDate.sortValue ||
    compareNames(a.album, b.album) ||
    (a.discNo ?? 1) - (b.discNo ?? 1) ||
    (a.trackNo ?? Number.MAX_SAFE_INTEGER) - (b.trackNo ?? Number.MAX_SAFE_INTEGER) ||
    compareNames(a.title, b.title),
  );
  const [trackPage, setTrackPage] = useState(1);
  const recordingsCardRef = useRef<HTMLDivElement>(null);
  const [recordingsCardHeight, setRecordingsCardHeight] = useState(0);
  useLayoutEffect(() => {
    const recordingsCard = recordingsCardRef.current;
    if (!recordingsCard) return;

    const updateHeight = () =>
      setRecordingsCardHeight(recordingsCard.getBoundingClientRect().height);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(recordingsCard);
    return () => observer.disconnect();
  }, []);
  const trackPageCount = Math.max(1, Math.ceil(sortedTracks.length / TRACKS_PAGE_SIZE));
  const safeTrackPage = Math.min(trackPage, trackPageCount);
  const featuredTracks = sortedTracks.slice(
    (safeTrackPage - 1) * TRACKS_PAGE_SIZE,
    safeTrackPage * TRACKS_PAGE_SIZE,
  );

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={closeComposer}
        className="flex w-fit items-center gap-2 text-xs leading-4 text-zinc-500 transition hover:text-zinc-800"
      >
        <IconArrowLeft className="h-3.5 w-3.5" />
        {backLabel}
      </button>

      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h1 className="mt-1 min-w-0 text-3xl font-semibold text-zinc-900">{composerName}</h1>
          <button
            type="button"
            onClick={() => player.playQueue(composerTracks, 0)}
            disabled={composerTracks.length === 0}
            className="flex shrink-0 items-center gap-2 rounded-full bg-app-accent px-5 py-2 text-sm font-medium text-white transition hover:brightness-90 disabled:opacity-40"
          >
            <IconPlayerPlay className="h-4 w-4 fill-current" />
              播放
            </button>
        </div>
      </header>

      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-3">
          <h2 className="text-base font-medium text-zinc-800">Related recordings</h2>
          <div
            ref={recordingsCardRef}
            className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
          >
            <TrackList
              tracks={featuredTracks}
              showIndex={false}
              showCoverArt
              queueTracks={composerTracks}
              onRemove={(track: Track) => void removeTracks([track.id])}
              emptyMessage="该作曲家没有相关录音"
            />
            {trackPageCount > 1 ? (
              <div className="flex items-center justify-center gap-3 border-t border-zinc-200 px-3 py-2 text-xs text-zinc-500">
                <button
                  type="button"
                  onClick={() => setTrackPage((page) => page - 1)}
                  disabled={safeTrackPage <= 1}
                  className="flex items-center gap-1 rounded-full border border-zinc-300 px-3 py-1 transition hover:bg-zinc-950/5 disabled:opacity-40"
                >
                  <IconChevronLeft className="h-3.5 w-3.5" />上一页
                </button>
                <span className="tabular-nums">
                  第 {safeTrackPage} / {trackPageCount} 页 · 共 {sortedTracks.length} 段录音
                </span>
                <button
                  type="button"
                  onClick={() => setTrackPage((page) => page + 1)}
                  disabled={safeTrackPage >= trackPageCount}
                  className="flex items-center gap-1 rounded-full border border-zinc-300 px-3 py-1 transition hover:bg-zinc-950/5 disabled:opacity-40"
                >
                  下一页<IconChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
          </div>
        </section>

        <section className="flex min-h-0 min-w-0 flex-col gap-3">
          <h2 className="text-base font-medium text-zinc-800">Related albums</h2>
          <AlbumGrid
            albums={albums}
            emptyMessage="没有找到该作曲家的相关专辑"
            layout="column-carousel"
            carouselHeight={recordingsCardHeight}
          />
        </section>
      </div>

      <section className="flex min-w-0 flex-col gap-3">
        <h2 className="text-base font-medium text-zinc-800">Works</h2>
        <ComposerWorks composerName={composerName} />
      </section>
    </div>
  );
}
