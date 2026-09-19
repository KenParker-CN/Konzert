"use client";

import { useState, useEffect } from "react";
import { Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const checkMaximized = async () => {
      try {
        const window = getCurrentWindow();
        const maximized = await window.isMaximized();
        setIsMaximized(maximized);
      } catch (error) {
        console.error("Failed to check window state:", error);
      }
    };

    checkMaximized();
  }, []);

  const handleMinimize = async () => {
    try {
      const window = getCurrentWindow();
      await window.minimize();
    } catch (error) {
      console.error("Failed to minimize window:", error);
    }
  };

  const handleMaximize = async () => {
    try {
      const window = getCurrentWindow();
      if (isMaximized) {
        await window.unmaximize();
        setIsMaximized(false);
      } else {
        await window.toggleMaximize();
        setIsMaximized(true);
      }
    } catch (error) {
      console.error("Failed to toggle maximize:", error);
    }
  };

  const handleClose = async () => {
    try {
      const window = getCurrentWindow();
      await window.close();
    } catch (error) {
      console.error("Failed to close window:", error);
    }
  };

  return (
    <div className="flex h-8 items-center justify-between border-b border-zinc-200 bg-zinc-950/5 backdrop-blur-xl">
      {/* Drag region for window dragging */}
      <div
        data-tauri-drag-region
        className="flex flex-1 items-center gap-2.5 px-5 select-none"
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
          <Minus className="h-4 w-4" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={handleMaximize}
          aria-label={isMaximized ? "还原" : "最大化"}
          className="flex h-9 w-11 items-center justify-center text-zinc-600 transition hover:bg-zinc-200 hover:text-zinc-900"
        >
          <Square className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={handleClose}
          aria-label="关闭"
          className="flex h-9 w-11 items-center justify-center text-zinc-600 transition hover:bg-rose-500 hover:text-white"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
