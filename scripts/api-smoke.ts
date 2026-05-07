// Smoke test: hits each wrapped NHL endpoint against the live API,
// validates with Zod, and prints a digest.
//
// Run: pnpm dlx tsx scripts/api-smoke.ts
//
// If a schema check fails, we get a clear error with the diff. If the
// API is offline, we get NhlApiError(kind="network"). The point of the
// script is to fail loud and quickly when reality drifts from our types.

import {
  getStandings,
  getRoster,
  getPlayer,
  getSchedule,
  getScores,
  NhlApiError,
} from "../lib/nhl/client";

async function tryStep<T>(label: string, fn: () => Promise<T>, render: (t: T) => string) {
  process.stdout.write(`▶ ${label} ... `);
  try {
    const result = await fn();
    console.log("OK");
    console.log("  ", render(result));
  } catch (err) {
    console.log("FAIL");
    if (err instanceof NhlApiError) {
      console.log(`   [${err.kind}] ${err.message}`);
    } else {
      console.log(`   ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

async function main() {
  // 1. Standings — we'll use this as our authoritative team list. Pick an
  // arbitrary team from the response just to confirm shape.
  await tryStep(
    "getStandings()",
    () => getStandings(),
    (s) => `${s.standings.length} teams, e.g. ${s.standings[0]?.teamAbbrev.default} (${s.standings[0]?.divisionName})`,
  );

  // 2. Roster — last completed season for safety (offseason has no current roster).
  await tryStep(
    "getRoster('EDM', '20242025')",
    () => getRoster("EDM", "20242025"),
    (r) =>
      `forwards=${r.forwards.length}, defensemen=${r.defensemen.length}, goalies=${r.goalies.length}; ` +
      `e.g. ${r.forwards[0]?.firstName.default} ${r.forwards[0]?.lastName.default}`,
  );

  // 3. Player landing — McDavid (8478402).
  await tryStep(
    "getPlayer(8478402)",
    () => getPlayer(8478402),
    (p) =>
      `${p.firstName.default} ${p.lastName.default} (${p.position}, ${p.currentTeamAbbrev ?? "unsigned"})`,
  );

  // 4. Schedule — pass a date that probably has games (mid-season).
  await tryStep(
    "getSchedule('2026-04-15')",
    () => getSchedule("2026-04-15"),
    (s) => {
      const totalGames = s.gameWeek.reduce((sum, day) => sum + day.games.length, 0);
      return `${s.gameWeek.length} days, ${totalGames} total games in window`;
    },
  );

  // 5. Scores — same date.
  await tryStep(
    "getScores('2026-04-15')",
    () => getScores("2026-04-15"),
    (s) => `${s.games.length} games on ${s.currentDate ?? "unknown date"}`,
  );

  console.log();
  console.log("✓ Smoke test complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
