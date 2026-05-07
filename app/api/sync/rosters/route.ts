// /api/sync/rosters — for each team, pulls roster, upserts Player rows.
//
// Idempotent: keyed by Player.externalId. Re-running just refreshes
// fields. Players are linked to teams via Team.id (resolved from abbr).

import { prisma } from "@/lib/prisma";
import { getStandings, getRoster } from "@/lib/nhl/client";
import type { Position } from "@/generated/prisma/enums";
import { checkCronAuth, runWithSyncLog } from "@/lib/sync/run-sync";

// Hardcoded until the 2025-26 season starts in October; see seed script.
const ROSTER_SEASON = "20242025";

const POSITION_MAP: Record<"C" | "L" | "R" | "D" | "G", Position> = {
  C: "C",
  L: "LW",
  R: "RW",
  D: "D",
  G: "G",
};

export async function POST(req: Request) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  try {
    const result = await runWithSyncLog("ROSTERS", async () => {
      const { standings } = await getStandings();

      // Build a map: abbreviation -> Team.id. The teams sync (which runs
      // first in /api/sync/daily) ensures these rows exist.
      const teams = await prisma.team.findMany({ select: { id: true, abbreviation: true } });
      const teamIdByAbbr = new Map(teams.map((t) => [t.abbreviation, t.id]));

      let processed = 0;

      for (const s of standings) {
        const abbr = s.teamAbbrev.default;
        const teamId = teamIdByAbbr.get(abbr);
        if (!teamId) continue; // shouldn't happen if /sync/teams ran first

        let roster;
        try {
          roster = await getRoster(abbr, ROSTER_SEASON);
        } catch (err) {
          // Don't fail the whole sync if one team's roster errors.
          // Log via console; SyncRun captures the broader error.
          console.warn(`[sync/rosters] ${abbr} roster failed:`, err instanceof Error ? err.message : err);
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

        processed += players.length;
      }
      return processed;
    });

    return Response.json(result);
  } catch (err) {
    return Response.json(
      { ok: false, kind: "ROSTERS", error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export const GET = POST;
