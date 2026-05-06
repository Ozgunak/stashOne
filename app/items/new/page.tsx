// /items/new — server component that just renders the shared item form.
// The action wires this form to the create flow; the same form is
// reused at /items/[id]/edit with the update action.

import ItemForm from "@/components/item-form";
import { createItemAction } from "./actions";

export const dynamic = "force-dynamic";

export default function NewItemPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        New item
      </h1>
      <ItemForm action={createItemAction} submitLabel="Save item" />
    </main>
  );
}
