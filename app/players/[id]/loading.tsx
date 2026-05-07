// Skeleton for /players/[id].

export default function PlayerLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
      <div className="mb-4 h-4 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />

      <div className="mb-6 flex items-center gap-4">
        <div className="h-20 w-20 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
        <div className="space-y-2">
          <div className="h-7 w-56 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-4 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>

      <div className="h-40 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
    </main>
  );
}
