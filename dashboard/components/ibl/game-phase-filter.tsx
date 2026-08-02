"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { GAME_PHASE_LABELS, type GamePhase } from "@/lib/game-phase";
import { cn } from "@/lib/utils";

const PHASE_OPTIONS: GamePhase[] = ["regular", "playoffs", "all"];

export function GamePhaseFilter({ value }: { value: GamePhase }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const updatePhase = (phase: GamePhase) => {
    const params = new URLSearchParams(searchParams.toString());
    if (phase === "regular") params.delete("phase");
    else params.set("phase", phase);
    params.set("page", "1");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <div
      aria-label="Filter fase pertandingan"
      className="grid grid-cols-3 rounded-md border bg-muted/40 p-0.5 text-xs"
      role="group"
    >
      {PHASE_OPTIONS.map((phase) => (
        <button
          key={phase}
          type="button"
          aria-pressed={value === phase}
          onClick={() => updatePhase(phase)}
          className={cn(
            "h-7 whitespace-nowrap rounded px-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === phase
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {GAME_PHASE_LABELS[phase]}
        </button>
      ))}
    </div>
  );
}
