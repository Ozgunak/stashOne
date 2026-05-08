// /standings — division-grouped standings, NHL.com-style.
//
// Layout: 4 boxes (Atlantic, Metropolitan, Central, Pacific). Within
// each, teams sorted by points desc. Top 3 of each division qualify
// for playoffs. Below, two wildcard slots from each conference (best
// remaining records). We mark the cutoff with a horizontal divider.
//
// Data: all from Team rows. The divisional grouping + wildcard logic
// is computed on the server.

import Link from "next/link";

import { prisma } from "@/lib/prisma";

export const metadata = { title: "Standings" };
export const dynamic = "force-dynamic";

type TeamRow = Awaited<ReturnType<typeof getTeams>>[number];

async function getTeams() {
  return prisma.team.findMany({
    orderBy: [{ conference: "asc" }, { division: "asc" }, { points: "desc" }],
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
}

export default async function StandingsPage() {
  const teams = await getTeams();

  // Group by conference -> division.
  const conferences = new Map<string, Map<string, TeamRow[]>>();
  for (const t of teams) {
    const conf = t.conference ?? "Unknown";
    const div = t.division ?? "Unknown";
    if (!conferences.has(conf)) conferences.set(conf, new Map());
    const divs = conferences.get(conf)!;
    if (!divs.has(div)) divs.set(div, []);
    divs.get(div)!.push(t);
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Standings
        </h1>
        <span className="text-sm text-zinc-500 dark:text-zinc-500">
          {teams.length} teams · top 3 per division qualify, plus 2 wildcards per conference
        </span>
      </div>

      {teams.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
          <p className="text-base font-medium text-black dark:text-zinc-50">
            No teams in the database.
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Run the daily sync (or visit /api/sync/daily with the CRON_SECRET).
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from(conferences.entries()).map(([conf, divisions]) => (
            <ConferenceBlock key={conf} conferenceName={conf} divisions={divisions} />
          ))}
        </div>
      )}
    </main>
  );
}

function ConferenceBlock({
  conferenceName,
  divisions,
}: {
  conferenceName: string;
  divisions: Map<string, TeamRow[]>;
}) {
  // Compute wildcard rankings: take everyone NOT in the top 3 of any
  // division, sort by points desc, top 2 are the wildcards.
  const wildcardCandidates: TeamRow[] = [];
  for (const teams of divisions.values()) {
    wildcardCandidates.push(...teams.slice(3));
  }
  wildcardCandidates.sort((a, b) => b.points - a.points);
  const wildcardSet = new Set(wildcardCandidates.slice(0, 2).map((t) => t.id));

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight text-black dark:text-zinc-50">
        {conferenceName}
      </h2>
      {Array.from(divisions.entries()).map(([divName, divTeams]) => (
        <DivisionBlock
          key={divName}
          divisionName={divName}
          teams={divTeams}
          wildcardSet={wildcardSet}
        />
      ))}
    </div>
  );
}

function DivisionBlock({
  divisionName,
  teams,
  wildcardSet,
}: {
  divisionName: string;
  teams: TeamRow[];
  wildcardSet: Set<string>;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
      <div className="bg-zinc-50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
        {divisionName}
      </div>
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wider text-zinc-500">
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="px-3 py-1.5 text-left">Team</th>
            <th className="px-2 py-1.5 text-right">GP</th>
            <th className="px-2 py-1.5 text-right">W</th>
            <th className="px-2 py-1.5 text-right">L</th>
            <th className="px-2 py-1.5 text-right">OTL</th>
            <th className="px-2 py-1.5 text-right font-semibold text-black dark:text-zinc-50">PTS</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t, i) => {
            // Top 3 = clinched division line; below 3 = wildcard candidate.
            const isTop3 = i < 3;
            const isWildcard = wildcardSet.has(t.id);
            // Border above first non-top-3 row to mark the playoff line.
            const borderTop = i === 3 ? "border-t-2 border-t-zinc-300 dark:border-t-zinc-700" : "";

            return (
              <tr
                key={t.id}
                className={`bg-white dark:bg-zinc-950 ${borderTop} ${
                  i > 0 && i !== 3 ? "border-t border-zinc-100 dark:border-zinc-900" : ""
                }`}
              >
                <td className="px-3 py-1.5">
                  <Link
                    href={`/teams/${t.abbreviation}`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    {t.logoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={t.logoUrl}
                        alt=""
                        width={20}
                        height={20}
                        className="shrink-0"
                      />
                    )}
                    <span className="font-mono text-xs text-zinc-500">
                      {i + 1}
                    </span>
                    <span
                      className={`font-medium ${
                        isTop3
                          ? "text-black dark:text-zinc-50"
                          : "text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      {t.name}
                    </span>
                    {isWildcard && (
                      <span className="rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                        WC
                      </span>
                    )}
                  </Link>
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-zinc-600 dark:text-zinc-400">
                  {t.gamesPlayed}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-zinc-600 dark:text-zinc-400">
                  {t.wins}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-zinc-600 dark:text-zinc-400">
                  {t.losses}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-zinc-600 dark:text-zinc-400">
                  {t.otLosses}
                </td>
                <td className="px-2 py-1.5 text-right font-mono font-semibold text-black dark:text-zinc-50">
                  {t.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
