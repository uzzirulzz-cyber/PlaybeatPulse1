// PlayBeat — System operating rules
// GET /api/rules → OperatingRule[]
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/api/_lib/auth-guard";
import { getRules } from "@/lib/rules";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  try {
    const rules = await getRules();
    return NextResponse.json(rules);
  } catch (err: any) {
    console.error("[rules.list] error", err);
    return NextResponse.json(
      { error: "Failed to fetch operating rules" },
      { status: 500 }
    );
  }
}
