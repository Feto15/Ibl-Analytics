import "server-only";
import { sql } from "drizzle-orm";
import { run } from "../client";
import { int, num, str } from "./helpers";
import { canonicalTeamIdExpression } from "../team-identity";
import type { ShotPoint } from "../types";

export interface ShotChartFilters {
  gameId?: number;
  teamId?: number;
  playerId?: number;
  season?: number;
  period?: number;
  result?: "made" | "missed";
  area?: string;
  confidence?: "high" | "medium" | "low";
  pbp?: "unique" | "area_constrained" | "ambiguous" | "no_event";
  limit?: number;
}

const MAX_SHOTS = 2000;

export async function getShots(filters: ShotChartFilters): Promise<ShotPoint[]> {
  const conditions = [sql`s.court_x_meters is not null and s.court_y_meters is not null`];
  if (filters.gameId) conditions.push(sql`s.game_id = ${filters.gameId}`);
  if (filters.teamId) conditions.push(sql`s.team_id = ${filters.teamId}`);
  if (filters.playerId) conditions.push(sql`s.player_id = ${filters.playerId}`);
  if (filters.season) conditions.push(sql`g.season_year = ${filters.season}`);
  if (filters.period) conditions.push(sql`s.period_no = ${filters.period}`);
  if (filters.result === "made") conditions.push(sql`s.made = true`);
  if (filters.result === "missed") conditions.push(sql`s.made = false`);
  if (filters.area) conditions.push(sql`s.area_name = ${filters.area}`);
  if (filters.confidence)
    conditions.push(sql`s.point_classification_confidence = ${filters.confidence}`);
  if (filters.pbp) conditions.push(sql`s.pbp_match_status = ${filters.pbp}`);

  const where = conditions.reduce((acc, c) => sql`${acc} and ${c}`);
  const limit = Math.min(filters.limit ?? MAX_SHOTS, MAX_SHOTS);

  const rows = await run<{
    shot_id: unknown;
    game_id: unknown;
    team_id: unknown;
    team_code: string;
    player_id: unknown;
    player_name: string | null;
    made: unknown;
    points: unknown;
    court_x: unknown;
    court_y: unknown;
    area_name: string | null;
    confidence: unknown;
    pbp_status: string | null;
    period_no: unknown;
    clock: string | null;
  }[]>(
    sql`
      select
        s.shot_id::int as shot_id, s.game_id::int as game_id,
        ${canonicalTeamIdExpression(sql`s.team_id`, sql`g.season_year`)}::int as team_id, t.code as team_code,
        s.player_id::int as player_id, p.display_name as player_name,
        s.made, s.points,
        s.court_x_meters::float8 as court_x, s.court_y_meters::float8 as court_y,
        s.area_name, s.confidence_score::float8 as confidence,
        s.pbp_match_status as pbp_status,
        s.period_no::int as period_no, s.clock
      from shots s
      join games g on g.game_id = s.game_id
      join teams t on t.team_id = ${canonicalTeamIdExpression(sql`s.team_id`, sql`g.season_year`)}
      left join players p on p.player_id = s.player_id
      where ${where}
      order by s.game_id, s.shot_id
      limit ${limit}
    `
  );
  return rows.map((r) => ({
    shotId: int(r.shot_id) ?? 0,
    gameId: int(r.game_id) ?? 0,
    teamId: int(r.team_id) ?? 0,
    teamCode: r.team_code,
    playerId: int(r.player_id),
    playerName: str(r.player_name),
    made: r.made === true || r.made === "t",
    points: int(r.points),
    courtX: num(r.court_x) ?? 0,
    courtY: num(r.court_y) ?? 0,
    areaName: str(r.area_name),
    confidence: num(r.confidence),
    pbpMatchStatus: str(r.pbp_status),
    periodNo: int(r.period_no),
    clock: str(r.clock),
  }));
}

export async function getShotAreas(season?: number) {
  const where = season ? sql`g.season_year = ${season}` : sql`true`;
  const rows = await run<{ area_name: string | null }[]>(
    sql`select distinct s.area_name from shots s join games g on g.game_id = s.game_id where ${where} and s.area_name is not null order by s.area_name`
  );
  return rows
    .map((r) => str(r.area_name))
    .filter((x): x is string => x !== null);
}

export interface ShotZoneStat {
  areaName: string;
  attempts: number;
  made: number;
  points: number;
  fgPercent: number | null;
}

export async function getShotZoneStats(
  filters: Omit<ShotChartFilters, "limit" | "period" | "result" | "pbp" | "confidence">
): Promise<ShotZoneStat[]> {
  const conditions = [sql`s.court_x_meters is not null`];
  if (filters.gameId) conditions.push(sql`s.game_id = ${filters.gameId}`);
  if (filters.teamId) conditions.push(sql`s.team_id = ${filters.teamId}`);
  if (filters.playerId) conditions.push(sql`s.player_id = ${filters.playerId}`);
  if (filters.season) conditions.push(sql`g.season_year = ${filters.season}`);
  const where = conditions.reduce((acc, c) => sql`${acc} and ${c}`);
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
      where ${where}
      group by s.area_name
      order by s.area_name
    `
  );
  return rows.map((r) => {
    const attempts = int(r.attempts) ?? 0;
    const made = int(r.made) ?? 0;
    return {
      areaName: str(r.area_name) ?? "Unknown",
      attempts,
      made,
      points: int(r.points) ?? 0,
      fgPercent: attempts > 0 ? (made / attempts) * 100 : null,
    };
  });
}
