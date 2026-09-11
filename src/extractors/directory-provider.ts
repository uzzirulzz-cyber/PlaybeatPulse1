// DirectoryDiscoveryProvider — free public directory adapter
import type { DiscoveryProvider, DiscoveryResult, DiscoveredCandidate } from "./index";
import { discoverFromDirectories } from "../lib/directories";
import type { LocationFilters, BusinessFilters } from "../lib/types";

export class DirectoryDiscoveryProvider implements DiscoveryProvider {
  readonly name = "Public Directories (REHAB/Zameen/DLD)";
  readonly type = "directory" as const;
  readonly enabled = true;

  async discover(
    location: LocationFilters,
    business: BusinessFilters,
    opts: { maxResults?: number; signal?: AbortSignal } = {}
  ): Promise<DiscoveryResult> {
    try {
      const results = await discoverFromDirectories(location, business, {
        maxResults: opts.maxResults ?? 100,
        signal: opts.signal,
      });
      const candidates: DiscoveredCandidate[] = results.map(d => ({
        name: d.name,
        website: d.website,
        domain: d.domain,
        email: d.email,
        phone: d.phone,
        whatsapp: d.whatsapp,
        city: d.city,
        country: d.country,
        category: d.category,
        sourceName: d.sourceName,
        sourceUrl: d.sourceUrl,
        sourceType: "directory",
      }));
      return { candidates, sourceName: this.name, exhausted: true };
    } catch (e: any) {
      return { candidates: [], sourceName: this.name, exhausted: false, error: e?.message };
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    return { healthy: true };
  }
}
