import { lineupsDb, seasonsDb } from "@/lib/db";
import { resolveSeasonParam } from "@/lib/server-utils";
import { lineupsQuerySchema } from "@/lib/params";
import { LineupsClient } from "./lineups-client";

export const metadata = { title: "Lineups | IBL Analytics" };

export default async function LineupsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const parsed = lineupsQuerySchema.safeParse(sp);
  const opts = parsed.success ? parsed.data : lineupsQuerySchema.parse({});

  const season = await resolveSeasonParam(sp.season);
  const seasons = await seasonsDb.getSeasons();

  const data = await lineupsDb.getLineupSummaries({
    page: opts.page,
    pageSize: opts.pageSize,
    sort: opts.sort,
    dir: opts.dir,
    season,
    team: opts.team,
    minDuration: opts.minDuration,
    review: opts.review,
  });

  return (
    <div className="p-6">
      <LineupsClient
        data={data.rows}
        pagination={data.pagination}
        seasons={seasons}
        currentSeason={season}
        sort={opts.sort}
        dir={opts.dir}
        review={opts.review}
      />
    </div>
  );
}
