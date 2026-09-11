// PlayBeat — Public health check (NO auth)
// GET /api/health → HealthStatus
// Status 200 if ok, 503 if down.
import { NextResponse } from "next/server";
import { getHealthStatus } from "@/lib/health";

export async function GET() {
  try {
    const status = await getHealthStatus();
    const httpStatus = status.status === "down" ? 503 : 200;
    return NextResponse.json(status, { status: httpStatus });
  } catch (err: any) {
    console.error("[health] error", err);
    return NextResponse.json(
      {
        status: "down",
        error: err?.message || "Health check failed",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
