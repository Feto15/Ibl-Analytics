import "server-only";
import { sql } from "drizzle-orm";
import { run } from "../client";
import { countRows, int, num, str } from "./helpers";
import type { PageResult, PlayerLeaderRow } from "../types";

const SORT_MAP: Record<string, string> = {
  points: "agg.points",
  rebounds: "agg.rebounds",
  assists: "agg.assists",
  efficiency: "agg.efficiency",
  efg: "agg.efg",
  ts: "agg.ts",
  plus_minus: "agg.plus_minus",
  minutes: "agg.minutes_seconds",
};

export async function getPlayers(
  opts: {
    page: number;
    pageSize: number;
    sort: string;
    dir: "asc" | "desc";
    season?: number;
    team?: number;
    q?: string;
  }
): Promise<PageResult<PlayerLeaderRow>> {
  const conditions = [sql`pgs.did_play = true`];
  if (opts.season) conditions.push(sql`g.season_year = ${opts.season}`);
  if (opts.team) conditions.push(sql`pgs.team_id = ${opts.team}`);
  if (opts.q) {
    conditions.push(
      sql`(p.display_name ilike ${"%" + opts.q + "%"} or p.normalized_name ilike ${"%" + opts.q + "%"})`
    );
  }
  const where = conditions.reduce((acc, condition) => sql`${acc} and ${condition}`);
  const sortExpr = SORT_MAP[opts.sort] ?? SORT_MAP.points;
  const orderBy =
    opts.dir === "asc"
      ? sql.raw(`${sortExpr} asc nulls last, agg.display_name asc`)
      : sql.raw(`${sortExpr} desc nulls last, agg.display_name asc`);

  // One row per player (not per player-team or game-stat row).
  const total = await countRows(
    sql`
      select count(*)::int as c
      from (
        select p.player_id
        from player_game_stats pgs
        join games g on g.game_id = pgs.game_id
        join players p on p.player_id = pgs.player_id
        where ${where}
        group by p.player_id
      ) player_rows
    `
  );
  const offset = (opts.page - 1) * opts.pageSize;
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
          p.player_id,
          p.display_name,
          pgs.team_id,
          pgs.game_id,
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
        join players p on p.player_id = pgs.player_id
        where ${where}
      ),
      primary_team as (
        select distinct on (player_id)
          player_id,
          team_id
        from filtered
        group by player_id, team_id
        order by player_id, count(*) desc, team_id asc
      ),
      agg as (
        select
          f.player_id,
          f.display_name,
          pt.team_id,
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
        join primary_team pt on pt.player_id = f.player_id
        group by f.player_id, f.display_name, pt.team_id
      )
      select
        agg.player_id::int as player_id,
        agg.display_name,
        agg.team_id::int as team_id,
        t.code as team_code,
        t.name as team_name,
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
      left join teams t on t.team_id = agg.team_id
      order by ${orderBy}
      limit ${opts.pageSize} offset ${offset}
    `
  );
  return {
    rows: rows.map((row) => ({
      playerId: int(row.player_id) ?? 0,
      displayName: row.display_name,
      teamId: int(row.team_id) ?? 0,
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
    })),
    pagination: {
      page: opts.page,
      pageSize: opts.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / opts.pageSize)),
    },
  };
}
