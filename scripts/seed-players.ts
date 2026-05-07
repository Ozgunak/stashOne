// One-off seed: pulls all 32 NHL teams + their full rosters via the
// NHL unofficial API, upserts into Postgres.
//
// This is functionally identical to what the cron job in N6 will do —
// just invoked manually. Run after N5 ships:
//
//   pnpm dlx tsx scripts/seed-players.ts
//
// Idempotent: re-running updates existing rows by externalId. No
// duplicates created. Safe to run as many times as you like.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Position } from "../generated/prisma/client";
import { getStandings, getRoster } from "../lib/nhl/client";

const ROSTER_SEASON = "20242025"; // last completed regular season

// NHL roster positionCode -> Prisma Position enum.
// API uses L/R; our enum uses LW/RW.
const POSITION_MAP: Record<"C" | "L" | "R" | "D" | "G", Position> = {
  C: "C",
  L: "LW",
  R: "RW",
  D: "D",
  G: "G",
};

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  // ---------- Teams ----------
  console.log("Fetching standings (team list + division info)...");
  const { standings } = await getStandings();

  // Standings doesn't include NHL's numeric team id (`externalId`). We
  // synthesize a stable id by hashing the abbreviation. Sync from the
  // /teams endpoint (which DOES have ids) is N6's job; this is enough
  // to make the player FK valid.
  const teamRowsByAbbr = new Map<string, { id: string; externalId: number }>();

  for (const t of standings) {
    const abbr = t.teamAbbrev.default;
    // Stable synthetic externalId: 4-char abbreviation hashed to a small int.
    // Negative range so it can't collide with future real NHL team ids.
    const synthExternalId = -1 * Array.from(abbr).reduce(
      (acc, c) => acc * 31 + c.charCodeAt(0),
      7,
    );

    const team = await prisma.team.upsert({
      where: { abbreviation: abbr },
      update: {
        name: t.teamName.default,
        conference: t.conferenceName,
        division: t.divisionName,
        logoUrl: t.teamLogo ?? null,
      },
      create: {
        externalId: synthExternalId,
        abbreviation: abbr,
        name: t.teamName.default,
        conference: t.conferenceName,
        division: t.divisionName,
        logoUrl: t.teamLogo ?? null,
      },
    });

    teamRowsByAbbr.set(abbr, { id: team.id, externalId: team.externalId });
  }
  console.log(`  ✓ ${teamRowsByAbbr.size} teams upserted`);

  // ---------- Players ----------
  console.log(`Fetching rosters for ${ROSTER_SEASON}...`);

  let totalPlayers = 0;
  for (const t of standings) {
    const abbr = t.teamAbbrev.default;
    const teamRow = teamRowsByAbbr.get(abbr);
    if (!teamRow) continue;

    let roster;
    try {
      roster = await getRoster(abbr, ROSTER_SEASON);
    } catch (err) {
      console.warn(`  ! ${abbr}: roster fetch failed`, err instanceof Error ? err.message : err);
      continue;
    }

    const allPlayers = [...roster.forwards, ...roster.defensemen, ...roster.goalies];

    // Process the roster in parallel for one team. Limited concurrency
    // is fine — Prisma/Neon handle it; we don't need a queue here.
    await Promise.all(
      allPlayers.map((p) =>
        prisma.player.upsert({
          where: { externalId: p.id },
          update: {
            firstName: p.firstName.default,
            lastName: p.lastName.default,
            fullName: `${p.firstName.default} ${p.lastName.default}`,
            position: POSITION_MAP[p.positionCode],
            jerseyNumber: p.sweaterNumber ?? null,
            headshotUrl: p.headshot ?? null,
            teamId: teamRow.id,
          },
          create: {
            externalId: p.id,
            firstName: p.firstName.default,
            lastName: p.lastName.default,
            fullName: `${p.firstName.default} ${p.lastName.default}`,
            position: POSITION_MAP[p.positionCode],
            jerseyNumber: p.sweaterNumber ?? null,
            headshotUrl: p.headshot ?? null,
            teamId: teamRow.id,
          },
        }),
      ),
    );

    totalPlayers += allPlayers.length;
    console.log(`  ✓ ${abbr}: ${allPlayers.length} players`);
  }

  console.log();
  console.log(`Done. Total players: ${totalPlayers}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
