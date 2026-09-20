"use client";

import { IconArrowLeft, IconChevronLeft, IconChevronRight, IconPlayerPlay } from "@tabler/icons-react";
import { useState } from "react";
import { TrackList } from "@/components/track-list";
import { useLibrary } from "@/lib/library-provider";
import { useNav } from "@/lib/nav-provider";
import { usePlayer } from "@/lib/player-provider";
import { catalogReferencesOf } from "@/lib/catalog";
import type { CatalogReference } from "@/lib/catalog";

const PAGE_SIZE = 20;

export function WorkDetail({
  work,
}: {
  work: CatalogReference & { composer: string };
}) {
  const { tracks, removeTracks } = useLibrary();
  const { closeWork } = useNav();
  const player = usePlayer();
  const recordings = tracks.filter((track) => {
    const references = catalogReferencesOf(track.title);
    const matchesCatalog = references.some(
      (reference) =>
        reference.system === work.system &&
        reference.number.toLowerCase() === work.number.toLowerCase(),
    );
    return matchesCatalog && track.composer.trim().toLowerCase() ===
      work.composer.trim().toLowerCase();
  });
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(recordings.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = recordings.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={closeWork}
        className="flex w-fit items-center gap-2 text-xs text-zinc-500 transition hover:text-zinc-800"
      >
        <IconArrowLeft className="h-3.5 w-3.5" />
        返回曲库
      </button>
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] tracking-widest text-zinc-500 uppercase">
            Work
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-900 sm:text-3xl">
            {work.composer ? `${work.composer}'s ` : ""}
            {work.display}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => player.playQueue(recordings, 0)}
          disabled={recordings.length === 0}
          className="flex items-center gap-2 rounded-full bg-app-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-90 disabled:opacity-40"
        >
          <IconPlayerPlay className="h-4 w-4 fill-current" />
          播放
        </button>
      </header>
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-800">
          Recordings of this work
        </h2>
        {visible.length > 0 ? (
          <TrackList
            tracks={visible}
            queueTracks={recordings}
            showIndex={false}
            showCoverArt
            trackAlbum={() => null}
            onRemove={(track) => void removeTracks([track.id])}
          />
        ) : (
          <p className="rounded-xl border border-zinc-200 bg-white px-4 py-12 text-center text-sm text-zinc-500">
            没有找到该作品的录音
          </p>
        )}
      </section>
      {pageCount > 1 ? (
        <div className="flex items-center justify-center gap-3 pt-1 text-xs text-zinc-500">
          <button
            type="button"
            onClick={() => setPage((current) => current - 1)}
            disabled={safePage <= 1}
            className="flex items-center gap-1 rounded-full border border-zinc-300 px-3 py-1 transition hover:bg-zinc-950/5 disabled:opacity-40"
          >
            <IconChevronLeft className="h-3.5 w-3.5" />
            上一页
          </button>
          <span className="tabular-nums">
            第 {safePage} / {pageCount} 页 · 共 {recordings.length} 首
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => current + 1)}
            disabled={safePage >= pageCount}
            className="flex items-center gap-1 rounded-full border border-zinc-300 px-3 py-1 transition hover:bg-zinc-950/5 disabled:opacity-40"
          >
            下一页
            <IconChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
