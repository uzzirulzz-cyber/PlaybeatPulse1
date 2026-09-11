// Free Discovery Providers — no API key required, work immediately
// These add real business leads to the waterfall without any configuration.
import type { DiscoveryProvider, DiscoveryResult, DiscoveredCandidate } from "./index";
import { safeFetch, parseDomain } from "../lib/ssrf";
import { normalizeEmail } from "../lib/email";
import type { LocationFilters, BusinessFilters } from "../lib/types";

// ---------------------------------------------------------------------------
// Domainsdb.info — Registered domain names search (free, no auth)
// Good for discovering business websites by keyword
// ---------------------------------------------------------------------------
export class DomainsdbProvider implements DiscoveryProvider {
  readonly name = "Domainsdb.info";
  readonly type = "api" as const;
  readonly enabled = true;

  async discover(
    location: LocationFilters,
    business: BusinessFilters,
    opts: { maxResults?: number; signal?: AbortSignal } = {}
  ): Promise<DiscoveryResult> {
    const maxResults = opts.maxResults ?? 50;
    const candidates: DiscoveredCandidate[] = [];
    const query = business.nature || business.industry || business.category || "";
    const city = location.city || "";

    if (!query) return { candidates, sourceName: this.name, exhausted: true };

    try {
      // Search for domains matching the business keyword + city
      const searchQuery = city ? `${query} ${city}` : query;
      const url = `https://api.domainsdb.info/v1/domains/search?domain=${encodeURIComponent(searchQuery)}&limit=${Math.min(50, maxResults)}`;
      console.log(`[domainsdb] searching: ${searchQuery}`);

      const res = await safeFetch(url, { timeoutMs: 8000, maxBytes: 256 * 1024 });
      if (res.status !== 200 || !res.html) {
        return { candidates, sourceName: this.name, exhausted: false, error: `HTTP ${res.status}` };
      }

      const data = JSON.parse(res.html);
      const domains = data?.domains || [];

      for (const d of domains) {
        if (candidates.length >= maxResults) break;
        if (!d?.domain) continue;

        const domain = d.domain.toLowerCase();
        const website = `https://${domain}`;

        candidates.push({
          name: domain.split(".")[0].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
          website,
          domain,
          city: city || undefined,
          country: location.country || undefined,
          category: query,
          sourceName: this.name,
          sourceUrl: website,
          sourceType: "api",
          raw: { createDate: d.create_date, updateDate: d.update_date, isDead: d.isDead },
        });
      }

      return { candidates, sourceName: this.name, exhausted: candidates.length < maxResults };
    } catch (e: any) {
      return { candidates, sourceName: this.name, exhausted: false, error: e?.message };
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const r = await safeFetch("https://api.domainsdb.info/v1/domains/search?domain=test&limit=1", { timeoutMs: 5000 });
      return { healthy: r.status === 200 };
    } catch (e: any) {
      return { healthy: false, message: e?.message };
    }
  }
}

// ---------------------------------------------------------------------------
// USAspending.gov — US federal contracts/grants (free, no auth)
// Good for discovering US businesses with government contracts
// ---------------------------------------------------------------------------
export class USAspendingProvider implements DiscoveryProvider {
  readonly name = "USAspending.gov";
  readonly type = "api" as const;
  readonly enabled = true;

  async discover(
    location: LocationFilters,
    business: BusinessFilters,
    opts: { maxResults?: number; signal?: AbortSignal } = {}
  ): Promise<DiscoveryResult> {
    // Only relevant for US searches
    const country = (location.country || "").toLowerCase();
    if (country && !country.includes("us") && !country.includes("united states") && !country.includes("america")) {
      return { candidates: [], sourceName: this.name, exhausted: true, error: "US-only source" };
    }

    const maxResults = opts.maxResults ?? 30;
    const candidates: DiscoveredCandidate[] = [];
    const query = business.nature || business.industry || business.category || "";

    try {
      // Search for recipients of federal awards matching the business keyword
      const url = "https://api.usaspending.gov/api/v2/search/spending_by_award/";
      const body = JSON.stringify({
        filters: {
          award_type: ["A", "B", "C", "D"], // contracts
          recipient_search_text: query || undefined,
          place_of_performance_locations: location.state ? [{ state: location.state }] : undefined,
        },
        fields: ["Recipient Name", "Recipient UEI", "Award ID", "Award Amount", "recipient_address"],
        page: 1,
        limit: Math.min(30, maxResults),
        sort: "Award Amount",
        order: "desc",
      });

      const res = await safeFetch(url, {
        method: "POST",
        timeoutMs: 10000,
        maxBytes: 512 * 1024,
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (res.status !== 200 || !res.html) {
        return { candidates, sourceName: this.name, exhausted: false, error: `HTTP ${res.status}` };
      }

      const data = JSON.parse(res.html);
      const awards = data?.results || [];

      for (const a of awards) {
        if (candidates.length >= maxResults) break;
        const name = a["Recipient Name"];
        if (!name) continue;

        candidates.push({
          name,
          domain: `usaspending-${a["Recipient UEI"] || name.toLowerCase().replace(/\s+/g, "-")}`,
          city: a?.recipient_address?.city || location.city,
          state: a?.recipient_address?.state || location.state,
          country: "US",
          address: a?.recipient_address ? `${a.recipient_address.street || ""}, ${a.recipient_address.city || ""}, ${a.recipient_address.state || ""} ${a.recipient_address.zip || ""}`.trim() : undefined,
          category: query,
          sourceName: this.name,
          sourceUrl: `https://www.usaspending.gov/search/?hash=${a["Award ID"] || ""}`,
          sourceType: "api",
          raw: { uei: a["Recipient UEI"], awardAmount: a["Award Amount"] },
        });
      }

      return { candidates, sourceName: this.name, exhausted: candidates.length < maxResults };
    } catch (e: any) {
      return { candidates, sourceName: this.name, exhausted: false, error: e?.message };
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const r = await safeFetch("https://api.usaspending.gov/api/v2/references/toptier_agencies/", {
        method: "POST",
        timeoutMs: 5000,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      return { healthy: r.status === 200 };
    } catch (e: any) {
      return { healthy: false, message: e?.message };
    }
  }
}

// ---------------------------------------------------------------------------
// Pick an Agency — Search marketing agencies (free, no auth, CORS enabled)
// ---------------------------------------------------------------------------
export class PickAnAgencyProvider implements DiscoveryProvider {
  readonly name = "Pick an Agency";
  readonly type = "directory" as const;
  readonly enabled = true;

  async discover(
    location: LocationFilters,
    business: BusinessFilters,
    opts: { maxResults?: number; signal?: AbortSignal } = {}
  ): Promise<DiscoveryResult> {
    // Only relevant for agency/marketing searches
    const nature = (business.nature || business.industry || business.category || "").toLowerCase();
    if (!nature.includes("agency") && !nature.includes("marketing") && !nature.includes("advertis")) {
      return { candidates: [], sourceName: this.name, exhausted: true, error: "Agency-only source" };
    }

    const maxResults = opts.maxResults ?? 30;
    const candidates: DiscoveredCandidate[] = [];

    try {
      // The API is at https://www.pickanagency.com/developers
      // Search agencies by service + location
      const params = new URLSearchParams();
      if (business.nature) params.set("service", business.nature);
      if (location.city) params.set("city", location.city);
      if (location.country) params.set("country", location.country);
      params.set("limit", String(maxResults));

      const url = `https://www.pickanagency.com/api/agencies?${params}`;
      const res = await safeFetch(url, { timeoutMs: 8000, maxBytes: 256 * 1024 });

      if (res.status !== 200 || !res.html) {
        return { candidates, sourceName: this.name, exhausted: false, error: `HTTP ${res.status}` };
      }

      const data = JSON.parse(res.html);
      const agencies = data?.agencies || data?.data || [];

      for (const a of agencies) {
        if (candidates.length >= maxResults) break;
        if (!a?.name) continue;

        const website = a.website || a.url || undefined;
        const domain = website ? parseDomain(website) : `paa-${a.id || a.name.toLowerCase().replace(/\s+/g, "-")}`;

        candidates.push({
          name: a.name,
          website,
          domain: domain || `paa-${a.id}`,
          email: a.email ? normalizeEmail(a.email) : undefined,
          phone: a.phone || undefined,
          city: a.city || location.city,
          country: a.country || location.country,
          address: a.address || undefined,
          category: "marketing_agency",
          socialProfiles: a.social ? { facebook: a.social.facebook, instagram: a.social.instagram, linkedin: a.social.linkedin } : undefined,
          sourceName: this.name,
          sourceUrl: a.profile_url || `https://www.pickanagency.com/agency/${a.id || ""}`,
          sourceType: "directory",
          raw: { id: a.id, rating: a.rating, services: a.services },
        });
      }

      return { candidates, sourceName: this.name, exhausted: candidates.length < maxResults };
    } catch (e: any) {
      return { candidates, sourceName: this.name, exhausted: false, error: e?.message };
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    return { healthy: true };
  }
}

// ---------------------------------------------------------------------------
// TradeDataHub — US contractor datasets (free, no auth, CORS enabled)
// ---------------------------------------------------------------------------
export class TradeDataHubProvider implements DiscoveryProvider {
  readonly name = "TradeDataHub";
  readonly type = "api" as const;
  readonly enabled = true;

  async discover(
    location: LocationFilters,
    business: BusinessFilters,
    opts: { maxResults?: number; signal?: AbortSignal } = {}
  ): Promise<DiscoveryResult> {
    const maxResults = opts.maxResults ?? 30;
    const candidates: DiscoveredCandidate[] = [];
    const query = business.nature || business.industry || business.category || "";

    try {
      const params = new URLSearchParams({ q: query, limit: String(maxResults) });
      if (location.state) params.set("state", location.state);
      const url = `https://www.tradedatahub.net/api/discovery?${params}`;
      const res = await safeFetch(url, { timeoutMs: 8000, maxBytes: 256 * 1024 });

      if (res.status !== 200 || !res.html) {
        return { candidates, sourceName: this.name, exhausted: false, error: `HTTP ${res.status}` };
      }

      const data = JSON.parse(res.html);
      const contractors = data?.results || data?.data || [];

      for (const c of contractors) {
        if (candidates.length >= maxResults) break;
        if (!c?.name && !c?.company) continue;
        const name = c.name || c.company;
        const website = c.website || c.url || undefined;
        const domain = website ? parseDomain(website) : `tdh-${name.toLowerCase().replace(/\s+/g, "-")}`;

        candidates.push({
          name,
          website,
          domain: domain || `tdh-${name}`,
          phone: c.phone || undefined,
          city: c.city || location.city,
          state: c.state || location.state,
          country: "US",
          address: c.address || undefined,
          category: "contractor",
          sourceName: this.name,
          sourceUrl: c.profile_url || "https://www.tradedatahub.net",
          sourceType: "api",
        });
      }

      return { candidates, sourceName: this.name, exhausted: candidates.length < maxResults };
    } catch (e: any) {
      return { candidates, sourceName: this.name, exhausted: false, error: e?.message };
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    return { healthy: true };
  }
}
