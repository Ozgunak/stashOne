// Zod schemas for the NHL unofficial API responses.
//
// Discipline: we only schema the fields we ACTUALLY USE. Anything else
// gets ignored — `.passthrough()` is implicit since we don't `.strict()`.
// If the API ever drops a field we depend on, parsing fails loudly,
// which is the entire point.
//
// We avoid hallucinating structure: every shape here was scouted from
// real responses (see N3 walkthrough). The NHL API has no contract; the
// only "documentation" is the responses themselves.

import { z } from "zod";

// Many endpoints return localized strings as `{ default: "Connor", fr: "..." }`.
// We always read .default. This helper schemas that pattern.
const localized = z.object({ default: z.string() });

// ---------- Standings ---------------------------------------------------
// /v1/standings/now → { standings: [...] }
// We use this as our authoritative "current 32 teams + division/conference"
// source. The /teams endpoint returns historical teams (Quebec Nordiques,
// Oakland Seals, etc.) which we don't want.

export const standingsResponseSchema = z.object({
  standingsDateTimeUtc: z.string().optional(), // ISO-ish
  standings: z.array(
    z.object({
      teamAbbrev: localized,
      teamName: localized,
      teamLogo: z.string().url().optional(),
      conferenceAbbrev: z.string(),
      conferenceName: z.string(),
      divisionAbbrev: z.string(),
      divisionName: z.string(),
      // Stats we'll display on /standings (N7); harmless to capture now.
      gamesPlayed: z.number().int(),
      points: z.number().int(),
      wins: z.number().int(),
      losses: z.number().int(),
      otLosses: z.number().int().optional().default(0),
      goalFor: z.number().int(),
      goalAgainst: z.number().int(),
    }),
  ),
});

// ---------- Roster ------------------------------------------------------
// /v1/roster/{teamAbbr}/{seasonId}  e.g. /v1/roster/EDM/20242025
// Returns three arrays: forwards, defensemen, goalies.

const rosterPlayerSchema = z.object({
  id: z.number().int(),
  headshot: z.string().url().optional(),
  firstName: localized,
  lastName: localized,
  sweaterNumber: z.number().int().optional(),
  positionCode: z.enum(["C", "L", "R", "D", "G"]), // L = LW, R = RW
  shootsCatches: z.string().optional(),
  heightInInches: z.number().int().optional(),
  weightInPounds: z.number().int().optional(),
  birthDate: z.string().optional(),
});

export const rosterResponseSchema = z.object({
  forwards: z.array(rosterPlayerSchema),
  defensemen: z.array(rosterPlayerSchema),
  goalies: z.array(rosterPlayerSchema),
});

// ---------- Player landing ----------------------------------------------
// /v1/player/{playerId}/landing
// Bio + per-season stats. We schema only the fields the UI will show.

export const playerResponseSchema = z.object({
  playerId: z.number().int(),
  isActive: z.boolean(),
  currentTeamId: z.number().int().optional(),
  currentTeamAbbrev: z.string().optional(),
  fullTeamName: localized.optional(),
  firstName: localized,
  lastName: localized,
  sweaterNumber: z.number().int().optional(),
  position: z.enum(["C", "L", "R", "D", "G"]),
  headshot: z.string().url().optional(),
  heroImage: z.string().url().optional(),
  heightInInches: z.number().int().optional(),
  weightInPounds: z.number().int().optional(),
  birthDate: z.string().optional(),
  birthCity: localized.optional(),
  birthCountry: z.string().optional(),
  // featuredStats.regularSeason.subSeason holds CURRENT season totals.
  featuredStats: z
    .object({
      season: z.number().int().optional(),
      regularSeason: z
        .object({
          subSeason: z
            .object({
              gamesPlayed: z.number().int().optional(),
              goals: z.number().int().optional(),
              assists: z.number().int().optional(),
              points: z.number().int().optional(),
              plusMinus: z.number().int().optional(),
              pim: z.number().int().optional(),
              shots: z.number().int().optional(),
              shootingPctg: z.number().optional(), // 0.0–1.0
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
});

// ---------- Schedule ---------------------------------------------------
// /v1/schedule/{YYYY-MM-DD} → 7-day week including the requested date.

const gameSchema = z.object({
  id: z.number().int(),
  season: z.number().int(),
  gameType: z.number().int(), // 1=preseason, 2=regular, 3=playoffs
  startTimeUTC: z.string(),
  gameState: z.string(), // "FUT", "PRE", "LIVE", "FINAL", "OFF", etc.
  homeTeam: z.object({
    id: z.number().int(),
    abbrev: z.string(),
    score: z.number().int().optional(),
  }),
  awayTeam: z.object({
    id: z.number().int(),
    abbrev: z.string(),
    score: z.number().int().optional(),
  }),
  venue: localized.optional(),
});

export const scheduleResponseSchema = z.object({
  nextStartDate: z.string().optional(),
  previousStartDate: z.string().optional(),
  gameWeek: z.array(
    z.object({
      date: z.string(),
      dayAbbrev: z.string(),
      numberOfGames: z.number().int(),
      games: z.array(gameSchema),
    }),
  ),
});

// ---------- Score (recent results) -------------------------------------
// /v1/score/{YYYY-MM-DD} → games on that day (with final scores when applicable).
// Shape is similar to schedule but on a single day.

export const scoreResponseSchema = z.object({
  prevDate: z.string().optional(),
  currentDate: z.string().optional(),
  nextDate: z.string().optional(),
  games: z.array(gameSchema).default([]),
});

// ---------- Playoff bracket --------------------------------------------
// /v1/playoff-series/carousel/{seasonId}
//
// Returns the full bracket as a list of rounds. Each round has 1+ series
// (Round 1: 8 series, Round 2: 4, Round 3: 2, Final: 1).
//
// Series with no team yet (e.g. future round, opponents TBD) have
// `topSeed`/`bottomSeed` as objects with abbrev "TBD" or are absent
// entirely. We keep `topSeed`/`bottomSeed` optional to be resilient
// to either pattern.

const playoffSeedSchema = z.object({
  id: z.number().int().optional(),
  abbrev: z.string().optional(),
  wins: z.number().int(),
  logo: z.string().url().optional(),
  darkLogo: z.string().url().optional(),
});

export const playoffBracketResponseSchema = z.object({
  seasonId: z.number().int(),
  currentRound: z.number().int().nullable().optional(),
  rounds: z.array(
    z.object({
      roundNumber: z.number().int(),
      roundLabel: z.string(),
      roundAbbrev: z.string(),
      series: z.array(
        z.object({
          seriesLetter: z.string(),
          roundNumber: z.number().int(),
          seriesLabel: z.string(),
          topSeed: playoffSeedSchema.optional(),
          bottomSeed: playoffSeedSchema.optional(),
          neededToWin: z.number().int().optional(),
          winningTeamId: z.number().int().optional(),
          losingTeamId: z.number().int().optional(),
        }),
      ),
    }),
  ),
});

// ---------- Inferred TS types -----------------------------------------

export type StandingsResponse = z.infer<typeof standingsResponseSchema>;
export type RosterResponse = z.infer<typeof rosterResponseSchema>;
export type PlayerResponse = z.infer<typeof playerResponseSchema>;
export type ScheduleResponse = z.infer<typeof scheduleResponseSchema>;
export type ScoreResponse = z.infer<typeof scoreResponseSchema>;
export type PlayoffBracketResponse = z.infer<typeof playoffBracketResponseSchema>;
