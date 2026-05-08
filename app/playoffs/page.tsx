// /playoffs — current playoff bracket. Calls the NHL API directly
// because we don't sync this into Postgres (small, infrequently changing,
// only relevant during 2 months a year).
//
// Layout: rounds as horizontal columns. Round 1 (8 series) on the left,
// then 4, then 2, then 1 (Stanley Cup Final). On mobile: stacks
// vertically.
//
// Out-of-season: NHL returns 200 with empty rounds. We render a friendly
// "between seasons" placeholder.

import Image from "next/image";

import { getPlayoffBracket, NhlApiError } from "@/lib/nhl/client";
import type { PlayoffBracketResponse } from "@/lib/nhl/schemas";

export const metadata = { title: "Playoffs" };
// 5-minute cache: series scores update only when games end.
export const revalidate = 300;

// The current playoff season. Update at season rollover (or auto-derive
// later). 2025-26 playoffs run April-June 2026.
const PLAYOFF_SEASON = "20252026";

type Series = PlayoffBracketResponse["rounds"][number]["series"][number];

export default async function PlayoffsPage() {
  let bracket: PlayoffBracketResponse | null = null;
  let error: string | null = null;

  try {
    bracket = await getPlayoffBracket(PLAYOFF_SEASON);
  } catch (err) {
    if (err instanceof NhlApiError) {
      error = `${err.kind}: ${err.message}`;
    } else {
      error = err instanceof Error ? err.message : "Unknown error";
    }
    console.error("[/playoffs] bracket fetch failed:", err);
  }

  // No bracket data yet (fetch failed or season hasn't started).
  if (!bracket || bracket.rounds.length === 0) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Playoffs
        </h1>
        <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
          <p className="text-base font-medium text-black dark:text-zinc-50">
            {error ? "Couldn't load the bracket." : "No active playoffs."}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {error
              ? "The NHL API may be temporarily unavailable. Try refreshing."
              : "Playoffs run April–June. Out-of-season this page will be empty."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Playoffs {bracket.seasonId.toString().slice(0, 4)}–{bracket.seasonId.toString().slice(4)}
        </h1>
        {bracket.currentRound != null && (
          <span className="text-sm text-zinc-500 dark:text-zinc-500">
            Round {bracket.currentRound} of 4
          </span>
        )}
      </div>

      {/*
        Horizontal scroll on mobile, grid on desktop. Each round is a
        column whose width is fixed (sm:flex-1). On phone you'll
        side-scroll through the rounds; on desktop they all fit.
      */}
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-4 sm:min-w-0">
          {bracket.rounds.map((round) => (
            <div key={round.roundNumber} className="flex w-72 shrink-0 flex-col gap-3 sm:w-auto sm:flex-1">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {round.roundLabel.replace("-", " ")}
              </h2>
              <div className="flex flex-1 flex-col justify-around gap-3">
                {round.series.length === 0 ? (
                  <div className="rounded-md border border-dashed border-zinc-300 p-3 text-center text-xs text-zinc-500 dark:border-zinc-700">
                    TBD
                  </div>
                ) : (
                  round.series.map((s) => <SeriesCard key={s.seriesLetter} series={s} />)
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function SeriesCard({ series }: { series: Series }) {
  const top = series.topSeed;
  const bottom = series.bottomSeed;
  const winnerId = series.winningTeamId;
  const isComplete = winnerId != null;
  const neededToWin = series.neededToWin ?? 4;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <SeedRow seed={top} winningId={winnerId} neededToWin={neededToWin} isComplete={isComplete} />
      <div className="my-1 h-px bg-zinc-100 dark:bg-zinc-900" />
      <SeedRow seed={bottom} winningId={winnerId} neededToWin={neededToWin} isComplete={isComplete} />
      {!isComplete && (top?.wins != null || bottom?.wins != null) && (
        <p className="mt-2 text-center text-[10px] uppercase tracking-wider text-zinc-500">
          Best of {neededToWin * 2 - 1}
        </p>
      )}
    </div>
  );
}

function SeedRow({
  seed,
  winningId,
  neededToWin,
  isComplete,
}: {
  seed: Series["topSeed"];
  winningId: number | undefined;
  neededToWin: number;
  isComplete: boolean;
}) {
  if (!seed) {
    return (
      <div className="flex items-center gap-2 py-1 text-sm text-zinc-400">
        <div className="h-6 w-6 shrink-0 rounded bg-zinc-100 dark:bg-zinc-900" />
        <span className="font-mono text-xs">TBD</span>
      </div>
    );
  }

  const isWinner = isComplete && seed.id === winningId;
  const advancing = seed.wins >= neededToWin;

  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <div className="flex items-center gap-2 min-w-0">
        {seed.logo && (
          <Image src={seed.logo} alt="" width={24} height={24} className="shrink-0" />
        )}
        <span
          className={`text-sm ${
            advancing
              ? "font-semibold text-black dark:text-zinc-50"
              : "text-zinc-600 dark:text-zinc-400"
          }`}
        >
          {seed.abbrev ?? "TBD"}
        </span>
        {isWinner && (
          <span className="rounded bg-emerald-100 px-1 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            ✓
          </span>
        )}
      </div>
      <span
        className={`font-mono text-sm ${
          advancing
            ? "font-bold text-black dark:text-zinc-50"
            : "text-zinc-500"
        }`}
      >
        {seed.wins}
      </span>
    </div>
  );
}
