"use client";

// Error boundary for the /items segment. Next.js automatically wraps
// the route's pages in this component. Any thrown error in a server
// component (or client component, or server action invocation) bubbles
// up here and shows a recoverable UI rather than a white page.
//
// Must be a client component because it receives `reset()` from React
// and runs in the browser to retry.

import { useEffect } from "react";

export default function ItemsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Log to the console (and Vercel server logs in prod). Critical for
  // debugging — without this we'd never see the actual error message
  // in a deployed environment.
  useEffect(() => {
    console.error("Items page error:", error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 py-8 text-center">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
        Something went wrong loading your stash.
      </h1>
      <p className="mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        Try again, or refresh the page. If it keeps happening, let us know.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
      >
        Try again
      </button>
      {error.digest && (
        <p className="mt-4 font-mono text-xs text-zinc-400">Error ID: {error.digest}</p>
      )}
    </main>
  );
}
