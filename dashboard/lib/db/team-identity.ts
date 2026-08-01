import "server-only";
import { sql, type SQL } from "drizzle-orm";

// A small, audited compatibility map for source folders whose team code differs
// from the code used by the game reports. Keep it in the data layer so every
// server query resolves a team identity consistently without changing Neon.
const TEAM_ID_ALIASES: Readonly<Record<number, number>> = {
  47: 44, // BUB -> BBC (Bali United)
  51: 52, // PCCF -> PCF (Pacific Caesar)
  56: 43, // RAH -> AHT (Amartha Hangtuah)
  58: 57, // RJN -> RJM (Rajawali Medan)
  63: 49, // THJ -> HTJ (Hangtuah Jakarta)
};

const SEASON_TEAM_ID_ALIASES = [
  { seasonYear: 2025, aliasId: 43, canonicalId: 49 }, // AHT -> HTJ
  { seasonYear: 2025, aliasId: 53, canonicalId: 55 }, // PHB -> PWB
] as const;

const aliasIds = Object.keys(TEAM_ID_ALIASES).map(Number);

export function canonicalTeamId(teamId: number, season?: number): number {
  const seasonalAlias = SEASON_TEAM_ID_ALIASES.find(
    (entry) => entry.seasonYear === season && entry.aliasId === teamId
  );
  if (seasonalAlias) return seasonalAlias.canonicalId;
  return TEAM_ID_ALIASES[teamId] ?? teamId;
}

export function teamIdsFor(teamId: number, season?: number): number[] {
  const canonicalId = canonicalTeamId(teamId, season);
  const seasonalAliases = SEASON_TEAM_ID_ALIASES
    .filter(
      (entry) =>
        entry.seasonYear === season && entry.canonicalId === canonicalId
    )
    .map((entry) => entry.aliasId);
  return [
    canonicalId,
    ...aliasIds.filter((aliasId) => TEAM_ID_ALIASES[aliasId] === canonicalId),
    ...seasonalAliases,
  ];
}

export function teamIdMatches(column: SQL, teamId: number, season?: number): SQL {
  const ids = teamIdsFor(teamId, season);
  return sql`${column} in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`;
}

export function canonicalTeamIdExpression(column: SQL, seasonColumn?: SQL): SQL {
  if (!seasonColumn) {
    return sql`
      case ${column}
        when 47 then 44
        when 51 then 52
        when 56 then 43
        when 58 then 57
        when 63 then 49
        else ${column}
      end
    `;
  }

  return sql`
    case ${column}
      when 47 then 44
      when 51 then 52
      when 56 then 43
      when 58 then 57
      when 63 then 49
      when 43 then case when ${seasonColumn} = 2025 then 49 else ${column} end
      when 53 then case when ${seasonColumn} = 2025 then 55 else ${column} end
      else ${column}
    end
  `;
}

export function isCanonicalTeamId(teamId: number): boolean {
  return !Object.hasOwn(TEAM_ID_ALIASES, teamId);
}
