"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Option {
  value: string;
  label: string;
}

function useUrlFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const setParam = (name: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) params.delete(name);
    else params.set(name, value);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return { searchParams, setParam };
}

function SelectFilter({
  label,
  options,
  placeholder,
  current,
  onChange,
}: {
  label: string;
  options: Option[];
  placeholder: string;
  current: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={current || "__all"} onValueChange={(v) => onChange(v === "__all" ? "" : v)}>
      <SelectTrigger size="sm" className="h-8 w-full sm:w-auto" aria-label={label}>
        <span className="text-muted-foreground mr-1">{label}:</span>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all">Semua</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Shot chart filter bar. Reads/writes URL: result, area, confidence, pbp.
 */
export function ShotChartFilters({
  areas,
}: {
  areas: string[];
}) {
  const { searchParams, setParam } = useUrlFilter();
  const result = searchParams.get("result") ?? "";
  const area = searchParams.get("area") ?? "";
  const confidence = searchParams.get("confidence") ?? "";
  const pbp = searchParams.get("pbp") ?? "";

  const activeCount = [result, area, confidence, pbp].filter(Boolean).length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SelectFilter
        label="Hasil"
        placeholder="Semua"
        current={result}
        onChange={(v) => setParam("result", v)}
        options={[
          { value: "made", label: "Made" },
          { value: "missed", label: "Missed" },
        ]}
      />
      <SelectFilter
        label="Area"
        placeholder="Semua"
        current={area}
        onChange={(v) => setParam("area", v)}
        options={areas.map((a) => ({ value: a, label: a.replace(/_/g, " ") }))}
      />
      <SelectFilter
        label="Confidence"
        placeholder="Semua"
        current={confidence}
        onChange={(v) => setParam("confidence", v)}
        options={[
          { value: "high", label: "High" },
          { value: "medium", label: "Medium" },
          { value: "low", label: "Low" },
        ]}
      />
      <SelectFilter
        label="Status PBP"
        placeholder="Semua"
        current={pbp}
        onChange={(v) => setParam("pbp", v)}
        options={[
          { value: "unique", label: "unique" },
          { value: "area_constrained", label: "area_constrained" },
          { value: "ambiguous", label: "ambiguous" },
          { value: "no_event", label: "no_event" },
        ]}
      />
      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => {
            ["result", "area", "confidence", "pbp"].forEach((k) => setParam(k, ""));
          }}
        >
          <X className="size-3.5" />
          Reset ({activeCount})
        </Button>
      )}
    </div>
  );
}

export function FilterToggle({
  activeCount,
  onToggle,
  open,
}: {
  activeCount: number;
  onToggle: () => void;
  open: boolean;
}) {
  return (
    <Button
      variant={open ? "secondary" : "outline"}
      size="sm"
      className={cn("h-8", open && "gap-1.5")}
      onClick={onToggle}
    >
      <Filter className="size-3.5" />
      <span className="hidden sm:inline">Filter</span>
      {activeCount > 0 && (
        <span className="size-1.5 rounded-full bg-primary" />
      )}
    </Button>
  );
}
