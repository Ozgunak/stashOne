// /items/[id]/edit — server component that loads the item and renders
// the shared form pre-filled.
//
// SECURITY: we run the same ownership check the actions do. If the
// signed-in user doesn't own this item (or the item doesn't exist),
// we render notFound() instead of the form. This means an attacker who
// types someone else's item ID in the URL gets a 404 — they can't
// even SEE the form, let alone submit it.

import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ItemForm from "@/components/item-form";
import { updateItemAction } from "../actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Edit item" };

export default async function EditItemPage({
  params,
}: {
  // Next.js 15+ made `params` a Promise. Async by design — server
  // components have to await it before using.
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) notFound();

  const item = await prisma.item.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      title: true,
      type: true,
      status: true,
      rating: true,
      notes: true,
      // Pull the tag names via the join table so the form can prefill.
      // The relation chain: Item -> ItemTag[] -> Tag.name.
      tags: { select: { tag: { select: { name: true } } } },
    },
  });

  // Ownership check at the page layer (defense in depth — the action
  // also rechecks). Same opaque 404 whether item is missing or not yours.
  if (!item || item.userId !== session.user.id) notFound();

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        Edit item
      </h1>
      <ItemForm
        action={updateItemAction}
        submitLabel="Update item"
        itemId={item.id}
        defaults={{
          title: item.title,
          type: item.type,
          status: item.status,
          rating: item.rating,
          notes: item.notes,
          tags: item.tags.map((t) => t.tag.name),
        }}
      />
    </main>
  );
}
