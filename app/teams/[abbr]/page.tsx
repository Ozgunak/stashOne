// /teams/[abbr] — detail page for one team.
// Two parallel API calls: standings (for the record/division info) and
// roster (for the player list). Promise.all keeps it to one round-trip
// of latency, not two.
//
// If the abbreviation doesn't match a team, notFound() renders Next.js's
// default 404 UI.

import Link from "next/link";
import { notFound } from "next/navigation";

import { getStandings, getRoster } from "@/lib/nhl/client";

export const metadata = { title: "Team" };
export const revalidate = 600;

// During offseason, /roster/{abbr}/current returns empty. Hardcode last
// completed season until the 2025-2026 season starts in October. We can
// add smarter "find latest available season" logic later.
const ROSTER_SEASON = "20242025";

const POSITION_LABEL: Record<"C" | "L" | "R" | "D" | "G", string> = {
  C: "Center",
  L: "Left wing",
  R: "Right wing",
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

  // Fire both fetches in parallel.
  const [{ standings }, roster] = await Promise.all([
    getStandings(),
    getRoster(upperAbbr, ROSTER_SEASON),
  ]).catch((err) => {
    // Roster fetch can 404 for invalid abbreviation. Standings won't.
    // We rely on the standings-side filter below for the "real" 404
    // determination. If something else broke, re-throw.
    throw err;
  });

  const team = standings.find((s) => s.teamAbbrev.default === upperAbbr);
  if (!team) notFound();

  const totalPlayers =
    roster.forwards.length + roster.defensemen.length + roster.goalies.length;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
      <Link
        href="/teams"
        className="mb-4 inline-block text-sm text-zinc-600 hover:underline dark:text-zinc-400"
      >
        ← All teams
      </Link>

      {/* Header */}
      <header className="mb-6 flex items-center gap-4">
        {team.teamLogo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={team.teamLogo}
            alt=""
            width={64}
            height={64}
            className="shrink-0"
          />
        )}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            {team.teamName.default}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {team.divisionName} Division · {team.conferenceName} Conference
          </p>
        </div>
      </header>

      {/* Standings card */}
      <section className="mb-8 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-3 text-xs uppercase tracking-wider text-zinc-500">
          Last season ({ROSTER_SEASON.slice(0, 4)}–{ROSTER_SEASON.slice(4)})
        </h2>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-5">
          <Stat label="GP" value={team.gamesPlayed} />
          <Stat label="W–L–OTL" value={`${team.wins}–${team.losses}–${team.otLosses}`} />
          <Stat label="Points" value={team.points} highlight />
          <Stat label="Goals for" value={team.goalFor} />
          <Stat label="Goals against" value={team.goalAgainst} />
        </dl>
      </section>

      {/* Roster */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-black dark:text-zinc-50">Roster</h2>
          <span className="text-sm text-zinc-500">{totalPlayers} players</span>
        </div>

        {totalPlayers === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
            No roster data available for {ROSTER_SEASON}.
          </p>
        ) : (
          <div className="space-y-6">
            <RosterGroup label="Forwards" players={roster.forwards} />
            <RosterGroup label="Defensemen" players={roster.defensemen} />
            <RosterGroup label="Goalies" players={roster.goalies} />
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
  id: number;
  headshot?: string;
  firstName: { default: string };
  lastName: { default: string };
  sweaterNumber?: number;
  positionCode: "C" | "L" | "R" | "D" | "G";
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
          <li
            key={p.id}
            className="flex items-center gap-3 rounded-md border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950"
          >
            {p.headshot && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.headshot}
                alt=""
                width={40}
                height={40}
                className="shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800"
              />
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-black dark:text-zinc-50">
                {p.firstName.default} {p.lastName.default}
              </div>
              <div className="text-xs text-zinc-500">
                {POSITION_LABEL[p.positionCode]}
                {p.sweaterNumber != null && ` · #${p.sweaterNumber}`}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
