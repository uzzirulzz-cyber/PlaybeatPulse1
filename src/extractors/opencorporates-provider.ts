// OpenCorporates Discovery Provider — free company registry data
// Source: https://api.opencorporates.com (free tier: 500 calls/month, no key needed)
// 200M+ companies from public company registries worldwide.
// Good for Layer 1: company discovery (legal entities, jurisdictions).
import type { DiscoveryProvider, DiscoveryResult, DiscoveredCandidate } from "./index";
import { safeFetch, parseDomain } from "../lib/ssrf";
import type { LocationFilters, BusinessFilters } from "../lib/types";

const OPENCORPORATES_BASE = "https://api.opencorporates.com/v0.4";

export class OpenCorporatesProvider implements DiscoveryProvider {
  readonly name = "OpenCorporates";
  readonly type = "api" as const;
  readonly enabled = true;

  async discover(
    location: LocationFilters,
    business: BusinessFilters,
    opts: { maxResults?: number; signal?: AbortSignal } = {}
  ): Promise<DiscoveryResult> {
    const maxResults = opts.maxResults ?? 50;
    const candidates: DiscoveredCandidate[] = [];
    const apiKey = process.env.OPENCORPORATES_API_KEY;

    // Map country name to ISO code for jurisdiction filter
    const countryCode = countryToIso(location.country);
    const query = business.nature || business.industry || business.category || "";

    if (!query) {
      return { candidates, sourceName: this.name, exhausted: true, error: "No search query" };
    }

    try {
      // Search companies by name keyword + jurisdiction
      const params = new URLSearchParams({
        q: query,
        per_page: String(Math.min(30, maxResults)),
        order: "score",
      });
      if (countryCode) params.set("jurisdiction_code", countryCode.toLowerCase());
      if (apiKey) params.set("api_token", apiKey);

      const url = `${OPENCORPORATES_BASE}/companies/search?${params}`;
      console.log(`[opencorporates] searching: ${query} in ${countryCode || "all"}`);

      const res = await safeFetch(url, { timeoutMs: 10000, maxBytes: 512 * 1024 });
      if (res.status !== 200 || !res.html) {
        return { candidates, sourceName: this.name, exhausted: false, error: `HTTP ${res.status}` };
      }

      const data = JSON.parse(res.html);
      const companies = data?.results?.companies || [];

      for (const c of companies) {
        if (candidates.length >= maxResults) break;
        const company = c?.company;
        if (!company?.name) continue;

        const website = company?.website || undefined;
        const domain = website ? parseDomain(website) : `oc-${company.company_number}`;

        candidates.push({
          name: company.name,
          website,
          domain: domain || `oc-${company.company_number}`,
          city: company?.registered_address?.locality || location.city,
          state: company?.registered_address?.region || location.state,
          country: company?.jurisdiction_code?.toUpperCase() || location.country,
          category: business.nature || business.category,
          sourceName: this.name,
          sourceUrl: company?.registry_url || `https://opencorporates.com/companies/${company.jurisdiction_code}/${company.company_number}`,
          sourceType: "api",
          raw: {
            companyNumber: company.company_number,
            jurisdiction: company.jurisdiction_code,
            registryUrl: company.registry_url,
            registeredAddress: company.registered_address,
          },
        });
      }

      return {
        candidates,
        sourceName: this.name,
        exhausted: candidates.length < maxResults,
      };
    } catch (e: any) {
      return { candidates, sourceName: this.name, exhausted: false, error: e?.message };
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const r = await safeFetch(`${OPENCORPORATES_BASE}/companies/search?q=test&per_page=1`, { timeoutMs: 8000 });
      return { healthy: r.status === 200, message: r.status === 200 ? undefined : `HTTP ${r.status}` };
    } catch (e: any) {
      return { healthy: false, message: e?.message };
    }
  }
}

function countryToIso(country?: string): string | undefined {
  if (!country) return undefined;
  const map: Record<string, string> = {
    germany: "DE", pakistan: "PK", bangladesh: "BD", india: "IN",
    "united states": "US", usa: "US", "united kingdom": "GB", uk: "GB",
    uae: "AE", dubai: "AE", "saudi arabia": "SA", canada: "CA",
    australia: "AU", singapore: "SG", malaysia: "MY", indonesia: "ID",
    france: "FR", italy: "IT", spain: "ES", netherlands: "NL",
  };
  const c = country.toLowerCase().trim();
  return map[c] || (country.length === 2 ? country.toUpperCase() : undefined);
}
