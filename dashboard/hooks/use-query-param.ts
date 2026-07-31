"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * Update one URL query param while preserving the rest. Filters live in the URL
 * so views are shareable and reload-stable. Returns the current value + setter.
 */
export function useQueryParam(name: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const value = searchParams.get(name) ?? "";

  const setValue = useCallback(
    (next: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === null || next === "") {
        params.delete(name);
      } else {
        params.set(name, next);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams, name]
  );

  return { value, setValue };
}

/** Read a query param as a number, falling back to a default. */
export function useNumberParam(name: string, fallback: number): number {
  const searchParams = useSearchParams();
  const raw = searchParams.get(name);
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
