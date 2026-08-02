import "server-only";
import { sql } from "drizzle-orm";
import { run } from "../client";
import { countRows, int, num, str } from "./helpers";
import { gameRowQuery } from "./overview";
import { teamIdMatches } from "../team-identity";
import { canonicalTeamIdExpression } from "../team-identity";
import { gamePhaseCondition } from "../game-phase";
import type { GamePhase } from "@/lib/game-phase";
import type { GameRow, PageResult } from "../types";

const SORT_MAP: Record<string, string> = {
  date: "g.game_date",
  week: "g.week_no",
  home_score: "g.home_score",
  away_score: "g.away_score",
  total_score: "(coalesce(g.home_score,0) + coalesce(g.away_score,0))",
  season: "g.season_year",
};

export async function getGames(
  opts: {
    page: number;
    pageSize: number;
    sort: string;
    dir: "asc" | "desc";
    season?: number;
    phase?: GamePhase;
    team?: number;
    q?: string;
  }
): Promise<PageResult<GameRow>> {
  const conditions = [];
  if (opts.season) conditions.push(sql`g.season_year = ${opts.season}`);
  conditions.push(gamePhaseCondition(sql`g.source_game_key`, opts.phase));
  if (opts.team) {
    conditions.push(
      sql`(${teamIdMatches(sql`g.home_team_id`, opts.team, opts.season)} or ${teamIdMatches(sql`g.away_team_id`, opts.team, opts.season)})`
    );
  }
  if (opts.q) {
    conditions.push(
      sql`(
        hc.code ilike ${"%" + opts.q + "%"} or
        ac.code ilike ${"%" + opts.q + "%"} or
        hc.name ilike ${"%" + opts.q + "%"} or
        ac.name ilike ${"%" + opts.q + "%"} or
        g.venue ilike ${"%" + opts.q + "%"}
      )`
    );
  }
  const where =
    conditions.length === 0
      ? sql`true`
      : conditions.reduce((acc, c) => sql`${acc} and ${c}`);
  const sortCol = SORT_MAP[opts.sort] ?? SORT_MAP.date;
  const orderBy =
    opts.dir === "asc"
      ? sql.raw(`${sortCol} asc nulls last, g.game_id asc`)
      : sql.raw(`${sortCol} desc nulls last, g.game_id desc`);

  const total = await countRows(
    sql`select count(*)::int as c from games g join teams hc on hc.team_id = g.home_team_id join teams ac on ac.team_id = g.away_team_id where ${where}`
  );
  const offset = (opts.page - 1) * opts.pageSize;
  const rows = await gameRowQuery(where, orderBy, sql`${opts.pageSize} offset ${offset}`);
  return {
    rows,
    pagination: {
      page: opts.page,
      pageSize: opts.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / opts.pageSize)),
    },
  };
}

export async function getGameById(gameId: number) {
  const rows = await gameRowQuery(
    sql`g.game_id = ${gameId}`,
    sql`g.game_id`,
    sql`1`
  );
  return rows[0] ?? null;
}

export async function getGamePeriods(gameId: number) {
  const rows = await run<{
    period_no: unknown;
    period_type: string;
    home_score: unknown;
    away_score: unknown;
  }[]>(
    sql`select period_no::int as period_no, period_type, home_score::int as home_score, away_score::int as away_score
        from game_periods where game_id = ${gameId} order by period_no`
  );
  return rows.map((r) => ({
    periodNo: int(r.period_no) ?? 0,
    periodType: r.period_type,
    homeScore: int(r.home_score) ?? 0,
    awayScore: int(r.away_score) ?? 0,
  }));
}

export async function getTeamBoxScores(gameId: number) {
  const rows = await run<{
    team_id: unknown;
    code: string;
    name: string | null;
    is_home: unknown;
    points: unknown;
    fg_made: unknown;
    fg_attempted: unknown;
    two_pt_made: unknown;
    two_pt_attempted: unknown;
    three_pt_made: unknown;
    three_pt_attempted: unknown;
    ft_made: unknown;
    ft_attempted: unknown;
    offensive_rebounds: unknown;
    defensive_rebounds: unknown;
    total_rebounds: unknown;
    assists: unknown;
    turnovers: unknown;
    steals: unknown;
    blocks: unknown;
    personal_fouls: unknown;
    plus_minus: unknown;
    efficiency: unknown;
    efg_percent: unknown;
    ts_percent: unknown;
  }[]>(
    sql`
      select
        ${canonicalTeamIdExpression(sql`tgs.team_id`, sql`g.season_year`)}::int as team_id, t.code, t.name, tgs.is_home,
        tgs.points, tgs.fg_made, tgs.fg_attempted,
        tgs.two_pt_made, tgs.two_pt_attempted,
        tgs.three_pt_made, tgs.three_pt_attempted,
        tgs.ft_made, tgs.ft_attempted,
        tgs.offensive_rebounds, tgs.defensive_rebounds, tgs.total_rebounds,
        tgs.assists, tgs.turnovers, tgs.steals, tgs.blocks,
        tgs.personal_fouls, tgs.plus_minus, tgs.efficiency,
        tgs.efg_percent::float8 as efg_percent, tgs.ts_percent::float8 as ts_percent
      from team_game_stats tgs
      join games g on g.game_id = tgs.game_id
      join teams t on t.team_id = ${canonicalTeamIdExpression(sql`tgs.team_id`, sql`g.season_year`)}
      where tgs.game_id = ${gameId}
      order by tgs.is_home desc
    `
  );
  return rows.map((r) => ({
    teamId: int(r.team_id) ?? 0,
    code: r.code,
    name: str(r.name),
    isHome: r.is_home === true || r.is_home === "t",
    points: int(r.points),
    fgMade: int(r.fg_made),
    fgAttempted: int(r.fg_attempted),
    twoPtMade: int(r.two_pt_made),
    twoPtAttempted: int(r.two_pt_attempted),
    threePtMade: int(r.three_pt_made),
    threePtAttempted: int(r.three_pt_attempted),
    ftMade: int(r.ft_made),
    ftAttempted: int(r.ft_attempted),
    offensiveRebounds: int(r.offensive_rebounds),
    defensiveRebounds: int(r.defensive_rebounds),
    totalRebounds: int(r.total_rebounds),
    assists: int(r.assists),
    turnovers: int(r.turnovers),
    steals: int(r.steals),
    blocks: int(r.blocks),
    personalFouls: int(r.personal_fouls),
    plusMinus: int(r.plus_minus),
    efficiency: int(r.efficiency),
    efgPercent: num(r.efg_percent),
    tsPercent: num(r.ts_percent),
  }));
}

export async function getGameTeamMetrics(gameId: number) {
  const rows = await run<{
    team_id: unknown;
    code: string;
    name: string | null;
    is_home: unknown;
    possessions: unknown;
    opponent_possessions: unknown;
    pace: unknown;
    ortg: unknown;
    drtg: unknown;
    net_rating: unknown;
  }[]>(
    sql`
      select
        ${canonicalTeamIdExpression(sql`tgm.team_id`, sql`g.season_year`)}::int as team_id, t.code, t.name, tgs.is_home,
        tgm.possessions_estimate::float8 as possessions,
        tgm.opponent_possessions_estimate::float8 as opponent_possessions,
        tgm.pace::float8 as pace,
        tgm.offensive_rating::float8 as ortg,
        tgm.defensive_rating::float8 as drtg,
        tgm.net_rating::float8 as net_rating
      from team_game_metrics tgm
      join games g on g.game_id = tgm.game_id
      join teams t on t.team_id = ${canonicalTeamIdExpression(sql`tgm.team_id`, sql`g.season_year`)}
      left join team_game_stats tgs on tgs.game_id = tgm.game_id and tgs.team_id = tgm.team_id
      where tgm.game_id = ${gameId}
      order by tgs.is_home desc
    `
  );
  return rows.map((r) => ({
    teamId: int(r.team_id) ?? 0,
    code: r.code,
    name: str(r.name),
    isHome: r.is_home === true || r.is_home === "t",
    possessions: num(r.possessions),
    opponentPossessions: num(r.opponent_possessions),
    pace: num(r.pace),
    offensiveRating: num(r.ortg),
    defensiveRating: num(r.drtg),
    netRating: num(r.net_rating),
  }));
}
