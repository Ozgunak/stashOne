// Skeleton for /players. Matches the rough header + filter + grid shape.

export default function PlayersLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
      <div className="mb-6 flex items-baseline justify-between">
        <div className="h-7 w-32 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-9 w-72 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        <div className="h-7 w-44 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-7 w-44 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900"
          />
        ))}
      </div>
    </main>
  );
}
