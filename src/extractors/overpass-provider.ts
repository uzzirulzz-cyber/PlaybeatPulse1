// OverpassDiscoveryProvider — OpenStreetMap Overpass API adapter
import type { DiscoveryProvider, DiscoveryResult, DiscoveredCandidate } from "./index";
import { buildOverpassQuery, runOverpassQuery, elementToBusiness, tagsForNature, allTagsForNature } from "../lib/overpass";
import { geocodeLocation } from "../lib/overpass";
import { parseDomain } from "../lib/ssrf";
import type { LocationFilters, BusinessFilters } from "../lib/types";

export class OverpassDiscoveryProvider implements DiscoveryProvider {
  readonly name = "OpenStreetMap Overpass";
  readonly type = "overpass" as const;
  readonly enabled = true;

  async discover(
    location: LocationFilters,
    business: BusinessFilters,
    opts: { maxResults?: number; signal?: AbortSignal } = {}
  ): Promise<DiscoveryResult> {
    const maxResults = opts.maxResults ?? 200;
    const candidates: DiscoveredCandidate[] = [];

    try {
      // Geocode location (3s timeout)
      let area: any = null;
      try {
        const geoPromise = geocodeLocation(location);
        const timeoutPromise = new Promise<null>((r) => setTimeout(() => r(null), 3000));
        area = await Promise.race([geoPromise, timeoutPromise]);
      } catch { /* non-fatal */ }

      const nature = business.nature || business.industry || business.category || "";
      const { tags, specific } = tagsForNature(nature);
      const fullTags = specific ? allTagsForNature(nature) : tags;

      // Shrink bbox for large cities
      let queryBbox: [number, number, number, number] | null = null;
      if (area) {
        const [s, n, w, e] = area.boundingBox;
        const maxSpan = 0.3;
        const cLat = (s + n) / 2;
        const cLon = (w + e) / 2;
        const halfLat = Math.min((n - s) / 2, maxSpan / 2);
        const halfLon = Math.min((e - w) / 2, maxSpan / 2);
        queryBbox = [cLat - halfLat, cLon - halfLon, cLat + halfLat, cLon + halfLon];
      }

      // Try each tag individually
      for (const tag of fullTags.slice(0, 3)) {
        if (candidates.length >= maxResults) break;
        let q = "";
        if (queryBbox) {
          q = buildOverpassQuery({ bbox: queryBbox, tags: [tag], limit: Math.min(300, maxResults * 2) });
        } else {
          const areaName = location.city || location.area || location.state;
          if (areaName) q = buildOverpassQuery({ areaName, tags: [tag], limit: Math.min(300, maxResults * 2) });
        }
        if (!q) continue;
        try {
          const elements = await runOverpassQuery(q, { timeoutMs: 15000, maxEndpoints: 3, signal: opts.signal });
          const seenOsmIds = new Set(candidates.map(c => c.raw?.osmId));
          for (const el of elements) {
            if (candidates.length >= maxResults) break;
            const b = elementToBusiness(el, area?.country || location.country);
            if (b && !seenOsmIds.has(b.osmId)) {
              seenOsmIds.add(b.osmId);
              candidates.push({
                name: b.name,
                website: b.website,
                domain: b.website ? parseDomain(b.website) || b.sourceUrl : b.sourceUrl,
                email: b.email,
                phone: b.phone,
                whatsapp: b.whatsapp,
                address: b.address,
                city: b.city,
                state: b.state,
                country: b.country,
                postalCode: b.postalCode,
                lat: b.lat,
                lng: b.lng,
                category: b.category,
                subcategory: b.subcategory,
                socialProfiles: b.socialProfiles,
                sourceName: b.sourceName,
                sourceUrl: b.sourceUrl,
                sourceType: "overpass",
                raw: { osmId: b.osmId, osmType: b.osmType },
              });
            }
          }
        } catch (e: any) {
          // continue to next tag
        }
      }
    } catch (e: any) {
      return { candidates, sourceName: this.name, exhausted: false, error: e?.message };
    }

    return { candidates, sourceName: this.name, exhausted: candidates.length < maxResults };
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const q = '[out:json][timeout:5];node["amenity"="cafe"](52.5,13.3,52.6,13.5);out center 1;';
      const els = await runOverpassQuery(q, { timeoutMs: 8000, maxEndpoints: 1 });
      return { healthy: els.length >= 0 };
    } catch (e: any) {
      return { healthy: false, message: e?.message };
    }
  }
}
