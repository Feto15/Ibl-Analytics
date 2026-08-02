"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DataTable, type SortableColumn } from "@/components/ibl/data-table";
import { PaginationBar } from "@/components/ibl/pagination-bar";
import { SeverityBadge } from "@/components/ibl/badges";
import type { Pagination, SeasonOption, ValidationIssueRow } from "@/lib/db/types";

function clientBasename(path: string | null): string | null {
  if (!path) return null;
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || null;
}

interface ReviewClientProps {
  data: ValidationIssueRow[];
  pagination: Pagination;
  facets: {
    severities: { value: string; count: number }[];
    rules: { value: string; count: number }[];
    reportTypes: { value: string; count: number }[];
  };
  seasons: SeasonOption[];
  currentSeason: number;
  sort: string;
  dir: "asc" | "desc";
  filters: {
    severity?: string;
    ruleCode?: string;
    reportType?: string;
  };
}

export function ReviewClient({
  data,
  pagination,
  facets,
  sort,
  dir,
  filters,
}: ReviewClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleFilter = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set("page", "1");
    router.replace(`${pathname}?${params.toString()}`);
  };

  const columns = useMemo<SortableColumn<ValidationIssueRow>[]>(
    () => [
      {
        key: "severity",
        header: "Severity",
        cell: (row) => <SeverityBadge severity={row.severity} />,
        sortValue: "severity",
      },
      {
        key: "rule",
        header: "Rule Code",
        cell: (row) => <span className="font-mono text-xs">{row.ruleCode}</span>,
        sortValue: "rule",
      },
      {
        key: "message",
        header: "Message",
        cell: (row) => (
          <span className="max-w-md line-clamp-2 text-sm" title={row.message}>
            {row.message}
          </span>
        ),
      },
      { key: "team", header: "Team", cell: (row) => row.teamCode || "-" },
      { key: "report", header: "Report", cell: (row) => row.reportType || "-" },
      {
        key: "source",
        header: "Source",
        cell: (row) => clientBasename(row.sourceFilename) || clientBasename(row.sourcePath) || "-",
      },
      {
        key: "created",
        header: "Created",
        cell: (row) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {new Date(row.createdAt).toLocaleString("id")}
          </span>
        ),
        sortValue: "created",
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Validation Issues</h1>
      </div>

      <div className="flex flex-col items-start gap-6 md:flex-row">
        <div className="w-full flex-shrink-0 space-y-6 md:w-64">
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Severity</h3>
            <ul className="space-y-1">
              <li>
                <button
                  onClick={() => handleFilter("severity", undefined)}
                  className={`w-full rounded px-2 py-1 text-left text-sm hover:bg-muted ${!filters.severity ? "bg-muted font-medium" : ""}`}
                >
                  All Severities
                </button>
              </li>
              {facets.severities.map((facet) => (
                <li key={facet.value}>
                  <button
                    onClick={() => handleFilter("severity", facet.value)}
                    className={`flex w-full justify-between rounded px-2 py-1 text-left text-sm hover:bg-muted ${filters.severity === facet.value ? "bg-muted font-medium" : ""}`}
                  >
                    <span className="capitalize">{facet.value}</span>
                    <span className="text-muted-foreground">{facet.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Rule Code</h3>
            <ul className="space-y-1">
              <li>
                <button
                  onClick={() => handleFilter("ruleCode", undefined)}
                  className={`w-full rounded px-2 py-1 text-left text-sm hover:bg-muted ${!filters.ruleCode ? "bg-muted font-medium" : ""}`}
                >
                  All Rules
                </button>
              </li>
              {facets.rules.map((facet) => (
                <li key={facet.value}>
                  <button
                    onClick={() => handleFilter("ruleCode", facet.value)}
                    className={`flex w-full justify-between rounded px-2 py-1 text-left text-sm hover:bg-muted ${filters.ruleCode === facet.value ? "bg-muted font-medium" : ""}`}
                  >
                    <span className="max-w-[150px] truncate" title={facet.value}>
                      {facet.value}
                    </span>
                    <span className="text-muted-foreground">{facet.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Report Type</h3>
            <ul className="space-y-1">
              <li>
                <button
                  onClick={() => handleFilter("reportType", undefined)}
                  className={`w-full rounded px-2 py-1 text-left text-sm hover:bg-muted ${!filters.reportType ? "bg-muted font-medium" : ""}`}
                >
                  All Reports
                </button>
              </li>
              {facets.reportTypes.map((facet) => (
                <li key={facet.value}>
                  <button
                    onClick={() => handleFilter("reportType", facet.value)}
                    className={`flex w-full justify-between rounded px-2 py-1 text-left text-sm hover:bg-muted ${filters.reportType === facet.value ? "bg-muted font-medium" : ""}`}
                  >
                    <span className="capitalize">{facet.value}</span>
                    <span className="text-muted-foreground">{facet.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="min-w-0 flex-1 rounded-md border bg-card">
          <DataTable columns={columns} rows={data} sortKey={sort} sortDir={dir} />
          <div className="border-t p-4">
            <PaginationBar pagination={pagination} />
          </div>
        </div>
      </div>
    </div>
  );
}
