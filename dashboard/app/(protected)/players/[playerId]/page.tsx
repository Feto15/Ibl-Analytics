import { notFound } from "next/navigation";
import { resolveSeasonParam } from "@/lib/server-utils";
import { idParam } from "@/lib/params";
import { playerDetailDb, shotsDb } from "@/lib/db";
import { PlayerDetailClient } from "./player-detail-client";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ playerId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const p = await params;
  const sp = await searchParams;
  const parsed = idParam.safeParse(p.playerId);
  if (!parsed.success) return { title: "Not Found" };
  const season = await resolveSeasonParam(sp.season);
  const profile = await playerDetailDb.getPlayerProfile(parsed.data, season);
  if (!profile) return { title: "Not Found" };
  return { title: `${profile.displayName} | IBL Analytics` };
}

export default async function PlayerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ playerId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const p = await params;
  const sp = await searchParams;
  const parsed = idParam.safeParse(p.playerId);
  if (!parsed.success) notFound();

  const season = await resolveSeasonParam(sp.season);
  const teamRaw = Array.isArray(sp.team) ? sp.team[0] : sp.team;
  const teamParsed = teamRaw ? idParam.safeParse(teamRaw) : null;
  const teamId = teamParsed?.success ? teamParsed.data : undefined;

  const profile = await playerDetailDb.getPlayerProfile(parsed.data, season);
  if (!profile) notFound();

  const [games, splits, plusMinus, shots] = await Promise.all([
    playerDetailDb.getPlayerGameStats(parsed.data, season),
    playerDetailDb.getPlayerSplits(parsed.data, season),
    playerDetailDb.getPlayerPlusMinus(parsed.data, season),
    shotsDb.getShots({ playerId: parsed.data, season, limit: 1500 }),
  ]);

  return (
    <div className="p-6">
      <PlayerDetailClient
        profile={profile}
        games={games}
        splits={splits}
        plusMinus={plusMinus}
        shots={shots}
        currentSeason={season}
        currentTeam={teamId}
      />
    </div>
  );
}
