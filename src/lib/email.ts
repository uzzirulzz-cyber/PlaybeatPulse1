// LeadPulse — Email normalization & validation pipeline
import { parseDomain } from "./ssrf";

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Common free / disposable providers
const FREE_PROVIDERS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com",
  "icloud.com", "aol.com", "protonmail.com", "proton.me", "zoho.com",
  "mail.com", "gmx.com", "yandex.com", "msn.com", "me.com", "mac.com",
]);

const DISPOSABLE_PROVIDERS = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
  "throwaway.email", "trashmail.com", "yopmail.com", "getnada.com",
  "sharklasers.com", "dispostable.com", "temp-mail.org", "maildrop.cc",
  "fakeinbox.com", "mintemail.com", "mohmal.com", "tempinbox.com",
]);

export interface ExtractedEmail {
  email: string;        // normalized lowercase
  raw: string;          // as found
  section: string;      // mailto | html | jsonld | contact | footer ...
}

export function extractEmailsFromHtml(html: string): ExtractedEmail[] {
  const found: ExtractedEmail[] = [];
  const seen = new Set<string>();

  // 1. mailto: links (highest signal)
  const mailtoRegex = /mailto:([^"'?>\s]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = mailtoRegex.exec(html)) !== null) {
    const raw = decodeURIComponent(m[1].split("?")[0]);
    const norm = normalizeEmail(raw);
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      found.push({ email: norm, raw, section: "mailto" });
    }
  }

  // 2. JSON-LD structured data (very reliable)
  const jsonldRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  while ((m = jsonldRegex.exec(html)) !== null) {
    const block = m[1];
    const emails = block.match(EMAIL_REGEX) || [];
    for (const e of emails) {
      const norm = normalizeEmail(e);
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        found.push({ email: norm, raw: e, section: "jsonld" });
      }
    }
  }

  // 3. Plain-text emails in HTML (also catches "info [at] example [dot] com" partially)
  const plainEmails = html.match(EMAIL_REGEX) || [];
  for (const e of plainEmails) {
    const norm = normalizeEmail(e);
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      // Determine section by surrounding context (rough)
      const idx = html.toLowerCase().indexOf(norm.toLowerCase());
      const ctx = html.substring(Math.max(0, idx - 400), idx + 400).toLowerCase();
      let section = "html";
      if (ctx.includes("footer")) section = "footer";
      else if (ctx.includes("contact")) section = "contact";
      else if (ctx.includes("about")) section = "about";
      else if (ctx.includes("team")) section = "team";
      else if (ctx.includes("support")) section = "support";
      found.push({ email: norm, raw: e, section });
    }
  }

  return found;
}

export function normalizeEmail(raw: string): string | null {
  if (!raw) return null;
  let e = raw.trim().toLowerCase();
  // strip mailto:
  if (e.startsWith("mailto:")) e = e.slice(7);
  // strip query string
  e = e.split("?")[0];
  // basic syntax check
  const match = e.match(/^([a-z0-9._%+-]+)@([a-z0-9.-]+\.[a-z]{2,})$/);
  if (!match) return null;
  const [full, local, domain] = match;
  if (!domain || !local) return null;
  if (local.length === 0 || local.length > 64) return null;
  if (domain.length > 253) return null;
  if (domain.startsWith(".") || domain.endsWith(".")) return null;
  return full;
}

export function isValidEmailSyntax(email: string): boolean {
  return normalizeEmail(email) !== null;
}

export function isFreeProvider(email: string): boolean {
  const domain = email.split("@")[1];
  return domain ? FREE_PROVIDERS.has(domain.toLowerCase()) : false;
}

export function isDisposableDomain(email: string): boolean {
  const domain = email.split("@")[1];
  return domain ? DISPOSABLE_PROVIDERS.has(domain.toLowerCase()) : false;
}

export function isBusinessDomain(email: string): boolean {
  return !isFreeProvider(email) && !isDisposableDomain(email);
}

export type EmailQuality = "high" | "medium" | "low";

export interface EmailValidationResult {
  email: string;
  syntaxValid: boolean;
  normalized: boolean;
  disposable: boolean;
  freeProvider: boolean;
  businessDomain: boolean;
  domainValid?: boolean; // DNS result (best-effort, may be undefined)
  quality: EmailQuality;
  confidence: number; // 0-100
}

export function validateEmail(email: string, domainValid?: boolean): EmailValidationResult {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return {
      email: email.toLowerCase(),
      syntaxValid: false,
      normalized: false,
      disposable: false,
      freeProvider: false,
      businessDomain: false,
      domainValid: false,
      quality: "low",
      confidence: 0,
    };
  }
  const disposable = isDisposableDomain(normalized);
  const freeProvider = isFreeProvider(normalized);
  const businessDomain = !disposable && !freeProvider;

  let quality: EmailQuality = "low";
  let confidence = 40;

  if (businessDomain && domainValid !== false && !disposable) {
    quality = "high";
    confidence = 85;
  } else if (businessDomain) {
    quality = domainValid === false ? "medium" : "high";
    confidence = domainValid === false ? 60 : 80;
  } else if (freeProvider && !disposable) {
    quality = "medium";
    confidence = 45;
  } else {
    quality = "low";
    confidence = disposable ? 10 : 25;
  }

  return {
    email: normalized,
    syntaxValid: true,
    normalized: true,
    disposable,
    freeProvider,
    businessDomain,
    domainValid,
    quality,
    confidence,
  };
}

// Heuristic: business-domain emails with common role prefixes get a small boost
export const BUSINESS_EMAIL_PREFIXES = [
  "info", "sales", "hello", "contact", "support", "office",
  "marketing", "business", "booking", "admin", "enquiries", "help",
];

export function isBusinessRoleEmail(email: string): boolean {
  const local = email.split("@")[0]?.toLowerCase();
  if (!local) return false;
  return BUSINESS_EMAIL_PREFIXES.includes(local);
}

// Utility to extract domain from an email
export function domainFromEmail(email: string): string | null {
  const d = email.split("@")[1];
  return d ? d.toLowerCase() : null;
}

// Re-export for convenience in tests/worker
export { parseDomain };
