"use client";

import { IconChevronLeft, IconChevronRight, IconInfoCircle } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { catalogReferenceDisplay } from "@/lib/catalog";
import {
  catalogReferencesOfComposerWork,
  composerWorksCatalogOf,
  filterComposerWorks,
  fetchComposerWorks,
  TWV_CATEGORIES,
  twvCategoryOfComposerWork,
  type ComposerWork,
  type ComposerWorksCatalog,
} from "@/lib/composer-works";
import { useNav } from "@/lib/nav-provider";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

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
      composerName={composerName}
    />
  );
}

function ComposerWorksCatalog({
  catalog,
  composerName,
}: {
  catalog: ComposerWorksCatalog;
  composerName: string;
}) {
  const { openWork } = useNav();
  const [works, setWorks] = useState<ComposerWork[]>([]);
  const [selectedWork, setSelectedWork] = useState<ComposerWork | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [pageInput, setPageInput] = useState("1");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [keyFilter, setKeyFilter] = useState("");
  const [twvCategoryFilter, setTwvCategoryFilter] = useState("");
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

  const filteredWorks = useMemo(
    () =>
      filterComposerWorks(works, { query, type: typeFilter, key: keyFilter })
        .filter(
          (work) =>
            !twvCategoryFilter ||
            twvCategoryOfComposerWork(work) === twvCategoryFilter,
        ),
    [keyFilter, query, twvCategoryFilter, typeFilter, works],
  );
  const types = useMemo(
    () => [...new Set(works.map(({ type }) => type).filter(Boolean))].sort(),
    [works],
  );
  const keys = useMemo(
    () => [...new Set(works.map(({ key }) => key).filter(Boolean))].sort(),
    [works],
  );
  const pageCount = Math.max(1, Math.ceil(filteredWorks.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visibleWorks = filteredWorks.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  const goToPage = (nextPage: number) => {
    const boundedPage = Math.max(1, Math.min(pageCount, nextPage));
    setPage(boundedPage);
    setPageInput(String(boundedPage));
  };

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
        <>
          <div
            className={
              catalog.system === "TWV"
                ? "grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_repeat(3,minmax(8rem,0.45fr))]"
                : "grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_minmax(8rem,0.45fr)_minmax(8rem,0.45fr)]"
            }
          >
            <Input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                goToPage(1);
              }}
              placeholder="搜索作品、目录号或其他字段…"
              aria-label="搜索作品目录"
              className="h-9 rounded-lg bg-white"
            />
            <select
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value);
                goToPage(1);
              }}
              aria-label="按作品类型筛选"
              className="h-9 min-w-0 rounded-lg border border-input bg-white px-3 text-sm text-zinc-700 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <option value="">所有类型</option>
              {types.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            {catalog.system === "TWV" ? (
              <select
                value={twvCategoryFilter}
                onChange={(event) => {
                  setTwvCategoryFilter(event.target.value);
                  goToPage(1);
                }}
                aria-label="按范围筛选"
                className="h-9 min-w-0 rounded-lg border border-input bg-white px-3 text-sm text-zinc-700 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <option value="">全部范围</option>
                {TWV_CATEGORIES.map(({ id, label }) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            ) : null}
            <select
              value={keyFilter}
              onChange={(event) => {
                setKeyFilter(event.target.value);
                goToPage(1);
              }}
              aria-label="按调性筛选"
              className="h-9 min-w-0 rounded-lg border border-input bg-white px-3 text-sm text-zinc-700 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <option value="">所有调性</option>
              {keys.map((key) => (
                <option key={key} value={key}>{key}</option>
              ))}
            </select>
          </div>
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            {filteredWorks.length > 0 ? (
              <ul className="divide-y divide-zinc-100">
                {visibleWorks.map((work, index) => {
                  const references = catalogReferencesOfComposerWork(work, catalog);

                  return (
                    <li
                      key={`${work.catalogue}:${(safePage - 1) * pageSize + index}`}
                      className="flex min-w-0 items-center gap-3 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                          {references.length > 0 ? (
                            references.map((reference, referenceIndex) => (
                              <span key={`${reference.system}:${reference.number}`}>
                                {referenceIndex > 0 ? ", " : null}
                                <button
                                  type="button"
                                  onClick={() =>
                                    openWork({ ...reference, composer: composerName })
                                  }
                                  aria-label={`查看 ${reference.display} 的作品详情和曲库录音`}
                                  className="shrink-0 text-xs font-medium text-app-accent hover:underline hover:underline-offset-2"
                                >
                                  {catalogReferenceDisplay(reference)}
                                </button>
                              </span>
                            ))
                          ) : (
                            <span className="shrink-0 text-xs font-medium text-app-accent">
                              {work.catalogue || catalog.system}
                            </span>
                          )}
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
                  );
                })}
              </ul>
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-zinc-500">
                <p>没有符合条件的作品</p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setTypeFilter("");
                    setKeyFilter("");
                    setTwvCategoryFilter("");
                    goToPage(1);
                  }}
                  className="text-xs text-app-accent hover:underline hover:underline-offset-2"
                >
                  清除搜索和筛选
                </button>
              </div>
            )}

          {filteredWorks.length > 0 ? (
            <div className="flex flex-wrap items-center justify-center gap-2 border-t border-zinc-200 px-3 py-2 text-xs text-zinc-500">
              <button
                type="button"
                onClick={() => goToPage(safePage - 1)}
                disabled={safePage <= 1}
                className="flex items-center gap-1 rounded-full border border-zinc-300 px-3 py-1 transition hover:bg-zinc-950/5 disabled:opacity-40"
              >
                <IconChevronLeft className="size-3.5" />
                上一页
              </button>
              <span className="tabular-nums">
                第 {safePage} / {pageCount} 页 · 共 {filteredWorks.length} 条作品
              </span>
              <button
                type="button"
                onClick={() => goToPage(safePage + 1)}
                disabled={safePage >= pageCount}
                className="flex items-center gap-1 rounded-full border border-zinc-300 px-3 py-1 transition hover:bg-zinc-950/5 disabled:opacity-40"
              >
                下一页
                <IconChevronRight className="size-3.5" />
              </button>
              <label className="flex items-center gap-1.5">
                每页
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    goToPage(1);
                  }}
                  aria-label="每页显示条数"
                  className="h-7 rounded-md border border-input bg-white px-1.5 text-xs text-zinc-700 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                条
              </label>
              <form
                className="flex items-center gap-1.5"
                onSubmit={(event) => {
                  event.preventDefault();
                  const requestedPage = Number(pageInput);
                  if (Number.isInteger(requestedPage)) {
                    goToPage(requestedPage);
                  } else {
                    setPageInput(String(safePage));
                  }
                }}
              >
                <label htmlFor="composer-works-page" className="whitespace-nowrap">
                  跳至
                </label>
                <Input
                  id="composer-works-page"
                  type="number"
                  min={1}
                  max={pageCount}
                  step={1}
                  value={pageInput}
                  onChange={(event) => setPageInput(event.target.value)}
                  aria-label="跳转到第几页"
                  className="h-7 w-16 rounded-md bg-white px-2 text-center text-xs"
                />
                <button
                  type="submit"
                  className="rounded-full border border-zinc-300 px-2.5 py-1 transition hover:bg-zinc-950/5"
                >
                  跳转
                </button>
              </form>
            </div>
          ) : null}
            {filteredWorks.length > 0 &&
            (query || typeFilter || keyFilter || twvCategoryFilter) ? (
              <p className="border-t border-zinc-200 px-3 py-2 text-center text-xs text-zinc-500">
                筛选结果：{filteredWorks.length} / {works.length} 条作品
              </p>
            ) : null}
          </div>
        </>
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
                {selectedWork.title || "作品目录记录"}
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
