// PlayBeat — Admin logout
// POST /api/auth/logout
// Destroys the session in DB, clears the cookie.
import { NextRequest, NextResponse } from "next/server";
import {
  destroySession,
  sessionCookieName,
  getAdminFromRequest,
} from "@/lib/auth";
import { audit } from "@/lib/rules";

export async function POST(req: NextRequest) {
  try {
    // Best-effort: identify admin before destroying session (for audit log)
    const admin = await getAdminFromRequest(req);
    const token = req.cookies.get(sessionCookieName())?.value;

    if (token) {
      await destroySession(token);
    }

    if (admin) {
      await audit({
        adminId: admin.id,
        action: "admin.logout",
        entity: "admin",
        entityId: admin.id,
        detail: admin.email,
      });
    }

    const res = NextResponse.json({ ok: true });
    // Clear the cookie
    res.headers.set(
      "Set-Cookie",
      `${sessionCookieName()}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
    );
    return res;
  } catch (err: any) {
    console.error("[auth.logout] error", err);
    // Still clear the cookie even if session destruction fails
    const res = NextResponse.json({ ok: true });
    res.headers.set(
      "Set-Cookie",
      `${sessionCookieName()}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
    );
    return res;
  }
}
