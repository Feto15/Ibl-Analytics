import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Inline info icon that opens a tooltip defining a metric term. */
export function MetricInfo({ label, className }: { label: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Definisi: ${label}`}
          className={cn("inline-flex text-muted-foreground/70 hover:text-muted-foreground", className)}
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[240px] text-xs leading-relaxed">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/** A label with an optional inline definition tooltip. */
export function MetricLabel({
  children,
  definition,
  className,
}: {
  children: React.ReactNode;
  definition?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {children}
      {definition && <MetricInfo label={definition} />}
    </span>
  );
}

export const METRIC_DEFINITIONS = {
  pace: "Pace: rata-rata possessions kedua tim, dinormalisasi ke 40 menit.",
  efg: "eFG% = 100 × (FGM + 0.5 × 3PM) / FGA. Menimbang 3P lebih tinggi dari 2P.",
  ts: "TS% = 100 × PTS / (2 × (FGA + 0.44 × FTA)). Efisiensi tembakan menyeluruh.",
  ortg: "ORtg = 100 × points / possessions tim. Poin per 100 possession.",
  drtg: "DRtg = 100 × points lawan / possessions lawan.",
  netRating: "Net Rating = ORtg − DRtg. Selisih performa per 100 possession.",
  efficiency:
    "Efficiency = PTS + REB + AST + STL + BLK − (FGA − FGM) − (FTA − FTM) − TOV.",
  poss: "Possessions = FGA + 0.44 × FTA − ORB + TOV (estimasi).",
  ptsPerMin:
    "Pts/Min: poin per menit lineup dari PDF Line Up Analysis. Bukan Offensive Rating — lineup belum memiliki possession per stint.",
  plusMinus:
    "Plus-Minus: selisih skor tim saat pemain/lineup di lapangan.",
} as const;
