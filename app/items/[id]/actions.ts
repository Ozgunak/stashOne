"use server";

// Server actions for an existing item: update + delete.
//
// THIS IS THE M6 SECURITY LESSON. Read every line.
//
// Each action checks THREE things:
//   1. AUTH       — there's a valid session
//   2. OWNERSHIP  — the item exists AND belongs to this user
//   3. VALIDATION — (update only) input is well-formed
//
// The ownership check is what makes URL tampering harmless. Without it,
// a signed-in user could go to /items/<someone-else-id>/edit, submit
// the form, and overwrite that other user's item. With it, the action
// returns "not found" before any DB write happens.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { itemInputSchema } from "@/lib/validations/item";
import type { ItemFormState } from "@/components/item-form";

// --- helper -----------------------------------------------------------

/**
 * Returns the item only if it exists AND belongs to the given user.
 * Returns null otherwise. Critically, we DON'T distinguish "not found"
 * from "not yours" — leaking that distinction would let an attacker
 * enumerate other users' item IDs.
 */
async function findOwnedItem(itemId: string, userId: string) {
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) return null;
  if (item.userId !== userId) return null;
  return item;
}

// --- update -----------------------------------------------------------

export async function updateItemAction(
  _prev: ItemFormState | undefined,
  formData: FormData,
): Promise<ItemFormState> {
  // 1. AUTH
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, errors: { _form: ["You must be signed in."] } };
  }

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { ok: false, errors: { _form: ["Missing item id."] } };
  }

  // 2. OWNERSHIP — before we even bother validating, refuse if this
  // isn't the user's item.
  const existing = await findOwnedItem(id, session.user.id);
  if (!existing) {
    return { ok: false, errors: { _form: ["Item not found."] } };
  }

  // 3. VALIDATION
  const raw = Object.fromEntries(formData.entries());
  const parsed = itemInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }

  await prisma.item.update({
    where: { id },
    data: parsed.data,
    // Note we DO NOT update userId. Even if the form somehow had one,
    // ownership is fixed at creation time.
  });

  revalidatePath("/items");
  redirect("/items");
}

// --- delete -----------------------------------------------------------

export type DeleteItemState =
  | { ok: true }
  | { ok: false; error: string };

export async function deleteItemAction(
  _prev: DeleteItemState | undefined,
  formData: FormData,
): Promise<DeleteItemState> {
  // 1. AUTH
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { ok: false, error: "Missing item id." };
  }

  // 2. OWNERSHIP
  const existing = await findOwnedItem(id, session.user.id);
  if (!existing) {
    // Same opaque "not found" whether it doesn't exist or isn't yours.
    return { ok: false, error: "Item not found." };
  }

  await prisma.item.delete({ where: { id } });

  revalidatePath("/items");
  return { ok: true };
}
