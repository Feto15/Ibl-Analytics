"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Pagination } from "@/lib/db/types";

/**
 * Server-side pagination control. Mutates URL query (page, pageSize) so state is
 * shareable and reload-stable.
 */
export function PaginationBar({
  pagination,
  pageSizeOptions = [10, 25, 50],
}: {
  pagination: Pagination;
  pageSizeOptions?: number[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const update = (page: number, pageSize?: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    if (pageSize !== undefined) {
      params.set("pageSize", String(pageSize));
      params.set("page", "1");
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const { page, pageSize, total, totalPages } = pagination;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-2.5 border-t">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {total === 0 ? "0" : `${from}–${to}`} dari {total.toLocaleString("en-US")}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="hidden sm:inline">Per halaman</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => update(1, Number(v))}
          >
            <SelectTrigger size="sm" className="h-7 w-[68px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => update(page - 1)}
          disabled={page <= 1}
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="px-2 text-xs tabular-nums">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => update(page + 1)}
          disabled={page >= totalPages}
          aria-label="Halaman berikutnya"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
