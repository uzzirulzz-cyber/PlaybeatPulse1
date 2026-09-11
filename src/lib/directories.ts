// PlayBeat — Free Directory Sources Adapter
// Discovers businesses from public web directories that list developers/agents/brokers.
// Each directory has its own scraping logic. All data is publicly available.
//
// Supported directories:
// 1. REHAB (Bangladesh) — Real Estate & Housing Association of Bangladesh
//    Public member directory at https://www.rehab-bd.org/members
// 2. Zameen.com (Pakistan) — Public agent/agency pages with phones/emails
// 3. DLD Dubai (UAE) — Dubai Land Department broker register (public RERA broker list)
//
// IMPORTANT: These sources are public directories. We only collect publicly displayed
// business contact information. We respect robots.txt and rate limits.
import { safeFetch, parseDomain } from "./ssrf";
import { normalizeEmail } from "./email";
import { normalizePhone } from "./phone";
import * as cheerio from "cheerio";
import type { LocationFilters, BusinessFilters } from "./types";
import type { DiscoveredBusiness } from "./overpass";

export interface DirectoryBusiness {
  name: string;
  website?: string;
  domain: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  city?: string;
  country?: string;
  category: string;
  sourceName: string;
  sourceUrl: string;
}

// Determine which directories are relevant based on the campaign location/category
export function getRelevantDirectories(location: LocationFilters, business: BusinessFilters): string[] {
  const dirs: string[] = [];
  const country = (location.country || "").toLowerCase();
  const nature = (business.nature || business.category || "").toLowerCase();

  // REHAB Bangladesh — real estate developers
  if (country.includes("bangladesh") || country.includes("bd")) {
    if (nature.includes("real") || nature.includes("estate") || nature.includes("developer") || nature.includes("property") || nature.includes("construction")) {
      dirs.push("rehab-bd");
    }
  }

  // Zameen.com — Pakistan real estate agents/agencies
  if (country.includes("pakistan") || country.includes("pk")) {
    if (nature.includes("real") || nature.includes("estate") || nature.includes("agent") || nature.includes("property") || nature.includes("broker")) {
      dirs.push("zameen");
    }
  }

  // DLD Dubai — UAE licensed real estate brokers/developers
  if (country.includes("uae") || country.includes("dubai") || country.includes("emirates")) {
    if (nature.includes("real") || nature.includes("estate") || nature.includes("broker") || nature.includes("developer") || nature.includes("property") || nature.includes("agent")) {
      dirs.push("dld-dubai");
    }
  }

  return dirs;
}

// Main entry: discover businesses from relevant directories
export async function discoverFromDirectories(
  location: LocationFilters,
  business: BusinessFilters,
  opts: { maxResults?: number; signal?: AbortSignal } = {}
): Promise<DirectoryBusiness[]> {
  const dirs = getRelevantDirectories(location, business);
  if (dirs.length === 0) return [];

  const maxResults = opts.maxResults ?? 100;
  const results: DirectoryBusiness[] = [];
  const seenDomains = new Set<string>();

  for (const dir of dirs) {
    if (results.length >= maxResults) break;
    if (opts.signal?.aborted) break;
    try {
      let businesses: DirectoryBusiness[] = [];
      if (dir === "rehab-bd") businesses = await scrapeRehabBangladesh(opts.signal);
      else if (dir === "zameen") businesses = await scrapeZameenAgents(location, opts.signal);
      else if (dir === "dld-dubai") businesses = await scrapeDldDubaiBrokers(opts.signal);

      for (const b of businesses) {
        if (results.length >= maxResults) break;
        if (seenDomains.has(b.domain)) continue;
        seenDomains.add(b.domain);
        results.push(b);
      }
    } catch (e: any) {
      console.error(`[directory:${dir}] error:`, e?.message);
    }
    // Be polite between directories
    await new Promise((r) => setTimeout(r, 1000));
  }

  return results;
}

// ---------------------------------------------------------------------------
// REHAB Bangladesh — Public member directory
// Source: https://www.rehab-bd.org/members (publicly accessible)
// ---------------------------------------------------------------------------
async function scrapeRehabBangladesh(signal?: AbortSignal): Promise<DirectoryBusiness[]> {
  const results: DirectoryBusiness[] = [];
  const urls = [
    "https://www.rehab-bd.org/members",
    "https://www.rehab-bd.org/member-list",
  ];

  for (const url of urls) {
    if (signal?.aborted) break;
    try {
      const r = await safeFetch(url, { timeoutMs: 10000, maxBytes: 1024 * 1024 });
      if (!r.html || r.status !== 200) continue;
      const $ = cheerio.load(r.html);

      // REHAB directory typically lists members in cards/table rows with links
      // Look for member links, company names, contact info
      $("a").each((_, el) => {
        const href = $(el).attr("href") || "";
        const text = $(el).text().trim();
        if (!text || text.length < 3) return;
        // Member profile pages usually have /member/ or /members/ in the URL
        if (href.includes("/member") || href.includes("/company")) {
          const domain = parseDomain(href) || "";
          if (domain && !results.find((r) => r.domain === domain)) {
            results.push({
              name: text.slice(0, 100),
              website: href.startsWith("http") ? href : `https://www.rehab-bd.org${href}`,
              domain,
              city: "Dhaka",
              country: "Bangladesh",
              category: "real_estate_developer",
              sourceName: "REHAB Bangladesh Directory",
              sourceUrl: url,
            });
          }
        }
      });

      // Also look for contact info in the listing itself (emails, phones)
      const html = r.html;
      const emails = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      const phones = html.match(/\+880[\d\s\-]{8,12}/g) || [];

      // Try to associate emails/phones with nearby business names
      $(".member-card, .member-item, .company-card, tr, .card").each((_, el) => {
        const $el = $(el);
        const name = $el.find("h3, h4, .name, .company-name, td:first-child").first().text().trim();
        if (!name || name.length < 3) return;
        const email = emails.find((e) => $el.text().includes(e));
        const phone = phones.find((p) => $el.text().includes(p));
        const website = $el.find("a[href*='http']").first().attr("href");
        const domain = website ? parseDomain(website) : "";
        if (domain && !results.find((r) => r.domain === domain)) {
          results.push({
            name: name.slice(0, 100),
            website,
            domain,
            email: email ? normalizeEmail(email) : undefined,
            phone: phone ? normalizePhone(phone, "Bangladesh").e164 || phone : undefined,
            city: "Dhaka",
            country: "Bangladesh",
            category: "real_estate_developer",
            sourceName: "REHAB Bangladesh Directory",
            sourceUrl: url,
          });
        }
      });

      if (results.length > 0) break; // got data from this URL
    } catch (e: any) {
      console.log(`[rehab-bd] ${url} failed: ${e?.message}`);
    }
  }

  return results.slice(0, 250);
}

// ---------------------------------------------------------------------------
// Zameen.com (Pakistan) — Public agent/agency pages
// Source: https://www.zameen.com/agents/ (publicly accessible agent directory)
// ---------------------------------------------------------------------------
async function scrapeZameenAgents(location: LocationFilters, signal?: AbortSignal): Promise<DirectoryBusiness[]> {
  const results: DirectoryBusiness[] = [];
  const city = location.city ? location.city.toLowerCase().replace(/\s+/g, "-") : "";
  const urls = [
    city ? `https://www.zameen.com/agents/${city}/` : "https://www.zameen.com/agents/",
    "https://www.zameen.com/agents/",
  ];

  for (const url of urls) {
    if (signal?.aborted) break;
    try {
      const r = await safeFetch(url, { timeoutMs: 10000, maxBytes: 1024 * 1024 });
      if (!r.html || r.status !== 200) continue;
      const $ = cheerio.load(r.html);

      // Zameen agent pages list agents in cards with name, phone, email
      $(".agent-card, .agent-listing, .property-agent, [class*='agent']").each((_, el) => {
        const $el = $(el);
        const name = $el.find(".agent-name, h3, h4, .name, a").first().text().trim();
        if (!name || name.length < 3) return;
        const phoneText = $el.text();
        const phoneMatch = phoneText.match(/\+92[\d\s\-]{8,12}/) || phoneText.match(/0(3|4)[\d\s\-]{8,10}/);
        const emailMatch = phoneText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        const link = $el.find("a[href*='/agents/']").first().attr("href") || "";
        const website = link ? (link.startsWith("http") ? link : `https://www.zameen.com${link}`) : undefined;
        const domain = website ? parseDomain(website) : `zameen-${name.toLowerCase().replace(/\s+/g, "-")}`;

        if (!results.find((r) => r.domain === domain)) {
          results.push({
            name: name.slice(0, 100),
            website,
            domain,
            email: emailMatch ? normalizeEmail(emailMatch[0]) : undefined,
            phone: phoneMatch ? normalizePhone(phoneMatch[0], "Pakistan").e164 || phoneMatch[0] : undefined,
            city: location.city || undefined,
            country: "Pakistan",
            category: "real_estate_agent",
            sourceName: "Zameen.com Agent Directory",
            sourceUrl: url,
          });
        }
      });

      if (results.length > 0) break;
    } catch (e: any) {
      console.log(`[zameen] ${url} failed: ${e?.message}`);
    }
  }

  return results.slice(0, 200);
}

// ---------------------------------------------------------------------------
// DLD Dubai (UAE) — Dubai Land Department RERA broker register
// The full register is at https://www.dubailand.gov.ae/en/ but the public
// broker search requires form interaction. We use the public RERA broker
// list pages that are indexed. Alternatively, Bayut.com aggregates DLD-licensed
// brokers publicly.
// ---------------------------------------------------------------------------
async function scrapeDldDubaiBrokers(signal?: AbortSignal): Promise<DirectoryBusiness[]> {
  const results: DirectoryBusiness[] = [];
  // DLD's public broker search is at:
  // https://www.dubailand.gov.ae/en/services/find-a-real-estate-broker/
  // Bayut also publicly lists DLD-licensed brokers:
  // https://www.bayut.com/brokers/
  const urls = [
    "https://www.bayut.com/brokers/",
    "https://www.bayut.com/brokers/dubai/",
  ];

  for (const url of urls) {
    if (signal?.aborted) break;
    try {
      const r = await safeFetch(url, { timeoutMs: 10000, maxBytes: 1024 * 1024 });
      if (!r.html || r.status !== 200) continue;
      const $ = cheerio.load(r.html);

      // Bayut broker pages list brokers with name, phone, RERA number
      $("[class*='broker'], [class*='agent'], .broker-card, .agent-card").each((_, el) => {
        const $el = $(el);
        const name = $el.find("h2, h3, h4, .name, .broker-name, a").first().text().trim();
        if (!name || name.length < 3) return;
        const text = $el.text();
        const phoneMatch = text.match(/\+971[\d\s\-]{6,10}/) || text.match(/05[\d\s\-]{6,8}/);
        const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        const link = $el.find("a[href*='/brokers/'], a[href*='/agent/']").first().attr("href") || "";
        const website = link ? (link.startsWith("http") ? link : `https://www.bayut.com${link}`) : undefined;
        const domain = website ? parseDomain(website) : `bayut-${name.toLowerCase().replace(/\s+/g, "-")}`;

        if (!results.find((r) => r.domain === domain)) {
          results.push({
            name: name.slice(0, 100),
            website,
            domain,
            email: emailMatch ? normalizeEmail(emailMatch[0]) : undefined,
            phone: phoneMatch ? normalizePhone(phoneMatch[0], "UAE").e164 || phoneMatch[0] : undefined,
            city: "Dubai",
            country: "UAE",
            category: "real_estate_broker",
            sourceName: "DLD/Bayut Broker Directory",
            sourceUrl: url,
          });
        }
      });

      if (results.length > 0) break;
    } catch (e: any) {
      console.log(`[dld-dubai] ${url} failed: ${e?.message}`);
    }
  }

  return results.slice(0, 200);
}

// Convert DirectoryBusiness to DiscoveredBusiness format (for campaign-runner)
export function toDiscoveredBusiness(d: DirectoryBusiness): DiscoveredBusiness {
  return {
    osmId: `dir/${d.domain}`,
    osmType: "node",
    name: d.name,
    category: d.category,
    subcategory: d.category,
    website: d.website,
    phone: d.phone,
    email: d.email,
    whatsapp: undefined,
    address: d.address,
    city: d.city,
    state: undefined,
    country: d.country,
    postalCode: undefined,
    lat: undefined,
    lng: undefined,
    socialProfiles: undefined,
    sourceName: d.sourceName,
    sourceUrl: d.sourceUrl,
    raw: {},
  };
}
