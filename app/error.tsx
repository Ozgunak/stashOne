"use client";

// Root-level error boundary. Catches any uncaught throw from any page
// in the app tree (except where a more specific error.tsx exists, like
// in /items days). The header still renders because layout is OUTSIDE
// the error boundary.
//
// The deeper global-error.tsx is a separate boundary that wraps the
// whole HTML document — only used when something in the layout itself
// throws.

import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root error:", error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 py-8 text-center">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
        Something went wrong.
      </h1>
      <p className="mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        Try again, or refresh the page. If it keeps happening, the upstream
        NHL API may be having a moment — the rest of the site should still
        work.
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
