"use client";

import type { ReactNode } from "react";
import { catalogReferencesOf } from "@/lib/catalog";
import { useNav } from "@/lib/nav-provider";

export function CatalogTitle({
  title,
  composer,
}: {
  title: string;
  composer: string;
}) {
  const { openWork } = useNav();
  const references = catalogReferencesOf(title);
  if (references.length === 0) return <>{title}</>;

  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const reference of references) {
    if (reference.index > cursor) {
      parts.push(title.slice(cursor, reference.index));
    }
    parts.push(
      <button
        key={`${reference.system}-${reference.number}-${reference.index}`}
        type="button"
        className="text-app-accent underline-offset-2 hover:underline"
        onClick={(event) => {
          event.stopPropagation();
          openWork({ ...reference, composer });
        }}
      >
        {reference.display}
      </button>,
    );
    cursor = reference.index + reference.display.length;
  }
  if (cursor < title.length) parts.push(title.slice(cursor));

  return (
    <>{parts}</>
  );
}
