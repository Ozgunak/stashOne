// /items — the signed-in user's media tracker.
//
// THIS IS THE M4 SECURITY LESSON. Read every line.
//
// The query MUST filter by userId on the server. Three layers of defense:
//   1. proxy.ts redirects unauthenticated users to /signin BEFORE this
//      page even renders (network-layer guard)
//   2. We re-check session here and refuse to render without a userId
//      (page-layer guard — defense in depth in case proxy ever misfires)
//   3. The Prisma query has `where: { userId }` (data-layer guard — the
//      one that actually keeps other users' data safe)
//
// Skipping any of the three is fine. Skipping the THIRD is the security
// hole the roadmap warns about. Without `where: { userId }`, an attacker
// who somehow bypassed the session check (or just signed in with a
// different account) would see EVERYONE's items.

import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ItemCard from "@/components/item-card";

// Force dynamic — this page reads per-user data, can't be cached at
// build time. Without this, Next.js might try to pre-render a single
// version of /items for everyone, which obviously breaks once items
// differ per user.
export const dynamic = "force-dynamic";

export default async function ItemsPage() {
  const session = await auth();

  // Hard guard. If we somehow got here without a session, refuse loudly
  // rather than silently showing nothing (which could mask bugs).
  // The proxy should have redirected already, but proxies have edge
  // cases (cache, race conditions on session expiry).
  if (!session?.user?.id) {
    throw new Error("Unauthorized: no session.user.id");
  }

  // The line that matters. `userId: session.user.id` filters at the
  // database level. Other users' rows never touch the response.
  const items = await prisma.item.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      rating: true,
      notes: true,
    },
  });

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Your stash
          </h1>
          <span className="text-sm text-zinc-500 dark:text-zinc-500">
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        </div>
        <Link
          href="/items/new"
          className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
        >
          + New item
        </Link>
      </div>

      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              id={item.id}
              title={item.title}
              type={item.type}
              status={item.status}
              rating={item.rating}
              notes={item.notes}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
      <p className="text-base font-medium text-black dark:text-zinc-50">
        No items yet.
      </p>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
        Track the books, movies, and shows you love.
      </p>
      <Link
        href="/items/new"
        className="mt-4 rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
      >
        Add your first item
      </Link>
    </div>
  );
}
