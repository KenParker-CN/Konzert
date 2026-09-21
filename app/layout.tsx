import type { Metadata } from "next";
import "./globals.css";
import { LibraryProvider } from "@/lib/library-provider";
import { NavProvider } from "@/lib/nav-provider";
import { PlayerProvider } from "@/lib/player-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "Konzert",
  description:
    "本地优先的音乐播放器：在设备上读取标签与封面、整理曲库并播放，全程无需联网。",
};

export default function RootLayout() {
  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="h-full">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {/* 曲库数据（IndexedDB）在最外层，播放器依赖它读取偏好与记录播放次数。 */}
          <LibraryProvider>
            <PlayerProvider>
              <NavProvider>
                <TooltipProvider>
                  <AppShell />
                </TooltipProvider>
              </NavProvider>
            </PlayerProvider>
          </LibraryProvider>
        </ThemeProvider>
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
