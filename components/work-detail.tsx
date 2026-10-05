"use client";

import { IconArrowLeft, IconChevronLeft, IconChevronRight, IconPlayerPlay } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { TrackList } from "@/components/track-list";
import {
  catalogReferencesOfComposerWork,
  composerWorksCatalogOf,
  fetchComposerWorks,
  isComposerWorkFieldVisible,
  opusNumbersOfComposerWork,
  type ComposerWork,
} from "@/lib/composer-works";
import { useLibrary } from "@/lib/library-provider";
import { useNav } from "@/lib/nav-provider";
import { usePlayer } from "@/lib/player-provider";
import { compareNames } from "@/lib/collation";
import { catalogNumbersMatch, catalogReferencesOf } from "@/lib/catalog";
import type { CatalogReference } from "@/lib/catalog";

const PAGE_SIZE = 20;

export function WorkDetail({
  work,
}: {
  work: CatalogReference & { composer: string };
}) {
  const { tracks, removeTracks } = useLibrary();
  const { closeWork, backLabel } = useNav();
  const player = usePlayer();
  const worksCatalog = useMemo(
    () => composerWorksCatalogOf(work.composer),
    [work.composer],
  );
  const catalogWorkKey = `${work.system}:${work.number}:${work.composer}`;
  type CatalogWorkState =
    | { kind: "loading" }
    | { kind: "loaded"; work: ComposerWork | null }
    | { kind: "error"; message: string }
    | { kind: "unavailable" };
  const [catalogWorkResult, setCatalogWorkResult] = useState<{
    key: string;
    state: CatalogWorkState;
  } | null>(null);
  useEffect(() => {
    if (!worksCatalog) return;

    const controller = new AbortController();
    void fetchComposerWorks(worksCatalog, controller.signal).then(
      (works) => {
        const matchingWork =
          works.find((entry) => {
            if (work.system === "Op.") {
              return opusNumbersOfComposerWork(entry).some((number) =>
                catalogNumbersMatch(work.system, number, work.number),
              );
            }
            const references = catalogReferencesOfComposerWork(
              entry,
              worksCatalog,
            );
            return references.some(
              (reference) =>
                reference.system === work.system &&
                catalogNumbersMatch(work.system, reference.number, work.number),
            );
          }) ?? null;
        setCatalogWorkResult({
          key: catalogWorkKey,
          state: { kind: "loaded", work: matchingWork },
        });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setCatalogWorkResult({
          key: catalogWorkKey,
          state: {
            kind: "error",
            message: error instanceof Error ? error.message : "未知错误",
          },
        });
      },
    );

    return () => controller.abort();
  }, [catalogWorkKey, work.number, work.system, worksCatalog]);
  const catalogWork: CatalogWorkState = !worksCatalog
    ? { kind: "unavailable" }
    : catalogWorkResult?.key === catalogWorkKey
      ? catalogWorkResult.state
      : { kind: "loading" };
  const workReferences = [
    work,
    ...(catalogWork.kind === "loaded" && catalogWork.work && worksCatalog
      ? catalogReferencesOfComposerWork(catalogWork.work, worksCatalog)
      : []),
  ].filter(
    (reference, index, references) =>
      references.findIndex(
        (candidate) =>
          candidate.system === reference.system &&
          candidate.number === reference.number,
      ) === index,
  );
  const recordings = tracks
    .filter((track) => {
      const references = catalogReferencesOf(track.title);
      const matchesCatalog = workReferences.some((workReference) =>
        references.some(
          (reference) =>
            reference.system === workReference.system &&
            catalogNumbersMatch(
              workReference.system,
              reference.number,
              workReference.number,
            ),
        ),
      );
      return matchesCatalog && track.composer.trim().toLowerCase() ===
        work.composer.trim().toLowerCase();
    })
    .sort((a, b) =>
      compareNames(a.album, b.album) ||
      (a.discNo ?? 1) - (b.discNo ?? 1) ||
      (a.trackNo ?? Number.MAX_SAFE_INTEGER) -
        (b.trackNo ?? Number.MAX_SAFE_INTEGER) ||
      compareNames(a.title, b.title),
    );
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
        className="flex w-fit items-center gap-2 text-xs leading-4 text-zinc-500 transition hover:text-zinc-800"
      >
        <IconArrowLeft className="h-3.5 w-3.5" />
        {backLabel}
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
      {worksCatalog ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-zinc-800">Details</h2>
          {catalogWork.kind === "loading" ? (
            <p role="status" className="rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500">
              正在加载作品详情…
            </p>
          ) : null}
          {catalogWork.kind === "error" ? (
            <p role="alert" className="rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500">
              作品详情加载失败：{catalogWork.message}
            </p>
          ) : null}
          {catalogWork.kind === "unavailable" ? (
            <p className="rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500">
              该作曲家的作品目录暂未接入
            </p>
          ) : null}
          {catalogWork.kind === "loaded" && catalogWork.work ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <dl className="grid grid-cols-[minmax(6rem,0.35fr)_minmax(0,1fr)] gap-x-4 text-sm">
                {Object.entries(catalogWork.work.fields)
                  .filter(
                    ([field, value]) =>
                      field.trim().toLocaleLowerCase() !== "catalogue" &&
                      isComposerWorkFieldVisible(field, worksCatalog.system) &&
                      value.trim().length > 0,
                  )
                  .map(([field, value]) => (
                    <div key={field} className="contents">
                      <dt className="border-t border-zinc-100 py-2 font-medium text-zinc-500">
                        {field}
                      </dt>
                      <dd className="min-w-0 border-t border-zinc-100 py-2 whitespace-pre-wrap break-words text-zinc-800">
                        {value}
                      </dd>
                    </div>
                  ))}
              </dl>
            </div>
          ) : null}
          {catalogWork.kind === "loaded" && !catalogWork.work ? (
            <p className="rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500">
              目录中没有找到 {work.display} 的作品详情
            </p>
          ) : null}
        </section>
      ) : null}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-800">
          Recordings
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
