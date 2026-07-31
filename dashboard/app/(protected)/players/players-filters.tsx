"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

export function PlayersFilters({
  teams,
  currentTeam,
  currentQuery,
}: {
  teams: Option[];
  currentTeam: string;
  currentQuery: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) params.delete(key);
    else params.set(key, value);
    params.set("page", "1");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const activeCount = [currentTeam, currentQuery].filter(Boolean).length;

  return (
    <div className="flex flex-wrap items-center gap-2">
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

      <div className="relative min-w-[160px] max-w-[260px] flex-1">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          key={currentQuery}
          placeholder="Cari pemain..."
          defaultValue={currentQuery}
          onChange={(e) => {
            const next = e.target.value;
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
              const trimmed = next.trim();
              update("q", trimmed || null);
            }, 300);
          }}
          className="h-8 pl-8 text-sm"
        />
      </div>

      {activeCount > 0 ? (
        <button
          type="button"
          onClick={() => {
            if (timerRef.current) clearTimeout(timerRef.current);
            const params = new URLSearchParams(searchParams.toString());
            params.delete("team");
            params.delete("q");
            params.set("page", "1");
            const qs = params.toString();
            router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
          }}
          className="inline-flex h-8 items-center gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
          Reset ({activeCount})
        </button>
      ) : null}
    </div>
  );
}
