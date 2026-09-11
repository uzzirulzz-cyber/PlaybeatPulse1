// WebsiteContactAnalyzerProvider — fetches + analyzes public website contact pages
import type { WebsiteProvider, WebsiteAnalysisResult, ExtractedContact } from "./index";
import { analyzeWebsite } from "../lib/website";

export class WebsiteContactAnalyzerProvider implements WebsiteProvider {
  readonly name = "Website Contact Analyzer";

  async analyze(
    url: string,
    opts: { defaultCountry?: string; maxPages?: number; timeoutMs?: number }
  ): Promise<WebsiteAnalysisResult> {
    const result = await analyzeWebsite(url, {
      defaultCountry: opts.defaultCountry,
      maxPages: opts.maxPages ?? 2,
      timeoutMs: opts.timeoutMs ?? 5000,
    });
    return {
      url: result.url,
      status: result.status as any,
      emails: result.emails.map(e => ({ type: "email" as const, value: e.value, raw: e.raw, confidence: e.confidence, quality: e.quality as any, sourceUrl: e.sourceUrl, pageSection: e.pageSection, evidence: e.evidence })),
      whatsapps: result.whatsapps.map(w => ({ type: "whatsapp" as const, value: w.value, raw: w.raw, confidence: w.confidence, quality: w.quality as any, sourceUrl: w.sourceUrl, pageSection: w.pageSection, evidence: w.evidence })),
      phones: result.phones.map(p => ({ type: "phone" as const, value: p.value, raw: p.raw, confidence: p.confidence, quality: p.quality as any, sourceUrl: p.sourceUrl, pageSection: p.pageSection, evidence: p.evidence })),
      socials: result.socials.map(s => ({ type: "social" as const, value: s.value, raw: s.raw, confidence: s.confidence, quality: s.quality as any, sourceUrl: s.sourceUrl, pageSection: s.pageSection, evidence: s.evidence })),
      pagesAnalyzed: result.pagesAnalyzed,
      title: result.title,
      siteMentionsWhatsApp: result.siteMentionsWhatsApp,
      error: result.error,
    };
  }
}
