import { NextResponse } from "next/server";
import { DataError, gameDetailDb } from "@/lib/db";
import { idParam, pbpQuerySchema } from "@/lib/params";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ gameId: string }> }
) {
  const { gameId: rawGameId } = await context.params;
  const gameIdParsed = idParam.safeParse(rawGameId);
  if (!gameIdParsed.success) {
    return NextResponse.json({ error: "Invalid game id" }, { status: 400 });
  }

  const url = new URL(request.url);
  const queryParsed = pbpQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  });
  if (!queryParsed.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  try {
    const data = await gameDetailDb.loadGamePbp(
      gameIdParsed.data,
      queryParsed.data.page,
      queryParsed.data.pageSize
    );
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof DataError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    console.error("[api/pbp] unexpected error");
    return NextResponse.json({ error: "Gagal memuat play-by-play." }, { status: 500 });
  }
}
