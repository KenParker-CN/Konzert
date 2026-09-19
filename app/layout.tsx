import type { Metadata } from "next";
import "./globals.css";
import { LibraryProvider } from "@/lib/library-provider";
import { NavProvider } from "@/lib/nav-provider";
import { PlayerProvider } from "@/lib/player-provider";

export const metadata: Metadata = {
  title: "Konzert · 本地音乐播放器",
  description:
    "本地优先的音乐播放器：在设备上读取标签与封面、整理曲库并播放，全程无需联网。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="h-full">
        {/* 曲库数据（IndexedDB）在最外层，播放器依赖它读取偏好与记录播放次数。 */}
        <LibraryProvider>
          <PlayerProvider>
            <NavProvider>{children}</NavProvider>
          </PlayerProvider>
        </LibraryProvider>
      </body>
    </html>
  );
}
