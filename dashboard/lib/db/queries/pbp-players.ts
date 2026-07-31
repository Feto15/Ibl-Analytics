import "server-only";
import { sql } from "drizzle-orm";
import { run } from "../client";
import { int, num, str } from "./helpers";
import type { PbpEvent, PlayerBoxScore } from "../types";

export async function getPlayerBoxScores(gameId: number): Promise<PlayerBoxScore[]> {
  const rows = await run<{
    game_id: unknown;
    player_id: unknown;
    team_id: unknown;
    team_code: string;
    display_name: string;
    jersey_no: string | null;
    is_starter: unknown;
    is_captain: unknown;
    did_play: unknown;
    minutes_seconds: unknown;
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
    plus_minus: unknown;
    efficiency: unknown;
    efg_percent: unknown;
    ts_percent: unknown;
  }[]>(
    sql`
      select
        pgs.game_id::int as game_id, pgs.player_id::int as player_id,
        pgs.team_id::int as team_id, t.code as team_code,
        p.display_name, pgs.jersey_no,
        pgs.is_starter, pgs.is_captain, pgs.did_play,
        pgs.minutes_seconds,
        pgs.points, pgs.fg_made, pgs.fg_attempted,
        pgs.two_pt_made, pgs.two_pt_attempted,
        pgs.three_pt_made, pgs.three_pt_attempted,
        pgs.ft_made, pgs.ft_attempted,
        pgs.offensive_rebounds, pgs.defensive_rebounds, pgs.total_rebounds,
        pgs.assists, pgs.turnovers, pgs.steals, pgs.blocks,
        pgs.plus_minus, pgs.efficiency,
        pgs.efg_percent::float8 as efg_percent, pgs.ts_percent::float8 as ts_percent
      from player_game_stats pgs
      join players p on p.player_id = pgs.player_id
      join teams t on t.team_id = pgs.team_id
      where pgs.game_id = ${gameId} and pgs.did_play = true
      order by pgs.team_id, pgs.is_starter desc nulls last, pgs.points desc nulls last
    `
  );
  return rows.map((r) => ({
    gameId: int(r.game_id) ?? 0,
    playerId: int(r.player_id) ?? 0,
    teamId: int(r.team_id) ?? 0,
    teamCode: r.team_code,
    displayName: r.display_name,
    jerseyNo: str(r.jersey_no),
    isStarter: r.is_starter === true || r.is_starter === "t" ? true : r.is_starter === false || r.is_starter === "f" ? false : null,
    isCaptain: r.is_captain === true || r.is_captain === "t",
    didPlay: r.did_play === true || r.did_play === "t",
    minutesSeconds: int(r.minutes_seconds),
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
    plusMinus: int(r.plus_minus),
    efficiency: int(r.efficiency),
    efgPercent: num(r.efg_percent),
    tsPercent: num(r.ts_percent),
  }));
}

const MAX_PBP_PAGE_SIZE = 100;

export async function getPbpEvents(
  gameId: number,
  opts: { page: number; pageSize: number }
): Promise<{ rows: PbpEvent[]; total: number }> {
  const page = Math.max(1, opts.page);
  const pageSize = Math.min(Math.max(1, opts.pageSize), MAX_PBP_PAGE_SIZE);
  const totalRows = await run<{ c: unknown }[]>(
    sql`select count(*)::int as c from play_by_play_events where game_id = ${gameId}`
  );
  const total = num(totalRows[0]?.c) ?? 0;
  const offset = (page - 1) * pageSize;
  const rows = await run<{
    event_id: unknown;
    event_index: unknown;
    period_no: unknown;
    clock: string | null;
    team_id: unknown;
    team_code: string | null;
    jersey_no: string | null;
    event_type: string | null;
    description: string;
    home_score: unknown;
    away_score: unknown;
  }[]>(
    sql`
      select
        e.event_id::int as event_id, e.event_index::int as event_index,
        e.period_no::int as period_no, e.clock,
        e.team_id::int as team_id, t.code as team_code,
        e.jersey_no, e.event_type, e.description,
        e.home_score::int as home_score, e.away_score::int as away_score
      from play_by_play_events e
      left join teams t on t.team_id = e.team_id
      where e.game_id = ${gameId}
      order by e.period_no, e.event_index
      limit ${pageSize} offset ${offset}
    `
  );
  return {
    total,
    rows: rows.map((r) => ({
      eventId: int(r.event_id) ?? 0,
      eventIndex: int(r.event_index) ?? 0,
      periodNo: int(r.period_no) ?? 0,
      clock: str(r.clock),
      teamId: int(r.team_id),
      teamCode: str(r.team_code),
      jerseyNo: str(r.jersey_no),
      eventType: str(r.event_type),
      description: r.description,
      homeScore: int(r.home_score),
      awayScore: int(r.away_score),
    })),
  };
}
