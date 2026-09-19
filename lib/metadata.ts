/**
 * 用 music-metadata 在本地解析音频标签（标题/艺术家/专辑/封面等）。
 *
 * music-metadata 只在用户真正扫描时才按需加载，避免拖慢首屏。
 */

import { UNKNOWN_ALBUM, UNKNOWN_ARTIST } from "./types";

export interface ParsedAudio {
  title: string;
  artist: string;
  albumArtist: string;
  album: string;
  genre: string;
  year: number | null;
  trackNo: number | null;
  discNo: number | null;
  duration: number;
  bitrate: number | null;
  sampleRate: number | null;
  codec: string;
  lossless: boolean;
  cover: Blob | null;
}

export interface ParseOptions {
  /**
   * 强制完整读取以获得精确时长（部分 mp3 缺少 VBR 头）。
   * 关闭后读取更快，但个别文件时长为 0。
   */
  preciseDuration?: boolean;
}

function cleanText(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function titleFromFileName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^./\\]+$/, "");
  const normalized = withoutExtension.replace(/_+/g, " ").trim();
  return normalized || fileName;
}

function toBlob(data: Uint8Array, mimeType: string): Blob {
  // 拷贝成独立缓冲，避免 Blob 引用到解析器内部的共享内存。
  const copy = Uint8Array.from(data);
  return new Blob([copy.buffer], { type: mimeType });
}

/** 合并多值艺术家标签为单个字符串；值为空时返回空串，由调用方回退。 */
function joinArtists(values: string[] | undefined): string {
  const cleaned = (values ?? []).map(cleanText).filter(Boolean);
  return cleaned.join("; ");
}

export async function parseAudioFile(
  file: File | Blob,
  fileName: string,
  options: ParseOptions = {},
): Promise<ParsedAudio> {
  const { preciseDuration = true } = options;
  const { parseBlob } = await import("music-metadata");
  const metadata = await parseBlob(file, { duration: preciseDuration });

  const common = metadata.common;
  const format = metadata.format;

  const title = cleanText(common.title) || titleFromFileName(fileName);
  // 多值标签（ID3v2.4 等）时 music-metadata 会给出数组；用「; 」合并保存，
  // 展示层再按分隔符拆分成独立艺术家，避免与名字本身可能含有的「/」混淆。
  const artist =
    joinArtists(common.artists) ||
    cleanText(common.artist) ||
    cleanText(common.albumartist) ||
    UNKNOWN_ARTIST;
  const albumArtist =
    joinArtists(common.albumartists) ||
    cleanText(common.albumartist) ||
    artist;
  const album = cleanText(common.album) || UNKNOWN_ALBUM;
  const genre = common.genre?.length ? cleanText(common.genre[0]) : "";
  const year = typeof common.year === "number" ? common.year : null;
  const trackNo = typeof common.track?.no === "number" ? common.track.no : null;
  const discNo = typeof common.disk?.no === "number" ? common.disk.no : null;
  const duration =
    typeof format.duration === "number" && Number.isFinite(format.duration)
      ? format.duration
      : 0;
  const picture = common.picture?.[0];

  return {
    title,
    artist,
    albumArtist,
    album,
    genre,
    year,
    trackNo,
    discNo,
    duration,
    bitrate: format.bitrate ?? null,
    sampleRate: format.sampleRate ?? null,
    codec: cleanText(format.codec) || cleanText(format.container),
    lossless: format.lossless ?? false,
    cover: picture ? toBlob(picture.data, picture.format) : null,
  };
}