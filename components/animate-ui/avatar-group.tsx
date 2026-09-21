"use client";

import { motion } from "motion/react";
import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface AvatarGroupProps {
  artists: string[];
  onArtistClick?: (artist: string) => void;
  className?: string;
}

export function AnimatedAvatarGroup({
  artists,
  onArtistClick,
  className,
}: AvatarGroupProps) {
  if (artists.length <= 5) {
    return (
      <div className={cn("flex flex-col items-start gap-y-px", className)}>
        {artists.map((artist) => (
          <motion.button
            key={artist}
            type="button"
            whileHover={{ y: -2 }}
            transition={{ type: "spring", stiffness: 350, damping: 24 }}
            onClick={() => onArtistClick?.(artist)}
            className="flex min-h-8 min-w-0 items-center rounded px-0.5 py-0.5 text-sm text-zinc-600 outline-none transition hover:text-zinc-900 hover:underline hover:underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`查看艺术家 ${artist}`}
          >
            <Avatar
              size="sm"
              className="size-7 shrink-0 border border-background bg-app-accent-soft text-xs font-medium text-app-accent"
            >
              <AvatarFallback>
                {artist.trim().charAt(0).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <span>{artist}</span>
          </motion.button>
        ))}
      </div>
    );
  }

  return (
    <AvatarGroup className={cn("justify-start py-1", className)}>
      {artists.map((artist, index) => {
        const avatar = (
          <motion.div
            initial={false}
            whileHover={{ y: -3, scale: 1.08, zIndex: artists.length + 1 }}
            transition={{ type: "spring", stiffness: 350, damping: 24 }}
            className="relative"
          >
            <Avatar
              size="sm"
              className="size-8 border border-background bg-app-accent-soft text-xs font-medium text-app-accent"
            >
              <AvatarFallback>
                {artist.trim().charAt(0).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
          </motion.div>
        );

        return (
          <Tooltip key={artist}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={`查看艺术家 ${artist}`}
                  onClick={() => onArtistClick?.(artist)}
                  className="-ml-2 rounded-full outline-none first:ml-0 focus-visible:ring-2 focus-visible:ring-ring"
                  style={{ zIndex: artists.length - index }}
                />
              }
            >
              {avatar}
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8}>
              {artist}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </AvatarGroup>
  );
}
