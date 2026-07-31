import "server-only";
import { sql } from "drizzle-orm";
import { run } from "../client";
import { int, num, str } from "./helpers";
import { gameRowQuery } from "./overview";
import { excludeShotAreaReview } from "./review-scope";
import type { ReviewMode } from "@/lib/review";
import type {
  GameRow,
  PlayerLeaderRow,
  SeasonOption,
  TeamProfile,
  TeamRosterRow,
  TeamShotProfile,
  TeamSeasonSummary,
  TeamTrendPoint,
} from "../types";

export async function getTeamProfile(
  teamId: number,
  season?: number
): Promise<TeamProfile | null> {
  const team = await run<{
    team_id: unknown;
    code: string;
    name: string | null;
  }[]>(sql`select team_id::int as team_id, code, name from teams where team_id = ${teamId} limit 1`);
  if (!team[0]) return null;

  const meta = await run<{
    games: unknown;
    wins: unknown;
    losses: unknown;
  }[]>(
    sql`
      select
        count(distinct g.game_id)::int as games,
        count(distinct g.game_id) filter (where tgs.points > opp.points)::int as wins,
        count(distinct g.game_id) filter (where tgs.points < opp.points)::int as losses
      from team_game_stats tgs
      join games g on g.game_id = tgs.game_id
      left join team_game_stats opp on opp.game_id = tgs.game_id and opp.team_id <> tgs.team_id
      where tgs.team_id = ${teamId}
      ${season !== undefined ? sql`and g.season_year = ${season}` : sql``}
    `
  );
  const seasonRows = await run<{ season_year: unknown; competition_name: string }[]>(
    sql`
      select distinct
        g.season_year::int as season_year,
        s.competition_name
      from team_game_stats tgs
      join games g on g.game_id = tgs.game_id
      join seasons s on s.season_year = g.season_year
      where tgs.team_id = ${teamId}
      order by season_year desc
    `
  );
  const seasons: SeasonOption[] = seasonRows.map((row) => ({
    seasonYear: int(row.season_year) ?? 0,
    competitionName: row.competition_name,
  }));

  return {
    teamId: int(team[0].team_id) ?? 0,
    code: team[0].code,
    name: str(team[0].name),
    seasons,
    games: int(meta[0]?.games) ?? 0,
    wins: int(meta[0]?.wins) ?? 0,
    losses: int(meta[0]?.losses) ?? 0,
  };
}

export async function getTeamGames(
  teamId: number,
  season?: number,
  limit = 50
): Promise<GameRow[]> {
  const where = season
    ? sql`(g.home_team_id = ${teamId} or g.away_team_id = ${teamId}) and g.season_year = ${season}`
    : sql`(g.home_team_id = ${teamId} or g.away_team_id = ${teamId})`;
  return gameRowQuery(where, sql`g.game_date desc, g.game_id desc`, sql`${limit}`);
}

export async function getTeamTrend(
  teamId: number,
  season?: number,
  limit = 30
): Promise<TeamTrendPoint[]> {
  const rows = await run<{
    game_id: unknown;
    game_date: string | null;
    opponent_code: string;
    is_home: unknown;
    points: unknown;
    pace: unknown;
    ortg: unknown;
    drtg: unknown;
    net_rating: unknown;
    efg: unknown;
    result: string;
  }[]>(
    sql`
      select
        tgs.game_id::int as game_id,
        g.game_date::text as game_date,
        opp_t.code as opponent_code,
        tgs.is_home,
        tgs.points,
        tgm.pace::float8 as pace,
        tgm.offensive_rating::float8 as ortg,
        tgm.defensive_rating::float8 as drtg,
        tgm.net_rating::float8 as net_rating,
        tgs.efg_percent::float8 as efg,
        case when tgs.points > opp.points then 'W' else 'L' end as result
      from team_game_stats tgs
      join games g on g.game_id = tgs.game_id
      join team_game_stats opp on opp.game_id = tgs.game_id and opp.team_id <> tgs.team_id
      join teams opp_t on opp_t.team_id = opp.team_id
      left join team_game_metrics tgm on tgm.game_id = tgs.game_id and tgm.team_id = tgs.team_id
      where tgs.team_id = ${teamId}
      ${season !== undefined ? sql`and g.season_year = ${season}` : sql``}
      order by g.game_date desc, g.game_id desc
      limit ${limit}
    `
  );
  return rows.reverse().map((row) => ({
    gameId: int(row.game_id) ?? 0,
    gameDate: row.game_date,
    opponentCode: row.opponent_code,
    isHome: row.is_home === true || row.is_home === "t",
    points: int(row.points),
    pace: num(row.pace),
    offensiveRating: num(row.ortg),
    defensiveRating: num(row.drtg),
    netRating: num(row.net_rating),
    efgPercent: num(row.efg),
    result: row.result === "W" ? "W" : "L",
  }));
}

export async function getTeamShotProfile(
  teamId: number,
  season?: number,
  review: ReviewMode = "exclude"
): Promise<TeamShotProfile[]> {
  const rows = await run<{
    area_name: string | null;
    attempts: unknown;
    made: unknown;
    points: unknown;
  }[]>(
    sql`
      select
        s.area_name,
        count(*)::int as attempts,
        count(*) filter (where s.made = true)::int as made,
        coalesce(sum(s.points), 0)::int as points
      from shots s
      join games g on g.game_id = s.game_id
      join teams t on t.team_id = s.team_id
      where s.team_id = ${teamId} and s.court_x_meters is not null
      ${season !== undefined ? sql`and g.season_year = ${season}` : sql``}
      and ${excludeShotAreaReview(sql`s.report_id`, sql`t.code`, review)}
      group by s.area_name
      order by count(*) desc
    `
  );
  return rows.map((row) => {
    const attempts = int(row.attempts) ?? 0;
    const made = int(row.made) ?? 0;
    return {
      areaName: str(row.area_name) ?? "Unknown",
      attempts,
      made,
      points: int(row.points) ?? 0,
      fgPercent: attempts > 0 ? (made / attempts) * 100 : null,
    };
  });
}

export async function getTeamSeasonSummary(
  teamId: number,
  season?: number
): Promise<TeamSeasonSummary> {
  const rows = await run<{
    points_for: unknown;
    points_against: unknown;
    pace: unknown;
    ortg: unknown;
    drtg: unknown;
    net_rating: unknown;
    efg: unknown;
    ts: unknown;
  }[]>(
    sql`
      select
        coalesce(sum(tgs.points), 0)::int as points_for,
        coalesce(sum(opp.points), 0)::int as points_against,
        avg(tgm.pace)::float8 as pace,
        (100.0 * sum(tgs.points) / nullif(sum(tgm.possessions_estimate), 0))::float8 as ortg,
        (100.0 * sum(opp.points) / nullif(sum(tgm.opponent_possessions_estimate), 0))::float8 as drtg,
        avg(tgm.net_rating)::float8 as net_rating,
        (100.0 * sum(tgs.fg_made + 0.5 * tgs.three_pt_made) / nullif(sum(tgs.fg_attempted), 0))::float8 as efg,
        (100.0 * sum(tgs.points) / nullif(2 * (sum(tgs.fg_attempted) + 0.44 * sum(tgs.ft_attempted)), 0))::float8 as ts
      from team_game_stats tgs
      join games g on g.game_id = tgs.game_id
      join team_game_stats opp on opp.game_id = tgs.game_id and opp.team_id <> tgs.team_id
      left join team_game_metrics tgm on tgm.game_id = tgs.game_id and tgm.team_id = tgs.team_id
      where tgs.team_id = ${teamId}
      ${season !== undefined ? sql`and g.season_year = ${season}` : sql``}
    `
  );
  const row = rows[0];
  return {
    pointsFor: int(row?.points_for) ?? 0,
    pointsAgainst: int(row?.points_against) ?? 0,
    pace: num(row?.pace),
    offensiveRating: num(row?.ortg),
    defensiveRating: num(row?.drtg),
    netRating: num(row?.net_rating),
    efgPercent: num(row?.efg),
    tsPercent: num(row?.ts),
  };
}

export async function getTeamTopPlayers(
  teamId: number,
  season?: number,
  limit = 12
): Promise<PlayerLeaderRow[]> {
  const rows = await run<{
    player_id: unknown;
    display_name: string;
    team_code: string;
    team_name: string | null;
    games_played: unknown;
    minutes_seconds: unknown;
    points: unknown;
    rebounds: unknown;
    assists: unknown;
    efficiency: unknown;
    plus_minus: unknown;
    efg: unknown;
    ts: unknown;
  }[]>(
    sql`
      select
        p.player_id::int as player_id,
        p.display_name,
        t.code as team_code, t.name as team_name,
        count(*)::int as games_played,
        avg(pgs.minutes_seconds)::float8 as minutes_seconds,
        avg(pgs.points)::float8 as points,
        avg(pgs.total_rebounds)::float8 as rebounds,
        avg(pgs.assists)::float8 as assists,
        avg(pgs.efficiency)::float8 as efficiency,
        avg(pgs.plus_minus)::float8 as plus_minus,
        (100.0 * sum(pgs.fg_made + 0.5 * pgs.three_pt_made) / nullif(sum(pgs.fg_attempted), 0))::float8 as efg,
        (100.0 * sum(pgs.points) / nullif(2 * (sum(pgs.fg_attempted) + 0.44 * sum(pgs.ft_attempted)), 0))::float8 as ts
      from player_game_stats pgs
      join games g on g.game_id = pgs.game_id
      join players p on p.player_id = pgs.player_id
      join teams t on t.team_id = pgs.team_id
      where pgs.team_id = ${teamId} and pgs.did_play = true
      ${season !== undefined ? sql`and g.season_year = ${season}` : sql``}
      group by p.player_id, p.display_name, t.code, t.name
      order by avg(pgs.points) desc nulls last
      limit ${limit}
    `
  );
  return rows.map((row) => ({
    playerId: int(row.player_id) ?? 0,
    displayName: row.display_name,
    teamId: teamId,
    teamCode: row.team_code,
    teamName: str(row.team_name),
    gamesPlayed: int(row.games_played) ?? 0,
    minutesPerGame: num(row.minutes_seconds) !== null ? num(row.minutes_seconds)! / 60 : null,
    pointsPerGame: num(row.points),
    reboundsPerGame: num(row.rebounds),
    assistsPerGame: num(row.assists),
    efficiencyPerGame: num(row.efficiency),
    efgPercent: num(row.efg),
    tsPercent: num(row.ts),
    plusMinusPerGame: num(row.plus_minus),
  }));
}

export async function getTeamRoster(teamId: number, season?: number): Promise<TeamRosterRow[]> {
  const rows = await run<{
    player_id: unknown;
    display_name: string;
    jersey_no: string | null;
    is_starter: unknown;
    is_captain: unknown;
    position: string | null;
    height_cm: unknown;
    age: unknown;
    points_per_game: unknown;
    minutes_per_game: unknown;
  }[]>(
    sql`
      select distinct on (gr.player_id)
        gr.player_id::int as player_id,
        p.display_name,
        gr.jersey_no,
        gr.is_starter,
        gr.is_captain,
        gr.position,
        gr.height_cm::int as height_cm,
        gr.age::int as age,
        gr.points_per_game::float8 as points_per_game,
        gr.minutes_per_game::float8 as minutes_per_game
      from game_rosters gr
      join players p on p.player_id = gr.player_id
      join games g on g.game_id = gr.game_id
      where gr.team_id = ${teamId}
      ${season !== undefined ? sql`and g.season_year = ${season}` : sql``}
      order by gr.player_id, g.game_date desc
    `
  );
  return rows.map((row) => ({
    playerId: int(row.player_id) ?? 0,
    displayName: row.display_name,
    jerseyNo: str(row.jersey_no),
    isStarter:
      row.is_starter === true || row.is_starter === "t"
        ? true
        : row.is_starter === false || row.is_starter === "f"
          ? false
          : null,
    isCaptain: row.is_captain === true || row.is_captain === "t",
    position: str(row.position),
    heightCm: int(row.height_cm),
    age: int(row.age),
    pointsPerGame: num(row.points_per_game),
    minutesPerGame: num(row.minutes_per_game),
  }));
}
