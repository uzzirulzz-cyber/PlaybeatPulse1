// LeadPulse — Background Discovery Worker + Realtime socket.io server
// Port: 3003
// This service:
//   1. Hosts a socket.io server for real-time campaign progress
//   2. Polls the DB for queued/running campaigns
//   3. Executes the real discovery pipeline (Overpass -> website analysis -> extract -> validate -> dedup -> score)
//
// Imports the Prisma client & shared lib utilities from the parent project.
import { createServer } from "http";
import { Server } from "socket.io";
import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";

// Load the parent project's .env so DATABASE_URL is available.
loadEnv({ path: "/home/z/my-project/.env" });

const db = new PrismaClient({ log: ["error", "warn"] });

// --- shared lib (imported from parent project) ---
import {
  geocodeLocation,
  buildOverpassQuery,
  runOverpassQuery,
  elementToBusiness,
  tagsForNature,
  type DiscoveredBusiness,
} from "../../src/lib/overpass";
import { discoverBusinessesViaSearch, type WebSearchBusiness } from "../../src/lib/websearch";
import { analyzeWebsite } from "../../src/lib/website";
import { parseDomain } from "../../src/lib/ssrf";
import { normalizePhone } from "../../src/lib/phone";
import { normalizeEmail, validateEmail, isBusinessDomain, domainFromEmail } from "../../src/lib/email";
import { scoreFromRaw, gradeFromScore } from "../../src/lib/scoring";
import { DupIndex, buildDupKey } from "../../src/lib/dedup";
import { getScoringConfig, getCampaignLimits } from "../../src/lib/settings";
import type { CampaignProgressEvent, CampaignStats, LocationFilters, BusinessFilters, ContactFilters, QualityFilters } from "../../src/lib/types";

// ---------------------------------------------------------------------------
// socket.io server
// ---------------------------------------------------------------------------

const httpServer = createServer();
const io = new Server(httpServer, {
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

io.on("connection", (socket) => {
  console.log(`[ws] client connected ${socket.id}`);
  socket.on("subscribe", (campaignId: string) => {
    socket.join(`campaign:${campaignId}`);
    console.log(`[ws] ${socket.id} subscribed to ${campaignId}`);
  });
  socket.on("unsubscribe", (campaignId: string) => {
    socket.leave(`campaign:${campaignId}`);
  });
  socket.on("ping-worker", () => {
    socket.emit("worker-pong", { ok: true, t: Date.now() });
  });
  socket.on("disconnect", () => {
    // noop
  });
});

function emitProgress(campaignId: string, evt: CampaignProgressEvent) {
  io.to(`campaign:${campaignId}`).emit("campaign:progress", evt);
  io.emit("dashboard:update", { campaignId, ...evt });
}

// ---------------------------------------------------------------------------
// Rate limiter (per-source, in-memory)
// ---------------------------------------------------------------------------

interface RateBucket {
  count: number;
  windowStart: number;
}
const rateBuckets = new Map<string, RateBucket>();

function rateLimitOk(sourceName: string, perMinute: number): boolean {
  const now = Date.now();
  const b = rateBuckets.get(sourceName);
  if (!b || now - b.windowStart > 60_000) {
    rateBuckets.set(sourceName, { count: 1, windowStart: now });
    return true;
  }
  if (b.count >= perMinute) return false;
  b.count++;
  return true;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Pipeline: run a single campaign
// ---------------------------------------------------------------------------

interface ParsedCampaign {
  id: string;
  name: string;
  target: number;
  location: LocationFilters;
  business: BusinessFilters;
  contact: ContactFilters;
  quality: QualityFilters;
}

function parseCampaign(c: any): ParsedCampaign {
  return {
    id: c.id,
    name: c.name,
    target: c.target,
    location: safeJson(c.locationFilters, {}),
    business: safeJson(c.businessFilters, {}),
    contact: safeJson(c.contactFilters, {}),
    quality: safeJson(c.qualityFilters, {}),
  };
}

function safeJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

async function shouldStop(campaignId: string): Promise<boolean> {
  const c = await db.campaign.findUnique({ where: { id: campaignId }, select: { status: true } });
  if (!c) return true;
  return c.status === "cancelled" || c.status === "paused" || c.status === "failed";
}

async function runCampaign(campaign: any): Promise<void> {
  const parsed = parseCampaign(campaign);
  const limits = await getCampaignLimits();
  const scoring = await getScoringConfig();

  console.log(`[worker] starting campaign ${parsed.id} "${parsed.name}" target=${parsed.target}`);

  // Mark running
  await db.campaign.update({
    where: { id: parsed.id },
    data: { status: "running", startedAt: new Date(), errorMessage: null },
  });

  const stats: CampaignStats = {
    businessesDiscovered: 0,
    websitesAnalyzed: 0,
    emailsDiscovered: 0,
    whatsappDiscovered: 0,
    phonesDiscovered: 0,
    duplicatesRemoved: 0,
    invalidRemoved: 0,
    highQualityLeads: 0,
    validContacts: 0,
  };

  const emit = (message?: string, recentLead?: any) => {
    const evt: CampaignProgressEvent = {
      campaignId: parsed.id,
      status: "running",
      progress: Math.min(100, Math.round((stats.highQualityLeads / Math.max(1, parsed.target)) * 100)),
      stats: { ...stats },
      target: parsed.target,
      message,
      recentLead,
    };
    emitProgress(parsed.id, evt);
  };

  emit("Discovering businesses…");

  // 1. Geocode the target location (non-fatal — used for default country & Overpass bbox)
  let defaultCountry = parsed.location.country || "";
  let area: any = null;
  try {
    area = await geocodeLocation(parsed.location);
    if (area) {
      defaultCountry = area.country || defaultCountry;
    }
  } catch (e: any) {
    console.log(`[worker] geocode skipped: ${e?.message}`);
  }

  // 2. Determine OSM tags from nature (for category labeling + optional Overpass)
  const { tags, specific } = tagsForNature(parsed.business.nature || parsed.business.industry || parsed.business.category);
  const natureLabel = parsed.business.nature || parsed.business.industry || parsed.business.category || "businesses";

  const businesses: DiscoveredBusiness[] = [];

  // 3a. PRIMARY: Web-search discovery (z-ai SDK — reliable, returns real business websites)
  emit(`Searching the web for ${natureLabel} in ${parsed.location.city || parsed.location.country || "target area"}…`);
  try {
    if (!rateLimitOk("Web Search (z-ai)", 10)) await sleep(3000);
    const searchResults = await discoverBusinessesViaSearch(parsed.business, parsed.location, {
      perQuery: Math.min(20, Math.max(10, Math.ceil(parsed.target / 5))),
      maxResults: Math.min(300, parsed.target * 4),
    });
    for (const r of searchResults) {
      if (await shouldStop(parsed.id)) return;
      businesses.push({
        osmId: `web/${r.domain}`,
        osmType: "node",
        name: r.name,
        category: parsed.business.category || parsed.business.nature || "business",
        subcategory: parsed.business.subcategory || parsed.business.industry || natureLabel,
        website: r.website,
        phone: r.snippetPhones[0] || undefined,
        email: r.snippetEmails[0] || undefined,
        whatsapp: r.snippetWhatsapps[0] || undefined,
        city: parsed.location.city,
        state: parsed.location.state,
        country: defaultCountry || parsed.location.country,
        postalCode: parsed.location.postal,
        address: undefined,
        lat: area?.lat, lng: area?.lng,
        socialProfiles: undefined,
        sourceName: "Web Search",
        sourceUrl: r.sourceUrl,
        raw: { hostName: r.hostName, domain: r.domain, snippetEmails: r.snippetEmails, snippetPhones: r.snippetPhones },
      });
    }
    console.log(`[worker] campaign ${parsed.id}: ${businesses.length} businesses via web-search`);
  } catch (e: any) {
    console.error(`[worker] web-search error:`, e?.message);
    await logJob(parsed.id, "discover", "failed", { source: "websearch" }, null, e?.message, "PROVIDER_ERROR");
  }

  // 3b. SECONDARY (optional enrichment): Overpass API — adds OSM-tagged businesses when reachable.
  // This source is often rate-limited or unreachable from sandboxed environments; failures are non-fatal.
  if (area && businesses.length < parsed.target) {
    try {
      emit("Also querying OpenStreetMap (if reachable)…");
      const bbox: [number, number, number, number] = [
        area.boundingBox[0], area.boundingBox[2], area.boundingBox[1], area.boundingBox[3],
      ];
      const queryLimit = Math.min(2000, (parsed.target - businesses.length) * 2);
      const overpassQuery = buildOverpassQuery({ bbox, tags, limit: queryLimit });
      if (!rateLimitOk("OpenStreetMap Overpass", 20)) await sleep(2000);
      const elements = await runOverpassQuery(overpassQuery, { timeoutMs: 30000 });
      let added = 0;
      const seenDomains = new Set(businesses.map((b) => parseDomain(b.website)).filter(Boolean) as string[]);
      for (const el of elements) {
        if (businesses.length >= parsed.target * 2) break;
        const b = elementToBusiness(el, defaultCountry);
        if (!b) continue;
        const dom = b.website ? parseDomain(b.website) : null;
        if (dom && seenDomains.has(dom)) continue;
        if (dom) seenDomains.add(dom);
        businesses.push(b);
        added++;
      }
      console.log(`[worker] campaign ${parsed.id}: +${added} businesses via Overpass`);
    } catch (e: any) {
      console.log(`[worker] Overpass skipped (non-fatal): ${e?.message}`);
      await logJob(parsed.id, "discover", "failed", { source: "overpass" }, null, e?.message, "SOURCE_RATE_LIMITED");
    }
  }

  if (businesses.length === 0) {
    await failCampaign(parsed.id, "No public businesses were found from the configured sources for the given filters. Try broadening the location or nature of business.");
    return;
  }

  stats.businessesDiscovered = businesses.length;
  emit(`Discovered ${businesses.length} businesses. Analyzing websites & extracting contacts…`);

  // 5. Dedup index (within this campaign) + suppression list
  const dupIndex = new DupIndex();
  const suppression = await db.suppressionEntry.findMany();
  const suppressedEmails = new Set(suppression.filter(s => s.type === "email").map(s => s.value.toLowerCase()));
  const suppressedPhones = new Set(suppression.filter(s => s.type === "phone" || s.type === "whatsapp").map(s => s.value));
  const suppressedDomains = new Set(suppression.filter(s => s.type === "domain").map(s => s.value.toLowerCase()));
  const suppressedNames = new Set(suppression.filter(s => s.type === "business_name").map(s => s.value.toLowerCase()));
  const suppressedWebsites = new Set(suppression.filter(s => s.type === "website").map(s => s.value.toLowerCase()));

  // Pre-load existing leads in this campaign into the dup index
  const existingLeads = await db.lead.findMany({
    where: { campaignId: parsed.id },
    select: { email: true, phone: true, whatsapp: true, website: true, businessName: true, city: true },
  });
  for (const l of existingLeads) {
    dupIndex.add(buildDupKey({
      email: l.email, phone: l.phone, whatsapp: l.whatsapp,
      website: l.website, businessName: l.businessName, city: l.city,
    }));
  }

  // 6. Process each business
  let websitesAnalyzed = 0;
  const maxWebsites = Math.min(limits.maxWebsitesPerCampaign, Math.max(50, parsed.target));

  for (const b of businesses) {
    if (await shouldStop(parsed.id)) return;

    // Check suppression
    const bDomain = b.website ? (b.website.includes("://") ? new URL(b.website).hostname.replace(/^www\./, "") : b.website) : "";
    if (suppressedNames.has(b.name.toLowerCase())) { stats.invalidRemoved++; continue; }
    if (bDomain && suppressedDomains.has(bDomain.toLowerCase())) { stats.invalidRemoved++; continue; }
    if (bDomain && suppressedWebsites.has(bDomain.toLowerCase())) { stats.invalidRemoved++; continue; }
    if (b.email && suppressedEmails.has(b.email.toLowerCase())) { stats.invalidRemoved++; continue; }
    if (b.phone && suppressedPhones.has(b.phone)) { stats.invalidRemoved++; continue; }

    // Dedup check
    const dupKey = buildDupKey({
      email: b.email, phone: b.phone, whatsapp: b.whatsapp,
      website: b.website, businessName: b.name, city: b.city, osmId: b.osmId, country: b.country,
    });
    if (dupIndex.has(dupKey)) {
      stats.duplicatesRemoved++;
      continue;
    }

    // Start assembling the lead from OSM data (already high quality — real public business)
    let email = b.email ? normalizeEmail(b.email) : null;
    let emailConfidence = 0;
    let emailQuality: "high" | "medium" | "low" = "low";
    let whatsapp = b.whatsapp ? normalizePhone(b.whatsapp, b.country || defaultCountry).e164 : null;
    let whatsappConfidence = whatsapp ? 50 : 0;
    let phone = b.phone ? normalizePhone(b.phone, b.country || defaultCountry).e164 : null;
    let phoneConfidence = phone ? 55 : 0;
    let websiteActive = !!b.website;
    let socialProfiles = b.socialProfiles || {};
    let sourceUrl = b.sourceUrl;

    // If business has a website, analyze its public contact pages
    if (b.website && websitesAnalyzed < maxWebsites) {
      websitesAnalyzed++;
      try {
        if (!rateLimitOk("Website Contact Analyzer", 30)) await sleep(1500);
        const analysis = await analyzeWebsite(b.website, { defaultCountry: b.country || defaultCountry, maxPages: 3, timeoutMs: 15000 });
        stats.websitesAnalyzed++;

        // Pick best email (prefer business-domain, highest confidence)
        if (analysis.emails.length > 0) {
          const sorted = [...analysis.emails].sort((a, b2) => b2.confidence - a.confidence);
          const best = sorted[0];
          if (!email || best.confidence > emailConfidence) {
            email = best.value;
            emailConfidence = best.confidence;
            emailQuality = (best.quality as any) || "medium";
            sourceUrl = best.sourceUrl;
          }
          // count all discovered for stats
          stats.emailsDiscovered += analysis.emails.filter(e => e.value !== email).length + (email ? 1 : 0);
        }

        // Pick best WhatsApp
        if (analysis.whatsapps.length > 0) {
          const sorted = [...analysis.whatsapps].sort((a, b2) => b2.confidence - a.confidence);
          const best = sorted[0];
          if (!whatsapp || best.confidence > whatsappConfidence) {
            whatsapp = best.value;
            whatsappConfidence = best.confidence;
          }
          stats.whatsappDiscovered += analysis.whatsapps.length;
        }

        // Pick best phone
        if (analysis.phones.length > 0) {
          const sorted = [...analysis.phones].sort((a, b2) => b2.confidence - a.confidence);
          const best = sorted[0];
          if (!phone || best.confidence > phoneConfidence) {
            phone = best.value;
            phoneConfidence = best.confidence;
          }
          stats.phonesDiscovered += analysis.phones.length;
        }

        // Merge socials
        for (const s of analysis.socials) {
          const net = Object.keys(s).length ? inferNetwork(s.value) : null;
          if (net && !socialProfiles[net]) socialProfiles[net] = s.value;
        }

        if (analysis.siteMentionsWhatsApp && !whatsapp && phone) {
          whatsappConfidence = Math.max(whatsappConfidence, 30);
        }

        websiteActive = analysis.status === "ok" && analysis.pagesAnalyzed > 0;
      } catch (e: any) {
        console.error(`[worker] website analyze error for ${b.website}:`, e?.message);
        // log extraction job failure
        await logJob(parsed.id, "website_analyze", "failed", { url: b.website }, null, e?.message, "DOMAIN_TIMEOUT");
      }
    }

    // Apply contact filters (skip leads that don't meet required criteria)
    const cf = parsed.contact;
    if (cf?.hasEmail && !email) { stats.invalidRemoved++; continue; }
    if (cf?.hasWhatsApp && !whatsapp) { stats.invalidRemoved++; continue; }
    if (cf?.hasPhone && !phone) { stats.invalidRemoved++; continue; }
    if (cf?.hasWebsite && !b.website) { stats.invalidRemoved++; continue; }
    if (cf?.hasSocial && Object.keys(socialProfiles).length === 0) { stats.invalidRemoved++; continue; }
    if (cf?.multipleContacts && [email, whatsapp, phone].filter(Boolean).length < 2) { stats.invalidRemoved++; continue; }

    // Validate email
    let verifiedEmail = false;
    if (email) {
      const v = validateEmail(email);
      if (!v.syntaxValid) { stats.invalidRemoved++; email = null; }
      else {
        emailConfidence = v.confidence;
        emailQuality = v.quality;
        verifiedEmail = v.quality === "high" && v.businessDomain;
      }
    }

    // Score
    const score = scoreFromRaw({
      website: b.website,
      businessName: b.name,
      categoryMatch: specific,
      businessEmail: email ? isBusinessDomain(email) : false,
      verifiedEmail,
      hasWhatsAppLink: whatsappConfidence >= 75,
      phone,
      address: b.address,
      social: socialProfiles,
      websiteActive,
    }, scoring);

    // Apply quality filters
    const qf = parsed.quality;
    if (qf?.minScore && score.score < qf.minScore) { stats.invalidRemoved++; continue; }
    if (qf?.minEmailConfidence && (emailConfidence || 0) < qf.minEmailConfidence) { stats.invalidRemoved++; continue; }
    if (qf?.minWhatsAppConfidence && (whatsappConfidence || 0) < qf.minWhatsAppConfidence) { stats.invalidRemoved++; continue; }
    if (qf?.websiteActive && !websiteActive) { stats.invalidRemoved++; continue; }

    // Dedup final check (after enrichment, the email/phone may have changed)
    const finalDupKey = buildDupKey({
      email, phone, whatsapp, website: b.website, businessName: b.name, city: b.city, osmId: b.osmId, country: b.country,
    });
    if (dupIndex.has(finalDupKey)) {
      stats.duplicatesRemoved++;
      continue;
    }
    dupIndex.add(finalDupKey);

    // Persist Business + Lead + Contacts
    const domain = b.website ? (b.website.includes("://") ? new URL(b.website).hostname.replace(/^www\./, "") : b.website) : (email ? domainFromEmail(email) || undefined : undefined);

    const businessRow = await db.business.create({
      data: {
        name: b.name,
        domain,
        website: b.website,
        category: b.category,
        subcategory: b.subcategory,
        industry: parsed.business.industry || b.subcategory,
        nature: parsed.business.nature,
        b2bB2c: parsed.business.b2bB2c,
        businessType: parsed.business.businessType as any,
        country: b.country || defaultCountry,
        state: b.state,
        city: b.city,
        area: parsed.location.area,
        postalCode: b.postalCode,
        address: b.address,
        lat: b.lat,
        lng: b.lng,
        socialProfiles: Object.keys(socialProfiles).length ? JSON.stringify(socialProfiles) : null,
        sourceId: null,
        sourceName: b.sourceName,
        sourceUrl: b.sourceUrl,
        osmId: b.osmId,
        osmType: b.osmType,
      },
    });

    const lead = await db.lead.create({
      data: {
        campaignId: parsed.id,
        businessId: businessRow.id,
        businessName: b.name,
        nature: parsed.business.nature,
        category: b.category,
        city: b.city,
        country: b.country || defaultCountry,
        website: b.website,
        address: b.address,
        email,
        emailConfidence: email ? emailConfidence : null,
        emailQuality: email ? emailQuality : null,
        whatsapp,
        whatsappConfidence: whatsapp ? whatsappConfidence : null,
        phone,
        phoneConfidence: phone ? phoneConfidence : null,
        socialUrl: Object.keys(socialProfiles).length ? socialProfiles[Object.keys(socialProfiles)[0]] : null,
        leadScore: score.score,
        leadGrade: score.grade,
        sourceName: b.sourceName,
        sourceUrl,
      },
      include: { contacts: true },
    });

    // Persist contacts (evidence-backed)
    const contactData: any[] = [];
    if (email) contactData.push({
      type: "email", value: email, rawValue: b.email || email, confidence: emailConfidence, quality: emailQuality,
      sourceUrl, sourceName: b.sourceName, evidence: emailQuality === "high" ? "Business-domain email from OSM tags or public contact page" : "Email from OSM tags", pageSection: "osm",
      normalized: true, syntaxValid: true, disposable: false, freeProvider: !isBusinessDomain(email),
      businessId: businessRow.id, leadId: lead.id,
    });
    if (whatsapp) contactData.push({
      type: "whatsapp", value: whatsapp, rawValue: b.whatsapp || whatsapp, confidence: whatsappConfidence,
      quality: whatsappConfidence >= 75 ? "high" : whatsappConfidence >= 45 ? "medium" : "low",
      sourceUrl, sourceName: b.sourceName, evidence: whatsappConfidence >= 75 ? "Public wa.me/api.whatsapp.com link" : "OSM contact:whatsapp tag or phone near WhatsApp mention",
      pageSection: whatsappConfidence >= 75 ? "contact" : "osm",
      e164: whatsapp, normalized: true, syntaxValid: true,
      businessId: businessRow.id, leadId: lead.id,
    });
    if (phone) contactData.push({
      type: "phone", value: phone, rawValue: b.phone || phone, confidence: phoneConfidence,
      quality: phoneConfidence >= 65 ? "high" : "medium",
      sourceUrl, sourceName: b.sourceName, evidence: "Public phone from OSM tags or website",
      pageSection: "osm",
      e164: phone, normalized: true, syntaxValid: true,
      businessId: businessRow.id, leadId: lead.id,
    });
    for (const [net, url] of Object.entries(socialProfiles)) {
      contactData.push({
        type: "social", value: url, rawValue: url, confidence: 60, quality: "medium",
        sourceUrl, sourceName: b.sourceName, evidence: `Public ${net} profile link`, pageSection: "osm",
        businessId: businessRow.id, leadId: lead.id,
      });
    }
    if (contactData.length) {
      await db.contact.createMany({ data: contactData });
    }

    stats.validContacts++;
    if (email) stats.emailsDiscovered = stats.emailsDiscovered; // already counted
    if (whatsapp && !b.whatsapp) stats.whatsappDiscovered++;
    if (phone && !b.phone) stats.phonesDiscovered++;
    if (score.grade === "excellent" || score.grade === "high") stats.highQualityLeads++;

    // Persist stats periodically
    if (stats.validContacts % 5 === 0) {
      await db.campaign.update({
        where: { id: parsed.id },
        data: {
          businessesDiscovered: stats.businessesDiscovered,
          websitesAnalyzed: stats.websitesAnalyzed,
          emailsDiscovered: stats.emailsDiscovered,
          whatsappDiscovered: stats.whatsappDiscovered,
          phonesDiscovered: stats.phonesDiscovered,
          duplicatesRemoved: stats.duplicatesRemoved,
          invalidRemoved: stats.invalidRemoved,
          highQualityLeads: stats.highQualityLeads,
          validContacts: stats.validContacts,
          progress: Math.min(100, Math.round((stats.validContacts / Math.max(1, parsed.target)) * 100)),
        },
      });
      emit(`${stats.validContacts} leads collected`, leadSummary(lead));
    }

    // Stop if we reached target
    if (stats.validContacts >= parsed.target) {
      break;
    }
  }

  // 7. Finalize
  await db.campaign.update({
    where: { id: parsed.id },
    data: {
      status: "completed",
      completedAt: new Date(),
      progress: 100,
      businessesDiscovered: stats.businessesDiscovered,
      websitesAnalyzed: stats.websitesAnalyzed,
      emailsDiscovered: stats.emailsDiscovered,
      whatsappDiscovered: stats.whatsappDiscovered,
      phonesDiscovered: stats.phonesDiscovered,
      duplicatesRemoved: stats.duplicatesRemoved,
      invalidRemoved: stats.invalidRemoved,
      highQualityLeads: stats.highQualityLeads,
      validContacts: stats.validContacts,
    },
  });

  emit("Campaign completed");
  io.to(`campaign:${parsed.id}`).emit("campaign:completed", { campaignId: parsed.id, stats });
  console.log(`[worker] campaign ${parsed.id} completed: ${stats.validContacts} leads`);
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

function leadSummary(l: any) {
  return {
    id: l.id, businessName: l.businessName, city: l.city, country: l.country,
    website: l.website, email: l.email, whatsapp: l.whatsapp, phone: l.phone,
    leadScore: l.leadScore, leadGrade: l.leadGrade, sourceName: l.sourceName,
  };
}

async function failCampaign(id: string, message: string): Promise<void> {
  await db.campaign.update({
    where: { id },
    data: { status: "failed", errorMessage: message },
  });
  io.to(`campaign:${id}`).emit("campaign:failed", { campaignId: id, error: message });
  console.error(`[worker] campaign ${id} FAILED: ${message}`);
}

async function logJob(campaignId: string, type: string, status: string, input: any, output: any, error?: string, errorCode?: string): Promise<void> {
  try {
    await db.extractionJob.create({
      data: {
        campaignId, type, status,
        input: input ? JSON.stringify(input) : null,
        output: output ? JSON.stringify(output) : null,
        error: error || null,
        errorCode: errorCode || null,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });
  } catch {
    // never let logging fail the campaign
  }
}

// ---------------------------------------------------------------------------
// Campaign poller loop
// ---------------------------------------------------------------------------

const activeCampaigns = new Set<string>();

async function pollLoop(): Promise<void> {
  console.log("[worker] poll loop started");
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const limits = await getCampaignLimits();
      // Find queued or running campaigns not already being processed
      const candidates = await db.campaign.findMany({
        where: {
          status: { in: ["queued", "running"] },
          id: { notIn: Array.from(activeCampaigns) },
        },
        orderBy: { createdAt: "asc" },
        take: limits.maxConcurrentCampaigns,
      });

      for (const c of candidates) {
        if (activeCampaigns.size >= limits.maxConcurrentCampaigns) break;
        activeCampaigns.add(c.id);
        // run async — don't block the loop
        runCampaign(c)
          .catch((e) => {
            console.error(`[worker] campaign ${c.id} crashed:`, e);
            return failCampaign(c.id, e?.message || "WORKER_ERROR");
          })
          .finally(() => {
            activeCampaigns.delete(c.id);
          });
      }
    } catch (e) {
      console.error("[worker] poll error:", e);
    }
    await sleep(3000);
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

const PORT = 3003;
httpServer.listen(PORT, () => {
  console.log(`[worker] LeadPulse worker + socket.io listening on port ${PORT}`);
  pollLoop();
});

process.on("SIGTERM", () => {
  console.log("[worker] SIGTERM, shutting down");
  httpServer.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  console.log("[worker] SIGINT, shutting down");
  httpServer.close(() => process.exit(0));
});
