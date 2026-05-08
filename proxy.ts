// Next.js 16 proxy. Runs on every matched request BEFORE the route
// handler. Auth-gated everything: any non-public route redirects to
// /signin if the user isn't authenticated.
//
// Public routes (excluded from the matcher):
//   - /signin             — the sign-in page itself
//   - /api/auth/*         — Auth.js endpoints (callbacks, session, etc.)
//   - /icon, /_next/*     — static assets and Next internals
//
// Auth.js v5 lets us *wrap* the `auth` export with a callback. Inside
// the callback `req.auth` is the session (or null). If null, redirect.

import { auth } from "@/auth";

export const proxy = auth((req) => {
  if (!req.auth) {
    const url = new URL("/signin", req.nextUrl.origin);
    return Response.redirect(url);
  }
});

// Matcher: match everything EXCEPT the public paths and Next/static assets.
// The negative lookahead `(?!...)` excludes these from being matched.
//   - api/auth    : Auth.js endpoints must stay public (chicken-and-egg)
//   - api/sync    : Cron-driven sync endpoints — they have their own
//                   CRON_SECRET auth, must not be redirected to /signin
//   - api/scores  : the SSE stream — does its own auth() check; proxy
//                   redirects would break EventSource (it expects
//                   text/event-stream, not HTML)
//   - signin      : the sign-in page itself
//   - _next       : Next.js internals (HMR, JS chunks, image optimization)
//   - icon        : the generated favicon route
//   - .*\\..*     : files with an extension (favicon.ico, robots.txt, etc.)
export const config = {
  matcher: ["/((?!api/auth|api/sync|api/scores|signin|_next|icon|.*\\..*).*)"],
};
