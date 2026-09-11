// LeadPulse API — Exports
// GET  /api/exports → Export[]
// POST /api/exports → create export (delegates to /api/leads/export for file generation)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/app/api/_lib/auth-guard";
import { audit } from "@/lib/rules";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;

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

// POST /api/exports — create a new export
// Body: { format: "csv"|"xlsx"|"json", scope: "all"|"campaign"|"filtered"|"selected", campaignId?, filters?, ids? }
export async function POST(req: NextRequest) {
  const { admin, error } = await requireAdmin(req);
  if (error) return error;

  try {
    const body = await req.json();
    const { format, scope, campaignId, filters, ids } = body;

    if (!format || !["csv", "xlsx", "json"].includes(format)) {
      return NextResponse.json({ error: "format must be csv, xlsx, or json" }, { status: 400 });
    }
    if (!scope || !["all", "campaign", "filtered", "selected"].includes(scope)) {
      return NextResponse.json({ error: "scope must be all, campaign, filtered, or selected" }, { status: 400 });
    }

    // Build the where clause based on scope
    let where: any = {};
    if (scope === "campaign" && campaignId) {
      where = { campaignId };
    } else if (scope === "selected" && Array.isArray(ids) && ids.length > 0) {
      where = { id: { in: ids } };
    } else if (scope === "filtered" && filters) {
      if (filters.search) {
        where.OR = [
          { businessName: { contains: filters.search, mode: "insensitive" } },
          { email: { contains: filters.search, mode: "insensitive" } },
          { city: { contains: filters.search, mode: "insensitive" } },
        ];
      }
      if (filters.country) where.country = filters.country;
      if (filters.city) where.city = filters.city;
      if (filters.category) where.category = filters.category;
      if (filters.campaignId) where.campaignId = filters.campaignId;
      if (filters.minScore) where.leadScore = { gte: Number(filters.minScore) };
      if (filters.hasEmail) where.email = { not: null };
      if (filters.hasWhatsApp) where.whatsapp = { not: null };
      if (filters.hasPhone) where.phone = { not: null };
      if (filters.status) where.status = filters.status;
    }

    const leads = await db.lead.findMany({
      where,
      orderBy: { leadScore: "desc" },
      take: 10000, // safety cap
    });

    if (leads.length === 0) {
      return NextResponse.json({ error: "No leads found to export" }, { status: 400 });
    }

    // Generate the export file
    const exportId = `exp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const fs = await import("fs/promises");
    const path = await import("path");
    const exportDir = path.join(process.cwd(), "public", "exports");
    await fs.mkdir(exportDir, { recursive: true });

    let fileUrl: string;
    let fileContent: string | Buffer;

    if (format === "json") {
      fileUrl = `/exports/${exportId}.json`;
      fileContent = JSON.stringify(leads.map(l => ({
        businessName: l.businessName,
        category: l.category,
        city: l.city,
        country: l.country,
        website: l.website,
        email: l.email,
        emailConfidence: l.emailConfidence,
        whatsapp: l.whatsapp,
        whatsappConfidence: l.whatsappConfidence,
        phone: l.phone,
        address: l.address,
        leadScore: l.leadScore,
        leadGrade: l.leadGrade,
        sourceName: l.sourceName,
        sourceUrl: l.sourceUrl,
        discoveredAt: l.discoveredAt,
      })), null, 2);
      await fs.writeFile(path.join(exportDir, `${exportId}.json`), fileContent);
    } else if (format === "csv") {
      fileUrl = `/exports/${exportId}.csv`;
      const headers = ["Business Name", "Industry", "Category", "City", "Country", "Website", "Email", "Email Confidence", "WhatsApp", "WhatsApp Confidence", "Phone", "Address", "Social URL", "Lead Score", "Source", "Source URL", "Discovered At"];
      const rows = [headers.join(",")];
      for (const l of leads) {
        const row = [
          csvEscape(l.businessName),
          csvEscape(l.nature || ""),
          csvEscape(l.category || ""),
          csvEscape(l.city || ""),
          csvEscape(l.country || ""),
          csvEscape(l.website || ""),
          csvEscape(l.email || ""),
          l.emailConfidence || "",
          csvEscape(l.whatsapp || ""),
          l.whatsappConfidence || "",
          csvEscape(l.phone || ""),
          csvEscape(l.address || ""),
          csvEscape(l.socialUrl || ""),
          l.leadScore,
          csvEscape(l.sourceName || ""),
          csvEscape(l.sourceUrl || ""),
          l.discoveredAt instanceof Date ? l.discoveredAt.toISOString() : l.discoveredAt,
        ];
        rows.push(row.join(","));
      }
      fileContent = rows.join("\n");
      await fs.writeFile(path.join(exportDir, `${exportId}.csv`), fileContent);
    } else {
      // xlsx
      fileUrl = `/exports/${exportId}.xlsx`;
      const XLSX = await import("xlsx");
      const data = leads.map(l => ({
        "Business Name": l.businessName,
        "Industry": l.nature || "",
        "Category": l.category || "",
        "City": l.city || "",
        "Country": l.country || "",
        "Website": l.website || "",
        "Email": l.email || "",
        "Email Confidence": l.emailConfidence || 0,
        "WhatsApp": l.whatsapp || "",
        "WhatsApp Confidence": l.whatsappConfidence || 0,
        "Phone": l.phone || "",
        "Address": l.address || "",
        "Social URL": l.socialUrl || "",
        "Lead Score": l.leadScore,
        "Source": l.sourceName || "",
        "Source URL": l.sourceUrl || "",
        "Discovered At": l.discoveredAt instanceof Date ? l.discoveredAt.toISOString() : l.discoveredAt,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Leads");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      await fs.writeFile(path.join(exportDir, `${exportId}.xlsx`), buf);
    }

    // Create Export record
    const exportRow = await db.export.create({
      data: {
        id: exportId,
        campaignId: scope === "campaign" ? campaignId : null,
        format,
        scope,
        filterJson: filters ? JSON.stringify(filters) : null,
        leadCount: leads.length,
        fileUrl,
        status: "completed",
      },
    });

    await audit({
      adminId: admin!.id,
      action: "export.create",
      entity: "export",
      entityId: exportId,
      detail: `${format.toUpperCase()} export (${scope}): ${leads.length} leads`,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
    });

    return NextResponse.json({
      id: exportId,
      fileUrl,
      leadCount: leads.length,
      format,
      scope,
    });
  } catch (err: any) {
    console.error("[exports.create] error", err);
    return NextResponse.json({ error: "Failed to create export" }, { status: 500 });
  }
}

function csvEscape(s: string): string {
  if (!s) return "";
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
