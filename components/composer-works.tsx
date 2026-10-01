"use client";

import { IconChevronLeft, IconChevronRight, IconInfoCircle } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  composerWorksCatalogOf,
  fetchComposerWorks,
  type ComposerWork,
  type ComposerWorksCatalog,
} from "@/lib/composer-works";

const PAGE_SIZE = 20;

export function ComposerWorks({ composerName }: { composerName: string }) {
  const catalog = useMemo(
    () => composerWorksCatalogOf(composerName),
    [composerName],
  );

  if (!catalog) {
    return (
      <p className="rounded-xl border border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-500">
        该作曲家的作品目录暂未接入
      </p>
    );
  }

  return (
    <ComposerWorksCatalog
      key={`${catalog.system}:${composerName}`}
      catalog={catalog}
    />
  );
}

function ComposerWorksCatalog({
  catalog,
}: {
  catalog: ComposerWorksCatalog;
}) {
  const [works, setWorks] = useState<ComposerWork[]>([]);
  const [selectedWork, setSelectedWork] = useState<ComposerWork | null>(null);
  const [page, setPage] = useState(1);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [status, setStatus] = useState<
    { kind: "loading" } | { kind: "loaded" } | { kind: "error"; message: string }
  >({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    void fetchComposerWorks(catalog, controller.signal).then(
      (loadedWorks) => {
        setWorks(loadedWorks);
        setStatus({ kind: "loaded" });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setStatus({
          kind: "error",
          message:
            error instanceof Error ? error.message : "未知错误",
        });
      },
    );

    return () => controller.abort();
  }, [catalog, loadAttempt]);

  const pageCount = Math.max(1, Math.ceil(works.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visibleWorks = works.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  return (
    <>
      {status.kind === "loading" ? (
        <p
          role="status"
          className="rounded-xl border border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-500"
        >
          正在从 GitHub 加载作品目录…
        </p>
      ) : null}

      {status.kind === "error" ? (
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center"
        >
          <p className="text-sm text-zinc-600">
            作品目录加载失败：{status.message}
          </p>
          <button
            type="button"
            onClick={() => {
              setWorks([]);
              setStatus({ kind: "loading" });
              setLoadAttempt((attempt) => attempt + 1);
            }}
            className="rounded-full border border-zinc-300 px-4 py-1.5 text-xs text-zinc-700 transition hover:bg-zinc-950/5"
          >
            重试
          </button>
        </div>
      ) : null}

      {status.kind === "loaded" && works.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-500">
          该作品目录中没有记录
        </p>
      ) : null}

      {status.kind === "loaded" && works.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <ul className="divide-y divide-zinc-100">
            {visibleWorks.map((work, index) => (
              <li
                key={`${work.catalogue}:${(safePage - 1) * PAGE_SIZE + index}`}
                className="flex min-w-0 items-center gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="shrink-0 text-xs font-medium text-app-accent">
                      {work.catalogue || catalog.system}
                    </span>
                    <span className="min-w-0 whitespace-pre-wrap text-sm text-zinc-800">
                      {work.title}
                    </span>
                  </div>
                  {work.type || work.key ? (
                    <p className="mt-1 text-xs text-zinc-500">
                      {[work.type, work.key].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedWork(work)}
                  aria-label={`查看 ${work.catalogue || work.title} 的完整作品信息`}
                  title="查看完整信息"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <IconInfoCircle className="size-4" />
                </button>
              </li>
            ))}
          </ul>

          {pageCount > 1 ? (
            <div className="flex items-center justify-center gap-3 border-t border-zinc-200 px-3 py-2 text-xs text-zinc-500">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={safePage <= 1}
                className="flex items-center gap-1 rounded-full border border-zinc-300 px-3 py-1 transition hover:bg-zinc-950/5 disabled:opacity-40"
              >
                <IconChevronLeft className="size-3.5" />
                上一页
              </button>
              <span className="tabular-nums">
                第 {safePage} / {pageCount} 页 · 共 {works.length} 条作品
              </span>
              <button
                type="button"
                onClick={() =>
                  setPage((current) => Math.min(pageCount, current + 1))
                }
                disabled={safePage >= pageCount}
                className="flex items-center gap-1 rounded-full border border-zinc-300 px-3 py-1 transition hover:bg-zinc-950/5 disabled:opacity-40"
              >
                下一页
                <IconChevronRight className="size-3.5" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <Dialog
        open={selectedWork !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedWork(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {selectedWork ? (
            <>
              <DialogTitle>
                {selectedWork.catalogue || selectedWork.title}
              </DialogTitle>
              <DialogDescription>
                {selectedWork.title} · {catalog.system} 作品目录
              </DialogDescription>
              <dl className="grid grid-cols-[minmax(6rem,0.35fr)_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
                {Object.entries(selectedWork.fields).map(([field, value]) => (
                  <div
                    key={field}
                    className="contents border-b border-zinc-100 last:border-0"
                  >
                    <dt className="border-b border-zinc-100 py-2 font-medium text-zinc-500">
                      {field}
                    </dt>
                    <dd className="min-w-0 border-b border-zinc-100 py-2 whitespace-pre-wrap break-words text-zinc-800">
                      {value || "—"}
                    </dd>
                  </div>
                ))}
              </dl>
              <a
                href={`https://github.com/KenParker-CN/konzert-public-data/blob/main/${catalog.fileName}`}
                target="_blank"
                rel="noreferrer"
                className="w-fit text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-800"
              >
                查看 GitHub 数据源
              </a>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
