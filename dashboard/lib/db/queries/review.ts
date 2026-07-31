import "server-only";
import { sql } from "drizzle-orm";
import { run } from "../client";
import { countRows, str } from "./helpers";
import type { PageResult, ValidationIssueRow } from "../types";

const SORT_MAP: Record<string, string> = {
  created: "vi.created_at",
  severity: "vi.severity",
  rule: "vi.rule_code",
};

export async function getValidationIssues(
  opts: {
    page: number;
    pageSize: number;
    sort: string;
    dir: "asc" | "desc";
    season?: number;
    reportType?: string;
    severity?: "info" | "warning" | "error";
    ruleCode?: string;
  }
): Promise<PageResult<ValidationIssueRow>> {
  const conditions = [sql`true`];
  if (opts.season) conditions.push(sql`g.season_year = ${opts.season}`);
  if (opts.reportType) conditions.push(sql`r.report_type = ${opts.reportType}`);
  if (opts.severity) conditions.push(sql`vi.severity = ${opts.severity}`);
  if (opts.ruleCode) conditions.push(sql`vi.rule_code = ${opts.ruleCode}`);
  const where = conditions.reduce((acc, c) => sql`${acc} and ${c}`);

  const sortCol = SORT_MAP[opts.sort] ?? SORT_MAP.created;
  const orderBy =
    opts.dir === "asc"
      ? sql.raw(`${sortCol} asc nulls last, vi.issue_id asc`)
      : sql.raw(`${sortCol} desc nulls last, vi.issue_id desc`);

  const total = await countRows(
    sql`select count(*)::int as c from validation_issues vi left join reports r on r.report_id = vi.report_id left join games g on g.game_id = r.game_id where ${where}`
  );
  const offset = (opts.page - 1) * opts.pageSize;
  const rows = await run<{
    issue_id: unknown;
    rule_code: string;
    severity: string;
    message: string;
    source_path: string | null;
    source_filename: string | null;
    report_type: string | null;
    source_game_key: string | null;
    team_code: string | null;
    created_at: string;
    context: unknown;
  }[]>(
    sql`
      select
        vi.issue_id::int as issue_id,
        vi.rule_code, vi.severity, vi.message,
        vi.source_path,
        r.source_filename,
        r.report_type,
        g.source_game_key,
        ctx.team_code::text as team_code,
        vi.created_at::text as created_at,
        vi.context
      from validation_issues vi
      left join reports r on r.report_id = vi.report_id
      left join games g on g.game_id = r.game_id
      left join lateral (
        select (vi.context ->> 'team_code') as team_code
      ) ctx on true
      where ${where}
      order by ${orderBy}
      limit ${opts.pageSize} offset ${offset}
    `
  );
  return {
    rows: rows.map((r) => ({
      issueId: Number(r.issue_id),
      ruleCode: r.rule_code,
      severity: r.severity as ValidationIssueRow["severity"],
      message: r.message,
      sourcePath: str(r.source_path),
      sourceFilename: str(r.source_filename),
      reportType: str(r.report_type),
      sourceGameKey: str(r.source_game_key),
      teamCode: str(r.team_code),
      createdAt: r.created_at,
      context: (r.context as Record<string, unknown> | null) ?? null,
    })),
    pagination: {
      page: opts.page,
      pageSize: opts.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / opts.pageSize)),
    },
  };
}

export async function getReviewFacets(season?: number) {
  const where = season ? sql`g.season_year = ${season}` : sql`true`;
  const [severities, rules, types] = await Promise.all([
    run<{ severity: string; n: unknown }[]>(
      sql`select vi.severity, count(*)::int as n from validation_issues vi left join reports r on r.report_id = vi.report_id left join games g on g.game_id = r.game_id where ${where} group by vi.severity order by vi.severity`
    ),
    run<{ rule_code: string; n: unknown }[]>(
      sql`select vi.rule_code, count(*)::int as n from validation_issues vi left join reports r on r.report_id = vi.report_id left join games g on g.game_id = r.game_id where ${where} group by vi.rule_code order by count(*) desc`
    ),
    run<{ report_type: string | null; n: unknown }[]>(
      sql`select r.report_type, count(*)::int as n from validation_issues vi left join reports r on r.report_id = vi.report_id left join games g on g.game_id = r.game_id where ${where} group by r.report_type order by count(*) desc`
    ),
  ]);
  return {
    severities: severities.map((r) => ({ value: r.severity, count: Number(r.n) })),
    rules: rules.map((r) => ({ value: r.rule_code, count: Number(r.n) })),
    reportTypes: types
      .map((r) => ({ value: r.report_type ?? "unknown", count: Number(r.n) }))
      .filter((r) => r.value !== "unknown" || types.length === 1),
  };
}
