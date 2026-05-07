// Skeleton shown while /teams fetches from the NHL API. Matches the
// page's layout to avoid layout shift when real content swaps in.

export default function TeamsLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
      <div className="mb-6 flex items-baseline justify-between">
        <div className="h-7 w-32 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-4 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        {/* Fake header row */}
        <div className="bg-zinc-50 px-4 py-2 dark:bg-zinc-900">
          <div className="h-4 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
        {/* 32 fake rows */}
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 bg-white px-4 py-3 dark:bg-zinc-950">
              <div className="h-7 w-7 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="ml-auto h-4 w-12 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
