"use client";

/**
 * 封面展示。
 *
 * 封面以 Blob 形式存在 IndexedDB 中，这里按需取回并转成 Object URL，
 * 并在模块级缓存，避免滚动列表时反复读取与创建 URL。
 */

import { useEffect, useState } from "react";
import { loadCover } from "@/lib/db";
import { initialsOf } from "@/lib/format";

const coverUrlCache = new Map<string, string>();

export function useCoverUrl(coverId: string | null): string | null {
  const [loaded, setLoaded] = useState<{ id: string; url: string } | null>(null);

  useEffect(() => {
    if (!coverId || coverUrlCache.has(coverId)) return;
    let cancelled = false;
    void loadCover(coverId)
      .then((blob) => {
        if (cancelled || !blob) return;
        const objectUrl = URL.createObjectURL(blob);
        coverUrlCache.set(coverId, objectUrl);
        setLoaded({ id: coverId, url: objectUrl });
      })
      .catch(() => {
        // 封面读取失败时退化为占位图。
      });
    return () => {
      cancelled = true;
    };
  }, [coverId]);

  if (!coverId) return null;
  // 缓存命中时无需等待 effect，直接使用。
  const cached = coverUrlCache.get(coverId);
  if (cached) return cached;
  return loaded && loaded.id === coverId ? loaded.url : null;
}

interface CoverArtProps {
  coverId: string | null;
  /** 占位图上显示的首字母来源（通常是专辑名）。 */
  label: string;
  className?: string;
  /** 占位文字大小，例如 "text-lg"。 */
  labelClassName?: string;
}

export function CoverArt({
  coverId,
  label,
  className = "",
  labelClassName = "text-lg",
}: CoverArtProps) {
  const url = useCoverUrl(coverId);

  if (url) {
    return (
      // 封面来自本地 Blob URL，无法使用 next/image 优化器（该规则已在 eslint 配置中关闭）。
      <img
        src={url}
        alt=""
        draggable={false}
        className={`${className} bg-zinc-100 object-cover`}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={`${className} flex items-center justify-center border border-zinc-200/70 bg-gradient-to-br from-blue-500/15 via-blue-500/5 to-transparent font-semibold text-zinc-400/80 select-none`}
    >
      <span className={labelClassName}>{initialsOf(label)}</span>
    </div>
  );
}
