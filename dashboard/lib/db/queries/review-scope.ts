import "server-only";
import { sql, type SQL } from "drizzle-orm";
import type { ReviewMode } from "@/lib/review";

export type { ReviewMode } from "@/lib/review";

// These rules are intentionally scoped to their source report. Lineup,
// rotation, shot-area, and plus/minus issues must not invalidate box scores.
const BOX_SCORE_RULE_CODES = [
  "box_score_totals_mismatch",
  "box_score_stat_mismatch",
] as const;

const boxScoreRuleList = sql.join(
  BOX_SCORE_RULE_CODES.map((rule) => sql`${rule}`),
  sql`, `
);

export function excludeBoxScoreReview(gameId: SQL, mode: ReviewMode): SQL {
  if (mode === "include") return sql`true`;

  return sql`
    not exists (
      select 1
      from validation_issues vi
      join reports r on r.report_id = vi.report_id
      where r.game_id = ${gameId}
        and r.report_type = 'box_score'
        and vi.rule_code in (${boxScoreRuleList})
    )
  `;
}

export function excludeShotAreaReview(
  reportId: SQL,
  teamCode: SQL,
  mode: ReviewMode
): SQL {
  if (mode === "include") return sql`true`;

  return sql`
    not exists (
      select 1
      from validation_issues vi
      where vi.report_id = ${reportId}
        and vi.rule_code = 'shot_area_box_score_mismatch'
        and vi.context->>'team_code' = ${teamCode}
    )
  `;
}
