import "server-only";
import { sql } from "drizzle-orm";
import { run } from "../client";
import { countRows, int, num, str } from "./helpers";
import type { LineupPlayer, LineupStintRow, LineupSummaryRow, PageResult } from "../types";
import { canonicalTeamIdExpression, teamIdMatches } from "../team-identity";

// Issues that affect lineup analysis specifically are scoped by report+team+game.

const SORT_MAP: Record<string, string> = {
  duration: "ls.duration_seconds",
  plus_minus: "ls.plus_minus",
  points_per_minute: "ls.points_per_minute",
  points_for: "ls.points_for",
  points_against: "ls.points_against",
};

export async function getLineupSummaries(
  opts: {
    page: number;
    pageSize: number;
    sort: string;
    dir: "asc" | "desc";
    season?: number;
    team?: number;
    minDuration?: number;
    review: "include" | "exclude";
  }
): Promise<PageResult<LineupSummaryRow>> {
  const conditions = [sql`true`];
  if (opts.season) conditions.push(sql`g.season_year = ${opts.season}`);
  if (opts.team) conditions.push(teamIdMatches(sql`ls.team_id`, opts.team, opts.season));
  if (opts.minDuration !== undefined)
    conditions.push(sql`ls.duration_seconds >= ${opts.minDuration}`);
  if (opts.review === "exclude") {
    conditions.push(sql`
      not exists (
        select 1 from validation_issues vi
        where vi.report_id = ls.report_id
          and vi.rule_code = 'lineup_totals_mismatch'
          and vi.context->>'team_code' = (select code from teams where team_id = ls.team_id)
      )
    `);
  }
  const where = conditions.reduce((acc, c) => sql`${acc} and ${c}`);

  const sortCol = SORT_MAP[opts.sort] ?? SORT_MAP.duration;
  const orderBy =
    opts.dir === "asc"
      ? sql.raw(`${sortCol} asc nulls last, ls.lineup_summary_id asc`)
      : sql.raw(`${sortCol} desc nulls last, ls.lineup_summary_id desc`);

  const total = await countRows(
    sql`select count(*)::int as c from lineup_summaries ls join games g on g.game_id = ls.game_id where ${where}`
  );
  const offset = (opts.page - 1) * opts.pageSize;
  const rows = await run<{
    lineup_summary_id: unknown;
    game_id: unknown;
    team_id: unknown;
    team_code: string;
    team_name: string | null;
    game_date: string | null;
    lineup_index: unknown;
    duration_seconds: unknown;
    points_for: unknown;
    points_against: unknown;
    plus_minus: unknown;
    points_per_minute: unknown;
    rebounds: unknown;
    steals: unknown;
    turnovers: unknown;
    assists: unknown;
  }[]>(
    sql`
      select
        ls.lineup_summary_id::int as lineup_summary_id,
        ls.game_id::int as game_id,
        ${canonicalTeamIdExpression(sql`ls.team_id`, sql`g.season_year`)}::int as team_id,
        t.code as team_code, t.name as team_name,
        g.game_date::text as game_date,
        ls.lineup_index::int as lineup_index,
        ls.duration_seconds, ls.points_for, ls.points_against,
        ls.plus_minus, ls.points_per_minute::float8 as points_per_minute,
        ls.rebounds, ls.steals, ls.turnovers, ls.assists
      from lineup_summaries ls
      join games g on g.game_id = ls.game_id
      join teams t on t.team_id = ${canonicalTeamIdExpression(sql`ls.team_id`, sql`g.season_year`)}
      where ${where}
      order by ${orderBy}
      limit ${opts.pageSize} offset ${offset}
    `
  );

  const ids = rows.map((r) => int(r.lineup_summary_id)!).filter(Boolean);
  const players = ids.length ? await getLineupSummaryPlayers(ids) : new Map();
  const issueIds = await getIssueLineupIds(ids);

  return {
    rows: rows.map((r) => {
      const id = int(r.lineup_summary_id) ?? 0;
      return {
        lineupSummaryId: id,
        gameId: int(r.game_id) ?? 0,
        teamId: int(r.team_id) ?? 0,
        teamCode: r.team_code,
        teamName: str(r.team_name),
        gameDate: r.game_date,
        lineupIndex: int(r.lineup_index) ?? 0,
        durationSeconds: int(r.duration_seconds),
        pointsFor: int(r.points_for),
        pointsAgainst: int(r.points_against),
        plusMinus: int(r.plus_minus),
        pointsPerMinute: num(r.points_per_minute),
        rebounds: int(r.rebounds),
        steals: int(r.steals),
        turnovers: int(r.turnovers),
        assists: int(r.assists),
        players: players.get(id) ?? [],
        hasIssue: issueIds.has(id),
      };
    }),
    pagination: {
      page: opts.page,
      pageSize: opts.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / opts.pageSize)),
    },
  };
}

export async function getGameLineupStints(gameId: number): Promise<LineupStintRow[]> {
  const rows = await run<{
    stint_id: unknown;
    game_id: unknown;
    team_id: unknown;
    team_code: string;
    stint_index: unknown;
    start_period: unknown;
    start_clock: string | null;
    end_period: unknown;
    end_clock: string | null;
    duration_seconds: unknown;
    points_for: unknown;
    points_against: unknown;
    plus_minus: unknown;
    is_starting_lineup: unknown;
  }[]>(
    sql`
      select
        lst.stint_id::int as stint_id, lst.game_id::int as game_id,
        ${canonicalTeamIdExpression(sql`lst.team_id`, sql`g.season_year`)}::int as team_id, t.code as team_code,
        lst.stint_index::int as stint_index,
        lst.start_period::int as start_period, lst.start_clock,
        lst.end_period::int as end_period, lst.end_clock,
        lst.duration_seconds, lst.points_for, lst.points_against, lst.plus_minus,
        lst.is_starting_lineup
      from lineup_stints lst
      join games g on g.game_id = lst.game_id
      join teams t on t.team_id = ${canonicalTeamIdExpression(sql`lst.team_id`, sql`g.season_year`)}
      where lst.game_id = ${gameId}
      order by lst.team_id, lst.stint_index
    `
  );
  const ids = rows.map((r) => int(r.stint_id)!).filter(Boolean);
  const players = ids.length ? await getStintPlayers(ids) : new Map();
  const issueIds = await getIssueStintIds(ids);
  return rows.map((r) => {
    const id = int(r.stint_id) ?? 0;
    return {
      stintId: id,
      gameId: int(r.game_id) ?? 0,
      teamId: int(r.team_id) ?? 0,
      teamCode: r.team_code,
      stintIndex: int(r.stint_index) ?? 0,
      startPeriod: int(r.start_period),
      startClock: str(r.start_clock),
      endPeriod: int(r.end_period),
      endClock: str(r.end_clock),
      durationSeconds: int(r.duration_seconds),
      pointsFor: int(r.points_for),
      pointsAgainst: int(r.points_against),
      plusMinus: int(r.plus_minus),
      isStartingLineup: r.is_starting_lineup === true || r.is_starting_lineup === "t",
      players: players.get(id) ?? [],
      hasIssue: issueIds.has(id),
    };
  });
}

export async function getGameLineupSummaries(
  gameId: number
): Promise<LineupSummaryRow[]> {
  const rows = await run<{
    lineup_summary_id: unknown;
    game_id: unknown;
    team_id: unknown;
    team_code: string;
    team_name: string | null;
    lineup_index: unknown;
    duration_seconds: unknown;
    points_for: unknown;
    points_against: unknown;
    plus_minus: unknown;
    points_per_minute: unknown;
    rebounds: unknown;
    steals: unknown;
    turnovers: unknown;
    assists: unknown;
  }[]>(
    sql`
      select
        ls.lineup_summary_id::int as lineup_summary_id,
        ls.game_id::int as game_id,
        ${canonicalTeamIdExpression(sql`ls.team_id`, sql`g.season_year`)}::int as team_id,
        t.code as team_code,
        t.name as team_name,
        ls.lineup_index::int as lineup_index,
        ls.duration_seconds,
        ls.points_for,
        ls.points_against,
        ls.plus_minus,
        ls.points_per_minute::float8 as points_per_minute,
        ls.rebounds,
        ls.steals,
        ls.turnovers,
        ls.assists
      from lineup_summaries ls
      join games g on g.game_id = ls.game_id
      join teams t on t.team_id = ${canonicalTeamIdExpression(sql`ls.team_id`, sql`g.season_year`)}
      where ls.game_id = ${gameId}
      order by ls.team_id, ls.lineup_index
    `
  );
  const ids = rows.map((row) => int(row.lineup_summary_id) ?? 0).filter(Boolean);
  const players = ids.length ? await getLineupSummaryPlayers(ids) : new Map();
  const issueIds = await getIssueLineupIds(ids);

  return rows.map((row) => {
    const id = int(row.lineup_summary_id) ?? 0;
    return {
      lineupSummaryId: id,
      gameId: int(row.game_id) ?? 0,
      teamId: int(row.team_id) ?? 0,
      teamCode: row.team_code,
      teamName: str(row.team_name),
      gameDate: null,
      lineupIndex: int(row.lineup_index) ?? 0,
      durationSeconds: int(row.duration_seconds),
      pointsFor: int(row.points_for),
      pointsAgainst: int(row.points_against),
      plusMinus: int(row.plus_minus),
      pointsPerMinute: num(row.points_per_minute),
      rebounds: int(row.rebounds),
      steals: int(row.steals),
      turnovers: int(row.turnovers),
      assists: int(row.assists),
      players: players.get(id) ?? [],
      hasIssue: issueIds.has(id),
    };
  });
}

async function getLineupSummaryPlayers(
  ids: number[]
): Promise<Map<number, LineupPlayer[]>> {
  const idList = sql.join(ids.map((id) => sql`${id}`), sql`, `);
  const rows = await run<{
    lineup_summary_id: unknown;
    player_id: unknown;
    display_name: string;
    jersey_no: string | null;
  }[]>(
    sql`
      select lsp.lineup_summary_id::int as lineup_summary_id,
             lsp.player_id::int as player_id,
             p.display_name,
             gr.jersey_no
      from lineup_summary_players lsp
      join players p on p.player_id = lsp.player_id
      join lineup_summaries ls on ls.lineup_summary_id = lsp.lineup_summary_id
      left join game_rosters gr on gr.player_id = lsp.player_id
        and gr.game_id = ls.game_id
        and gr.team_id = ls.team_id
      where lsp.lineup_summary_id in (${idList})
      order by lsp.lineup_summary_id, p.display_name
    `
  );
  const map = new Map<number, LineupPlayer[]>();
  for (const r of rows) {
    const id = int(r.lineup_summary_id) ?? 0;
    if (!map.has(id)) map.set(id, []);
    map.get(id)!.push({
      playerId: int(r.player_id) ?? 0,
      displayName: r.display_name,
      jerseyNo: str(r.jersey_no),
    });
  }
  return map;
}

async function getStintPlayers(
  ids: number[]
): Promise<Map<number, LineupPlayer[]>> {
  const idList = sql.join(ids.map((id) => sql`${id}`), sql`, `);
  const rows = await run<{
    stint_id: unknown;
    player_id: unknown;
    display_name: string;
    jersey_no: string | null;
  }[]>(
    sql`
      select lsp.stint_id::int as stint_id,
             lsp.player_id::int as player_id,
             p.display_name,
             gr.jersey_no
      from lineup_stint_players lsp
      join players p on p.player_id = lsp.player_id
      join lineup_stints lst on lst.stint_id = lsp.stint_id
      left join game_rosters gr on gr.player_id = lsp.player_id
        and gr.game_id = lst.game_id
        and gr.team_id = lst.team_id
      where lsp.stint_id in (${idList})
      order by lsp.stint_id, p.display_name
    `
  );
  const map = new Map<number, LineupPlayer[]>();
  for (const r of rows) {
    const id = int(r.stint_id) ?? 0;
    if (!map.has(id)) map.set(id, []);
    map.get(id)!.push({
      playerId: int(r.player_id) ?? 0,
      displayName: r.display_name,
      jerseyNo: str(r.jersey_no),
    });
  }
  return map;
}

// Validation scoping: lineup/rotation issues are tied to a report+team+game.
// We resolve affected lineup_summary / stint ids so the UI can badge them.
async function getIssueLineupIds(ids: number[]): Promise<Set<number>> {
  if (ids.length === 0) return new Set();
  const idList = sql.join(ids.map((id) => sql`${id}`), sql`, `);
  const rows = await run<{ lineup_summary_id: unknown }[]>(
    sql`
      select ls.lineup_summary_id::int as lineup_summary_id
      from validation_issues vi
      join lineup_summaries ls on ls.report_id = vi.report_id
      where ls.lineup_summary_id in (${idList})
        and vi.rule_code = 'lineup_totals_mismatch'
        and vi.context->>'team_code' = (select code from teams where team_id = ls.team_id)
    `
  );
  return new Set(rows.map((r) => int(r.lineup_summary_id) ?? 0).filter(Boolean));
}

async function getIssueStintIds(ids: number[]): Promise<Set<number>> {
  if (ids.length === 0) return new Set();
  const idList = sql.join(ids.map((id) => sql`${id}`), sql`, `);
  const rows = await run<{ stint_id: unknown }[]>(
    sql`
      select lst.stint_id::int as stint_id
      from validation_issues vi
      join lineup_stints lst on lst.report_id = vi.report_id
      where lst.stint_id in (${idList})
        and vi.rule_code = 'rotation_totals_mismatch'
        and vi.context->>'team_code' = (select code from teams where team_id = lst.team_id)
    `
  );
  return new Set(rows.map((r) => int(r.stint_id) ?? 0).filter(Boolean));
}
