// PlayBeat — Source Adapter Architecture
// Formal provider interfaces for the multi-source discovery pipeline.
// Each source type implements its own adapter. New sources can be added
// without rewriting the application.

import type { LocationFilters, BusinessFilters } from "../lib/types";

// A discovered business candidate (before enrichment/scoring)
export interface DiscoveredCandidate {
  name: string;
  website?: string;
  domain: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  lat?: number;
  lng?: number;
  category?: string;
  subcategory?: string;
  socialProfiles?: Record<string, string>;
  sourceName: string;
  sourceUrl: string;
  sourceType: string;
  raw?: Record<string, any>;
}

// Result of a discovery operation
export interface DiscoveryResult {
  candidates: DiscoveredCandidate[];
  sourceName: string;
  exhausted: boolean; // true if this source has no more results
  error?: string;
}

// ---------------------------------------------------------------------------
// Discovery Provider — finds business candidates from a source
// Implementations: OverpassProvider, WebSearchProvider, DirectoryProvider
// ---------------------------------------------------------------------------
export interface DiscoveryProvider {
  readonly name: string;
  readonly type: "overpass" | "websearch" | "directory" | "api" | "dataset";
  readonly enabled: boolean;

  discover(
    location: LocationFilters,
    business: BusinessFilters,
    opts: { maxResults?: number; signal?: AbortSignal }
  ): Promise<DiscoveryResult>;

  healthCheck(): Promise<{ healthy: boolean; message?: string }>;
}

// ---------------------------------------------------------------------------
// Website Provider — fetches and analyzes a business website's public pages
// Implementation: WebsiteContactAnalyzer (uses safeFetch — SSRF-protected)
// ---------------------------------------------------------------------------
export interface WebsiteAnalysisResult {
  url: string;
  status: "ok" | "fetch_failed" | "blocked" | "empty";
  emails: ExtractedContact[];
  whatsapps: ExtractedContact[];
  phones: ExtractedContact[];
  socials: ExtractedContact[];
  pagesAnalyzed: number;
  title?: string;
  siteMentionsWhatsApp: boolean;
  error?: string;
}

export interface ExtractedContact {
  type: "email" | "whatsapp" | "phone" | "social";
  value: string;
  raw: string;
  confidence: number; // 0-100
  quality?: "high" | "medium" | "low";
  sourceUrl: string;
  pageSection: string;
  evidence: string;
}

export interface WebsiteProvider {
  readonly name: string;
  analyze(
    url: string,
    opts: { defaultCountry?: string; maxPages?: number; timeoutMs?: number }
  ): Promise<WebsiteAnalysisResult>;
}

// ---------------------------------------------------------------------------
// Email Validator — validates email addresses
// Implementation: EmailValidatorImpl (syntax, disposable, free-provider, business-domain)
// ---------------------------------------------------------------------------
export interface EmailValidationResult {
  email: string;
  syntaxValid: boolean;
  normalized: boolean;
  disposable: boolean;
  freeProvider: boolean;
  businessDomain: boolean;
  domainValid?: boolean;
  quality: "high" | "medium" | "low";
  confidence: number; // 0-100
}

export interface EmailValidator {
  validate(email: string, domainValid?: boolean): EmailValidationResult;
  normalize(email: string): string | null;
  isPlaceholder(email: string): boolean;
}

// ---------------------------------------------------------------------------
// Phone Parser — normalizes phone numbers to E.164
// Implementation: PhoneParserImpl (uses libphonenumber-js)
// ---------------------------------------------------------------------------
export interface ParsedPhone {
  e164: string | null;
  countryCode: string | null;
  nationalNumber: string | null;
  input: string;
  valid: boolean;
  country?: string;
}

export interface PhoneParser {
  parse(input: string, defaultCountry?: string): ParsedPhone;
  detectWhatsApp(html: string, defaultCountry?: string): WhatsAppEvidence[];
}

export interface WhatsAppEvidence {
  phone: string;
  raw: string;
  e164: string | null;
  confidence: number;
  source: string;
}

// ---------------------------------------------------------------------------
// Provider Registry — manages all registered providers
// ---------------------------------------------------------------------------
export interface ProviderRegistry {
  discovery: DiscoveryProvider[];
  website: WebsiteProvider;
  emailValidator: EmailValidator;
  phoneParser: PhoneParser;
}

// Factory: build the default registry with all configured providers
export async function buildProviderRegistry(): Promise<ProviderRegistry> {
  const { OverpassDiscoveryProvider } = await import("./overpass-provider");
  const { WebSearchDiscoveryProvider } = await import("./websearch-provider");
  const { DirectoryDiscoveryProvider } = await import("./directory-provider");
  const { WebsiteContactAnalyzerProvider } = await import("./website-provider");
  const { EmailValidatorImpl } = await import("./email-validator");
  const { PhoneParserImpl } = await import("./phone-parser");

  return {
    discovery: [
      new OverpassDiscoveryProvider(),
      new DirectoryDiscoveryProvider(),
      new WebSearchDiscoveryProvider(),
    ],
    website: new WebsiteContactAnalyzerProvider(),
    emailValidator: new EmailValidatorImpl(),
    phoneParser: new PhoneParserImpl(),
  };
}
