import { prisma } from "@/lib/prisma";

// `force-dynamic` tells Next.js to render this page on every request rather
// than caching it at build time — without this, the count would freeze at
// whatever the value was during deployment. We'll usually want dynamic
// rendering for any page that reads from the database.
export const dynamic = "force-dynamic";

// Server component (no "use client" directive). Runs ONLY on the server,
// can `await` Prisma queries directly, and ships zero JS to the browser.
// The HTML the browser receives already has the count baked in.
export default async function Home() {
  let countLine: string;
  try {
    const count = await prisma.item.count();
    countLine = `${count} items in the stash`;
  } catch (err) {
    // If the DB env var is missing or wrong, don't crash the homepage —
    // show a fallback so we can still see the deploy succeeded.
    console.error("Failed to count items:", err);
    countLine = "(could not reach the database)";
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 dark:bg-black">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-6xl font-bold tracking-tight text-black dark:text-zinc-50">
          Stash
        </h1>
        <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
          Your personal media tracker. Books, movies, shows — everything you&apos;ve loved or want to.
        </p>
        <p className="mt-4 font-mono text-sm text-zinc-500 dark:text-zinc-500">
          {countLine}
        </p>
      </div>
    </main>
  );
}
