// LeadPulse API — Single campaign GET/PATCH/DELETE
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCampaignLimits } from "@/lib/settings";
import { serializeCampaign, stringifyJson, audit } from "@/app/api/_lib/serialize";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const campaign = await db.campaign.findUnique({ where: { id } });
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    return NextResponse.json(serializeCampaign(campaign));
  } catch (err: any) {
    console.error("[campaigns.get] error", err);
    return NextResponse.json({ error: "Failed to fetch campaign" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const existing = await db.campaign.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const data: any = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (typeof body.description === "string") data.description = body.description.trim() || null;
    if (body.locationFilters !== undefined) data.locationFilters = stringifyJson(body.locationFilters ?? {});
    if (body.businessFilters !== undefined) data.businessFilters = stringifyJson(body.businessFilters ?? {});
    if (body.contactFilters !== undefined) data.contactFilters = stringifyJson(body.contactFilters ?? {});
    if (body.qualityFilters !== undefined) data.qualityFilters = stringifyJson(body.qualityFilters ?? {});

    if (body.target !== undefined) {
      if (typeof body.target !== "number" || body.target <= 0) {
        return NextResponse.json({ error: "Target must be a positive number" }, { status: 400 });
      }
      const limits = await getCampaignLimits();
      let t = Math.floor(body.target);
      if (t > limits.maxTargetPerCampaign) t = limits.maxTargetPerCampaign;
      if (t < 1) t = 1;
      data.target = t;
    }

    // Disallow status mutation via PATCH — use start/pause/resume/cancel endpoints
    if (body.status !== undefined) {
      return NextResponse.json(
        { error: "Use /start, /pause, /resume, or /cancel endpoints to change status" },
        { status: 400 }
      );
    }

    const updated = await db.campaign.update({ where: { id }, data });
    await audit("campaign.update", "campaign", id, `Updated campaign "${updated.name}"`);
    return NextResponse.json(serializeCampaign(updated));
  } catch (err: any) {
    console.error("[campaigns.patch] error", err);
    return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const existing = await db.campaign.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    // Prevent deleting running campaigns
    if (existing.status === "running" || existing.status === "queued") {
      return NextResponse.json(
        { error: "Cannot delete a running/queued campaign — cancel it first" },
        { status: 400 }
      );
    }

    await db.campaign.delete({ where: { id } });
    await audit("campaign.delete", "campaign", id, `Deleted campaign "${existing.name}"`);
    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    console.error("[campaigns.delete] error", err);
    return NextResponse.json({ error: "Failed to delete campaign" }, { status: 500 });
  }
}
