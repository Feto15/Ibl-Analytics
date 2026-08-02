"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { DataTable } from "@/components/ibl/data-table";
import { SeasonFilter } from "@/components/ibl/season-filter";
import { GamePhaseFilter } from "@/components/ibl/game-phase-filter";
import { SectionCard } from "@/components/ibl/section-card";
import { KpiCard } from "@/components/ibl/kpi-card";
import { TrendAreaChart } from "@/components/ibl/trend-charts";
import { ReviewDot } from "@/components/ibl/badges";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtDate, fmtDuration, fmtNum, fmtPct, fmtSigned } from "@/lib/format";
import type {
  GameRow,
  LineupSummaryRow,
  PlayerLeaderRow,
  TeamProfile,
  TeamRosterRow,
  TeamSeasonSummary,
  TeamShotProfile,
  TeamTrendPoint,
} from "@/lib/db/types";
import { gamePhaseLabel, type GamePhase } from "@/lib/game-phase";

interface TeamDetailClientProps {
  profile: TeamProfile;
  summary: TeamSeasonSummary;
  games: GameRow[];
  trend: TeamTrendPoint[];
  shotProfile: TeamShotProfile[];
  topPlayers: PlayerLeaderRow[];
  roster: TeamRosterRow[];
  bestLineups: LineupSummaryRow[];
  worstLineups: LineupSummaryRow[];
  currentSeason: number;
  phase: GamePhase;
}

export function TeamDetailClient({
  profile,
  summary,
  games,
  trend,
  shotProfile,
  topPlayers,
  roster,
  bestLineups,
  worstLineups,
  currentSeason,
  phase,
}: TeamDetailClientProps) {
  const winPct = profile.games > 0 ? profile.wins / profile.games : null;
  const phaseQuery = phase === "regular" ? "" : `&phase=${phase}`;
  const seasonQuery = `?season=${currentSeason}${phaseQuery}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Link href={`/teams${seasonQuery}`} className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground">
          <ChevronLeft className="mr-1 h-4 w-4" />
          Teams
        </Link>
      </div>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {profile.name || profile.code} <span className="font-normal text-muted-foreground">({profile.code})</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {gamePhaseLabel(phase)} {currentSeason} · Rekor {profile.wins}-{profile.losses} ({fmtPct(winPct)})
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GamePhaseFilter value={phase} />
          <SeasonFilter seasons={profile.seasons} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Pertandingan" value={fmtNum(profile.games, 0)} />
        <KpiCard label="Poin cetak" value={fmtNum(summary.pointsFor, 0)} />
        <KpiCard label="Poin kebobolan" value={fmtNum(summary.pointsAgainst, 0)} />
        <KpiCard label="Net Rtg" value={fmtSigned(summary.netRating)} accent={summary.netRating !== null && summary.netRating < 0 ? "negative" : "positive"} />
      </div>

      <Tabs defaultValue="games" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="games">Pertandingan</TabsTrigger>
          <TabsTrigger value="roster">Roster</TabsTrigger>
          <TabsTrigger value="trend">Tren</TabsTrigger>
          <TabsTrigger value="shots">Shot Profile</TabsTrigger>
          <TabsTrigger value="leaders">Pemain Utama</TabsTrigger>
          <TabsTrigger value="lineups">Lineup</TabsTrigger>
        </TabsList>

        <TabsContent value="games" className="mt-3">
          <SectionCard title="Daftar Pertandingan" bodyClassName="p-0">
            <DataTable<GameRow>
              rowHref={(row) => `/games/${row.gameId}${seasonQuery}`}
              columns={[
                { key: "date", header: "Tanggal", cell: (row) => fmtDate(row.gameDate) },
                { key: "week", header: "Minggu", cell: (row) => row.weekNo ? `W${row.weekNo}` : "-" },
                {
                  key: "matchup",
                  header: "Laga",
                  cell: (row) => {
                    const isHome = row.homeTeamId === profile.teamId;
                    const oppCode = isHome ? row.awayCode : row.homeCode;
                    const oppId = isHome ? row.awayTeamId : row.homeTeamId;
                    return (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">{isHome ? "vs" : "@"}</span>
                        <Link href={`/teams/${oppId}${seasonQuery}`} className="font-medium hover:underline">
                          {oppCode}
                        </Link>
                      </span>
                    );
                  },
                },
                {
                  key: "score",
                  header: "Skor",
                  align: "right",
                  cell: (row) => {
                    const isHome = row.homeTeamId === profile.teamId;
                    const us = isHome ? row.homeScore : row.awayScore;
                    const them = isHome ? row.awayScore : row.homeScore;
                    const result =
                      us == null || them == null ? null : us > them ? "W" : us < them ? "L" : "T";
                    return (
                      <span className="inline-flex items-center gap-2 tabular-nums">
                        {us ?? "-"}-{them ?? "-"}
                        {result ? (
                          <span
                            className={
                              result === "W"
                                ? "text-xs font-medium text-emerald-600 dark:text-emerald-400"
                                : result === "L"
                                  ? "text-xs font-medium text-red-600 dark:text-red-400"
                                  : "text-xs text-muted-foreground"
                            }
                          >
                            {result}
                          </span>
                        ) : null}
                      </span>
                    );
                  },
                },
                { key: "venue", header: "Venue", cell: (row) => row.venue ?? "-" },
              ]}
              rows={games}
              emptyLabel="Belum ada pertandingan pada musim ini."
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="roster" className="mt-3">
          <SectionCard title="Roster" bodyClassName="p-0">
            <DataTable<TeamRosterRow>
              columns={[
                {
                  key: "player",
                  header: "Pemain",
                  cell: (row) => (
                    <Link
                      href={`/players/${row.playerId}${seasonQuery}`}
                      className="font-medium hover:underline"
                    >
                      {row.displayName}
                    </Link>
                  ),
                },
                { key: "no", header: "#", align: "right", cell: (row) => row.jerseyNo ?? "-" },
                { key: "pos", header: "Pos", cell: (row) => row.position ?? "-" },
                {
                  key: "starter",
                  header: "Starter",
                  cell: (row) => (row.isStarter === null ? "-" : row.isStarter ? "Ya" : "Tidak"),
                },
                { key: "ppg", header: "PPG", align: "right", cell: (row) => fmtNum(row.pointsPerGame, 1) },
                { key: "mpg", header: "MPG", align: "right", cell: (row) => fmtNum(row.minutesPerGame, 1) },
              ]}
              rows={roster}
              emptyLabel="Roster belum tersedia."
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="trend" className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Pace" value={fmtNum(summary.pace, 1)} />
            <KpiCard label="ORtg" value={fmtNum(summary.offensiveRating, 1)} />
            <KpiCard label="DRtg" value={fmtNum(summary.defensiveRating, 1)} />
            <KpiCard label="eFG%" value={fmtPct(summary.efgPercent)} />
          </div>
          <SectionCard title="Tren Net Rating">
            <TrendAreaChart
              data={trend.map((point) => ({
                label: `vs ${point.opponentCode} (${point.result})`,
                value: point.netRating,
                gameDate: point.gameDate,
              }))}
              height={300}
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="shots" className="mt-3">
          <SectionCard title="Shot Profile" description="Shot area dengan validation issue dikecualikan secara default." bodyClassName="p-0">
            <DataTable<TeamShotProfile>
              columns={[
                { key: "area", header: "Area", cell: (row) => row.areaName },
                { key: "att", header: "FGA", align: "right", cell: (row) => fmtNum(row.attempts, 0) },
                { key: "made", header: "FGM", align: "right", cell: (row) => fmtNum(row.made, 0) },
                { key: "pts", header: "PTS", align: "right", cell: (row) => fmtNum(row.points, 0) },
                { key: "fg", header: "FG%", align: "right", cell: (row) => fmtPct(row.fgPercent) },
              ]}
              rows={shotProfile}
              emptyLabel="Shot profile belum tersedia."
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="leaders" className="mt-3">
          <SectionCard title="Pemain Utama" bodyClassName="p-0">
            <DataTable<PlayerLeaderRow>
              columns={[
                {
                  key: "player",
                  header: "Pemain",
                  cell: (row) => (
                    <Link
                      href={`/players/${row.playerId}${seasonQuery}`}
                      className="font-medium hover:underline"
                    >
                      {row.displayName}
                    </Link>
                  ),
                },
                { key: "gp", header: "GP", align: "right", cell: (row) => fmtNum(row.gamesPlayed, 0) },
                { key: "ppg", header: "PPG", align: "right", cell: (row) => fmtNum(row.pointsPerGame, 1) },
                { key: "rpg", header: "RPG", align: "right", cell: (row) => fmtNum(row.reboundsPerGame, 1) },
                { key: "apg", header: "APG", align: "right", cell: (row) => fmtNum(row.assistsPerGame, 1) },
                { key: "efg", header: "eFG%", align: "right", cell: (row) => fmtPct(row.efgPercent) },
              ]}
              rows={topPlayers}
              emptyLabel="Data pemain belum tersedia."
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="lineups" className="mt-3 space-y-3">
          <SectionCard title="Lineup Terbaik" description="Berdasarkan plus-minus dari lineup summary." bodyClassName="p-0">
            <LineupSummaryTable rows={bestLineups} seasonQuery={seasonQuery} />
          </SectionCard>
          <SectionCard title="Lineup Terburuk" description="Berdasarkan plus-minus dari lineup summary." bodyClassName="p-0">
            <LineupSummaryTable rows={worstLineups} seasonQuery={seasonQuery} />
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LineupSummaryTable({
  rows,
  seasonQuery,
}: {
  rows: LineupSummaryRow[];
  seasonQuery: string;
}) {
  return (
    <DataTable<LineupSummaryRow>
      columns={[
        { key: "team", header: "Tim", cell: (row) => <span className="font-medium">{row.teamCode}</span> },
        {
          key: "players",
          header: "Pemain",
          cell: (row) => (
            <span className="text-xs text-muted-foreground">
              {row.players.length === 0
                ? "-"
                : row.players.map((player, index) => (
                    <span key={player.playerId}>
                      {index > 0 ? ", " : ""}
                      <Link
                        href={`/players/${player.playerId}${seasonQuery}`}
                        className="hover:text-foreground hover:underline"
                      >
                        {player.displayName.split(" ").slice(-1)[0]}
                      </Link>
                    </span>
                  ))}
            </span>
          ),
        },
        { key: "dur", header: "Durasi", align: "right", cell: (row) => fmtDuration(row.durationSeconds) },
        { key: "pf", header: "PF", align: "right", cell: (row) => fmtNum(row.pointsFor, 0) },
        { key: "pa", header: "PA", align: "right", cell: (row) => fmtNum(row.pointsAgainst, 0) },
        { key: "ppm", header: "Pts/Min", align: "right", cell: (row) => fmtNum(row.pointsPerMinute, 2) },
        {
          key: "pm",
          header: "+/-",
          align: "right",
          cell: (row) => (
            <span className="inline-flex items-center gap-1">
              <ReviewDot active={row.hasIssue} />
              {fmtSigned(row.plusMinus)}
            </span>
          ),
        },
      ]}
      rows={rows}
      emptyLabel="Lineup summary belum tersedia."
    />
  );
}
