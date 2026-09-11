// LeadPulse — Worker tick endpoint (polled by frontend for batch processing)
import { NextRequest, NextResponse } from "next/server";
import { processCampaignBatch, findNextCampaign } from "@/lib/campaign-runner";
import { requireAdmin } from "@/app/api/_lib/auth-guard";

// POST /api/worker/tick?campaignId=X
// Processes a time-bounded batch of the specified campaign (or the next queued one).
// Returns updated progress. The frontend polls this every 3s while campaigns are active.
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  try {
    const url = new URL(req.url);
    const campaignId = url.searchParams.get("campaignId");
    const timeBudget = Number(url.searchParams.get("budget") || "15000");

    // If no campaignId, find the next one that needs processing
    const id = campaignId || (await findNextCampaign());
    if (!id) {
      return NextResponse.json({
        campaignId: null,
        status: "idle",
        message: "No active campaigns",
        done: true,
      });
    }

    const result = await processCampaignBatch(id, Math.min(45000, Math.max(3000, timeBudget)));
    return NextResponse.json(result);
  } catch (e: any) {
    console.error("[worker/tick] error:", e);
    return NextResponse.json({ error: e?.message || "WORKER_ERROR", done: true }, { status: 500 });
  }
}

// GET /api/worker/tick — health/status check
export async function GET() {
  const nextId = await findNextCampaign();
  return NextResponse.json({
    ok: true,
    activeCampaignId: nextId,
    mode: "in-process",
    message: nextId ? "Campaign pending" : "Idle",
  });
}
