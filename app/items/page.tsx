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
// M7 additions: query distinct user tags for the filter sidebar; if a
// `?tag=` search param is present, narrow the items query.

import Link from "next/link";
import { Suspense } from "react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ItemCard from "@/components/item-card";
import SearchInput from "@/components/search-input";

export const dynamic = "force-dynamic";

export const metadata = { title: "Your stash" };

export default async function ItemsPage({
  searchParams,
}: {
  // Next.js 15+ made searchParams a Promise.
  searchParams: Promise<{ tag?: string; q?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized: no session.user.id");
  }
  const userId = session.user.id;

  const { tag: rawTag, q: rawQ } = await searchParams;
  // Normalize to match how we store tags (lowercase + trim).
  const activeTag = rawTag?.trim().toLowerCase() || null;
  const query = rawQ?.trim() || null;

  // Two queries in parallel: items (optionally filtered/searched) + the
  // user's distinct tag list for the filter UI. Promise.all keeps both
  // round-trips concurrent — wins ~one network RTT at the DB layer.
  const [items, allTags] = await Promise.all([
    prisma.item.findMany({
      where: {
        userId,
        // Tag filter: only include items where the join table has a
        // matching tag for THIS user.
        ...(activeTag
          ? {
              tags: { some: { tag: { userId, name: activeTag } } },
            }
          : {}),
        // Search filter: case-insensitive substring across title + notes.
        // Prisma's `mode: 'insensitive'` becomes Postgres `ILIKE '%q%'`.
        ...(query
          ? {
              OR: [
                { title: { contains: query, mode: "insensitive" } },
                { notes: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        rating: true,
        notes: true,
        tags: { select: { tag: { select: { name: true } } } },
      },
    }),
    prisma.tag.findMany({
      where: { userId, items: { some: {} } }, // only tags actually used
      orderBy: { name: "asc" },
      select: { name: true },
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Your stash
          </h1>
          <span className="text-sm text-zinc-500 dark:text-zinc-500">
            {items.length} {items.length === 1 ? "item" : "items"}
            {activeTag && (
              <>
                {" "}
                tagged{" "}
                <span className="font-mono">#{activeTag}</span>
              </>
            )}
            {query && (
              <>
                {" "}
                matching <span className="font-mono">&ldquo;{query}&rdquo;</span>
              </>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/*
            Suspense around SearchInput because useSearchParams() is a
            client hook that suspends during static generation. We're
            already force-dynamic on this page, so it's belt-and-suspenders,
            but Next.js still wants the boundary in production builds.
          */}
          <Suspense fallback={null}>
            <SearchInput />
          </Suspense>
          <Link
            href="/items/new"
            className="shrink-0 rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
          >
            + New
          </Link>
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-zinc-500">Tags:</span>
          <Link
            href={query ? `/items?q=${encodeURIComponent(query)}` : "/items"}
            className={`rounded-md px-2 py-0.5 text-xs ${
              activeTag === null
                ? "bg-black text-white dark:bg-zinc-50 dark:text-black"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            All
          </Link>
          {allTags.map((t) => {
            const params = new URLSearchParams();
            params.set("tag", t.name);
            if (query) params.set("q", query);
            return (
              <Link
                key={t.name}
                href={`/items?${params.toString()}`}
                className={`rounded-md px-2 py-0.5 text-xs ${
                  activeTag === t.name
                    ? "bg-black text-white dark:bg-zinc-50 dark:text-black"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                #{t.name}
              </Link>
            );
          })}
        </div>
      )}

      {items.length === 0 ? (
        activeTag || query ? <NoMatches tag={activeTag} query={query} /> : <EmptyState />
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
              tags={item.tags.map((t) => t.tag.name)}
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

function NoMatches({ tag, query }: { tag: string | null; query: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
      <p className="text-base font-medium text-black dark:text-zinc-50">
        No items match
        {query && (
          <>
            {" "}
            <span className="font-mono">&ldquo;{query}&rdquo;</span>
          </>
        )}
        {query && tag && " and"}
        {tag && (
          <>
            {" "}
            <span className="font-mono">#{tag}</span>
          </>
        )}
        .
      </p>
      <Link href="/items" className="mt-2 text-sm text-zinc-600 hover:underline dark:text-zinc-400">
        Clear filters
      </Link>
    </div>
  );
}
