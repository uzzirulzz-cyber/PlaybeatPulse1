// LeadPulse API — Single lead: GET (with contacts), PATCH, DELETE
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeLead, audit, toDate } from "@/app/api/_lib/serialize";
import { gradeFromScore } from "@/lib/scoring";
import { requireAdmin } from "@/app/api/_lib/auth-guard";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  try {
    const { id } = await ctx.params;
    const lead = await db.lead.findUnique({
      where: { id },
      include: {
        business: { select: { socialProfiles: true } },
        contacts: { orderBy: { confidence: "desc" } },
      },
    });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    return NextResponse.json(serializeLead(lead, { includeContacts: true }));
  } catch (err: any) {
    console.error("[leads.get] error", err);
    return NextResponse.json({ error: "Failed to fetch lead" }, { status: 500 });
  }
}

const ALLOWED_PATCH_FIELDS = new Set([
  "status", "notes", "favorite", "email", "phone", "whatsapp",
  "leadScore", "emailConfidence", "whatsappConfidence", "phoneConfidence",
  "emailQuality", "socialUrl", "website", "address", "city", "country",
  "category", "businessName", "nature",
]);

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  try {
    const { id } = await ctx.params;
    const existing = await db.lead.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const data: any = {};
    const detailParts: string[] = [];

    for (const key of Object.keys(body)) {
      if (!ALLOWED_PATCH_FIELDS.has(key)) continue;
      const v = body[key];

      if (key === "favorite") {
        // Map favorite boolean → status "favorite" / "edited"
        if (v === true) {
          data.status = "favorite";
          detailParts.push("favorited");
        } else if (v === false) {
          data.status = existing.status === "favorite" ? "edited" : existing.status;
          detailParts.push("unfavorited");
        }
        continue;
      }

      if (key === "leadScore") {
        if (typeof v !== "number" || v < 0 || v > 100) {
          return NextResponse.json({ error: "leadScore must be 0-100" }, { status: 400 });
        }
        data.leadScore = Math.round(v);
        data.leadGrade = gradeFromScore(data.leadScore);
        detailParts.push(`score=${data.leadScore}`);
        continue;
      }

      if (key === "status") {
        const allowed = ["new", "verified", "favorite", "rejected", "edited"];
        if (!allowed.includes(v)) {
          return NextResponse.json({ error: `Invalid status "${v}"` }, { status: 400 });
        }
        data.status = v;
        detailParts.push(`status=${v}`);
        continue;
      }

      // Strings: coerce empty string → null
      if (typeof v === "string") {
        data[key] = v.trim() || null;
      } else if (typeof v === "number") {
        data[key] = v;
      } else if (v === null) {
        data[key] = null;
      }
      detailParts.push(`${key}=updated`);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(serializeLead(existing));
    }

    // If lead was "new" and is being edited, mark as "edited"
    if (!data.status && existing.status === "new") {
      data.status = "edited";
    }

    const updated = await db.lead.update({
      where: { id },
      data,
      include: {
        business: { select: { socialProfiles: true } },
        contacts: { orderBy: { confidence: "desc" } },
      },
    });

    await audit("lead.edit", "lead", id, detailParts.join(", ") || "updated");
    return NextResponse.json(serializeLead(updated, { includeContacts: true }));
  } catch (err: any) {
    console.error("[leads.patch] error", err);
    return NextResponse.json({ error: "Failed to update lead" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  try {
    const { id } = await ctx.params;
    const existing = await db.lead.findUnique({
      where: { id },
      select: { id: true, businessName: true },
    });
    if (!existing) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    await db.lead.delete({ where: { id } });
    await audit("lead.delete", "lead", id, `Deleted lead "${existing.businessName}"`);
    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    console.error("[leads.delete] error", err);
    return NextResponse.json({ error: "Failed to delete lead" }, { status: 500 });
  }
}

// silence unused import warning in some lint setups
void toDate;
