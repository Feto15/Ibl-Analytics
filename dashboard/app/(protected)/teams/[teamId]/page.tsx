import { notFound, redirect } from "next/navigation";
import { resolveGamePhaseParam, resolveSeasonParam } from "@/lib/server-utils";
import { idParam } from "@/lib/params";
import { teamDetailLoaderDb } from "@/lib/db";
import { canonicalTeamId } from "@/lib/db/team-identity";
import { TeamDetailClient } from "./team-detail-client";

export async function generateMetadata({ params, searchParams }: { params: Promise<{ teamId: string }>, searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const p = await params;
  const sp = await searchParams;
  const parsed = idParam.safeParse(p.teamId);
  if (!parsed.success) return { title: "Not Found" };
  const season = await resolveSeasonParam(sp.season);
  const phase = resolveGamePhaseParam(sp.phase);
  const data = await teamDetailLoaderDb.loadTeamDetail(parsed.data, season, phase);
  if (!data) return { title: "Not Found" };
  return { title: `${data.profile.code} | IBL Analytics` };
}

export default async function TeamDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const p = await params;
  const sp = await searchParams;
  const parsed = idParam.safeParse(p.teamId);
  if (!parsed.success) notFound();

  const season = await resolveSeasonParam(sp.season);
  const phase = resolveGamePhaseParam(sp.phase);
  const canonicalId = canonicalTeamId(parsed.data, season);
  if (canonicalId !== parsed.data) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      if (Array.isArray(value)) {
        for (const item of value) query.append(key, item);
      } else if (value !== undefined) {
        query.set(key, value);
      }
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    redirect(`/teams/${canonicalId}${suffix}`);
  }

  const data = await teamDetailLoaderDb.loadTeamDetail(canonicalId, season, phase);
  if (!data) notFound();

  return (
    <div className="p-6">
      <TeamDetailClient
        {...data}
        currentSeason={season}
        phase={phase}
      />
    </div>
  );
}
