// Stub for the items list. M4 will replace this with the real list.
// We need *something* at /items now so we can test that the proxy
// redirects unauthenticated visitors to /signin.

import { auth } from "@/auth";

export default async function ItemsPage() {
  // Belt-and-suspenders: even though proxy.ts redirects anonymous users,
  // we double-check on the page itself. This is the "defense in depth"
  // pattern — server-side checks happen at multiple layers, and one
  // failure doesn't expose data.
  const session = await auth();

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <h1 className="text-2xl font-semibold">Your items will appear here.</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Signed in as {session?.user?.email}. (Real list comes in M4.)
      </p>
    </main>
  );
}
