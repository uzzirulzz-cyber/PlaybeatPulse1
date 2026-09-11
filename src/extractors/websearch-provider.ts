// WebSearchDiscoveryProvider — z-ai web search adapter
import type { DiscoveryProvider, DiscoveryResult, DiscoveredCandidate } from "./index";
import { discoverBusinessesViaSearch } from "../lib/websearch";
import { parseDomain } from "../lib/ssrf";
import type { LocationFilters, BusinessFilters } from "../lib/types";

export class WebSearchDiscoveryProvider implements DiscoveryProvider {
  readonly name = "Web Search (z-ai)";
  readonly type = "websearch" as const;
  readonly enabled = true;

  async discover(
    location: LocationFilters,
    business: BusinessFilters,
    opts: { maxResults?: number; signal?: AbortSignal } = {}
  ): Promise<DiscoveryResult> {
    try {
      const results = await discoverBusinessesViaSearch(business, location, {
        perQuery: 10,
        maxResults: opts.maxResults ?? 50,
      });
      const candidates: DiscoveredCandidate[] = results.map(r => ({
        name: r.name,
        website: r.website,
        domain: r.domain,
        email: r.snippetEmails[0],
        phone: r.snippetPhones[0],
        whatsapp: r.snippetWhatsapps[0],
        city: location.city,
        country: location.country,
        category: business.nature || business.category,
        sourceName: r.sourceName,
        sourceUrl: r.sourceUrl,
        sourceType: "websearch",
      }));
      return { candidates, sourceName: this.name, exhausted: candidates.length < (opts.maxResults ?? 50) };
    } catch (e: any) {
      return { candidates: [], sourceName: this.name, exhausted: false, error: e?.message };
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    // Best-effort — the z-ai API uses internal IPs that may not be reachable from all environments
    return { healthy: true, message: "Best-effort (internal API)" };
  }
}
