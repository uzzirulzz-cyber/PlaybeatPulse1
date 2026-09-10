// PlayBeat — Retry a failed extraction job
// POST /api/extraction-jobs/[id]/retry → ExtractionJob
// Sets campaign status to "queued", clears errorMessage, allows the worker to pick it up.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/api/_lib/auth-guard";
import { db } from "@/lib/db";
import { serializeCampaign } from "@/app/api/_lib/serialize";
import { audit } from "@/lib/rules";
import { getClientIp } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { admin, error } = await requireAdmin(req);
  if (error) return error;

  try {
    const { id } = await ctx.params;
    const existing = await db.campaign.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Extraction job not found" },
        { status: 404 }
      );
    }

    if (existing.status === "running" || existing.status === "queued") {
      return NextResponse.json(
        { error: `Cannot retry a job in status "${existing.status}"` },
        { status: 400 }
      );
    }

    const updated = await db.campaign.update({
      where: { id },
      data: {
        status: "queued",
        errorMessage: null,
        startedAt: existing.startedAt ?? new Date(),
        completedAt: null,
      },
    });

    await audit({
      adminId: admin!.id,
      action: "extraction.retry",
      entity: "campaign",
      entityId: id,
      detail: `Retried extraction job "${updated.name}" (was ${existing.status})`,
      ip: getClientIp(req),
      campaignId: id,
    });

    return NextResponse.json(serializeCampaign(updated));
  } catch (err: any) {
    console.error("[extraction-jobs.retry] error", err);
    return NextResponse.json(
      { error: "Failed to retry extraction job" },
      { status: 500 }
    );
  }
}
