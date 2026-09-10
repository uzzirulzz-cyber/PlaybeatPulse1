// LeadPulse API — Dashboard stats (lightweight totals)
// GET /api/dashboard → DashboardStats
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { DashboardStats } from "@/lib/types";

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
      emails,
      whatsapp,
      phones,
      highQualityLeads,
      activeCampaigns,
      failedJobs,
      sourcesActive,
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
    ]);

    const stats: DashboardStats = {
      totalLeads,
      todaysLeads,
      emails,
      whatsapp,
      phones,
      highQualityLeads,
      activeCampaigns,
      failedJobs,
      sourcesActive,
    };

    return NextResponse.json(stats);
  } catch (err: any) {
    console.error("[dashboard] error", err);
    return NextResponse.json({ error: "Failed to fetch dashboard stats" }, { status: 500 });
  }
}
