// LeadPulse API — Compliance notice
// GET /api/settings/compliance → { notice: string }
import { NextRequest, NextResponse } from "next/server";
import { getComplianceNotice } from "@/lib/settings";
import { requireAdmin } from "@/app/api/_lib/auth-guard";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  try {
    const notice = await getComplianceNotice();
    return NextResponse.json({ notice });
  } catch (err: any) {
    console.error("[settings.compliance.get] error", err);
    return NextResponse.json({ error: "Failed to load compliance notice" }, { status: 500 });
  }
}
