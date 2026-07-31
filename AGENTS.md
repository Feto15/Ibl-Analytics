# IBL Analytics Agent Guide

## Project Overview

IBL Analytics processes Indonesian Basketball League game reports from PDF
files, stores normalized and derived data in Neon PostgreSQL, and presents the
results in a Next.js dashboard.

The repository has four main areas:

- `extractor/`: Python scripts for scanning PDFs, extracting reports and shot
  locations, enriching shots, deriving metrics, and importing JSON into Neon.
- `dashboard/`: Next.js 16 application using React 19, TypeScript, Tailwind CSS,
  Drizzle ORM, and the Neon serverless driver.
- `schema.sql`: PostgreSQL schema used by the importer and dashboard.
- `docs/`: extraction methodology, schema notes, and dashboard design rules.

Important data rules:

- Treat PDF reports as the source data and generated JSON as an intermediate,
  auditable representation.
- Preserve `needs_review`, validation issues, match confidence, source file,
  page, and other provenance fields. Do not silently discard uncertain data.
- Keep team and player name normalization centralized. Do not fix spelling
  variants only in dashboard components.
- Derived metrics must remain reproducible from extracted source fields. Record
  the formula or update the relevant documentation when calculations change.
- Neon imports must remain idempotent and use stable natural keys.

## Build and Test Commands

Run commands from the repository root unless noted otherwise.

### Python setup

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
```

Inspect an extractor's supported arguments before changing a pipeline command:

```bash
python3 extractor/scan.py --help
python3 extractor/extract.py --help
python3 extractor/extract_shots.py --help
python3 extractor/enrich_shots.py --help
python3 extractor/extract_advanced.py --help
python3 extractor/derive_metrics.py --help
python3 extractor/import_neon.py --help
```

Use the complete extraction examples in `README.md`. Prefer `--limit` for a
small development sample, `--resume` for interrupted extraction, and
`--dry-run` before a real database import.

### Database schema and import

```bash
psql "$DIRECT_DATABASE_URL" -f schema.sql
python3 extractor/import_neon.py --help
```

Use `DIRECT_DATABASE_URL` only for schema changes or migrations. Use the pooled
`DATABASE_URL` for imports, dashboard queries, and normal application traffic.
Do not run schema application commands unless the task explicitly requires a
database change.

### Dashboard

```bash
cd dashboard
pnpm install
pnpm dev
pnpm lint
pnpm exec tsc --noEmit --incremental false
pnpm build
pnpm start
```

The required pre-merge dashboard checks are:

```bash
cd dashboard
pnpm lint
pnpm exec tsc --noEmit --incremental false
pnpm build
```

## Code Style Guidelines

### General

- Keep changes scoped to the requested behavior. Avoid unrelated refactors or
  generated-file churn.
- Prefer existing project patterns and utilities over introducing a second way
  to solve the same problem.
- Use clear domain names such as `game`, `team`, `player`, `lineup`, `stint`,
  `shot`, `report`, and `validationIssue`.
- Add comments only for non-obvious parsing, normalization, matching, or metric
  logic. Document why a rule exists rather than narrating the code.
- Update the relevant file in `docs/` when extraction methods, data meaning,
  formulas, validation behavior, or dashboard contracts change.

### Python

- Follow PEP 8, use four-space indentation, type hints, `pathlib.Path`, and
  small functions with explicit inputs and return values.
- Use `argparse` for command-line interfaces and return a non-zero exit code for
  failures.
- Parse structured input with appropriate libraries. Do not use fragile string
  splitting when a structured representation is available.
- Make long-running extraction resumable where practical and keep output
  deterministic for the same source files.
- Do not weaken validation merely to reduce the number of `needs_review`
  records.

### TypeScript and React

- Keep TypeScript strict and avoid `any`; use domain types or `unknown` with
  validation and narrowing.
- Use Server Components by default. Add `"use client"` only where browser state,
  effects, or event handlers are required.
- Never pass functions from a Server Component to a Client Component. Define
  interactive table columns, cell renderers, and row navigation inside a client
  boundary.
- Keep database access in `dashboard/lib/db/` and mark server-only modules with
  `server-only`.
- Validate URL parameters and API input with Zod. Use parameterized Drizzle
  queries rather than raw SQL string interpolation.
- Reuse the existing UI components and Lucide icons. Preserve loading, empty,
  error, and review states on data-driven pages.
- Follow `docs/dashboard-design-guide.md` for routes, data mapping,
  responsiveness, review filtering, and visual behavior.

## Testing Instructions

There is currently no dedicated Python or frontend unit-test runner configured.
Do not claim automated test coverage that does not exist.

For Python pipeline changes:

1. Run the affected script with `--help` to verify its CLI.
2. Run it against a small representative sample using `--limit` when supported.
3. Confirm generated JSON is valid and retains source/provenance fields.
4. Compare record counts and validation counts before and after the change.
5. For importer changes, run `--dry-run` first, then verify idempotency by
   importing the same sample twice without increasing logical row counts.
6. Spot-check at least one normal report, one multi-page report, and one
   `needs_review` or ambiguous report when the change affects parsing.

For schema or query changes:

1. Verify joins do not multiply rows unexpectedly.
2. Verify pagination totals count the displayed entity, not an underlying
   one-to-many table.
3. Verify validation issues are scoped to the correct report, team, player, and
   issue type.
4. Use transactions for multi-table writes and confirm natural-key upserts stay
   idempotent.

For dashboard changes:

1. Run lint, TypeScript checking, and the production build.
2. Start the development server and test every changed route with real Neon
   data.
3. Check loading, empty, error, and `needs_review` states.
4. Check desktop and mobile layouts, table overflow, chart rendering, keyboard
   navigation, and visible focus states.
5. Confirm browser and server logs contain no uncaught errors or hydration
   warnings.

Add focused automated tests when introducing reusable parsing rules, metric
formulas, normalization behavior, or other logic that can regress silently.

## Security Considerations

- Never commit `.env`, `.env.local`, database URLs, passwords, tokens, or Neon
  credentials. Keep only placeholders in `.env.example`.
- Never expose `DATABASE_URL` through a `NEXT_PUBLIC_*` variable, Client
  Component, browser bundle, log message, screenshot, or API response.
- Use the pooled `DATABASE_URL` for runtime access and reserve
  `DIRECT_DATABASE_URL` for controlled schema operations.
- Validate and bound all API filters, identifiers, sorting, and pagination.
  Never interpolate user input into SQL.
- Keep all database access server-side and return only fields required by the
  UI.
- Do not log raw connection strings or complete report payloads that may contain
  sensitive metadata.
- Treat source PDFs and generated JSON as untrusted input. Validate paths,
  expected file types, parsed values, and numeric ranges.
- Prevent path traversal: generated output must remain under an explicitly
  selected output directory and must not overwrite source PDFs.
- Use least-privilege database credentials for the dashboard. Schema-changing
  credentials should not be used by the deployed application.
- Review `git diff` before committing to ensure secrets, source datasets,
  generated artifacts, and local build output are not included.
