// LeadPulse API — Source PATCH/DELETE
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeSource, audit } from "@/app/api/_lib/serialize";
import { requireAdmin } from "@/app/api/_lib/auth-guard";

const ALLOWED_TYPES = new Set(["overpass", "nominatim", "websearch", "website", "directory"]);

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  try {
    const { id } = await ctx.params;
    const existing = await db.source.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Source not found" }, { status: 404 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const data: any = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (typeof body.type === "string") {
      if (!ALLOWED_TYPES.has(body.type)) {
        return NextResponse.json({ error: `Invalid type "${body.type}"` }, { status: 400 });
      }
      data.type = body.type;
    }
    if (body.enabled !== undefined) data.enabled = !!body.enabled;
    if (typeof body.priority === "number") data.priority = body.priority;
    if (typeof body.endpoint === "string") data.endpoint = body.endpoint || null;
    if (typeof body.apiKey === "string") data.apiKey = body.apiKey || null;
    if (typeof body.dailyLimit === "number") data.dailyLimit = body.dailyLimit;
    if (typeof body.perMinute === "number") data.perMinute = body.perMinute;
    if (typeof body.timeoutMs === "number") data.timeoutMs = body.timeoutMs;
    if (typeof body.retryCount === "number") data.retryCount = body.retryCount;
    if (typeof body.status === "string") data.status = body.status;

    const updated = await db.source.update({ where: { id }, data });
    await audit("source.update", "source", id, `Updated source "${updated.name}"`);
    return NextResponse.json(serializeSource(updated));
  } catch (err: any) {
    console.error("[sources.patch] error", err);
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "A source with that name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to update source" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  try {
    const { id } = await ctx.params;
    const existing = await db.source.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!existing) return NextResponse.json({ error: "Source not found" }, { status: 404 });

    await db.source.delete({ where: { id } });
    await audit("source.delete", "source", id, `Deleted source "${existing.name}"`);
    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    console.error("[sources.delete] error", err);
    return NextResponse.json({ error: "Failed to delete source" }, { status: 500 });
  }
}
