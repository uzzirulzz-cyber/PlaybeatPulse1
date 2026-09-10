// PlayBeat — Audit logs (paginated)
// GET /api/audit-logs?page=1&pageSize=50 → { data: AuditLog[], total: number }
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/api/_lib/auth-guard";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  try {
    const url = new URL(req.url);
    const sp = url.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
    const pageSize = Math.min(
      200,
      Math.max(1, parseInt(sp.get("pageSize") || "50", 10) || 50)
    );
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [total, rows] = await Promise.all([
      db.auditLog.count(),
      db.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          admin: { select: { email: true } },
        },
      }),
    ]);

    const data = rows.map((r) => ({
      id: r.id,
      adminId: r.adminId ?? undefined,
      adminEmail: r.admin?.email ?? undefined,
      userId: r.userId ?? undefined,
      campaignId: r.campaignId ?? undefined,
      action: r.action,
      entity: r.entity ?? undefined,
      entityId: r.entityId ?? undefined,
      detail: r.detail ?? undefined,
      ip: r.ip ?? undefined,
      createdAt:
        r.createdAt instanceof Date
          ? r.createdAt.toISOString()
          : new Date(r.createdAt).toISOString(),
    }));

    return NextResponse.json({ data, total, page, pageSize });
  } catch (err: any) {
    console.error("[audit-logs.list] error", err);
    return NextResponse.json(
      { error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}
