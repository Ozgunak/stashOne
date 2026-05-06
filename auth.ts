// Auth.js v5 central configuration.
//
// This file exports four things — `auth`, `handlers`, `signIn`, `signOut` —
// that the rest of the app imports from. Anywhere we need to know "is the
// user logged in?" we call `auth()`. Anywhere we need to render the
// /api/auth/* endpoints, we use `handlers`. Sign-in/sign-out actions use
// `signIn` and `signOut`.

import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { prisma } from "@/lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  // The Prisma adapter persists everything (users, sessions, tokens) to
  // Postgres via our shared client singleton. Crucially, we DO NOT do
  // `new PrismaClient()` here — that would bypass the singleton and
  // exhaust connections during dev hot-reload.
  adapter: PrismaAdapter(prisma),

  // "database" strategy: each session is a row in the Session table,
  // referenced by a random sessionToken stored in the user's cookie.
  // Signing out = deleting the row. Easier to reason about than JWT
  // sessions, at the cost of one DB read per authenticated request.
  session: { strategy: "database" },

  providers: [
    Resend({
      // Our env var is RESEND_API_KEY (not the Auth.js auto-discovered
      // AUTH_RESEND_KEY), so we wire it explicitly.
      apiKey: process.env.RESEND_API_KEY,

      // Resend lets us send from this address out of the box without
      // verifying our own domain. Replace later if/when we own a domain.
      from: "onboarding@resend.dev",
    }),
  ],

  pages: {
    // Custom sign-in URL instead of Auth.js's default /api/auth/signin.
    // We'll build this page in M3.7.
    signIn: "/signin",
  },

  // We rely on AUTH_SECRET being set in the env. Auth.js will throw a
  // clear error at startup if it's missing.
});
