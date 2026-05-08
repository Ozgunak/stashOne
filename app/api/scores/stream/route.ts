// Server-Sent Events stream of today's game state.
//
// Every 10 seconds, reads today's games from Postgres. If any have
// changed since the last tick, emits an "update" event. The browser
// (via EventSource) gets a push without polling-style request overhead.
//
// Demo mode: ?demo=1 simulates random score changes by mutating
// today's first game's homeScore in the *response payload only* — does
// NOT touch the DB. Lets you see the wiring during offseason.
//
// Why SSE over WebSockets here: this stream is one-directional (server
// → browser only). SSE is plain HTTP, one less moving part, auto-
// reconnect is built into the browser's EventSource. WebSockets are
// what you'd reach for when the browser ALSO needs to send live
// updates (chat, collaborative editing).

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Force this route to use the Node.js runtime — we need access to
// Prisma and `setInterval`/`setTimeout` semantics that work cleanly
// with streams. Edge runtime would also work but with constraints.
export const dynamic = "force-dynamic";

const TICK_MS = 10_000;

type GameSnapshot = {
  id: string;
  externalId: number;
  status: string;
  homeAbbrev: string;
  awayAbbrev: string;
  homeScore: number | null;
  awayScore: number | null;
  startTimeUtc: string;
};

async function readTodaysGames(): Promise<GameSnapshot[]> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

  const games = await prisma.game.findMany({
    where: { gameTimeUtc: { gte: startOfDay, lt: endOfDay } },
    orderBy: { gameTimeUtc: "asc" },
    select: {
      id: true,
      externalId: true,
      status: true,
      homeScore: true,
      awayScore: true,
      gameTimeUtc: true,
      homeTeam: { select: { abbreviation: true } },
      awayTeam: { select: { abbreviation: true } },
    },
  });

  return games.map((g) => ({
    id: g.id,
    externalId: g.externalId,
    status: g.status,
    homeAbbrev: g.homeTeam.abbreviation,
    awayAbbrev: g.awayTeam.abbreviation,
    homeScore: g.homeScore,
    awayScore: g.awayScore,
    startTimeUtc: g.gameTimeUtc.toISOString(),
  }));
}

function snapshotKey(games: GameSnapshot[]): string {
  // Cheap diff signal: stringified scores + statuses. If any value
  // changes, the key changes. Avoids deep-diffing.
  return games
    .map((g) => `${g.id}:${g.status}:${g.homeScore ?? "-"}:${g.awayScore ?? "-"}`)
    .join("|");
}

export async function GET(req: Request) {
  // Auth gate — same model as the rest of the app. A user has to be
  // signed in to consume the stream.
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const demo = url.searchParams.get("demo") === "1";

  // The ReadableStream here is the SSE body. Each `controller.enqueue(...)`
  // emits one chunk. The browser parses lines starting with `data: ` and
  // delivers them to the EventSource as message events.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let lastKey = "";
      let demoTick = 0;

      function emit(eventName: string, payload: unknown) {
        // SSE format: each event is one or more `field: value\n` lines,
        // followed by a blank line. We name the event so client can route.
        const data = JSON.stringify(payload);
        controller.enqueue(encoder.encode(`event: ${eventName}\n`));
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }

      async function sendUpdate() {
        try {
          const games = await readTodaysGames();

          // Demo mutation: bump the home score of the first game every
          // tick so the user sees something move.
          if (demo && games.length > 0) {
            demoTick++;
            const g = games[0];
            games[0] = {
              ...g,
              homeScore: ((g.homeScore ?? 0) + 1),
              status: "LIVE",
            };
          }

          const key = snapshotKey(games);
          if (key !== lastKey) {
            emit("update", { games, demo, tick: demoTick });
            lastKey = key;
          } else {
            // Heartbeat keeps proxies/load balancers from killing the
            // connection on idle. Not strictly needed in dev but cheap.
            controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
          }
        } catch (err) {
          console.error("[scores/stream] tick error:", err);
        }
      }

      // Initial send so the client doesn't see a blank UI for 10s.
      await sendUpdate();

      const interval = setInterval(sendUpdate, TICK_MS);

      // When the browser closes the EventSource (or navigates away),
      // the request signal aborts. We clean up the interval to avoid
      // a lingering DB query loop.
      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // already closed; ignore
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable compression buffering — important for SSE through some
      // proxies (Cloudflare, etc.). Vercel handles this automatically
      // but explicit doesn't hurt.
      "X-Accel-Buffering": "no",
    },
  });
}
