import { overviewDb, seasonsDb } from "@/lib/db";
import { resolveSeasonParam } from "@/lib/server-utils";
import { TeamsClient } from "./teams-client";
import { teamsQuerySchema } from "@/lib/params";
import type { StandingRow } from "@/lib/db/types";

export const metadata = { title: "Teams | IBL Analytics" };

const sortableFieldMap = {
  win_pct: null,
  net_rating: "netRating",
  pace: "pace",
  offensive_rating: "offensiveRating",
  defensive_rating: "defensiveRating",
  efg: "efgPercent",
  ts: "tsPercent",
  points_for: "pointsFor",
  points_against: "pointsAgainst",
} as const satisfies Record<string, keyof StandingRow | null>;

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const parsed = teamsQuerySchema.safeParse(sp);
  const sort = parsed.success ? parsed.data.sort : "win_pct";
  const dir = parsed.success ? parsed.data.dir : "desc";
  const review = parsed.success ? parsed.data.review : "exclude";

  const season = parsed.success && parsed.data.season
    ? parsed.data.season
    : await resolveSeasonParam(sp.season);
  const seasons = await seasonsDb.getSeasons();
  const standings: StandingRow[] = [...(await overviewDb.getStandings(season, review))];

  standings.sort((a, b) => {
    const field = sortableFieldMap[sort];
    const numericA = sort === "win_pct" ? a.wins / Math.max(1, a.games) : a[field ?? "wins"];
    const numericB = sort === "win_pct" ? b.wins / Math.max(1, b.games) : b[field ?? "wins"];

    if (numericA === numericB) return 0;
    if (numericA === null) return 1;
    if (numericB === null) return -1;

    const comparison = numericA > numericB ? 1 : -1;
    return dir === "asc" ? comparison : -comparison;
  });

  return (
    <div className="p-6">
      <TeamsClient data={standings} seasons={seasons} currentSeason={season} review={review} sort={sort} dir={dir} />
    </div>
  );
}
