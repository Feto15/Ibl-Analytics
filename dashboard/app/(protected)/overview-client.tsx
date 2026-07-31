"use client";

import Link from "next/link";
import { CalendarDays, Gauge, Target, ShieldMinus, Scale, TrendingUp } from "lucide-react";
import { KpiCard } from "@/components/ibl/kpi-card";
import { SectionCard } from "@/components/ibl/section-card";
import { MetricLabel, METRIC_DEFINITIONS } from "@/components/ibl/metric-tooltip";
import { TrendAreaChart, RankedBarChart } from "@/components/ibl/trend-charts";
import { ResultBadge } from "@/components/ibl/badges";
import { ReviewFilter } from "@/components/ibl/review-filter";
import { fmtDate, fmtNum, fmtPct, fmtInt, fmtSigned } from "@/lib/format";
import type {
  GameRow,
  GameTrendPoint,
  OverviewKpis,
  PlayerLeaderRow,
  StandingRow,
} from "@/lib/db/types";
import type { ReviewMode } from "@/lib/review";

export function OverviewClient({
  season,
  review,
  kpis,
  standings,
  leaderboard,
  trend,
  recentGames,
}: {
  season: number;
  review: ReviewMode;
  kpis: OverviewKpis;
  standings: StandingRow[];
  leaderboard: PlayerLeaderRow[];
  trend: GameTrendPoint[];
  recentGames: GameRow[];
}) {
  const trendSeries = trend.map((t) => ({
    label: t.label,
    value: t.value,
  }));
  const topStandings = standings.slice(0, 10);
  // RankedBarChart: first row is top; standings already best-first by Win%.
  const standingsBars = topStandings.map((s) => ({
    label: s.code,
    value: s.games > 0 ? (s.wins / s.games) * 100 : 0,
  }));

  return (
    <div className="w-full p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">
            Overview Kompetisi
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Musim {season} · {kpis.games} pertandingan
          </p>
        </div>
        <ReviewFilter value={review} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Pertandingan"
          value={fmtInt(kpis.games)}
          icon={<CalendarDays className="size-4" />}
          accent="info"
        />
        <KpiCard
          label="Rata-rata Skor"
          value={fmtNum(kpis.avgScore, 1)}
          hint="poin per tim"
          icon={<Target className="size-4" />}
        />
        <KpiCard
          label={<MetricLabel definition={METRIC_DEFINITIONS.pace}>Pace</MetricLabel>}
          value={fmtNum(kpis.pace, 1)}
          icon={<Gauge className="size-4" />}
          accent="info"
        />
        <KpiCard
          label={<MetricLabel definition={METRIC_DEFINITIONS.efg}>eFG%</MetricLabel>}
          value={fmtPct(kpis.efgPercent)}
        />
        <KpiCard
          label={<MetricLabel definition={METRIC_DEFINITIONS.ortg}>ORtg</MetricLabel>}
          value={fmtNum(kpis.offensiveRating, 1)}
          accent="positive"
        />
        <KpiCard
          label={<MetricLabel definition={METRIC_DEFINITIONS.drtg}>DRtg</MetricLabel>}
          value={fmtNum(kpis.defensiveRating, 1)}
          icon={<ShieldMinus className="size-4" />}
          accent="negative"
        />
        <KpiCard
          label={<MetricLabel definition={METRIC_DEFINITIONS.netRating}>Net Rtg</MetricLabel>}
          value={fmtSigned(kpis.netRating)}
          icon={<Scale className="size-4" />}
          accent={
            kpis.netRating === null
              ? "neutral"
              : kpis.netRating >= 0
                ? "positive"
                : "negative"
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard
          title="Tren Skor Pertandingan"
          description="Rata-rata total poin per minggu"
          className="lg:col-span-2"
        >
          <TrendAreaChart
            data={trendSeries}
            valueLabel="Rata-rata Total"
            height={220}
            color="var(--chart-2)"
          />
        </SectionCard>

        <SectionCard
          title="Ranking Tim"
          description="Win% 10 tim teratas"
          action={
            <Link
              href={`/teams?season=${season}${review === "include" ? "&review=include" : ""}`}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <TrendingUp className="size-3" />
              Semua
            </Link>
          }
        >
          {topStandings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Belum ada data.</p>
          ) : (
            <RankedBarChart
              data={standingsBars}
              valueLabel="Win%"
              height={240}
              formatValue={(v) => `${v.toFixed(1)}%`}
            />
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          title="Leaderboard Pemain"
          description={`Top scorer musim ${season}`}
          action={
            <Link
              href={`/players?season=${season}`}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Lihat semua
            </Link>
          }
          bodyClassName="p-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-xs text-muted-foreground">
                  <th className="text-left font-medium px-4 py-2">#</th>
                  <th className="text-left font-medium px-4 py-2">Pemain</th>
                  <th className="text-left font-medium px-4 py-2">Tim</th>
                  <th className="text-right font-medium px-4 py-2">GP</th>
                  <th className="text-right font-medium px-4 py-2">PPG</th>
                  <th className="text-right font-medium px-4 py-2">RPG</th>
                  <th className="text-right font-medium px-4 py-2">APG</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((p, i) => (
                  <tr key={p.playerId} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="px-4 py-2 font-medium">
                      <Link href={`/players/${p.playerId}`} className="hover:underline">
                        {p.displayName}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{p.teamCode}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{p.gamesPlayed}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium">
                      {fmtNum(p.pointsPerGame, 1)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtNum(p.reboundsPerGame, 1)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtNum(p.assistsPerGame, 1)}</td>
                  </tr>
                ))}
                {leaderboard.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted-foreground py-6">
                      Belum ada data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          title="Pertandingan Terbaru"
          description={`Hasil ${recentGames.length} pertandingan terakhir`}
          bodyClassName="p-0"
        >
          <div className="divide-y">
            {recentGames.map((g) => (
              <Link
                key={g.gameId}
                href={`/games/${g.gameId}`}
                className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{g.homeCode}</span>
                    <span className="tabular-nums">
                      {g.homeScore ?? "-"} : {g.awayScore ?? "-"}
                    </span>
                    <span className="font-medium">{g.awayCode}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{fmtDate(g.gameDate)}</div>
                </div>
                <ResultBadge
                  result={
                    (g.homeScore ?? 0) >= (g.awayScore ?? 0) ? "W" : "L"
                  }
                />
              </Link>
            ))}
            {recentGames.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">Belum ada pertandingan.</p>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
