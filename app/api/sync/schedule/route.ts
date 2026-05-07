// /api/sync/schedule — pulls upcoming games for the next 14 days,
// upserts Game rows. Also upserts Season rows as needed.
//
// Game.externalId = NHL's gamePk. Idempotent.

import { prisma } from "@/lib/prisma";
import { getSchedule } from "@/lib/nhl/client";
import type { GameStatus } from "@/generated/prisma/enums";
import { checkCronAuth, runWithSyncLog } from "@/lib/sync/run-sync";

const WINDOW_DAYS = 14;

// NHL's gameState codes -> our GameStatus enum.
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

// Today in YYYY-MM-DD (UTC). Cron runs in UTC so this is consistent.
function todayYmdUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  try {
    const result = await runWithSyncLog("SCHEDULE", async () => {
      const teams = await prisma.team.findMany({ select: { id: true, abbreviation: true } });
      const teamIdByAbbr = new Map(teams.map((t) => [t.abbreviation, t.id]));

      // Cache seasons we've upserted in this run so we don't double up.
      const seasonIdByExternal = new Map<string, string>();

      let processed = 0;
      const startYmd = todayYmdUtc();
      // Schedule endpoint returns a 7-day window from the requested date.
      // We cover WINDOW_DAYS by paging in one-week steps (only one extra
      // call needed for 14 days).
      const cursors: string[] = [];
      cursors.push(startYmd);
      const plus7 = new Date(startYmd + "T00:00:00Z");
      plus7.setUTCDate(plus7.getUTCDate() + 7);
      cursors.push(plus7.toISOString().slice(0, 10));

      for (const cursor of cursors) {
        const sched = await getSchedule(cursor);
        for (const day of sched.gameWeek) {
          for (const g of day.games) {
            const homeTeamId = teamIdByAbbr.get(g.homeTeam.abbrev);
            const awayTeamId = teamIdByAbbr.get(g.awayTeam.abbrev);
            if (!homeTeamId || !awayTeamId) continue;

            // Resolve / upsert Season.
            const seasonExt = String(g.season);
            let seasonId = seasonIdByExternal.get(seasonExt);
            if (!seasonId) {
              const start = new Date(parseInt(seasonExt.slice(0, 4)), 9, 1); // Oct 1
              const end = new Date(parseInt(seasonExt.slice(4)), 5, 30);     // Jun 30
              const season = await prisma.season.upsert({
                where: { externalId: seasonExt },
                update: {},
                create: {
                  externalId: seasonExt,
                  startDate: start,
                  endDate: end,
                  isPlayoffs: false, // schedule entries don't tell us; we treat per-game.
                },
              });
              seasonId = season.id;
              seasonIdByExternal.set(seasonExt, seasonId);
            }

            await prisma.game.upsert({
              where: { externalId: g.id },
              update: {
                gameTimeUtc: new Date(g.startTimeUTC),
                status: mapGameState(g.gameState),
                homeScore: g.homeTeam.score ?? null,
                awayScore: g.awayTeam.score ?? null,
                isPlayoff: g.gameType === 3,
              },
              create: {
                externalId: g.id,
                seasonId,
                homeTeamId,
                awayTeamId,
                gameTimeUtc: new Date(g.startTimeUTC),
                status: mapGameState(g.gameState),
                homeScore: g.homeTeam.score ?? null,
                awayScore: g.awayTeam.score ?? null,
                isPlayoff: g.gameType === 3,
              },
            });
            processed++;
          }
        }
      }

      return processed;
    });

    return Response.json(result);
  } catch (err) {
    return Response.json(
      { ok: false, kind: "SCHEDULE", error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export const GET = POST;
