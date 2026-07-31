import "server-only";
import { getLineupSummaries } from "./lineups";
import {
  getTeamGames,
  getTeamProfile,
  getTeamRoster,
  getTeamSeasonSummary,
  getTeamShotProfile,
  getTeamTopPlayers,
  getTeamTrend,
} from "./team-detail";

export async function loadTeamDetail(teamId: number, season: number) {
  const profile = await getTeamProfile(teamId, season);
  if (!profile) return null;

  const [summary, games, trend, shotProfile, topPlayers, roster, bestLineups, worstLineups] = await Promise.all([
    getTeamSeasonSummary(teamId, season),
    getTeamGames(teamId, season),
    getTeamTrend(teamId, season),
    getTeamShotProfile(teamId, season),
    getTeamTopPlayers(teamId, season),
    getTeamRoster(teamId, season),
    getLineupSummaries({ page: 1, pageSize: 5, sort: "plus_minus", dir: "desc", season, team: teamId, review: "exclude" }),
    getLineupSummaries({ page: 1, pageSize: 5, sort: "plus_minus", dir: "asc", season, team: teamId, review: "exclude" }),
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
