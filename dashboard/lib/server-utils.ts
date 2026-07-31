import "server-only";
import { seasonsDb } from "@/lib/db";
import { seasonParam } from "@/lib/params";

/** Resolve the active season from a query value, defaulting to the latest. */
export async function resolveSeasonParam(
  raw: string | string[] | undefined
): Promise<number> {
  if (raw && !Array.isArray(raw)) {
    const parsed = seasonParam.safeParse(raw);
    if (parsed.success) return parsed.data;
  }
  return seasonsDb.getDefaultSeason();
}

/** Keep only the filename portion of a path for display (never the full disk path). */
export function basename(path: string | null): string | null {
  if (!path) return null;
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || null;
}
