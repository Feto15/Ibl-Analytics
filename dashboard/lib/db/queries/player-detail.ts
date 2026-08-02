import "server-only";
import { sql } from "drizzle-orm";
import { run } from "../client";
import { int, num, str } from "./helpers";
import type {
  GameRow,
  PlayerGameStatRow,
  PlayerProfile,
  PlayerSplit,
  PlusMinusDetailRow,
  SeasonOption,
} from "../types";
import { gameRowQuery } from "./overview";
import { gamePhaseCondition } from "../game-phase";
import type { GamePhase } from "@/lib/game-phase";

export async function getPlayerProfile(
  playerId: number,
  season?: number,
  phase: GamePhase = "regular"
): Promise<PlayerProfile | null> {
  const base = await run<{
    player_id: unknown;
    display_name: string;
    normalized_name: string;
  }[]>(sql`select player_id::int as player_id, display_name, normalized_name from players where player_id = ${playerId} limit 1`);
  if (!base[0]) return null;

  const latest = await run<{
    team_id: unknown;
    team_code: string;
    team_name: string | null;
    jersey_no: string | null;
    position: string | null;
    height_cm: unknown;
    age: unknown;
  }[]>(
    sql`
      select distinct on (gr.player_id)
        gr.team_id::int as team_id, t.code as team_code, t.name as team_name,
        gr.jersey_no, gr.position,
        gr.height_cm::int as height_cm, gr.age::int as age
      from game_rosters gr
      join teams t on t.team_id = gr.team_id
      join games g on g.game_id = gr.game_id
      where gr.player_id = ${playerId}
      ${season !== undefined ? sql`and g.season_year = ${season}` : sql``}
      and ${gamePhaseCondition(sql`g.source_game_key`, phase)}
      order by gr.player_id, g.game_date desc
    `
  );
  const stats = await run<{
    games: unknown;
  }[]>(
    sql`
      select count(distinct pgs.game_id)::int as games
      from player_game_stats pgs
      join games g on g.game_id = pgs.game_id
      where pgs.player_id = ${playerId} and pgs.did_play = true
      ${season !== undefined ? sql`and g.season_year = ${season}` : sql``}
      and ${gamePhaseCondition(sql`g.source_game_key`, phase)}
    `
  );
  const seasonRows = await run<{ season_year: unknown; competition_name: string }[]>(
    sql`
      select distinct
        g.season_year::int as season_year,
        s.competition_name
      from player_game_stats pgs
      join games g on g.game_id = pgs.game_id
      join seasons s on s.season_year = g.season_year
      where pgs.player_id = ${playerId}
      order by season_year desc
    `
  );
  const seasons: SeasonOption[] = seasonRows.map((row) => ({
    seasonYear: int(row.season_year) ?? 0,
    competitionName: row.competition_name,
  }));

  return {
    playerId: int(base[0].player_id) ?? 0,
    displayName: base[0].display_name,
    normalizedName: base[0].normalized_name,
    teamId: int(latest[0]?.team_id) ?? null,
    teamCode: str(latest[0]?.team_code) ?? null,
    teamName: str(latest[0]?.team_name),
    jerseyNo: str(latest[0]?.jersey_no),
    position: str(latest[0]?.position),
    heightCm: int(latest[0]?.height_cm),
    age: int(latest[0]?.age),
    gamesPlayed: int(stats[0]?.games) ?? 0,
    seasons,
  };
}

export async function getPlayerGameStats(
  playerId: number,
  season?: number,
  limit = 50,
  phase: GamePhase = "regular"
): Promise<PlayerGameStatRow[]> {
  const rows = await run<{
    game_id: unknown;
    game_date: string | null;
    opponent_code: string;
    is_home: unknown;
    result: string;
    minutes_seconds: unknown;
    points: unknown;
    total_rebounds: unknown;
    assists: unknown;
    steals: unknown;
    turnovers: unknown;
    plus_minus: unknown;
    efficiency: unknown;
    efg_percent: unknown;
    ts_percent: unknown;
  }[]>(
    sql`
      select
        pgs.game_id::int as game_id,
        g.game_date::text as game_date,
        opp_t.code as opponent_code,
        tgs.is_home,
        case when tgs.points > opp.points then 'W' else 'L' end as result,
        pgs.minutes_seconds,
        pgs.points, pgs.total_rebounds, pgs.assists,
        pgs.steals, pgs.turnovers, pgs.plus_minus, pgs.efficiency,
        pgs.efg_percent::float8 as efg_percent,
        pgs.ts_percent::float8 as ts_percent
      from player_game_stats pgs
      join games g on g.game_id = pgs.game_id
      join team_game_stats tgs on tgs.game_id = pgs.game_id and tgs.team_id = pgs.team_id
      join team_game_stats opp on opp.game_id = pgs.game_id and opp.team_id <> pgs.team_id
      join teams opp_t on opp_t.team_id = opp.team_id
      where pgs.player_id = ${playerId} and pgs.did_play = true
      ${season !== undefined ? sql`and g.season_year = ${season}` : sql``}
      and ${gamePhaseCondition(sql`g.source_game_key`, phase)}
      order by g.game_date desc, g.game_id desc
      limit ${limit}
    `
  );
  return rows.reverse().map((row) => ({
    gameId: int(row.game_id) ?? 0,
    gameDate: row.game_date,
    opponentCode: row.opponent_code,
    isHome: row.is_home === true || row.is_home === "t",
    result: row.result === "W" ? "W" : "L",
    minutesSeconds: int(row.minutes_seconds),
    points: int(row.points),
    totalRebounds: int(row.total_rebounds),
    assists: int(row.assists),
    steals: int(row.steals),
    turnovers: int(row.turnovers),
    plusMinus: int(row.plus_minus),
    efficiency: int(row.efficiency),
    efgPercent: num(row.efg_percent),
    tsPercent: num(row.ts_percent),
  }));
}

export async function getPlayerSplits(
  playerId: number,
  season?: number,
  phase: GamePhase = "regular"
): Promise<PlayerSplit[]> {
  const seasonClause = season !== undefined ? sql`and g.season_year = ${season}` : sql``;
  const rows = await run<{
    label: string;
    games: unknown;
    points: unknown;
    rebounds: unknown;
    assists: unknown;
    plus_minus: unknown;
    efg: unknown;
  }[]>(
    sql`
      select
        case when tgs.is_home then 'Home' else 'Away' end as label,
        count(distinct pgs.game_id)::int as games,
        avg(pgs.points)::float8 as points,
        avg(pgs.total_rebounds)::float8 as rebounds,
        avg(pgs.assists)::float8 as assists,
        avg(pgs.plus_minus)::float8 as plus_minus,
        (100.0 * sum(pgs.fg_made + 0.5 * pgs.three_pt_made) / nullif(sum(pgs.fg_attempted), 0))::float8 as efg
      from player_game_stats pgs
      join games g on g.game_id = pgs.game_id
      join team_game_stats tgs on tgs.game_id = pgs.game_id and tgs.team_id = pgs.team_id
      where pgs.player_id = ${playerId} and pgs.did_play = true ${seasonClause}
        and ${gamePhaseCondition(sql`g.source_game_key`, phase)}
      group by case when tgs.is_home then 'Home' else 'Away' end
    `
  );
  const map = new Map(rows.map((row) => [row.label, row]));
  const result: PlayerSplit[] = [];
  for (const label of ["Home", "Away"]) {
    const row = map.get(label);
    if (row) {
      result.push({
        label,
        games: int(row.games) ?? 0,
        pointsPerGame: num(row.points),
        reboundsPerGame: num(row.rebounds),
        assistsPerGame: num(row.assists),
        plusMinusPerGame: num(row.plus_minus),
        efgPercent: num(row.efg),
      });
    }
  }
  return result;
}

export async function getPlayerPlusMinus(
  playerId: number,
  season?: number,
  limit = 30,
  phase: GamePhase = "regular"
): Promise<PlusMinusDetailRow[]> {
  const rows = await run<{
    game_id: unknown;
    player_id: unknown;
    team_id: unknown;
    minutes_on_seconds: unknown;
    minutes_off_seconds: unknown;
    score_on_for: unknown;
    score_on_against: unknown;
    score_off_for: unknown;
    score_off_against: unknown;
    plus_minus_on: unknown;
    plus_minus_off: unknown;
    points_per_minute_on: unknown;
    points_per_minute_off: unknown;
  }[]>(
    sql`
      select
        pm.game_id::int as game_id, pm.player_id::int as player_id, pm.team_id::int as team_id,
        pm.minutes_on_seconds, pm.minutes_off_seconds,
        pm.score_on_for, pm.score_on_against, pm.score_off_for, pm.score_off_against,
        pm.plus_minus_on, pm.plus_minus_off,
        pm.points_per_minute_on::float8 as points_per_minute_on,
        pm.points_per_minute_off::float8 as points_per_minute_off
      from player_plus_minus_details pm
      join games g on g.game_id = pm.game_id
      where pm.player_id = ${playerId}
      ${season !== undefined ? sql`and g.season_year = ${season}` : sql``}
      and ${gamePhaseCondition(sql`g.source_game_key`, phase)}
      order by g.game_date desc, g.game_id desc
      limit ${limit}
    `
  );
  const gameIds = rows.map((row) => int(row.game_id) ?? 0).filter(Boolean);
  let issueGames = new Set<number>();
  if (gameIds.length) {
    const issueRows = await run<{ game_id: unknown }[]>(
      sql`
        select r.game_id::int as game_id
        from validation_issues vi
        join reports r on r.report_id = vi.report_id
        where vi.rule_code = 'plus_minus_crosscheck_unavailable'
          and r.game_id in (${sql.join(gameIds.map((id) => sql`${id}`), sql`, `)})
      `
    );
    issueGames = new Set(issueRows.map((row) => int(row.game_id) ?? 0).filter(Boolean));
  }
  return rows.map((row) => ({
    gameId: int(row.game_id) ?? 0,
    playerId: int(row.player_id) ?? 0,
    teamId: int(row.team_id) ?? 0,
    minutesOnSeconds: int(row.minutes_on_seconds),
    minutesOffSeconds: int(row.minutes_off_seconds),
    scoreOnFor: int(row.score_on_for),
    scoreOnAgainst: int(row.score_on_against),
    scoreOffFor: int(row.score_off_for),
    scoreOffAgainst: int(row.score_off_against),
    plusMinusOn: int(row.plus_minus_on),
    plusMinusOff: int(row.plus_minus_off),
    pointsPerMinuteOn: num(row.points_per_minute_on),
    pointsPerMinuteOff: num(row.points_per_minute_off),
    hasIssue: issueGames.has(int(row.game_id) ?? 0),
  }));
}

export async function getPlayerGames(
  playerId: number,
  season?: number,
  limit = 30,
  phase: GamePhase = "regular"
): Promise<GameRow[]> {
  const where = season
    ? sql`g.game_id in (select game_id from player_game_stats where player_id = ${playerId})
        and g.season_year = ${season}
        and ${gamePhaseCondition(sql`g.source_game_key`, phase)}`
    : sql`g.game_id in (select game_id from player_game_stats where player_id = ${playerId})
        and ${gamePhaseCondition(sql`g.source_game_key`, phase)}`;
  return gameRowQuery(where, sql`g.game_date desc, g.game_id desc`, sql`${limit}`);
}

export async function searchPlayers(q: string, limit: number) {
  const rows = await run<{
    player_id: unknown;
    display_name: string;
    team_code: string | null;
  }[]>(
    sql`
      select p.player_id::int as player_id, p.display_name, t.code as team_code
      from players p
      left join lateral (
        select t.code from player_game_stats pgs
        join teams t on t.team_id = pgs.team_id
        where pgs.player_id = p.player_id
        group by t.code order by count(*) desc limit 1
      ) t on true
      where p.display_name ilike ${"%" + q + "%"} or p.normalized_name ilike ${"%" + q + "%"}
      order by p.display_name
      limit ${limit}
    `
  );
  return rows.map((row) => ({
    playerId: int(row.player_id) ?? 0,
    displayName: row.display_name,
    teamCode: str(row.team_code),
  }));
}
