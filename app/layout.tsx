import type { Metadata } from "next";
import "./globals.css";
import { LibraryProvider } from "@/lib/library-provider";
import { NavProvider } from "@/lib/nav-provider";
import { PlayerProvider } from "@/lib/player-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Konzert · 本地音乐播放器",
  description:
    "本地优先的音乐播放器：在设备上读取标签与封面、整理曲库并播放，全程无需联网。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className={cn("h-full antialiased", "font-sans", geist.variable)}>
      <body className="h-full">
        {/* 曲库数据（IndexedDB）在最外层，播放器依赖它读取偏好与记录播放次数。 */}
        <LibraryProvider>
          <PlayerProvider>
            <NavProvider>
              <TooltipProvider>{children}</TooltipProvider>
            </NavProvider>
          </PlayerProvider>
        </LibraryProvider>
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
