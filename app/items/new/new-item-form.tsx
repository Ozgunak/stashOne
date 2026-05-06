"use client";

// Client component for the "New item" form. Needed because we use
// useActionState and useFormStatus to show errors and a loading state.
//
// The form itself is plain HTML. The action prop receives our server
// action wrapped by useActionState — React handles posting FormData
// and getting back our CreateItemState. We never write a fetch() or
// touch JSON manually.

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { createItemAction, type CreateItemState } from "./actions";
import { ITEM_STATUSES, ITEM_TYPES } from "@/lib/validations/item";

const TYPE_LABEL: Record<(typeof ITEM_TYPES)[number], string> = {
  BOOK: "Book",
  MOVIE: "Movie",
  SHOW: "Show",
};
const STATUS_LABEL: Record<(typeof ITEM_STATUSES)[number], string> = {
  WANT: "Want",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

function fieldError(state: CreateItemState | undefined, key: keyof Extract<CreateItemState, { ok: false }>["errors"]) {
  if (!state || state.ok) return null;
  const messages = state.errors[key];
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs text-red-600 dark:text-red-400">{messages[0]}</p>;
}

function SubmitButton() {
  // useFormStatus reads the parent form's submission state. Disables the
  // button while the action is in flight, which prevents double-submits.
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
    >
      {pending ? "Saving…" : "Save item"}
    </button>
  );
}

export default function NewItemForm() {
  const [state, formAction] = useActionState<CreateItemState | undefined, FormData>(
    createItemAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-black dark:text-zinc-50">
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          autoFocus
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        {fieldError(state, "title")}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="type" className="block text-sm font-medium text-black dark:text-zinc-50">
            Type
          </label>
          <select
            id="type"
            name="type"
            required
            defaultValue="BOOK"
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            {ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          {fieldError(state, "type")}
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium text-black dark:text-zinc-50">
            Status
          </label>
          <select
            id="status"
            name="status"
            required
            defaultValue="WANT"
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            {ITEM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          {fieldError(state, "status")}
        </div>
      </div>

      <div>
        <label htmlFor="rating" className="block text-sm font-medium text-black dark:text-zinc-50">
          Rating <span className="text-zinc-500">(optional, 1–5)</span>
        </label>
        <input
          id="rating"
          name="rating"
          type="number"
          min={1}
          max={5}
          className="mt-1 w-32 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        {fieldError(state, "rating")}
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-black dark:text-zinc-50">
          Notes <span className="text-zinc-500">(optional)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        {fieldError(state, "notes")}
      </div>

      {state && !state.ok && state.errors._form && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.errors._form[0]}</p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton />
        <Link href="/items" className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">
          Cancel
        </Link>
      </div>
    </form>
  );
}
