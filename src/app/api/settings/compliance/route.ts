// LeadPulse API — Compliance notice
// GET /api/settings/compliance → { notice: string }
import { NextResponse } from "next/server";
import { getComplianceNotice } from "@/lib/settings";

export async function GET() {
  try {
    const notice = await getComplianceNotice();
    return NextResponse.json({ notice });
  } catch (err: any) {
    console.error("[settings.compliance.get] error", err);
    return NextResponse.json({ error: "Failed to load compliance notice" }, { status: 500 });
  }
}
