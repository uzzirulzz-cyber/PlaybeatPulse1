// LeadPulse — Web-Search discovery provider (uses z-ai-web-dev-sdk)
// Searches the web for business websites matching the campaign filters, then
// returns discovered business candidates. This is a REAL permitted source
// (the z-ai web-search API). Results include business name, URL, and any
// contact info visible in the search snippet (quick wins).
import ZAI from "z-ai-web-dev-sdk";
import type { LocationFilters, BusinessFilters } from "./types";
import { normalizeEmail } from "./email";
import { normalizePhone } from "./phone";
import { parseDomain } from "./ssrf";

export interface WebSearchBusiness {
  name: string;
  website: string;
  domain: string;
  snippetEmails: string[];   // emails extracted from snippet
  snippetPhones: string[];   // phones extracted from snippet
  snippetWhatsapps: string[];
  sourceName: string;
  sourceUrl: string;
  hostName: string;
}

// Domains that are directories / aggregators / social — NOT actual business websites.
const BLOCKED_HOSTS = new Set([
  "facebook.com", "www.facebook.com", "m.facebook.com",
  "instagram.com", "www.instagram.com",
  "linkedin.com", "www.linkedin.com",
  "twitter.com", "x.com",
  "youtube.com", "www.youtube.com",
  "yelp.com", "www.yelp.com",
  "tripadvisor.com", "www.tripadvisor.com",
  "google.com", "www.google.com",
  "scribd.com", "www.scribd.com",
  "wikipedia.org", "en.wikipedia.org",
  "foursquare.com", "www.foursquare.com",
  "zomato.com", "www.zomato.com",
  "justdial.com", "www.justdial.com",
  "hamariweb.com", "www.hamariweb.com",
  "olx.com", "www.olx.com",
  "gumtree.com", "www.gumtree.com",
  "crunchbase.com", "www.crunchbase.com",
  "yellowpages.com", "www.yellowpages.com",
  "yell.com", "www.yell.com",
  "hotfrog.com", "www.hotfrog.com",
  "owler.com", "www.owler.com",
  "bloomberg.com", "www.bloomberg.com",
  "reddit.com", "www.reddit.com",
  "pinterest.com", "www.pinterest.com",
  "tiktok.com", "www.tiktok.com",
  "play.google.com", "apps.apple.com",
  "maps.google.com",
]);

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?\d[\d\s\-().]{7,18}\d)/g;
const WA_RE = /(?:whats\s*app|wa\.me|api\.whatsapp)/i;

let _zai: any = null;
async function getZai() {
  if (_zai) return _zai;
  // Prefer ZAI.create() (reads .z-ai-config file — works in local dev sandbox)
  try {
    _zai = await ZAI.create();
    return _zai;
  } catch {
    // Fallback: construct from env vars (Vercel production — no config file)
    const baseUrl = process.env.ZAI_BASE_URL;
    const apiKey = process.env.ZAI_API_KEY;
    const token = process.env.ZAI_TOKEN;
    const chatId = process.env.ZAI_CHAT_ID;
    const userId = process.env.ZAI_USER_ID;
    if (!baseUrl || !apiKey) {
      throw new Error("z-ai-web-dev-sdk not configured: set ZAI_BASE_URL and ZAI_API_KEY env vars, or create .z-ai-config");
    }
    _zai = new ZAI({ baseUrl, apiKey, token, chatId, userId });
    return _zai;
  }
}

export function generateSearchQueries(business: BusinessFilters, location: LocationFilters): string[] {
  const nature = business.nature || business.industry || business.category || "";
  const city = location.city || location.area || "";
  const country = location.country || "";
  const queries: string[] = [];
  const baseTerms = [nature, business.category, business.subcategory].filter(Boolean);
  const locTerms = [city, country].filter(Boolean);
  const locStr = locTerms.join(" ");

  if (baseTerms.length === 0) return queries;

  // Core queries — include "contact" to surface contact pages
  if (locStr) {
    queries.push(`${baseTerms.join(" ")} ${locStr} contact email phone`);
    queries.push(`${baseTerms.join(" ")} ${locStr} official website contact`);
  }
  // Variation with each base term
  for (const t of baseTerms) {
    if (locStr && !queries.includes(`${t} ${locStr} contact`)) {
      queries.push(`${t} ${locStr} contact`);
    }
  }
  // Keyword-driven variations
  if (business.keywords?.length) {
    for (const kw of business.keywords.slice(0, 3)) {
      if (locStr) queries.push(`${kw} ${locStr} contact email`);
    }
  }
  return queries.slice(0, 8);
}

export async function discoverBusinessesViaSearch(
  business: BusinessFilters,
  location: LocationFilters,
  opts: { perQuery?: number; maxResults?: number; signal?: AbortSignal } = {}
): Promise<WebSearchBusiness[]> {
  const queries = generateSearchQueries(business, location);
  const perQuery = opts.perQuery ?? 15;
  const maxResults = opts.maxResults ?? 200;
  const zai = await getZai();

  const all: WebSearchBusiness[] = [];
  const seenDomains = new Set<string>();

  for (const q of queries) {
    if (opts.signal?.aborted) break;
    if (all.length >= maxResults) break;
    try {
      const results: any[] = await zai.functions.invoke("web_search", { query: q, num: perQuery });
      if (!Array.isArray(results)) continue;
      for (const r of results) {
        if (all.length >= maxResults) break;
        const host = r.host_name || "";
        if (BLOCKED_HOSTS.has(host.toLowerCase())) continue;
        const domain = parseDomain(r.url) || host;
        if (!domain) continue;
        if (seenDomains.has(domain)) continue;
        seenDomains.add(domain);

        // Derive a clean business name from the title
        let name = (r.name || "").trim();
        // strip trailing " - Contact", " | Home", etc.
        name = name.replace(/\s*[-|·]\s*(contact|home|about|official site|website).*$/i, "").trim();
        // strip leading "Contact |"
        name = name.replace(/^(contact|home|about|official)\s*[-|·]\s*/i, "").trim();
        if (!name || name.length < 2) name = domain;

        // Extract contacts from snippet (quick wins)
        const snippet = r.snippet || "";
        const snippetEmails = (snippet.match(EMAIL_RE) || [])
          .map(normalizeEmail).filter(Boolean) as string[];
        const snippetPhones = (snippet.match(PHONE_RE) || [])
          .map((p: string) => normalizePhone(p, location.country).e164)
          .filter(Boolean) as string[];
        const snippetWhatsapps: string[] = [];
        if (WA_RE.test(snippet)) {
          // try to find a number near "whatsapp"
          const m = snippet.match(/whats\s*app[^\d]{0,5}(\+?\d[\d\s\-().]{6,18}\d)/i);
          if (m) {
            const e164 = normalizePhone(m[1], location.country).e164;
            if (e164) snippetWhatsapps.push(e164);
          }
        }

        all.push({
          name,
          website: r.url,
          domain,
          snippetEmails: Array.from(new Set(snippetEmails)),
          snippetPhones: Array.from(new Set(snippetPhones)),
          snippetWhatsapps: Array.from(new Set(snippetWhatsapps)),
          sourceName: "Web Search",
          sourceUrl: r.url,
          hostName: host,
        });
      }
    } catch (e: any) {
      console.error(`[websearch] query "${q}" failed:`, e?.message);
      // continue with next query
    }
    // small delay between queries to be polite
    await new Promise((r) => setTimeout(r, 400));
  }

  return all;
}
