"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DataTable, type SortableColumn } from "@/components/ibl/data-table";
import { PaginationBar } from "@/components/ibl/pagination-bar";
import { GamePhaseFilter } from "@/components/ibl/game-phase-filter";
import { ReviewBadge } from "@/components/ibl/badges";
import { fmtDuration, fmtNum, fmtSigned } from "@/lib/format";
import type { LineupSummaryRow, Pagination, SeasonOption } from "@/lib/db/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GamePhase } from "@/lib/game-phase";

interface LineupsClientProps {
  data: LineupSummaryRow[];
  pagination: Pagination;
  seasons: SeasonOption[];
  currentSeason: number;
  sort: string;
  dir: "asc" | "desc";
  review: "include" | "exclude";
  phase: GamePhase;
}

export function LineupsClient({ data, pagination, sort, dir, review, phase }: LineupsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleReviewChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("review", value);
    params.set("page", "1");
    router.replace(`${pathname}?${params.toString()}`);
  };

  const columns = useMemo<SortableColumn<LineupSummaryRow>[]>(
    () => [
      {
        key: "team",
        header: "Team",
        cell: (row) => (
          <Link href={`/teams/${row.teamId}`} className="font-semibold text-primary hover:underline">
            {row.teamCode}
          </Link>
        ),
      },
      {
        key: "game",
        header: "Game",
        cell: (row) => (
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">{row.gameDate}</span>
          </div>
        ),
      },
      {
        key: "players",
        header: "Players",
        cell: (row) => (
          <div className="flex flex-wrap gap-1">
            {row.players.map((player) => (
              <Link
                key={player.playerId}
                href={`/players/${player.playerId}`}
                className="rounded border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {player.displayName}
              </Link>
            ))}
            {row.hasIssue && <ReviewBadge ruleCode="lineup_totals_mismatch" />}
          </div>
        ),
      },
      { key: "duration", header: "Duration", align: "right", cell: (row) => fmtDuration(row.durationSeconds), sortValue: "duration" },
      { key: "pm", header: "+/-", align: "right", cell: (row) => fmtSigned(row.plusMinus), sortValue: "plus_minus" },
      { key: "ppm", header: "Pts/Min", align: "right", cell: (row) => fmtNum(row.pointsPerMinute), sortValue: "points_per_minute" },
      { key: "pf", header: "PF", align: "right", cell: (row) => row.pointsFor, sortValue: "points_for" },
      { key: "pa", header: "PA", align: "right", cell: (row) => row.pointsAgainst, sortValue: "points_against" },
      { key: "reb", header: "REB", align: "right", cell: (row) => row.rebounds },
      { key: "ast", header: "AST", align: "right", cell: (row) => row.assists },
      { key: "stl", header: "STL", align: "right", cell: (row) => row.steals },
      { key: "tov", header: "TOV", align: "right", cell: (row) => row.turnovers },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <h1 className="text-2xl font-bold tracking-tight">Lineup Summaries</h1>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Issues:</span>
            <Select value={review} onValueChange={handleReviewChange}>
              <SelectTrigger className="h-9 w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exclude">Exclude</SelectItem>
                <SelectItem value="include">Include</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <GamePhaseFilter value={phase} />
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <DataTable columns={columns} rows={data} sortKey={sort} sortDir={dir} />
        <div className="border-t p-4">
          <PaginationBar pagination={pagination} />
        </div>
      </div>
    </div>
  );
}
