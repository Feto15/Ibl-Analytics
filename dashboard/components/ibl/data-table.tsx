"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface SortableColumn<T> {
  key: string;
  header: React.ReactNode;
  align?: "left" | "right" | "center";
  cell: (row: T) => React.ReactNode;
  sortValue?: string;
  className?: string;
  tooltip?: string;
}

/** Server-side sortable table. Sorting lives in URL (?sort=...&dir=...). */
export function DataTable<T>({
  columns,
  rows,
  sortKey,
  sortDir,
  rowHref,
  emptyLabel = "Tidak ada data.",
  onRowClick,
}: {
  columns: SortableColumn<T>[];
  rows: T[];
  sortKey?: string;
  sortDir?: "asc" | "desc";
  rowHref?: (row: T) => string;
  emptyLabel?: string;
  onRowClick?: (row: T) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const toggleSort = (col: SortableColumn<T>) => {
    if (!col.sortValue) return;
    const params = new URLSearchParams(searchParams.toString());
    const isCurrent = sortKey === col.sortValue;
    const nextDir = isCurrent && sortDir === "desc" ? "asc" : "desc";
    params.set("sort", col.sortValue);
    params.set("dir", nextDir);
    params.set("page", "1");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((col) => {
              const isActive = col.sortValue && sortKey === col.sortValue;
              const SortIcon =
                isActive && sortDir === "asc"
                  ? ArrowUp
                  : isActive && sortDir === "desc"
                    ? ArrowDown
                    : ArrowUpDown;
              return (
                <TableHead
                  key={col.key}
                  className={cn(
                    "h-9 text-xs",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
                    col.sortValue && "cursor-pointer select-none hover:text-foreground",
                    col.className
                  )}
                  onClick={col.sortValue ? () => toggleSort(col) : undefined}
                  title={col.tooltip}
                >
                  <span
                    className={cn(
                      "inline-flex items-center gap-1",
                      col.align === "right" && "flex-row-reverse"
                    )}
                  >
                    {col.header}
                    {col.sortValue && (
                      <SortIcon
                        className={cn(
                          "size-3",
                          isActive ? "text-foreground" : "text-muted-foreground/50"
                        )}
                      />
                    )}
                  </span>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="text-center text-muted-foreground py-8 text-sm"
              >
                {emptyLabel}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, i) => {
              const href = rowHref?.(row);
              return (
                <TableRow
                  key={i}
                  className={cn((href || onRowClick) && "cursor-pointer")}
                  onClick={(e) => {
                    // Nested links/buttons must not trigger row navigation.
                    const target = e.target as HTMLElement | null;
                    if (target?.closest("a, button, input, [data-no-row-nav]")) return;
                    if (href) router.push(href);
                    onRowClick?.(row);
                  }}
                >
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        "text-sm",
                        col.align === "right" && "text-right tabular-nums",
                        col.align === "center" && "text-center",
                        col.className
                      )}
                    >
                      {col.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
