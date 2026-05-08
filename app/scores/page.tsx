// /scores — completed games from the last 7 days.

import Image from "next/image";
import Link from "next/link";

import { prisma } from "@/lib/prisma";
import LocalTime from "@/components/local-time";
import LiveScores from "@/components/live-scores";

export const metadata = { title: "Scores" };
export const dynamic = "force-dynamic";

const WINDOW_DAYS = 7;

type GameRow = Awaited<ReturnType<typeof getGames>>[number];

async function getGames() {
  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - WINDOW_DAYS);

  return prisma.game.findMany({
    where: {
      gameTimeUtc: { gte: start, lte: now },
      status: "FINAL",
    },
    orderBy: { gameTimeUtc: "desc" }, // most recent first
    select: {
      id: true,
      externalId: true,
      gameTimeUtc: true,
      isPlayoff: true,
      homeScore: true,
      awayScore: true,
      homeTeam: { select: { abbreviation: true, name: true, logoUrl: true } },
      awayTeam: { select: { abbreviation: true, name: true, logoUrl: true } },
    },
  });
}

function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function ScoresPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const { demo: demoParam } = await searchParams;
  const demo = demoParam === "1";

  const games = await getGames();

  const byDay = new Map<string, GameRow[]>();
  for (const g of games) {
    const key = ymdUtc(g.gameTimeUtc);
    const list = byDay.get(key) ?? [];
    list.push(g);
    byDay.set(key, list);
  }
  // Most-recent day first.
  const dayKeys = Array.from(byDay.keys()).sort().reverse();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Scores
        </h1>
        <span className="text-sm text-zinc-500 dark:text-zinc-500">
          Last {WINDOW_DAYS} days · {games.length} games
        </span>
      </div>

      {/* Live scoreboard for today's games — SSE-driven, updates without
          full-page refresh. Renders even when there are no historical
          games this week (offseason). */}
      <LiveScores demo={demo} />

      {games.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
          <p className="text-base font-medium text-black dark:text-zinc-50">
            No completed games in the last {WINDOW_DAYS} days.
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Probably offseason. The cron will pick up scores during the season.
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
  // Decide which team is the winner for visual emphasis.
  const homeWon = (game.homeScore ?? 0) > (game.awayScore ?? 0);
  const awayWon = (game.awayScore ?? 0) > (game.homeScore ?? 0);

  return (
    <li className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <TeamScoreRow
            logo={game.awayTeam.logoUrl}
            abbr={game.awayTeam.abbreviation}
            name={game.awayTeam.name}
            score={game.awayScore}
            isWinner={awayWon}
          />
          <TeamScoreRow
            logo={game.homeTeam.logoUrl}
            abbr={game.homeTeam.abbreviation}
            name={game.homeTeam.name}
            score={game.homeScore}
            isWinner={homeWon}
          />
        </div>
        <div className="flex flex-col items-end gap-1 text-xs">
          <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            FINAL
          </span>
          {game.isPlayoff && (
            <span className="rounded-md bg-amber-100 px-2 py-0.5 font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              Playoff
            </span>
          )}
          <span className="text-zinc-500">
            <LocalTime date={game.gameTimeUtc} format="time" />
          </span>
        </div>
      </div>
    </li>
  );
}

function TeamScoreRow({
  logo,
  abbr,
  name,
  score,
  isWinner,
}: {
  logo: string | null;
  abbr: string;
  name: string;
  score: number | null;
  isWinner: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Link
        href={`/teams/${abbr}`}
        className={`flex items-center gap-2 text-sm hover:underline ${
          isWinner
            ? "font-semibold text-black dark:text-zinc-50"
            : "text-zinc-600 dark:text-zinc-400"
        }`}
      >
        {logo && (
          <Image src={logo} alt="" width={24} height={24} className="shrink-0" />
        )}
        <span className="font-mono text-xs text-zinc-500">{abbr}</span>
        <span className="hidden sm:inline">{name}</span>
      </Link>
      <span
        className={`font-mono ${
          isWinner ? "text-base font-bold text-black dark:text-zinc-50" : "text-zinc-500"
        }`}
      >
        {score ?? "—"}
      </span>
    </div>
  );
}
