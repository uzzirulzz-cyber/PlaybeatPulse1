// LeadPulse — System settings helpers (reads/writes SystemSetting table)
import { db } from "./db";
import { DEFAULT_SCORING } from "./types";
import type { ScoringConfig } from "./types";

export const SETTINGS_KEYS = {
  scoring: "scoring_config",
  campaignLimits: "campaign_limits",
  workerConcurrency: "worker_concurrency",
  complianceNotice: "compliance_notice",
} as const;

export async function getScoringConfig(): Promise<ScoringConfig> {
  const row = await db.systemSetting.findUnique({ where: { key: SETTINGS_KEYS.scoring } });
  if (!row) return DEFAULT_SCORING;
  try {
    return { ...DEFAULT_SCORING, ...JSON.parse(row.value) };
  } catch {
    return DEFAULT_SCORING;
  }
}

export async function setScoringConfig(cfg: ScoringConfig): Promise<ScoringConfig> {
  const clamped: ScoringConfig = {
    website: clamp(cfg.website),
    businessNameCategoryMatch: clamp(cfg.businessNameCategoryMatch),
    businessEmail: clamp(cfg.businessEmail),
    verifiedEmail: clamp(cfg.verifiedEmail),
    whatsappEvidence: clamp(cfg.whatsappEvidence),
    phone: clamp(cfg.phone),
    businessAddress: clamp(cfg.businessAddress),
    socialProfile: clamp(cfg.socialProfile),
    activeWebsite: clamp(cfg.activeWebsite),
  };
  await db.systemSetting.upsert({
    where: { key: SETTINGS_KEYS.scoring },
    create: { key: SETTINGS_KEYS.scoring, value: JSON.stringify(clamped), category: "scoring" },
    update: { value: JSON.stringify(clamped) },
  });
  return clamped;
}

function clamp(n: number): number {
  if (isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export interface CampaignLimits {
  maxConcurrentCampaigns: number;
  maxTargetPerCampaign: number;
  maxWebsitesPerCampaign: number;
}

export const DEFAULT_CAMPAIGN_LIMITS: CampaignLimits = {
  maxConcurrentCampaigns: 2,
  maxTargetPerCampaign: 5000,
  maxWebsitesPerCampaign: 800,
};

export async function getCampaignLimits(): Promise<CampaignLimits> {
  const row = await db.systemSetting.findUnique({ where: { key: SETTINGS_KEYS.campaignLimits } });
  if (!row) return DEFAULT_CAMPAIGN_LIMITS;
  try {
    return { ...DEFAULT_CAMPAIGN_LIMITS, ...JSON.parse(row.value) };
  } catch {
    return DEFAULT_CAMPAIGN_LIMITS;
  }
}

export async function setCampaignLimits(limits: CampaignLimits): Promise<CampaignLimits> {
  const v = { ...DEFAULT_CAMPAIGN_LIMITS, ...limits };
  await db.systemSetting.upsert({
    where: { key: SETTINGS_KEYS.campaignLimits },
    create: { key: SETTINGS_KEYS.campaignLimits, value: JSON.stringify(v), category: "limits" },
    update: { value: JSON.stringify(v) },
  });
  return v;
}

export const DEFAULT_COMPLIANCE_NOTICE =
  "LeadPulse only collects publicly available business contact information from permitted sources (OpenStreetMap, public business websites, and authorized APIs/datasets). Users are responsible for lawful use of collected business contact information in accordance with applicable privacy laws (including GDPR), website terms, API terms, and applicable rate limits. Do not use this data to send unsolicited communications where prohibited. Businesses may request removal via the Suppression List.";

export async function getComplianceNotice(): Promise<string> {
  const row = await db.systemSetting.findUnique({ where: { key: SETTINGS_KEYS.complianceNotice } });
  return row?.value || DEFAULT_COMPLIANCE_NOTICE;
}

// Seed default settings + default sources on first run
export async function seedDefaults(): Promise<void> {
  const existing = await db.source.count();
  if (existing === 0) {
    await db.source.createMany({
      data: [
        {
          name: "OpenStreetMap Overpass",
          type: "overpass",
          enabled: true,
          priority: 10,
          endpoint: "https://overpass-api.de/api/interpreter",
          dailyLimit: 10000,
          perMinute: 30,
          timeoutMs: 45000,
          retryCount: 3,
          status: "active",
        },
        {
          name: "Nominatim Geocoder",
          type: "nominatim",
          enabled: true,
          priority: 20,
          endpoint: "https://nominatim.openstreetmap.org",
          dailyLimit: 1000,
          perMinute: 15,
          timeoutMs: 20000,
          retryCount: 2,
          status: "active",
        },
        {
          name: "Website Contact Analyzer",
          type: "website",
          enabled: true,
          priority: 30,
          dailyLimit: 1500,
          perMinute: 30,
          timeoutMs: 15000,
          retryCount: 2,
          status: "active",
        },
        {
          name: "Web Search (z-ai)",
          type: "websearch",
          enabled: true,
          priority: 40,
          dailyLimit: 200,
          perMinute: 10,
          timeoutMs: 30000,
          retryCount: 2,
          status: "active",
        },
      ],
    });
  }
  // Ensure scoring config exists
  const sc = await db.systemSetting.findUnique({ where: { key: SETTINGS_KEYS.scoring } });
  if (!sc) {
    await db.systemSetting.create({
      data: { key: SETTINGS_KEYS.scoring, value: JSON.stringify(DEFAULT_SCORING), category: "scoring" },
    });
  }
  const cl = await db.systemSetting.findUnique({ where: { key: SETTINGS_KEYS.campaignLimits } });
  if (!cl) {
    await db.systemSetting.create({
      data: { key: SETTINGS_KEYS.campaignLimits, value: JSON.stringify(DEFAULT_CAMPAIGN_LIMITS), category: "limits" },
    });
  }
  const cn = await db.systemSetting.findUnique({ where: { key: SETTINGS_KEYS.complianceNotice } });
  if (!cn) {
    await db.systemSetting.create({
      data: { key: SETTINGS_KEYS.complianceNotice, value: DEFAULT_COMPLIANCE_NOTICE, category: "compliance" },
    });
  }
}
