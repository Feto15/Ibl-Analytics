import "server-only";
import { sql } from "drizzle-orm";
import { run } from "../client";
import { cached } from "../cache";
import { int, num, str } from "./helpers";
import { excludeBoxScoreReview } from "./review-scope";
import type { ReviewMode } from "@/lib/review";
import type { GamePhase } from "@/lib/game-phase";
import { canonicalTeamId, canonicalTeamIdExpression } from "../team-identity";
import {
  canonicalPlayerDisplayName,
  canonicalPlayerIdExpression,
} from "../player-identity";
import { gamePhaseCondition, gamePhaseExpression } from "../game-phase";
import type {
  GameRow,
  GameTrendPoint,
  OverviewKpis,
  PlayerLeaderRow,
  StandingRow,
} from "../types";

async function loadOverviewKpis(
  season: number,
  review: ReviewMode,
  phase: GamePhase
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
          (select count(*)::int from games g where g.season_year = ${season}
            and ${gamePhaseCondition(sql`g.source_game_key`, phase)}) as games,
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
          and ${gamePhaseCondition(sql`g.source_game_key`, phase)}
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

export function getOverviewKpis(
  season: number,
  review: ReviewMode = "include",
  phase: GamePhase = "regular"
) {
  // Review-dependent aggregates must remain fresh after a new import.
  return review === "include"
    ? getCachedOverviewKpis(season, review, phase)
    : loadOverviewKpis(season, review, phase);
}

async function loadStandings(
  season: number,
  review: ReviewMode,
  phase: GamePhase
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
        join teams t on t.team_id = ${canonicalTeamIdExpression(sql`tgs.team_id`, sql`g.season_year`)}
        join team_game_metrics tgm on tgm.game_id = tgs.game_id and tgm.team_id = tgs.team_id
        left join team_game_stats opp on opp.game_id = tgs.game_id and opp.team_id <> tgs.team_id
        where g.season_year = ${season}
          and ${gamePhaseCondition(sql`g.source_game_key`, phase)}
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

export function getStandings(
  season: number,
  review: ReviewMode = "include",
  phase: GamePhase = "regular"
) {
  return review === "include"
    ? getCachedStandings(season, review, phase)
    : loadStandings(season, review, phase);
}

async function loadPlayerLeaderboard(
  season: number,
  limit: number,
  review: ReviewMode,
  phase: GamePhase
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
        with filtered as (
          select
            ${canonicalPlayerIdExpression(sql`pgs.player_id`)} as player_id,
            pgs.game_id,
            pgs.team_id,
            pgs.minutes_seconds,
            pgs.points,
            pgs.total_rebounds,
            pgs.assists,
            pgs.efficiency,
            pgs.plus_minus,
            pgs.fg_made,
            pgs.fg_attempted,
            pgs.three_pt_made,
            pgs.ft_attempted
          from player_game_stats pgs
          join games g on g.game_id = pgs.game_id
          where g.season_year = ${season}
            and ${gamePhaseCondition(sql`g.source_game_key`, phase)}
            and pgs.did_play = true
            and ${excludeBoxScoreReview(sql`g.game_id`, review)}
        ),
        primary_team as (
          select distinct on (f.player_id)
            f.player_id,
            t.team_id,
            t.code,
            t.name
          from filtered f
          join games g on g.game_id = f.game_id
          join teams t on t.team_id = ${canonicalTeamIdExpression(sql`f.team_id`, sql`g.season_year`)}
          group by f.player_id, t.team_id, t.code, t.name
          order by f.player_id, count(*) desc
        ),
        agg as (
          select
            f.player_id,
            pt.team_id,
            pt.code as team_code,
            pt.name as team_name,
            count(distinct f.game_id)::int as games_played,
            avg(f.minutes_seconds)::float8 as minutes_seconds,
            avg(f.points)::float8 as points,
            avg(f.total_rebounds)::float8 as rebounds,
            avg(f.assists)::float8 as assists,
            avg(f.efficiency)::float8 as efficiency,
            avg(f.plus_minus)::float8 as plus_minus,
            (100.0 * sum(f.fg_made + 0.5 * f.three_pt_made) / nullif(sum(f.fg_attempted), 0))::float8 as efg,
            (100.0 * sum(f.points) / nullif(2 * (sum(f.fg_attempted) + 0.44 * sum(f.ft_attempted)), 0))::float8 as ts
          from filtered f
          left join primary_team pt on pt.player_id = f.player_id
          group by f.player_id, pt.team_id, pt.code, pt.name
        )
        select
          agg.player_id::int as player_id,
          p.display_name,
          agg.team_id::int as team_id,
          agg.team_code,
          agg.team_name,
          agg.games_played,
          agg.minutes_seconds,
          agg.points,
          agg.rebounds,
          agg.assists,
          agg.efficiency,
          agg.plus_minus,
          agg.efg,
          agg.ts
        from agg
        join players p on p.player_id = agg.player_id
        order by agg.points desc nulls last
        limit ${limit}
      `
    );
    return rows.map((r) => {
      const pid = int(r.player_id) ?? 0;
      return {
        playerId: pid,
        displayName: canonicalPlayerDisplayName(pid, r.display_name),
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
      };
    });
}

const getCachedPlayerLeaderboard = cached(
  loadPlayerLeaderboard.bind(null),
  ["ibl-player-leaderboard"]
);

export function getPlayerLeaderboard(
  season: number,
  limit = 50,
  review: ReviewMode = "include",
  phase: GamePhase = "regular"
) {
  return review === "include"
    ? getCachedPlayerLeaderboard(season, limit, review, phase)
    : loadPlayerLeaderboard(season, limit, review, phase);
}

async function loadGameTrend(
  season: number,
  review: ReviewMode,
  phase: GamePhase
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
          and ${gamePhaseCondition(sql`g.source_game_key`, phase)}
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

export function getGameTrend(
  season: number,
  review: ReviewMode = "include",
  phase: GamePhase = "regular"
) {
  return review === "include"
    ? getCachedGameTrend(season, review, phase)
    : loadGameTrend(season, review, phase);
}

export async function getRecentGames(
  season: number,
  limit = 8,
  review: ReviewMode = "include",
  phase: GamePhase = "regular"
): Promise<GameRow[]> {
  const rows = await gameRowQuery(
    sql`g.season_year = ${season}
      and ${gamePhaseCondition(sql`g.source_game_key`, phase)}
      and ${excludeBoxScoreReview(sql`g.game_id`, review)}`,
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
    phase: string;
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
        ${gamePhaseExpression(sql`g.source_game_key`)} as phase,
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
      join teams hc on hc.team_id = ${canonicalTeamIdExpression(sql`g.home_team_id`, sql`g.season_year`)}
      join teams ac on ac.team_id = ${canonicalTeamIdExpression(sql`g.away_team_id`, sql`g.season_year`)}
      where ${where}
      order by ${orderBy}
      limit ${limit}
    `
  );
  return rows.map((r) => ({
    gameId: int(r.game_id) ?? 0,
    seasonYear: int(r.season_year) ?? 0,
    phase: r.phase === "playoffs" ? "playoffs" : "regular",
    weekNo: int(r.week_no),
    gameDate: r.game_date,
    venue: str(r.venue),
    homeTeamId: canonicalTeamId(int(r.home_team_id) ?? 0, int(r.season_year) ?? undefined),
    awayTeamId: canonicalTeamId(int(r.away_team_id) ?? 0, int(r.season_year) ?? undefined),
    homeCode: r.home_code,
    awayCode: r.away_code,
    homeName: str(r.home_name),
    awayName: str(r.away_name),
    homeScore: int(r.home_score),
    awayScore: int(r.away_score),
  }));
}
