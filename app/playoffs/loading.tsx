export default function PlayoffsLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
      <div className="mb-6 flex items-baseline justify-between">
        <div className="h-7 w-44 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-4 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-4 sm:min-w-0">
          {[8, 4, 2, 1].map((seriesCount, i) => (
            <div key={i} className="flex w-72 shrink-0 flex-col gap-3 sm:w-auto sm:flex-1">
              <div className="h-4 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="flex flex-1 flex-col justify-around gap-3">
                {Array.from({ length: seriesCount }).map((_, j) => (
                  <div key={j} className="h-20 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
