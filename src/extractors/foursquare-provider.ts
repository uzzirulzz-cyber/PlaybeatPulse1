// Foursquare Places Discovery Provider — global places/business discovery
// Source: https://developer.foursquare.com (free tier: 100k calls/month with API key)
// Good for Layer 1: local business discovery worldwide.
import type { DiscoveryProvider, DiscoveryResult, DiscoveredCandidate } from "./index";
import { safeFetch, parseDomain } from "../lib/ssrf";
import { geocodeLocation } from "../lib/overpass";
import type { LocationFilters, BusinessFilters } from "../lib/types";

const FOURSQUARE_BASE = "https://api.foursquare.com/v3";

// Map business nature to Foursquare category IDs
const NATURE_TO_FSQ_CATEGORIES: Record<string, string> = {
  restaurant: "13065", // Restaurant
  cafe: "13032", // Café
  hotel: "19014", // Hotel
  bar: "13003", // Bar
  gym: "18021", // Gym
  salon: "11020", // Salon
  dentist: "11092", // Dentist
  doctor: "11095", // Doctor
  pharmacy: "11099", // Pharmacy
  bank: "11015", // Bank
  school: "12057", // School
  law: "11067", // Lawyer
  real_estate: "11068", // Real Estate
  accounting: "11070", // Accountant
  agency: "11066", // Advertising Agency
};

export class FoursquareProvider implements DiscoveryProvider {
  readonly name = "Foursquare Places";
  readonly type = "api" as const;
  readonly enabled = !!process.env.FOURSQUARE_API_KEY;

  async discover(
    location: LocationFilters,
    business: BusinessFilters,
    opts: { maxResults?: number; signal?: AbortSignal } = {}
  ): Promise<DiscoveryResult> {
    const apiKey = process.env.FOURSQUARE_API_KEY;
    if (!apiKey) {
      return { candidates: [], sourceName: this.name, exhausted: true, error: "FOURSQUARE_API_KEY not set" };
    }

    const maxResults = opts.maxResults ?? 50;
    const candidates: DiscoveredCandidate[] = [];

    try {
      // Geocode the location
      const area = await geocodeLocation(location);
      if (!area) {
        return { candidates, sourceName: this.name, exhausted: true, error: "Could not geocode location" };
      }

      const nature = (business.nature || business.industry || business.category || "").toLowerCase();
      const categoryId = NATURE_TO_FSQ_CATEGORIES[nature] || undefined;

      const params = new URLSearchParams({
        ll: `${area.lat},${area.lng}`,
        radius: "10000",
        limit: String(Math.min(50, maxResults)),
        sort: "RATING",
      });
      if (categoryId) params.set("categories", categoryId);

      const url = `${FOURSQUARE_BASE}/places/search?${params}`;
      console.log(`[foursquare] searching ${nature} near ${area.lat},${area.lng}`);

      const res = await safeFetch(url, {
        timeoutMs: 10000,
        maxBytes: 512 * 1024,
        headers: { Authorization: apiKey },
      });

      if (res.status !== 200 || !res.html) {
        return { candidates, sourceName: this.name, exhausted: false, error: `HTTP ${res.status}` };
      }

      const data = JSON.parse(res.html);
      const places = data?.results || [];

      for (const p of places) {
        if (candidates.length >= maxResults) break;
        if (!p?.name) continue;

        const website = p?.link || undefined;
        const domain = website ? parseDomain(website) : `fsq-${p.fsq_id}`;
        const loc = p?.location || {};

        candidates.push({
          name: p.name,
          website,
          domain: domain || `fsq-${p.fsq_id}`,
          phone: p?.tel || undefined,
          city: loc.locality || location.city,
          state: loc.region || location.state,
          country: loc.country || location.country,
          postalCode: loc.postcode || location.postal,
          address: loc.formatted_address || undefined,
          lat: p?.geocodes?.main?.latitude,
          lng: p?.geocodes?.main?.longitude,
          category: nature,
          sourceName: this.name,
          sourceUrl: `https://foursquare.com/v/${p.fsq_id}`,
          sourceType: "api",
          raw: { fsqId: p.fsq_id, categories: p.categories },
        });
      }

      return { candidates, sourceName: this.name, exhausted: candidates.length < maxResults };
    } catch (e: any) {
      return { candidates, sourceName: this.name, exhausted: false, error: e?.message };
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!process.env.FOURSQUARE_API_KEY) return { healthy: false, message: "No API key" };
    try {
      const r = await safeFetch(`${FOURSQUARE_BASE}/places/search?ll=52.5,13.4&limit=1`, {
        timeoutMs: 8000,
        headers: { Authorization: process.env.FOURSQUARE_API_KEY },
      });
      return { healthy: r.status === 200 };
    } catch (e: any) {
      return { healthy: false, message: e?.message };
    }
  }
}
