// Homepage. Two states: signed out shows marketing copy + sign-in CTA
// (Header has the actual button). Signed in shows a personalized
// "View your stash" entry point.
//
// We deliberately removed the M2-era unfiltered `prisma.item.count()`
// because it was teaching the wrong pattern. Per-user data only ever
// gets queried from /items (where the userId filter actually lives).

import Link from "next/link";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 dark:bg-black">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-6xl font-bold tracking-tight text-black dark:text-zinc-50">
          Stash
        </h1>
        <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
          Your personal media tracker. Books, movies, shows — everything you&apos;ve loved or want to.
        </p>
        {session?.user ? (
          <Link
            href="/items"
            className="mt-4 rounded-md bg-black px-4 py-2 text-base font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
          >
            View your stash →
          </Link>
        ) : null}
      </div>
    </main>
  );
}
