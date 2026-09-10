// LeadPulse API — Suppression list & create
// GET  /api/suppression            → SuppressionEntry[]
// POST /api/suppression            → SuppressionEntry
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeSuppression, audit } from "@/app/api/_lib/serialize";

const ALLOWED_TYPES = new Set([
  "email", "phone", "whatsapp", "domain", "business_name", "website",
]);

export async function GET() {
  try {
    const rows = await db.suppressionEntry.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(rows.map(serializeSuppression));
  } catch (err: any) {
    console.error("[suppression.list] error", err);
    return NextResponse.json({ error: "Failed to fetch suppression list" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { type, value, reason } = body;
    if (!type || !ALLOWED_TYPES.has(type)) {
      return NextResponse.json(
        { error: "type must be one of email|phone|whatsapp|domain|business_name|website" },
        { status: 400 }
      );
    }
    if (!value || typeof value !== "string" || !value.trim()) {
      return NextResponse.json({ error: "value is required" }, { status: 400 });
    }

    const normalized = value.trim().toLowerCase();
    const entry = await db.suppressionEntry.upsert({
      where: { type_value: { type, value: normalized } },
      create: {
        type,
        value: normalized,
        reason: typeof reason === "string" && reason.trim() ? reason.trim() : null,
      },
      update: {
        reason: typeof reason === "string" && reason.trim() ? reason.trim() : undefined,
      },
    });

    await audit("suppression.create", "suppression", entry.id, `Added ${type}=${normalized}`);
    return NextResponse.json(serializeSuppression(entry), { status: 201 });
  } catch (err: any) {
    console.error("[suppression.create] error", err);
    return NextResponse.json({ error: "Failed to add suppression entry" }, { status: 500 });
  }
}
