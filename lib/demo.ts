/**
 * 内置示例音频。
 *
 * public/demo 下的文件会随应用一起打包（静态导出后即站点根路径），
 * 因此启动时可以直接导入，用户无需任何手动操作。
 *
 * 来源键是常量，曲目 ID 由它派生，所以重复启动不会产生第二条记录。
 */

import { parseAudioFile, titleFromFileName, type ParsedAudio } from "./metadata";
import { buildOutcome, type ScanCandidate } from "./scan";
import { readOriginFile } from "./sources";
import { UNKNOWN_ALBUM, UNKNOWN_ARTIST, type AudioOrigin, type Track } from "./types";

/** 内置示例音频在应用内的地址。 */
export const DEMO_AUDIO_URL = "/demo/preview-silence.wav";

const DEMO_FILE_NAME = "preview-silence.wav";

const DEMO_SOURCE_KEY = `bundled:${DEMO_AUDIO_URL}`;

/** 无标签文件（多为裸 WAV）使用的展示信息，避免界面上出现文件名与「未知艺术家」。 */
const DEMO_FALLBACK = {
  title: "示例音频",
  artist: "Konzert",
  album: "示例曲库",
};

function isDemoOrigin(origin: AudioOrigin): boolean {
  return origin.kind === "bundled" && origin.url === DEMO_AUDIO_URL;
}

export function isDemoTrack(track: Track): boolean {
  return isDemoOrigin(track.origin);
}

/** 标签缺失时套用展示用兜底值，有标签则一律沿用文件本身的信息。 */
function withDemoFallbacks(parsed: ParsedAudio): ParsedAudio {
  return {
    ...parsed,
    title:
      parsed.title === titleFromFileName(DEMO_FILE_NAME)
        ? DEMO_FALLBACK.title
        : parsed.title,
    artist:
      parsed.artist === UNKNOWN_ARTIST ? DEMO_FALLBACK.artist : parsed.artist,
    album:
      parsed.album === UNKNOWN_ALBUM ? DEMO_FALLBACK.album : parsed.album,
  };
}

/**
 * 读取并解析内置示例音频，产出待入库的曲目。
 *
 * 曲库里已经有它时返回空数组（无需重复解析）；
 * 文件缺失（静态导出未包含 public/demo）或解析失败时抛出，由调用方降级。
 */
export async function importDemoTrack(
  existingTracks: Track[],
): Promise<Track[]> {
  if (existingTracks.some(isDemoTrack)) return [];

  const candidate: ScanCandidate = {
    key: DEMO_SOURCE_KEY,
    fileName: DEMO_FILE_NAME,
    fileSize: 0,
    origin: { kind: "bundled", url: DEMO_AUDIO_URL },
    displayPath: DEMO_AUDIO_URL,
  };

  const file = await readOriginFile(candidate.origin, candidate.fileName);
  candidate.fileSize = file.size;
  const parsed = withDemoFallbacks(
    await parseAudioFile(file, candidate.fileName),
  );
  const outcome = buildOutcome(
    [{ candidate, parsed }],
    existingTracks,
  );
  return [...outcome.added, ...outcome.updated];
}
