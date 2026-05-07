// /teams — table of all NHL teams with current standings.
//
// N6 SWITCHOVER: this page used to call getStandings() (the NHL API)
// directly on every render. Now it reads from Postgres, populated by
// the cron-driven sync at /api/sync/teams (or /api/sync/daily).
//
// The UI is identical. The only differences are:
//   1. The data source (prisma instead of fetch)
//   2. The freshness ceiling: one daily sync, so "current standings"
//      means "as of the last 3am UTC sync."
//   3. The page no longer makes an HTTP request to api-web.nhle.com,
//      so first-paint is much faster (~50ms vs ~500ms).
//
// This is the architecture lesson: the user-facing path never crosses
// the network to a service we don't control.

import Link from "next/link";

import { prisma } from "@/lib/prisma";

export const metadata = { title: "Teams" };
export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const teams = await prisma.team.findMany({
    orderBy: [
      { conference: "asc" },
      { division: "asc" },
      { points: "desc" },
    ],
    select: {
      id: true,
      abbreviation: true,
      name: true,
      conference: true,
      division: true,
      logoUrl: true,
      gamesPlayed: true,
      wins: true,
      losses: true,
      otLosses: true,
      points: true,
      goalFor: true,
      goalAgainst: true,
    },
  });

  // Conference abbreviation derived from name. Could be a column if we
  // cared; for now the standings response gives "Western"/"Eastern".
  const confAbbr = (name: string | null) => (name === "Western" ? "W" : name === "Eastern" ? "E" : "—");

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          NHL Teams
        </h1>
        <span className="text-sm text-zinc-500 dark:text-zinc-500">
          {teams.length} teams
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-2 text-left">Team</th>
              <th className="px-3 py-2 text-left">Conf</th>
              <th className="px-3 py-2 text-left">Division</th>
              <th className="px-3 py-2 text-right">GP</th>
              <th className="px-3 py-2 text-right">W</th>
              <th className="px-3 py-2 text-right">L</th>
              <th className="px-3 py-2 text-right">OTL</th>
              <th className="px-3 py-2 text-right font-semibold text-black dark:text-zinc-50">PTS</th>
              <th className="px-3 py-2 text-right">GF</th>
              <th className="px-3 py-2 text-right">GA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {teams.map((t) => (
              <tr
                key={t.id}
                className="bg-white hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
              >
                <td className="px-4 py-2">
                  <Link
                    href={`/teams/${t.abbreviation}`}
                    className="flex items-center gap-3 text-black hover:underline dark:text-zinc-50"
                  >
                    {t.logoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.logoUrl} alt="" width={28} height={28} className="shrink-0" />
                    )}
                    <span className="flex flex-col">
                      <span className="font-semibold">{t.name}</span>
                      <span className="font-mono text-xs text-zinc-500">{t.abbreviation}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{confAbbr(t.conference)}</td>
                <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{t.division ?? "—"}</td>
                <td className="px-3 py-2 text-right font-mono">{t.gamesPlayed}</td>
                <td className="px-3 py-2 text-right font-mono">{t.wins}</td>
                <td className="px-3 py-2 text-right font-mono">{t.losses}</td>
                <td className="px-3 py-2 text-right font-mono">{t.otLosses}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold text-black dark:text-zinc-50">
                  {t.points}
                </td>
                <td className="px-3 py-2 text-right font-mono">{t.goalFor}</td>
                <td className="px-3 py-2 text-right font-mono">{t.goalAgainst}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-500">
        Standings refreshed daily by background sync. (See SyncRun in
        Prisma Studio for run history.)
      </p>
    </main>
  );
}
