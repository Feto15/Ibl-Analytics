import { z } from "zod";
import type { GamePhase } from "@/lib/game-phase";

// Zod schemas for route + query params. Everything reaching the database is
// validated here; sort keys/directions are constrained enums (never raw SQL).

export const seasonParam = z.coerce.number().int().min(1900).max(2100);

export const idParam = z.coerce.number().int().positive();

export const sortDir = z.enum(["asc", "desc"]).default("desc");

export const gamePhaseSchema = z
  .enum(["regular", "playoffs", "all"])
  .default("regular") as z.ZodType<GamePhase>;

export const gamesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sort: z
    .enum(["date", "week", "home_score", "away_score", "total_score", "season"])
    .default("date"),
  dir: sortDir,
  team: z.coerce.number().int().positive().optional(),
  q: z.string().trim().max(100).optional(),
  season: seasonParam.optional(),
  phase: gamePhaseSchema,
});

export const lineupsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(25),
  sort: z
    .enum([
      "duration",
      "plus_minus",
      "points_per_minute",
      "points_for",
      "points_against",
    ])
    .default("duration"),
  dir: sortDir,
  team: z.coerce.number().int().positive().optional(),
  season: seasonParam.optional(),
  minDuration: z.coerce.number().int().min(0).optional(),
  review: z.enum(["include", "exclude"]).default("exclude"),
  phase: gamePhaseSchema,
});

export const reviewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(["created", "severity", "rule"]).default("created"),
  dir: sortDir,
  season: seasonParam.optional(),
  reportType: z.string().trim().max(60).optional(),
  severity: z.enum(["info", "warning", "error"]).optional(),
  ruleCode: z.string().trim().max(80).optional(),
});

export const playersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sort: z
    .enum([
      "points",
      "rebounds",
      "assists",
      "efficiency",
      "efg",
      "ts",
      "plus_minus",
      "minutes",
    ])
    .default("points"),
  dir: sortDir,
  season: seasonParam.optional(),
  team: z.coerce.number().int().positive().optional(),
  q: z.string().trim().max(100).optional(),
  phase: gamePhaseSchema,
});

export const teamsQuerySchema = z.object({
  season: seasonParam.optional(),
  sort: z
    .enum([
      "win_pct",
      "net_rating",
      "pace",
      "offensive_rating",
      "defensive_rating",
      "efg",
      "ts",
      "points_for",
  ])
    .default("win_pct"),
  dir: sortDir,
  review: z.enum(["include", "exclude"]).default("exclude"),
  phase: gamePhaseSchema,
});

export const overviewQuerySchema = z.object({
  season: seasonParam.optional(),
  review: z.enum(["include", "exclude"]).default("exclude"),
  phase: gamePhaseSchema,
});

export const shotChartQuerySchema = z.object({
  team: z.coerce.number().int().positive().optional(),
  player: z.coerce.number().int().positive().optional(),
  period: z.coerce.number().int().min(1).max(10).optional(),
  result: z.enum(["made", "missed"]).optional(),
  area: z.string().trim().max(60).optional(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
  pbp: z.enum(["unique", "area_constrained", "ambiguous", "no_event"]).optional(),
});

export const playerSearchSchema = z.object({
  q: z.string().trim().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export const pbpQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type GamesQuery = z.infer<typeof gamesQuerySchema>;
export type LineupsQuery = z.infer<typeof lineupsQuerySchema>;
export type ReviewQuery = z.infer<typeof reviewQuerySchema>;
export type PlayersQuery = z.infer<typeof playersQuerySchema>;
export type TeamsQuery = z.infer<typeof teamsQuerySchema>;
export type ShotChartQuery = z.infer<typeof shotChartQuerySchema>;
export type PbpQuery = z.infer<typeof pbpQuerySchema>;
