// PlayBeat API — Merge two leads
// POST /api/leads/:id/merge
// Body: { sourceLeadId: string } — merges sourceLeadId INTO :id (target), then deletes sourceLeadId
// Preserves source provenance: moves sourceLead's contacts to target lead, logs the merge.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/app/api/_lib/auth-guard";
import { audit } from "@/lib/rules";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { admin, error } = await requireAdmin(req);
  if (error) return error;

  try {
    const { id: targetId } = await params;
    const body = await req.json();
    const { sourceLeadId } = body;

    if (!sourceLeadId || sourceLeadId === targetId) {
      return NextResponse.json({ error: "sourceLeadId is required and must differ from target" }, { status: 400 });
    }

    const [target, source] = await Promise.all([
      db.lead.findUnique({ where: { id: targetId }, include: { contacts: true } }),
      db.lead.findUnique({ where: { id: sourceLeadId }, include: { contacts: true } }),
    ]);

    if (!target) return NextResponse.json({ error: "Target lead not found" }, { status: 404 });
    if (!source) return NextResponse.json({ error: "Source lead not found" }, { status: 404 });

    // Merge: take the best field from each (prefer non-null, higher confidence)
    const merged = {
      email: target.email || source.email,
      emailConfidence: Math.max(target.emailConfidence || 0, source.emailConfidence || 0) || null,
      emailQuality: target.emailQuality || source.emailQuality,
      whatsapp: target.whatsapp || source.whatsapp,
      whatsappConfidence: Math.max(target.whatsappConfidence || 0, source.whatsappConfidence || 0) || null,
      phone: target.phone || source.phone,
      phoneConfidence: Math.max(target.phoneConfidence || 0, source.phoneConfidence || 0) || null,
      website: target.website || source.website,
      address: target.address || source.address,
      socialUrl: target.socialUrl || source.socialUrl,
      leadScore: Math.max(target.leadScore, source.leadScore),
      leadGrade: target.leadScore >= source.leadScore ? target.leadGrade : source.leadGrade,
      notes: [target.notes, source.notes].filter(Boolean).join("\n---\n") || null,
    };

    // Update target lead with merged data
    await db.lead.update({ where: { id: targetId }, data: merged });

    // Move source's contacts to target (preserve provenance)
    if (source.contacts.length > 0) {
      await db.contact.updateMany({
        where: { leadId: sourceLeadId },
        data: { leadId: targetId },
      });
    }

    // Delete the source lead (contacts already moved)
    await db.lead.delete({ where: { id: sourceLeadId } });

    // Audit log (Rule 16: deleted/merged records remain traceable)
    await audit({
      adminId: admin!.id,
      action: "lead.merge",
      entity: "lead",
      entityId: targetId,
      detail: `Merged source lead ${sourceLeadId} ("${source.businessName}") into target ${targetId} ("${target.businessName}"). Moved ${source.contacts.length} contacts.`,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
    });

    return NextResponse.json({
      ok: true,
      mergedLeadId: targetId,
      deletedSourceLeadId: sourceLeadId,
      contactsMoved: source.contacts.length,
    });
  } catch (err: any) {
    console.error("[leads.merge] error", err);
    return NextResponse.json({ error: "Failed to merge leads" }, { status: 500 });
  }
}
