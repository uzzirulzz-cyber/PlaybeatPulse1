// LeadPulse API — Shared serialization & helpers
// Converts Prisma rows into the shapes the frontend expects (see @/lib/types).
import type {
  Campaign, Lead, Source, SuppressionEntry, Contact,
  LocationFilters, BusinessFilters, ContactFilters, QualityFilters,
} from "@/lib/types";
import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// JSON helpers (campaign filters are stored as JSON strings in SQLite)
// ---------------------------------------------------------------------------

export function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export function stringifyJson(obj: unknown): string {
  return JSON.stringify(obj ?? {});
}

// ---------------------------------------------------------------------------
// Campaign serialization
// ---------------------------------------------------------------------------

export function serializeCampaign(c: any): Campaign {
  return {
    id: c.id,
    name: c.name,
    description: c.description ?? undefined,
    locationFilters: parseJson<LocationFilters>(c.locationFilters, {}),
    businessFilters: parseJson<BusinessFilters>(c.businessFilters, {}),
    contactFilters: parseJson<ContactFilters>(c.contactFilters, {}),
    qualityFilters: parseJson<QualityFilters>(c.qualityFilters, {}),
    target: c.target,
    status: c.status,
    progress: c.progress,
    errorMessage: c.errorMessage ?? undefined,
    startedAt: c.startedAt ? toIso(c.startedAt) : undefined,
    completedAt: c.completedAt ? toIso(c.completedAt) : undefined,
    createdAt: toIso(c.createdAt),
    updatedAt: toIso(c.updatedAt),
    businessesDiscovered: c.businessesDiscovered ?? 0,
    websitesAnalyzed: c.websitesAnalyzed ?? 0,
    emailsDiscovered: c.emailsDiscovered ?? 0,
    whatsappDiscovered: c.whatsappDiscovered ?? 0,
    phonesDiscovered: c.phonesDiscovered ?? 0,
    duplicatesRemoved: c.duplicatesRemoved ?? 0,
    invalidRemoved: c.invalidRemoved ?? 0,
    highQualityLeads: c.highQualityLeads ?? 0,
    validContacts: c.validContacts ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Lead serialization
// ---------------------------------------------------------------------------

export function serializeLead(
  l: any,
  opts: { includeContacts?: boolean } = {}
): Lead {
  const business = l.business;
  let socialProfiles: Record<string, string> | undefined;
  if (business?.socialProfiles) {
    socialProfiles = parseJson<Record<string, string>>(business.socialProfiles, {});
    if (!socialProfiles || Object.keys(socialProfiles).length === 0) socialProfiles = undefined;
  }

  const lead: Lead = {
    id: l.id,
    campaignId: l.campaignId ?? undefined,
    businessId: l.businessId ?? undefined,
    businessName: l.businessName,
    nature: l.nature ?? undefined,
    category: l.category ?? undefined,
    city: l.city ?? undefined,
    country: l.country ?? undefined,
    website: l.website ?? undefined,
    address: l.address ?? undefined,
    email: l.email ?? undefined,
    emailConfidence: l.emailConfidence ?? undefined,
    emailQuality: (l.emailQuality as Lead["emailQuality"]) ?? undefined,
    whatsapp: l.whatsapp ?? undefined,
    whatsappConfidence: l.whatsappConfidence ?? undefined,
    phone: l.phone ?? undefined,
    phoneConfidence: l.phoneConfidence ?? undefined,
    socialUrl: l.socialUrl ?? undefined,
    socialProfiles,
    leadScore: l.leadScore ?? 0,
    leadGrade: l.leadGrade as Lead["leadGrade"],
    status: l.status as Lead["status"],
    notes: l.notes ?? undefined,
    sourceName: l.sourceName ?? undefined,
    sourceUrl: l.sourceUrl ?? undefined,
    discoveredAt: toIso(l.discoveredAt),
    createdAt: toIso(l.createdAt),
    updatedAt: toIso(l.updatedAt),
  };

  if (opts.includeContacts && l.contacts) {
    lead.contacts = l.contacts.map(serializeContact);
  }
  return lead;
}

export function serializeContact(c: any): Contact {
  return {
    id: c.id,
    type: c.type,
    value: c.value,
    rawValue: c.rawValue ?? undefined,
    confidence: c.confidence ?? 0,
    quality: c.quality ?? undefined,
    verified: !!c.verified,
    sourceUrl: c.sourceUrl ?? undefined,
    sourceName: c.sourceName ?? undefined,
    evidence: c.evidence ?? undefined,
    pageSection: c.pageSection ?? undefined,
    normalized: !!c.normalized,
    syntaxValid: !!c.syntaxValid,
    domainValid: c.domainValid ?? undefined,
    disposable: !!c.disposable,
    freeProvider: !!c.freeProvider,
    e164: c.e164 ?? undefined,
    createdAt: toIso(c.createdAt),
  };
}

// ---------------------------------------------------------------------------
// Source serialization (NEVER expose apiKey)
// ---------------------------------------------------------------------------

export function serializeSource(s: any): Source {
  return {
    id: s.id,
    name: s.name,
    type: s.type,
    enabled: !!s.enabled,
    priority: s.priority,
    endpoint: s.endpoint ?? undefined,
    apiKey: undefined,
    dailyLimit: s.dailyLimit,
    perMinute: s.perMinute,
    timeoutMs: s.timeoutMs,
    retryCount: s.retryCount,
    requestsToday: s.requestsToday,
    status: s.status,
    lastError: s.lastError ?? undefined,
    lastResetAt: toIso(s.lastResetAt),
    createdAt: toIso(s.createdAt),
    updatedAt: toIso(s.updatedAt),
  };
}

// ---------------------------------------------------------------------------
// Suppression
// ---------------------------------------------------------------------------

export function serializeSuppression(s: any): SuppressionEntry {
  return {
    id: s.id,
    type: s.type,
    value: s.value,
    reason: s.reason ?? undefined,
    createdAt: toIso(s.createdAt),
  };
}

// ---------------------------------------------------------------------------
// Audit log helper (fire-and-forget — never throw)
// ---------------------------------------------------------------------------

export async function audit(
  action: string,
  entity: string,
  entityId: string,
  detail?: string
): Promise<void> {
  try {
    await db.auditLog.create({
      data: { action, entity, entityId, detail },
    });
  } catch {
    // Never let audit logging break a request
  }
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

export function toIso(v: unknown): string {
  if (!v) return new Date(0).toISOString();
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
}

export function toDate(v: unknown): Date | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return v;
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d;
  }
  return undefined;
}
