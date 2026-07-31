import "server-only";
import { sql } from "drizzle-orm";
import { run } from "../client";
import type { Pagination } from "../types";

/** Coerce a possibly-string numeric (postgres numeric/bigint) to number|null. */
export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isNaN(n) ? null : n;
}

export function int(v: unknown): number | null {
  const n = num(v);
  return n === null ? null : Math.trunc(n);
}

export function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

export function bool(v: unknown): boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v;
  return v === "t" || v === true;
}

/** Safely inject a validated identifier (from a fixed allowlist) as raw SQL. */
export function id(fragment: string) {
  return sql.raw(fragment);
}

export function makePagination(
  page: number,
  pageSize: number,
  total: number
): Pagination {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function countRows(countSql: ReturnType<typeof sql>) {
  const rows = await run<{ c: unknown }[]>(countSql);
  return num(rows[0]?.c) ?? 0;
}
