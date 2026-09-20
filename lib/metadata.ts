/**
 * 用 music-metadata 在本地解析音频标签（标题/艺术家/专辑/封面等）。
 *
 * music-metadata 只在用户真正扫描时才按需加载，避免拖慢首屏。
 */

import {ReleaseInfo, UNKNOWN_ALBUM, UNKNOWN_ARTIST} from "./types";
import {parseBlob} from "music-metadata";

export interface ParsedAudio {

    title: string;
    artist: string;
    albumArtist: string;
    composer: string;
    album: string;
    genre: string;
    releaseDate: ReleaseInfo;
    trackNo: number | null;
    discNo: number | null;
    duration: number;
    bitDepth: number | null;
    sampleRate: number | null;
    bitrate: number | null;
    lossless: boolean;
    copyright: string | null;
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
    return new Blob([copy.buffer], {type: mimeType});
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
    const {preciseDuration = true} = options;
    const {parseBlob} = await import("music-metadata");
    const metadata = await parseBlob(file, {duration: preciseDuration});

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
    const composer = joinArtists(common.composer);
    const album = cleanText(common.album) || UNKNOWN_ALBUM;
    const genre = common.genre?.length ? cleanText(common.genre[0]) : "";
    const releaseDate = parseReleaseDate(common);
    const trackNo = typeof common.track?.no === "number" ? common.track.no : null;
    const discNo = typeof common.disk?.no === "number" ? common.disk.no : null;
    const duration =
        typeof format.duration === "number" && Number.isFinite(format.duration)
            ? format.duration
            : 0;
    const picture = common.picture?.[0];
    const copyrightText = cleanText(common.copyright);
    const copyright = copyrightText || null;

    return {
        title,
        artist,
        albumArtist,
        composer,
        album,
        genre,
        releaseDate,
        trackNo,
        discNo,
        duration,
        copyright,
        bitrate: format.bitrate ?? null,
        bitDepth: format.bitsPerSample ?? null,
        sampleRate: format.sampleRate ?? null,
        /*
                codec: cleanText(format.codec) || cleanText(format.container),
        */
        lossless: format.lossless ?? false,
        cover: picture ? toBlob(picture.data, picture.format) : null,
    };
}

function parseReleaseDate(common: NonNullable<Awaited<ReturnType<typeof parseBlob>>["common"]>): ReleaseInfo {
    const releasedate = typeof common.releasedate === "string" ? common.releasedate.trim() : "";
    const date = typeof common.date === "string" ? common.date.trim() : "";
    const year = typeof common.year === "number" ? common.year : null;
    const originalyear =
        typeof common.originalyear === "number" ? common.originalyear : null;

    // 优先使用明确的 releasedate，其次 date，最后回退到年份字段。
    const dateSource = releasedate || date;

    let display: string | null = null;
    let sortValue = 0;

    if (dateSource) {
        // 尝试多种常见日期字符串格式（music-metadata 的日期字段常为 ISO 型或 YYYYMMDD）。
        const parsed = parseDateString(dateSource);
        if (parsed) {
            const {year: y, month: m, day: d} = parsed;
            const yearPad = String(y).padStart(4, "0").slice(0, 4);
            const monthPad = String(m).padStart(2, "0");
            const dayPad = String(d).padStart(2, "0");
            display = `${yearPad}-${monthPad}-${dayPad}`;
            sortValue = Number(`${yearPad}${monthPad}${dayPad}`);
            return {display, year: y, sortValue};
        }

        // 若不是完整日期，尝试 YYYYMMDD / YYYYMM 之类的纯数字形式。
        const numericMatch = dateSource.match(/^(\d{4})(?:-?(\d{2})(?:-?(\d{2}))?)?$/);
        if (numericMatch) {
            const [, yStr, mStr, dStr] = numericMatch;
            const y = Number(yStr);
            const m = mStr ? Number(mStr) : null;
            const d = dStr ? Number(dStr) : null;
            if (Number.isFinite(y) && y >= 1000 && y <= 2100) {
                if (m && Number.isFinite(m) && m >= 1 && m <= 12) {
                    const mm = String(m).padStart(2, "0");
                    if (d && Number.isFinite(d) && d >= 1 && d <= 31) {
                        const dd = String(d).padStart(2, "0");
                        display = `${yStr}-${mm}-${dd}`;
                        sortValue = Number(`${yStr}${mm}${dd}`);
                        return {display, year: y, sortValue};
                    }
                    // 只有年月，没有具体日期。
                    display = `${yStr}-${mm}`;
                    sortValue = Number(`${yStr}${mm}00`);
                    return {display, year: y, sortValue};
                }
                // 只有年份。
                display = null;
                sortValue = y * 10000;
                return {display, year: y, sortValue};
            }
        }

        // 忽略无法识别的日期字符串。
        display = null;
    }

    // 回退到 year / originalyear。
    const finalYear = year ?? originalyear ?? null;
    if (finalYear !== null && Number.isFinite(finalYear) && finalYear >= 1000 && finalYear <= 2100) {
        sortValue = finalYear * 10000;
        return {display, year: finalYear, sortValue};
    }

    return {display: null, year: null, sortValue: 0};
}

/** 尽量从字符串里提取年/月/日。字面量匹配多种常见格式，不保证绝对安全，
 * 但足以覆盖音乐标签里常见的日期表达（ISO 变体、YYYYMMDD、YYYY-MM 等）。
 */
function parseDateString(value: string): { year: number; month: number; day: number } | null {
    // YYYY-MM-DD / YYYY/MM/DD / YYYYMMDD
    const exact = value.match(
        /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/,
    );
    if (exact) {
        const [, yStr, mStr, dStr] = exact;
        const y = Number(yStr);
        const m = Number(mStr);
        const d = Number(dStr);
        if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
            return {year: y, month: m, day: d};
        }
    }

    // YYYYMMDD（无分隔符）
    const compact = value.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (compact) {
        const [, yStr, mStr, dStr] = compact;
        const y = Number(yStr);
        const m = Number(mStr);
        const d = Number(dStr);
        if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
            return {year: y, month: m, day: d};
        }
    }

    // ISO 8601 变体：YYYY-MM-DDTHH:mm:ss.sssZ / YYYY-MM-DDTHH:mm:ssZ 等
    const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
        const [, yStr, mStr, dStr] = iso;
        const y = Number(yStr);
        const m = Number(mStr);
        const d = Number(dStr);
        if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
            return {year: y, month: m, day: d};
        }
    }

    return null;
}
