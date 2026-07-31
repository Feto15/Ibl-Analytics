"use client";

import Link from "next/link";
import { useState } from "react";
import { SectionCard } from "@/components/ibl/section-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/ibl/data-table";
import { MetricLabel, METRIC_DEFINITIONS } from "@/components/ibl/metric-tooltip";
import { ShotChart } from "@/components/ibl/shot-chart";
import { MultiBarChart } from "@/components/ibl/multi-charts";
import { ReviewDot } from "@/components/ibl/badges";
import { fmtDate, fmtNum, fmtPct, fmtSigned, fmtDuration } from "@/lib/format";
import type { GameDetailData } from "@/lib/db/queries/game-detail-loader";
import type { PlayerBoxScore, TeamBoxScore, TeamMetricRow, LineupSummaryRow } from "@/lib/db/types";
import { PbpPanel } from "./pbp-panel";
import { RotationTimeline } from "./rotation-timeline";

export function GameDetailClient({
  data,
  gameId,
  reviewBadge,
}: {
  data: NonNullable<GameDetailData>;
  gameId: number;
  reviewBadge: React.ReactNode;
}) {
  const { game, periods, teamBox, metrics, playerBox, shots, lineupSummaries, stints } = data;
  const [tab, setTab] = useState("boxscore");

  const periodChartData = periods.map((p) => ({
    label: p.periodType === "overtime" ? `OT${p.periodNo - 4}` : `Q${p.periodNo}`,
    [game.homeCode]: p.homeScore,
    [game.awayCode]: p.awayScore,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">
            {game.homeCode} vs {game.awayCode}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {fmtDate(game.gameDate)} · {game.venue ?? "Venue tidak diketahui"} · Musim {game.seasonYear}
            {game.weekNo ? ` · W${game.weekNo}` : ""}
          </p>
        </div>
        {reviewBadge}
      </div>

      {/* Final score + period breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title="Skor Akhir" className="lg:col-span-1">
          <div className="flex items-center justify-around py-2">
            <TeamScore
              teamId={game.homeTeamId}
              code={game.homeCode}
              name={game.homeName}
              score={game.homeScore}
            />
            <span className="text-xl text-muted-foreground">:</span>
            <TeamScore
              teamId={game.awayTeamId}
              code={game.awayCode}
              name={game.awayName}
              score={game.awayScore}
            />
          </div>
        </SectionCard>
        <SectionCard title="Skor per Quarter" className="lg:col-span-2">
          {periodChartData.length > 0 ? (
            <MultiBarChart
              data={periodChartData}
              series={[
                { key: game.homeCode, label: game.homeCode, color: "var(--chart-1)" },
                { key: game.awayCode, label: game.awayCode, color: "var(--chart-4)" },
              ]}
              height={180}
            />
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">Data per quarter tidak tersedia.</p>
          )}
        </SectionCard>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="boxscore">Box Score</TabsTrigger>
          <TabsTrigger value="metrics">Team Metrics</TabsTrigger>
          <TabsTrigger value="players">Pemain</TabsTrigger>
          <TabsTrigger value="pbp">Play-by-Play</TabsTrigger>
          <TabsTrigger value="shots">Shot Chart</TabsTrigger>
          <TabsTrigger value="lineups">Lineup</TabsTrigger>
          <TabsTrigger value="rotation">Rotation</TabsTrigger>
        </TabsList>

        <TabsContent value="boxscore" className="mt-3">
          <SectionCard title="Box Score Tim" bodyClassName="p-0">
            <TeamBoxScoreTable rows={teamBox} />
          </SectionCard>
        </TabsContent>

        <TabsContent value="metrics" className="mt-3">
          <SectionCard title="Team Metrics" bodyClassName="p-0">
            <TeamMetricsTable rows={metrics} />
          </SectionCard>
        </TabsContent>
        <TabsContent value="players" className="mt-3 space-y-4">
          {Array.from(new Set(playerBox.map((p) => p.teamId))).map((teamId) => (
            <SectionCard
              key={teamId}
              title={`${playerBox.find((p) => p.teamId === teamId)?.teamCode ?? teamId} — Pemain`}
              bodyClassName="p-0"
            >
              <PlayerBoxScoreTable
                rows={playerBox.filter((p) => p.teamId === teamId)}
              />
            </SectionCard>
          ))}
        </TabsContent>

        <TabsContent value="pbp" className="mt-3">
          <SectionCard title="Play-by-Play" bodyClassName="p-0">
            <PbpPanel gameId={gameId} />
          </SectionCard>
        </TabsContent>

        <TabsContent value="shots" className="mt-3">
          <SectionCard title="Shot Chart" description={`${shots.length} tembakan`}>
            {shots.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Tidak ada data shot chart untuk pertandingan ini.
              </p>
            ) : (
              <ShotChart shots={shots} />
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="lineups" className="mt-3">
          <SectionCard title="Lineup Summary" bodyClassName="p-0">
            <LineupSummaryTable rows={lineupSummaries} />
          </SectionCard>
        </TabsContent>

        <TabsContent value="rotation" className="mt-3">
          <SectionCard title="Rotation Timeline" description="Stint lima pemain per tim">
            <RotationTimeline stints={stints} />
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TeamScore({
  teamId,
  code,
  name,
  score,
}: {
  teamId: number;
  code: string;
  name: string | null;
  score: number | null;
}) {
  return (
    <div className="text-center">
      <Link href={`/teams/${teamId}`} className="text-base font-semibold hover:underline">
        {code}
      </Link>
      {name && <div className="text-xs text-muted-foreground truncate max-w-[140px]">{name}</div>}
      <div className="text-3xl font-bold tabular-nums mt-1">{score ?? "-"}</div>
    </div>
  );
}

function TeamBoxScoreTable({ rows }: { rows: TeamBoxScore[] }) {
  return (
    <DataTable<TeamBoxScore>
      rows={rows}
      columns={[
        {
          key: "team",
          header: "Tim",
          cell: (r) => (
            <Link href={`/teams/${r.teamId}`} className="font-medium hover:underline">
              {r.code}
              {r.isHome ? <span className="ml-1 text-xs text-muted-foreground">(H)</span> : null}
            </Link>
          ),
        },
        { key: "pts", header: "PTS", align: "right", cell: (r) => fmtNum(r.points, 0) },
        { key: "fg", header: "FG", align: "right", cell: (r) => `${r.fgMade ?? "-"}/${r.fgAttempted ?? "-"}` },
        { key: "2p", header: "2P", align: "right", cell: (r) => `${r.twoPtMade ?? "-"}/${r.twoPtAttempted ?? "-"}` },
        { key: "3p", header: "3P", align: "right", cell: (r) => `${r.threePtMade ?? "-"}/${r.threePtAttempted ?? "-"}` },
        { key: "ft", header: "FT", align: "right", cell: (r) => `${r.ftMade ?? "-"}/${r.ftAttempted ?? "-"}` },
        { key: "reb", header: "REB", align: "right", cell: (r) => fmtNum(r.totalRebounds, 0) },
        { key: "ast", header: "AST", align: "right", cell: (r) => fmtNum(r.assists, 0) },
        { key: "tov", header: "TOV", align: "right", cell: (r) => fmtNum(r.turnovers, 0) },
        { key: "stl", header: "STL", align: "right", cell: (r) => fmtNum(r.steals, 0) },
        { key: "blk", header: "BLK", align: "right", cell: (r) => fmtNum(r.blocks, 0) },
        { key: "efg", header: <MetricLabel definition={METRIC_DEFINITIONS.efg}>eFG%</MetricLabel>, align: "right", cell: (r) => fmtPct(r.efgPercent) },
        { key: "ts", header: <MetricLabel definition={METRIC_DEFINITIONS.ts}>TS%</MetricLabel>, align: "right", cell: (r) => fmtPct(r.tsPercent) },
      ]}
    />
  );
}

function TeamMetricsTable({ rows }: { rows: TeamMetricRow[] }) {
  return (
    <DataTable<TeamMetricRow>
      rows={rows}
      columns={[
        {
          key: "team",
          header: "Tim",
          cell: (r) => (
            <Link href={`/teams/${r.teamId}`} className="font-medium hover:underline">
              {r.code}
            </Link>
          ),
        },
        { key: "poss", header: <MetricLabel definition={METRIC_DEFINITIONS.poss}>Poss</MetricLabel>, align: "right", cell: (r) => fmtNum(r.possessions, 1) },
        { key: "pace", header: <MetricLabel definition={METRIC_DEFINITIONS.pace}>Pace</MetricLabel>, align: "right", cell: (r) => fmtNum(r.pace, 1) },
        { key: "ortg", header: <MetricLabel definition={METRIC_DEFINITIONS.ortg}>ORtg</MetricLabel>, align: "right", cell: (r) => fmtNum(r.offensiveRating, 1) },
        { key: "drtg", header: <MetricLabel definition={METRIC_DEFINITIONS.drtg}>DRtg</MetricLabel>, align: "right", cell: (r) => fmtNum(r.defensiveRating, 1) },
        { key: "net", header: <MetricLabel definition={METRIC_DEFINITIONS.netRating}>Net</MetricLabel>, align: "right", cell: (r) => fmtSigned(r.netRating) },
      ]}
    />
  );
}

function PlayerBoxScoreTable({ rows }: { rows: PlayerBoxScore[] }) {
  return (
    <DataTable<PlayerBoxScore>
      rows={rows}
      columns={[
        {
          key: "player",
          header: "Pemain",
          cell: (p) => (
            <Link
              href={`/players/${p.playerId}`}
              className="inline-flex items-center gap-1.5 font-medium hover:underline"
            >
              {p.isCaptain ? <span className="text-[10px] font-semibold text-amber-500">C</span> : null}
              {p.isStarter ? <span className="text-[10px] text-muted-foreground">S</span> : null}
              {p.displayName}
            </Link>
          ),
        },
        { key: "no", header: "#", align: "right", cell: (p) => p.jerseyNo ?? "-" },
        { key: "min", header: "MIN", align: "right", cell: (p) => fmtDuration(p.minutesSeconds) },
        { key: "pts", header: "PTS", align: "right", cell: (p) => fmtNum(p.points, 0) },
        { key: "fg", header: "FG", align: "right", cell: (p) => `${p.fgMade ?? "-"}/${p.fgAttempted ?? "-"}` },
        { key: "3p", header: "3P", align: "right", cell: (p) => `${p.threePtMade ?? "-"}/${p.threePtAttempted ?? "-"}` },
        { key: "ft", header: "FT", align: "right", cell: (p) => `${p.ftMade ?? "-"}/${p.ftAttempted ?? "-"}` },
        { key: "reb", header: "REB", align: "right", cell: (p) => fmtNum(p.totalRebounds, 0) },
        { key: "ast", header: "AST", align: "right", cell: (p) => fmtNum(p.assists, 0) },
        { key: "stl", header: "STL", align: "right", cell: (p) => fmtNum(p.steals, 0) },
        { key: "blk", header: "BLK", align: "right", cell: (p) => fmtNum(p.blocks, 0) },
        { key: "tov", header: "TOV", align: "right", cell: (p) => fmtNum(p.turnovers, 0) },
        { key: "eff", header: "EFF", align: "right", cell: (p) => fmtNum(p.efficiency, 0) },
        { key: "pm", header: "+/-", align: "right", cell: (p) => fmtSigned(p.plusMinus) },
        { key: "efg", header: "eFG%", align: "right", cell: (p) => fmtPct(p.efgPercent) },
        { key: "ts", header: "TS%", align: "right", cell: (p) => fmtPct(p.tsPercent) },
      ]}
    />
  );
}

function LineupSummaryTable({ rows }: { rows: LineupSummaryRow[] }) {
  return (
    <DataTable<LineupSummaryRow>
      rows={rows}
      columns={[
        { key: "idx", header: "#", align: "right", cell: (r) => r.lineupIndex },
        {
          key: "team",
          header: "Tim",
          cell: (r) => (
            <Link href={`/teams/${r.teamId}`} className="font-medium hover:underline">
              {r.teamCode}
            </Link>
          ),
        },
        { key: "dur", header: "Durasi", align: "right", cell: (r) => fmtDuration(r.durationSeconds) },
        { key: "pf", header: "PF", align: "right", cell: (r) => fmtNum(r.pointsFor, 0) },
        { key: "pa", header: "PA", align: "right", cell: (r) => fmtNum(r.pointsAgainst, 0) },
        { key: "ppm", header: "Pts/Min", align: "right", cell: (r) => fmtNum(r.pointsPerMinute, 2) },
        {
          key: "pm",
          header: "+/-",
          align: "right",
          cell: (r) => (
            <span className="inline-flex items-center gap-1">
              <ReviewDot active={r.hasIssue} />
              {fmtSigned(r.plusMinus)}
            </span>
          ),
        },
        {
          key: "players",
          header: "Pemain",
          cell: (r) => (
            <span className="text-xs text-muted-foreground">
              {r.players.map((p, i) => (
                <span key={p.playerId}>
                  {i > 0 ? ", " : ""}
                  <Link href={`/players/${p.playerId}`} className="hover:underline hover:text-foreground">
                    {p.displayName.split(" ").slice(-1)[0]}
                  </Link>
                </span>
              ))}
            </span>
          ),
        },
      ]}
    />
  );
}
