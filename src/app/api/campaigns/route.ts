// LeadPulse API — Campaigns list & create
// GET  /api/campaigns         → Campaign[]
// POST /api/campaigns         → Campaign
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCampaignLimits } from "@/lib/settings";
import { serializeCampaign, stringifyJson, audit } from "@/app/api/_lib/serialize";
import { requireAdmin } from "@/app/api/_lib/auth-guard";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  try {
    const campaigns = await db.campaign.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(campaigns.map(serializeCampaign));
  } catch (err: any) {
    console.error("[campaigns.list] error", err);
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 });
  }
}

const ALLOWED_TARGETS = new Set([100, 250, 500, 1000, 2500, 5000]);

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const {
      name, description, locationFilters, businessFilters,
      contactFilters, qualityFilters, target,
    } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
    }
    if (target === undefined || target === null || typeof target !== "number" || target <= 0) {
      return NextResponse.json({ error: "Target lead count is required and must be positive" }, { status: 400 });
    }

    // Validate & clamp target against limits
    const limits = await getCampaignLimits();
    let finalTarget = Math.floor(target);
    if (!ALLOWED_TARGETS.has(finalTarget)) {
      // Accept any positive number, but clamp to limits.maxTargetPerCampaign
      if (finalTarget > limits.maxTargetPerCampaign) {
        finalTarget = limits.maxTargetPerCampaign;
      }
      if (finalTarget < 1) finalTarget = 1;
    } else {
      if (finalTarget > limits.maxTargetPerCampaign) finalTarget = limits.maxTargetPerCampaign;
    }

    const campaign = await db.campaign.create({
      data: {
        name: name.trim(),
        description: typeof description === "string" ? description.trim() || null : null,
        locationFilters: stringifyJson(locationFilters ?? {}),
        businessFilters: stringifyJson(businessFilters ?? {}),
        contactFilters: stringifyJson(contactFilters ?? {}),
        qualityFilters: stringifyJson(qualityFilters ?? {}),
        target: finalTarget,
        status: "draft",
        progress: 0,
      },
    });

    await audit("campaign.create", "campaign", campaign.id, `Created "${campaign.name}" (target=${finalTarget})`);

    return NextResponse.json(serializeCampaign(campaign), { status: 201 });
  } catch (err: any) {
    console.error("[campaigns.create] error", err);
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }
}
