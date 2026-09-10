// LeadPulse API — Start campaign (status → queued; worker picks it up)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeCampaign, audit } from "@/app/api/_lib/serialize";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const existing = await db.campaign.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    if (existing.status === "running" || existing.status === "queued") {
      return NextResponse.json(
        { error: "Campaign is already running or queued" },
        { status: 400 }
      );
    }
    if (existing.status === "completed") {
      return NextResponse.json(
        { error: "Campaign is completed — create a new one or duplicate it" },
        { status: 400 }
      );
    }

    const updated = await db.campaign.update({
      where: { id },
      data: {
        status: "queued",
        errorMessage: null,
        startedAt: existing.startedAt ?? new Date(),
      },
    });

    await audit("campaign.start", "campaign", id, `Started campaign "${updated.name}"`);
    return NextResponse.json(serializeCampaign(updated));
  } catch (err: any) {
    console.error("[campaigns.start] error", err);
    return NextResponse.json({ error: "Failed to start campaign" }, { status: 500 });
  }
}
