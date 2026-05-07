// /teams — table of all 32 NHL teams with current standings.
//
// Right now this page calls getStandings() directly on every request.
// In N6, we'll swap the data source to Postgres (synced from this same
// endpoint by Vercel Cron). The UI doesn't change; only the data layer.

import Link from "next/link";

import { getStandings } from "@/lib/nhl/client";

export const metadata = { title: "Teams" };

// Cache the response for 10 minutes. Without `revalidate`, Next would
// either fetch on every request (slow) or never (stale). 10min is a
// reasonable middle ground until N6 replaces this with DB reads.
export const revalidate = 600;

export default async function TeamsPage() {
  const { standings } = await getStandings();

  // Sort by conference, division, then division rank (the API already
  // returns them sorted, but be defensive).
  const sorted = [...standings].sort((a, b) => {
    if (a.conferenceName !== b.conferenceName) {
      return a.conferenceName.localeCompare(b.conferenceName);
    }
    if (a.divisionName !== b.divisionName) {
      return a.divisionName.localeCompare(b.divisionName);
    }
    return b.points - a.points;
  });

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          NHL Teams
        </h1>
        <span className="text-sm text-zinc-500 dark:text-zinc-500">
          {sorted.length} teams
        </span>
      </div>

      {/*
        Table wrapper is overflow-x-auto so on phone the user can scroll
        horizontally. This is the standard pattern for data-dense tables —
        much better than trying to make every column fit on a 375px screen.
      */}
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
            {sorted.map((t) => {
              const abbr = t.teamAbbrev.default;
              return (
                <tr
                  key={abbr}
                  className="bg-white hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                >
                  <td className="px-4 py-2">
                    <Link
                      href={`/teams/${abbr}`}
                      className="flex items-center gap-3 text-black hover:underline dark:text-zinc-50"
                    >
                      {t.teamLogo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={t.teamLogo}
                          alt=""
                          width={28}
                          height={28}
                          className="shrink-0"
                        />
                      )}
                      <span className="flex flex-col">
                        <span className="font-semibold">
                          {t.teamName.default}
                        </span>
                        <span className="font-mono text-xs text-zinc-500">
                          {abbr}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                    {t.conferenceAbbrev}
                  </td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                    {t.divisionName}
                  </td>
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
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-500">
        Data refreshes every 10 minutes from the NHL API. (In N6 we&apos;ll move
        this to a scheduled sync into Postgres.)
      </p>
    </main>
  );
}
