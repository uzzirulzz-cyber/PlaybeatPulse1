// PlayBeat — Waterfall Discovery Orchestrator
// Implements the multi-source waterfall architecture:
//
// Layer 1: Discover businesses
//   OpenCorporates → Foursquare → OpenStreetMap → Directories → Web Search
//
// Layer 2: Enrich (if API keys configured)
//   Hunter → Apollo → Snov
//
// Layer 3: Website extraction (already in campaign-runner)
// Layer 4: Email validation (already in campaign-runner)
// Layer 5: WhatsApp detection (already in campaign-runner)
// Layer 6: Deduplication (already in campaign-runner)
// Layer 7: Lead scoring (already in campaign-runner)
// Layer 8: Export (already in campaign-runner)
//
// The waterfall tries sources in priority order. If a source returns enough
// results, it stops. If not, it falls through to the next source. This gives
// the best chance of reaching 1,000+ unique records.
import type { DiscoveryProvider, DiscoveryResult, DiscoveredCandidate } from "./index";
import { OverpassDiscoveryProvider } from "./overpass-provider";
import { WebSearchDiscoveryProvider } from "./websearch-provider";
import { DirectoryDiscoveryProvider } from "./directory-provider";
import { OpenCorporatesProvider } from "./opencorporates-provider";
import { FoursquareProvider } from "./foursquare-provider";
import { DomainsdbProvider, USAspendingProvider, PickAnAgencyProvider, TradeDataHubProvider } from "./free-discovery-providers";
import { getEnrichmentProviders, type EnrichmentProvider } from "./enrichment-providers";
import { parseDomain } from "../lib/ssrf";
import type { LocationFilters, BusinessFilters } from "../lib/types";

export interface WaterfallResult {
  candidates: DiscoveredCandidate[];
  sourcesTried: { name: string; found: number; error?: string; enabled: boolean }[];
  totalFound: number;
  exhausted: boolean;
}

// Build the discovery provider waterfall in priority order
export function buildDiscoveryWaterfall(): DiscoveryProvider[] {
  return [
    new OpenCorporatesProvider(),    // company registry (free, 200M+ companies)
    new FoursquareProvider(),         // places (free tier, if API key set)
    new OverpassDiscoveryProvider(),  // OpenStreetMap (free, always works)
    new DomainsdbProvider(),          // domain search (free, no auth)
    new USAspendingProvider(),        // US federal contracts (free, no auth)
    new PickAnAgencyProvider(),       // marketing agencies (free, no auth)
    new TradeDataHubProvider(),       // US contractors (free, no auth)
    new DirectoryDiscoveryProvider(), // REHAB/Zameen/DLD (free)
    new WebSearchDiscoveryProvider(), // web search (free, sandbox only)
  ];
}

// Run the waterfall — try each provider in order until target is reached or all exhausted
export async function runDiscoveryWaterfall(
  location: LocationFilters,
  business: BusinessFilters,
  opts: { target: number; signal?: AbortSignal }
): Promise<WaterfallResult> {
  const providers = buildDiscoveryWaterfall();
  const candidates: DiscoveredCandidate[] = [];
  const seenKeys = new Set<string>(); // dedup within discovery
  const sourcesTried: WaterfallResult["sourcesTried"] = [];

  for (const provider of providers) {
    if (opts.signal?.aborted) break;
    if (candidates.length >= opts.target) break;

    const sourceInfo = { name: provider.name, found: 0, enabled: provider.enabled };

    if (!provider.enabled) {
      sourceInfo.error = "disabled (no API key)";
      sourcesTried.push(sourceInfo);
      continue;
    }

    try {
      console.log(`[waterfall] trying ${provider.name} (have ${candidates.length}/${opts.target})...`);
      const remaining = opts.target - candidates.length;
      const result: DiscoveryResult = await provider.discover(location, business, {
        maxResults: Math.min(remaining * 2, 300), // over-fetch for dedup
        signal: opts.signal,
      });

      // Dedup within the waterfall (by domain + osmId)
      for (const c of result.candidates) {
        if (candidates.length >= opts.target * 2) break;
        const key = c.domain || c.name.toLowerCase();
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        candidates.push(c);
      }

      sourceInfo.found = result.candidates.length;
      if (result.error) sourceInfo.error = result.error;

      console.log(`[waterfall] ${provider.name} returned ${result.candidates.length}, total now ${candidates.length}`);

      if (result.exhausted && result.candidates.length === 0) {
        // Source had no results — continue to next
      }
    } catch (e: any) {
      sourceInfo.error = e?.message;
      console.log(`[waterfall] ${provider.name} failed: ${e?.message}`);
    }

    sourcesTried.push(sourceInfo);
  }

  return {
    candidates,
    sourcesTried,
    totalFound: candidates.length,
    exhausted: candidates.length < opts.target,
  };
}

// Run enrichment on a batch of candidates (Layer 2)
export async function runEnrichmentBatch(
  candidates: DiscoveredCandidate[],
  opts: { maxEnrich?: number; signal?: AbortSignal }
): Promise<{ enriched: number; results: Map<string, { email?: string; confidence?: number; phone?: string; verified?: boolean; source: string }> }> {
  const enrichmentProviders = getEnrichmentProviders();
  const results = new Map<string, { email?: string; confidence?: number; phone?: string; verified?: boolean; source: string }>();

  if (enrichmentProviders.length === 0) {
    return { enriched: 0, results };
  }

  const maxEnrich = opts.maxEnrich ?? 50; // cap to avoid burning API credits
  let enriched = 0;

  for (const candidate of candidates.slice(0, maxEnrich)) {
    if (opts.signal?.aborted) break;
    if (candidate.email) continue; // already has email — skip enrichment

    for (const provider of enrichmentProviders) {
      if (opts.signal?.aborted) break;
      try {
        const result = await provider.enrich(candidate);
        if (result.enrichedEmail) {
          results.set(candidate.domain, {
            email: result.enrichedEmail,
            confidence: result.enrichedEmailConfidence,
            phone: result.enrichedPhone,
            verified: result.verified,
            source: result.source,
          });
          enriched++;
          break; // got an email — stop trying other enrichment providers
        }
      } catch {
        // continue to next provider
      }
    }
  }

  return { enriched, results };
}
