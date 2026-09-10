// LeadPulse API — Campaign leads (paginated + filtered)
// GET /api/campaigns/:id/leads?page&pageSize&search&minScore&status
// → { data: Lead[], total: number }
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeLead } from "@/app/api/_lib/serialize";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const existing = await db.campaign.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10) || 20));
    const search = (url.searchParams.get("search") || "").trim();
    const minScoreRaw = url.searchParams.get("minScore");
    const minScore = minScoreRaw ? parseInt(minScoreRaw, 10) : undefined;
    const status = url.searchParams.get("status") || undefined;

    const where: any = { campaignId: id };
    if (search) {
      where.OR = [
        { businessName: { contains: search } },
        { email: { contains: search } },
        { website: { contains: search } },
        { city: { contains: search } },
        { country: { contains: search } },
        { category: { contains: search } },
      ];
    }
    if (minScore !== undefined && !isNaN(minScore)) {
      where.leadScore = { gte: minScore };
    }
    if (status) where.status = status;

    const [total, rows] = await Promise.all([
      db.lead.count({ where }),
      db.lead.findMany({
        where,
        include: { business: { select: { socialProfiles: true } } },
        orderBy: { leadScore: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      data: rows.map((r) => serializeLead(r)),
      total,
    });
  } catch (err: any) {
    console.error("[campaigns.leads] error", err);
    return NextResponse.json({ error: "Failed to fetch campaign leads" }, { status: 500 });
  }
}
