// LeadPulse — In-process campaign runner (batch processing)
// Processes campaigns in small batches via /api/worker/tick, polled by the frontend.
// This runs inside the persistent Next.js process — no separate worker process needed.
// Each tick processes a time-bounded batch of businesses, then returns progress.
import { db } from "./db";
import { geocodeLocation, buildOverpassQuery, runOverpassQuery, elementToBusiness, tagsForNature, allTagsForNature, type DiscoveredBusiness } from "./overpass";
import { discoverBusinessesViaSearch } from "./websearch";
import { discoverFromDirectories, toDiscoveredBusiness } from "./directories";
import { runDiscoveryWaterfall, runEnrichmentBatch } from "../src/extractors/waterfall";
import { analyzeWebsite } from "./website";
import { normalizePhone } from "./phone";
import { normalizeEmail, validateEmail, isBusinessDomain, domainFromEmail } from "./email";
import { scoreFromRaw } from "./scoring";
import { DupIndex, buildDupKey } from "./dedup";
import { parseDomain } from "./ssrf";
import { getScoringConfig, getCampaignLimits } from "./settings";
import { heartbeat, recordBotRun } from "./bots";
import type { CampaignStats, LocationFilters, BusinessFilters, ContactFilters, QualityFilters } from "./types";

// In-memory cache of discovered businesses per campaign (survives across ticks
// within the same server process). Keyed by campaignId.
interface CampaignState {
  businesses: DiscoveredBusiness[];
  index: number; // next business to process
  dupIndex: DupIndex;
  suppression: {
    emails: Set<string>; phones: Set<string>; whatsapp: Set<string>;
    domains: Set<string>; names: Set<string>; websites: Set<string>;
  };
  defaultCountry: string;
  specific: boolean;
  natureLabel: string;
  maxWebsites: number;
  websitesAnalyzed: number;
}
const stateCache = new Map<string, CampaignState>();

// Placeholder/invalid emails to filter out
const PLACEHOLDER_EMAILS = new Set([
  "john@doe.com", "jane@doe.com", "test@test.com", "example@example.com",
  "info@example.com", "contact@example.com", "admin@example.com",
  "you@example.com", "email@example.com", "name@example.com",
  "your@email.com", "test@example.com",
]);
const PLACEHOLDER_DOMAINS = new Set(["example.com", "example.org", "example.net", "yourdomain.com", "domain.com"]);

function isPlaceholderEmail(email: string): boolean {
  const e = email.toLowerCase();
  if (PLACEHOLDER_EMAILS.has(e)) return true;
  const domain = e.split("@")[1];
  if (domain && PLACEHOLDER_DOMAINS.has(domain)) return true;
  if (/^test@/.test(e) || /^fake@/.test(e) || /^dummy@/.test(e)) return true;
  return false;
}

// Clean up a business name extracted from search result titles
function cleanBusinessName(raw: string, domain: string): string {
  let name = raw.trim();
  // Strip everything after a colon ":" (e.g. "Al Bahri Dental: Dentists In Abu" → "Al Bahri Dental")
  name = name.replace(/:.*$/, "").trim();
  // Strip everything after " | " (pipe separator)
  name = name.replace(/\s*\|\s*.*$/i, "").trim();
  // Strip trailing separator + common page-section words
  name = name.replace(/\s*[-|·–—]\s*(contact(\s+us)?|home|about|official\s*(site|website)|website|contact\s*us|reservations?|enquiries?|get\s+in\s+touch|reach\s+us|call\s+us|visit\s+us)\s*$/i, "").trim();
  // Strip leading page-section words + separator
  name = name.replace(/^(contact(\s+us)?|home|about|official\s*(site|website)|welcome\s+to)\s*[-|·–—:]\s*/i, "").trim();
  // Strip leading "Contact Us — " or "Contact " if followed by a capitalized word (likely the real name)
  name = name.replace(/^contact\s+us\s*[-–—:]\s*/i, "").trim();
  name = name.replace(/^contact\s+(?=[A-Z])/i, "").trim();
  // Strip trailing " - Dubai", " | Dubai", " in Dubai" location suffixes
  name = name.replace(/\s*[-–—|]\s*(dubai|abu\s+dhabi|uae|karachi|lahore|berlin|london|new\s+york|sydney|tokyo).*$/i, "").trim();
  // Strip trailing " | anything"
  name = name.replace(/\s*\|\s*.*$/i, "").trim();
  // Strip trailing " - anything" (common in page titles)
  name = name.replace(/\s*[-–—]\s+(dentist|dental|clinic|restaurant|cafe|hotel|salon|gym|school|agency|company|services?|center|centre|hospital|pharmacy|lawyer|attorney).*$/i, "").trim();
  if (!name || name.length < 2) {
    // Fall back to domain name (without TLD)
    name = domain.replace(/^www\./, "").split(".")[0] || domain;
  }
  // Capitalize first letter
  if (name) name = name.charAt(0).toUpperCase() + name.slice(1);
  return name;
}

function safeJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

interface ParsedCampaign {
  id: string; name: string; target: number;
  location: LocationFilters; business: BusinessFilters;
  contact: ContactFilters; quality: QualityFilters;
}

function parseCampaign(c: any): ParsedCampaign {
  return {
    id: c.id, name: c.name, target: c.target,
    location: safeJson(c.locationFilters, {}),
    business: safeJson(c.businessFilters, {}),
    contact: safeJson(c.contactFilters, {}),
    quality: safeJson(c.qualityFilters, {}),
  };
}

function emptyStats(): CampaignStats {
  return {
    businessesDiscovered: 0, websitesAnalyzed: 0, emailsDiscovered: 0,
    whatsappDiscovered: 0, phonesDiscovered: 0, duplicatesRemoved: 0,
    invalidRemoved: 0, highQualityLeads: 0, validContacts: 0,
  };
}

function readStats(c: any): CampaignStats {
  return {
    businessesDiscovered: c.businessesDiscovered || 0,
    websitesAnalyzed: c.websitesAnalyzed || 0,
    emailsDiscovered: c.emailsDiscovered || 0,
    whatsappDiscovered: c.whatsappDiscovered || 0,
    phonesDiscovered: c.phonesDiscovered || 0,
    duplicatesRemoved: c.duplicatesRemoved || 0,
    invalidRemoved: c.invalidRemoved || 0,
    highQualityLeads: c.highQualityLeads || 0,
    validContacts: c.validContacts || 0,
  };
}

async function shouldStop(campaignId: string): Promise<boolean> {
  const c = await db.campaign.findUnique({ where: { id: campaignId }, select: { status: true } });
  if (!c) return true;
  return c.status === "cancelled" || c.status === "paused" || c.status === "failed";
}

async function failCampaign(id: string, message: string): Promise<void> {
  await db.campaign.update({ where: { id }, data: { status: "failed", errorMessage: message } });
}

async function logJob(campaignId: string, type: string, status: string, input: any, output: any, error?: string, errorCode?: string): Promise<void> {
  try {
    await db.extractionJob.create({
      data: {
        campaignId, type, status,
        input: input ? JSON.stringify(input) : null,
        output: output ? JSON.stringify(output) : null,
        error: error || null, errorCode: errorCode || null,
        startedAt: new Date(), completedAt: new Date(),
      },
    });
  } catch { /* never let logging fail */ }
}

// ---------------------------------------------------------------------------
// Initialize a campaign: discover businesses via web-search (+ Overpass fallback)
// Populates the in-memory state cache.
// ---------------------------------------------------------------------------
async function initCampaign(parsed: ParsedCampaign): Promise<CampaignState | null> {
  const limits = await getCampaignLimits();
  await heartbeat("scheduler", `Initializing campaign ${parsed.id}`);
  await heartbeat("discovery", `Querying sources for ${parsed.name}`);

  // Geocode (non-fatal) — short timeout, skip if slow
  let defaultCountry = parsed.location.country || "";
  let area: any = null;
  try {
    // Race geocoding against a 3s timeout — don't let it eat the 10s function budget
    const geoPromise = geocodeLocation(parsed.location);
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
    area = await Promise.race([geoPromise, timeoutPromise]);
    if (area) defaultCountry = area.country || defaultCountry;
  } catch { /* non-fatal */ }

  const { tags, specific } = tagsForNature(parsed.business.nature || parsed.business.industry || parsed.business.category);
  const natureLabel = parsed.business.nature || parsed.business.industry || parsed.business.category || "businesses";

  const businesses: DiscoveredBusiness[] = [];

  // ============================================================================
  // WATERFALL DISCOVERY (Layer 1) — multi-source, tries providers in priority:
  //   OpenCorporates → Foursquare → OpenStreetMap → Directories → Web Search
  // Each source fills gaps left by the previous. Continues until target reached
  // or all sources exhausted.
  // ============================================================================
  try {
    console.log(`[worker] Starting waterfall discovery (target: ${parsed.target})...`);
    const waterfallResult = await runDiscoveryWaterfall(parsed.location, parsed.business, {
      target: parsed.target,
      signal: undefined,
    });

    // Log source performance
    for (const s of waterfallResult.sourcesTried) {
      console.log(`[waterfall] ${s.name}: ${s.found} found ${s.error ? "(" + s.error + ")" : ""}`);
    }
    console.log(`[waterfall] Total: ${waterfallResult.totalFound} businesses from ${waterfallResult.sourcesTried.length} sources`);

    // Convert waterfall candidates to DiscoveredBusiness format
    const seenOsmIds = new Set<string>();
    for (const c of waterfallResult.candidates) {
      if (businesses.length >= parsed.target * 3) break;
      const osmId = c.raw?.osmId || `wf/${c.domain}`;
      if (seenOsmIds.has(osmId)) continue;
      seenOsmIds.add(osmId);

      businesses.push({
        osmId,
        osmType: (c.raw?.osmType as any) || "node",
        name: c.name,
        category: c.category || parsed.business.nature || "business",
        subcategory: c.subcategory || parsed.business.industry || natureLabel,
        website: c.website,
        phone: c.phone,
        email: c.email,
        whatsapp: c.whatsapp,
        address: c.address,
        city: c.city,
        state: c.state,
        country: c.country || defaultCountry,
        postalCode: c.postalCode,
        lat: c.lat,
        lng: c.lng,
        socialProfiles: c.socialProfiles,
        sourceName: c.sourceName,
        sourceUrl: c.sourceUrl,
        raw: c.raw || {},
      });
    }

    // Layer 2: Enrichment (Hunter/Apollo/Snov — only if API keys configured)
    if (businesses.length > 0) {
      const businessesWithoutEmail = businesses.filter(b => !b.email);
      if (businessesWithoutEmail.length > 0) {
        console.log(`[worker] Layer 2: Enriching ${businessesWithoutEmail.length} businesses without email...`);
        const candidatesForEnrichment = businessesWithoutEmail.map(b => ({
          name: b.name,
          website: b.website,
          domain: b.website ? parseDomain(b.website) || b.sourceUrl : b.sourceUrl,
          sourceName: b.sourceName,
          sourceUrl: b.sourceUrl,
          sourceType: "api",
        }));
        const enrichResult = await runEnrichmentBatch(candidatesForEnrichment, { maxEnrich: 30 });
        if (enrichResult.enriched > 0) {
          console.log(`[worker] Enrichment added ${enrichResult.enriched} emails`);
          // Merge enriched emails back into businesses
          for (const b of businesses) {
            if (b.email) continue;
            const dom = b.website ? parseDomain(b.website) : null;
            if (dom && enrichResult.results.has(dom)) {
              const r = enrichResult.results.get(dom)!;
              if (r.email) {
                b.email = r.email;
                // Store enrichment source in raw
                b.raw = { ...b.raw, enrichmentSource: r.source, enrichmentVerified: r.verified };
              }
            }
          }
        }
      }
    }
  } catch (e: any) {
    console.error(`[worker] Waterfall discovery error: ${e?.message}`);
    await logJob(parsed.id, "discover", "failed", { source: "waterfall" }, null, e?.message, "PROVIDER_ERROR");
  }

  if (businesses.length === 0) {
    await failCampaign(parsed.id, "No public businesses were found from the configured sources for the given filters. Try broadening the location or nature of business.");
    return null;
  }

  // Load suppression
  const suppression = await db.suppressionEntry.findMany();
  const sup = {
    emails: new Set(suppression.filter(s => s.type === "email").map(s => s.value.toLowerCase())),
    phones: new Set(suppression.filter(s => s.type === "phone" || s.type === "whatsapp").map(s => s.value)),
    whatsapp: new Set(suppression.filter(s => s.type === "whatsapp").map(s => s.value)),
    domains: new Set(suppression.filter(s => s.type === "domain").map(s => s.value.toLowerCase())),
    names: new Set(suppression.filter(s => s.type === "business_name").map(s => s.value.toLowerCase())),
    websites: new Set(suppression.filter(s => s.type === "website").map(s => s.value.toLowerCase())),
  };

  // Pre-load existing leads into dup index (for resume scenarios + cross-campaign dedup)
  const dupIndex = new DupIndex();
  // Load leads from THIS campaign (for resume)
  const existing = await db.lead.findMany({
    where: { campaignId: parsed.id },
    select: { email: true, phone: true, whatsapp: true, website: true, businessName: true, city: true },
  });
  for (const l of existing) {
    dupIndex.add(buildDupKey({ email: l.email, phone: l.phone, whatsapp: l.whatsapp, website: l.website, businessName: l.businessName, city: l.city }));
  }
  // Also load ALL leads globally (cross-campaign dedup — Rule 2: never insert duplicates)
  // Only load leads with contact info (email/phone/whatsapp) to keep the index small
  const globalLeads = await db.lead.findMany({
    where: {
      OR: [
        { email: { not: null } },
        { phone: { not: null } },
        { whatsapp: { not: null } },
        { website: { not: null } },
      ],
    },
    select: { email: true, phone: true, whatsapp: true, website: true, businessName: true, city: true },
    take: 50000, // safety cap
  });
  for (const l of globalLeads) {
    dupIndex.add(buildDupKey({ email: l.email, phone: l.phone, whatsapp: l.whatsapp, website: l.website, businessName: l.businessName, city: l.city }));
  }
  console.log(`[worker] Dup index: ${existing.length} campaign + ${globalLeads.length} global leads loaded`);

  const state: CampaignState = {
    businesses, index: 0, dupIndex, suppression: sup,
    defaultCountry, specific, natureLabel,
    maxWebsites: Math.min(limits.maxWebsitesPerCampaign, Math.max(50, parsed.target)),
    websitesAnalyzed: 0,
  };
  stateCache.set(parsed.id, state);

  // Update campaign with discovery count
  await db.campaign.update({
    where: { id: parsed.id },
    data: { businessesDiscovered: businesses.length, status: "running", startedAt: new Date(), errorMessage: null },
  });

  await recordBotRun("discovery", "completed", {
    task: `Discovered ${businesses.length} businesses for ${parsed.name}`,
    result: { count: businesses.length },
  });
  await recordBotRun("scheduler", "completed", { task: `Initialized campaign ${parsed.id}` });

  return state;
}

// ---------------------------------------------------------------------------
// Process a single business → may produce 0 or 1 lead
// Returns the lead summary if one was created, null otherwise.
// ---------------------------------------------------------------------------
async function processBusiness(b: DiscoveredBusiness, state: CampaignState, parsed: ParsedCampaign, scoring: any): Promise<any | null> {
  const sup = state.suppression;
  const bDomain = b.website ? parseDomain(b.website) : "";

  // Suppression checks
  if (sup.names.has(b.name.toLowerCase())) return null;
  if (bDomain && (sup.domains.has(bDomain.toLowerCase()) || sup.websites.has(bDomain.toLowerCase()))) return null;
  if (b.email && sup.emails.has(b.email.toLowerCase())) return null;
  if (b.phone && sup.phones.has(b.phone)) return null;

  // Dedup (pre-enrichment)
  const dupKey = buildDupKey({
    email: b.email, phone: b.phone, whatsapp: b.whatsapp,
    website: b.website, businessName: b.name, city: b.city, osmId: b.osmId, country: b.country,
  });
  if (state.dupIndex.has(dupKey)) return "duplicate";

  // Start assembling the lead
  let email = b.email ? normalizeEmail(b.email) : null;
  if (email && isPlaceholderEmail(email)) email = null;
  let emailConfidence = 0;
  let emailQuality: "high" | "medium" | "low" = "low";
  let whatsapp = b.whatsapp ? normalizePhone(b.whatsapp, b.country || state.defaultCountry).e164 : null;
  let whatsappConfidence = whatsapp ? 50 : 0;
  let phone = b.phone ? normalizePhone(b.phone, b.country || state.defaultCountry).e164 : null;
  let phoneConfidence = phone ? 55 : 0;
  let websiteActive = !!b.website;
  let socialProfiles: Record<string, string> = {};
  let sourceUrl = b.sourceUrl;

  // Analyze website if present
  if (b.website && state.websitesAnalyzed < state.maxWebsites) {
    state.websitesAnalyzed++;
    try {
      const analysis = await analyzeWebsite(b.website, { defaultCountry: b.country || state.defaultCountry, maxPages: 2, timeoutMs: 5000 });
      // Pick best email
      if (analysis.emails.length > 0) {
        const sorted = [...analysis.emails].sort((a, c) => c.confidence - a.confidence);
        const best = sorted[0];
        const cleanBest = isPlaceholderEmail(best.value) ? null : best.value;
        if (cleanBest && (!email || best.confidence > emailConfidence)) {
          email = cleanBest; emailConfidence = best.confidence;
          emailQuality = (best.quality as any) || "medium"; sourceUrl = best.sourceUrl;
        }
      }
      // Pick best WhatsApp
      if (analysis.whatsapps.length > 0) {
        const sorted = [...analysis.whatsapps].sort((a, c) => c.confidence - a.confidence);
        const best = sorted[0];
        if (!whatsapp || best.confidence > whatsappConfidence) { whatsapp = best.value; whatsappConfidence = best.confidence; }
      }
      // Pick best phone
      if (analysis.phones.length > 0) {
        const sorted = [...analysis.phones].sort((a, c) => c.confidence - a.confidence);
        const best = sorted[0];
        if (!phone || best.confidence > phoneConfidence) { phone = best.value; phoneConfidence = best.confidence; }
      }
      // Merge socials
      for (const s of analysis.socials) {
        const net = inferNetwork(s.value);
        if (net && !socialProfiles[net]) socialProfiles[net] = s.value;
      }
      if (analysis.siteMentionsWhatsApp && !whatsapp && phone) whatsappConfidence = Math.max(whatsappConfidence, 30);
      websiteActive = analysis.status === "ok" && analysis.pagesAnalyzed > 0;
    } catch (e: any) {
      await logJob(parsed.id, "website_analyze", "failed", { url: b.website }, null, e?.message, "DOMAIN_TIMEOUT");
    }
  }

  // Contact filters
  const cf = parsed.contact;
  if (cf?.hasEmail && !email) return null;
  if (cf?.hasWhatsApp && !whatsapp) return null;
  if (cf?.hasPhone && !phone) return null;
  if (cf?.hasWebsite && !b.website) return null;
  if (cf?.hasSocial && Object.keys(socialProfiles).length === 0) return null;
  if (cf?.multipleContacts && [email, whatsapp, phone].filter(Boolean).length < 2) return null;

  // Validate email
  let verifiedEmail = false;
  if (email) {
    const v = validateEmail(email);
    if (!v.syntaxValid || isPlaceholderEmail(email)) { email = null; }
    else { emailConfidence = v.confidence; emailQuality = v.quality; verifiedEmail = v.quality === "high" && v.businessDomain; }
  }

  // Score
  const score = scoreFromRaw({
    website: b.website, businessName: b.name, categoryMatch: state.specific,
    businessEmail: email ? isBusinessDomain(email) : false, verifiedEmail,
    hasWhatsAppLink: whatsappConfidence >= 75, phone, address: b.address,
    social: socialProfiles, websiteActive,
  }, scoring);

  // Quality filters
  const qf = parsed.quality;
  if (qf?.minScore && score.score < qf.minScore) return null;
  if (qf?.minEmailConfidence && (emailConfidence || 0) < qf.minEmailConfidence) return null;
  if (qf?.minWhatsAppConfidence && (whatsappConfidence || 0) < qf.minWhatsAppConfidence) return null;
  if (qf?.websiteActive && !websiteActive) return null;

  // Final dedup
  const finalKey = buildDupKey({ email, phone, whatsapp, website: b.website, businessName: b.name, city: b.city, osmId: b.osmId, country: b.country });
  if (state.dupIndex.has(finalKey)) return "duplicate";
  state.dupIndex.add(finalKey);

  // Persist
  const domain = bDomain || (email ? domainFromEmail(email) || undefined : undefined);
  const businessRow = await db.business.create({
    data: {
      name: b.name, domain, website: b.website,
      category: b.category, subcategory: b.subcategory,
      industry: parsed.business.industry || b.subcategory,
      nature: parsed.business.nature, b2bB2c: parsed.business.b2bB2c,
      businessType: parsed.business.businessType as any,
      country: b.country || state.defaultCountry, state: b.state, city: b.city,
      area: parsed.location.area, postalCode: b.postalCode, address: b.address,
      lat: b.lat, lng: b.lng,
      socialProfiles: Object.keys(socialProfiles).length ? JSON.stringify(socialProfiles) : null,
      sourceName: b.sourceName, sourceUrl: b.sourceUrl, osmId: b.osmId, osmType: b.osmType,
    },
  });

  const lead = await db.lead.create({
    data: {
      campaignId: parsed.id, businessId: businessRow.id,
      businessName: b.name, nature: parsed.business.nature, category: b.category,
      city: b.city, country: b.country || state.defaultCountry, website: b.website, address: b.address,
      email, emailConfidence: email ? emailConfidence : null, emailQuality: email ? emailQuality : null,
      whatsapp, whatsappConfidence: whatsapp ? whatsappConfidence : null,
      phone, phoneConfidence: phone ? phoneConfidence : null,
      socialUrl: Object.keys(socialProfiles).length ? socialProfiles[Object.keys(socialProfiles)[0]] : null,
      leadScore: score.score, leadGrade: score.grade,
      sourceName: b.sourceName, sourceUrl,
    },
  });

  // Persist contacts (evidence-backed)
  const contactData: any[] = [];
  if (email) contactData.push({
    type: "email", value: email, rawValue: b.email || email, confidence: emailConfidence, quality: emailQuality,
    sourceUrl, sourceName: b.sourceName, evidence: emailQuality === "high" ? "Business-domain email from public website" : "Email from public source",
    pageSection: "contact", normalized: true, syntaxValid: true, disposable: false, freeProvider: !isBusinessDomain(email),
    businessId: businessRow.id, leadId: lead.id,
  });
  if (whatsapp) contactData.push({
    type: "whatsapp", value: whatsapp, rawValue: b.whatsapp || whatsapp, confidence: whatsappConfidence,
    quality: whatsappConfidence >= 75 ? "high" : whatsappConfidence >= 45 ? "medium" : "low",
    sourceUrl, sourceName: b.sourceName, evidence: whatsappConfidence >= 75 ? "Public wa.me/api.whatsapp.com link on website" : "Phone number associated with WhatsApp",
    pageSection: "contact", e164: whatsapp, normalized: true, syntaxValid: true,
    businessId: businessRow.id, leadId: lead.id,
  });
  if (phone) contactData.push({
    type: "phone", value: phone, rawValue: b.phone || phone, confidence: phoneConfidence,
    quality: phoneConfidence >= 65 ? "high" : "medium",
    sourceUrl, sourceName: b.sourceName, evidence: "Public phone from website", pageSection: "contact",
    e164: phone, normalized: true, syntaxValid: true,
    businessId: businessRow.id, leadId: lead.id,
  });
  for (const [net, url] of Object.entries(socialProfiles)) {
    contactData.push({
      type: "social", value: url, rawValue: url, confidence: 60, quality: "medium",
      sourceUrl, sourceName: b.sourceName, evidence: `Public ${net} profile link`, pageSection: "contact",
      businessId: businessRow.id, leadId: lead.id,
    });
  }
  if (contactData.length) await db.contact.createMany({ data: contactData });

  return {
    id: lead.id, businessName: lead.businessName, city: lead.city, country: lead.country,
    website: lead.website, email: lead.email, whatsapp: lead.whatsapp, phone: lead.phone,
    leadScore: lead.leadScore, leadGrade: lead.leadGrade, sourceName: lead.sourceName,
    hadEmail: !!email, hadWhatsapp: !!whatsapp, hadPhone: !!phone, highQuality: score.grade === "excellent" || score.grade === "high",
  };
}

function inferNetwork(url: string): string | null {
  const u = url.toLowerCase();
  if (/facebook\.com|fb\.com/.test(u)) return "facebook";
  if (/instagram\.com/.test(u)) return "instagram";
  if (/linkedin\.com/.test(u)) return "linkedin";
  if (/twitter\.com|x\.com/.test(u)) return "twitter";
  if (/youtube\.com|youtu\.be/.test(u)) return "youtube";
  if (/tiktok\.com/.test(u)) return "tiktok";
  return null;
}

export interface TickResult {
  campaignId: string;
  status: string;
  progress: number;
  stats: CampaignStats;
  target: number;
  message: string;
  recentLead?: any;
  done: boolean;
}

// ---------------------------------------------------------------------------
// Main entry: process a batch of one campaign.
// timeBudgetMs = how long this tick may run (default 15s).
// ---------------------------------------------------------------------------
export async function processCampaignBatch(campaignId: string, timeBudgetMs = 15000): Promise<TickResult> {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campaign not found");
  const parsed = parseCampaign(campaign);

  // If cancelled/paused/failed, just return current state
  if (campaign.status === "cancelled" || campaign.status === "paused" || campaign.status === "failed" || campaign.status === "completed") {
    const stats = readStats(campaign);
    return {
      campaignId, status: campaign.status, progress: campaign.progress,
      stats, target: parsed.target, message: `Campaign ${campaign.status}`, done: campaign.status === "completed" || campaign.status === "cancelled" || campaign.status === "failed",
    };
  }

  // Initialize if not yet running (queued or first tick of running)
  let state = stateCache.get(campaignId);
  const justInitialized = !state;
  if (!state) {
    state = await initCampaign(parsed);
    if (!state) {
      const stats = readStats(campaign);
      return { campaignId, status: "failed", progress: 0, stats, target: parsed.target, message: "Discovery failed", done: true };
    }
    // Return immediately after discovery — don't process businesses in the same
    // tick. This ensures the function returns within the Vercel 10s timeout.
    // The next tick will start processing.
    const freshStats = readStats(await db.campaign.findUnique({ where: { id: campaignId } }) || campaign);
    return {
      campaignId, status: "running", progress: 0,
      stats: freshStats, target: parsed.target,
      message: `Discovered ${state.businesses.length} businesses. Starting extraction…`,
      done: false,
    };
  }

  const scoring = await getScoringConfig();
  const stats = readStats(campaign);
  const startTime = Date.now();
  let recentLead: any = null;
  let processed = 0;

  // Process businesses until time budget exhausted, target reached, or list exhausted.
  // On Vercel (10s function limit), this typically processes 1-2 businesses per tick.
  await heartbeat("extraction", `Processing business ${state.index + 1}/${state.businesses.length}`);
  while (state.index < state.businesses.length && stats.validContacts < parsed.target) {
    if (Date.now() - startTime > timeBudgetMs) break;
    if (processed >= 2) break; // max 2 businesses per tick (website analysis is slow)
    if (await shouldStop(campaignId)) {
      const c2 = await db.campaign.findUnique({ where: { id: campaignId } });
      return { campaignId, status: c2?.status || "paused", progress: c2?.progress || 0, stats: readStats(c2!), target: parsed.target, message: "Stopped", done: false };
    }

    const b = state.businesses[state.index++];
    processed++;
    const result = await processBusiness(b, state, parsed, scoring);
    if (result === "duplicate") {
      stats.duplicatesRemoved++;
    } else if (result === null) {
      stats.invalidRemoved++;
    } else if (result) {
      stats.validContacts++;
      if (result.hadEmail) stats.emailsDiscovered++;
      if (result.hadWhatsapp) stats.whatsappDiscovered++;
      if (result.hadPhone) stats.phonesDiscovered++;
      if (result.highQuality) stats.highQualityLeads++;
      stats.websitesAnalyzed = state.websitesAnalyzed;
      recentLead = result;
    }
  }

  // Check completion
  const exhausted = state.index >= state.businesses.length;
  const reachedTarget = stats.validContacts >= parsed.target;
  const done = exhausted || reachedTarget;

  stats.businessesDiscovered = state.businesses.length;
  stats.websitesAnalyzed = state.websitesAnalyzed;

  const progress = Math.min(100, Math.round((stats.validContacts / Math.max(1, parsed.target)) * 100));

  if (done) {
    await db.campaign.update({
      where: { id: campaignId },
      data: {
        status: "completed", completedAt: new Date(), progress: 100,
        businessesDiscovered: stats.businessesDiscovered, websitesAnalyzed: stats.websitesAnalyzed,
        emailsDiscovered: stats.emailsDiscovered, whatsappDiscovered: stats.whatsappDiscovered,
        phonesDiscovered: stats.phonesDiscovered, duplicatesRemoved: stats.duplicatesRemoved,
        invalidRemoved: stats.invalidRemoved, highQualityLeads: stats.highQualityLeads,
        validContacts: stats.validContacts,
      },
    });
    // Clean up state cache
    stateCache.delete(campaignId);
  } else {
    // Persist interim stats
    await db.campaign.update({
      where: { id: campaignId },
      data: {
        progress,
        businessesDiscovered: stats.businessesDiscovered, websitesAnalyzed: stats.websitesAnalyzed,
        emailsDiscovered: stats.emailsDiscovered, whatsappDiscovered: stats.whatsappDiscovered,
        phonesDiscovered: stats.phonesDiscovered, duplicatesRemoved: stats.duplicatesRemoved,
        invalidRemoved: stats.invalidRemoved, highQualityLeads: stats.highQualityLeads,
        validContacts: stats.validContacts,
      },
    });
  }

  let message = `Processed ${processed} businesses`;
  if (done) message = reachedTarget ? `Target reached (${stats.validContacts} leads)` : `All sources exhausted (${stats.validContacts} leads)`;

  // Record bot runs for this tick (best-effort, non-blocking)
  if (processed > 0) {
    await recordBotRun("extraction", "completed", { task: `Processed ${processed} businesses`, result: { processed, validContacts: stats.validContacts } });
    await recordBotRun("validation", "completed", { task: `Validated ${processed} records` });
    await recordBotRun("dedup", "completed", { task: `Dedup check for ${processed} records`, result: { duplicates: stats.duplicatesRemoved } });
    await recordBotRun("scoring", "completed", { task: `Scored ${stats.validContacts} leads` });
  }
  if (done) {
    await recordBotRun("scheduler", "completed", { task: `Campaign ${campaignId} ${done ? "completed" : "running"}`, result: { stats } });
  }

  return {
    campaignId, status: done ? "completed" : "running",
    progress: done ? 100 : progress, stats, target: parsed.target, message, recentLead, done,
  };
}

// Find the next campaign that needs processing (queued or running)
export async function findNextCampaign(): Promise<string | null> {
  const c = await db.campaign.findFirst({
    where: { status: { in: ["queued", "running"] } },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
  return c?.id || null;
}
