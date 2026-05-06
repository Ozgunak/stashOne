// Catch-all route handler for Auth.js endpoints.
//
// The directory name `[...nextauth]` is a Next.js dynamic route that matches
// /api/auth/* — so requests to /api/auth/signin, /api/auth/callback/resend,
// /api/auth/session, /api/auth/signout, etc., all land here.
//
// `handlers` from auth.ts is an object containing the GET and POST request
// handlers. We destructure and re-export them so Next.js's Route Handler
// convention picks them up.

import { handlers } from "@/auth";

export const { GET, POST } = handlers;
