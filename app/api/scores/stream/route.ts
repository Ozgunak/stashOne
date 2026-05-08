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
export const runtime = "nodejs";
// Vercel Hobby plan caps function execution at 10s by default. Bumping
// to 60s (the Hobby max) lets the stream live longer between forced
// EventSource reconnects.
export const maxDuration = 60;

const TICK_MS = 10_000;
// 2KB of padding to defeat buffering proxies that hold small responses
// before flushing. Sent once at connection time. Browsers ignore SSE
// comment lines (those starting with ":").
const INITIAL_PADDING = ":" + " ".repeat(2048) + "\n\n";

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
      // Snapshot of when the *current UTC minute* started — used as a
      // stable anchor so demoTick keeps growing across reconnects.
      // (If we used Date.now() at connection time, each reconnect
      // would reset demoTick to 1.)
      const demoEpoch = Math.floor(Date.now() / 60_000) * 60_000;

      // Flush padding immediately so any buffering proxy releases the
      // initial response. The browser fires EventSource "open" once
      // it receives ~2KB.
      controller.enqueue(encoder.encode(INITIAL_PADDING));

      function emit(eventName: string, payload: unknown) {
        // SSE format: each event is one or more `field: value\n` lines,
        // followed by a blank line. We name the event so client can route.
        const data = JSON.stringify(payload);
        controller.enqueue(encoder.encode(`event: ${eventName}\n`));
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }

      async function sendUpdate() {
        try {
          let games = await readTodaysGames();

          // Demo mode: if there are no real games today (offseason or
          // an off-day mid-playoffs), fabricate one so the user can
          // see the stream wiring in action. The fabricated game is
          // never written to the DB — it lives only in this response.
          if (demo && games.length === 0) {
            games = [
              {
                id: "demo-game-1",
                externalId: 999_000_001,
                status: "SCHEDULED",
                homeAbbrev: "EDM",
                awayAbbrev: "BOS",
                homeScore: 0,
                awayScore: 0,
                startTimeUtc: new Date().toISOString(),
              },
            ];
          }

          // Time-derived tick so the score keeps advancing across
          // reconnects (Vercel Hobby kills functions after 60s, so
          // EventSource reconnects automatically — without this
          // the score would reset to 1 each time).
          const demoTick = Math.floor((Date.now() - demoEpoch) / TICK_MS) + 1;

          // Demo mutation: home score = demoTick (1, 2, 3, ...).
          if (demo && games.length > 0) {
            const g = games[0];
            games[0] = {
              ...g,
              homeScore: demoTick,
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
