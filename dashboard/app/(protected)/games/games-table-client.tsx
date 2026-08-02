"use client";

import Link from "next/link";
import { DataTable, type SortableColumn } from "@/components/ibl/data-table";
import { fmtDate } from "@/lib/format";
import type { GameRow } from "@/lib/db/types";
import { GamePhaseBadge } from "@/components/ibl/badges";

const columns: SortableColumn<GameRow>[] = [
  {
    key: "phase",
    header: "Fase",
    cell: (g) => <GamePhaseBadge phase={g.phase} />,
  },
  {
    key: "date",
    header: "Tanggal",
    sortValue: "date",
    cell: (g) => <span className="text-muted-foreground">{fmtDate(g.gameDate)}</span>,
  },
  {
    key: "week",
    header: "Minggu",
    sortValue: "week",
    cell: (g) => (g.weekNo ? `W${g.weekNo}` : "-"),
  },
  {
    key: "home",
    header: "Home",
    cell: (g) => (
      <Link href={`/teams/${g.homeTeamId}`} className="font-medium hover:underline">
        {g.homeCode}
      </Link>
    ),
  },
  {
    key: "score",
    header: "Skor",
    align: "center",
    sortValue: "total_score",
    cell: (g) => (
      <span className="tabular-nums font-medium">
        {g.homeScore ?? "-"} : {g.awayScore ?? "-"}
      </span>
    ),
  },
  {
    key: "away",
    header: "Away",
    cell: (g) => (
      <Link href={`/teams/${g.awayTeamId}`} className="font-medium hover:underline">
        {g.awayCode}
      </Link>
    ),
  },
  {
    key: "venue",
    header: "Venue",
    cell: (g) => <span className="text-muted-foreground">{g.venue ?? "-"}</span>,
  },
  {
    key: "season",
    header: "Musim",
    sortValue: "season",
    align: "right",
    cell: (g) => g.seasonYear,
  },
];

export function GamesTableClient({
  rows,
  sortKey,
  sortDir,
  phase,
}: {
  rows: GameRow[];
  sortKey: string;
  sortDir: "asc" | "desc";
  phase: "regular" | "playoffs" | "all";
}) {
  const phaseQuery = phase === "regular" ? "" : `?phase=${phase}`;
  return (
    <DataTable
      sortKey={sortKey}
      sortDir={sortDir}
      rows={rows}
      rowHref={(g) => `/games/${g.gameId}${phaseQuery}`}
      columns={columns}
    />
  );
}
