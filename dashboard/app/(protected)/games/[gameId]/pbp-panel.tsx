"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/ibl/states";
import type { PbpEvent } from "@/lib/db/types";

type PbpState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      rows: PbpEvent[];
      total: number;
      totalPages: number;
    };

export function PbpPanel({ gameId }: { gameId: number }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [state, setState] = useState<PbpState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/games/${gameId}/pbp?page=${page}&pageSize=${pageSize}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Gagal memuat PBP");
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        setState({
          status: "ready",
          rows: json.rows ?? [],
          total: json.total ?? 0,
          totalPages: json.totalPages ?? 1,
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setState({
          status: "error",
          message: e instanceof Error ? e.message : "Gagal memuat PBP",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [gameId, page, pageSize]);

  if (state.status === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        <span className="text-sm">Memuat play-by-play...</span>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="py-8 text-center">
        <p className="mb-3 text-sm text-muted-foreground">{state.message}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setState({ status: "loading" });
            setPage((p) => p);
            setPageSize((ps) => ps);
          }}
        >
          Coba lagi
        </Button>
      </div>
    );
  }

  if (state.rows.length === 0) {
    return (
      <EmptyState title="Tidak ada PBP" description="Data play-by-play tidak tersedia." />
    );
  }

  const from = state.total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, state.total);

  return (
    <div>
      <div className="max-h-[480px] divide-y overflow-y-auto">
        {state.rows.map((event) => (
          <div
            key={event.eventId}
            className="flex gap-3 px-3 py-2 text-sm hover:bg-muted/40"
          >
            <div className="w-14 shrink-0 text-xs tabular-nums text-muted-foreground">
              <div>P{event.periodNo}</div>
              <div>{event.clock ?? "—"}</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                {event.teamCode ? (
                  <span className="font-medium text-foreground">{event.teamCode}</span>
                ) : null}
                {event.jerseyNo ? (
                  <span className="text-muted-foreground">#{event.jerseyNo}</span>
                ) : null}
                {event.eventType ? (
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {event.eventType}
                  </span>
                ) : null}
              </div>
              <p className="text-foreground/90">{event.description}</p>
            </div>
            <div className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {event.homeScore != null && event.awayScore != null
                ? `${event.homeScore}-${event.awayScore}`
                : "—"}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t p-3">
        <p className="text-xs text-muted-foreground">
          {from}–{to} dari {state.total}
        </p>
        <div className="flex items-center gap-2">
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setState({ status: "loading" });
              setPage(1);
              setPageSize(Number(v));
            }}
          >
            <SelectTrigger className="h-8 w-[4.5rem]" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[25, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => {
              setState({ status: "loading" });
              setPage((p) => p - 1);
            }}
            disabled={page <= 1}
            aria-label="Sebelumnya"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="px-2 text-xs tabular-nums">
            {page} / {state.totalPages}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => {
              setState({ status: "loading" });
              setPage((p) => p + 1);
            }}
            disabled={page >= state.totalPages}
            aria-label="Berikutnya"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
