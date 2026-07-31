import { reviewDb, seasonsDb } from "@/lib/db";
import { resolveSeasonParam } from "@/lib/server-utils";
import { reviewQuerySchema } from "@/lib/params";
import { ReviewClient } from "./review-client";

export const metadata = { title: "Validation Review | IBL Analytics" };

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const parsed = reviewQuerySchema.safeParse(sp);
  const opts = parsed.success ? parsed.data : reviewQuerySchema.parse({});

  const season = await resolveSeasonParam(sp.season);
  const seasons = await seasonsDb.getSeasons();

  const data = await reviewDb.getValidationIssues({
    page: opts.page,
    pageSize: opts.pageSize,
    sort: opts.sort,
    dir: opts.dir,
    season,
    reportType: opts.reportType,
    severity: opts.severity,
    ruleCode: opts.ruleCode,
  });

  const facets = await reviewDb.getReviewFacets(season);

  return (
    <div className="p-6">
      <ReviewClient
        data={data.rows}
        pagination={data.pagination}
        facets={facets}
        seasons={seasons}
        currentSeason={season}
        sort={opts.sort}
        dir={opts.dir}
        filters={{
          severity: opts.severity,
          ruleCode: opts.ruleCode,
          reportType: opts.reportType,
        }}
      />
    </div>
  );
}
