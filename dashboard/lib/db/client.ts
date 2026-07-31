import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql, type SQL } from "drizzle-orm";
import * as schema from "./schema";
import * as authSchema from "./auth-schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured. Add it to .env.local (server-only).");
}

if (databaseUrl.startsWith("NEXT_PUBLIC_")) {
  throw new Error("DATABASE_URL must not use the NEXT_PUBLIC_ prefix.");
}

// neon() returns a tagged-template query function. Drizzle wraps it as the
// HTTP driver. We keep the client here so Server Components import only this.
const neonQuery = neon(databaseUrl);
export const db = drizzle({
  client: neonQuery,
  schema: { ...schema, ...authSchema },
});

/**
 * Error thrown to the UI layer when a database query fails.
 * Never contains the connection string or raw query text.
 */
export class DataError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "DataError";
  }
}

/**
 * Run a parameterized Drizzle SQL statement and return typed rows. `T` is the
 * full row array type (e.g. `{ game_id: number }[]`); all values interpolated
 * via `${value}` are bound parameters (no injection).
 */
export async function run<T extends Record<string, unknown>[] = Record<string, unknown>[]>(
  statement: SQL
): Promise<T> {
  try {
    const result = await db.execute(statement);
    return (result.rows ?? []) as T;
  } catch (err) {
    // Sanitize: never surface connection string or full query to the client.
    const detail =
      err instanceof Error ? err.message.split("\n")[0].slice(0, 160) : "unknown";
    console.error("[db] query failed:", detail);
    throw new DataError("Gagal memuat data dari database.", err);
  }
}

/** Build a parameterized raw SQL statement. */
export const raw = sql;

