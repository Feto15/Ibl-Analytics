import { playersListDb, seasonsDb, teamsDb } from "@/lib/db";
import { resolveSeasonParam } from "@/lib/server-utils";
import { playersQuerySchema } from "@/lib/params";
import { PlayersClient } from "./players-client";
import type { GamePhase } from "@/lib/game-phase";

export const metadata = { title: "Players | IBL Analytics" };

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const parsed = playersQuerySchema.safeParse(sp);
  const opts = parsed.success ? parsed.data : playersQuerySchema.parse({});
  const phase: GamePhase = opts.phase;

  const season =
    parsed.success && parsed.data.season
      ? parsed.data.season
      : await resolveSeasonParam(sp.season);

  const [seasons, teams, data] = await Promise.all([
    seasonsDb.getSeasons(),
    teamsDb.getTeams(),
    playersListDb.getPlayers({
      page: opts.page,
      pageSize: opts.pageSize,
      sort: opts.sort,
      dir: opts.dir,
      season,
      team: opts.team,
      q: opts.q,
      category: opts.category,
      phase,
    }),
  ]);

  return (
    <div className="p-6">
      <PlayersClient
        data={data.rows}
        pagination={data.pagination}
        seasons={seasons}
        teams={teams.map((t) => ({
          value: String(t.teamId),
          label: `${t.code} — ${t.name ?? t.code}`,
        }))}
        currentSeason={season}
        currentTeam={opts.team ? String(opts.team) : ""}
        currentQuery={opts.q ?? ""}
        category={opts.category}
        sort={opts.sort}
        dir={opts.dir}
        phase={phase}
      />
    </div>
  );
}
