// LeadPulse — Phone normalization (E.164) & WhatsApp detection
import { parsePhoneNumberFromString } from "libphonenumber-js";

export interface NormalizedPhone {
  e164: string | null;        // +92XXXXXXXXXX
  countryCode: string | null; // "92"
  nationalNumber: string | null;
  input: string;
  valid: boolean;
  country?: string;
}

// Map of common country names to ISO codes for default-region resolution
const COUNTRY_TO_ISO: Record<string, string> = {
  pakistan: "PK", "uae": "AE", "united arab emirates": "AE", "dubai": "AE",
  "saudi arabia": "SA", "ksa": "SA", "united kingdom": "GB", "uk": "GB", "england": "GB",
  "united states": "US", "usa": "US", "us": "US", canada: "CA", australia: "AU",
  india: "IN", germany: "DE", france: "FR", "sri lanka": "LK", bangladesh: "BD",
  nepal: "NP", turkey: "TR", malaysia: "MY", singapore: "SG", indonesia: "ID",
  egypt: "EG", nigeria: "NG", "south africa": "ZA", kenya: "KE", ghana: "GH",
  philippines: "PH", thailand: "TH", vietnam: "VN", japan: "JP", "south korea": "KR",
  china: "CN", "hong kong": "HK", qatar: "QA", kuwait: "KW", bahrain: "BH",
  oman: "OM", jordan: "JO", lebanon: "LB", morocco: "MA", algeria: "DZ",
  tunisia: "TN", spain: "ES", italy: "IT", netherlands: "NL", belgium: "BE",
  switzerland: "CH", sweden: "SE", norway: "NO", denmark: "DK", finland: "FI",
  ireland: "IE", portugal: "PT", greece: "GR", poland: "PL", austria: "AT",
  "new zealand": "NZ", brazil: "BR", argentina: "AR", mexico: "MX", chile: "CL",
  colombia: "CO", peru: "PE", venezuela: "VE",
};

export function isoFromCountry(country?: string): string | undefined {
  if (!country) return undefined;
  const c = country.trim().toLowerCase();
  if (COUNTRY_TO_ISO[c]) return COUNTRY_TO_ISO[c];
  // try direct ISO
  if (/^[A-Z]{2}$/i.test(country)) return country.toUpperCase();
  return undefined;
}

export function normalizePhone(input: string, defaultCountry?: string): NormalizedPhone {
  if (!input) return { e164: null, countryCode: null, nationalNumber: null, input, valid: false };
  // Strip common non-numeric noise but keep leading +
  let cleaned = input.trim();
  // Remove tel: prefix
  cleaned = cleaned.replace(/^tel:/i, "");
  // Remove whatsapp/whats-app text
  cleaned = cleaned.replace(/whats\s*app/i, "").trim();
  // Remove parentheses, spaces, dashes, dots
  cleaned = cleaned.replace(/[()\s\-.\u00A0]/g, "");
  if (!cleaned) return { e164: null, countryCode: null, nationalNumber: null, input, valid: false };

  const region = isoFromCountry(defaultCountry);
  const parsed = parsePhoneNumberFromString(cleaned, region as any);
  if (!parsed) {
    return { e164: null, countryCode: null, nationalNumber: null, input, valid: false };
  }
  return {
    e164: parsed.number,
    countryCode: parsed.countryCallingCode ? String(parsed.countryCallingCode) : null,
    nationalNumber: parsed.nationalNumber?.toString() ?? null,
    input,
    valid: parsed.isValid(),
    country: parsed.country,
  };
}

// ---------------------------------------------------------------------------
// WhatsApp link detection
// ---------------------------------------------------------------------------

export interface WhatsAppEvidence {
  phone: string;        // normalized e164 if parseable, else raw digits
  raw: string;          // original link/text
  e164: string | null;
  confidence: number;   // 0-100
  source: string;       // "wa.me" | "api.whatsapp.com" | "button" | "text"
}

const WHATSAPP_DIGITS_REGEX = /(?:whats\s*app|wa\.me|wa\.link|api\.whatsapp)[^\d]{0,5}(\+?\d[\d\s\-()]{6,18})/gi;

// Extracts WhatsApp references from HTML. Returns deduplicated evidence list.
export function detectWhatsApp(html: string, defaultCountry?: string): WhatsAppEvidence[] {
  const results: WhatsAppEvidence[] = [];
  const seen = new Set<string>();
  const lowerHtml = html.toLowerCase();

  // 1. wa.me / wa.link links — strongest signal
  const waLinkRegex = /https?:\/\/(?:wa\.me|api\.whatsapp\.com\/send|wa\.link|chat\.whatsapp\.com)\/?[^\s"'<>]*/gi;
  let m: RegExpExecArray | null;
  while ((m = waLinkRegex.exec(html)) !== null) {
    const url = m[0];
    // Extract number from wa.me/<number> or api.whatsapp.com/send?phone=<number>
    let num: string | null = null;
    const waMe = url.match(/wa\.me\/(\+?\d[\d]+)/i);
    const waApi = url.match(/[?&]phone=(\+?\d[\d]+)/i);
    const waLink = url.match(/wa\.link\/[^\s]+/i);
    if (waMe) num = waMe[1];
    else if (waApi) num = waApi[1];
    else if (waLink) {
      // wa.link is a shortener — we keep the URL but cannot resolve number here
      results.push({ phone: url, raw: url, e164: null, confidence: 55, source: "wa.link" });
      continue;
    }
    if (num) {
      const norm = normalizePhone(num, defaultCountry);
      const e164 = norm.e164;
      if (e164 && !seen.has(e164)) {
        seen.add(e164);
        results.push({
          phone: e164, raw: url, e164,
          confidence: 90, source: url.includes("wa.me") ? "wa.me" : "api.whatsapp.com",
        });
      } else if (num && !seen.has(num)) {
        seen.add(num);
        results.push({ phone: num, raw: url, e164: null, confidence: 70, source: "whatsapp-link" });
      }
    }
  }

  // 2. WhatsApp click-to-chat buttons with data attributes
  const btnRegex = /<(?:a|button)[^>]*(?:whats\s*app|wa-)[^>]*>/gi;
  while ((m = btnRegex.exec(html)) !== null) {
    const tag = m[0];
    const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
    if (hrefMatch) {
      const href = hrefMatch[1];
      const phoneMatch = href.match(/(?:wa\.me\/|phone=)(\+?\d[\d]+)/i);
      if (phoneMatch) {
        const norm = normalizePhone(phoneMatch[1], defaultCountry);
        const e164 = norm.e164;
        const key = e164 || phoneMatch[1];
        if (key && !seen.has(key)) {
          seen.add(key);
          results.push({
            phone: e164 || phoneMatch[1], raw: href, e164,
            confidence: 85, source: "button",
          });
        }
      }
    }
  }

  // 3. "WhatsApp: +92..." text patterns (lower confidence — needs explicit label)
  while ((m = WHATSAPP_DIGITS_REGEX.exec(html)) !== null) {
    const raw = m[1];
    const norm = normalizePhone(raw, defaultCountry);
    const e164 = norm.e164;
    const key = e164 || raw;
    if (key && !seen.has(key)) {
      seen.add(key);
      results.push({
        phone: e164 || raw, raw: m[0], e164,
        confidence: 60, source: "text",
      });
    }
  }
  WHATSAPP_DIGITS_REGEX.lastIndex = 0;

  // 4. JSON-LD contactPoint with contactType mentioning WhatsApp
  // (covered by structured-data extraction elsewhere; here we only flag)
  if (lowerHtml.includes("whatsapp") && results.length === 0) {
    // Page mentions WhatsApp but we couldn't extract a number — do NOT fabricate.
  }

  return results;
}

// Confidence heuristic: a plain phone number found on a site that also mentions
// WhatsApp gets a moderate whatsapp-confidence bump, but never "high" without a link.
export function inferWhatsAppConfidence(
  phone: string,
  siteMentionsWhatsApp: boolean,
  hasWaLink: boolean
): number {
  if (hasWaLink) return 85;
  if (siteMentionsWhatsApp) return 40;
  return 0;
}
