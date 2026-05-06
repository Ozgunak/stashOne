"use client";

// Reusable form component for creating AND editing an Item. The page
// passes in the action, default values (for edit), and the submit
// label. Everything else — fields, error rendering, loading state —
// is identical between create and edit.
//
// This is the standard Next.js pattern for "shared form, different
// action": the form is the UI; the action is the behavior.

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { ITEM_STATUSES, ITEM_TYPES } from "@/lib/validations/item";

// State shape both create and update actions return.
export type ItemFormState =
  | { ok: true }
  | {
      ok: false;
      errors: Partial<Record<"title" | "type" | "status" | "rating" | "notes" | "tags" | "_form", string[]>>;
    };

type Action = (prev: ItemFormState | undefined, formData: FormData) => Promise<ItemFormState>;

type Defaults = {
  title?: string;
  type?: (typeof ITEM_TYPES)[number];
  status?: (typeof ITEM_STATUSES)[number];
  rating?: number | null;
  notes?: string | null;
  // Tags come in as an array of strings; we render them as a single
  // comma-separated input. The validation schema splits them back out.
  tags?: string[];
};

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

function fieldError(state: ItemFormState | undefined, key: keyof Extract<ItemFormState, { ok: false }>["errors"]) {
  if (!state || state.ok) return null;
  const messages = state.errors[key];
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs text-red-600 dark:text-red-400">{messages[0]}</p>;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

export default function ItemForm({
  action,
  defaults,
  submitLabel,
  itemId,
}: {
  action: Action;
  defaults?: Defaults;
  submitLabel: string;
  // For edit: id passed as a hidden field. The action re-validates
  // ownership server-side, so tampering with this is harmless.
  itemId?: string;
}) {
  const [state, formAction] = useActionState<ItemFormState | undefined, FormData>(
    action,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      {itemId && <input type="hidden" name="id" value={itemId} />}

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
          defaultValue={defaults?.title ?? ""}
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
            defaultValue={defaults?.type ?? "BOOK"}
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
            defaultValue={defaults?.status ?? "WANT"}
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
          defaultValue={defaults?.rating ?? ""}
          className="mt-1 w-32 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        {fieldError(state, "rating")}
      </div>

      <div>
        <label htmlFor="tags" className="block text-sm font-medium text-black dark:text-zinc-50">
          Tags <span className="text-zinc-500">(optional, comma-separated)</span>
        </label>
        <input
          id="tags"
          name="tags"
          type="text"
          placeholder="fiction, sci-fi, post-apocalyptic"
          defaultValue={defaults?.tags?.join(", ") ?? ""}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        {fieldError(state, "tags")}
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-black dark:text-zinc-50">
          Notes <span className="text-zinc-500">(optional)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          defaultValue={defaults?.notes ?? ""}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        {fieldError(state, "notes")}
      </div>

      {state && !state.ok && state.errors._form && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.errors._form[0]}</p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton label={submitLabel} />
        <Link href="/items" className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">
          Cancel
        </Link>
      </div>
    </form>
  );
}
