// PlayBeat — Bot Manager
// 10 bot types that orchestrate legitimate background operations.
// Bots are tracked in the DB (status, health, run history) and persist across restarts.
// The actual bot WORK is integrated into the campaign-runner tick processing —
// each tick triggers discovery, extraction, validation, dedup, scoring, etc.
// The bot manager wraps these operations with status/health tracking.
import { db } from "./db";
import { audit } from "./rules";

export interface BotDefinition {
  type: string;
  name: string;
  description: string;
  defaultConfig: { interval: number; maxRetries: number };
}

export const BOT_DEFINITIONS: BotDefinition[] = [
  { type: "discovery", name: "Discovery Bot", description: "Finds permitted business sources via OpenStreetMap Overpass API and web search.", defaultConfig: { interval: 30000, maxRetries: 3 } },
  { type: "extraction", name: "Extraction Bot", description: "Processes source pages and API responses to extract business contact information.", defaultConfig: { interval: 5000, maxRetries: 3 } },
  { type: "dedup", name: "Deduplication Bot", description: "Identifies and merges duplicate businesses using canonical identifiers (domain, email, phone, name+city).", defaultConfig: { interval: 10000, maxRetries: 2 } },
  { type: "validation", name: "Validation Bot", description: "Validates email syntax, domain, disposable detection, and phone normalization (E.164).", defaultConfig: { interval: 5000, maxRetries: 2 } },
  { type: "enrichment", name: "Enrichment Bot", description: "Adds legitimately available information from configured sources (social profiles, addresses).", defaultConfig: { interval: 15000, maxRetries: 2 } },
  { type: "classification", name: "Classification Bot", description: "Classifies businesses by category, industry, and B2B/B2C type based on OSM tags and keywords.", defaultConfig: { interval: 10000, maxRetries: 1 } },
  { type: "scoring", name: "Lead Scoring Bot", description: "Calculates lead quality scores (0-100) based on evidence: website, email, phone, WhatsApp, social, address.", defaultConfig: { interval: 5000, maxRetries: 1 } },
  { type: "cleanup", name: "Cleanup Bot", description: "Removes invalid records, placeholder data, and maintains database quality. Tracks suppression list.", defaultConfig: { interval: 60000, maxRetries: 2 } },
  { type: "monitoring", name: "Monitoring Bot", description: "Monitors extraction jobs, worker health, failures, and source availability. Updates SourceHealth.", defaultConfig: { interval: 30000, maxRetries: 3 } },
  { type: "scheduler", name: "Scheduler Bot", description: "Runs authorized recurring extraction jobs and manages the campaign queue.", defaultConfig: { interval: 10000, maxRetries: 3 } },
];

// Seed bots into DB on first run (idempotent)
export async function seedBots(): Promise<void> {
  const count = await db.bot.count();
  if (count > 0) return;
  await db.bot.createMany({
    data: BOT_DEFINITIONS.map(b => ({
      type: b.type,
      name: b.name,
      description: b.description,
      enabled: true,
      status: "idle",
      config: JSON.stringify(b.defaultConfig),
    })),
  });
}

// Get all bots
export async function getBots(): Promise<any[]> {
  await seedBots();
  return db.bot.findMany({ orderBy: { type: "asc" }, include: { _count: { select: { runs: true } } } });
}

// Get a bot by type
export async function getBot(type: string): Promise<any | null> {
  await seedBots();
  return db.bot.findUnique({ where: { type } });
}

// Record a bot heartbeat (called during tick processing)
export async function heartbeat(type: string, task?: string): Promise<void> {
  try {
    await db.bot.update({
      where: { type },
      data: { lastHeartbeat: new Date(), status: "running", currentTask: task || null },
    });
  } catch {
    // bot may not exist yet
  }
}

// Record a bot run (success or failure)
export async function recordBotRun(type: string, status: "completed" | "failed", opts: { task?: string; durationMs?: number; result?: any; error?: string }): Promise<void> {
  try {
    const bot = await db.bot.findUnique({ where: { type } });
    if (!bot) return;
    await db.botRun.create({
      data: {
        botId: bot.id,
        status,
        task: opts.task || null,
        duration: opts.durationMs || null,
        result: opts.result ? JSON.stringify(opts.result) : null,
        error: opts.error || null,
        completedAt: new Date(),
      },
    });
    await db.bot.update({
      where: { type },
      data: {
        status: status === "completed" ? "idle" : "failed",
        lastRunAt: new Date(),
        currentTask: null,
        successCount: status === "completed" ? { increment: 1 } : undefined,
        failureCount: status === "failed" ? { increment: 1 } : undefined,
        lastError: status === "failed" ? (opts.error || null) : null,
        jobsProcessed: { increment: 1 },
      },
    });
  } catch {
    // never let bot tracking fail the operation
  }
}

// Enable a bot
export async function enableBot(type: string): Promise<any> {
  const bot = await db.bot.update({
    where: { type },
    data: { enabled: true, status: "idle", lastError: null },
  });
  await audit({ action: "bot.enable", entity: "bot", entityId: bot.id, detail: `Enabled ${type} bot` });
  return bot;
}

// Disable a bot
export async function disableBot(type: string): Promise<any> {
  const bot = await db.bot.update({
    where: { type },
    data: { enabled: false, status: "disabled", currentTask: null },
  });
  await audit({ action: "bot.disable", entity: "bot", entityId: bot.id, detail: `Disabled ${type} bot` });
  return bot;
}

// Restart a bot (reset failure state)
export async function restartBot(type: string): Promise<any> {
  const bot = await db.bot.update({
    where: { type },
    data: { enabled: true, status: "idle", lastError: null, currentTask: null, consecutiveFailures: 0 },
  });
  await audit({ action: "bot.restart", entity: "bot", entityId: bot.id, detail: `Restarted ${type} bot` });
  return bot;
}

// Get bot run history (paginated)
export async function getBotRuns(botType: string, limit = 20): Promise<any[]> {
  const bot = await db.bot.findUnique({ where: { type: botType } });
  if (!bot) return [];
  return db.botRun.findMany({
    where: { botId: bot.id },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
}

// Get bot summary stats for dashboard
export async function getBotSummary(): Promise<{
  total: number; running: number; paused: number; failed: number; disabled: number; idle: number;
}> {
  await seedBots();
  const bots = await db.bot.findMany();
  return {
    total: bots.length,
    running: bots.filter(b => b.status === "running").length,
    paused: bots.filter(b => b.status === "paused").length,
    failed: bots.filter(b => b.status === "failed").length,
    disabled: bots.filter(b => b.status === "disabled").length,
    idle: bots.filter(b => b.status === "idle").length,
  };
}
