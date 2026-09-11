// LeadPulse — Lead scoring (0-100) & grading
import type { ScoringConfig, LeadGrade, EmailQuality } from "./types";
import { DEFAULT_SCORING } from "./types";
import type { NormalizedPhone } from "./phone";

export interface ScoreInput {
  hasWebsite: boolean;
  hasBusinessName: boolean;
  hasCategoryMatch: boolean; // business category matches campaign target
  hasBusinessEmail: boolean; // email on business domain
  hasVerifiedEmail: boolean; // high-confidence email
  hasWhatsAppEvidence: boolean; // public wa.me / api.whatsapp.com link
  hasPhone: boolean;
  hasAddress: boolean;
  hasSocial: boolean;
  websiteActive: boolean;
}

export interface ScoreResult {
  score: number;       // 0-100
  grade: LeadGrade;
  breakdown: Partial<Record<keyof ScoringConfig, number>>;
}

export function computeLeadScore(input: ScoreInput, config: ScoringConfig = DEFAULT_SCORING): ScoreResult {
  const breakdown: Partial<Record<keyof ScoringConfig, number>> = {};

  if (input.hasWebsite) breakdown.website = config.website;
  if (input.hasBusinessName && input.hasCategoryMatch) breakdown.businessNameCategoryMatch = config.businessNameCategoryMatch;
  if (input.hasBusinessEmail) breakdown.businessEmail = config.businessEmail;
  if (input.hasVerifiedEmail) breakdown.verifiedEmail = config.verifiedEmail;
  if (input.hasWhatsAppEvidence) breakdown.whatsappEvidence = config.whatsappEvidence;
  if (input.hasPhone) breakdown.phone = config.phone;
  if (input.hasAddress) breakdown.businessAddress = config.businessAddress;
  if (input.hasSocial) breakdown.socialProfile = config.socialProfile;
  if (input.websiteActive) breakdown.activeWebsite = config.activeWebsite;

  const score = Math.min(100, Math.round(Object.values(breakdown).reduce((a, b) => a + (b || 0), 0)));
  return { score, grade: gradeFromScore(score), breakdown };
}

export function gradeFromScore(score: number): LeadGrade {
  if (score >= 90) return "excellent";
  if (score >= 75) return "high";
  if (score >= 60) return "good";
  if (score >= 40) return "medium";
  return "low";
}

export function qualityFromConfidence(confidence: number | undefined): EmailQuality {
  if (confidence === undefined) return "low";
  if (confidence >= 75) return "high";
  if (confidence >= 45) return "medium";
  return "low";
}

// Helper to build a ScoreInput from a raw discovered business/lead shape
export interface RawLeadShape {
  website?: string | null;
  businessName?: string | null;
  categoryMatch?: boolean;
  businessEmail?: boolean;
  verifiedEmail?: boolean;
  hasWhatsAppLink?: boolean;
  phone?: string | null;
  address?: string | null;
  social?: Record<string, string> | null;
  websiteActive?: boolean;
}

export function scoreFromRaw(raw: RawLeadShape, config: ScoringConfig = DEFAULT_SCORING): ScoreResult {
  return computeLeadScore(
    {
      hasWebsite: !!raw.website,
      hasBusinessName: !!raw.businessName,
      hasCategoryMatch: !!raw.categoryMatch,
      hasBusinessEmail: !!raw.businessEmail,
      hasVerifiedEmail: !!raw.verifiedEmail,
      hasWhatsAppEvidence: !!raw.hasWhatsAppLink,
      hasPhone: !!raw.phone,
      hasAddress: !!raw.address,
      hasSocial: !!raw.social && Object.keys(raw.social).length > 0,
      websiteActive: !!raw.websiteActive,
    },
    config
  );
}

// Convenience for phone confidence → quality label
export { DEFAULT_SCORING };
