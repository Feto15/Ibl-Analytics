"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SeasonOption } from "@/lib/db/types";

interface SeasonFilterProps {
  seasons: SeasonOption[];
}

export function SeasonFilter({ seasons }: SeasonFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("season") ?? String(seasons[0]?.seasonYear ?? "");

  const handleChange = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === String(seasons[0]?.seasonYear)) {
      params.delete("season");
    } else {
      params.set("season", next);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger size="sm" className="h-8 w-[105px] shrink-0 sm:w-[150px]" aria-label="Filter musim">
        <SelectValue placeholder="Musim" />
      </SelectTrigger>
      <SelectContent>
        {seasons.map((season) => (
          <SelectItem key={season.seasonYear} value={String(season.seasonYear)}>
            {season.seasonYear}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
