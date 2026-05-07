// Homepage. Auth-gated all-routes model: if not signed in, the proxy
// redirects to /signin before this even renders. So we can assume the
// session exists here.
//
// This is the N1 placeholder. Real content lands as the milestones roll
// in — teams shortcut in N4, scoreboard in N7, favorites in N9, etc.

import Link from "next/link";

import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 dark:bg-black">
      <div className="flex max-w-xl flex-col items-center gap-4 text-center">
        <h1 className="text-6xl font-bold tracking-tight text-black dark:text-zinc-50">
          Stat Stacker
        </h1>
        <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
          NHL teams, players, schedule, scores — refreshed continuously from the
          unofficial NHL API. Foundation for a fantasy hockey league later.
        </p>

        <div className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">
          Signed in as <span className="font-mono">{session?.user?.email}</span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
          {/*
            Each card becomes a real link as its milestone lands.
            Placeholders show the upcoming milestone for the others.
          */}
          {[
            { label: "Teams", href: "/teams", ready: true },
            { label: "Players", milestone: "N5" },
            { label: "Schedule", milestone: "N7" },
            { label: "Scores", milestone: "N7" },
            { label: "Standings", milestone: "N7" },
            { label: "Playoffs", milestone: "N8" },
          ].map((p) =>
            p.ready ? (
              <Link
                key={p.label}
                href={p.href!}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-3 text-left hover:border-black hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-zinc-50 dark:hover:bg-zinc-900"
              >
                <div className="font-medium text-black dark:text-zinc-50">
                  {p.label} →
                </div>
                <div className="text-xs text-zinc-500">Browse</div>
              </Link>
            ) : (
              <div
                key={p.label}
                className="rounded-lg border border-dashed border-zinc-300 px-4 py-3 dark:border-zinc-700"
              >
                <div className="font-medium text-zinc-600 dark:text-zinc-400">
                  {p.label}
                </div>
                <div className="text-xs text-zinc-400 dark:text-zinc-500">
                  Coming in {p.milestone}
                </div>
              </div>
            ),
          )}
        </div>
      </div>
    </main>
  );
}
