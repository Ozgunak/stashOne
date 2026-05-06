// Sign-in page: shows a single email input and a submit button.
//
// Submission uses a SERVER ACTION — the function below marked "use server".
// When the user submits the form, the function runs ON THE SERVER (no API
// route to write, no fetch from the client). It calls Auth.js's signIn(),
// which generates a magic-link token, stores it in the VerificationToken
// table, and asks Resend to email the user.
//
// M10 addition: rate limiting. Every signin attempt is checked against
// two limiters (per email + per IP) before we let signIn() run. If either
// trips, we redirect to /signin?error=rate-limit and the user sees a
// friendly message. WITHOUT this, an attacker can spam any email through
// our /signin endpoint and exhaust Resend's free quota in seconds.

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import { signinEmailLimiter, signinIpLimiter } from "@/lib/ratelimit";

export const metadata = { title: "Sign in" };

async function signInAction(formData: FormData) {
  "use server"; // marks this function as a server action

  const email = formData.get("email");
  if (typeof email !== "string" || !email) {
    redirect("/signin?error=invalid-email");
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Pull the client IP from request headers. On Vercel, x-forwarded-for
  // is the canonical header; the LEFT-MOST entry is the originating IP.
  // Fallback to a placeholder so local dev still rate-limits.
  const reqHeaders = await headers();
  const forwarded = reqHeaders.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || reqHeaders.get("x-real-ip") || "unknown";

  // Check both limiters in parallel. Either tripping is enough to block.
  const [emailCheck, ipCheck] = await Promise.all([
    signinEmailLimiter.limit(normalizedEmail),
    signinIpLimiter.limit(ip),
  ]);

  if (!emailCheck.success || !ipCheck.success) {
    // Same opaque error regardless of which limiter tripped — don't
    // give an attacker information about which dimension is throttling.
    redirect("/signin?error=rate-limit");
  }

  // signIn() with the "resend" provider triggers the magic-link flow.
  await signIn("resend", { email: normalizedEmail, redirectTo: "/" });
}

const ERROR_MESSAGES: Record<string, string> = {
  "rate-limit": "Too many attempts. Try again in a few minutes.",
  "invalid-email": "Please enter a valid email address.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : null;

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

        {errorMessage && (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {errorMessage}
          </div>
        )}

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
