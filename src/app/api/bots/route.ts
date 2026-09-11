// PlayBeat — Bots list
// GET /api/bots → Bot[]
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/api/_lib/auth-guard";
import { getBots } from "@/lib/bots";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  try {
    const bots = await getBots();
    return NextResponse.json(bots);
  } catch (err: any) {
    console.error("[bots.list] error", err);
    return NextResponse.json(
      { error: "Failed to fetch bots" },
      { status: 500 }
    );
  }
}
