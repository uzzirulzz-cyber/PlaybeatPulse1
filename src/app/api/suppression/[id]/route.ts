// LeadPulse API — Delete suppression entry
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/app/api/_lib/serialize";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const existing = await db.suppressionEntry.findUnique({
      where: { id },
      select: { id: true, type: true, value: true },
    });
    if (!existing) return NextResponse.json({ error: "Suppression entry not found" }, { status: 404 });

    await db.suppressionEntry.delete({ where: { id } });
    await audit("suppression.delete", "suppression", id, `Removed ${existing.type}=${existing.value}`);
    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    console.error("[suppression.delete] error", err);
    return NextResponse.json({ error: "Failed to delete suppression entry" }, { status: 500 });
  }
}
