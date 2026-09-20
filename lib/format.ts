/** 展示层的纯格式化函数。 */

export function formatDuration(seconds: number | null | undefined): string {
    if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "--:--";
    const total = Math.round(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const pad = (value: number) => value.toString().padStart(2, "0");
    return hours > 0
        ? `${hours}:${pad(minutes)}:${pad(secs)}`
        : `${minutes}:${pad(secs)}`;
}

export function formatTotalDuration(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return "0 分钟";
    const totalMinutes = Math.round(seconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes} 分钟`;
    return minutes === 0 ? `${hours} 小时` : `${hours} 小时 ${minutes} 分钟`;
}

export function formatFileSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const exponent = Math.min(
        Math.floor(Math.log(bytes) / Math.log(1024)),
        units.length - 1,
    );
    const value = bytes / 1024 ** exponent;
    return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
}

export function formatBitDepth(bitDepth: number | null): string {
    if (!bitDepth || !Number.isFinite(bitDepth)) return "—";
    return `${bitDepth} bit`;
}

export function formatSampleRate(sampleRate: number | null): string {
    if (!sampleRate || !Number.isFinite(sampleRate)) return "—";
    return `${(sampleRate / 1000).toFixed(1)} kHz`;
}

/** 用于生成封面占位图上的文字。 */
export function initialsOf(text: string): string {
    const trimmed = text.trim();
    if (!trimmed) return "?";
    const first = trimmed.slice(0, 1);
    return /[a-z]/i.test(first) ? first.toUpperCase() : first;
}

/**
 * 格式化发行信息（ReleaseInfo）为可直接展示的日期字符串。
 *
 * 优先使用 `display`（完整的本地日期字符串，如 "1973-04-23"），
 * 否则使用 `year`（如 "1973"），全无时返回空串。
 */
export function formatReleaseDate(
    release: { display: string | null; year: number | null },
): string {
    if (release.display) return release.display;
    if (release.year != null) return String(release.year);
    return "";
}
