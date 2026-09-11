// LeadPulse — Shared types (used by frontend, API routes, and worker service)

// ---------------------------------------------------------------------------
// Filter objects
// ---------------------------------------------------------------------------

export interface LocationFilters {
  country?: string;
  state?: string;
  city?: string;
  area?: string;
  postal?: string;
  radiusKm?: number;
  cities?: string[]; // multiple-city search
}

export interface BusinessFilters {
  nature?: string; // nature of business (free text / keyword)
  industry?: string;
  category?: string;
  subcategory?: string;
  keywords?: string[];
  businessType?: BusinessType;
  employeeMin?: number;
  employeeMax?: number;
  b2bB2c?: "B2B" | "B2C" | "B2B_B2C";
}

export type BusinessType =
  | "local"
  | "online"
  | "service"
  | "retail"
  | "manufacturer"
  | "distributor"
  | "agency"
  | "startup"
  | "ecommerce";

export interface ContactFilters {
  hasEmail?: boolean;
  hasWhatsApp?: boolean;
  hasPhone?: boolean;
  hasWebsite?: boolean;
  hasSocial?: boolean;
  hasContactPage?: boolean;
  multipleContacts?: boolean;
}

export interface QualityFilters {
  minScore?: number;
  minEmailConfidence?: number;
  minWhatsAppConfidence?: number;
  websiteActive?: boolean;
  businessActive?: boolean;
}

// ---------------------------------------------------------------------------
// Campaign
// ---------------------------------------------------------------------------

export type CampaignStatus =
  | "draft"
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export interface CampaignStats {
  businessesDiscovered: number;
  websitesAnalyzed: number;
  emailsDiscovered: number;
  whatsappDiscovered: number;
  phonesDiscovered: number;
  duplicatesRemoved: number;
  invalidRemoved: number;
  highQualityLeads: number;
  validContacts: number;
}

export interface Campaign extends CampaignStats {
  id: string;
  name: string;
  description?: string;
  locationFilters: LocationFilters;
  businessFilters: BusinessFilters;
  contactFilters: ContactFilters;
  qualityFilters: QualityFilters;
  target: number;
  status: CampaignStatus;
  progress: number;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Lead (as returned by API)
// ---------------------------------------------------------------------------

export type LeadStatus = "new" | "verified" | "favorite" | "rejected" | "edited";
export type LeadGrade = "excellent" | "high" | "good" | "medium" | "low";
export type EmailQuality = "high" | "medium" | "low";

export interface Lead {
  id: string;
  campaignId?: string;
  businessId?: string;
  businessName: string;
  nature?: string;
  category?: string;
  city?: string;
  country?: string;
  website?: string;
  address?: string;
  email?: string;
  emailConfidence?: number;
  emailQuality?: EmailQuality;
  whatsapp?: string;
  whatsappConfidence?: number;
  phone?: string;
  phoneConfidence?: number;
  socialUrl?: string;
  socialProfiles?: Record<string, string>;
  leadScore: number;
  leadGrade?: LeadGrade;
  status: LeadStatus;
  notes?: string;
  sourceName?: string;
  sourceUrl?: string;
  discoveredAt: string;
  createdAt: string;
  updatedAt: string;
  contacts?: Contact[];
}

export interface Contact {
  id: string;
  type: "email" | "phone" | "whatsapp" | "social" | "website";
  value: string;
  rawValue?: string;
  confidence: number;
  quality?: EmailQuality;
  verified: boolean;
  sourceUrl?: string;
  sourceName?: string;
  evidence?: string;
  pageSection?: string;
  normalized?: boolean;
  syntaxValid?: boolean;
  domainValid?: boolean;
  disposable?: boolean;
  freeProvider?: boolean;
  e164?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Source
// ---------------------------------------------------------------------------

export interface Source {
  id: string;
  name: string;
  type: "overpass" | "nominatim" | "websearch" | "website" | "directory";
  enabled: boolean;
  priority: number;
  endpoint?: string;
  apiKey?: string; // only returned to admin
  dailyLimit: number;
  perMinute: number;
  timeoutMs: number;
  retryCount: number;
  requestsToday: number;
  status: "active" | "rate_limited" | "error" | "disabled";
  lastError?: string;
  lastResetAt: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Suppression
// ---------------------------------------------------------------------------

export interface SuppressionEntry {
  id: string;
  type: "email" | "phone" | "whatsapp" | "domain" | "business_name" | "website";
  value: string;
  reason?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export interface AnalyticsData {
  totals: {
    totalLeads: number;
    todaysLeads: number;
    emails: number;
    whatsapp: number;
    phones: number;
    highQualityLeads: number;
    activeCampaigns: number;
    failedJobs: number;
    sourcesActive: number;
  };
  leadsByCountry: { label: string; value: number }[];
  leadsByCity: { label: string; value: number }[];
  leadsByIndustry: { label: string; value: number }[];
  leadQualityDistribution: { label: string; value: number }[];
  sourcePerformance: {
    name: string;
    businesses: number;
    emails: number;
    whatsapp: number;
    emailRate: number;
  }[];
  campaignStats: { label: string; value: number }[];
}

// ---------------------------------------------------------------------------
// Realtime progress (emitted over socket.io)
// ---------------------------------------------------------------------------

export interface CampaignProgressEvent {
  campaignId: string;
  status: CampaignStatus;
  progress: number;
  stats: CampaignStats;
  target: number;
  message?: string;
  recentLead?: Lead;
  error?: string;
}

export interface DashboardStats {
  totalLeads: number;
  todaysLeads: number;
  emails: number;
  whatsapp: number;
  phones: number;
  highQualityLeads: number;
  activeCampaigns: number;
  failedJobs: number;
  sourcesActive: number;
}

// ---------------------------------------------------------------------------
// Lead scoring config
// ---------------------------------------------------------------------------

export interface ScoringConfig {
  website: number;
  businessNameCategoryMatch: number;
  businessEmail: number;
  verifiedEmail: number;
  whatsappEvidence: number;
  phone: number;
  businessAddress: number;
  socialProfile: number;
  activeWebsite: number;
}

export const DEFAULT_SCORING: ScoringConfig = {
  website: 15,
  businessNameCategoryMatch: 10,
  businessEmail: 20,
  verifiedEmail: 15,
  whatsappEvidence: 15,
  phone: 5,
  businessAddress: 5,
  socialProfile: 5,
  activeWebsite: 5,
};

// ---------------------------------------------------------------------------
// Extraction job error codes
// ---------------------------------------------------------------------------

export type ErrorCode =
  | "SOURCE_RATE_LIMITED"
  | "DOMAIN_TIMEOUT"
  | "INVALID_URL"
  | "EMAIL_PARSE_ERROR"
  | "DNS_LOOKUP_FAILED"
  | "PROVIDER_ERROR"
  | "DUPLICATE_LEAD"
  | "SOURCE_BLOCKED"
  | "SSRF_BLOCKED"
  | "WORKER_ERROR";
