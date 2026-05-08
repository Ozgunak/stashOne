"use server";

// Server actions for the favorites feature.
//
// Three security checks IN ORDER (the same pattern from Stash M5/M6,
// applied to the NHL domain):
//   1. AUTH       — `await auth()` resolves the session
//   2. VALIDATION — Zod parses the input shape
//   3. OWNERSHIP  — `userId` always comes from the session, never the
//                   client. The DB's compound unique
//                   `@@unique([userId, kind, externalId])` is the
//                   final defense against duplicates under concurrent
//                   submissions.

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { FavoriteKind } from "@/generated/prisma/enums";

const toggleSchema = z.object({
  kind: z.enum(["TEAM", "PLAYER"]),
  externalId: z.coerce.number().int(),
});

export type ToggleResult =
  | { ok: true; favorited: boolean }
  | { ok: false; error: string };

export async function toggleFavoriteAction(
  input: { kind: FavoriteKind; externalId: number },
): Promise<ToggleResult> {
  // 1. AUTH
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }
  const userId = session.user.id;

  // 2. VALIDATION
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { kind, externalId } = parsed.data;

  // 3. Toggle: if a favorite row exists for (userId, kind, externalId),
  // delete it; otherwise create it. We rely on the compound unique
  // constraint to keep this race-safe — a concurrent duplicate insert
  // would fail at the DB layer and we'd treat it as "already favorited."
  const existing = await prisma.userFavorite.findUnique({
    where: {
      userId_kind_externalId: { userId, kind, externalId },
    },
  });

  if (existing) {
    await prisma.userFavorite.delete({ where: { id: existing.id } });
    revalidatePath("/favorites");
    return { ok: true, favorited: false };
  }

  try {
    await prisma.userFavorite.create({
      data: { userId, kind, externalId },
    });
  } catch (err) {
    // P2002 = unique constraint violation. Race condition: another
    // request created it between our findUnique and create. Treat as
    // "already favorited."
    if (err instanceof Error && err.message.includes("P2002")) {
      return { ok: true, favorited: true };
    }
    throw err;
  }

  revalidatePath("/favorites");
  return { ok: true, favorited: true };
}
