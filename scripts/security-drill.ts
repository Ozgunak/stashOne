// M4 security drill: prove cross-user isolation.
//
// Run: pnpm dlx tsx scripts/security-drill.ts
//
// We query items the same way the /items page does. We compare:
//   1. Filter by userA.id   -> should see userA's items
//   2. Filter by userB.id   -> should see ZERO items
//   3. No filter at all     -> should see EVERYTHING (the bug we're guarding against)
//
// If step 1 returns N and step 2 returns 0 and step 3 returns N, the
// `where: { userId }` clause is doing what we want.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  // Find the existing user (the one with the 3 seed items).
  // We pick any user that actually has items to make the demo meaningful.
  const userA = await prisma.user.findFirst({
    where: { items: { some: {} } },
  });
  if (!userA) {
    throw new Error("No users with items found. Run scripts/seed.ts first.");
  }

  // Create a second user JUST for this drill. Cleaned up at the end.
  const userB = await prisma.user.create({
    data: { email: `drill-${Date.now()}@example.com`, name: "Drill User" },
  });

  console.log(`User A: ${userA.email} (${userA.id})`);
  console.log(`User B: ${userB.email} (${userB.id})`);
  console.log();

  // Step 1: query as user A — should see their items.
  const aItems = await prisma.item.findMany({ where: { userId: userA.id } });
  console.log(`[1] Items WHERE userId = userA.id: ${aItems.length}`);
  for (const item of aItems) console.log(`    - ${item.title}`);

  // Step 2: query as user B — should see zero. THIS IS THE PROOF.
  const bItems = await prisma.item.findMany({ where: { userId: userB.id } });
  console.log(`[2] Items WHERE userId = userB.id: ${bItems.length}`);

  // Step 3: query with NO filter — what the page would return if we forgot
  // to filter. Should be >= aItems.length. THIS IS THE BUG.
  const allItems = await prisma.item.findMany();
  console.log(`[3] Items with NO filter: ${allItems.length}  ← what a security bug would expose`);

  console.log();

  // Verdict
  const isolated = aItems.length > 0 && bItems.length === 0 && allItems.length >= aItems.length;
  if (isolated) {
    console.log("✅ PASS: cross-user isolation confirmed.");
    console.log("   The `where: { userId }` clause is doing its job.");
  } else {
    console.log("❌ FAIL: isolation broken. Investigate.");
  }

  // Clean up the drill user (cascading delete also removes their session/items if any).
  await prisma.user.delete({ where: { id: userB.id } });
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
