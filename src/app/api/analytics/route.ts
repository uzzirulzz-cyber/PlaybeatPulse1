// LeadPulse API — Analytics (computed from real DB aggregations)
// GET /api/analytics → AnalyticsData
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { AnalyticsData } from "@/lib/types";

function startOfToday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function GET() {
  try {
    const startToday = startOfToday();

    const [
      totalLeads,
      todaysLeads,
      emailsCount,
      whatsappCount,
      phonesCount,
      highQualityLeads,
      activeCampaigns,
      failedJobs,
      sourcesActive,
      leadsByCountryRaw,
      leadsByCityRaw,
      leadsByIndustryRaw,
      leadQualityRaw,
      campaignStatusRaw,
      sourcePerfRaw,
    ] = await Promise.all([
      db.lead.count(),
      db.lead.count({ where: { createdAt: { gte: startToday } } }),
      db.lead.count({ where: { email: { not: null } } }),
      db.lead.count({ where: { whatsapp: { not: null } } }),
      db.lead.count({ where: { phone: { not: null } } }),
      db.lead.count({ where: { leadGrade: { in: ["excellent", "high"] } } }),
      db.campaign.count({ where: { status: { in: ["running", "queued"] } } }),
      db.extractionJob.count({ where: { status: "failed" } }),
      db.source.count({ where: { enabled: true, status: "active" } }),
      db.lead.groupBy({
        by: ["country"],
        _count: { _all: true },
        where: { country: { not: null } },
        orderBy: { _count: { country: "desc" } },
        take: 50,
      }),
      db.lead.groupBy({
        by: ["city"],
        _count: { _all: true },
        where: { city: { not: null } },
        orderBy: { _count: { city: "desc" } },
        take: 12,
      }),
      db.lead.groupBy({
        by: ["category"],
        _count: { _all: true },
        where: { category: { not: null } },
        orderBy: { _count: { category: "desc" } },
        take: 12,
      }),
      db.lead.groupBy({
        by: ["leadGrade"],
        _count: { _all: true },
      }),
      db.campaign.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      // Source performance: get all leads with sourceName + contact flags
      db.lead.findMany({
        where: { sourceName: { not: null } },
        select: {
          sourceName: true,
          businessName: true,
          email: true,
          whatsapp: true,
        },
      }),
    ]);

    const totals: AnalyticsData["totals"] = {
      totalLeads,
      todaysLeads,
      emails: emailsCount,
      whatsapp: whatsappCount,
      phones: phonesCount,
      highQualityLeads,
      activeCampaigns,
      failedJobs,
      sourcesActive,
    };

    const leadsByCountry = leadsByCountryRaw
      .filter((r) => r.country)
      .map((r) => ({ label: r.country || "Unknown", value: r._count._all }))
      .sort((a, b) => b.value - a.value);

    const leadsByCity = leadsByCityRaw
      .filter((r) => r.city)
      .map((r) => ({ label: r.city || "Unknown", value: r._count._all }));

    const leadsByIndustry = leadsByIndustryRaw
      .filter((r) => r.category)
      .map((r) => ({ label: r.category || "Unknown", value: r._count._all }));

    // Lead quality distribution — always return all 5 buckets for chart stability
    const gradeBuckets = ["excellent", "high", "good", "medium", "low"];
    const gradeMap = new Map<string, number>();
    for (const r of leadQualityRaw) {
      gradeMap.set(r.leadGrade || "low", r._count._all);
    }
    const leadQualityDistribution = gradeBuckets.map((g) => ({
      label: g,
      value: gradeMap.get(g) || 0,
    }));

    const campaignStats = campaignStatusRaw.map((r) => ({
      label: r.status,
      value: r._count._all,
    }));

    // Source performance — aggregate in JS (distinct businessName per source)
    const sourceAgg = new Map<string, { businesses: Set<string>; emails: number; whatsapp: number }>();
    for (const l of sourcePerfRaw) {
      const name = l.sourceName || "Unknown";
      if (!sourceAgg.has(name)) {
        sourceAgg.set(name, { businesses: new Set(), emails: 0, whatsapp: 0 });
      }
      const a = sourceAgg.get(name)!;
      if (l.businessName) a.businesses.add(l.businessName);
      if (l.email) a.emails++;
      if (l.whatsapp) a.whatsapp++;
    }
    const sourcePerformance = Array.from(sourceAgg.entries())
      .map(([name, a]) => ({
        name,
        businesses: a.businesses.size,
        emails: a.emails,
        whatsapp: a.whatsapp,
        emailRate: a.businesses.size === 0 ? 0 : Math.round((a.emails / a.businesses.size) * 1000) / 10,
      }))
      .sort((a, b) => b.businesses - a.businesses);

    const result: AnalyticsData = {
      totals,
      leadsByCountry,
      leadsByCity,
      leadsByIndustry,
      leadQualityDistribution,
      sourcePerformance,
      campaignStats,
    };

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[analytics] error", err);
    return NextResponse.json({ error: "Failed to compute analytics" }, { status: 500 });
  }
}
