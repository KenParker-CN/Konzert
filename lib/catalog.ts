/** 曲库的纯函数工具：专辑归组、排序、搜索、封面键。 */

import {
  UNKNOWN_ALBUM,
  UNKNOWN_ARTIST,
  type AlbumSummary,
  type Track,
} from "./types";

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

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ");
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

export function sortTracks(tracks: Track[], sort: TrackSort): Track[] {
  const sorted = [...tracks];
  switch (sort) {
    case "title":
      sorted.sort((a, b) => compareText(a.title, b.title));
      break;
    case "artist":
      sorted.sort(
        (a, b) =>
          compareText(a.artist, b.artist) || compareText(a.album, b.album),
      );
      break;
    case "album":
      sorted.sort((a, b) => {
        const byAlbum = compareText(a.album, b.album);
        if (byAlbum !== 0) return byAlbum;
        const discA = a.discNo ?? 1;
        const discB = b.discNo ?? 1;
        if (discA !== discB) return discA - discB;
        const trackA = a.trackNo ?? Number.MAX_SAFE_INTEGER;
        const trackB = b.trackNo ?? Number.MAX_SAFE_INTEGER;
        return trackA - trackB;
      });
      break;
    case "duration":
      sorted.sort((a, b) => b.duration - a.duration);
      break;
    case "added":
    default:
      sorted.sort((a, b) => b.addedAt - a.addedAt);
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
export function uniqueArtists(tracks: Track[]): string[] {
  const artists = new Set<string>();
  for (const track of tracks) artists.add(track.artist);
  return [...artists].sort(compareText);
}
