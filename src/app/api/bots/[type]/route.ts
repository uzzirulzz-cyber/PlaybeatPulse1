// PlayBeat — Single bot detail + recent runs
// GET /api/bots/[type] → { bot, runs }
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/api/_lib/auth-guard";
import { getBot, getBotRuns } from "@/lib/bots";

type Ctx = { params: Promise<{ type: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  try {
    const { type } = await ctx.params;
    const bot = await getBot(type);
    if (!bot) {
      return NextResponse.json(
        { error: `Bot "${type}" not found` },
        { status: 404 }
      );
    }
    const runs = await getBotRuns(type, 20);
    return NextResponse.json({ bot, runs });
  } catch (err: any) {
    console.error("[bots.get] error", err);
    return NextResponse.json(
      { error: "Failed to fetch bot" },
      { status: 500 }
    );
  }
}
