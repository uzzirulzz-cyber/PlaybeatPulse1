// LeadPulse API — Leads export (CSV/XLSX)
// POST /api/leads/export body: { format, scope, campaignId?, filters?, ids? }
// → { id, fileUrl, leadCount }
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/app/api/_lib/serialize";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

interface ExportFilters {
  search?: string;
  campaignId?: string;
  country?: string;
  city?: string;
  category?: string;
  minScore?: number;
  hasEmail?: boolean;
  hasWhatsApp?: boolean;
  hasPhone?: boolean;
  status?: string;
}

interface ExportBody {
  format: "csv" | "xlsx";
  scope: "all" | "campaign" | "filtered" | "selected";
  campaignId?: string;
  filters?: ExportFilters;
  ids?: string[];
}

const EXPORT_COLUMNS: { header: string; get: (l: any) => any }[] = [
  { header: "Business Name", get: (l) => l.businessName ?? "" },
  { header: "Industry", get: (l) => l.business?.industry ?? l.nature ?? "" },
  { header: "Category", get: (l) => l.category ?? "" },
  { header: "City", get: (l) => l.city ?? "" },
  { header: "Country", get: (l) => l.country ?? "" },
  { header: "Website", get: (l) => l.website ?? "" },
  { header: "Email", get: (l) => l.email ?? "" },
  { header: "Email Confidence", get: (l) => l.emailConfidence ?? "" },
  { header: "WhatsApp", get: (l) => l.whatsapp ?? "" },
  { header: "WhatsApp Confidence", get: (l) => l.whatsappConfidence ?? "" },
  { header: "Phone", get: (l) => l.phone ?? "" },
  { header: "Address", get: (l) => l.address ?? "" },
  { header: "Social URL", get: (l) => l.socialUrl ?? "" },
  { header: "Lead Score", get: (l) => l.leadScore ?? 0 },
  { header: "Source", get: (l) => l.sourceName ?? "" },
  { header: "Source URL", get: (l) => l.sourceUrl ?? "" },
  {
    header: "Discovered At",
    get: (l) => (l.discoveredAt instanceof Date ? l.discoveredAt.toISOString() : l.discoveredAt ?? ""),
  },
];

function buildWhere(body: ExportBody): any {
  if (body.scope === "selected") {
    if (!body.ids || body.ids.length === 0) {
      return { id: { in: [] } }; // empty
    }
    return { id: { in: body.ids } };
  }
  if (body.scope === "campaign") {
    if (!body.campaignId) return {};
    return { campaignId: body.campaignId };
  }
  if (body.scope === "filtered") {
    return buildWhereFromFilters(body.filters || {});
  }
  return {}; // all
}

function buildWhereFromFilters(f: ExportFilters): any {
  const where: any = {};
  if (f.campaignId) where.campaignId = f.campaignId;
  if (f.country) where.country = f.country;
  if (f.city) where.city = f.city;
  if (f.category) where.category = { contains: f.category };
  if (f.minScore !== undefined) where.leadScore = { gte: f.minScore };
  if (f.hasEmail) where.email = { not: null };
  if (f.hasWhatsApp) where.whatsapp = { not: null };
  if (f.hasPhone) where.phone = { not: null };
  if (f.status) where.status = f.status;
  if (f.search) {
    where.OR = [
      { businessName: { contains: f.search } },
      { email: { contains: f.search } },
      { website: { contains: f.search } },
      { city: { contains: f.search } },
      { country: { contains: f.search } },
      { category: { contains: f.search } },
    ];
  }
  return where;
}

function csvEscape(v: any): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsv(rows: any[]): string {
  const header = EXPORT_COLUMNS.map((c) => c.header).join(",");
  const lines = rows.map((row) =>
    EXPORT_COLUMNS.map((c) => csvEscape(c.get(row))).join(",")
  );
  return [header, ...lines].join("\r\n");
}

function buildXlsxBuffer(rows: any[]): Buffer {
  const aoa: any[][] = [EXPORT_COLUMNS.map((c) => c.header)];
  for (const row of rows) {
    aoa.push(EXPORT_COLUMNS.map((c) => c.get(row)));
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Set column widths
  ws["!cols"] = EXPORT_COLUMNS.map((c) => ({ wch: Math.max(12, c.header.length + 4) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Leads");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as ExportBody | null;
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    if (body.format !== "csv" && body.format !== "xlsx") {
      return NextResponse.json({ error: "format must be 'csv' or 'xlsx'" }, { status: 400 });
    }
    if (!["all", "campaign", "filtered", "selected"].includes(body.scope)) {
      return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
    }
    if (body.scope === "campaign" && !body.campaignId) {
      return NextResponse.json({ error: "campaignId is required for scope 'campaign'" }, { status: 400 });
    }
    if (body.scope === "selected" && (!body.ids || body.ids.length === 0)) {
      return NextResponse.json({ error: "ids[] is required for scope 'selected'" }, { status: 400 });
    }

    const where = buildWhere(body);

    // Create export record first (so we have an ID for the filename)
    const exportRec = await db.export.create({
      data: {
        format: body.format,
        scope: body.scope,
        filterJson: JSON.stringify({
          campaignId: body.campaignId,
          filters: body.filters,
          ids: body.ids,
        }),
        status: "pending",
      },
    });

    // Fetch leads
    const rows = await db.lead.findMany({
      where,
      include: { business: { select: { socialProfiles: true, industry: true } } },
      orderBy: { leadScore: "desc" },
      take: 50000, // safety cap
    });

    const leadCount = rows.length;
    const ext = body.format;
    const fileName = `${exportRec.id}.${ext}`;
    const dir = path.join(process.cwd(), "public", "exports");
    fs.mkdirSync(dir, { recursive: true });
    const absPath = path.join(dir, fileName);

    if (body.format === "csv") {
      const csv = buildCsv(rows);
      fs.writeFileSync(absPath, csv, "utf8");
    } else {
      const buf = buildXlsxBuffer(rows);
      fs.writeFileSync(absPath, buf);
    }

    const fileUrl = `/exports/${fileName}`;
    const updated = await db.export.update({
      where: { id: exportRec.id },
      data: {
        leadCount,
        fileUrl,
        campaignId: body.scope === "campaign" ? body.campaignId : null,
        status: "completed",
      },
    });

    await audit(
      "export.create",
      "export",
      exportRec.id,
      `Exported ${leadCount} leads as ${ext.toUpperCase()} (scope=${body.scope})`
    );

    return NextResponse.json({
      id: updated.id,
      fileUrl,
      leadCount,
    });
  } catch (err: any) {
    console.error("[leads.export] error", err);
    return NextResponse.json({ error: "Failed to generate export" }, { status: 500 });
  }
}
