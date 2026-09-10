// LeadPulse API — Sources list & create
// GET  /api/sources → Source[] (apiKey stripped)
// POST /api/sources → Source
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedDefaults } from "@/lib/settings";
import { serializeSource, audit } from "@/app/api/_lib/serialize";
import { requireAdmin } from "@/app/api/_lib/auth-guard";

// Seed defaults once on first module load (best-effort)
let seeded: Promise<void> | null = null;
function ensureSeed(): Promise<void> {
  if (!seeded) {
    seeded = seedDefaults().catch((e) => {
      console.warn("[sources] seedDefaults failed:", e?.message ?? e);
      seeded = null; // allow retry next time
    });
  }
  return seeded;
}

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  try {
    await ensureSeed();
    const sources = await db.source.findMany({
      orderBy: [{ priority: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(sources.map(serializeSource));
  } catch (err: any) {
    console.error("[sources.list] error", err);
    return NextResponse.json({ error: "Failed to fetch sources" }, { status: 500 });
  }
}

const ALLOWED_TYPES = new Set(["overpass", "nominatim", "websearch", "website", "directory"]);

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { name, type } = body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Source name is required" }, { status: 400 });
    }
    if (!type || !ALLOWED_TYPES.has(type)) {
      return NextResponse.json(
        { error: "type must be one of overpass|nominatim|websearch|website|directory" },
        { status: 400 }
      );
    }

    const data: any = {
      name: name.trim(),
      type,
      enabled: body.enabled === undefined ? true : !!body.enabled,
      priority: typeof body.priority === "number" ? body.priority : 50,
      endpoint: typeof body.endpoint === "string" ? body.endpoint || null : null,
      apiKey: typeof body.apiKey === "string" && body.apiKey ? body.apiKey : null,
      dailyLimit: typeof body.dailyLimit === "number" ? body.dailyLimit : 1000,
      perMinute: typeof body.perMinute === "number" ? body.perMinute : 30,
      timeoutMs: typeof body.timeoutMs === "number" ? body.timeoutMs : 20000,
      retryCount: typeof body.retryCount === "number" ? body.retryCount : 3,
      status: body.status || "active",
    };

    const source = await db.source.create({ data });
    await audit("source.create", "source", source.id, `Created source "${source.name}"`);
    return NextResponse.json(serializeSource(source), { status: 201 });
  } catch (err: any) {
    console.error("[sources.create] error", err);
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "A source with that name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create source" }, { status: 500 });
  }
}
