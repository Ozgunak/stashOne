// Skeleton for the team detail page. Matches the rough header + roster
// shape of the real page.

export default function TeamLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
      <div className="mb-4 h-4 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />

      <div className="mb-6 flex items-center gap-4">
        <div className="h-16 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="space-y-2">
          <div className="h-7 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-4 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>

      <div className="mb-8 h-24 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />

      <div className="mb-3 h-5 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900" />
        ))}
      </div>
    </main>
  );
}
