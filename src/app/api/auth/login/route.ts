// PlayBeat — Admin login
// POST /api/auth/login  body: { email, password }
// On success: sets HttpOnly cookie `pb_admin_session`, returns { admin: { id, email, role } }
// On failure: 401 with error + remaining attempts. 429 if rate-limited.
import { NextRequest, NextResponse } from "next/server";
import {
  validateCredentials,
  createSession,
  checkLoginRateLimit,
  clearLoginRateLimit,
  getClientIp,
  sessionCookieName,
  sessionTtlMs,
} from "@/lib/auth";
import { audit } from "@/lib/rules";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    // Rate limit FIRST — even before parsing body, to prevent brute force
    const rl = checkLoginRateLimit(ip);
    if (!rl.allowed) {
      const retryAfterSec = rl.retryAfterMs
        ? Math.ceil(rl.retryAfterMs / 1000)
        : 60;
      return NextResponse.json(
        {
          error: "Too many login attempts. Try again later.",
          retryAfter: retryAfterSec,
        },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSec) },
        }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body", remaining: rl.remaining },
        { status: 400 }
      );
    }

    const { email, password } = body as { email?: string; password?: string };
    if (
      !email ||
      typeof email !== "string" ||
      !password ||
      typeof password !== "string"
    ) {
      return NextResponse.json(
        {
          error: "Email and password are required.",
          remaining: rl.remaining,
        },
        { status: 400 }
      );
    }

    const result = await validateCredentials(email.trim(), password);
    if (!result.ok || !result.adminId) {
      // Log failed attempt (no adminId — anonymous)
      await audit({
        action: "admin.login_failed",
        entity: "admin",
        detail: email.trim(),
        ip,
      });
      return NextResponse.json(
        {
          error: result.error || "Invalid credentials.",
          remaining: rl.remaining,
        },
        { status: 401 }
      );
    }

    // Success — clear rate limit for this IP
    clearLoginRateLimit(ip);

    // Look up the admin to get role (validateCredentials created/updated the row)
    const userAgent = req.headers.get("user-agent") || undefined;
    const session = await createSession(
      result.adminId,
      email.trim().toLowerCase(),
      "superadmin",
      ip,
      userAgent
    );

    await audit({
      adminId: result.adminId,
      action: "admin.login",
      entity: "admin",
      entityId: result.adminId,
      detail: email.trim(),
      ip,
    });

    const cookie = `${sessionCookieName()}=${session.token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${Math.floor(
      sessionTtlMs() / 1000
    )}`;

    const res = NextResponse.json({
      admin: {
        id: result.adminId,
        email: email.trim().toLowerCase(),
        role: "superadmin",
      },
      expiresAt: session.expiresAt.toISOString(),
    });
    res.headers.set("Set-Cookie", cookie);
    return res;
  } catch (err: any) {
    console.error("[auth.login] error", err);
    return NextResponse.json(
      { error: "Login failed. Please try again." },
      { status: 500 }
    );
  }
}
