"use client";

import {useEffect, useMemo, useState, type CSSProperties} from "react";
import {
    IconArrowLeft,
    IconChevronLeft,
    IconChevronRight,
    IconDownload,
    IconHeart,
    IconInfoCircle,
    IconPlaylistAdd,
} from "@tabler/icons-react";
import {CoverArt, useCoverUrl} from "@/components/cover-art";
import {ImageZoom} from "@/components/animate-ui/image-zoom";
import {AnimatedAvatarGroup} from "@/components/animate-ui/avatar-group";
import {MarqueeText} from "@/components/marquee-text";
import {CatalogTitle} from "@/components/catalog-title";
import {TrackList} from "@/components/track-list";
import {Dialog, DialogContent, DialogDescription, DialogTitle} from "@/components/ui/dialog";
import {formatBitDepth, formatDuration, formatReleaseDate, formatSampleRate, formatTotalDuration,} from "@/lib/format";
import {artistNamesOf, genresOf, groupTracksByDisc, groupWorks, movementTitleOf, splitArtists,} from "@/lib/catalog";
import {useLibrary} from "@/lib/library-provider";
import {useNav} from "@/lib/nav-provider";
import {usePlayer} from "@/lib/player-provider";
import {albumFavoriteKey, type AlbumSummary, type Track} from "@/lib/types";

function dominantColorOf(imageUrl: string): Promise<string | null> {
    return new Promise((resolve) => {
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d", {willReadFrequently: true});
            if (!context) {
                resolve(null);
                return;
            }
            canvas.width = 32;
            canvas.height = 32;
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
            const buckets = new Map<string, {count: number; color: [number, number, number]}>();

            for (let index = 0; index < pixels.length; index += 4) {
                const alpha = pixels[index + 3];
                if (alpha < 180) continue;
                const red = pixels[index];
                const green = pixels[index + 1];
                const blue = pixels[index + 2];
                const brightness = (red + green + blue) / 3;
                const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
                if (brightness < 25 || brightness > 235 || spread < 18) continue;
                const color: [number, number, number] = [
                    Math.round(red / 16) * 16,
                    Math.round(green / 16) * 16,
                    Math.round(blue / 16) * 16,
                ];
                const key = color.join(",");
                const bucket = buckets.get(key);
                if (bucket) bucket.count += 1;
                else buckets.set(key, {count: 1, color});
            }

            const winner = [...buckets.values()].sort((a, b) => b.count - a.count)[0];
            if (!winner) {
                resolve(null);
                return;
            }
            const [red, green, blue] = winner.color;
            resolve(`#${[red, green, blue].map((value) => value.toString(16).padStart(2, "0")).join("")}`);
        };
        image.onerror = () => resolve(null);
        image.src = imageUrl;
    });
}

export function AlbumDetail({album}: { album: AlbumSummary }) {
    const {closeAlbum, openArtist} = useNav();
    const player = usePlayer();
    const {favorites, removeTracks, toggleFavorite} = useLibrary();
    const [isCoverOpen, setIsCoverOpen] = useState(false);
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const [carouselIndex, setCarouselIndex] = useState(0);
    const [pdfs, setPdfs] = useState<{name: string; url: string}[]>([]);
    const [pdfError, setPdfError] = useState<string | null>(null);
    const coverUrl = useCoverUrl(album.coverId);
    const [coverAccent, setCoverAccent] = useState<{url: string; color: string} | null>(null);

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
    const genres = Array.from(
        new Set(album.tracks.flatMap((track) => genresOf(track.genre))),
    );
    const audioDetails = [
        bitDepthTrack?.bitDepth != null
            ? formatBitDepth(bitDepthTrack.bitDepth)
            : null,
        sampleRateTrack?.sampleRate != null
            ? formatSampleRate(sampleRateTrack.sampleRate)
            : null,
    ].filter((value): value is string => Boolean(value));
    const isHiRes = album.tracks.some(
        (track) =>
            (track.bitDepth != null && track.bitDepth > 24) ||
            (track.sampleRate != null && track.sampleRate > 44100),
    );
    const coverIds = useMemo(
        () =>
            [...new Set(album.tracks.map((track) => track.coverId).filter(
                (coverId): coverId is string => Boolean(coverId),
            ))],
        [album.tracks],
    );
    const firstPath = album.tracks.find((track) => track.origin.kind === "path")?.origin;
    const mediaCount = coverIds.length + pdfs.length;
    const isAlbumFavorite = favorites.has(albumFavoriteKey(album.key));

    useEffect(() => {
        let cancelled = false;
        if (!firstPath || firstPath.kind !== "path") return;

        const loadPdfs = async () => {
            try {
                const {readDir, readFile} = await import("@tauri-apps/plugin-fs");
                const separator = firstPath.path.includes("\\") ? "\\" : "/";
                const directory = firstPath.path.slice(
                    0,
                    Math.max(firstPath.path.lastIndexOf("/"), firstPath.path.lastIndexOf("\\")),
                );
                const entries = await readDir(directory);
                const files = entries.filter(
                    (entry) => entry.isFile && entry.name?.toLowerCase().endsWith(".pdf"),
                );
                const loaded = await Promise.all(
                    files.map(async (entry) => {
                        if (!entry.name) return null;
                        const bytes = await readFile(`${directory}${separator}${entry.name}`);
                        return {
                            name: entry.name,
                            url: URL.createObjectURL(new Blob([bytes], {type: "application/pdf"})),
                        };
                    }),
                );
                if (cancelled) {
                    loaded.forEach((file) => file && URL.revokeObjectURL(file.url));
                    return;
                }
                setPdfs(loaded.filter((file): file is {name: string; url: string} => Boolean(file)));
            } catch (error) {
                if (!cancelled) {
                    setPdfError(error instanceof Error ? "无法读取音频目录中的 PDF 文件" : "当前环境不支持 PDF 读取");
                }
            }
        };
        void loadPdfs();
        return () => {
            cancelled = true;
        };
    }, [firstPath]);

    useEffect(() => {
        return () => pdfs.forEach((pdf) => URL.revokeObjectURL(pdf.url));
    }, [pdfs]);

    const safeCarouselIndex = mediaCount > 0
        ? Math.min(carouselIndex, mediaCount - 1)
        : 0;
    const selectedCoverId = coverIds[safeCarouselIndex] ?? null;
    const selectedPdf = pdfs[safeCarouselIndex - coverIds.length];

    useEffect(() => {
        let cancelled = false;
        if (!coverUrl) return;
        void dominantColorOf(coverUrl).then((color) => {
            if (!cancelled && color) setCoverAccent({url: coverUrl, color});
        });
        return () => {
            cancelled = true;
        };
    }, [coverUrl]);

    return (
        <div
            className="flex flex-col gap-3"
            style={
                coverAccent?.url === coverUrl
                    ? {"--app-accent": coverAccent.color} as CSSProperties
                    : undefined
            }
        >
            <button
                type="button"
                onClick={closeAlbum}
                className="flex w-fit items-center gap-2 text-xs leading-4 text-zinc-500 transition hover:text-zinc-800"
            >
                <IconArrowLeft className="h-3.5 w-3.5"/>
                返回专辑列表
            </button>

            <div
                className="grid items-stretch gap-6 lg:h-[calc(100dvh-11rem)] lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.6fr)]">
                <div className="flex h-full min-w-0 flex-col gap-4">
                    <div className="relative w-full max-w-sm self-center">
                        <Dialog open={isCoverOpen} onOpenChange={setIsCoverOpen}>
                            <button
                                type="button"
                                onClick={() => {
                                    setCarouselIndex(0);
                                    setIsCoverOpen(true);
                                }}
                                aria-label={`放大查看专辑封面：${album.album}`}
                                className="cover-shimmer relative block w-full cursor-zoom-in rounded-2xl text-left outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                                <CoverArt
                                    coverId={album.coverId}
                                    label={album.album}
                                    className="aspect-square w-full rounded-2xl shadow-2xl shadow-zinc-900/20"
                                    labelClassName="text-5xl"
                                />
                            </button>
                            <DialogContent
                                className="w-auto! max-w-[95vw]! overflow-visible bg-transparent p-0 shadow-none"
                                showCloseButton
                            >
                                <DialogTitle className="sr-only">
                                    {album.album} 专辑封面
                                </DialogTitle>
                                <div className="flex min-h-0 flex-col items-center gap-3">
                                    {selectedPdf ? (
                                        <iframe
                                            title={selectedPdf.name}
                                            src={`${selectedPdf.url}#view=FitH`}
                                            className="size-[min(70vw,70vh)] min-w-0 max-w-full overflow-hidden rounded-lg bg-white"
                                        />
                                    ) : (
                                        <ImageZoom
                                            className="size-[min(70vw,70vh)] rounded-xl"
                                            aria-label="缩放查看专辑封面"
                                        >
                                            <CoverArt
                                                coverId={selectedCoverId ?? album.coverId}
                                                label={album.album}
                                                className="size-full rounded-xl object-contain"
                                                labelClassName="text-7xl"
                                            />
                                        </ImageZoom>
                                    )}
                                    {mediaCount > 1 ? (
                                        <div className="flex items-center gap-3">
                                            <button
                                                type="button"
                                                aria-label="上一个预览"
                                                onClick={() => setCarouselIndex((index) => (index - 1 + mediaCount) % mediaCount)}
                                                className="rounded-full p-2 text-white transition hover:bg-white/15 disabled:opacity-40"
                                                disabled={mediaCount < 2}
                                            >
                                                <IconChevronLeft/>
                                            </button>
                                            <span className="text-xs text-white/80">
                                                {safeCarouselIndex + 1} / {mediaCount}
                                            </span>
                                            <button
                                                type="button"
                                                aria-label="下一个预览"
                                                onClick={() => setCarouselIndex((index) => (index + 1) % mediaCount)}
                                                className="rounded-full p-2 text-white transition hover:bg-white/15 disabled:opacity-40"
                                                disabled={mediaCount < 2}
                                            >
                                                <IconChevronRight/>
                                            </button>
                                        </div>
                                    ) : null}
                                    {mediaCount === 0 && pdfError ? (
                                        <p className="text-xs text-white/80">{pdfError}</p>
                                    ) : null}
                                </div>
                            </DialogContent>
                        </Dialog>
                        <Dialog open={isInfoOpen} onOpenChange={setIsInfoOpen}>
                            <DialogContent>
                                <DialogTitle>{album.album}</DialogTitle>
                                <DialogDescription>
                                    {album.albumArtist}
                                </DialogDescription>
                                <div className="flex flex-col gap-2 text-sm text-zinc-600">
                                    <p>{releaseDate || "发行日期未知"} · {album.tracks.length} 首曲目</p>
                                    <p>{formatTotalDuration(album.duration)}</p>
                                    {audioDetails.length > 0 ? (
                                        <p>{audioDetails.join(" / ")}</p>
                                    ) : null}
                                    {genres.length > 0 ? <p>{genres.join(" · ")}</p> : null}
                                </div>
                            </DialogContent>
                        </Dialog>
                        {genres.length > 0 ? (
                            <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap gap-1.5">
                                {genres.map((genre) => (
                                    <span
                                        key={genre}
                                        className="rounded bg-black/65 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm"
                                    >
                                        {genre}
                                    </span>
                                ))}
                            </div>
                        ) : null}
                    </div>
                    <div className="min-w-0">
                        <MarqueeText
                            as="h1"
                            className="mt-1 text-left text-2xl font-semibold text-zinc-900 sm:text-3xl"
                            title={album.album}
                        >
                            {album.album}
                        </MarqueeText>
                        <AnimatedAvatarGroup
                            artists={splitArtists(album.albumArtist)}
                            onArtistClick={openArtist}
                            className="mt-1"
                        />
                        <div className="mt-1 flex items-center justify-start gap-1">
                            <button
                                type="button"
                                aria-label={isAlbumFavorite ? "取消收藏专辑" : "收藏专辑"}
                                aria-pressed={isAlbumFavorite}
                                onClick={() => {
                                    toggleFavorite(albumFavoriteKey(album.key));
                                }}
                                className={`rounded-full p-2 transition hover:bg-zinc-950/5 ${
                                    isAlbumFavorite ? "text-rose-500" : "text-zinc-500"
                                }`}
                            >
                                <IconHeart className="h-4 w-4" fill={isAlbumFavorite ? "currentColor" : "none"} />
                            </button>
                            <button
                                type="button"
                                aria-label="将专辑加入队列"
                                onClick={() => {
                                    for (const track of album.tracks) player.addToQueue(track);
                                }}
                                className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-950/5 hover:text-zinc-800"
                            >
                                <IconPlaylistAdd className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                aria-label="下载"
                                className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-950/5 hover:text-zinc-800"
                            >
                                <IconDownload className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                aria-label="查看专辑信息"
                                onClick={() => setIsInfoOpen(true)}
                                className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-950/5 hover:text-zinc-800"
                            >
                                <IconInfoCircle className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                    <div className="flex flex-col items-start gap-1 text-left text-xs text-zinc-500">
                        {audioDetails.length > 0 ? (
                            <p className="flex items-center justify-start gap-2">
                                {isHiRes ? (
                                    <img
                                        src="/hi-res.png"
                                        alt="高解析度音频"
                                        title="高解析度音频"
                                        className="h-5 w-auto"
                                    />
                                ) : null}
                                <span className="text-sm leading-5">
                                    {audioDetails.join(" / ")}
                                </span>
                            </p>
                        ) : null}
                        <p className="flex flex-wrap items-center justify-start gap-x-2">
                            {releaseDate ? <span>{releaseDate}</span> : null}
                            {releaseDate ? <span>·</span> : null}
                            <span>{album.tracks.length} 首曲目</span>
                            <span>·</span>
                            <span>{formatTotalDuration(album.duration)}</span>
                        </p>
                        {album.copyright ? (
                            <p className="min-w-0 w-full truncate px-1 text-xs text-zinc-500" title={album.copyright}>
                                {album.copyright}
                            </p>
                        ) : null}
                    </div>
                </div>

                <div className="flex min-w-0 flex-col gap-2">
                    <div
                        className="min-w-0 overflow-y-auto rounded-2xl border border-zinc-200 bg-white/70 p-3 lg:max-h-[calc(100dvh-11rem)]">
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
                                                    <header
                                                        className="flex items-baseline justify-between gap-3 border-b border-zinc-200 bg-zinc-950/3 px-4 py-2.5">
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
                                                                    {" "}· {section.composer}
                                                                </span>
                                                            ) : null}
                                                        </h2>
                                                        <span
                                                            className="shrink-0 text-xs tabular-nums text-zinc-500">
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
        </div>
    );
}
