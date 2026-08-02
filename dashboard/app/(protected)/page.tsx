import { overviewDb } from "@/lib/db";
import { resolveSeasonParam } from "@/lib/server-utils";
import { overviewQuerySchema } from "@/lib/params";
import { OverviewClient } from "./overview-client";
import { LoadingBlock } from "@/components/ibl/states";
import type { ReviewMode } from "@/lib/review";
import type { GamePhase } from "@/lib/game-phase";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const parsed = overviewQuerySchema.safeParse(sp);
  const review: ReviewMode = parsed.success ? parsed.data.review : "include";
  const phase: GamePhase = parsed.success ? parsed.data.phase : "regular";
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
      overviewDb.getOverviewKpis(season, review, phase),
      overviewDb.getStandings(season, review, phase),
      overviewDb.getPlayerLeaderboard(season, 10, review, phase),
      overviewDb.getGameTrend(season, review, phase),
      overviewDb.getRecentGames(season, 6, review, phase),
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
      phase={phase}
      kpis={payload.kpis}
      standings={payload.standings}
      leaderboard={payload.leaderboard}
      trend={payload.trend}
      recentGames={payload.recent}
    />
  );
}
