// PlayBeat — Prisma client
// On Vercel: connects to Neon Postgres via standard TCP (port 5432, works on Vercel).
// Locally: requires DATABASE_URL to point to a reachable Postgres instance.
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error", "warn"] : ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
