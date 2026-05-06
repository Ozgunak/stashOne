"use server";

// Server action for creating a new Item.
//
// Three security checks IN ORDER. Skipping any one of them is a bug:
//
//   1. AUTH — `await auth()` resolves the session. If no session,
//      refuse. The proxy SHOULD have redirected, but defense-in-depth.
//
//   2. VALIDATION — itemInputSchema.safeParse() rejects anything that
//      isn't well-formed. This blocks attackers who curl the endpoint
//      directly. Returning early with { errors } gives the form its
//      field-level error messages.
//
//   3. OWNERSHIP — we set `userId: session.user.id` from the SERVER side,
//      never from form input. Even if the form sent a userId, we'd
//      ignore it. (This is the M6 lesson surfacing — never trust the
//      client to tell you who owns a record.)

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { itemInputSchema } from "@/lib/validations/item";
import type { ItemFormState } from "@/components/item-form";

export async function createItemAction(
  _prev: ItemFormState | undefined,
  formData: FormData,
): Promise<ItemFormState> {
  // (1) AUTH
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, errors: { _form: ["You must be signed in."] } };
  }
  const userId = session.user.id; // narrow once for closures below

  // (2) VALIDATION — convert FormData to a plain object first so Zod
  // can parse it. FormData values can be Files; we only care about strings.
  const raw = Object.fromEntries(formData.entries());
  const parsed = itemInputSchema.safeParse(raw);
  if (!parsed.success) {
    // Zod 4: error.flatten().fieldErrors → { title: ["..."], rating: ["..."] }
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }

  // (3) OWNERSHIP — userId comes from the SERVER session, never from form.
  // We split tags off from the rest of the item data because they live
  // in a separate table. Each tag is `connectOrCreate`d under the unique
  // constraint (userId, name) we set in schema.prisma — so the same tag
  // name typed on a second item reuses the existing Tag row.
  const { tags, ...itemData } = parsed.data;
  await prisma.item.create({
    data: {
      ...itemData,
      userId,
      tags: {
        create: tags.map((name) => ({
          tag: {
            connectOrCreate: {
              where: { userId_name: { userId, name } },
              create: { userId, name },
            },
          },
        })),
      },
    },
  });

  // Tell Next.js the /items page's data is stale. Without this, the user
  // would land back on /items and see the cached pre-creation list.
  revalidatePath("/items");

  // redirect() throws internally — execution stops here.
  redirect("/items");
}
