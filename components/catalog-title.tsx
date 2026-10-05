"use client";

import type { ReactNode } from "react";
import { catalogReferenceDisplay, catalogReferencesOf } from "@/lib/catalog";
import { useNav } from "@/lib/nav-provider";

export function CatalogTitle({
  title,
  composer,
  onOpenRecording,
}: {
  title: string;
  composer: string;
  onOpenRecording?: () => void;
}) {
  const { openWork } = useNav();
  const references = catalogReferencesOf(title);
  if (references.length === 0) {
    return onOpenRecording ? (
      <button
        type="button"
        className="inline text-left hover:underline hover:underline-offset-2"
        onClick={(event) => {
          event.stopPropagation();
          onOpenRecording();
        }}
      >
        {title}
      </button>
    ) : <>{title}</>;
  }

  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const reference of references) {
    if (reference.index > cursor) {
      parts.push(
        onOpenRecording ? (
          <button
            key={`title-${cursor}`}
            type="button"
            className="inline hover:underline hover:underline-offset-2"
            onClick={(event) => {
              event.stopPropagation();
              onOpenRecording();
            }}
          >
            {title.slice(cursor, reference.index)}
          </button>
        ) : title.slice(cursor, reference.index),
      );
    }
    parts.push(
      <button
        key={`${reference.system}-${reference.number}-${reference.index}`}
        type="button"
        className="inline-flex items-center rounded-md bg-app-accent px-1.5 py-0.5 align-middle text-[0.85em] font-medium leading-none text-white transition hover:brightness-90 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
        onClick={(event) => {
          event.stopPropagation();
          openWork({ ...reference, composer });
        }}
      >
        {catalogReferenceDisplay(reference)}
      </button>,
    );
    cursor = reference.index + reference.display.length;
  }
  if (cursor < title.length) {
    parts.push(
      onOpenRecording ? (
        <button
          key={`title-${cursor}`}
          type="button"
          className="inline hover:underline hover:underline-offset-2"
          onClick={(event) => {
            event.stopPropagation();
            onOpenRecording();
          }}
        >
          {title.slice(cursor)}
        </button>
      ) : title.slice(cursor),
    );
  }

  return (
    <>{parts}</>
  );
}
