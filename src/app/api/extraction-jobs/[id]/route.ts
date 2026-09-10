// PlayBeat — Single extraction job (= Campaign) detail
// GET /api/extraction-jobs/[id] → ExtractionJob
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/api/_lib/auth-guard";
import { db } from "@/lib/db";
import { serializeCampaign } from "@/app/api/_lib/serialize";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  try {
    const { id } = await ctx.params;
    const campaign = await db.campaign.findUnique({ where: { id } });
    if (!campaign) {
      return NextResponse.json(
        { error: "Extraction job not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(serializeCampaign(campaign));
  } catch (err: any) {
    console.error("[extraction-jobs.get] error", err);
    return NextResponse.json(
      { error: "Failed to fetch extraction job" },
      { status: 500 }
    );
  }
}
