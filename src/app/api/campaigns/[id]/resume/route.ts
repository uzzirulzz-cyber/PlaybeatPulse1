// LeadPulse API — Resume campaign (status → queued; worker picks it up)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeCampaign, audit } from "@/app/api/_lib/serialize";
import { requireAdmin } from "@/app/api/_lib/auth-guard";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  try {
    const { id } = await ctx.params;
    const existing = await db.campaign.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    if (existing.status !== "paused") {
      return NextResponse.json(
        { error: `Cannot resume a campaign in status "${existing.status}"` },
        { status: 400 }
      );
    }

    const updated = await db.campaign.update({
      where: { id },
      data: { status: "queued", errorMessage: null },
    });

    await audit("campaign.resume", "campaign", id, `Resumed campaign "${updated.name}"`);
    return NextResponse.json(serializeCampaign(updated));
  } catch (err: any) {
    console.error("[campaigns.resume] error", err);
    return NextResponse.json({ error: "Failed to resume campaign" }, { status: 500 });
  }
}
