"use client";

import {IconBrandGithubFilled, IconChevronLeft, IconChevronRight, IconInfoCircle} from "@tabler/icons-react";
import {useEffect, useMemo, useState} from "react";
import {Input} from "@/components/ui/input";
import {Dialog, DialogContent, DialogDescription, DialogTitle,} from "@/components/ui/dialog";
import {catalogReferenceDisplay} from "@/lib/catalog";
import {
    catalogReferencesOfComposerWork,
    type ComposerWork,
    type ComposerWorksCatalog,
    composerWorksCatalogOf,
    fetchComposerWorks,
    filterComposerWorks,
    isComposerWorkFieldVisible,
} from "@/lib/composer-works";
import {useNav} from "@/lib/nav-provider";

const PAGE_SIZE = 3;

export function ComposerWorks({composerName}: { composerName: string }) {
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
    const {openWork} = useNav();
    const [works, setWorks] = useState<ComposerWork[]>([]);
    const [selectedWork, setSelectedWork] = useState<ComposerWork | null>(null);
    const [page, setPage] = useState(1);
    const [pageInput, setPageInput] = useState("1");
    const [query, setQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const [keyFilter, setKeyFilter] = useState("");
    const [loadAttempt, setLoadAttempt] = useState(0);
    const [status, setStatus] = useState<
        { kind: "loading" } | { kind: "loaded" } | { kind: "error"; message: string }
    >({kind: "loading"});

    useEffect(() => {
        const controller = new AbortController();
        void fetchComposerWorks(catalog, controller.signal).then(
            (loadedWorks) => {
                setWorks(loadedWorks);
                setStatus({kind: "loaded"});
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
        () => filterComposerWorks(works, {query, type: typeFilter, key: keyFilter}),
        [keyFilter, query, typeFilter, works],
    );
    const types = useMemo(
        () => [...new Set(works.map(({type}) => type).filter(Boolean))].sort(),
        [works],
    );
    const keys = useMemo(
        () => [...new Set(works.map(({key}) => key).filter(Boolean))].sort(),
        [works],
    );
    const pageCount = Math.max(1, Math.ceil(filteredWorks.length / PAGE_SIZE));
    const safePage = Math.min(page, pageCount);
    const visibleWorks = filteredWorks.slice(
        (safePage - 1) * PAGE_SIZE,
        safePage * PAGE_SIZE,
    );
    const goToPage = (nextPage: number) => {
        const boundedPage = Math.max(1, Math.min(pageCount, nextPage));
        setPage(boundedPage);
        setPageInput(String(boundedPage));
    };

    return (
        <div className="flex h-full min-h-0 flex-col gap-2">
            {status.kind === "loading" ? (
                <p
                    role="status"
                    className="rounded-xl border border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-500"
                >
                    Loading works…
                </p>
            ) : null}

            {status.kind === "error" ? (
                <div
                    role="alert"
                    className="flex flex-col items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center"
                >
                    <p className="text-sm text-zinc-600">
                        Loading... Error：{status.message}
                    </p>
                    <button
                        type="button"
                        onClick={() => {
                            setWorks([]);
                            setStatus({kind: "loading"});
                            setLoadAttempt((attempt) => attempt + 1);
                        }}
                        className="rounded-full border border-zinc-300 px-4 py-1.5 text-xs text-zinc-700 transition hover:bg-zinc-950/5"
                    >
                        Retry
                    </button>
                </div>
            ) : null}

            {status.kind === "loaded" && works.length === 0 ? (
                <p className="rounded-xl border border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-500">
                    No data in this worklist
                </p>
            ) : null}

            {status.kind === "loaded" && works.length > 0 ? (
                <>
                    <div
                        className="grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_minmax(8rem,0.45fr)_minmax(8rem,0.45fr)]"
                    >
                        <Input
                            type="search"
                            value={query}
                            onChange={(event) => {
                                setQuery(event.target.value);
                                goToPage(1);
                            }}
                            placeholder="Search work..."
                            aria-label="搜索作品目录"
                            className="h-8 rounded-lg bg-white"
                        />
                        <select
                            value={typeFilter}
                            onChange={(event) => {
                                setTypeFilter(event.target.value);
                                goToPage(1);
                            }}
                            aria-label="按作品类型筛选"
                            className="h-8 min-w-0 rounded-lg border border-input bg-white px-3 text-sm text-zinc-700 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                            <option value="">Type</option>
                            {types.map((type) => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                        <select
                            value={keyFilter}
                            onChange={(event) => {
                                setKeyFilter(event.target.value);
                                goToPage(1);
                            }}
                            aria-label="按调性筛选"
                            className="h-8 min-w-0 rounded-lg border border-input bg-white px-3 text-sm text-zinc-700 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                            <option value="">Key/Tone</option>
                            {keys.map((key) => (
                                <option key={key} value={key}>{key}</option>
                            ))}
                        </select>
                    </div>
                    <div
                        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white">
                        <div className="min-h-0 flex-1 overflow-y-auto">
                            {filteredWorks.length > 0 ? (
                                <ul className="divide-y divide-zinc-100">
                                    {visibleWorks.map((work, index) => {
                                        const references = catalogReferencesOfComposerWork(work, catalog);

                                        return (
                                            <li
                                                key={`${work.catalogue}:${(safePage - 1) * PAGE_SIZE + index}`}
                                                className="flex min-w-0 items-center gap-3 px-4 py-3"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div
                                                        className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                                                        {references.length > 0 ? (
                                                            references.map((reference, referenceIndex) => (
                                                                <span key={`${reference.system}:${reference.number}`}>
                                {referenceIndex > 0 ? ", " : null}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            openWork({
                                                                                ...reference,
                                                                                composer: composerName
                                                                            })
                                                                        }
                                                                        aria-label={`查看 ${reference.display} 的作品详情和曲库录音`}
                                                                        className="shrink-0 text-xs font-medium text-app-accent hover:underline hover:underline-offset-2"
                                                                    >
                                  {catalogReferenceDisplay(reference)}
                                </button>
                              </span>
                                                            ))
                                                        ) : (
                                                            <span
                                                                className="shrink-0 text-xs font-medium text-app-accent">
                              {work.catalogue || catalog.system}
                            </span>
                                                        )}
                                                        <span
                                                            className="min-w-0 whitespace-pre-wrap text-sm text-zinc-800">
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
                                                    <IconInfoCircle className="size-4"/>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : (
                                <div
                                    className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-zinc-500">
                                    <p>没有符合条件的作品</p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setQuery("");
                                            setTypeFilter("");
                                            setKeyFilter("");
                                            goToPage(1);
                                        }}
                                        className="text-xs text-app-accent hover:underline hover:underline-offset-2"
                                    >
                                        Clear filters
                                    </button>
                                </div>
                            )}
                        </div>
                        {filteredWorks.length > 0 ? (
                            <div
                                className="flex h-8 shrink-0 flex-wrap items-center justify-center gap-2 border-t border-zinc-200 px-3 text-xs text-zinc-500">
                                <button
                                    type="button"
                                    onClick={() => goToPage(safePage - 1)}
                                    disabled={safePage <= 1}
                                    className="flex items-center gap-1 rounded-full border border-zinc-300 px-3 py-1 transition hover:bg-zinc-950/5 disabled:opacity-40"
                                >
                                    <IconChevronLeft className="size-3.5"/>
                                </button>
                                <span className="tabular-nums">
                {safePage} / {pageCount}
              </span>
                                <button
                                    type="button"
                                    onClick={() => goToPage(safePage + 1)}
                                    disabled={safePage >= pageCount}
                                    className="flex items-center gap-1 rounded-full border border-zinc-300 px-3 py-1 transition hover:bg-zinc-950/5 disabled:opacity-40"
                                >
                                    <IconChevronRight className="size-3.5"/>
                                </button>
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
                                        Go
                                    </button>
                                </form>
                            </div>
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
                                {Object.entries(selectedWork.fields)
                                    .filter(([field, value]) =>
                                        isComposerWorkFieldVisible(field, catalog.system) &&
                                        value.trim().length > 0,
                                    )
                                    .map(([field, value]) => (
                                        <div
                                            key={field}
                                            className="contents border-b border-zinc-100 last:border-0"
                                        >
                                            <dt className="border-b border-zinc-100 py-2 font-medium text-zinc-500">
                                                {field}
                                            </dt>
                                            <dd className="min-w-0 border-b border-zinc-100 py-2 whitespace-pre-wrap wrap-break-word text-zinc-800">
                                                {value || "—"}
                                            </dd>
                                        </div>
                                    ))}
                            </dl>
                            <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                                <span>Check source on</span>
                                <a
                                    href={`https://github.com/KenParker-CN/konzert-public-data/blob/main/${catalog.fileName}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex shrink-0 underline underline-offset-2 hover:text-zinc-800"
                                >
                                    <IconBrandGithubFilled className="size-4"/>
                                </a>
                            </span>
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>
        </div>
    );
}
