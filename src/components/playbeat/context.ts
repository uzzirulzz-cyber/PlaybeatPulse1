'use client'

// PlayBeat — shared view-switching types & context
import * as React from 'react'

export type PbView = 'landing' | 'login' | 'admin'

export type AdminSection =
  | 'overview'
  | 'extract'
  | 'leads'
  | 'jobs'
  | 'sources'
  | 'bots'
  | 'exports'
  | 'audit-logs'
  | 'rules'

export interface PbNavigateOptions {
  campaignId?: string
  section?: AdminSection
}

export interface PbContextValue {
  view: PbView
  setView: (v: PbView) => void
  admin: { id: string; email: string; role: string; name?: string } | null
  setAdmin: (a: PbContextValue['admin']) => void
  goToAdmin: (section?: AdminSection, opts?: PbNavigateOptions) => void
  campaignIdContext?: string
  setCampaignIdContext: (id?: string) => void
  /** Section the admin should display (synced between SPA and AdminView). */
  adminSection: AdminSection
  setAdminSection: (s: AdminSection) => void
}

export const PbContext = React.createContext<PbContextValue | null>(null)

export function usePb(): PbContextValue {
  const ctx = React.useContext(PbContext)
  if (!ctx) throw new Error('usePb must be used within PbContext.Provider')
  return ctx
}
