import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TriangleAlert, CheckCircle2, Info } from "lucide-react";
import type { GamePhase } from "@/lib/game-phase";

export function ResultBadge({ result }: { result: "W" | "L" }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "tabular-nums font-semibold",
        result === "W"
          ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/40"
          : "text-red-600 dark:text-red-400 border-red-500/40"
      )}
    >
      {result}
    </Badge>
  );
}

export function GamePhaseBadge({
  phase,
}: {
  phase: Exclude<GamePhase, "all">;
}) {
  if (phase === "regular") return null;
  return (
    <Badge
      variant="outline"
      className="border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300"
    >
      Playoff
    </Badge>
  );
}

export function SeverityBadge({
  severity,
}: {
  severity: "info" | "warning" | "error";
}) {
  if (severity === "error") {
    return (
      <Badge
        variant="destructive"
        className="gap-1"
      >
        <TriangleAlert className="size-3" />
        Error
      </Badge>
    );
  }
  if (severity === "warning") {
    return (
      <Badge
        variant="outline"
        className="gap-1 text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10"
      >
        <TriangleAlert className="size-3" />
        Warning
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <Info className="size-3" />
      Info
    </Badge>
  );
}

export function PbpStatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const tone: Record<string, string> = {
    unique: "text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
    area_constrained:
      "text-cyan-600 dark:text-cyan-400 border-cyan-500/40 bg-cyan-500/10",
    ambiguous:
      "text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10",
    no_event: "text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={cn("gap-1", tone[status] ?? tone.no_event)}>
      {status}
    </Badge>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: "high" | "medium" | "low" | null }) {
  if (!confidence) return null;
  const tone: Record<string, string> = {
    high: "text-emerald-600 dark:text-emerald-400 border-emerald-500/40",
    medium: "text-amber-600 dark:text-amber-400 border-amber-500/40",
    low: "text-red-600 dark:text-red-400 border-red-500/40",
  };
  return (
    <Badge variant="outline" className={cn("capitalize", tone[confidence] ?? tone.medium)}>
      {confidence}
    </Badge>
  );
}

export function ReviewBadge({ ruleCode }: { ruleCode?: string }) {
  if (!ruleCode) return null;
  return (
    <Badge
      variant="outline"
      className="gap-1 text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10"
    >
      <TriangleAlert className="size-3" />
      {ruleCode}
    </Badge>
  );
}

export function ReviewDot({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span
      title="Memiliki validation issue (data review)"
      className="inline-block size-1.5 rounded-full bg-amber-500 shrink-0"
    />
  );
}

export function VerifiedTick() {
  return <CheckCircle2 className="size-3.5 text-emerald-500" />;
}
