// LeadPulse API — Pause campaign (status → paused; worker checks between each business)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeCampaign, audit } from "@/app/api/_lib/serialize";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const existing = await db.campaign.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    if (existing.status !== "running" && existing.status !== "queued") {
      return NextResponse.json(
        { error: `Cannot pause a campaign in status "${existing.status}"` },
        { status: 400 }
      );
    }

    const updated = await db.campaign.update({
      where: { id },
      data: { status: "paused" },
    });

    await audit("campaign.pause", "campaign", id, `Paused campaign "${updated.name}"`);
    return NextResponse.json(serializeCampaign(updated));
  } catch (err: any) {
    console.error("[campaigns.pause] error", err);
    return NextResponse.json({ error: "Failed to pause campaign" }, { status: 500 });
  }
}
