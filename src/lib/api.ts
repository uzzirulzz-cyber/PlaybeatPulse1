// LeadPulse — Frontend API client & socket.io helper
// All requests use relative paths. Cross-port (worker) requests use ?XTransformPort=3003.
import type {
  Campaign, Lead, Source, SuppressionEntry, AnalyticsData, DashboardStats,
  CampaignProgressEvent, ScoringConfig, CampaignLimits,
} from "./types";
import { io, type Socket } from "socket.io-client";

const WORKER_PORT = "3003";

// ---------------------------------------------------------------------------
// REST helpers
// ---------------------------------------------------------------------------

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j.error || j.message || msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

export interface CreateCampaignInput {
  name: string;
  description?: string;
  locationFilters: any;
  businessFilters: any;
  contactFilters: any;
  qualityFilters: any;
  target: number;
}

export const campaignsApi = {
  list: () => api<Campaign[]>("/api/campaigns"),
  get: (id: string) => api<Campaign>(`/api/campaigns/${id}`),
  create: (data: CreateCampaignInput) => api<Campaign>("/api/campaigns", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<CreateCampaignInput>) => api<Campaign>(`/api/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (id: string) => api<void>(`/api/campaigns/${id}`, { method: "DELETE" }),
  start: (id: string) => api<Campaign>(`/api/campaigns/${id}/start`, { method: "POST" }),
  pause: (id: string) => api<Campaign>(`/api/campaigns/${id}/pause`, { method: "POST" }),
  resume: (id: string) => api<Campaign>(`/api/campaigns/${id}/resume`, { method: "POST" }),
  cancel: (id: string) => api<Campaign>(`/api/campaigns/${id}/cancel`, { method: "POST" }),
  leads: (id: string, params?: Record<string, string | number>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => q.set(k, String(v)));
    return api<{ data: Lead[]; total: number }>(`/api/campaigns/${id}/leads?${q.toString()}`);
  },
};

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export interface LeadQuery {
  search?: string;
  campaignId?: string;
  country?: string;
  city?: string;
  category?: string;
  minScore?: number;
  hasEmail?: boolean;
  hasWhatsApp?: boolean;
  hasPhone?: boolean;
  status?: string;
  page?: number;
  pageSize?: number;
}

export const leadsApi = {
  list: (q: LeadQuery = {}) => {
    const p = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => { if (v !== undefined && v !== "") p.set(k, String(v)); });
    return api<{ data: Lead[]; total: number }>(`/api/leads?${p.toString()}`);
  },
  get: (id: string) => api<Lead>(`/api/leads/${id}`),
  update: (id: string, data: Partial<Lead>) => api<Lead>(`/api/leads/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (id: string) => api<void>(`/api/leads/${id}`, { method: "DELETE" }),
  export: (data: { format: "csv" | "xlsx"; scope: "all" | "campaign" | "filtered" | "selected"; campaignId?: string; filters?: LeadQuery; ids?: string[] }) =>
    api<{ id: string; fileUrl: string; leadCount: number }>("/api/leads/export", { method: "POST", body: JSON.stringify(data) }),
};

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

export const sourcesApi = {
  list: () => api<Source[]>("/api/sources"),
  create: (data: Partial<Source>) => api<Source>("/api/sources", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Source>) => api<Source>(`/api/sources/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (id: string) => api<void>(`/api/sources/${id}`, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Suppression
// ---------------------------------------------------------------------------

export const suppressionApi = {
  list: () => api<SuppressionEntry[]>("/api/suppression"),
  create: (data: { type: string; value: string; reason?: string }) => api<SuppressionEntry>("/api/suppression", { method: "POST", body: JSON.stringify(data) }),
  remove: (id: string) => api<void>(`/api/suppression/${id}`, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Analytics & Dashboard
// ---------------------------------------------------------------------------

export const analyticsApi = {
  get: () => api<AnalyticsData>("/api/analytics"),
  dashboard: () => api<DashboardStats>("/api/dashboard"),
};

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const settingsApi = {
  getScoring: () => api<ScoringConfig>("/api/settings/scoring"),
  setScoring: (cfg: ScoringConfig) => api<ScoringConfig>("/api/settings/scoring", { method: "PUT", body: JSON.stringify(cfg) }),
  getLimits: () => api<CampaignLimits>("/api/settings/limits"),
  setLimits: (limits: CampaignLimits) => api<CampaignLimits>("/api/settings/limits", { method: "PUT", body: JSON.stringify(limits) }),
  getCompliance: () => api<{ notice: string }>("/api/settings/compliance"),
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const exportsApi = {
  list: () => api<any[]>("/api/exports"),
  download: (fileUrl: string) => window.open(fileUrl, "_blank"),
};

// ---------------------------------------------------------------------------
// Worker (in-process batch processor — polled by frontend)
// ---------------------------------------------------------------------------

export interface TickResult {
  campaignId: string | null;
  status: string;
  progress: number;
  stats: {
    businessesDiscovered: number;
    websitesAnalyzed: number;
    emailsDiscovered: number;
    whatsappDiscovered: number;
    phonesDiscovered: number;
    duplicatesRemoved: number;
    invalidRemoved: number;
    highQualityLeads: number;
    validContacts: number;
  };
  target: number;
  message: string;
  recentLead?: any;
  done: boolean;
}

export const workerApi = {
  // Process a batch of the given campaign (or next queued). Returns progress.
  tick: (campaignId?: string) =>
    api<TickResult>(`/api/worker/tick${campaignId ? `?campaignId=${campaignId}` : ""}`, { method: "POST" }),
  status: () => api<{ ok: boolean; activeCampaignId: string | null; mode: string }>("/api/worker/tick"),
};

// ---------------------------------------------------------------------------
// Realtime (socket.io to worker on port 3003 via gateway)
// ---------------------------------------------------------------------------

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(`/?XTransformPort=${WORKER_PORT}`, {
    transports: ["websocket", "polling"],
    forceNew: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1500,
    timeout: 10000,
  });
  return socket;
}

export function subscribeToCampaign(campaignId: string, onProgress: (e: CampaignProgressEvent) => void, onCompleted?: (e: any) => void, onFailed?: (e: any) => void) {
  const s = getSocket();
  s.emit("subscribe", campaignId);
  const handler = (e: CampaignProgressEvent) => { if (e.campaignId === campaignId) onProgress(e); };
  const doneHandler = (e: any) => { if (e.campaignId === campaignId) onCompleted?.(e); };
  const failHandler = (e: any) => { if (e.campaignId === campaignId) onFailed?.(e); };
  s.on("campaign:progress", handler);
  s.on("campaign:completed", doneHandler);
  s.on("campaign:failed", failHandler);
  return () => {
    s.emit("unsubscribe", campaignId);
    s.off("campaign:progress", handler);
    s.off("campaign:completed", doneHandler);
    s.off("campaign:failed", failHandler);
  };
}

export function subscribeToDashboard(onUpdate: (e: CampaignProgressEvent) => void) {
  const s = getSocket();
  s.on("dashboard:update", onUpdate);
  return () => s.off("dashboard:update", onUpdate);
}
