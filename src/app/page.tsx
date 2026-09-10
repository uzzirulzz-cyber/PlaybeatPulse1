'use client'

import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  LayoutDashboard, Radar, Megaphone, Users, Download, BarChart3,
  Database, Ban, Settings as SettingsIcon, Menu, Sun, Moon, ShieldCheck,
  Activity, Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useTheme } from 'next-themes'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { workerApi, campaignsApi } from '@/lib/api'

import { DashboardSection } from '@/components/sections/dashboard'
import { FindLeadsSection } from '@/components/sections/find-leads'
import { CampaignsSection } from '@/components/sections/campaigns'
import { LeadsSection } from '@/components/sections/leads'
import { ExportsSection } from '@/components/sections/exports'
import { AnalyticsSection } from '@/components/sections/analytics'
import { SourcesSection } from '@/components/sections/sources'
import { SuppressionSection } from '@/components/sections/suppression'
import { SettingsSection } from '@/components/sections/settings'

type SectionId =
  | 'dashboard' | 'find-leads' | 'campaigns' | 'leads' | 'exports'
  | 'analytics' | 'sources' | 'suppression' | 'settings'

interface NavItem {
  id: SectionId
  label: string
  icon: typeof LayoutDashboard
  description: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Real-time overview of your lead pipeline' },
  { id: 'find-leads', label: 'Find Leads', icon: Radar, description: 'Configure and launch a new discovery campaign' },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone, description: 'Manage active and historical discovery campaigns' },
  { id: 'leads', label: 'Leads', icon: Users, description: 'Browse, filter, verify and export discovered business leads' },
  { id: 'exports', label: 'Exports', icon: Download, description: 'Download CSV / XLSX exports of discovered leads' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, description: 'Geographic & industry analytics from real lead data' },
  { id: 'sources', label: 'Sources', icon: Database, description: 'Configure discovery sources, rate limits and API keys' },
  { id: 'suppression', label: 'Suppression List', icon: Ban, description: 'Block emails, phones, domains and businesses from results' },
  { id: 'settings', label: 'Settings', icon: SettingsIcon, description: 'Lead scoring weights, campaign limits & compliance' },
]

const COMPLIANCE_NOTICE =
  'LeadPulse discovers public business contact data from permitted sources (OpenStreetMap Overpass API, Nominatim geocoding, and public website contact pages). All data is sourced from publicly available information. Users are responsible for ensuring their use of any discovered contact information complies with applicable laws (CAN-SPAM, GDPR, CCPA, ePrivacy, and local regulations) and with the terms of service of the original data sources. Always honor opt-out requests and never use contact data for unsolicited commercial communications where prohibited.'

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
        <Zap className="size-5" fill="currentColor" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold tracking-tight">LeadPulse</p>
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Lead Generator
        </p>
      </div>
    </div>
  )
}

function NavList({
  active,
  onNavigate,
}: {
  active: SectionId
  onNavigate: (id: SectionId) => void
}) {
  return (
    <nav className="flex flex-col gap-1 px-3 py-2" aria-label="Primary">
      {NAV_ITEMS.map((item) => {
        const isActive = active === item.id
        const Icon = item.icon
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'group flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'text-muted-foreground'
            )}
          >
            <Icon
              className={cn(
                'size-4 shrink-0',
                isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground group-hover:text-foreground'
              )}
            />
            <span className="truncate">{item.label}</span>
            {isActive && (
              <span className="ml-auto size-1.5 rounded-full bg-emerald-500" aria-hidden />
            )}
          </button>
        )
      })}
    </nav>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  const isDark = mounted && theme === 'dark'
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="size-9"
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}

function WorkerIndicator() {
  const [status, setStatus] = React.useState<'online' | 'offline' | 'checking'>('checking')
  const [activeCampaign, setActiveCampaign] = React.useState<string | null>(null)
  React.useEffect(() => {
    let mounted = true
    let timer: ReturnType<typeof setTimeout> | null = null
    async function check() {
      try {
        const res = await fetch('/api/worker/tick')
        if (!mounted) return
        if (res.ok) {
          const j = await res.json()
          setStatus('online')
          setActiveCampaign(j.activeCampaignId || null)
        } else {
          setStatus('offline')
        }
      } catch {
        if (mounted) setStatus('offline')
      }
      if (mounted) timer = setTimeout(check, 15000)
    }
    check()
    return () => {
      mounted = false
      if (timer) clearTimeout(timer)
    }
  }, [])
  const ok = status === 'online'
  return (
    <div
      className={cn(
        'hidden items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium sm:flex',
        ok
          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : status === 'offline'
            ? 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400'
            : 'border-border bg-muted text-muted-foreground'
      )}
      title={ok ? (activeCampaign ? `Processing campaign ${activeCampaign.slice(-8)}` : 'Worker ready (in-process)') : 'Worker offline'}
    >
      <span className="relative flex size-2">
        {ok && activeCampaign && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={cn(
            'relative inline-flex size-2 rounded-full',
            ok ? 'bg-emerald-500' : status === 'offline' ? 'bg-rose-500' : 'bg-muted-foreground'
          )}
        />
      </span>
      <span>Worker: {ok ? (activeCampaign ? 'Processing' : 'Ready') : status === 'offline' ? 'Offline' : 'Checking…'}</span>
    </div>
  )
}

function ComplianceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  // Use a simple inline modal-like alert dialog
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetTitle className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-emerald-600" /> Compliance &amp; Responsible Use
        </SheetTitle>
        <div className="flex-1 overflow-y-auto px-4 pb-6 text-sm leading-relaxed text-muted-foreground">
          <p className="mt-2">{COMPLIANCE_NOTICE}</p>
          <ul className="mt-4 list-disc space-y-1 pl-5">
            <li>OpenStreetMap data is © OpenStreetMap contributors, ODbL licensed.</li>
            <li>Nominatim usage policy must be respected (max 1 req/sec).</li>
            <li>All website fetches are SSRF-protected (no localhost / private ranges / metadata endpoints).</li>
            <li>Never use discovered contact data for unsolicited commercial communications where prohibited by law.</li>
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default function Home() {
  const [section, setSection] = React.useState<SectionId>('dashboard')
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)
  const [complianceOpen, setComplianceOpen] = React.useState(false)
  const [leadsFilter, setLeadsFilter] = React.useState<{ campaignId?: string } | null>(null)
  // Allow other sections to programmatically navigate (e.g. Find Leads → Campaigns, Leads filtered by campaign)
  const navigate = React.useCallback((id: string, opts?: { campaignId?: string }) => {
    const targetId = id as SectionId
    setSection(targetId)
    setMobileNavOpen(false)
    if (targetId === 'leads' && opts?.campaignId) {
      setLeadsFilter({ campaignId: opts.campaignId })
    } else if (targetId === 'leads') {
      // Clear filter when navigating to leads without explicit filter
      setLeadsFilter(null)
    }
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const activeItem = NAV_ITEMS.find((i) => i.id === section)!

  // Global worker tick poller — drives in-process batch processing of campaigns
  // regardless of which section is active. Polls every 3s when a campaign is
  // queued or running; polls every 10s when idle so it picks up new campaigns.
  const qc = useQueryClient()
  React.useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    async function checkAndTick() {
      if (cancelled) return
      let nextDelay = 10000 // idle poll interval
      try {
        const list = await campaignsApi.list().catch(() => [])
        const active = list.filter((c) => c.status === 'running' || c.status === 'queued')
        qc.setQueryData(['campaigns'], list)
        if (active.length > 0) {
          // Tick the first active campaign
          const res = await workerApi.tick(active[0].id)
          if (!cancelled) {
            qc.invalidateQueries({ queryKey: ['campaigns'] })
            if (res.recentLead) {
              qc.invalidateQueries({ queryKey: ['leads'] })
              qc.invalidateQueries({ queryKey: ['dashboard'] })
              qc.invalidateQueries({ queryKey: ['analytics'] })
            }
          }
          nextDelay = 3000 // active poll interval
        }
      } catch {
        // silent retry
      }
      if (!cancelled) {
        timer = setTimeout(checkAndTick, nextDelay)
      }
    }

    checkAndTick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [qc])

  const renderSection = () => {
    switch (section) {
      case 'dashboard': return <DashboardSection navigate={navigate} />
      case 'find-leads': return <FindLeadsSection navigate={navigate} />
      case 'campaigns': return <CampaignsSection navigate={navigate} />
      case 'leads': return <LeadsSection key={leadsFilter?.campaignId ?? 'all'} navigate={navigate} initialFilters={leadsFilter ? { campaignId: leadsFilter.campaignId } : undefined} />
      case 'exports': return <ExportsSection />
      case 'analytics': return <AnalyticsSection />
      case 'sources': return <SourcesSection />
      case 'suppression': return <SuppressionSection />
      case 'settings': return <SettingsSection />
      default: return null
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Top bar (mobile) + Desktop shell */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
          {/* Mobile menu */}
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex h-14 items-center border-b px-4">
                <Logo />
              </div>
              <div className="flex-1 overflow-y-auto py-2">
                <NavList active={section} onNavigate={navigate} />
              </div>
              <div className="border-t p-3 text-xs text-muted-foreground">
                <p>LeadPulse · v1.0</p>
                <p className="mt-0.5">Real public business lead discovery</p>
              </div>
            </SheetContent>
          </Sheet>

          {/* Desktop logo */}
          <div className="hidden lg:flex lg:w-64 lg:shrink-0 lg:items-center lg:border-r lg:pr-4">
            <button
              type="button"
              onClick={() => navigate('dashboard')}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
            >
              <Logo />
            </button>
          </div>

          {/* Section title */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <activeItem.icon className="size-4 text-emerald-600 dark:text-emerald-400" />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold sm:text-base">{activeItem.label}</h1>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">{activeItem.description}</p>
            </div>
          </div>

          <WorkerIndicator />
          <ThemeToggle />
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 border-r bg-card/30 lg:flex lg:flex-col">
          <div className="flex-1 overflow-y-auto">
            <NavList active={section} onNavigate={navigate} />
          </div>
          <div className="border-t p-3">
            <button
              type="button"
              onClick={() => setComplianceOpen(true)}
              className="flex w-full items-start gap-2 rounded-md p-2 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
              <span>Compliance &amp; responsible use</span>
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:px-6 sm:py-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={section}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                {renderSection()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Sticky footer */}
      <footer className="mt-auto border-t bg-card/30">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="flex items-center gap-1.5">
            <Activity className="size-3.5 text-emerald-600" />
            <span>
              LeadPulse · Public business lead discovery from permitted sources
              (OpenStreetMap + public websites). Users are responsible for lawful use.
            </span>
          </p>
          <button
            type="button"
            onClick={() => setComplianceOpen(true)}
            className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline"
          >
            <ShieldCheck className="size-3.5" /> Compliance notice
          </button>
        </div>
      </footer>

      <ComplianceDialog open={complianceOpen} onOpenChange={setComplianceOpen} />
    </div>
  )
}
