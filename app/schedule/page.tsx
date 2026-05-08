// /schedule — upcoming games for the next 7 days, grouped by day.
//
// Data: all from Postgres (sync pipeline keeps it fresh). We filter
// status NOT IN (FINAL, POSTPONED) to show "upcoming or live."

import Image from "next/image";
import Link from "next/link";

import { prisma } from "@/lib/prisma";
import LocalTime from "@/components/local-time";

export const metadata = { title: "Schedule" };
export const dynamic = "force-dynamic";

const WINDOW_DAYS = 7;

// Group games by their UTC date (YYYY-MM-DD). We pick UTC because the
// games come back sorted by gameTimeUtc; all games within one UTC day
// land in the same bucket. A game at 11pm ET on Monday is in Tuesday
// UTC, which is fine — the day header reads in local time anyway.
type GameRow = Awaited<ReturnType<typeof getGames>>[number];

async function getGames() {
  const now = new Date();
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + WINDOW_DAYS);

  return prisma.game.findMany({
    where: {
      gameTimeUtc: { gte: now, lte: end },
      status: { in: ["SCHEDULED", "LIVE"] },
    },
    orderBy: { gameTimeUtc: "asc" },
    select: {
      id: true,
      externalId: true,
      gameTimeUtc: true,
      status: true,
      isPlayoff: true,
      homeTeam: { select: { abbreviation: true, name: true, logoUrl: true } },
      awayTeam: { select: { abbreviation: true, name: true, logoUrl: true } },
    },
  });
}

function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function SchedulePage() {
  const games = await getGames();

  // Group by UTC date.
  const byDay = new Map<string, GameRow[]>();
  for (const g of games) {
    const key = ymdUtc(g.gameTimeUtc);
    const list = byDay.get(key) ?? [];
    list.push(g);
    byDay.set(key, list);
  }
  const dayKeys = Array.from(byDay.keys()).sort();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Schedule
        </h1>
        <span className="text-sm text-zinc-500 dark:text-zinc-500">
          Next {WINDOW_DAYS} days · {games.length} games
        </span>
      </div>

      {games.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
          <p className="text-base font-medium text-black dark:text-zinc-50">
            No games scheduled in the next {WINDOW_DAYS} days.
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Probably offseason, or the daily sync hasn&apos;t ingested upcoming
            games yet.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {dayKeys.map((day) => (
            <section key={day}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                <LocalTime date={day + "T00:00:00Z"} format="date" />
              </h2>
              <ul className="space-y-2">
                {byDay.get(day)!.map((g) => (
                  <GameRowItem key={g.id} game={g} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

function GameRowItem({ game }: { game: GameRow }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-3">
        <TeamCell logo={game.awayTeam.logoUrl} abbr={game.awayTeam.abbreviation} name={game.awayTeam.name} />
        <span className="text-xs font-mono text-zinc-400">@</span>
        <TeamCell logo={game.homeTeam.logoUrl} abbr={game.homeTeam.abbreviation} name={game.homeTeam.name} />
      </div>
      <div className="flex items-center gap-3 text-sm">
        {game.isPlayoff && (
          <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Playoff
          </span>
        )}
        {game.status === "LIVE" && (
          <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
            LIVE
          </span>
        )}
        <span className="text-zinc-600 dark:text-zinc-400">
          <LocalTime date={game.gameTimeUtc} format="time" />
        </span>
      </div>
    </li>
  );
}

function TeamCell({ logo, abbr, name }: { logo: string | null; abbr: string; name: string }) {
  return (
    <Link
      href={`/teams/${abbr}`}
      className="flex items-center gap-2 text-sm hover:underline"
    >
      {logo && (
        <Image src={logo} alt="" width={24} height={24} className="shrink-0" />
      )}
      <span className="font-mono text-xs text-zinc-500">{abbr}</span>
      <span className="hidden font-medium text-black sm:inline dark:text-zinc-50">
        {name}
      </span>
    </Link>
  );
}
