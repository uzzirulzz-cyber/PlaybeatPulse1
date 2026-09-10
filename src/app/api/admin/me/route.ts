// PlayBeat — Current admin profile
// GET /api/admin/me → { id, email, role, name }
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/api/_lib/auth-guard";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { admin, error } = await requireAdmin(req);
  if (error) return error;

  try {
    // Fetch the full admin row (includes name)
    const row = await db.admin.findUnique({
      where: { id: admin!.id },
      select: { id: true, email: true, role: true, name: true },
    });
    if (!row) {
      return NextResponse.json(
        { error: "Admin not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      id: row.id,
      email: row.email,
      role: row.role,
      name: row.name,
    });
  } catch (err: any) {
    console.error("[admin.me] error", err);
    return NextResponse.json(
      { error: "Failed to fetch admin profile" },
      { status: 500 }
    );
  }
}
