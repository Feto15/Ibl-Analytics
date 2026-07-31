import "server-only";
import { sql } from "drizzle-orm";
import { run } from "../client";
import { num } from "./helpers";
import { getGameById, getGamePeriods, getTeamBoxScores, getGameTeamMetrics } from "./games";
import { getPlayerBoxScores, getPbpEvents } from "./pbp-players";
import { getShots } from "./shots";
import { getGameLineupStints, getGameLineupSummaries } from "./lineups";

/**
 * Single data loader for the game detail page. Runs the independent queries in
 * parallel (no waterfall) so related page data loads together.
 */
export async function loadGameDetail(gameId: number) {
  const [game, periods, teamBox, metrics, playerBox, shots, lineupSummaries, stints] = await Promise.all([
    getGameById(gameId),
    getGamePeriods(gameId),
    getTeamBoxScores(gameId),
    getGameTeamMetrics(gameId),
    getPlayerBoxScores(gameId),
    getShots({ gameId, limit: 1500 }),
    getGameLineupSummaries(gameId),
    getGameLineupStints(gameId),
  ]);

  if (!game) return null;

  // Determine if this game has any validation issue (badge on header).
  const reviewRows = await run<{ c: unknown }[]>(
    sql`select count(*)::int as c from validation_issues vi join reports r on r.report_id = vi.report_id where r.game_id = ${gameId}`
  );
  const reviewCount = num(reviewRows[0]?.c) ?? 0;

  return {
    game,
    periods,
    teamBox,
    metrics,
    playerBox,
    shots,
    lineupSummaries,
    stints,
    hasReview: reviewCount > 0,
  };
}

/** Paginated PBP for the PBP tab (kept separate to avoid sending all events). */
export async function loadGamePbp(
  gameId: number,
  page: number,
  pageSize: number
) {
  const { rows, total } = await getPbpEvents(gameId, { page, pageSize });
  return { rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

// Re-export type used by client
export type GameDetailData = Awaited<ReturnType<typeof loadGameDetail>>;
