// Skeleton shown while /items renders. Next.js auto-wraps this in a
// Suspense boundary around app/items/page.tsx.
//
// We mimic the page's outer shape (header row + grid of cards) so the
// transition to the real content is visually quiet — no layout jump.

export default function ItemsLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-3">
          <div className="h-7 w-32 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-4 w-16 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-72 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-9 w-16 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="h-4 w-12 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-5 w-12 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-5 w-16 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-5 w-14 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
          />
        ))}
      </div>
    </main>
  );
}
