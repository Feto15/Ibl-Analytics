import "server-only";
import { sql } from "drizzle-orm";
import { run } from "../client";
import { int, str } from "./helpers";
import { canonicalTeamId, isCanonicalTeamId } from "../team-identity";
import type { TeamOption } from "../types";

export async function getTeams(): Promise<TeamOption[]> {
  const rows = await run<{
    team_id: unknown;
    code: string;
    name: string | null;
  }[]>(
    sql`select team_id::int as team_id, code, name from teams order by code`
  );
  return rows
    .map((r) => ({
      teamId: int(r.team_id) ?? 0,
      code: r.code,
      name: str(r.name),
    }))
    .filter((team) => isCanonicalTeamId(team.teamId));
}

export async function getTeam(teamId: number) {
  const canonicalId = canonicalTeamId(teamId);
  const rows = await run<{
    team_id: unknown;
    code: string;
    name: string | null;
  }[]>(
    sql`select team_id::int as team_id, code, name from teams where team_id = ${canonicalId} limit 1`
  );
  const r = rows[0];
  if (!r) return null;
  return {
    teamId: int(r.team_id) ?? 0,
    code: r.code,
    name: str(r.name),
  };
}
