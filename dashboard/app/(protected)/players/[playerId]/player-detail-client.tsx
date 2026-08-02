"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { DataTable } from "@/components/ibl/data-table";
import { GamePhaseFilter } from "@/components/ibl/game-phase-filter";
import { SectionCard } from "@/components/ibl/section-card";
import { KpiCard } from "@/components/ibl/kpi-card";
import { ShotChart } from "@/components/ibl/shot-chart";
import { ReviewDot } from "@/components/ibl/badges";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtDate, fmtDuration, fmtNum, fmtPct, fmtSigned } from "@/lib/format";
import type {
  PlayerGameStatRow,
  PlayerProfile,
  PlayerSplit,
  PlusMinusDetailRow,
  ShotPoint,
} from "@/lib/db/types";
import { gamePhaseLabel, type GamePhase } from "@/lib/game-phase";

interface PlayerDetailClientProps {
  profile: PlayerProfile;
  games: PlayerGameStatRow[];
  splits: PlayerSplit[];
  plusMinus: PlusMinusDetailRow[];
  shots: ShotPoint[];
  currentSeason: number;
  currentTeam?: number;
  phase: GamePhase;
}

export function PlayerDetailClient({
  profile,
  games,
  splits,
  plusMinus,
  shots,
  currentSeason,
  currentTeam,
  phase,
}: PlayerDetailClientProps) {
  const phaseQuery = phase === "regular" ? "" : `&phase=${phase}`;
  const listQuery = currentTeam
    ? `?season=${currentSeason}&team=${currentTeam}${phaseQuery}`
    : `?season=${currentSeason}${phaseQuery}`;
  const seasonQuery = `?season=${currentSeason}${phaseQuery}`;

  const totalGames = games.length;
  const totalPts = games.reduce((acc, game) => acc + (game.points || 0), 0);
  const totalReb = games.reduce((acc, game) => acc + (game.totalRebounds || 0), 0);
  const totalAst = games.reduce((acc, game) => acc + (game.assists || 0), 0);
  const totalMin = games.reduce((acc, game) => acc + (game.minutesSeconds || 0), 0);
  const totalPm = games.reduce((acc, game) => acc + (game.plusMinus || 0), 0);

  const ppg = totalGames ? totalPts / totalGames : null;
  const rpg = totalGames ? totalReb / totalGames : null;
  const apg = totalGames ? totalAst / totalGames : null;
  const mpg = totalGames ? totalMin / totalGames / 60 : null;
  const pmAvg = totalGames ? totalPm / totalGames : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Link
          href={`/players${listQuery}`}
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Players
        </Link>
      </div>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {profile.displayName}
            {profile.jerseyNo ? (
              <span className="ml-3 inline-flex items-center rounded-full border bg-muted px-2.5 py-0.5 text-sm font-semibold text-muted-foreground">
                #{profile.jerseyNo}
              </span>
            ) : null}
          </h1>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {profile.teamId ? (
              <Link
                href={`/teams/${profile.teamId}${seasonQuery}`}
                className="font-medium text-primary hover:underline"
              >
                {profile.teamName || profile.teamCode}
              </Link>
            ) : (
              <span>Tanpa tim</span>
            )}
            <span>· {gamePhaseLabel(phase)} {currentSeason}</span>
            {profile.position ? <span>· {profile.position}</span> : null}
            {profile.heightCm ? <span>· {profile.heightCm} cm</span> : null}
            {profile.age ? <span>· Usia {profile.age}</span> : null}
            <span>· {profile.gamesPlayed} GP</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GamePhaseFilter value={phase} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="GP" value={fmtNum(totalGames, 0)} />
        <KpiCard label="MIN/G" value={fmtNum(mpg)} />
        <KpiCard label="PPG" value={fmtNum(ppg)} />
        <KpiCard label="RPG" value={fmtNum(rpg)} />
        <KpiCard label="APG" value={fmtNum(apg)} />
        <KpiCard label="+/-" value={fmtSigned(pmAvg)} />
      </div>

      <Tabs defaultValue="log" className="w-full">
        <TabsList className="mb-3 w-full justify-start overflow-x-auto">
          <TabsTrigger value="log">Game Log</TabsTrigger>
          <TabsTrigger value="splits">Splits</TabsTrigger>
          <TabsTrigger value="pm">Plus/Minus</TabsTrigger>
          <TabsTrigger value="shots">Shot Chart</TabsTrigger>
        </TabsList>

        <TabsContent value="log" className="mt-0">
          <SectionCard title="Game Log" description="Statistik per pertandingan untuk musim aktif." bodyClassName="p-0">
            <DataTable<PlayerGameStatRow>
              columns={[
                {
                  key: "date",
                  header: "Tanggal",
                  cell: (row) => (
                    <Link href={`/games/${row.gameId}${seasonQuery}`} className="hover:underline">
                      {fmtDate(row.gameDate)}
                    </Link>
                  ),
                },
                {
                  key: "opp",
                  header: "Lawan",
                  cell: (row) => `${row.isHome ? "vs" : "@"} ${row.opponentCode}`,
                },
                {
                  key: "res",
                  header: "Hasil",
                  cell: (row) => (
                    <span
                      className={
                        row.result === "W"
                          ? "font-medium text-emerald-600 dark:text-emerald-400"
                          : "font-medium text-red-600 dark:text-red-400"
                      }
                    >
                      {row.result}
                    </span>
                  ),
                },
                { key: "min", header: "MIN", align: "right", cell: (row) => fmtDuration(row.minutesSeconds) },
                { key: "pts", header: "PTS", align: "right", cell: (row) => fmtNum(row.points, 0) },
                { key: "reb", header: "REB", align: "right", cell: (row) => fmtNum(row.totalRebounds, 0) },
                { key: "ast", header: "AST", align: "right", cell: (row) => fmtNum(row.assists, 0) },
                { key: "stl", header: "STL", align: "right", cell: (row) => fmtNum(row.steals, 0) },
                { key: "tov", header: "TOV", align: "right", cell: (row) => fmtNum(row.turnovers, 0) },
                { key: "pm", header: "+/-", align: "right", cell: (row) => fmtSigned(row.plusMinus) },
                { key: "eff", header: "EFF", align: "right", cell: (row) => fmtNum(row.efficiency, 0) },
                { key: "efg", header: "eFG%", align: "right", cell: (row) => fmtPct(row.efgPercent, 1) },
                { key: "ts", header: "TS%", align: "right", cell: (row) => fmtPct(row.tsPercent, 1) },
              ]}
              rows={games}
              emptyLabel="Belum ada game log untuk musim ini."
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="splits" className="mt-0">
          <SectionCard title="Home / Away Splits" bodyClassName="p-0">
            <DataTable<PlayerSplit>
              columns={[
                { key: "split", header: "Split", cell: (row) => row.label },
                { key: "gp", header: "GP", align: "right", cell: (row) => row.games },
                { key: "pts", header: "PPG", align: "right", cell: (row) => fmtNum(row.pointsPerGame) },
                { key: "reb", header: "RPG", align: "right", cell: (row) => fmtNum(row.reboundsPerGame) },
                { key: "ast", header: "APG", align: "right", cell: (row) => fmtNum(row.assistsPerGame) },
                { key: "pm", header: "+/-", align: "right", cell: (row) => fmtSigned(row.plusMinusPerGame) },
                { key: "efg", header: "eFG%", align: "right", cell: (row) => fmtPct(row.efgPercent, 1) },
              ]}
              rows={splits}
              emptyLabel="Split home/away belum tersedia."
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="pm" className="mt-0">
          <SectionCard
            title="Plus/Minus Detail"
            description="On/off court impact dari player_plus_minus_details."
            bodyClassName="p-0"
          >
            <DataTable<PlusMinusDetailRow>
              columns={[
                {
                  key: "game",
                  header: "Game",
                  cell: (row) => (
                    <Link href={`/games/${row.gameId}${seasonQuery}`} className="inline-flex items-center gap-1 hover:underline">
                      <ReviewDot active={row.hasIssue} />
                      Game {row.gameId}
                    </Link>
                  ),
                },
                { key: "minOn", header: "Min On", align: "right", cell: (row) => fmtDuration(row.minutesOnSeconds) },
                { key: "pmOn", header: "+/- On", align: "right", cell: (row) => fmtSigned(row.plusMinusOn) },
                { key: "ppmOn", header: "Pts/Min On", align: "right", cell: (row) => fmtNum(row.pointsPerMinuteOn) },
                { key: "minOff", header: "Min Off", align: "right", cell: (row) => fmtDuration(row.minutesOffSeconds) },
                { key: "pmOff", header: "+/- Off", align: "right", cell: (row) => fmtSigned(row.plusMinusOff) },
                { key: "ppmOff", header: "Pts/Min Off", align: "right", cell: (row) => fmtNum(row.pointsPerMinuteOff) },
              ]}
              rows={plusMinus}
              emptyLabel="Detail plus-minus belum tersedia."
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="shots" className="mt-0">
          <SectionCard title="Shot Chart" description={`${shots.length} tembakan`}>
            {shots.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Tidak ada data shot chart untuk musim ini.
              </p>
            ) : (
              <div className="mx-auto w-full max-w-2xl">
                <ShotChart shots={shots} />
              </div>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
