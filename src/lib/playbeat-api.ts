// PlayBeat Lead Extractor — Frontend API client
// All admin API calls go through this. Cookie is sent automatically (same-origin).
// On 401 -> throw Error("UNAUTHORIZED") so the SPA can flip to the login view.

export class UnauthorizedError extends Error {
  constructor() {
    super("UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    credentials: "same-origin",
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export interface AdminProfile {
  id: string;
  email: string;
  role: string;
  name?: string;
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

export interface HealthStatus {
  status: "ok" | "degraded" | "down";
  version: string;
  uptime: number;
  timestamp: string;
  checks: {
    api: { status: string; message: string };
    database: { status: string; message: string };
    bots: { status: string; summary: any };
    sources: { status: string; active: number; total: number };
  };
}

export interface LeadList {
  data: any[];
  total: number;
}

export interface ExtractionJobListResponse {
  data?: any[];
  total?: number;
}

export interface WorkerTickResult {
  campaignId: string | null;
  status: string;
  message?: string;
  progress?: number;
  done?: boolean;
  stats?: {
    businessesDiscovered?: number;
    websitesAnalyzed?: number;
    emailsDiscovered?: number;
    whatsappDiscovered?: number;
    phonesDiscovered?: number;
    duplicatesRemoved?: number;
    invalidRemoved?: number;
    highQualityLeads?: number;
    validContacts?: number;
  };
  recentLead?: any;
  error?: string;
}

export interface AuditLogsResponse {
  data: any[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BotRunsResponse {
  bot: any;
  runs: any[];
}

export const pbApi = {
  // Auth
  login: (email: string, password: string) =>
    api<{ admin: AdminProfile; expiresAt: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => api<void>("/api/auth/logout", { method: "POST" }),
  me: () => api<AdminProfile>("/api/admin/me"),

  // Public endpoints
  health: () => api<HealthStatus>("/api/health"),

  // Admin data
  dashboard: () => api<DashboardStats>("/api/dashboard"),
  extractLeads: (data: {
    category: string;
    city: string;
    country: string;
    target: number;
    sources?: string[];
    requiredFields?: string[];
    verificationLevel?: string;
  }) => api<any>("/api/leads/extract", { method: "POST", body: JSON.stringify(data) }),
  extractionJobs: () => api<any[]>("/api/extraction-jobs"),
  leads: (params: Record<string, string | number | boolean | undefined>) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
    });
    return api<LeadList>(`/api/leads?${sp.toString()}`);
  },
  leadDetail: (id: string) => api<any>(`/api/leads/${id}`),
  deleteLead: (id: string) => api<void>(`/api/leads/${id}`, { method: "DELETE" }),
  bots: () => api<any[]>("/api/bots"),
  botDetail: (type: string) => api<BotRunsResponse>(`/api/bots/${type}`),
  botControl: (type: string, action: "enable" | "disable" | "restart") =>
    api<any>(`/api/bots/${type}/${action}`, { method: "POST" }),
  sources: () => api<any[]>("/api/sources"),
  updateSource: (id: string, data: any) =>
    api<any>(`/api/sources/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  auditLogs: (page: number) =>
    api<AuditLogsResponse>(`/api/audit-logs?page=${page}&pageSize=50`),
  rules: () => api<any[]>("/api/rules"),
  exports: () => api<any[]>("/api/exports"),
  exportLeads: (data: {
    format: "csv" | "xlsx" | "json";
    scope: "all" | "filtered" | "campaign" | "selected";
    campaignId?: string;
    filters?: any;
    ids?: string[];
  }) => api<{ id: string; fileUrl: string; leadCount: number }>("/api/leads/export", {
    method: "POST",
    body: JSON.stringify(data),
  }),
  workerTick: (campaignId: string) =>
    api<WorkerTickResult>(`/api/worker/tick?campaignId=${campaignId}&budget=8000`, {
      method: "POST",
    }),
  retryJob: (id: string) =>
    api<any>(`/api/extraction-jobs/${id}/retry`, { method: "POST" }),
};
