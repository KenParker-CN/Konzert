/**
 * 软件解码兜底：浏览器内核（Chromium/WebView2）普遍不支持 ALAC（Apple
 * Lossless），这类 M4A 需要用 @audio/decode-aac 解出 PCM，再封装成 WAV
 * 交给 <audio> 播放。
 *
 * 为什么封装成 WAV 而不是改用 Web Audio：现有播放内核（进度、seek、循环、
 * 音量、系统媒体控制）全部挂在 <audio> 上，WAV Blob URL 可以原样复用这些
 * 逻辑，改动面最小；采样位深选 32-bit float（解码输出本就是 Float32），
 * 封装过程不损失音质。
 *
 * 限制：软解会把整首曲目的 PCM 一次性放进内存，超长曲目占用较大。
 */

import type { Track } from "./types";

/** M4A 容器家族：容器内既可能是 AAC（内核原生支持），也可能是 ALAC（需要软解）。 */
const M4A_EXTENSIONS = new Set(["m4a", "m4b", "m4r", "mp4"]);

/** 软解 PCM 的内存上限（约 1 GB），超出时给出明确错误而不是让页面崩溃。 */
const MAX_PCM_BYTES = 1 << 30;

export function extensionOfFileName(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot < 0 ? "" : fileName.slice(dot + 1).toLowerCase();
}

export function isM4aFamily(fileName: string): boolean {
  return M4A_EXTENSIONS.has(extensionOfFileName(fileName));
}

/** 该曲目是否需要软件解码（浏览器内核无法直接播放）。 */
export function needsSoftwareDecode(
  track: Pick<Track, "lossless" | "fileName"> & { codec?: string | null },
): boolean {
  if (track.codec?.toLowerCase().includes("alac")) return true;
  // MP4/M4A 容器里的无损编码实际只有 ALAC；个别文件的 codec 字段缺失或写成
  // 别名（如「Apple Lossless」全称），用「无损 + M4A 容器」兜底识别。
  return track.lossless && isM4aFamily(track.fileName);
}

export interface DecodedAudio {
  blob: Blob;
  /** 解码后的真实时长（秒）。 */
  duration: number;
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}

/** 把各声道 Float32 PCM 交织后封装成 32-bit float WAV。 */
export function encodeFloatWav(
  channels: Float32Array[],
  sampleRate: number,
): { blob: Blob; frames: number } {
  const channelCount = channels.length;
  let frames = channels[0]?.length ?? 0;
  for (const channel of channels) {
    frames = Math.min(frames, channel.length);
  }
  if (channelCount === 0 || frames === 0 || sampleRate <= 0) {
    throw new Error("软解失败：没有产出可用的音频数据");
  }

  const dataBytes = frames * channelCount * 4;
  if (dataBytes > MAX_PCM_BYTES) {
    throw new Error("曲目过长，软解需要超出预期的内存，已中止播放");
  }

  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true); // fmt 块长度
  view.setUint16(20, 3, true); // 3 = IEEE float
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channelCount * 4, true); // 字节率
  view.setUint16(32, channelCount * 4, true); // 块对齐
  view.setUint16(34, 32, true); // 位深
  writeAscii(view, 36, "data");
  view.setUint32(40, dataBytes, true);

  // 44 对齐 4 字节，Float32Array 视图可直接落在 PCM 区上。
  const samples = new Float32Array(buffer, 44, frames * channelCount);
  if (channelCount === 1) {
    samples.set(channels[0].subarray(0, frames));
  } else {
    for (let frame = 0; frame < frames; frame += 1) {
      for (let channel = 0; channel < channelCount; channel += 1) {
        samples[frame * channelCount + channel] = channels[channel][frame];
      }
    }
  }
  return { blob: new Blob([buffer], { type: "audio/wav" }), frames };
}

/** 读入整个文件，软解为 WAV Blob；解码器按需加载，不拖慢首屏。 */
export async function decodeAudioFileToWav(
  file: File | Blob,
): Promise<DecodedAudio> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { default: decode } = await import("@audio/decode-aac");
  let decoded;
  try {
    decoded = await decode(bytes);
  } catch (caught) {
    throw new Error(
      caught instanceof Error && caught.message
        ? `软解失败：${caught.message}`
        : "软解失败：无法解码该文件",
    );
  }
  const { blob, frames } = encodeFloatWav(decoded.channelData, decoded.sampleRate);
  return { blob, duration: frames / decoded.sampleRate };
}