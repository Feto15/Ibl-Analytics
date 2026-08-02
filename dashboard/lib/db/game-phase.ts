import "server-only";

import { sql, type SQL } from "drizzle-orm";
import type { GamePhase } from "@/lib/game-phase";

const POSTSEASON_SOURCE_KEY_PATTERN =
  "^[0-9]+:(playoffs?|semi-?finals?|finals?)([-:]|$)";

// The extractor records competition phase in the stable source-game key.
// Keep this compatibility rule in the server query layer until the source
// schema exposes an explicit game-phase field.
export function gamePhaseCondition(
  sourceGameKey: SQL,
  phase: GamePhase = "regular"
): SQL {
  if (phase === "all") return sql`true`;

  const isPlayoff = sql`lower(${sourceGameKey}) ~ ${POSTSEASON_SOURCE_KEY_PATTERN}`;
  return phase === "playoffs" ? isPlayoff : sql`not (${isPlayoff})`;
}

export function gamePhaseExpression(sourceGameKey: SQL): SQL {
  return sql`case when lower(${sourceGameKey}) ~ ${POSTSEASON_SOURCE_KEY_PATTERN} then 'playoffs' else 'regular' end`;
}
