"use client";

import { useState, useEffect, type MouseEvent } from "react";
import { IconMinus, IconSquare, IconStack2, IconX } from "@tabler/icons-react";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { isTauriRuntime } from "@/lib/sources";

function safeGetCurrentWindow() {
  if (!isTauriRuntime()) return null;
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
}

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isTauri, setIsTauri] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsTauri(isTauriRuntime()));
    return () => cancelAnimationFrame(frame);
  }, []);

  const handleStartDragging = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const window = safeGetCurrentWindow();
    if (!window) return;
    void window
      .startDragging()
      .catch((error) => {
        console.error("Failed to start dragging window:", error);
      });
  };

  useEffect(() => {
    let cancelled = false;
    const window = safeGetCurrentWindow();
    if (!window) {
      console.warn("No current window available (browser build?)");
      return;
    }
    void window
      .isMaximized()
      .then((maximized: boolean) => {
        if (!cancelled) setIsMaximized(maximized);
      })
      .catch((error) => {
        console.error("Failed to check window state:", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleMinimize = async () => {
    try {
      const window = safeGetCurrentWindow();
      if (!window) return;
      await window.minimize();
    } catch (error) {
      console.error("Failed to minimize window:", error);
    }
  };

  const handleDoubleClick = async () => {
    try {
      const window = safeGetCurrentWindow();
      if (!window) return;
      await window.toggleMaximize();
      const maximized = await window.isMaximized();
      setIsMaximized(maximized);
    } catch (error) {
      console.error("Failed to toggle maximize:", error);
    }
  };

  const handleMaximize = async () => {
    try {
      const window = safeGetCurrentWindow();
      if (!window) return;
      if (isMaximized) {
        await window.unmaximize();
      } else {
        await window.maximize();
      }
      const maximized = await window.isMaximized();
      setIsMaximized(maximized);
    } catch (error) {
      console.error("Failed to toggle maximize:", error);
    }
  };

  const handleClose = async () => {
    try {
      const window = safeGetCurrentWindow();
      if (!window) return;
      await window.close();
    } catch (error) {
      console.error("Failed to close window:", error);
    }
  };

  if (!isTauri) return null;

  return (
    <div className="flex h-8 items-center justify-between border-b border-zinc-200 bg-zinc-950/5 backdrop-blur-xl">
      {/* Drag region for window dragging */}
      <div
        data-tauri-drag-region
        className="flex h-full flex-1 items-center gap-2.5 px-5 select-none"
        onMouseDown={handleStartDragging}
        onDoubleClick={handleDoubleClick}
      >
      </div>

      {/* Window controls */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={handleMinimize}
          aria-label="最小化"
          className="flex h-9 w-11 items-center justify-center text-zinc-600 transition hover:bg-zinc-200 hover:text-zinc-900"
        >
          <IconMinus className="h-4 w-4" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={handleMaximize}
          aria-label={isMaximized ? "还原" : "最大化"}
          className="flex h-9 w-11 items-center justify-center text-zinc-600 transition hover:bg-zinc-200 hover:text-zinc-900"
        >
          {isMaximized ? (
            <IconStack2 className="h-3.5 w-3.5" strokeWidth={1.5} />
          ) : (
            <IconSquare className="h-3.5 w-3.5" strokeWidth={1.5} />
          )}
        </button>
        <button
          type="button"
          onClick={handleClose}
          aria-label="关闭"
          className="flex h-9 w-11 items-center justify-center text-zinc-600 transition hover:bg-rose-500 hover:text-white"
        >
          <IconX className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
