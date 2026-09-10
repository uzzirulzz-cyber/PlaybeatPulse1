// LeadPulse API — Scoring config
// GET /api/settings/scoring → ScoringConfig
// PUT /api/settings/scoring → ScoringConfig
import { NextRequest, NextResponse } from "next/server";
import { getScoringConfig, setScoringConfig } from "@/lib/settings";
import type { ScoringConfig } from "@/lib/types";

export async function GET() {
  try {
    const cfg = await getScoringConfig();
    return NextResponse.json(cfg);
  } catch (err: any) {
    console.error("[settings.scoring.get] error", err);
    return NextResponse.json({ error: "Failed to load scoring config" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as ScoringConfig | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const required: (keyof ScoringConfig)[] = [
      "website", "businessNameCategoryMatch", "businessEmail", "verifiedEmail",
      "whatsappEvidence", "phone", "businessAddress", "socialProfile", "activeWebsite",
    ];
    for (const k of required) {
      if (typeof (body as any)[k] !== "number") {
        return NextResponse.json({ error: `Field "${k}" must be a number` }, { status: 400 });
      }
    }
    const saved = await setScoringConfig(body);
    return NextResponse.json(saved);
  } catch (err: any) {
    console.error("[settings.scoring.put] error", err);
    return NextResponse.json({ error: "Failed to save scoring config" }, { status: 500 });
  }
}
