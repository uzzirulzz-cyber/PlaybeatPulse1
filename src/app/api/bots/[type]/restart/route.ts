// PlayBeat — Restart a bot
// POST /api/bots/[type]/restart → Bot
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/api/_lib/auth-guard";
import { restartBot } from "@/lib/bots";
import { audit } from "@/lib/rules";
import { getClientIp } from "@/lib/auth";

type Ctx = { params: Promise<{ type: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { admin, error } = await requireAdmin(req);
  if (error) return error;

  try {
    const { type } = await ctx.params;
    const bot = await restartBot(type);
    await audit({
      adminId: admin!.id,
      action: "bot.restart",
      entity: "bot",
      entityId: bot.id,
      detail: `Restarted ${type} bot`,
      ip: getClientIp(req),
    });
    return NextResponse.json(bot);
  } catch (err: any) {
    console.error("[bots.restart] error", err);
    return NextResponse.json(
      { error: "Failed to restart bot" },
      { status: 500 }
    );
  }
}
