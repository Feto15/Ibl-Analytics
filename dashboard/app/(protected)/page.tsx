import { overviewDb } from "@/lib/db";
import { resolveSeasonParam } from "@/lib/server-utils";
import { overviewQuerySchema } from "@/lib/params";
import { OverviewClient } from "./overview-client";
import { LoadingBlock } from "@/components/ibl/states";
import type { ReviewMode } from "@/lib/review";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const parsed = overviewQuerySchema.safeParse(sp);
  const review: ReviewMode = parsed.success ? parsed.data.review : "exclude";
  const season =
    parsed.success && parsed.data.season
      ? parsed.data.season
      : await resolveSeasonParam(sp.season);

  let payload: {
    kpis: Awaited<ReturnType<typeof overviewDb.getOverviewKpis>>;
    standings: Awaited<ReturnType<typeof overviewDb.getStandings>>;
    leaderboard: Awaited<ReturnType<typeof overviewDb.getPlayerLeaderboard>>;
    trend: Awaited<ReturnType<typeof overviewDb.getGameTrend>>;
    recent: Awaited<ReturnType<typeof overviewDb.getRecentGames>>;
  } | null = null;

  try {
    const [kpis, standings, leaderboard, trend, recent] = await Promise.all([
      overviewDb.getOverviewKpis(season, review),
      overviewDb.getStandings(season, review),
      overviewDb.getPlayerLeaderboard(season, 10, review),
      overviewDb.getGameTrend(season, review),
      overviewDb.getRecentGames(season, 6, review),
    ]);
    payload = { kpis, standings, leaderboard, trend, recent };
  } catch {
    payload = null;
  }

  if (!payload) {
    return <LoadingBlock label="Gagal memuat ringkasan kompetisi." />;
  }

  return (
    <OverviewClient
      season={season}
      review={review}
      kpis={payload.kpis}
      standings={payload.standings}
      leaderboard={payload.leaderboard}
      trend={payload.trend}
      recentGames={payload.recent}
    />
  );
}
