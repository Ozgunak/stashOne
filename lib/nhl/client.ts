// Typed client for the NHL unofficial API.
//
// One function per endpoint. Each function builds the URL, fetches with a
// timeout, validates the response with Zod, and returns typed data.
// Errors throw with a useful tag.
//
// The strict separation between "fetching from upstream" and "what the
// rest of the app sees" is the architectural rule from N6 (sync). Pages
// will eventually call PRISMA, not this client. Only the sync runs and
// the smoke script call here.

import { z } from "zod";
import {
  standingsResponseSchema,
  rosterResponseSchema,
  playerResponseSchema,
  scheduleResponseSchema,
  scoreResponseSchema,
  type StandingsResponse,
  type RosterResponse,
  type PlayerResponse,
  type ScheduleResponse,
  type ScoreResponse,
} from "./schemas";

const BASE = "https://api-web.nhle.com/v1";
const DEFAULT_TIMEOUT_MS = 8000;

// Tagged error class so callers can distinguish kinds. Every thrown error
// from this module goes through here.
export class NhlApiError extends Error {
  constructor(
    public readonly kind:
      | "network" // fetch failed (timeout, offline, DNS)
      | "http" // server returned non-2xx
      | "schema" // response shape didn't match Zod
      | "unknown",
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "NhlApiError";
  }
}

// Internal: fetch JSON with timeout, follow redirects, validate via Zod.
// Generic over the schema so the return type is inferred per call.
async function nhlFetch<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
): Promise<z.infer<S>> {
  const url = `${BASE}${path}`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: ac.signal,
      // The standings/now endpoint returns 307 redirects to a date-specific
      // URL; default fetch follows redirects, but being explicit is good.
      redirect: "follow",
      // Be polite to the unofficial API. A real product would also retry
      // on 5xx and apply circuit-breaking; that's out of scope for N3.
      headers: { Accept: "application/json" },
    });
  } catch (err) {
    throw new NhlApiError("network", `Fetch failed for ${path}`, err);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new NhlApiError(
      "http",
      `${response.status} ${response.statusText} from ${path}`,
    );
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (err) {
    throw new NhlApiError("network", `Invalid JSON from ${path}`, err);
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    throw new NhlApiError(
      "schema",
      `Schema mismatch for ${path}: ${result.error.message.slice(0, 300)}`,
      result.error,
    );
  }

  return result.data;
}

// ---------- Public API ------------------------------------------------

export async function getStandings(): Promise<StandingsResponse> {
  return nhlFetch("/standings/now", standingsResponseSchema);
}

/**
 * Roster for a team in a given season.
 *
 * @param teamAbbr  e.g. "EDM"
 * @param seasonId  e.g. "20242025" (NHL's season string)
 *                  Pass "current" to get the latest available season.
 */
export async function getRoster(
  teamAbbr: string,
  seasonId: string | "current" = "current",
): Promise<RosterResponse> {
  return nhlFetch(`/roster/${teamAbbr}/${seasonId}`, rosterResponseSchema);
}

export async function getPlayer(playerId: number): Promise<PlayerResponse> {
  return nhlFetch(`/player/${playerId}/landing`, playerResponseSchema);
}

/**
 * Games on / around a date. NHL returns a 7-day window starting at the
 * given date (Sunday-anchored). Use the gameWeek[].games arrays.
 */
export async function getSchedule(
  dateYmd: string,
): Promise<ScheduleResponse> {
  return nhlFetch(`/schedule/${dateYmd}`, scheduleResponseSchema);
}

/**
 * Recent results. Slight shape difference vs schedule (single day's
 * `games` array on the root). Useful for the /scores page in N7.
 */
export async function getScores(dateYmd: string): Promise<ScoreResponse> {
  return nhlFetch(`/score/${dateYmd}`, scoreResponseSchema);
}
