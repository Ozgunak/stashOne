"use client";

// Renders today's games and updates them live as the SSE stream emits
// new snapshots.
//
// EventSource is the browser-native SSE client. Pros:
//   - No library
//   - Automatic reconnect on disconnect (with exponential backoff)
//   - Built-in event-name routing (we use "update")
//
// We hold the latest game list in state. When the server emits an
// "update" event with new game state, we replace the list. React
// re-renders the affected rows; everything else stays untouched.

import { useEffect, useState } from "react";
import Link from "next/link";

import LocalTime from "./local-time";

type Game = {
  id: string;
  externalId: number;
  status: string;
  homeAbbrev: string;
  awayAbbrev: string;
  homeScore: number | null;
  awayScore: number | null;
  startTimeUtc: string;
};

type StreamEvent = {
  games: Game[];
  demo: boolean;
  tick: number;
};

export default function LiveScores({ demo = false }: { demo?: boolean }) {
  const [games, setGames] = useState<Game[]>([]);
  const [status, setStatus] = useState<"connecting" | "open" | "closed">("connecting");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const url = demo ? "/api/scores/stream?demo=1" : "/api/scores/stream";
    const es = new EventSource(url);

    es.addEventListener("open", () => setStatus("open"));

    // Custom event "update" — matches the `event: update` line emitted
    // by the server. The default "message" event is unused.
    es.addEventListener("update", (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data) as StreamEvent;
        setGames(parsed.games);
        setTick(parsed.tick);
      } catch (err) {
        console.error("[live-scores] parse error:", err);
      }
    });

    es.addEventListener("error", () => {
      // EventSource auto-reconnects, so this is informational.
      setStatus("closed");
    });

    // Cleanup on unmount: close the stream so the server can release
    // its handler.
    return () => {
      es.close();
    };
  }, [demo]);

  return (
    <section className="mb-8">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
          Today
        </h2>
        <span className="flex items-center gap-2 text-xs text-zinc-500">
          <LiveIndicator status={status} />
          {demo && tick > 0 && (
            <span className="font-mono text-zinc-400">demo tick {tick}</span>
          )}
        </span>
      </header>

      {games.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No games today. Live updates will appear here when games are in
          progress.
        </div>
      ) : (
        <ul className="space-y-2">
          {games.map((g) => (
            <li
              key={g.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex flex-col gap-1.5">
                <Row abbr={g.awayAbbrev} score={g.awayScore} />
                <Row abbr={g.homeAbbrev} score={g.homeScore} />
              </div>
              <div className="flex flex-col items-end gap-1 text-xs">
                <span
                  className={`rounded-md px-2 py-0.5 font-medium ${
                    g.status === "LIVE"
                      ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                      : g.status === "FINAL"
                        ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                  }`}
                >
                  {g.status}
                </span>
                <span className="text-zinc-500">
                  <LocalTime date={g.startTimeUtc} format="time" />
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({ abbr, score }: { abbr: string; score: number | null }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Link
        href={`/teams/${abbr}`}
        className="text-sm font-medium hover:underline"
      >
        <span className="font-mono text-xs text-zinc-500">{abbr}</span>
      </Link>
      <span className="font-mono text-base font-bold text-black dark:text-zinc-50">
        {score ?? "—"}
      </span>
    </div>
  );
}

function LiveIndicator({ status }: { status: "connecting" | "open" | "closed" }) {
  const color =
    status === "open"
      ? "bg-emerald-500"
      : status === "connecting"
        ? "bg-amber-500"
        : "bg-zinc-400";
  const label =
    status === "open"
      ? "live"
      : status === "connecting"
        ? "connecting…"
        : "reconnecting…";
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}
