import "server-only";
import { getLineupSummaries } from "./lineups";
import type { GamePhase } from "@/lib/game-phase";
import {
  getTeamGames,
  getTeamProfile,
  getTeamRoster,
  getTeamSeasonSummary,
  getTeamShotProfile,
  getTeamTopPlayers,
  getTeamTrend,
} from "./team-detail";

export async function loadTeamDetail(
  teamId: number,
  season: number,
  phase: GamePhase = "regular"
) {
  const profile = await getTeamProfile(teamId, season, phase);
  if (!profile) return null;

  const [summary, games, trend, shotProfile, topPlayers, roster, bestLineups, worstLineups] = await Promise.all([
    getTeamSeasonSummary(teamId, season, phase),
    getTeamGames(teamId, season, 50, phase),
    getTeamTrend(teamId, season, 30, phase),
    getTeamShotProfile(teamId, season, "exclude", phase),
    getTeamTopPlayers(teamId, season, 12, phase),
    getTeamRoster(teamId, season, phase),
    getLineupSummaries({ page: 1, pageSize: 5, sort: "plus_minus", dir: "desc", season, phase, team: teamId, review: "exclude" }),
    getLineupSummaries({ page: 1, pageSize: 5, sort: "plus_minus", dir: "asc", season, phase, team: teamId, review: "exclude" }),
  ]);

  return {
    profile,
    summary,
    games,
    trend,
    shotProfile,
    topPlayers,
    roster,
    bestLineups: bestLineups.rows,
    worstLineups: worstLineups.rows,
  };
}

export type TeamDetailData = Awaited<ReturnType<typeof loadTeamDetail>>;
