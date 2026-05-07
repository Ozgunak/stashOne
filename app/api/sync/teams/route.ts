// /api/sync/teams — pulls standings from NHL API, upserts Team rows.
// Authenticated via CRON_SECRET. Idempotent.
//
// Standings includes per-team record (W/L/OTL/PTS/GF/GA) plus division
// info, so this single sync covers both "team identity" and "current
// standings" in one upsert.

import { prisma } from "@/lib/prisma";
import { getStandings } from "@/lib/nhl/client";
import { checkCronAuth, runWithSyncLog } from "@/lib/sync/run-sync";

// Synthetic externalId until we wire up the /v1/teams endpoint that has
// real NHL ids. Mirrors the seed script's logic so existing rows keep
// matching.
function syntheticExternalId(abbr: string): number {
  return -1 * Array.from(abbr).reduce((acc, c) => acc * 31 + c.charCodeAt(0), 7);
}

export async function POST(req: Request) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  try {
    const result = await runWithSyncLog("TEAMS", async () => {
      const { standings } = await getStandings();

      let processed = 0;
      // Sequential to keep things calm — 32 upserts is fast enough.
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
        processed++;
      }
      return processed;
    });

    return Response.json(result);
  } catch (err) {
    return Response.json(
      { ok: false, kind: "TEAMS", error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

// Allow GET as well — easier for browser-poking and for some cron
// services that prefer GET. Same auth check applies.
export const GET = POST;
