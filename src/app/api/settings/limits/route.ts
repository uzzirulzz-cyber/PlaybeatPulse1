// LeadPulse API — Campaign limits
// GET /api/settings/limits  → CampaignLimits
// PUT /api/settings/limits  → CampaignLimits
import { NextRequest, NextResponse } from "next/server";
import {
  getCampaignLimits,
  setCampaignLimits,
  type CampaignLimits,
} from "@/lib/settings";
import { requireAdmin } from "@/app/api/_lib/auth-guard";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  try {
    const limits = await getCampaignLimits();
    return NextResponse.json(limits);
  } catch (err: any) {
    console.error("[settings.limits.get] error", err);
    return NextResponse.json({ error: "Failed to load campaign limits" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  try {
    const body = (await req.json().catch(() => null)) as Partial<CampaignLimits> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const fields: (keyof CampaignLimits)[] = [
      "maxConcurrentCampaigns",
      "maxTargetPerCampaign",
      "maxWebsitesPerCampaign",
    ];
    const cleaned: any = {};
    for (const k of fields) {
      const v = (body as any)[k];
      if (typeof v !== "number" || v < 1) {
        return NextResponse.json({ error: `Field "${k}" must be a positive number` }, { status: 400 });
      }
      cleaned[k] = Math.floor(v);
    }
    const saved = await setCampaignLimits(cleaned);
    return NextResponse.json(saved);
  } catch (err: any) {
    console.error("[settings.limits.put] error", err);
    return NextResponse.json({ error: "Failed to save campaign limits" }, { status: 500 });
  }
}
