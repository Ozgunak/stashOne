"use client";

// Last-resort error boundary that catches errors thrown in the root
// layout itself. When this fires, the regular layout (and our Header)
// hasn't rendered, so we render the full <html><body> ourselves.
//
// This is the safety net for catastrophic failures. Most real errors
// get caught by route-segment error.tsx files first.

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 text-center dark:bg-black">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          Something went wrong.
        </h1>
        <p className="mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
          A critical error occurred. Try again, or refresh the page.
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
      </body>
    </html>
  );
}
