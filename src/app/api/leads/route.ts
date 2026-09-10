// LeadPulse API — Leads list (filtered + paginated)
// GET /api/leads?search&campaignId&country&city&category&minScore&hasEmail&hasWhatsApp&hasPhone&status&page&pageSize
// → { data: Lead[], total: number }
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeLead } from "@/app/api/_lib/serialize";

function parseBool(v: string | null): boolean | undefined {
  if (v === null) return undefined;
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return undefined;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const sp = url.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(sp.get("pageSize") || "20", 10) || 20));
    const search = (sp.get("search") || "").trim();
    const campaignId = sp.get("campaignId") || undefined;
    const country = sp.get("country") || undefined;
    const city = sp.get("city") || undefined;
    const category = sp.get("category") || undefined;
    const minScoreRaw = sp.get("minScore");
    const minScore = minScoreRaw ? parseInt(minScoreRaw, 10) : undefined;
    const hasEmail = parseBool(sp.get("hasEmail"));
    const hasWhatsApp = parseBool(sp.get("hasWhatsApp"));
    const hasPhone = parseBool(sp.get("hasPhone"));
    const status = sp.get("status") || undefined;

    const where: any = {};
    if (campaignId) where.campaignId = campaignId;
    if (country) where.country = country;
    if (city) where.city = city;
    if (category) where.category = { contains: category };
    if (minScore !== undefined && !isNaN(minScore)) where.leadScore = { gte: minScore };
    if (hasEmail === true) where.email = { not: null };
    if (hasWhatsApp === true) where.whatsapp = { not: null };
    if (hasPhone === true) where.phone = { not: null };
    if (status) where.status = status;

    if (search) {
      where.OR = [
        { businessName: { contains: search } },
        { email: { contains: search } },
        { website: { contains: search } },
        { city: { contains: search } },
        { country: { contains: search } },
        { category: { contains: search } },
        { nature: { contains: search } },
        { phone: { contains: search } },
        { whatsapp: { contains: search } },
      ];
    }

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
    console.error("[leads.list] error", err);
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }
}
