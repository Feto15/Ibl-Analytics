import { cn } from "@/lib/utils";
import { SectionCard } from "./section-card";
import { MetricInfo } from "./metric-tooltip";

export interface KpiCardProps {
  label: React.ReactNode;
  value: string;
  hint?: string;
  definition?: string;
  icon?: React.ReactNode;
  accent?: "neutral" | "positive" | "negative" | "info";
  className?: string;
}

const accentValue: Record<NonNullable<KpiCardProps["accent"]>, string> = {
  neutral: "text-foreground",
  positive: "text-emerald-600 dark:text-emerald-400",
  negative: "text-red-600 dark:text-red-400",
  info: "text-cyan-600 dark:text-cyan-400",
};

export function KpiCard({
  label,
  value,
  hint,
  definition,
  icon,
  accent = "neutral",
  className,
}: KpiCardProps) {
  return (
    <SectionCard className={cn("p-0", className)}>
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            {definition && <MetricInfo label={definition} />}
          </div>
          <p className={cn("text-2xl font-semibold tabular-nums mt-1", accentValue[accent])}>
            {value}
          </p>
          {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
        </div>
        {icon && (
          <div className="flex size-8 items-center justify-center rounded-md border bg-muted shrink-0 text-muted-foreground">
            {icon}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
