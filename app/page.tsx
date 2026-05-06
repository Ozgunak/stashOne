export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 dark:bg-black">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-6xl font-bold tracking-tight text-black dark:text-zinc-50">
          Stash
        </h1>
        <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
          Your personal media tracker. Books, movies, shows — everything you&apos;ve loved or want to.
        </p>
      </div>
    </main>
  );
}
