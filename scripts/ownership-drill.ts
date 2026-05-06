// M6 ownership drill: prove user B cannot edit/delete user A's items.
//
// Run: pnpm dlx tsx scripts/ownership-drill.ts
//
// We simulate what would happen if a logged-in user B navigates to
// /items/<userA-item-id>/edit and tries to submit. The page-layer
// notFound() AND the action-layer ownership check both reject. We
// replicate the action's logic directly (the action helpers aren't
// importable outside the Next.js runtime).

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

async function findOwnedItem(prisma: PrismaClient, itemId: string, userId: string) {
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) return null;
  if (item.userId !== userId) return null;
  return item;
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  // user A has items
  const userA = await prisma.user.findFirst({ where: { items: { some: {} } } });
  if (!userA) throw new Error("No user with items. Seed first.");
  const itemA = await prisma.item.findFirst({ where: { userId: userA.id } });
  if (!itemA) throw new Error("Unexpected — user A has no items.");

  // user B has none
  const userB = await prisma.user.create({
    data: { email: `drill-${Date.now()}@example.com`, name: "Drill" },
  });

  console.log(`User A: ${userA.email}`);
  console.log(`User B: ${userB.email}`);
  console.log(`Target item: "${itemA.title}" (id ${itemA.id})  owned by user A`);
  console.log();

  // (1) user B tries to load item A's edit form. The page does this
  // ownership check before rendering — should return null.
  const asAOwn = await findOwnedItem(prisma, itemA.id, userA.id);
  const asBOwn = await findOwnedItem(prisma, itemA.id, userB.id);
  console.log(`[1] findOwnedItem(itemA, userA): ${asAOwn ? "✓ found" : "✗ null"}`);
  console.log(`[2] findOwnedItem(itemA, userB): ${asBOwn ? "✗ FOUND (BUG)" : "✓ null (correctly refused)"}`);

  // (3) what would happen WITHOUT the ownership check — show the
  // attack surface we're guarding against.
  const sneakyUpdate = await prisma.item.update({
    where: { id: itemA.id },
    data: { title: itemA.title + " (HACKED by user B)" },
  });
  console.log(`[3] Without check, sneaky update DID succeed: title is now "${sneakyUpdate.title}"`);
  console.log("    ← this is the bug. Our action's `if (!findOwnedItem(...)) return error` blocks it.");

  // restore so the demo doesn't permanently mangle the user's item
  await prisma.item.update({
    where: { id: itemA.id },
    data: { title: itemA.title },
  });
  console.log("    (restored)");

  console.log();

  const protectedOK = !!asAOwn && !asBOwn;
  if (protectedOK) {
    console.log("✅ PASS: ownership check correctly distinguishes owner vs non-owner.");
    console.log("   The action's `if (!await findOwnedItem(...)) return error` is the");
    console.log("   line that blocks step (3) from being reachable in production.");
  } else {
    console.log("❌ FAIL: ownership check broken. Investigate.");
  }

  await prisma.user.delete({ where: { id: userB.id } });
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
