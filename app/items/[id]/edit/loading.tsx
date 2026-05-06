// Skeleton for the edit page. Renders the rough shape of the form
// (one row of inputs) so the user sees something while the item loads.

export default function EditLoading() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-8">
      <div className="mb-6 h-7 w-32 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
      <div className="space-y-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i}>
            <div className="mb-2 h-4 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-9 w-full animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
          </div>
        ))}
      </div>
    </main>
  );
}
