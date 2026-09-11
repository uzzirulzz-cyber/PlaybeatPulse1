// LeadPulse — Website contact-page analyzer
// For a discovered business website, fetch permitted public pages and extract
// business emails + WhatsApp references with evidence.
import * as cheerio from "cheerio";
import { safeFetch, parseUrl, parseDomain } from "./ssrf";
import { extractEmailsFromHtml, normalizeEmail, isBusinessDomain, validateEmail } from "./email";
import { detectWhatsApp, normalizePhone } from "./phone";

export interface AnalyzedContact {
  type: "email" | "whatsapp" | "phone" | "social";
  value: string;          // normalized
  raw: string;
  confidence: number;
  quality?: "high" | "medium" | "low";
  sourceUrl: string;
  pageSection: string;
  evidence: string;
}

export interface WebsiteAnalysisResult {
  url: string;
  finalUrl?: string;
  status: "ok" | "fetch_failed" | "blocked" | "empty";
  httpStatus?: number;
  emails: AnalyzedContact[];
  whatsapps: AnalyzedContact[];
  phones: AnalyzedContact[];
  socials: AnalyzedContact[];
  pagesAnalyzed: number;
  siteMentionsWhatsApp: boolean;
  title?: string;
  error?: string;
}

// Pages we are allowed to inspect (public, non-authenticated).
const ALLOWED_PATHS = [
  "",            // homepage
  "/contact",
  "/contact-us",
  "/contacts",
  "/about",
  "/about-us",
  "/team",
  "/support",
  "/locations",
  "/privacy",
  "/terms",
];

const SOCIAL_DOMAINS: Record<string, RegExp> = {
  facebook: /facebook\.com|fb\.com/i,
  instagram: /instagram\.com/i,
  linkedin: /linkedin\.com/i,
  twitter: /twitter\.com|x\.com/i,
  youtube: /youtube\.com|youtu\.be/i,
  tiktok: /tiktok\.com/i,
};

export async function analyzeWebsite(
  rawUrl: string,
  opts: { defaultCountry?: string; maxPages?: number; timeoutMs?: number } = {}
): Promise<WebsiteAnalysisResult> {
  const base = parseUrl(rawUrl);
  if (!base) {
    return { url: rawUrl, status: "fetch_failed", error: "INVALID_URL", emails: [], whatsapps: [], phones: [], socials: [], pagesAnalyzed: 0, siteMentionsWhatsApp: false };
  }

  const origin = base.origin;
  const maxPages = opts.maxPages ?? 3;
  const timeoutMs = opts.timeoutMs ?? 15000;

  const result: WebsiteAnalysisResult = {
    url: rawUrl,
    status: "ok",
    emails: [],
    whatsapps: [],
    phones: [],
    socials: [],
    pagesAnalyzed: 0,
    siteMentionsWhatsApp: false,
  };

  const seenEmails = new Set<string>();
  const seenWa = new Set<string>();
  const seenPhones = new Set<string>();
  const seenSocials = new Set<string>();

  // Determine candidate pages: homepage + a few contact-ish paths.
  // We always start with the homepage; if it links to a contact page, we follow it.
  const candidatePaths = new Set<string>([""]);
  let pagesDone = 0;

  // Fetch homepage first
  let homeHtml = "";
  try {
    const r = await safeFetch(origin, { timeoutMs });
    result.httpStatus = r.status;
    homeHtml = r.html;
    result.finalUrl = r.finalUrl;
    result.title = extractTitle(homeHtml);
    result.siteMentionsWhatsApp = /whats\s*app/i.test(homeHtml);
    result.pagesAnalyzed++;
    pagesDone++;

    // Collect contact-page links from the homepage
    const contactLinks = extractInternalLinks(homeHtml, origin).filter((l) =>
      /contact|about|team|support|location/i.test(l)
    );
    for (const l of contactLinks.slice(0, 4)) candidatePaths.add(pathFromUrl(l, origin));
    extractContactsFromHtml(homeHtml, origin, opts.defaultCountry, result, seenEmails, seenWa, seenPhones, seenSocials);
  } catch (e: any) {
    if (e?.name === "SsrfBlockedError") {
      return { ...result, status: "blocked", error: "SSRF_BLOCKED" };
    }
    result.status = "fetch_failed";
    result.error = e?.message || "PROVIDER_ERROR";
    // continue — maybe a sub-page works
  }

  // Fetch a small number of additional allowed pages
  for (const path of candidatePaths) {
    if (pagesDone >= maxPages) break;
    // Only follow allowed-ish paths
    if (path && !ALLOWED_PATHS.includes(path) && !/contact|about|team|support|location/i.test(path)) continue;
    const pageUrl = origin + (path || "");
    if (pageUrl === origin && homeHtml) continue; // already fetched homepage
    try {
      const r = await safeFetch(pageUrl, { timeoutMs });
      if (!r.html) continue;
      result.pagesAnalyzed++;
      pagesDone++;
      extractContactsFromHtml(r.html, pageUrl, opts.defaultCountry, result, seenEmails, seenWa, seenPhones, seenSocials);
    } catch {
      // ignore single-page failures; campaign continues
    }
  }

  if (result.emails.length === 0 && result.whatsapps.length === 0 && result.phones.length === 0 && result.socials.length === 0 && result.status === "ok" && result.pagesAnalyzed === 0) {
    result.status = "empty";
  }

  return result;
}

function extractTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? m[1].trim().slice(0, 200) : undefined;
}

function pathFromUrl(url: string, origin: string): string {
  try {
    const u = new URL(url, origin);
    if (u.origin !== origin) return "";
    return u.pathname;
  } catch {
    return "";
  }
}

function extractInternalLinks(html: string, origin: string): string[] {
  const links: string[] = [];
  const $ = cheerio.load(html);
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
    try {
      const abs = new URL(href, origin).toString();
      if (abs.startsWith(origin)) links.push(abs);
    } catch {
      // ignore malformed
    }
  });
  return Array.from(new Set(links));
}

function extractContactsFromHtml(
  html: string,
  sourceUrl: string,
  defaultCountry: string | undefined,
  result: WebsiteAnalysisResult,
  seenEmails: Set<string>,
  seenWa: Set<string>,
  seenPhones: Set<string>,
  seenSocials: Set<string>
): void {
  // Emails
  const extracted = extractEmailsFromHtml(html);
  for (const e of extracted) {
    if (seenEmails.has(e.email)) continue;
    seenEmails.add(e.email);
    const validation = validateEmail(e.email);
    // Determine page section from source URL
    const section = e.section || sectionFromUrl(sourceUrl);
    result.emails.push({
      type: "email",
      value: e.email,
      raw: e.raw,
      confidence: validation.confidence,
      quality: validation.quality,
      sourceUrl,
      pageSection: section,
      evidence: `Publicly displayed on ${section} page (${sourceUrl})`,
    });
  }

  // WhatsApp
  const waList = detectWhatsApp(html, defaultCountry);
  for (const w of waList) {
    const key = w.e164 || w.raw;
    if (seenWa.has(key)) continue;
    seenWa.add(key);
    result.whatsapps.push({
      type: "whatsapp",
      value: w.e164 || w.phone,
      raw: w.raw,
      confidence: w.confidence,
      quality: w.confidence >= 75 ? "high" : w.confidence >= 45 ? "medium" : "low",
      sourceUrl,
      pageSection: sectionFromUrl(sourceUrl),
      evidence: `Public WhatsApp ${w.source} link on ${sectionFromUrl(sourceUrl)} page`,
    });
  }

  // Phones (from tel: links & structured data)
  const $ = cheerio.load(html);
  $('a[href^="tel:"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const raw = href.replace(/^tel:/i, "").trim();
    if (!raw) return;
    const norm = normalizePhone(raw, defaultCountry);
    const key = norm.e164 || raw;
    if (!key || seenPhones.has(key)) return;
    seenPhones.add(key);
    result.phones.push({
      type: "phone",
      value: norm.e164 || raw,
      raw,
      confidence: norm.valid ? 70 : 45,
      quality: norm.valid ? "high" : "medium",
      sourceUrl,
      pageSection: sectionFromUrl(sourceUrl),
      evidence: `Public tel: link on ${sectionFromUrl(sourceUrl)} page`,
    });
  });

  // JSON-LD phone numbers
  const jsonldPhones = extractJsonldPhones(html);
  for (const raw of jsonldPhones) {
    const norm = normalizePhone(raw, defaultCountry);
    const key = norm.e164 || raw;
    if (!key || seenPhones.has(key)) continue;
    seenPhones.add(key);
    result.phones.push({
      type: "phone",
      value: norm.e164 || raw,
      raw,
      confidence: norm.valid ? 65 : 40,
      quality: norm.valid ? "medium" : "low",
      sourceUrl,
      pageSection: "jsonld",
      evidence: `Structured data (JSON-LD) on ${sourceUrl}`,
    });
  }

  // Social profiles
  $('a[href]').each((_, el) => {
    const href = $(el).attr("href") || "";
    if (!href) return;
    for (const [net, re] of Object.entries(SOCIAL_DOMAINS)) {
      if (re.test(href)) {
        if (seenSocials.has(href)) return;
        seenSocials.add(href);
        result.socials.push({
          type: "social",
          value: href,
          raw: href,
          confidence: 60,
          quality: "medium",
          sourceUrl,
          pageSection: sectionFromUrl(sourceUrl),
          evidence: `Public ${net} profile link on ${sectionFromUrl(sourceUrl)} page`,
        });
        break;
      }
    }
  });
}

function sectionFromUrl(url: string): string {
  const u = parseUrl(url);
  if (!u) return "html";
  const p = u.pathname.toLowerCase();
  if (p === "/" || p === "") return "homepage";
  if (p.includes("contact")) return "contact";
  if (p.includes("about")) return "about";
  if (p.includes("team")) return "team";
  if (p.includes("support")) return "support";
  if (p.includes("location")) return "locations";
  if (p.includes("privacy")) return "privacy";
  if (p.includes("terms")) return "terms";
  return "html";
}

function extractJsonldPhones(html: string): string[] {
  const out: string[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const obj = JSON.parse(m[1].trim());
      collectPhones(obj, out);
    } catch {
      // ignore broken JSON-LD
    }
  }
  return out;
}

function collectPhones(node: any, out: string[]): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const n of node) collectPhones(n, out);
    return;
  }
  if (typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if ((k === "telephone" || k === "phone" || k === "contactPoint") && typeof v === "string") {
        out.push(v);
      }
      if (k === "contactPoint" && Array.isArray(v)) {
        for (const cp of v) {
          if (cp && typeof cp.telephone === "string") out.push(cp.telephone);
        }
      }
      collectPhones(v, out);
    }
  }
}
