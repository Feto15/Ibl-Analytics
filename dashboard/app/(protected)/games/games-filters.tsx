"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { GamePhaseFilter } from "@/components/ibl/game-phase-filter";
import type { GamePhase } from "@/lib/game-phase";

interface Option {
  value: string;
  label: string;
}

export function GamesFilters({
  teams,
  seasons,
  currentSeason,
  currentTeam,
  currentQuery,
  currentPhase,
}: {
  teams: Option[];
  seasons: Option[];
  currentSeason: string;
  currentTeam: string;
  currentQuery: string;
  currentPhase: GamePhase;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const update = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) params.delete(key);
    else params.set(key, value);
    params.set("page", "1");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const reset = () => {
    const params = new URLSearchParams(searchParams.toString());
    ["season", "team", "q", "phase"].forEach((key) => params.delete(key));
    params.set("page", "1");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const activeCount = [currentSeason, currentTeam, currentQuery, currentPhase !== "regular"].filter(Boolean).length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <GamePhaseFilter value={currentPhase} />

      <Select
        value={currentSeason || "__all"}
        onValueChange={(v) => update("season", v === "__all" ? null : v)}
      >
        <SelectTrigger size="sm" className="h-8 w-[110px]">
          <SelectValue placeholder="Musim" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">Semua musim</SelectItem>
          {seasons.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentTeam || "__all"}
        onValueChange={(v) => update("team", v === "__all" ? null : v)}
      >
        <SelectTrigger size="sm" className="h-8 w-[170px]">
          <SelectValue placeholder="Tim" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">Semua tim</SelectItem>
          {teams.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="relative flex-1 min-w-[160px] max-w-[260px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Cari tim atau venue..."
          defaultValue={currentQuery}
          onChange={(e) => {
            const v = e.target.value.trim();
            update("q", v ? v : null);
          }}
          className="pl-8 h-8 text-sm"
        />
      </div>

      {activeCount > 0 && (
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground h-8 px-2"
        >
          <X className="size-3.5" />
          Reset ({activeCount})
        </button>
      )}
    </div>
  );
}
