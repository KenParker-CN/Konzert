/** 曲库的纯函数工具：专辑归组、艺术家拆分归组、排序、搜索、封面键。 */

import {type AlbumSummary, ReleaseInfo, type Track, UNKNOWN_ALBUM, UNKNOWN_ARTIST,} from "./types";

/** 排序方向。 */
export type SortDir = "asc" | "desc";

export type TrackSort =
    | "added"
    | "title"
    | "artist"
    | "album"
    | "duration";

export const TRACK_SORT_LABELS: Record<TrackSort, string> = {
    added: "最近添加",
    title: "标题",
    artist: "艺术家",
    album: "专辑",
    duration: "时长",
};

/** 各排序键的默认方向；切换排序键时重置为该方向。 */
export const TRACK_SORT_DEFAULT_DIR: Record<TrackSort, SortDir> = {
    added: "desc",
    title: "asc",
    artist: "asc",
    album: "asc",
    duration: "desc",
};

export type AlbumSort = "artist" | "album" | "date" | "tracks" | "added";

export const ALBUM_SORT_LABELS: Record<AlbumSort, string> = {
    artist: "艺术家",
    album: "专辑名",
    date: "日期",
    tracks: "曲目数",
    added: "最近添加",
};

export const ALBUM_SORT_DEFAULT_DIR: Record<AlbumSort, SortDir> = {
    artist: "asc",
    album: "asc",
    date: "asc",
    tracks: "desc",
    added: "desc",
};

export type ArtistSort = "name" | "tracks" | "duration";

export const ARTIST_SORT_LABELS: Record<ArtistSort, string> = {
    name: "名称",
    tracks: "曲目数",
    duration: "时长",
};

export const ARTIST_SORT_DEFAULT_DIR: Record<ArtistSort, SortDir> = {
    name: "asc",
    tracks: "desc",
    duration: "desc",
};

function normalize(value: string): string {
    return value.trim().replace(/\s+/g, " ");
}

/**
 * 拆分多艺术家字符串为独立艺术家名。
 *
 * 兼容常见写法：「A; B」「A、B」「A / B」（music-metadata 合并多值标签的默认写法）
 * 以及「A feat. B」「A ft. B」「A featuring B」「A with B」「A vs. B」「A × B」。
 * 不拆分无空格的「A/B」「A&B」，避免误拆 AC/DC、Simon & Garfunkel 这类名字本身
 * 含分隔符的艺人。
 */
const ARTIST_SPLIT_PATTERN =
    /\s*[/,;&×]\s*|\s+\/\s+|\s+(?:feat\.?|ft\.?|featuring|with|vs\.?)\s+/i;

export function splitArtists(value: string): string[] {
    const trimmed = normalize(value);
    if (!trimmed) return [];
    const parts = trimmed
        .split(ARTIST_SPLIT_PATTERN)
        .map((part) => part.trim())
        .filter(Boolean);
    return parts.length > 0 ? parts : [trimmed];
}

/** 曲目的参与艺术家列表（拆分后），至少包含一个名字。 */
export function artistNamesOf(track: Track): string[] {
    const names = splitArtists(track.artist);
    return names.length > 0 ? names : [UNKNOWN_ARTIST];
}

export function albumKeyOf(track: Track): string {
    return `${normalize(track.albumArtist).toLowerCase()}||${normalize(
        track.album,
    ).toLowerCase()}`;
}

/**
 * 同一张专辑共用一张封面；没有专辑信息时退化为「一曲一封面」。
 */
export function coverIdFor(track: Track, albumKey: string): string {
    return track.album === UNKNOWN_ALBUM
        ? `cover:${track.id}`
        : `cover:${albumKey}`;
}

function compareText(a: string, b: string): number {
    return a.localeCompare(b, "zh-Hans-CN", {numeric: true, sensitivity: "base"});
}

/** 专辑内的曲目顺序：碟号 → 音轨号 → 标题。 */
export function sortAlbumTracks(tracks: Track[]): Track[] {
    return [...tracks].sort((a, b) => {
        const discA = a.discNo ?? 1;
        const discB = b.discNo ?? 1;
        if (discA !== discB) return discA - discB;
        const trackA = a.trackNo ?? Number.MAX_SAFE_INTEGER;
        const trackB = b.trackNo ?? Number.MAX_SAFE_INTEGER;
        if (trackA !== trackB) return trackA - trackB;
        return compareText(a.title, b.title);
    });
}

export function groupAlbums(tracks: Track[]): AlbumSummary[] {
    const groups = new Map<string, Track[]>();
    for (const track of tracks) {
        const key = albumKeyOf(track);
        const bucket = groups.get(key);
        if (bucket) bucket.push(track);
        else groups.set(key, [track]);
    }

    const albums: AlbumSummary[] = [];
    for (const [key, bucket] of groups) {
        const sorted = sortAlbumTracks(bucket);
        const first = sorted[0];
        const coverId =
            sorted.find((track) => track.coverId)?.coverId ?? null;
        albums.push({
            copyright:
                sorted.find((track) => track.copyright?.trim())?.copyright?.trim() ?? "",
            key,
            album: first.album,
            albumArtist: first.albumArtist,
            releaseDate: sorted.reduce<ReleaseInfo>(
                (acc, track) => betterReleaseInfo(acc, track.releaseDate),
                {display: null, year: null, sortValue: 0},
            ),
            coverId,
            tracks: sorted,
            duration: sorted.reduce(
                (total, track) => total + (track.duration || 0),
                0,
            ),
        });
    }

    return albums.sort((a, b) => {
        if (a.albumArtist === UNKNOWN_ARTIST && b.albumArtist !== UNKNOWN_ARTIST) return 1;
        if (b.albumArtist === UNKNOWN_ARTIST && a.albumArtist !== UNKNOWN_ARTIST) return -1;
        const byArtist = compareText(a.albumArtist, b.albumArtist);
        if (byArtist !== 0) return byArtist;
        if (a.releaseDate.sortValue !== b.releaseDate.sortValue) {
            return a.releaseDate.sortValue - b.releaseDate.sortValue;
        }
        return compareText(a.album, b.album);
    });

    function betterReleaseInfo(current: ReleaseInfo, next?: ReleaseInfo): ReleaseInfo {
        // 排序上：哪个信息更完整/更早，就用哪个。
        if (!next || next.sortValue === 0) return current;
        if (current.sortValue === 0) return next;

        if (next.sortValue < current.sortValue) return next;
        if (current.sortValue < next.sortValue) return current;

        // 同一天，则谁有 display 优先保留 display。
        if (next.display && !current.display) return next;
        if (current.display && !next.display) return current;
        return current;
    }
}

/** 专辑的入库时间：取专辑内曲目的最新 addedAt。 */
export function albumAddedAt(album: AlbumSummary): number {
    return album.tracks.reduce((max, track) => Math.max(max, track.addedAt), 0);
}

/** 专辑列表排序；dir 缺省时使用该排序键的默认方向。 */
export function sortAlbums(
    albums: AlbumSummary[],
    sort: AlbumSort = "artist",
    dir: SortDir = ALBUM_SORT_DEFAULT_DIR[sort],
): AlbumSummary[] {
    const sign = dir === "desc" ? -1 : 1;
    const sorted = [...albums];
    sorted.sort((a, b) => {
        let result: number;
        switch (sort) {
            case "album":
                result =
                    compareText(a.album, b.album) ||
                    compareText(a.albumArtist, b.albumArtist);
                break;
            case "date": {
                const dateA = a.releaseDate.sortValue ?? Number.MAX_SAFE_INTEGER;
                const dateB = b.releaseDate.sortValue ?? Number.MAX_SAFE_INTEGER;
                result = dateA - dateB || compareText(a.album, b.album);
                break;
            }
            case "tracks":
                result =
                    a.tracks.length - b.tracks.length || compareText(a.album, b.album);
                break;
            case "added":
                result =
                    albumAddedAt(a) - albumAddedAt(b) || compareText(a.album, b.album);
                break;
            case "artist":
            default:
                // 「未知艺术家」始终排在末尾（翻转方向时排最前）。
                if (a.albumArtist === UNKNOWN_ARTIST && b.albumArtist !== UNKNOWN_ARTIST) {
                    result = 1;
                } else if (
                    b.albumArtist === UNKNOWN_ARTIST &&
                    a.albumArtist !== UNKNOWN_ARTIST
                ) {
                    result = -1;
                } else {
                    result =
                        compareText(a.albumArtist, b.albumArtist) ||
                        compareText(a.album, b.album);
                }
                break;
        }
        return sign * result;
    });
    return sorted;
}

export interface ArtistSummary {
    name: string;
    tracks: Track[];
    duration: number;
}

/**
 * 按拆分后的艺术家归组曲目：一首「A feat. B」会同时出现在 A 与 B 名下。
 * 同名（忽略大小写）合并为一组，保留首次出现的写法。
 */
export function groupArtists(tracks: Track[]): ArtistSummary[] {
    const groups = new Map<string, ArtistSummary>();
    for (const track of tracks) {
        for (const name of artistNamesOf(track)) {
            const key = name.toLowerCase();
            const group = groups.get(key);
            if (group) {
                group.tracks.push(track);
                group.duration += track.duration || 0;
            } else {
                groups.set(key, {
                    name,
                    tracks: [track],
                    duration: track.duration || 0,
                });
            }
        }
    }
    return [...groups.values()].sort((a, b) => compareText(a.name, b.name));
}

/** 艺术家分组排序；dir 缺省时使用该排序键的默认方向。 */
export function sortArtists(
    artists: ArtistSummary[],
    sort: ArtistSort = "name",
    dir: SortDir = ARTIST_SORT_DEFAULT_DIR[sort],
): ArtistSummary[] {
    const sign = dir === "desc" ? -1 : 1;
    const sorted = [...artists];
    sorted.sort((a, b) => {
        switch (sort) {
            case "tracks":
                return (
                    sign *
                    (a.tracks.length - b.tracks.length || compareText(a.name, b.name))
                );
            case "duration":
                return sign * (a.duration - b.duration || compareText(a.name, b.name));
            case "name":
            default:
                return sign * compareText(a.name, b.name);
        }
    });
    return sorted;
}

export function sortTracks(
    tracks: Track[],
    sort: TrackSort = "added",
    dir: SortDir = TRACK_SORT_DEFAULT_DIR[sort],
): Track[] {
    const sign = dir === "desc" ? -1 : 1;
    const sorted = [...tracks];
    switch (sort) {
        case "title":
            sorted.sort((a, b) => sign * compareText(a.title, b.title));
            break;
        case "artist":
            sorted.sort(
                (a, b) =>
                    sign *
                    (compareText(
                        artistNamesOf(a)[0] ?? a.artist,
                        artistNamesOf(b)[0] ?? b.artist,
                    ) || compareText(a.album, b.album)),
            );
            break;
        case "album":
            sorted.sort((a, b) => {
                const byAlbum = compareText(a.album, b.album);
                if (byAlbum !== 0) return sign * byAlbum;
                const discA = a.discNo ?? 1;
                const discB = b.discNo ?? 1;
                if (discA !== discB) return sign * (discA - discB);
                const trackA = a.trackNo ?? Number.MAX_SAFE_INTEGER;
                const trackB = b.trackNo ?? Number.MAX_SAFE_INTEGER;
                return sign * (trackA - trackB);
            });
            break;
        case "duration":
            sorted.sort((a, b) => sign * (a.duration - b.duration));
            break;
        case "added":
        default:
            sorted.sort((a, b) => sign * (a.addedAt - b.addedAt));
            break;
    }
    return sorted;
}

/** 在标题 / 艺术家 / 专辑 / 流派 / 文件名上做不区分大小写的包含匹配。 */
export function searchTracks(tracks: Track[], query: string): Track[] {
    const needle = query.trim().toLowerCase();
    if (!needle) return tracks;
    return tracks.filter((track) =>
        [track.title, track.artist, track.album, track.genre, track.fileName].some(
            (field) => field.toLowerCase().includes(needle),
        ),
    );
}

export interface WorkSection {
    /** 分组内稳定键；未参与分组的曲目使用曲目 id。 */
    key: string;
    /** 作品名（首个冒号前的内容）；null 表示未参与分组的普通曲目。 */
    work: string | null;
    /** 作品作曲家（组内曲目标签去重合并）；无标签时为空串。 */
    composer: string;
    tracks: Track[];
    duration: number;
}

export interface DiscSection {
    discNo: number;
    tracks: Track[];
}

/** 按碟号分组，组内保持专辑曲目顺序。 */
export function groupTracksByDisc(tracks: Track[]): DiscSection[] {
    const groups = new Map<number, Track[]>();
    for (const track of tracks) {
        const discNo = track.discNo ?? 1;
        const group = groups.get(discNo);
        if (group) group.push(track);
        else groups.set(discNo, [track]);
    }
    return [...groups.entries()]
        .sort(([a], [b]) => a - b)
        .map(([discNo, discTracks]) => ({discNo, tracks: discTracks}));
}

/**
 * 找到作品名与乐章名之间的分隔符。
 *
 * 目录号中的冒号可能属于目录号本身，例如 `TWV 51:G9`；
 * 识别目录号后，从目录号末尾继续寻找作品/乐章分隔符。
 */
const CATALOG_NUMBER_PATTERNS = [
    /*Telemann's*/
    {system: "TWV", pattern: /\bTWV\s+\d+:[A-Z]?\d+/i},
    /*Bach's*/
    {system: "BWV", pattern: /\bBWV\s+\d+[A-Z]?/i},
    /*Vivaldi's*/
    {system: "RV", pattern: /\bRV\s+\d+[A-Z]?/i},
    /*Handel's*/
    {system: "HWV", pattern: /\bHWV\s+\d+[A-Z]?/i},
    /*Mozart's*/
    {system: "K", pattern: /\b(?:K|K\.|KV)\s*\d+[A-Z]?/i},
    /*CPE Bach's*/
    {system: "Wq.", pattern: /\bWq\.\s*\d+(?:\/\d+)?\b/i,},
    {system: "H.", pattern: /\bH\.\s*\d+\b/i,},
    /*Buxtehude's*/
    {system: "BuxWV", pattern: /\bBuxWV\s+\d+[A-Z]?/i},
    /*Haydn's*/
    {system: "Hob.", pattern: /\bHob\.\s*[IVXLCDM]+[a-z]?:\d+\b/i},
    /*Tartini's*/
    {system: "D.", pattern: /\bD\.\s*\d+\b/i,},
    /*Graupner's*/
    {system: "GWV", pattern: /\bGWV\s+\d+[A-Z]?/i},



] as const;

export interface CatalogReference {
    system: string;
    number: string;
    display: string;
    index: number;
}

export function catalogReferencesOf(title: string): CatalogReference[] {
    const matches: Array<{
        system: string;
        match: RegExpMatchArray;
    }> = [];
    for (const {system, pattern} of CATALOG_NUMBER_PATTERNS) {
        for (const match of title.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))) {
            matches.push({system, match});
        }
    }
    matches.sort((a, b) => (a.match.index ?? 0) - (b.match.index ?? 0));

    const references: CatalogReference[] = [];
    for (const {system, match} of matches) {
        const index = match.index;
        if (index == null) continue;
        const previous = references[references.length - 1];
        if (
            previous &&
            !/^[\s,;]+$/.test(
                title.slice(previous.index + previous.display.length, index),
            )
        ) {
            break;
        }
        const display = match[0].trim();
        const number = display
            .replace(
                system === "K" ? /^(?:K\.|KV)\s*/i : new RegExp(`^${system}\\s*`, "i"),
                "",
            )
            .trim();
        references.push({system, number, display, index});
    }
    return references;
}

export function catalogReferenceOf(title: string): CatalogReference | null {
    return catalogReferencesOf(title)[0] ?? null;
}

export function catalogNumberOf(title: string): string | null {
    return catalogReferenceOf(title)?.display ?? null;
}

function workSeparatorIndex(title: string): number {
    const catalogNumbers = catalogReferencesOf(title);
    if (catalogNumbers.length > 0) {
        const lastCatalogNumber = catalogNumbers[catalogNumbers.length - 1];
        const catalogEnd =
            lastCatalogNumber.index + lastCatalogNumber.display.length;
        const separatorAfterCatalog = title
            .slice(catalogEnd)
            .search(/[:：]/);
        if (separatorAfterCatalog >= 0) {
            return catalogEnd + separatorAfterCatalog;
        }
        return -1;
    }
    return title.search(/[:：]/);
}

/** 作品前缀：标题作品/乐章分隔符之前的内容；无冒号或冒号在开头时为 null。 */
export function workKeyOf(title: string): string | null {
    const trimmed = title.trim();
    if (!trimmed) return null;
    const index = workSeparatorIndex(trimmed);
    if (index <= 0) return null;
    return trimmed.slice(0, index).trim().toLowerCase();
}

/** 作品显示名：保留首次出现时的原文写法。 */
export function workTitleOf(title: string): string {
    const trimmed = title.trim();
    const index = workSeparatorIndex(trimmed);
    return index > 0 ? trimmed.slice(0, index).trim() : trimmed;
}

/**
 * 乐章显示名：标题首个冒号之后的内容（作品分组内使用，避免重复作品名）；
 * 无冒号或冒号后为空时返回原题。
 */
export function movementTitleOf(title: string): string {
    const trimmed = title.trim();
    const index = workSeparatorIndex(trimmed);
    if (index < 0) return trimmed;
    const rest = trimmed.slice(index + 1).trim();
    return rest || trimmed;
}

/**
 * Stable identity for grouping tracks into works.
 *
 * Composer metadata is intentionally read from the track itself. Album artist
 * metadata is not a substitute because one album may contain works by several
 * composers.
 */
export function workIdentityKeyOf(track: Track): string | null {
    const composer = normalize(track.composer).toLowerCase();
    const catalogs = catalogReferencesOf(track.title);
    if (composer && catalogs.length > 0) {
        return `composer:${composer}|catalog:${catalogs
            .map((catalog) => `${catalog.system.toLowerCase()}:${catalog.number.toLowerCase()}`)
            .join("|")}`;
    }

    const titleKey = workKeyOf(track.title);
    if (!titleKey) return null;
    return composer ? `composer:${composer}|title:${titleKey}` : titleKey;
}

/** 组内作曲家：按曲目顺序去重合并（忽略大小写），无标签时返回空串。 */
function composersOf(tracks: Track[]): string {
    const seen = new Set<string>();
    const parts: string[] = [];
    for (const track of tracks) {
        const value = track.composer.trim();
        if (!value) continue;
        const key = value.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        parts.push(value);
    }
    return parts.join("; ");
}

/**
 * 古典作品分组：曲目标题第一个冒号之前内容相同的曲目归为一组
 * （如「第五交响曲: 第一乐章」系列），归组至少需要两首曲目；
 * 未参与分组的曲目保持原位置普通显示。顺序按首次出现位置，段内保持专辑曲目顺序。
 */
export function groupWorks(tracks: Track[]): WorkSection[] {
    const counts = new Map<string, number>();
    for (const track of tracks) {
        const key = workIdentityKeyOf(track);
        if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const sections: WorkSection[] = [];
    const sectionByKey = new Map<string, WorkSection>();
    for (const track of tracks) {
        const key = workIdentityKeyOf(track);
        const shared = key !== null && (counts.get(key) ?? 0) >= 2;
        if (!shared) {
            sections.push({
                key: `single:${track.id}`,
                work: null,
                composer: "",
                tracks: [track],
                duration: track.duration || 0,
            });
            continue;
        }
        let section = sectionByKey.get(key);
        if (!section) {
            section = {
                key: `work:${key}`,
                work: workTitleOf(track.title),
                composer: "",
                tracks: [],
                duration: 0,
            };
            sectionByKey.set(key, section);
            sections.push(section);
        }
        section.tracks.push(track);
        section.duration += track.duration || 0;
        section.composer = composersOf(section.tracks);
    }
    return sections;
}
