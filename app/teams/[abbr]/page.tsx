// /teams/[abbr] — detail page. DB-backed (N6 switchover).
//
// Roster comes from Player rows whose teamId matches; standings come
// from the team row itself. Both kept fresh by the daily cron sync.

import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";

export const metadata = { title: "Team" };
export const dynamic = "force-dynamic";

const POSITION_LABEL: Record<"C" | "LW" | "RW" | "D" | "G", string> = {
  C: "Center",
  LW: "Left wing",
  RW: "Right wing",
  D: "Defense",
  G: "Goalie",
};

export default async function TeamPage({
  params,
}: {
  params: Promise<{ abbr: string }>;
}) {
  const { abbr } = await params;
  const upperAbbr = abbr.toUpperCase();

  const team = await prisma.team.findUnique({
    where: { abbreviation: upperAbbr },
    include: {
      players: {
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: {
          id: true,
          externalId: true,
          firstName: true,
          lastName: true,
          position: true,
          jerseyNumber: true,
          headshotUrl: true,
        },
      },
    },
  });

  if (!team) notFound();

  // Group players by position bucket.
  const forwards = team.players.filter((p) => p.position === "C" || p.position === "LW" || p.position === "RW");
  const defensemen = team.players.filter((p) => p.position === "D");
  const goalies = team.players.filter((p) => p.position === "G");
  const totalPlayers = team.players.length;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
      <Link
        href="/teams"
        className="mb-4 inline-block text-sm text-zinc-600 hover:underline dark:text-zinc-400"
      >
        ← All teams
      </Link>

      <header className="mb-6 flex items-center gap-4">
        {team.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.logoUrl} alt="" width={64} height={64} className="shrink-0" />
        )}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            {team.name}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {team.division ?? "—"} Division · {team.conference ?? "—"} Conference
          </p>
        </div>
      </header>

      <section className="mb-8 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-3 text-xs uppercase tracking-wider text-zinc-500">Standings</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-5">
          <Stat label="GP" value={team.gamesPlayed} />
          <Stat label="W–L–OTL" value={`${team.wins}–${team.losses}–${team.otLosses}`} />
          <Stat label="Points" value={team.points} highlight />
          <Stat label="Goals for" value={team.goalFor} />
          <Stat label="Goals against" value={team.goalAgainst} />
        </dl>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-black dark:text-zinc-50">Roster</h2>
          <span className="text-sm text-zinc-500">{totalPlayers} players</span>
        </div>

        {totalPlayers === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
            No roster data. Run the rosters sync to populate.
          </p>
        ) : (
          <div className="space-y-6">
            <RosterGroup label="Forwards" players={forwards} />
            <RosterGroup label="Defensemen" players={defensemen} />
            <RosterGroup label="Goalies" players={goalies} />
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd
        className={`mt-1 font-mono ${highlight ? "text-lg font-semibold text-black dark:text-zinc-50" : "text-base text-zinc-700 dark:text-zinc-300"}`}
      >
        {value}
      </dd>
    </div>
  );
}

type RosterPlayer = {
  id: string;
  externalId: number;
  firstName: string;
  lastName: string;
  position: "C" | "LW" | "RW" | "D" | "G";
  jerseyNumber: number | null;
  headshotUrl: string | null;
};

function RosterGroup({ label, players }: { label: string; players: RosterPlayer[] }) {
  if (players.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {label} ({players.length})
      </h3>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {players.map((p) => (
          <li key={p.id}>
            <Link
              href={`/players/${p.externalId}`}
              className="flex items-center gap-3 rounded-md border border-zinc-200 bg-white p-2 hover:border-black hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-50 dark:hover:bg-zinc-900"
            >
              {p.headshotUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.headshotUrl}
                  alt=""
                  width={40}
                  height={40}
                  className="shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800"
                />
              ) : (
                <div className="h-10 w-10 shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800" />
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-black dark:text-zinc-50">
                  {p.firstName} {p.lastName}
                </div>
                <div className="text-xs text-zinc-500">
                  {POSITION_LABEL[p.position]}
                  {p.jerseyNumber != null && ` · #${p.jerseyNumber}`}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
