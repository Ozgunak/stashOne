// /api/sync/daily — orchestrator. Calls teams + rosters + schedule
// in sequence and returns a combined summary.
//
// We use this single endpoint as the cron trigger because Vercel Hobby
// caps cron jobs at 2 per project; the other slot is /api/sync/scores
// (every 30 min).
//
// Sequence matters:
//   1. teams   — must run first; rosters and schedule depend on Team rows
//   2. rosters — links players to teams
//   3. schedule — creates Game rows referencing teams + seasons
//
// Each child sync writes its own SyncRun row; this orchestrator also
// writes a DAILY SyncRun for the umbrella attempt. If any child fails,
// the orchestrator marks DAILY as failed but doesn't roll back the
// others — partial progress is fine for sync data.

import { prisma } from "@/lib/prisma";
import { getStandings, getRoster, getSchedule, getScores } from "@/lib/nhl/client";
import type { Position, GameStatus } from "@/generated/prisma/enums";
import { checkCronAuth, runWithSyncLog } from "@/lib/sync/run-sync";

const ROSTER_SEASON = "20242025";

const POSITION_MAP: Record<"C" | "L" | "R" | "D" | "G", Position> = {
  C: "C",
  L: "LW",
  R: "RW",
  D: "D",
  G: "G",
};

function syntheticExternalId(abbr: string): number {
  return -1 * Array.from(abbr).reduce((acc, c) => acc * 31 + c.charCodeAt(0), 7);
}

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

function todayYmdUtc(): string {
  return new Date().toISOString().slice(0, 10);
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
    const result = await runWithSyncLog("DAILY", async () => {
      let totalProcessed = 0;

      // ---- 1. Teams (with standings) ----
      const { standings } = await getStandings();
      for (const t of standings) {
        const abbr = t.teamAbbrev.default;
        await prisma.team.upsert({
          where: { abbreviation: abbr },
          update: {
            name: t.teamName.default,
            conference: t.conferenceName,
            division: t.divisionName,
            logoUrl: t.teamLogo ?? null,
            gamesPlayed: t.gamesPlayed,
            wins: t.wins,
            losses: t.losses,
            otLosses: t.otLosses,
            points: t.points,
            goalFor: t.goalFor,
            goalAgainst: t.goalAgainst,
          },
          create: {
            externalId: syntheticExternalId(abbr),
            abbreviation: abbr,
            name: t.teamName.default,
            conference: t.conferenceName,
            division: t.divisionName,
            logoUrl: t.teamLogo ?? null,
            gamesPlayed: t.gamesPlayed,
            wins: t.wins,
            losses: t.losses,
            otLosses: t.otLosses,
            points: t.points,
            goalFor: t.goalFor,
            goalAgainst: t.goalAgainst,
          },
        });
        totalProcessed++;
      }

      const teams = await prisma.team.findMany({ select: { id: true, abbreviation: true } });
      const teamIdByAbbr = new Map(teams.map((t) => [t.abbreviation, t.id]));

      // ---- 2. Rosters ----
      for (const s of standings) {
        const abbr = s.teamAbbrev.default;
        const teamId = teamIdByAbbr.get(abbr);
        if (!teamId) continue;

        let roster;
        try {
          roster = await getRoster(abbr, ROSTER_SEASON);
        } catch (err) {
          console.warn(`[sync/daily] ${abbr} roster failed:`, err instanceof Error ? err.message : err);
          continue;
        }

        const players = [...roster.forwards, ...roster.defensemen, ...roster.goalies];
        await Promise.all(
          players.map((p) =>
            prisma.player.upsert({
              where: { externalId: p.id },
              update: {
                firstName: p.firstName.default,
                lastName: p.lastName.default,
                fullName: `${p.firstName.default} ${p.lastName.default}`,
                position: POSITION_MAP[p.positionCode],
                jerseyNumber: p.sweaterNumber ?? null,
                headshotUrl: p.headshot ?? null,
                teamId,
              },
              create: {
                externalId: p.id,
                firstName: p.firstName.default,
                lastName: p.lastName.default,
                fullName: `${p.firstName.default} ${p.lastName.default}`,
                position: POSITION_MAP[p.positionCode],
                jerseyNumber: p.sweaterNumber ?? null,
                headshotUrl: p.headshot ?? null,
                teamId,
              },
            }),
          ),
        );
        totalProcessed += players.length;
      }

      // ---- 3. Schedule (next 14 days) ----
      const seasonIdByExternal = new Map<string, string>();
      const cursors: string[] = [todayYmdUtc()];
      const plus7 = new Date(cursors[0] + "T00:00:00Z");
      plus7.setUTCDate(plus7.getUTCDate() + 7);
      cursors.push(plus7.toISOString().slice(0, 10));

      for (const cursor of cursors) {
        const sched = await getSchedule(cursor);
        for (const day of sched.gameWeek) {
          for (const g of day.games) {
            const homeTeamId = teamIdByAbbr.get(g.homeTeam.abbrev);
            const awayTeamId = teamIdByAbbr.get(g.awayTeam.abbrev);
            if (!homeTeamId || !awayTeamId) continue;

            const seasonExt = String(g.season);
            let seasonId = seasonIdByExternal.get(seasonExt);
            if (!seasonId) {
              const start = new Date(parseInt(seasonExt.slice(0, 4)), 9, 1);
              const end = new Date(parseInt(seasonExt.slice(4)), 5, 30);
              const season = await prisma.season.upsert({
                where: { externalId: seasonExt },
                update: {},
                create: { externalId: seasonExt, startDate: start, endDate: end, isPlayoffs: false },
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
            totalProcessed++;
          }
        }
      }

      // ---- 4. Scores (recent 3-day lookback) ----
      // Updates the games inserted above with final scores when they
      // become available. Same logic as /api/sync/scores but inlined
      // here since Hobby plan caps cron jobs at 1 daily — we can't run
      // /api/sync/scores on its own schedule.
      for (const ymd of lastNDaysUtc(3)) {
        const day = await getScores(ymd);
        for (const g of day.games) {
          const result = await prisma.game.updateMany({
            where: { externalId: g.id },
            data: {
              status: mapGameState(g.gameState),
              homeScore: g.homeTeam.score ?? null,
              awayScore: g.awayTeam.score ?? null,
            },
          });
          totalProcessed += result.count;
        }
      }

      return totalProcessed;
    });

    return Response.json(result);
  } catch (err) {
    return Response.json(
      { ok: false, kind: "DAILY", error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export const GET = POST;
