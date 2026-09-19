/** 曲库的纯函数工具：专辑归组、艺术家拆分归组、排序、搜索、封面键。 */

import {
  UNKNOWN_ALBUM,
  UNKNOWN_ARTIST,
  type AlbumSummary,
  type Track,
} from "./types";

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

export type AlbumSort = "artist" | "album" | "year" | "tracks" | "added";

export const ALBUM_SORT_LABELS: Record<AlbumSort, string> = {
  artist: "艺术家",
  album: "专辑名",
  year: "年份",
  tracks: "曲目数",
  added: "最近添加",
};

export const ALBUM_SORT_DEFAULT_DIR: Record<AlbumSort, SortDir> = {
  artist: "asc",
  album: "asc",
  year: "asc",
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
  /\s*(?:;|；|、|×)\s*|\s+\/\s+|\s+(?:feat\.?|ft\.?|featuring|with|vs\.?)\s+/i;

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
  return a.localeCompare(b, "zh-Hans-CN", { numeric: true, sensitivity: "base" });
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
      key,
      album: first.album,
      albumArtist: first.albumArtist,
      year: sorted.reduce<number | null>(
        (acc, track) => acc ?? track.year,
        null,
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
    const yearA = a.year ?? Number.MAX_SAFE_INTEGER;
    const yearB = b.year ?? Number.MAX_SAFE_INTEGER;
    if (yearA !== yearB) return yearA - yearB;
    return compareText(a.album, b.album);
  });
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
    let result = 0;
    switch (sort) {
      case "album":
        result =
          compareText(a.album, b.album) ||
          compareText(a.albumArtist, b.albumArtist);
        break;
      case "year": {
        const yearA = a.year ?? Number.MAX_SAFE_INTEGER;
        const yearB = b.year ?? Number.MAX_SAFE_INTEGER;
        result = yearA - yearB || compareText(a.album, b.album);
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
