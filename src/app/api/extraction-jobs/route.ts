// PlayBeat — Extraction jobs (= Campaign model) list
// GET /api/extraction-jobs → ExtractionJob[]
// Returns the most recent 100 campaigns serialized as extraction jobs.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/api/_lib/auth-guard";
import { db } from "@/lib/db";
import { serializeCampaign } from "@/app/api/_lib/serialize";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  try {
    const campaigns = await db.campaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json(campaigns.map(serializeCampaign));
  } catch (err: any) {
    console.error("[extraction-jobs.list] error", err);
    return NextResponse.json(
      { error: "Failed to fetch extraction jobs" },
      { status: 500 }
    );
  }
}
