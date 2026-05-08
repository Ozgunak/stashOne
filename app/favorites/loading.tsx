export default function FavoritesLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
      <div className="mb-6 flex items-baseline justify-between">
        <div className="h-7 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-4 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div className="space-y-10">
        {[0, 1].map((i) => (
          <section key={i}>
            <div className="mb-3 h-4 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((j) => (
                <div key={j} className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
