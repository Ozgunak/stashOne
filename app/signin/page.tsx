// Sign-in page: shows a single email input and a submit button.
//
// Submission uses a SERVER ACTION — the function below marked "use server".
// When the user submits the form, the function runs ON THE SERVER (no API
// route to write, no fetch from the client). It calls Auth.js's signIn(),
// which generates a magic-link token, stores it in the VerificationToken
// table, and asks Resend to email the user.

import { signIn } from "@/auth";

export const metadata = { title: "Sign in" };

async function signInAction(formData: FormData) {
  "use server"; // marks this function as a server action

  const email = formData.get("email");
  if (typeof email !== "string" || !email) {
    throw new Error("Email is required");
  }

  // signIn() with the "resend" provider triggers the magic-link flow.
  // After Resend sends the email, Auth.js redirects the browser to a
  // "Check your email" verification page (handled by Auth.js itself).
  // `redirectTo` is where the user lands AFTER they click the magic link.
  await signIn("resend", { email, redirectTo: "/" });
}

export default function SignInPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 dark:bg-black">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-black dark:text-zinc-50">
            Sign in to Stash
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            We&apos;ll email you a one-time link.
          </p>
        </div>
        <form action={signInAction} className="space-y-3">
          <input
            type="email"
            name="email"
            required
            autoFocus
            placeholder="you@example.com"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-black placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <button
            type="submit"
            className="w-full rounded-md bg-black px-3 py-2 text-base font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
          >
            Send magic link
          </button>
        </form>
      </div>
    </main>
  );
}
