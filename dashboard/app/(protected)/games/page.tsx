import Link from "next/link";
import { gamesQuerySchema } from "@/lib/params";
import { gamesDb, teamsDb, seasonsDb } from "@/lib/db";
import { SectionCard } from "@/components/ibl/section-card";
import { PaginationBar } from "@/components/ibl/pagination-bar";
import { EmptyState } from "@/components/ibl/states";
import { GamesFilters } from "./games-filters";
import { GamesTableClient } from "./games-table-client";

export default async function GamesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const parsed = gamesQuerySchema.safeParse({
    page: sp.page,
    pageSize: sp.pageSize,
    sort: sp.sort,
    dir: sp.dir,
    team: sp.team,
    q: sp.q,
    season: sp.season,
    phase: sp.phase,
  });
  const params = parsed.success ? parsed.data : gamesQuerySchema.parse({});

  const [teams, seasons] = await Promise.all([teamsDb.getTeams(), seasonsDb.getSeasons()]);

  // Season is optional: missing query means all seasons; explicit value is validated.
  const season = params.season;
  const result = await gamesDb.getGames({
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort,
    dir: params.dir,
    season,
    team: params.team,
    q: params.q,
    phase: params.phase,
  });

  const teamOptions = teams.map((t) => ({
    value: String(t.teamId),
    label: `${t.code} — ${t.name ?? t.code}`,
  }));

  return (
    <div className="w-full space-y-4 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">Pertandingan</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {result.pagination.total.toLocaleString("en-US")} pertandingan
          </p>
        </div>
        <Link href="/games" className="text-xs text-muted-foreground hover:text-foreground">
          Reset
        </Link>
      </div>

      <SectionCard bodyClassName="p-3">
        <GamesFilters
          teams={teamOptions}
          seasons={seasons.map((s) => ({
            value: String(s.seasonYear),
            label: String(s.seasonYear),
          }))}
          currentSeason={params.season ? String(params.season) : ""}
          currentTeam={params.team ? String(params.team) : ""}
          currentQuery={params.q ?? ""}
          currentPhase={params.phase}
        />
      </SectionCard>

      <SectionCard bodyClassName="p-0">
        {result.rows.length === 0 ? (
          <EmptyState
            title="Tidak ada pertandingan"
            description="Filter saat ini tidak menghasilkan data. Coba reset filter atau ubah musim."
            resetHref="/games"
          />
        ) : (
          <>
            <GamesTableClient
              rows={result.rows}
              sortKey={params.sort}
              sortDir={params.dir}
              phase={params.phase}
            />
            <PaginationBar pagination={result.pagination} pageSizeOptions={[10, 25, 50]} />
          </>
        )}
      </SectionCard>
    </div>
  );
}
