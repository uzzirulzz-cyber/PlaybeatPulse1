// PlayBeat — Health check
import { db } from "./db";
import { getBotSummary } from "./bots";

const startedAt = Date.now();

export interface HealthStatus {
  status: "ok" | "degraded" | "down";
  version: string;
  uptime: number; // seconds
  timestamp: string;
  checks: {
    api: { status: string; message: string };
    database: { status: string; message: string };
    bots: { status: string; summary: any };
    sources: { status: string; active: number; total: number };
  };
}

export async function getHealthStatus(): Promise<HealthStatus> {
  const checks: HealthStatus["checks"] = {
    api: { status: "ok", message: "API responding" },
    database: { status: "ok", message: "Connected" },
    bots: { status: "ok", summary: {} },
    sources: { status: "ok", active: 0, total: 0 },
  };

  // Database check
  try {
    await db.$queryRaw`SELECT 1`;
  } catch (e: any) {
    checks.database = { status: "down", message: e?.message || "Connection failed" };
  }

  // Bots check
  try {
    const summary = await getBotSummary();
    checks.bots = {
      status: summary.failed > 0 ? "degraded" : "ok",
      summary,
    };
  } catch (e: any) {
    checks.bots = { status: "degraded", summary: { error: e?.message } };
  }

  // Sources check
  try {
    const sources = await db.source.findMany();
    const active = sources.filter(s => s.enabled && s.status === "active").length;
    checks.sources = {
      status: active > 0 ? "ok" : "degraded",
      active,
      total: sources.length,
    };
  } catch (e: any) {
    checks.sources = { status: "degraded", active: 0, total: 0 };
  }

  const allOk = Object.values(checks).every(c => c.status === "ok");
  const anyDown = Object.values(checks).some(c => c.status === "down");

  return {
    status: anyDown ? "down" : allOk ? "ok" : "degraded",
    version: "1.0.0",
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
    checks,
  };
}
