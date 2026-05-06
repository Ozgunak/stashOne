// Next.js 16 proxy (formerly "middleware"). Runs on every matched request
// BEFORE the route handler. We use it to redirect unauthenticated users
// away from /items/** to /signin.
//
// Auth.js v5 lets us *wrap* the `auth` export with a callback. Inside the
// callback, `req.auth` is the session (or null/undefined). If there's no
// session, we redirect to /signin.
//
// Important Next.js 16 nuance: Auth.js docs still say "middleware.ts"
// because they predate Next 16. The export name *and* the filename both
// changed (middleware.ts -> proxy.ts; export middleware -> export proxy).

import { auth } from "@/auth";

export const proxy = auth((req) => {
  if (!req.auth) {
    const url = new URL("/signin", req.nextUrl.origin);
    return Response.redirect(url);
  }
});

// `matcher` tells Next.js which paths to run the proxy on. We only
// guard /items (and its subroutes). Everything else — homepage, /signin,
// /api/auth/* — runs without the proxy. Keeping the matcher tight avoids
// redirect loops and lets the magic-link callback URLs work freely.
export const config = {
  matcher: ["/items/:path*"],
};
