"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ReviewMode } from "@/lib/review";

export function ReviewFilter({ value }: { value: ReviewMode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onChange = (next: ReviewMode) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "include") params.delete("review");
    else params.set("review", next);
    params.set("page", "1");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <Select value={value} onValueChange={(next) => onChange(next as ReviewMode)}>
      <SelectTrigger size="sm" className="h-8 w-[135px] shrink-0 sm:w-[158px]" aria-label="Filter data review">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="exclude">Review dikecualikan</SelectItem>
        <SelectItem value="include">Sertakan review</SelectItem>
      </SelectContent>
    </Select>
  );
}
