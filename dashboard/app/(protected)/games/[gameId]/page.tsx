import Link from "next/link";
import { notFound } from "next/navigation";
import { idParam } from "@/lib/params";
import { gameDetailDb } from "@/lib/db";
import { ReviewBadge } from "@/components/ibl/badges";
import { GameDetailClient } from "./game-detail-client";

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const parsed = idParam.safeParse(gameId);
  if (!parsed.success) {
    notFound();
  }

  const data = await gameDetailDb.loadGameDetail(parsed.data);
  if (!data) {
    notFound();
  }

  return (
    <div className="w-full space-y-4 p-4 sm:p-6">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/games" className="text-muted-foreground hover:text-foreground">
          ← Pertandingan
        </Link>
      </div>
      <GameDetailClient
        data={data}
        gameId={parsed.data}
        reviewBadge={<ReviewBadge ruleCode={data.hasReview ? "needs_review" : undefined} />}
      />
    </div>
  );
}
