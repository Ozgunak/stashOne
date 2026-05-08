"use client";

// Optimistic favorite/unfavorite toggle.
//
// The button flips its visual state instantly (useState), then awaits
// the server action. If the server returns a different state (rare —
// only on race conditions), we sync to that. If the action fails
// outright, we revert.
//
// This is a thinner pattern than `useOptimistic` — the server action
// here returns a small JSON shape rather than driving form state, so
// useState + useTransition is cleaner.

import { useState, useTransition } from "react";

import { toggleFavoriteAction } from "@/app/favorites/actions";
import type { FavoriteKind } from "@/generated/prisma/enums";

type Props = {
  kind: FavoriteKind;
  externalId: number;
  initialFavorited: boolean;
  /**
   * Used for screen readers and the visual label, e.g. "Favorite Connor McDavid".
   * The button text is just "Favorite" / "Favorited" plus a star icon.
   */
  label: string;
};

export default function FavoriteButton({
  kind,
  externalId,
  initialFavorited,
  label,
}: Props) {
  const [isFavorited, setIsFavorited] = useState(initialFavorited);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    const previous = isFavorited;
    setIsFavorited(!previous); // optimistic flip

    startTransition(async () => {
      const result = await toggleFavoriteAction({ kind, externalId });
      if (!result.ok) {
        setIsFavorited(previous); // revert
        setError(result.error);
        return;
      }
      // Sync to server's truth (handles race conditions where the
      // server says we ended up in a different state than we expected).
      setIsFavorited(result.favorited);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-label={label}
        aria-pressed={isFavorited}
        className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
          isFavorited
            ? "border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900"
            : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
        }`}
      >
        <span className="text-base leading-none" aria-hidden>
          {isFavorited ? "★" : "☆"}
        </span>
        <span>{isFavorited ? "Favorited" : "Favorite"}</span>
      </button>
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
      )}
    </div>
  );
}
