// LeadPulse — Deduplication utilities
// A lead is considered a duplicate of an existing one if ANY of these match:
//   - normalized email
//   - normalized phone / whatsapp (e164)
//   - website domain (host without www)
//   - OSM id
//   - business name (normalized) + city (normalized)
import { parseDomain } from "./ssrf";
import { normalizePhone } from "./phone";
import { normalizeEmail } from "./email";

export interface DupKey {
  email?: string | null;
  phoneE164?: string | null;
  whatsappE164?: string | null;
  domain?: string | null;
  businessName?: string | null;
  city?: string | null;
  osmId?: string | null;
}

export function normalizeText(s?: string | null): string {
  if (!s) return "";
  return s.toLowerCase().trim().replace(/[\s.,'"]+/g, " ").replace(/\b(co|company|ltd|inc|llc|corp|limited|the)\b/g, "").trim();
}

export function domainKey(url?: string | null): string | null {
  if (!url) return null;
  return parseDomain(url);
}

export function buildDupKey(raw: {
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  businessName?: string | null;
  city?: string | null;
  osmId?: string | null;
  country?: string | null;
}): DupKey {
  const email = raw.email ? normalizeEmail(raw.email) : null;
  const phoneE164 = raw.phone ? normalizePhone(raw.phone, raw.country || undefined).e164 : null;
  const whatsappE164 = raw.whatsapp ? normalizePhone(raw.whatsapp, raw.country || undefined).e164 : null;
  const domain = domainKey(raw.website);
  const businessName = normalizeText(raw.businessName);
  const city = normalizeText(raw.city);
  return { email, phoneE164, whatsappE164, domain, businessName, city, osmId: raw.osmId };
}

// Returns true if `a` and `b` should be considered the same business.
export function isDuplicate(a: DupKey, b: DupKey): boolean {
  if (a.osmId && b.osmId && a.osmId === b.osmId) return true;
  if (a.email && b.email && a.email === b.email) return true;
  if (a.phoneE164 && b.phoneE164 && a.phoneE164 === b.phoneE164) return true;
  if (a.whatsappE164 && b.whatsappE164 && a.whatsappE164 === b.whatsappE164) return true;
  if (a.domain && b.domain && a.domain === b.domain) return true;
  // name + city fuzzy match (requires both)
  if (a.businessName && b.businessName && a.businessName === b.businessName) {
    if (a.city && b.city && a.city === b.city) return true;
    // if names are equal AND domains/phones also loosely agree
    if (a.domain && b.domain && a.domain === b.domain) return true;
  }
  return false;
}

// Returns true if ANY key in the set matches the candidate.
export class DupIndex {
  private emails = new Set<string>();
  private phones = new Set<string>();
  private whatsapps = new Set<string>();
  private domains = new Set<string>();
  private osmIds = new Set<string>();
  private nameCities = new Set<string>();
  private nameDomains = new Set<string>();

  add(key: DupKey): void {
    if (key.email) this.emails.add(key.email);
    if (key.phoneE164) this.phones.add(key.phoneE164);
    if (key.whatsappE164) this.whatsapps.add(key.whatsappE164);
    if (key.domain) this.domains.add(key.domain);
    if (key.osmId) this.osmIds.add(key.osmId);
    if (key.businessName && key.city) this.nameCities.add(`${key.businessName}|${key.city}`);
    if (key.businessName && key.domain) this.nameDomains.add(`${key.businessName}|${key.domain}`);
  }

  has(key: DupKey): boolean {
    if (key.osmId && this.osmIds.has(key.osmId)) return true;
    if (key.email && this.emails.has(key.email)) return true;
    if (key.phoneE164 && this.phones.has(key.phoneE164)) return true;
    if (key.whatsappE164 && this.whatsapps.has(key.whatsappE164)) return true;
    if (key.domain && this.domains.has(key.domain)) return true;
    if (key.businessName && key.city && this.nameCities.has(`${key.businessName}|${key.city}`)) return true;
    if (key.businessName && key.domain && this.nameDomains.has(`${key.businessName}|${key.domain}`)) return true;
    return false;
  }

  size(): number {
    return this.emails.size + this.phones.size + this.whatsapps.size + this.domains.size + this.osmIds.size;
  }
}
