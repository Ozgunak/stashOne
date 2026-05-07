// /api/sync/scores — pulls completed/in-progress games for the last
// 3 days, updates Game rows with final scores and status.
//
// This is the "frequent" sync (every 30 min via cron) — what makes the
// scoreboard feel live. Reads getScores() per day for the window.

import { prisma } from "@/lib/prisma";
import { getScores } from "@/lib/nhl/client";
import type { GameStatus } from "@/generated/prisma/enums";
import { checkCronAuth, runWithSyncLog } from "@/lib/sync/run-sync";

const LOOKBACK_DAYS = 3;

function mapGameState(state: string): GameStatus {
  switch (state) {
    case "FUT":
    case "PRE":
      return "SCHEDULED";
    case "LIVE":
    case "CRIT":
      return "LIVE";
    case "FINAL":
    case "OFF":
      return "FINAL";
    case "PPD":
      return "POSTPONED";
    default:
      return "SCHEDULED";
  }
}

function* lastNDaysUtc(n: number): IterableIterator<string> {
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    yield d.toISOString().slice(0, 10);
  }
}

export async function POST(req: Request) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  try {
    const result = await runWithSyncLog("SCORES", async () => {
      let processed = 0;

      for (const ymd of lastNDaysUtc(LOOKBACK_DAYS)) {
        const day = await getScores(ymd);
        for (const g of day.games) {
          // Skip games we don't have in DB (schedule sync would have
          // created them; if it hasn't run yet, scores has nothing to
          // update). We update-only here; create is schedule's job.
          const result = await prisma.game.updateMany({
            where: { externalId: g.id },
            data: {
              status: mapGameState(g.gameState),
              homeScore: g.homeTeam.score ?? null,
              awayScore: g.awayTeam.score ?? null,
            },
          });
          processed += result.count;
        }
      }

      return processed;
    });

    return Response.json(result);
  } catch (err) {
    return Response.json(
      { ok: false, kind: "SCORES", error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export const GET = POST;
