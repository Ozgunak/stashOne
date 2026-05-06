"use client";

// Small client component for the delete button. We need:
//   - useActionState to read the action's result
//   - a confirm() prompt before submitting (so the user can't delete
//     by accident from a misclick)
//
// We POST a hidden id in the form, same pattern as edit. The server
// action verifies ownership, so a tampered id is harmless.

import { useActionState } from "react";

import { deleteItemAction, type DeleteItemState } from "@/app/items/[id]/actions";

export default function DeleteItemButton({ itemId, itemTitle }: { itemId: string; itemTitle: string }) {
  const [state, formAction] = useActionState<DeleteItemState | undefined, FormData>(
    deleteItemAction,
    undefined,
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        // Native confirm() — synchronous, blocks until the user picks.
        // Returning false (cancel) prevents form submission.
        if (!window.confirm(`Delete "${itemTitle}"? This can't be undone.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={itemId} />
      <button
        type="submit"
        className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline dark:text-red-400 dark:hover:text-red-300"
      >
        Delete
      </button>
      {state && !state.ok && (
        <span className="ml-2 text-xs text-red-600 dark:text-red-400">{state.error}</span>
      )}
    </form>
  );
}
