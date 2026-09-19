"use client";

import { AudioLines, FolderPlus, HardDrive, LoaderCircle, Upload } from "lucide-react";

interface EmptyStateProps {
  onImport: () => void;
  scanning: boolean;
  storageMode: string;
  /** 是否有搜索条件导致列表为空。 */
  filtered?: boolean;
}

const MODE_HINTS: Record<string, string> = {
  tauri: "桌面模式：直接从磁盘读取，曲库可长期保存。",
  "fs-access":
    "浏览器模式：已记住文件夹授权，重启后可能需要再次确认读取权限。",
  session: "兼容模式：本次会话可播放，重新打开后需要重新导入。",
};

export function EmptyState({
  onImport,
  scanning,
  storageMode,
  filtered = false,
}: EmptyStateProps) {
  if (filtered) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-6 py-16 text-center">
        <p className="text-sm text-zinc-500">没有匹配的曲目</p>
        <p className="text-xs text-zinc-500">换个关键词试试，或清空搜索条件。</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-white px-8 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-blue-500/20 to-blue-400/10 text-blue-700">
        <AudioLines className="h-7 w-7" />
      </span>
      <div>
        <p className="text-base font-medium text-zinc-800">曲库还是空的</p>
        <p className="mt-1 max-w-md text-xs leading-relaxed text-zinc-500">
          选择一个音乐文件夹，Konzert 会在本机读取标签与封面并建立索引。
          文件不会被复制或上传，只是记住它们的位置。
        </p>
      </div>
      <button
        type="button"
        onClick={onImport}
        disabled={scanning}
        className="flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-zinc-50 transition hover:bg-zinc-700 disabled:opacity-60"
      >
        {scanning ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <FolderPlus className="h-4 w-4" />
        )}
        导入音乐文件夹
      </button>
      <div className="mt-1 space-y-1 text-[11px] text-zinc-500">
        <p className="flex items-center justify-center gap-1.5">
          <Upload className="h-3 w-3" />
          也可以把文件夹或音频文件直接拖进窗口
        </p>
        <p className="flex items-center justify-center gap-1.5">
          <HardDrive className="h-3 w-3" />
          {MODE_HINTS[storageMode] ?? MODE_HINTS.session}
        </p>
      </div>
    </div>
  );
}
