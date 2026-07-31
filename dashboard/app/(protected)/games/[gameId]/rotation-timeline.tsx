"use client";

import { useMemo, useState } from "react";
import type { LineupStintRow } from "@/lib/db/types";
import { fmtDuration } from "@/lib/format";
import { ReviewDot } from "@/components/ibl/badges";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Rotation timeline – shows each lineup stint as a horizontal bar per team
 * and period, enabling quick visual comparison of playing time allocation.
 */
export function RotationTimeline({ stints }: { stints: LineupStintRow[] }) {
  const teams = useMemo(() => {
    const codes = [...new Set(stints.map((s) => s.teamCode))];
    return codes.sort();
  }, [stints]);

  const periods = useMemo(() => {
    const all = new Set<number>();
    for (const s of stints) {
      if (s.startPeriod) all.add(s.startPeriod);
      if (s.endPeriod) all.add(s.endPeriod);
    }
    return [...all].sort((a, b) => a - b);
  }, [stints]);

  const [selectedTeam, setSelectedTeam] = useState<string>("all");

  if (stints.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Tidak ada data rotation untuk pertandingan ini.
      </p>
    );
  }

  const filteredStints =
    selectedTeam === "all"
      ? stints
      : stints.filter((s) => s.teamCode === selectedTeam);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={selectedTeam} onValueChange={setSelectedTeam}>
          <SelectTrigger className="w-[140px] h-8">
            <SelectValue placeholder="Tim" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Tim</SelectItem>
            {teams.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {periods.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Data period tidak tersedia.
        </p>
      ) : (
        periods.map((period) => (
          <PeriodTimeline
            key={period}
            period={period}
            stints={filteredStints.filter(
              (s) =>
                s.startPeriod === period ||
                s.endPeriod === period ||
                (s.startPeriod !== null &&
                  s.endPeriod !== null &&
                  s.startPeriod <= period &&
                  s.endPeriod >= period)
            )}
            teams={selectedTeam === "all" ? teams : [selectedTeam]}
          />
        ))
      )}
    </div>
  );
}

function PeriodTimeline({
  period,
  stints,
  teams,
}: {
  period: number;
  stints: LineupStintRow[];
  teams: string[];
}) {
  const periodLabel = period > 4 ? `OT${period - 4}` : `Q${period}`;

  if (stints.length === 0) return null;

  // Max duration for scaling bars
  const maxDur = Math.max(
    ...stints.map((s) => s.durationSeconds ?? 0),
    1
  );

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {periodLabel}
      </h4>
      {teams.map((teamCode) => {
        const teamStints = stints
          .filter((s) => s.teamCode === teamCode)
          .sort((a, b) => a.stintIndex - b.stintIndex);
        if (teamStints.length === 0) return null;
        return (
          <div key={teamCode} className="space-y-1">
            <p className="text-xs font-medium text-foreground">{teamCode}</p>
            <div className="space-y-0.5">
              {teamStints.map((stint) => (
                <StintBar
                  key={stint.stintId}
                  stint={stint}
                  maxDur={maxDur}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StintBar({
  stint,
  maxDur,
}: {
  stint: LineupStintRow;
  maxDur: number;
}) {
  const dur = stint.durationSeconds ?? 0;
  const widthPct = Math.max(4, (dur / maxDur) * 100);
  const pm = stint.plusMinus ?? 0;
  const colorClass =
    pm > 0
      ? "bg-emerald-500/80"
      : pm < 0
        ? "bg-red-500/70"
        : "bg-muted-foreground/40";

  const playerNames = stint.players
    .map((p) => {
      const parts = p.displayName.split(" ");
      return parts[parts.length - 1];
    })
    .join(", ");

  const clockLabel = [
    stint.startClock ?? "",
    stint.endClock ?? "",
  ]
    .filter(Boolean)
    .join(" → ");

  return (
    <div className="flex items-center gap-2 group">
      <div
        className={`h-5 rounded-sm ${colorClass} flex items-center px-1.5 transition-all`}
        style={{ width: `${widthPct}%`, minWidth: "32px" }}
        title={`${playerNames}\n${fmtDuration(dur)} | +/- ${pm >= 0 ? "+" : ""}${pm}\n${clockLabel}`}
      >
        <span className="text-[10px] text-white font-medium truncate">
          {fmtDuration(dur)}
        </span>
      </div>
      <span className="text-[10px] text-muted-foreground hidden group-hover:inline-flex items-center gap-1 min-w-0 truncate">
        <ReviewDot active={stint.hasIssue} />
        {playerNames}
        {clockLabel && ` · ${clockLabel}`}
      </span>
    </div>
  );
}
