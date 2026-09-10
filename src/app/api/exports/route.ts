// LeadPulse API — Recent exports
// GET /api/exports → Export[]
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const rows = await db.export.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        campaign: {
          select: { id: true, name: true },
        },
      },
    });

    const result = rows.map((r) => ({
      id: r.id,
      campaignId: r.campaignId ?? undefined,
      campaignName: r.campaign?.name,
      format: r.format,
      scope: r.scope,
      leadCount: r.leadCount,
      fileUrl: r.fileUrl ?? undefined,
      status: r.status,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : new Date(r.createdAt).toISOString(),
    }));

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[exports.list] error", err);
    return NextResponse.json({ error: "Failed to fetch exports" }, { status: 500 });
  }
}
