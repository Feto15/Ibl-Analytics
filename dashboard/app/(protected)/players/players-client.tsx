"use client";

import { useMemo } from "react";
import Link from "next/link";
import { DataTable, type SortableColumn } from "@/components/ibl/data-table";
import { PaginationBar } from "@/components/ibl/pagination-bar";
import { SeasonFilter } from "@/components/ibl/season-filter";
import { GamePhaseFilter } from "@/components/ibl/game-phase-filter";
import { SectionCard } from "@/components/ibl/section-card";
import { EmptyState } from "@/components/ibl/states";
import { PlayersFilters } from "./players-filters";
import { fmtNum, fmtPct, fmtSigned } from "@/lib/format";
import type { Pagination, PlayerLeaderRow, SeasonOption } from "@/lib/db/types";
import type { GamePhase } from "@/lib/game-phase";

interface PlayersClientProps {
  data: PlayerLeaderRow[];
  pagination: Pagination;
  seasons: SeasonOption[];
  teams: { value: string; label: string }[];
  currentSeason: number;
  currentTeam: string;
  currentQuery: string;
  sort: string;
  dir: "asc" | "desc";
  phase: GamePhase;
}

export function PlayersClient({
  data,
  pagination,
  seasons,
  teams,
  currentSeason,
  currentTeam,
  currentQuery,
  sort,
  dir,
  phase,
}: PlayersClientProps) {
  const phaseQuery = phase === "regular" ? "" : `&phase=${phase}`;
  const seasonQuery = `?season=${currentSeason}${phaseQuery}`;
  const detailQuery = currentTeam
    ? `?season=${currentSeason}&team=${currentTeam}${phaseQuery}`
    : seasonQuery;

  const columns = useMemo<SortableColumn<PlayerLeaderRow>[]>(
    () => [
      {
        key: "player",
        header: "Pemain",
        cell: (row) => (
          <Link
            href={`/players/${row.playerId}${detailQuery}`}
            className="font-semibold text-primary hover:underline"
          >
            {row.displayName}
          </Link>
        ),
      },
      {
        key: "team",
        header: "Tim",
        cell: (row) =>
          row.teamId ? (
            <Link
              href={`/teams/${row.teamId}${seasonQuery}`}
              className="text-muted-foreground hover:underline"
            >
              {row.teamCode}
            </Link>
          ) : (
            "-"
          ),
      },
      { key: "games", header: "GP", align: "right", cell: (row) => row.gamesPlayed },
      {
        key: "min",
        header: "MIN",
        align: "right",
        cell: (row) => fmtNum(row.minutesPerGame),
        sortValue: "minutes",
      },
      {
        key: "pts",
        header: "PPG",
        align: "right",
        cell: (row) => fmtNum(row.pointsPerGame),
        sortValue: "points",
      },
      {
        key: "reb",
        header: "RPG",
        align: "right",
        cell: (row) => fmtNum(row.reboundsPerGame),
        sortValue: "rebounds",
      },
      {
        key: "ast",
        header: "APG",
        align: "right",
        cell: (row) => fmtNum(row.assistsPerGame),
        sortValue: "assists",
      },
      {
        key: "eff",
        header: "EFF",
        align: "right",
        cell: (row) => fmtNum(row.efficiencyPerGame),
        sortValue: "efficiency",
      },
      {
        key: "pm",
        header: "+/-",
        align: "right",
        cell: (row) => fmtSigned(row.plusMinusPerGame),
        sortValue: "plus_minus",
      },
      {
        key: "efg",
        header: "eFG%",
        align: "right",
        cell: (row) => fmtPct(row.efgPercent, 1),
        sortValue: "efg",
      },
      {
        key: "ts",
        header: "TS%",
        align: "right",
        cell: (row) => fmtPct(row.tsPercent, 1),
        sortValue: "ts",
      },
    ],
    [detailQuery, seasonQuery]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Players</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Musim {currentSeason} · {pagination.total.toLocaleString("en-US")} pemain
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GamePhaseFilter value={phase} />
          <SeasonFilter seasons={seasons} />
        </div>
      </div>

      <SectionCard bodyClassName="p-3">
        <PlayersFilters
          teams={teams}
          currentTeam={currentTeam}
          currentQuery={currentQuery}
        />
      </SectionCard>

      <SectionCard bodyClassName="p-0">
        {data.length === 0 ? (
          <EmptyState
            title="Tidak ada pemain"
            description="Filter saat ini tidak menghasilkan data. Coba ubah pencarian, tim, atau musim."
            resetHref="/players"
          />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={data}
              sortKey={sort}
              sortDir={dir}
              rowHref={(row) => `/players/${row.playerId}${detailQuery}`}
            />
            <div className="border-t p-4">
              <PaginationBar pagination={pagination} pageSizeOptions={[10, 25, 50]} />
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
