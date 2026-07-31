import "server-only";
import { sql } from "drizzle-orm";
import { run } from "../client";
import { cached } from "../cache";
import { int, num, str } from "./helpers";
import { excludeBoxScoreReview } from "./review-scope";
import type { ReviewMode } from "@/lib/review";
import type {
  GameRow,
  GameTrendPoint,
  OverviewKpis,
  PlayerLeaderRow,
  StandingRow,
} from "../types";

async function loadOverviewKpis(
  season: number,
  review: ReviewMode
): Promise<OverviewKpis> {
    const rows = await run<{
      games: unknown;
      avg_score: unknown;
      pace: unknown;
      efg: unknown;
      ortg: unknown;
      drtg: unknown;
    }[]>(
      sql`
        select
          (select count(*)::int from games where season_year = ${season}) as games,
          avg(tgs.points)::float8 as avg_score,
          avg(tgm.pace)::float8 as pace,
          (100.0 * sum(tgs.fg_made + 0.5 * tgs.three_pt_made)
            / nullif(sum(tgs.fg_attempted), 0))::float8 as efg,
          (100.0 * sum(tgs.points)
            / nullif(sum(tgm.possessions_estimate), 0))::float8 as ortg,
          (100.0 * sum(opp.points)
            / nullif(sum(tgm.opponent_possessions_estimate), 0))::float8 as drtg
        from team_game_stats tgs
        join games g on g.game_id = tgs.game_id
        join team_game_metrics tgm on tgm.game_id = tgs.game_id and tgm.team_id = tgs.team_id
        left join team_game_stats opp on opp.game_id = tgs.game_id and opp.team_id <> tgs.team_id
        where g.season_year = ${season}
          and ${excludeBoxScoreReview(sql`g.game_id`, review)}
      `
    );
    const r = rows[0];
    if (!r) {
      return {
        seasonYear: season,
        games: 0,
        avgScore: null,
        pace: null,
        efgPercent: null,
        offensiveRating: null,
        defensiveRating: null,
        netRating: null,
      };
    }
    const ortg = num(r.ortg);
    const drtg = num(r.drtg);
    return {
      seasonYear: season,
      games: int(r.games) ?? 0,
      avgScore: num(r.avg_score),
      pace: num(r.pace),
      efgPercent: num(r.efg),
      offensiveRating: ortg,
      defensiveRating: drtg,
      netRating: ortg !== null && drtg !== null ? ortg - drtg : null,
    };
}

const getCachedOverviewKpis = cached(loadOverviewKpis.bind(null), ["ibl-overview-kpis"]);

export function getOverviewKpis(season: number, review: ReviewMode = "exclude") {
  // Review-dependent aggregates must remain fresh after a new import.
  return review === "include"
    ? getCachedOverviewKpis(season, review)
    : loadOverviewKpis(season, review);
}

async function loadStandings(
  season: number,
  review: ReviewMode
): Promise<StandingRow[]> {
    const rows = await run<{
      team_id: unknown;
      code: string;
      name: string | null;
      games: unknown;
      wins: unknown;
      losses: unknown;
      points_for: unknown;
      points_against: unknown;
      pace: unknown;
      ortg: unknown;
      drtg: unknown;
      efg: unknown;
      ts: unknown;
    }[]>(
      sql`
        select
          t.team_id::int as team_id,
          t.code,
          t.name,
          count(distinct g.game_id)::int as games,
          count(distinct g.game_id) filter (where tgs.points > opp.points)::int as wins,
          count(distinct g.game_id) filter (where tgs.points < opp.points)::int as losses,
          coalesce(sum(tgs.points), 0)::int as points_for,
          coalesce(sum(opp.points), 0)::int as points_against,
          avg(tgm.pace)::float8 as pace,
          (100.0 * sum(tgs.points) / nullif(sum(tgm.possessions_estimate), 0))::float8 as ortg,
          (100.0 * sum(opp.points) / nullif(sum(tgm.opponent_possessions_estimate), 0))::float8 as drtg,
          (100.0 * sum(tgs.fg_made + 0.5 * tgs.three_pt_made) / nullif(sum(tgs.fg_attempted), 0))::float8 as efg,
          (100.0 * sum(tgs.points) / nullif(2 * (sum(tgs.fg_attempted) + 0.44 * sum(tgs.ft_attempted)), 0))::float8 as ts
        from team_game_stats tgs
        join games g on g.game_id = tgs.game_id
        join teams t on t.team_id = tgs.team_id
        join team_game_metrics tgm on tgm.game_id = tgs.game_id and tgm.team_id = tgs.team_id
        left join team_game_stats opp on opp.game_id = tgs.game_id and opp.team_id <> tgs.team_id
        where g.season_year = ${season}
          and ${excludeBoxScoreReview(sql`g.game_id`, review)}
        group by t.team_id, t.code, t.name
      `
    );
    const standings = rows.map((r) => {
      const ortg = num(r.ortg);
      const drtg = num(r.drtg);
      return {
        teamId: int(r.team_id) ?? 0,
        code: r.code,
        name: str(r.name),
        games: int(r.games) ?? 0,
        wins: int(r.wins) ?? 0,
        losses: int(r.losses) ?? 0,
        pointsFor: int(r.points_for) ?? 0,
        pointsAgainst: int(r.points_against) ?? 0,
        pace: num(r.pace),
        offensiveRating: ortg,
        defensiveRating: drtg,
        netRating: ortg !== null && drtg !== null ? ortg - drtg : null,
        efgPercent: num(r.efg),
        tsPercent: num(r.ts),
      };
    });
    return standings.sort((a, b) => {
      const aw = a.wins / Math.max(1, a.games);
      const bw = b.wins / Math.max(1, b.games);
      if (aw !== bw) return bw - aw;
      return (b.netRating ?? -9999) - (a.netRating ?? -9999);
    });
}

const getCachedStandings = cached(loadStandings.bind(null), ["ibl-standings"]);

export function getStandings(season: number, review: ReviewMode = "exclude") {
  return review === "include"
    ? getCachedStandings(season, review)
    : loadStandings(season, review);
}

async function loadPlayerLeaderboard(
  season: number,
  limit: number,
  review: ReviewMode
): Promise<PlayerLeaderRow[]> {
    const rows = await run<{
      player_id: unknown;
      display_name: string;
      team_id: unknown;
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
          tm.team_id::int as team_id,
          tm.code as team_code,
          tm.name as team_name,
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
        left join lateral (
          select t.team_id, t.code, t.name
          from player_game_stats pgs2
          join games g2 on g2.game_id = pgs2.game_id
          join teams t on t.team_id = pgs2.team_id
          where pgs2.player_id = p.player_id and g2.season_year = ${season}
          group by t.team_id, t.code, t.name
          order by count(*) desc
          limit 1
        ) tm on true
        where g.season_year = ${season}
          and pgs.did_play = true
          and ${excludeBoxScoreReview(sql`g.game_id`, review)}
        group by p.player_id, p.display_name, tm.team_id, tm.code, tm.name
        order by avg(pgs.points) desc nulls last
        limit ${limit}
      `
    );
    return rows.map((r) => ({
      playerId: int(r.player_id) ?? 0,
      displayName: r.display_name,
      teamId: int(r.team_id) ?? 0,
      teamCode: r.team_code,
      teamName: str(r.team_name),
      gamesPlayed: int(r.games_played) ?? 0,
      minutesPerGame: num(r.minutes_seconds) !== null ? num(r.minutes_seconds)! / 60 : null,
      pointsPerGame: num(r.points),
      reboundsPerGame: num(r.rebounds),
      assistsPerGame: num(r.assists),
      efficiencyPerGame: num(r.efficiency),
      efgPercent: num(r.efg),
      tsPercent: num(r.ts),
      plusMinusPerGame: num(r.plus_minus),
    }));
}

const getCachedPlayerLeaderboard = cached(
  loadPlayerLeaderboard.bind(null),
  ["ibl-player-leaderboard"]
);

export function getPlayerLeaderboard(
  season: number,
  limit = 50,
  review: ReviewMode = "exclude"
) {
  return review === "include"
    ? getCachedPlayerLeaderboard(season, limit, review)
    : loadPlayerLeaderboard(season, limit, review);
}

async function loadGameTrend(
  season: number,
  review: ReviewMode
): Promise<GameTrendPoint[]> {
    const rows = await run<{
      week_no: unknown;
      avg_total: unknown;
      avg_pace: unknown;
      games: unknown;
    }[]>(
      sql`
        select
          g.week_no::int as week_no,
          avg(coalesce(g.home_score, 0) + coalesce(g.away_score, 0))::float8 as avg_total,
          avg(pm.pace)::float8 as avg_pace,
          count(*)::int as games
        from games g
        left join lateral (
          select pace from team_game_metrics where game_id = g.game_id limit 1
        ) pm on true
        where g.season_year = ${season}
          and g.week_no is not null
          and ${excludeBoxScoreReview(sql`g.game_id`, review)}
        group by g.week_no
        order by g.week_no
      `
    );
    return rows.map((r) => ({
      label: `W${int(r.week_no) ?? 0}`,
      value: num(r.avg_total),
      pace: num(r.avg_pace),
    }));
}

const getCachedGameTrend = cached(loadGameTrend.bind(null), ["ibl-game-trend"]);

export function getGameTrend(season: number, review: ReviewMode = "exclude") {
  return review === "include"
    ? getCachedGameTrend(season, review)
    : loadGameTrend(season, review);
}

export async function getRecentGames(
  season: number,
  limit = 8,
  review: ReviewMode = "exclude"
): Promise<GameRow[]> {
  const rows = await gameRowQuery(
    sql`g.season_year = ${season} and ${excludeBoxScoreReview(sql`g.game_id`, review)}`,
    sql`g.game_date desc, g.game_id desc`,
    sql`${limit}`
  );
  return rows;
}

// Shared games-row projection used by list, recent, and detail pages.
export async function gameRowQuery(
  where: ReturnType<typeof sql>,
  orderBy: ReturnType<typeof sql>,
  limit: ReturnType<typeof sql>
): Promise<GameRow[]> {
  const rows = await run<{
    game_id: unknown;
    season_year: unknown;
    week_no: unknown;
    game_date: string | null;
    venue: string | null;
    home_team_id: unknown;
    away_team_id: unknown;
    home_code: string;
    away_code: string;
    home_name: string | null;
    away_name: string | null;
    home_score: unknown;
    away_score: unknown;
  }[]>(
    sql`
      select
        g.game_id::int as game_id,
        g.season_year::int as season_year,
        g.week_no::int as week_no,
        g.game_date::text as game_date,
        g.venue,
        g.home_team_id::int as home_team_id,
        g.away_team_id::int as away_team_id,
        hc.code as home_code,
        ac.code as away_code,
        hc.name as home_name,
        ac.name as away_name,
        g.home_score::int as home_score,
        g.away_score::int as away_score
      from games g
      join teams hc on hc.team_id = g.home_team_id
      join teams ac on ac.team_id = g.away_team_id
      where ${where}
      order by ${orderBy}
      limit ${limit}
    `
  );
  return rows.map((r) => ({
    gameId: int(r.game_id) ?? 0,
    seasonYear: int(r.season_year) ?? 0,
    weekNo: int(r.week_no),
    gameDate: r.game_date,
    venue: str(r.venue),
    homeTeamId: int(r.home_team_id) ?? 0,
    awayTeamId: int(r.away_team_id) ?? 0,
    homeCode: r.home_code,
    awayCode: r.away_code,
    homeName: str(r.home_name),
    awayName: str(r.away_name),
    homeScore: int(r.home_score),
    awayScore: int(r.away_score),
  }));
}
