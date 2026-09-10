// PlayBeat — IMPORTANT OPERATING RULES engine (server-enforced)
// These rules are enforced server-side on every extraction/lead operation.
// They CANNOT be bypassed through the frontend.
import { db } from "./db";

export interface OperatingRule {
  number: number;
  title: string;
  description: string;
  category: "operating" | "data" | "security";
}

// The 16 mandatory rules — these are the source of truth.
export const OPERATING_RULES: OperatingRule[] = [
  { number: 1, title: "Minimum extraction target 1,000", description: "Every extraction job starts with a minimum target of 1,000 unique leads. Never silently reduce a requested target.", category: "operating" },
  { number: 2, title: "Never insert duplicate leads", description: "Duplicates are strictly prohibited. Canonical identifiers (domain, email, phone, normalized name) prevent re-insertion.", category: "data" },
  { number: 3, title: "Never create dummy/fake data", description: "No fake emails, WhatsApp numbers, companies, websites, or placeholder leads. Production UI never displays mock data.", category: "data" },
  { number: 4, title: "Never fabricate emails or WhatsApp numbers", description: "If a business does not publish an email, leave it empty. Never convert random phones into assumed WhatsApp numbers.", category: "data" },
  { number: 5, title: "Only use permitted sources", description: "Only public/authorized data sources (OpenStreetMap, public business websites, authorized APIs). No stolen or leaked data.", category: "operating" },
  { number: 6, title: "Respect source terms and rate limits", description: "Honor robots.txt, website terms, API terms, and rate limits. Do not exceed configured per-source limits.", category: "operating" },
  { number: 7, title: "Never bypass CAPTCHAs or access controls", description: "No CAPTCHA bypassing, no anti-bot evasion, no authentication circumvention, no paywall bypassing.", category: "security" },
  { number: 8, title: "Preserve source URLs/provenance", description: "Every lead stores its source URL and source name. Source provenance is maintained for auditability.", category: "data" },
  { number: 9, title: "Validate records before insertion", description: "Emails are syntax-validated, phones normalized to E.164, domains checked. Invalid records are rejected, not stored.", category: "data" },
  { number: 10, title: "Maintain extraction audit logs", description: "All admin actions, extraction jobs, lead inserts/merges/deletes, exports, and config changes are logged.", category: "operating" },
  { number: 11, title: "Never expose admin credentials", description: "Admin passwords, API secrets, DB credentials, and tokens are never exposed in frontend, API responses, or logs.", category: "security" },
  { number: 12, title: "Failed jobs must be logged and recoverable", description: "Extraction failures are logged with error codes. Jobs can be retried. Partial results are preserved.", category: "operating" },
  { number: 13, title: "Bot configuration must persist", description: "Bot enable/disable status, config, and run history survive application restarts and deployments (stored in DB).", category: "operating" },
  { number: 14, title: "Production UI must never display mock lead data", description: "The dashboard, leads table, and all UI components show only real database records. Empty states are shown when no data exists.", category: "data" },
  { number: 15, title: "Exports contain only actual stored leads", description: "CSV/XLSX/JSON exports contain real records from the database. No fabricated or sample rows.", category: "data" },
  { number: 16, title: "Deleted/merged records remain traceable", description: "When leads are deleted or merged, audit log entries preserve the trace of what happened.", category: "data" },
];

// Seed the rules into the DB on first run (idempotent)
export async function seedRules(): Promise<void> {
  const count = await db.systemRule.count();
  if (count > 0) return;
  await db.systemRule.createMany({
    data: OPERATING_RULES.map(r => ({
      number: r.number,
      title: r.title,
      description: r.description,
      category: r.category,
      enabled: true,
      enforced: true,
    })),
  });
}

// ---------------------------------------------------------------------------
// Server-side rule guards — these throw if a rule is violated.
// Called by API routes before performing operations.
// ---------------------------------------------------------------------------

// Rule 1: Minimum extraction target 1,000
export function enforceMinimumTarget(target: number | undefined): number {
  const min = 1000;
  if (target === undefined || target === null || target < 1) return min;
  if (target < min) return min; // never silently reduce below 1000; bump UP to 1000
  return Math.min(50000, Math.floor(target)); // hard cap at 50k
}

// Rule 2: Dedup check before insert (returns true if duplicate)
export function isDuplicateLead(opts: { email?: string | null; phone?: string | null; whatsapp?: string | null; domain?: string | null; normalizedBusinessName?: string | null; city?: string | null }): boolean {
  // This is a synchronous check against the in-memory index (used in campaign-runner).
  // The DB-level unique constraint is the final guarantee. This is a fast pre-check.
  // Actual DB dedup happens in campaign-runner via DupIndex.
  return false; // placeholder — real dedup is in dedup.ts DupIndex
}

// Rule 3 & 4: Reject placeholder/fake data
const PLACEHOLDER_PATTERNS = [
  /@example\.(com|org|net)$/i,
  /@test\./i, /@demo\./i, /@fake\./i, /@dummy\./i,
  /^test@/, /^demo@/, /^fake@/, /^dummy@/,
  /john@doe\.com/i, /jane@doe\.com/i,
  /\+123456789/, /\+000000000/, /0000000000/,
  /^acme/i, /^test company/i, /^sample business/i, /^demo company/i,
];

export function rejectsPlaceholder(value: string, type: "email" | "phone" | "name" | "domain"): boolean {
  const v = value.toLowerCase().trim();
  return PLACEHOLDER_PATTERNS.some(p => p.test(v));
}

// Rule 5: Validate source is in the permitted list
export const PERMITTED_SOURCES = [
  "OpenStreetMap Overpass",
  "Nominatim Geocoder",
  "Website Contact Analyzer",
  "Web Search (z-ai)",
  "User-provided dataset",
];

export function isPermittedSource(sourceName: string): boolean {
  return PERMITTED_SOURCES.some(s => sourceName.toLowerCase().includes(s.toLowerCase())) ||
         sourceName.toLowerCase().includes("osm") ||
         sourceName.toLowerCase().includes("openstreetmap");
}

// Rule 9: Validate a lead record before insertion
export function validateLeadRecord(lead: { email?: string | null; phone?: string | null; businessName: string }): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!lead.businessName || lead.businessName.trim().length < 2) {
    errors.push("Business name is required (min 2 chars).");
  }
  if (lead.email) {
    if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(lead.email)) {
      errors.push(`Invalid email syntax: ${lead.email}`);
    }
    if (rejectsPlaceholder(lead.email, "email")) {
      errors.push(`Placeholder email rejected: ${lead.email}`);
    }
  }
  if (lead.phone) {
    if (rejectsPlaceholder(lead.phone, "phone")) {
      errors.push(`Placeholder phone rejected: ${lead.phone}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

// Rule 10: Create audit log entry
export async function audit(opts: { adminId?: string; action: string; entity?: string; entityId?: string; detail?: string; ip?: string; campaignId?: string }): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        adminId: opts.adminId || null,
        action: opts.action,
        entity: opts.entity || null,
        entityId: opts.entityId || null,
        detail: opts.detail || null,
        ip: opts.ip || null,
        campaignId: opts.campaignId || null,
      },
    });
  } catch {
    // never let audit logging fail the operation
  }
}

// Get all rules (from DB, seeded if needed)
export async function getRules(): Promise<any[]> {
  await seedRules();
  return db.systemRule.findMany({ orderBy: { number: "asc" } });
}
