// LeadPulse API — Cancel campaign (status → cancelled; worker checks between each business)
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

    if (existing.status === "completed" || existing.status === "cancelled") {
      return NextResponse.json(
        { error: `Campaign is already ${existing.status}` },
        { status: 400 }
      );
    }

    const updated = await db.campaign.update({
      where: { id },
      data: { status: "cancelled", completedAt: new Date() },
    });

    await audit("campaign.cancel", "campaign", id, `Cancelled campaign "${updated.name}"`);
    return NextResponse.json(serializeCampaign(updated));
  } catch (err: any) {
    console.error("[campaigns.cancel] error", err);
    return NextResponse.json({ error: "Failed to cancel campaign" }, { status: 500 });
  }
}
