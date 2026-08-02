"use client";

import { useMemo } from "react";
import Link from "next/link";
import { DataTable, type SortableColumn } from "@/components/ibl/data-table";
import { ReviewFilter } from "@/components/ibl/review-filter";
import { GamePhaseFilter } from "@/components/ibl/game-phase-filter";
import { fmtNum, fmtPct, fmtSigned } from "@/lib/format";
import type { SeasonOption, StandingRow } from "@/lib/db/types";
import type { ReviewMode } from "@/lib/review";
import { gamePhaseLabel, type GamePhase } from "@/lib/game-phase";

interface TeamsClientProps {
  data: StandingRow[];
  seasons: SeasonOption[];
  currentSeason: number;
  review: ReviewMode;
  phase: GamePhase;
  sort: string;
  dir: "asc" | "desc";
}

export function TeamsClient({ data, currentSeason, review, phase, sort, dir }: TeamsClientProps) {
  const phaseQuery = phase === "regular" ? "" : `&phase=${phase}`;
  const rankedRows = useMemo(
    () => data.map((row, index) => ({ row, rank: index + 1 })),
    [data]
  );

  const columns = useMemo<SortableColumn<(typeof rankedRows)[number]>[]>(
    () => [
      {
        key: "rank",
        header: "#",
        cell: (entry) => entry.rank,
      },
      {
        key: "code",
        header: "Code",
        cell: (entry) => (
          <Link href={`/teams/${entry.row.teamId}?season=${currentSeason}${phaseQuery}`} className="font-semibold text-primary hover:underline">
            {entry.row.code}
          </Link>
        ),
      },
      {
        key: "name",
        header: "Name",
        cell: (entry) => entry.row.name || "-",
      },
      { key: "games", header: "GP", align: "right", cell: (entry) => entry.row.games },
      { key: "wins", header: "W", align: "right", cell: (entry) => entry.row.wins },
      { key: "losses", header: "L", align: "right", cell: (entry) => entry.row.losses },
      {
        key: "win_pct",
        header: "Win%",
        align: "right",
        cell: (entry) =>
          entry.row.games > 0 ? fmtPct(entry.row.wins / entry.row.games) : "-",
        sortValue: "win_pct",
      },
      { key: "points_for", header: "PF", align: "right", cell: (entry) => fmtNum(entry.row.pointsFor, 0), sortValue: "points_for" },
      { key: "points_against", header: "PA", align: "right", cell: (entry) => fmtNum(entry.row.pointsAgainst, 0), sortValue: "points_against" },
      { key: "pace", header: "Pace", align: "right", cell: (entry) => fmtNum(entry.row.pace), sortValue: "pace" },
      { key: "offensive_rating", header: "ORtg", align: "right", cell: (entry) => fmtNum(entry.row.offensiveRating), sortValue: "offensive_rating" },
      { key: "defensive_rating", header: "DRtg", align: "right", cell: (entry) => fmtNum(entry.row.defensiveRating), sortValue: "defensive_rating" },
      { key: "net_rating", header: "NetRtg", align: "right", cell: (entry) => fmtSigned(entry.row.netRating), sortValue: "net_rating" },
      { key: "efg", header: "eFG%", align: "right", cell: (entry) => fmtPct(entry.row.efgPercent, 1), sortValue: "efg" },
      { key: "ts", header: "TS%", align: "right", cell: (entry) => fmtPct(entry.row.tsPercent, 1), sortValue: "ts" },
    ],
    [currentSeason, phaseQuery]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Teams</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {gamePhaseLabel(phase)} {currentSeason} · {data.length} tim
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReviewFilter value={review} />
          <GamePhaseFilter value={phase} />
        </div>
      </div>

      <div className="rounded-md border bg-card">
        {data.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Tidak ada data tim untuk musim ini.
          </p>
        ) : (
          <DataTable
            columns={columns}
            rows={rankedRows}
            sortKey={sort}
            sortDir={dir}
            rowHref={(entry) => `/teams/${entry.row.teamId}?season=${currentSeason}${phaseQuery}`}
          />
        )}
      </div>
    </div>
  );
}
