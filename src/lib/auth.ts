// PlayBeat — Admin authentication library
// Credentials come from ADMIN_EMAIL / ADMIN_PASSWORD env vars (never stored in DB).
// Sessions use JWT signed with JWT_SECRET, stored in HttpOnly cookies.
import { db } from "./db";
import { createHmac, timingSafeEqual } from "node:crypto";

const JWT_SECRET = process.env.JWT_SECRET || "dev-insecure-secret-change-me";
const COOKIE_NAME = "pb_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

export interface AdminClaims {
  sub: string; // admin id
  email: string;
  role: string;
  iat: number;
  exp: number;
}

// Constant-time string comparison to prevent timing attacks
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

// Validate credentials against env vars. Creates/updates the Admin row on success.
export async function validateCredentials(email: string, password: string): Promise<{ ok: boolean; adminId?: string; error?: string }> {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    return { ok: false, error: "Admin credentials not configured on the server." };
  }
  if (!safeEqual(email.toLowerCase(), adminEmail.toLowerCase())) {
    return { ok: false, error: "Invalid credentials." };
  }
  if (!safeEqual(password, adminPassword)) {
    return { ok: false, error: "Invalid credentials." };
  }
  // Upsert admin row
  let admin = await db.admin.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    admin = await db.admin.create({ data: { email: adminEmail, name: "Administrator", role: "superadmin" } });
  }
  return { ok: true, adminId: admin.id };
}

// Create a JWT token (base64url header.payload.signature)
export function createJwt(claims: Omit<AdminClaims, "iat" | "exp">): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminClaims = { ...claims, iat: now, exp: now + Math.floor(SESSION_TTL_MS / 1000) };
  const header = { alg: "HS256", typ: "JWT" };
  const encHeader = b64url(JSON.stringify(header));
  const encPayload = b64url(JSON.stringify(payload));
  const data = `${encHeader}.${encPayload}`;
  const sig = createHmac("sha256", JWT_SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

// Verify a JWT token and return claims, or null if invalid/expired
export function verifyJwt(token: string): AdminClaims | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [encHeader, encPayload, sig] = parts;
    const data = `${encHeader}.${encPayload}`;
    const expectedSig = createHmac("sha256", JWT_SECRET).update(data).digest("base64url");
    if (!safeEqual(sig, expectedSig)) return null;
    const payload = JSON.parse(b64urlDecode(encPayload)) as AdminClaims;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function b64url(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url");
}
function b64urlDecode(s: string): string {
  return Buffer.from(s, "base64url").toString("utf8");
}

export function sessionCookieName(): string {
  return COOKIE_NAME;
}

export function sessionTtlMs(): number {
  return SESSION_TTL_MS;
}

// Extract admin from a Next.js Request (reads cookie)
import type { NextRequest } from "next/server";

export async function getAdminFromRequest(req: NextRequest): Promise<{ id: string; email: string; role: string } | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const claims = verifyJwt(token);
  if (!claims) return null;
  // Verify session exists in DB (allows revocation)
  const session = await db.adminSession.findUnique({ where: { token }, include: { admin: true } });
  if (!session || session.expiresAt < new Date()) return null;
  return { id: session.admin.id, email: session.admin.email, role: session.admin.role };
}

// Create a session (called on successful login)
export async function createSession(adminId: string, email: string, role: string, ip?: string, userAgent?: string): Promise<{ token: string; expiresAt: Date }> {
  const claims = { sub: adminId, email, role };
  const token = createJwt(claims);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.adminSession.create({
    data: { adminId, token, expiresAt, ip, userAgent },
  });
  await db.admin.update({ where: { id: adminId }, data: { lastLoginAt: new Date(), lastLoginIp: ip, loginAttempts: 0, lockedUntil: null } });
  return { token, expiresAt };
}

// Destroy a session (called on logout)
export async function destroySession(token: string): Promise<void> {
  try {
    await db.adminSession.delete({ where: { token } });
  } catch {
    // already deleted
  }
}

// Simple in-memory rate limiter for login attempts (per IP)
const loginAttempts = new Map<string, { count: number; firstAt: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 1000 * 60 * 15; // 15 min

export function checkLoginRateLimit(ip: string): { allowed: boolean; remaining: number; retryAfterMs?: number } {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAt: now });
    return { allowed: true, remaining: MAX_LOGIN_ATTEMPTS - 1 };
  }
  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    return { allowed: false, remaining: 0, retryAfterMs: LOGIN_WINDOW_MS - (now - entry.firstAt) };
  }
  entry.count++;
  return { allowed: true, remaining: MAX_LOGIN_ATTEMPTS - entry.count };
}

export function clearLoginRateLimit(ip: string): void {
  loginAttempts.delete(ip);
}

// Get client IP from a Next.js request
export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}
