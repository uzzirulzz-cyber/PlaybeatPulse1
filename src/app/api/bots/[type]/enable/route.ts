// PlayBeat — Enable a bot
// POST /api/bots/[type]/enable → Bot
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/api/_lib/auth-guard";
import { enableBot } from "@/lib/bots";
import { audit } from "@/lib/rules";
import { getClientIp } from "@/lib/auth";

type Ctx = { params: Promise<{ type: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { admin, error } = await requireAdmin(req);
  if (error) return error;

  try {
    const { type } = await ctx.params;
    const bot = await enableBot(type);
    await audit({
      adminId: admin!.id,
      action: "bot.enable",
      entity: "bot",
      entityId: bot.id,
      detail: `Enabled ${type} bot`,
      ip: getClientIp(req),
    });
    return NextResponse.json(bot);
  } catch (err: any) {
    console.error("[bots.enable] error", err);
    return NextResponse.json(
      { error: "Failed to enable bot" },
      { status: 500 }
    );
  }
}
