// Site-wide header. Server component (no "use client") so it can call
// `auth()` directly to read the current session.
//
// Sign-out is a server action embedded in a tiny <form>. We need a form
// (not a link) because signing out is a state-changing operation — it
// deletes the Session row in the DB. Using a POST form (the default for
// <form>) is the safe pattern; GET sign-out can be triggered by image
// preloaders or browser prefetch and accidentally log users out.

import Link from "next/link";
import { auth, signOut } from "@/auth";

export default async function Header() {
  const session = await auth();

  return (
    <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
      <Link
        href="/"
        className="text-lg font-semibold tracking-tight text-black dark:text-zinc-50"
      >
        Stash
      </Link>

      {session?.user ? (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">
            {session.user.email}
          </span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="rounded-md bg-zinc-200 px-3 py-1 font-medium text-black hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : (
        <Link
          href="/signin"
          className="rounded-md bg-black px-3 py-1 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
        >
          Sign in
        </Link>
      )}
    </header>
  );
}
