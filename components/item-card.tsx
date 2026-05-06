// Presentation component for one item card. Pure: takes data in, renders
// HTML out. No DB calls, no auth checks here — those belong in the page.
//
// We type the props explicitly instead of importing the Prisma `Item` type
// because the page might want to pass a *subset* (e.g., not every column).
// Keeping the prop shape minimal also makes the card easier to reuse for
// search results / filtered views later.

import type { ItemStatus, ItemType } from "@/generated/prisma/enums";

type ItemCardProps = {
  id: string;
  title: string;
  type: ItemType;
  status: ItemStatus;
  rating: number | null;
  notes: string | null;
};

const TYPE_LABEL: Record<ItemType, string> = {
  BOOK: "Book",
  MOVIE: "Movie",
  SHOW: "Show",
};

const STATUS_LABEL: Record<ItemStatus, string> = {
  WANT: "Want",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

const STATUS_STYLE: Record<ItemStatus, string> = {
  WANT: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  IN_PROGRESS: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  DONE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
};

function Stars({ rating }: { rating: number }) {
  // Defensive clamp so a corrupt DB row doesn't render 100 stars.
  const safe = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span aria-label={`${safe} out of 5`} className="text-amber-500">
      {"★".repeat(safe)}
      <span className="text-zinc-300 dark:text-zinc-700">{"★".repeat(5 - safe)}</span>
    </span>
  );
}

export default function ItemCard({ title, type, status, rating, notes }: ItemCardProps) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold leading-tight text-black dark:text-zinc-50">
          {title}
        </h3>
        <span className="shrink-0 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
          {TYPE_LABEL[type]}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>
          {STATUS_LABEL[status]}
        </span>
        {rating != null && <Stars rating={rating} />}
      </div>

      {notes && (
        <p className="line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400">
          {notes}
        </p>
      )}
    </article>
  );
}
