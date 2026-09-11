// Enrichment Providers — Layer 2 enrichment adapters
// These providers enrich discovered businesses with verified emails/phones.
// They require API keys (free tiers available). When no key is configured,
// they gracefully skip (return the candidate unchanged).
//
// Supported:
// - Hunter.io (free: 25 searches/month) — domain email discovery + verification
// - Apollo.io (free: 10 credits/month) — B2B email + phone enrichment
// - Snov.io (free: 50 credits/month) — email finding + verification
import type { DiscoveredCandidate } from "./index";
import { safeFetch } from "../lib/ssrf";
import { normalizeEmail, validateEmail } from "../lib/email";

export interface EnrichmentResult {
  candidate: DiscoveredCandidate;
  enrichedEmail?: string;
  enrichedEmailConfidence?: number;
  enrichedPhone?: string;
  verified?: boolean;
  source: string;
}

export interface EnrichmentProvider {
  readonly name: string;
  readonly enabled: boolean;
  enrich(candidate: DiscoveredCandidate): Promise<EnrichmentResult>;
}

// ---------------------------------------------------------------------------
// Hunter.io — domain email discovery
// Finds the most common email pattern for a domain + verifies individual emails
// ---------------------------------------------------------------------------
export class HunterEnrichmentProvider implements EnrichmentProvider {
  readonly name = "Hunter.io";
  readonly enabled = !!process.env.HUNTER_API_KEY;

  async enrich(candidate: DiscoveredCandidate): Promise<EnrichmentResult> {
    if (!process.env.HUNTER_API_KEY || !candidate.domain) {
      return { candidate, source: this.name };
    }

    try {
      // Domain search — find the most common email pattern
      const url = `https://api.hunter.io/v2/domain-search?domain=${candidate.domain}&api_key=${process.env.HUNTER_API_KEY}&limit=5`;
      const res = await safeFetch(url, { timeoutMs: 8000, maxBytes: 256 * 1024 });
      if (res.status !== 200 || !res.html) return { candidate, source: this.name };

      const data = JSON.parse(res.html);
      const emails = data?.data?.emails || [];
      if (emails.length === 0) return { candidate, source: this.name };

      // Pick the best email (highest confidence, prefer role-based)
      const sorted = emails.sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0));
      const best = sorted[0];
      const email = normalizeEmail(best.value);
      if (!email) return { candidate, source: this.name };

      return {
        candidate,
        enrichedEmail: email,
        enrichedEmailConfidence: best.confidence || 70,
        verified: best.verification?.status === "valid",
        source: this.name,
      };
    } catch {
      return { candidate, source: this.name };
    }
  }
}

// ---------------------------------------------------------------------------
// Apollo.io — B2B email + phone enrichment
// ---------------------------------------------------------------------------
export class ApolloEnrichmentProvider implements EnrichmentProvider {
  readonly name = "Apollo.io";
  readonly enabled = !!process.env.APOLLO_API_KEY;

  async enrich(candidate: DiscoveredCandidate): Promise<EnrichmentResult> {
    if (!process.env.APOLLO_API_KEY || !candidate.domain) {
      return { candidate, source: this.name };
    }

    try {
      // Apollo enrichment API — search for people at this company domain
      const res = await safeFetch("https://api.apollo.io/v1/people/match", {
        method: "POST",
        timeoutMs: 10000,
        maxBytes: 256 * 1024,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "X-Api-Key": process.env.APOLLO_API_KEY,
        },
        body: JSON.stringify({
          organization_domain: candidate.domain,
          page_size: 5,
        }),
      });

      if (res.status !== 200 || !res.html) return { candidate, source: this.name };

      const data = JSON.parse(res.html);
      const people = data?.people || [];
      if (people.length === 0) return { candidate, source: this.name };

      // Pick the first person with an email
      const person = people.find((p: any) => p.email);
      if (!person?.email) return { candidate, source: this.name };

      const email = normalizeEmail(person.email);
      if (!email) return { candidate, source: this.name };

      return {
        candidate,
        enrichedEmail: email,
        enrichedEmailConfidence: person.email_status === "verified" ? 90 : 65,
        enrichedPhone: person.phone || undefined,
        verified: person.email_status === "verified",
        source: this.name,
      };
    } catch {
      return { candidate, source: this.name };
    }
  }
}

// ---------------------------------------------------------------------------
// Snov.io — email finding + verification
// ---------------------------------------------------------------------------
export class SnovEnrichmentProvider implements EnrichmentProvider {
  readonly name = "Snov.io";
  readonly enabled = !!process.env.SNOV_CLIENT_ID && !!process.env.SNOV_CLIENT_SECRET;

  async enrich(candidate: DiscoveredCandidate): Promise<EnrichmentResult> {
    if (!this.enabled || !candidate.domain) {
      return { candidate, source: this.name };
    }

    try {
      // Snov requires OAuth — get access token first
      const tokenRes = await safeFetch("https://api.snov.io/v1/oauth/access_token", {
        method: "POST",
        timeoutMs: 8000,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_id: process.env.SNOV_CLIENT_ID,
          client_secret: process.env.SNOV_CLIENT_SECRET,
        }),
      });

      if (tokenRes.status !== 200 || !tokenRes.html) return { candidate, source: this.name };
      const tokenData = JSON.parse(tokenRes.html);
      const accessToken = tokenData?.access_token;
      if (!accessToken) return { candidate, source: this.name };

      // Search for emails at this domain
      const searchRes = await safeFetch("https://api.snov.io/v1/domain-search", {
        method: "POST",
        timeoutMs: 8000,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ domain: candidate.domain, type: "all", limit: 5 }),
      });

      if (searchRes.status !== 200 || !searchRes.html) return { candidate, source: this.name };
      const searchData = JSON.parse(searchRes.html);
      const emails = searchData?.emails || [];
      if (emails.length === 0) return { candidate, source: this.name };

      const best = emails[0];
      const email = normalizeEmail(best.email);
      if (!email) return { candidate, source: this.name };

      return {
        candidate,
        enrichedEmail: email,
        enrichedEmailConfidence: best.status === "valid" ? 85 : 60,
        verified: best.status === "valid",
        source: this.name,
      };
    } catch {
      return { candidate, source: this.name };
    }
  }
}

// Get all configured enrichment providers (only returns enabled ones)
export function getEnrichmentProviders(): EnrichmentProvider[] {
  const providers = [
    new HunterEnrichmentProvider(),
    new ApolloEnrichmentProvider(),
    new SnovEnrichmentProvider(),
  ];
  return providers.filter(p => p.enabled);
}
