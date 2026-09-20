"use client";

import { useEffect, useMemo, useState } from "react";
import {
  IconAlertCircle,
  IconDisc,
  IconFolderPlus,
  IconDeviceDesktop,
  IconInfoCircle,
  IconRefresh,
  IconRepeat,
  IconRepeatOnce,
  IconArrowsShuffle,
  IconTrash,
  IconMoon,
  IconSun,
} from "@tabler/icons-react";
import { useTheme } from "next-themes";
import { isTauriRuntime } from "@/lib/sources";
import { estimateUsage } from "@/lib/db";
import { formatFileSize, formatTotalDuration } from "@/lib/format";
import { useLibrary } from "@/lib/library-provider";
import { usePlayer } from "@/lib/player-provider";

const STORAGE_LABELS: Record<string, string> = {
  tauri: "桌面模式",
  "fs-access": "浏览器模式（已授权文件夹）",
  session: "兼容模式（仅本次会话）",
};

const STORAGE_DESCRIPTIONS: Record<string, string> = {
  tauri:
    "Konzert 直接读取本机磁盘上的音乐文件，曲库索引保存在应用的本地数据库中。",
  "fs-access":
    "浏览器模式下通过 File System Access 记住文件夹授权，重新打开时可能再次询问读取权限。",
  session:
    "当前环境不支持持久化文件访问，导入的文件只在本次会话可用，重新打开需要重新导入。",
};

export function SettingsView() {
  const { theme, setTheme } = useTheme();
  const [accent, setAccent] = useState(() =>
    typeof window === "undefined"
      ? "blue"
      : window.localStorage.getItem("konzert-accent") ?? "blue",
  );
  const {
    tracks,
    albums,
    settings,
    storageMode,
    updateSettings,
    importFolder,
    refreshLibrary,
    clearLibrary,
    scanning,
    lastScan,
  } = useLibrary();
  const player = usePlayer();
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(
    null,
  );
  const [confirmClear, setConfirmClear] = useState(false);

  const updateAccent = (value: string) => {
    setAccent(value);
  };

  useEffect(() => {
    window.localStorage.setItem("konzert-accent", accent);
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  useEffect(() => {
    let cancelled = false;
    void estimateUsage()
      .then((value) => {
        if (!cancelled) setUsage(value);
      })
      .catch(() => {
        // 某些环境不支持 storage.estimate，忽略即可。
      });
    return () => {
      cancelled = true;
    };
  }, [tracks.length]);

  const totalDuration = tracks.reduce(
    (sum, track) => sum + (track.duration || 0),
    0,
  );

  /** 曲目文件实际大小之和；storage.estimate 只反映索引/缓存占用，不含媒体文件本身。 */
  const totalFileSize = useMemo(
    () => tracks.reduce((sum, track) => sum + (track.fileSize || 0), 0),
    [tracks],
  );

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-lg font-semibold text-zinc-900">设置</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Konzert 是本地优先应用：所有数据都保存在这台设备上。
        </p>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="flex items-center gap-2 text-sm font-medium text-zinc-800">
          <IconDeviceDesktop className="h-4 w-4 text-app-accent" />
          存储与曲库
        </h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
          <Stat label="曲目" value={`${tracks.length}`} />
          <Stat label="专辑" value={`${albums.length}`} />
          <Stat label="总时长" value={formatTotalDuration(totalDuration)} />
          <Stat
            label="缓存占用"
            value={usage ? formatFileSize(usage.usage) : "—"}
          />
          <Stat
            label="文件占用"
            value={totalFileSize > 0 ? formatFileSize(totalFileSize) : "—"}
          />
        </dl>
        <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
          <span className="text-zinc-500">
            {STORAGE_LABELS[storageMode] ?? storageMode}
          </span>
          ：{STORAGE_DESCRIPTIONS[storageMode] ?? STORAGE_DESCRIPTIONS.session}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void importFolder()}
            disabled={scanning}
            className="flex items-center gap-2 rounded-full bg-zinc-950/5 px-4 py-2 text-xs text-zinc-800 transition hover:bg-zinc-950/10 disabled:opacity-60"
          >
            <IconFolderPlus className="h-3.5 w-3.5" />
            扫描新文件夹
          </button>
          <button
            type="button"
            onClick={() => void refreshLibrary()}
            disabled={scanning || settings.watchedFolders.length === 0}
            className="flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-xs text-zinc-700 transition hover:bg-zinc-950/5 disabled:opacity-40"
          >
            <IconRefresh className="h-3.5 w-3.5" />
            刷新音乐库
          </button>
          {confirmClear ? (
            <>
              <button
                type="button"
                onClick={() => {
                  void clearLibrary();
                  setConfirmClear(false);
                }}
                className="flex items-center gap-2 rounded-full bg-rose-500/90 px-4 py-2 text-xs font-medium text-white transition hover:bg-rose-500"
              >
                <IconTrash className="h-3.5 w-3.5" />
                确认清空曲库
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="rounded-full px-3 py-2 text-xs text-zinc-500 transition hover:text-zinc-800"
              >
                取消
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              disabled={tracks.length === 0}
              className="flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-xs text-zinc-500 transition hover:bg-zinc-950/5 disabled:opacity-40"
            >
              <IconTrash className="h-3.5 w-3.5" />
              清空曲库
            </button>
          )}
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-[11px] text-zinc-500">
          <IconAlertCircle className="mt-px h-3 w-3 shrink-0" />
          清空只会删除本机的曲库索引与封面缓存，不会动你的音乐文件。
        </p>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-medium text-zinc-800">外观</h2>
        <div className="mt-4 flex flex-col gap-4 text-xs">
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-500">主题模式</span>
            <div className="flex gap-1 rounded-full bg-zinc-950/5 p-1">
              {[
                ["light", "浅色", IconSun],
                ["dark", "深色", IconMoon],
              ].map(([value, label, Icon]) => (
                <button
                  key={value as string}
                  type="button"
                  onClick={() => setTheme(value as string)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ${
                    theme === value ? "bg-zinc-900 text-white" : "text-zinc-500"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label as string}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-500">强调色</span>
            <div className="flex items-center gap-2">
              {[
                ["blue", "#1967d2"],
                ["violet", "#7c3aed"],
                ["emerald", "#059669"],
                ["rose", "#e11d48"],
              ].map(([name, color]) => (
                <button
                  key={name}
                  type="button"
                  aria-label={`选择${name}强调色`}
                  aria-pressed={accent === name}
                  onClick={() => updateAccent(name)}
                  className={`size-5 rounded-full border-2 ${
                    accent === name ? "border-zinc-900 ring-2 ring-zinc-300" : "border-white"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 播放偏好 */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="flex items-center gap-2 text-sm font-medium text-zinc-800">
          <IconDisc className="h-4 w-4 text-app-accent" />
          播放偏好
        </h2>

        <div className="mt-4 space-y-4 text-xs">
          <label className="flex items-center justify-between gap-4">
            <span className="text-zinc-500">默认音量</span>
            <span className="flex items-center gap-3">
              <input
                type="range"
                className="konzert-range konzert-volume-range h-4 w-40"
                min={0}
                max={1}
                step={0.01}
                value={settings.volume}
                aria-label="默认音量"
                style={{ "--range-progress": `${settings.volume * 100}%` } as React.CSSProperties}
                onChange={(event) =>
                  updateSettings({ volume: Number(event.target.value) })
                }
              />
              <span className="w-9 text-right tabular-nums text-zinc-500">
                {Math.round(settings.volume * 100)}%
              </span>
            </span>
          </label>

          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-500">随机播放</span>
            <button
              type="button"
              onClick={player.toggleShuffle}
              aria-pressed={settings.shuffle}
              className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 transition ${
                settings.shuffle
                  ? "bg-app-accent-soft text-app-accent"
                  : "bg-zinc-950/5 text-zinc-500 hover:text-zinc-700"
              }`}
            >
              <IconArrowsShuffle className="h-3.5 w-3.5" />
              {settings.shuffle ? "已开启" : "已关闭"}
            </button>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-500">循环模式</span>
            <button
              type="button"
              onClick={player.cycleRepeat}
              className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 transition ${
                settings.repeat === "off"
                  ? "bg-zinc-950/5 text-zinc-500 hover:text-zinc-700"
                  : "bg-app-accent-soft text-app-accent"
              }`}
            >
              {settings.repeat === "one" ? (
                <IconRepeatOnce className="h-3.5 w-3.5" />
              ) : (
                <IconRepeat className="h-3.5 w-3.5" />
              )}
              {settings.repeat === "one"
                ? "单曲循环"
                : settings.repeat === "all"
                  ? "列表循环"
                  : "不循环"}
            </button>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-500">恢复上次播放</span>
            <span className="text-zinc-500">
              {settings.lastTrackId
                ? "已记住，打开应用后可继续"
                : "尚未产生播放记录"}
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="flex items-center gap-2 text-sm font-medium text-zinc-800">
          <IconFolderPlus className="h-4 w-4 text-app-accent" />
          应用偏好
        </h2>
        <div className="mt-4 flex flex-col gap-4 text-xs">
          <label className="flex items-center justify-between gap-4">
            <span className="text-zinc-500">界面语言</span>
            <select
              value={settings.language}
              onChange={(event) =>
                updateSettings({ language: event.target.value as "zh-CN" | "en-US" })
              }
              className="rounded border border-zinc-200 bg-white px-2 py-1.5 text-zinc-700"
            >
              <option value="zh-CN">简体中文</option>
              <option value="en-US">English</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-4">
            <span className="text-zinc-500">自动监控已导入文件夹</span>
            <input
              type="checkbox"
              checked={settings.autoWatch}
              onChange={(event) => updateSettings({ autoWatch: event.target.checked })}
              className="size-4 accent-blue-600"
            />
          </label>
          <div>
            <p className="text-zinc-500">固定监控文件夹</p>
            {settings.watchedFolders.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1 text-[11px] text-zinc-500">
                {settings.watchedFolders.map((folder) => (
                  <li key={folder} className="truncate" title={folder}>
                    {folder}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[11px] text-zinc-400">
                在桌面端扫描文件夹后会自动加入监控列表。
              </p>
            )}
          </div>
        </div>
      </section>

      {/* 最近一次扫描 */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="flex items-center gap-2 text-sm font-medium text-zinc-800">
          <IconInfoCircle className="h-4 w-4 text-app-accent" />
          最近一次扫描
        </h2>
        {lastScan ? (
          <dl className="mt-4 grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
            <Stat label="新增" value={`${lastScan.added}`} />
            <Stat label="更新" value={`${lastScan.updated}`} />
            <Stat label="未变化" value={`${lastScan.unchanged}`} />
            <Stat label="失败" value={`${lastScan.failed}`} />
          </dl>
        ) : (
          <p className="mt-3 text-xs text-zinc-500">
            还没有扫描记录，点「扫描新文件夹」开始建立曲库。
          </p>
        )}
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-500">
          <IconRefresh className="h-3 w-3" />
          再次扫描同一文件夹时会按文件大小识别变化，已听次数与收藏不会丢失。
        </p>
      </section>

      {/* 关于 */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="flex items-center gap-2 text-sm font-medium text-zinc-800">
          <IconInfoCircle className="h-4 w-4 text-app-accent" />
          关于 Konzert
        </h2>
        <p className="mt-3 text-xs leading-relaxed text-zinc-500">
          技术栈：Next.js 静态导出 + React 19 + Tailwind CSS 4，桌面端由 Tauri 2
          承载。音频标签与封面在本地用 music-metadata 解析，ALAC（Apple
          Lossless）由内置的 @audio/decode-aac 软解后播放，曲库、收藏与历史保存在
          IndexedDB 中，全程不需要联网。
        </p>
        <p className="mt-2 text-[11px] text-zinc-500">
          版本 0.1.0 · 支持格式：MP3 / M4A（AAC / ALAC）/ FLAC / OGG / OPUS / WAV /
          WMA / AIFF 等
        </p>
        <a
          href="https://github.com/KenParker-CN/Konzert"
          target="_blank"
          rel="noreferrer"
          onClick={(event) => {
            if (!isTauriRuntime()) return;
            event.preventDefault();
            void import("@tauri-apps/plugin-opener").then(({ openUrl }) =>
              openUrl("https://github.com/KenParker-CN/Konzert"),
            );
          }}
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-blue-600"
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.69c-2.78.6-3.37-1.18-3.37-1.18-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02A9.56 9.56 0 0 1 12 7.85c.85 0 1.71.12 2.51.37 1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
          </svg>
          GitHub 仓库
        </a>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-sm tabular-nums text-zinc-800">{value}</dd>
    </div>
  );
}