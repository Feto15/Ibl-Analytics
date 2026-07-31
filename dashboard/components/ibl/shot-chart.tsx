"use client";

import { useMemo, useState } from "react";
import type { ShotPoint } from "@/lib/db/types";
import { clamp } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PbpStatusBadge, ConfidenceBadge } from "./badges";

// FIBA half-court: 15m wide (x: -7.5..7.5), 14m deep (y: 0..14). Basket at
// y=1.575 (free-throw line front is ~5.8, three-point arc ~6.75). Data range
// observed: x ∈ [-7.32, 7.32], y ∈ [0.51, 13.58] → consistent with half-court
// where the basket sits near the bottom edge.

const COURT_W = 15;
const COURT_H = 14;
const RIM_X = 0;
const RIM_Y = 1.575;
const RIM_R = 0.225; // hoop radius
const RESTRICTED_R = 1.25;
const FT_RADIUS = 1.8; // free throw circle radius
const PAINT_W = 4.9; // key width
const PAINT_H = 5.8; // key depth
const THREE_R = 6.75;
const CORNER_THREE_X = 6.6;

const VIEW_W = 360;
const VIEW_H = VIEW_W * (COURT_H / COURT_W);

function toPxX(meters: number) {
  return ((meters + COURT_W / 2) / COURT_W) * VIEW_W;
}
function toPxY(meters: number) {
  return ((COURT_H - meters) / COURT_H) * VIEW_H;
}
function scaleM(meters: number) {
  return (meters / COURT_W) * VIEW_W;
}

interface Props {
  shots: ShotPoint[];
  className?: string;
  highlightTeamId?: number;
}

interface HoverInfo {
  shot: ShotPoint;
  x: number;
  y: number;
}

export function ShotChart({ shots, className, highlightTeamId }: Props) {
  const [hover, setHover] = useState<HoverInfo | null>(null);

  const renderShots = useMemo(() => {
    return shots.map((s) => {
      // clamp to keep markers on-court even if any stray coordinate exists
      const x = clamp(toPxX(s.courtX), 2, VIEW_W - 2);
      const y = clamp(toPxY(s.courtY), 2, VIEW_H - 2);
      const isMade = s.made === true;
      const dim = highlightTeamId != null && s.teamId !== highlightTeamId;
      return { s, x, y, isMade, dim };
    });
  }, [shots, highlightTeamId]);

  return (
    <div className={cn("relative w-full", className)}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full h-auto select-none"
        style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}
        role="img"
        aria-label="Shot chart lapangan basket"
      >
        <CourtDrawing />

        {renderShots.map(({ s, x, y, isMade, dim }) => (
          <g
            key={s.shotId}
            transform={`translate(${x},${y})`}
            onMouseEnter={() => setHover({ shot: s, x, y })}
            onMouseLeave={() => setHover(null)}
            className={cn("cursor-pointer", dim && "opacity-25")}
          >
            {isMade ? (
              <circle
                r={3.2}
                className={cn(
                  s.points === 3
                    ? "fill-emerald-500"
                    : "fill-emerald-600 dark:fill-emerald-400"
                )}
                stroke="currentColor"
                strokeWidth={0.6}
                strokeOpacity={0.5}
              />
            ) : (
              // missed = triangle (different shape, not just color)
              <path
                d="M -3 2.4 L 3 2.4 L 0 -2.6 Z"
                className={cn(
                  s.points === 3 ? "fill-red-400" : "fill-red-500 dark:fill-red-400"
                )}
                stroke="currentColor"
                strokeWidth={0.6}
                strokeOpacity={0.5}
              />
            )}
          </g>
        ))}
      </svg>

      {hover && <ShotTooltip shot={hover.shot} x={hover.x} y={hover.y} />}

      <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-emerald-500" />
          Made
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="10" height="10" viewBox="0 0 10 10" className="inline-block">
            <path d="M 1 8 L 9 8 L 5 1 Z" className="fill-red-400" />
          </svg>
          Missed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-emerald-500/70 ring-1 ring-emerald-500" />
          3PT
        </span>
      </div>
    </div>
  );
}

function CourtDrawing() {
  const left = toPxX(CORNER_THREE_X);
  const right = toPxX(-CORNER_THREE_X);
  const rimX = toPxX(RIM_X);
  const rimY = toPxY(RIM_Y);
  const paintLeft = toPxX(-PAINT_W / 2);
  const paintRight = toPxX(PAINT_W / 2);
  const paintTop = toPxY(PAINT_H);
  const ftY = toPxY(PAINT_H);

  return (
    <g className="stroke-muted-foreground/40 fill-none" strokeWidth={1}>
      {/* court boundary */}
      <rect x={0} y={0} width={VIEW_W} height={VIEW_H} />
      {/* backboard + rim */}
      <line
        x1={rimX - 0.9}
        y1={toPxY(RIM_Y - 0.15)}
        x2={rimX + 0.9}
        y2={toPxY(RIM_Y - 0.15)}
        strokeWidth={1.2}
      />
      <circle cx={rimX} cy={rimY} r={scaleM(RIM_R)} className="fill-muted-foreground/10" />
      {/* restricted area */}
      <path
        d={`M ${toPxX(-RESTRICTED_R)} ${rimY} A ${scaleM(RESTRICTED_R)} ${scaleM(RESTRICTED_R)} 0 0 1 ${toPxX(RESTRICTED_R)} ${rimY}`}
      />
      {/* the key / paint */}
      <rect x={paintLeft} y={paintTop} width={paintRight - paintLeft} height={VIEW_H - paintTop} />
      {/* free throw circle */}
      <circle cx={rimX} cy={ftY} r={scaleM(FT_RADIUS)} />
      {/* three-point line: two corners + arc */}
      <line x1={left} y1={VIEW_H} x2={left} y2={toPxY(2.95)} />
      <line x1={right} y1={VIEW_H} x2={right} y2={toPxY(2.95)} />
      <path
        d={`M ${left} ${toPxY(2.95)} A ${scaleM(THREE_R)} ${scaleM(THREE_R)} 0 0 1 ${right} ${toPxY(2.95)}`}
      />
    </g>
  );
}

function ShotTooltip({
  shot,
  x,
  y,
}: {
  shot: ShotPoint;
  x: number;
  y: number;
}) {
  const pctX = (x / VIEW_W) * 100;
  const pctY = (y / VIEW_H) * 100;
  const placeLeft = pctX > 60;
  const placeTop = pctY < 30;
  return (
    <div
      className="pointer-events-none absolute z-20 w-52 rounded-md border bg-background p-2.5 text-xs shadow-xl"
      style={{
        left: `${placeLeft ? pctX - 2 : pctX + 2}%`,
        top: `${placeTop ? pctY + 4 : pctY - 2}%`,
        transform: placeLeft ? "translateX(-100%)" : "none",
      }}
    >
      <div className="font-medium text-foreground truncate">
        {shot.playerName ?? "Pemain tidak diketahui"}
      </div>
      <div className="text-muted-foreground">{shot.teamCode}</div>
      <div className="flex items-center gap-1.5 mt-1.5">
        <span
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium",
            shot.made
              ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
              : "text-red-600 dark:text-red-400 bg-red-500/10"
          )}
        >
          {shot.made ? "Made" : "Missed"}
        </span>
        <span className="text-muted-foreground">{shot.points}P</span>
      </div>
      {shot.areaName && (
        <div className="text-muted-foreground mt-1 capitalize">
          {shot.areaName.replace(/_/g, " ")}
        </div>
      )}
      <div className="flex items-center gap-1.5 mt-1">
        {shot.periodNo ? (
          <span className="text-muted-foreground">
            Q{shot.periodNo} {shot.clock ?? ""}
          </span>
        ) : (
          <span className="text-muted-foreground italic">Waktu belum terverifikasi</span>
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        <PbpStatusBadge status={shot.pbpMatchStatus} />
        <ConfidenceBadge
          confidence={
            shot.confidence != null && shot.confidence >= 0.9
              ? "high"
              : shot.confidence != null && shot.confidence >= 0.7
                ? "medium"
                : "low"
          }
        />
      </div>
    </div>
  );
}
