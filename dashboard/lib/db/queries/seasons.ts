import "server-only";
import { sql } from "drizzle-orm";
import { run } from "../client";
import { num } from "./helpers";
import type { SeasonOption } from "../types";

export async function getSeasons(): Promise<SeasonOption[]> {
  const rows = await run<{ season_year: unknown; competition_name: string }[]>(
    sql`select season_year::int as season_year, competition_name from seasons order by season_year desc`
  );
  return rows.map((r) => ({
    seasonYear: num(r.season_year) ?? 0,
    competitionName: r.competition_name,
  }));
}

export async function getDefaultSeason(): Promise<number> {
  const rows = await run<{ m: unknown }[]>(
    sql`select max(season_year)::int as m from seasons`
  );
  const m = num(rows[0]?.m);
  if (!m) throw new Error("No seasons found in database.");
  return m;
}

export async function resolveSeason(
  raw: string | string[] | undefined
): Promise<number> {
  if (raw && !Array.isArray(raw)) {
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 1900 && n <= 2100) return n;
  }
  return getDefaultSeason();
}
