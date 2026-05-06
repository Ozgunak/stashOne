// /items/new — server component that just renders the client-side form.
// We split the form into its own client file so the page can stay a
// server component (which is faster, smaller, and the default for the
// App Router).

import NewItemForm from "./new-item-form";

export const dynamic = "force-dynamic";

export default function NewItemPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        New item
      </h1>
      <NewItemForm />
    </main>
  );
}
