'use client'

// PlayBeat — Admin shell (sidebar + topbar) hosting the 9 admin sections
import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  LayoutDashboard, Radar, Users, Briefcase, Database,
  Bot, Download, ScrollText, BookCheck, Menu, LogOut,
  Activity, RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useToast } from '@/hooks/use-toast'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { usePb, type AdminSection } from '@/components/playbeat/context'
import { PlayBeatLogo, StatusDot } from '@/components/playbeat/ui'
import { pbApi } from '@/lib/playbeat-api'

import { OverviewSection } from '@/components/admin/overview'
import { ExtractSection } from '@/components/admin/extract'
import { LeadsSection } from '@/components/admin/leads'
import { JobsSection } from '@/components/admin/jobs'
import { SourcesSection } from '@/components/admin/sources'
import { BotsSection } from '@/components/admin/bots'
import { ExportsSection } from '@/components/admin/exports'
import { AuditLogsSection } from '@/components/admin/audit-logs'
import { RulesSection } from '@/components/admin/rules'

interface NavItem {
  id: AdminSection
  label: string
  icon: typeof LayoutDashboard
  description: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, description: 'Dashboard summary & system health' },
  { id: 'extract', label: 'Extract Leads', icon: Radar, description: 'Launch a new extraction job (min 1,000 leads)' },
  { id: 'leads', label: 'Leads', icon: Users, description: 'Browse, filter & verify discovered leads' },
  { id: 'jobs', label: 'Jobs', icon: Briefcase, description: 'Extraction jobs & live progress' },
  { id: 'sources', label: 'Sources', icon: Database, description: 'Configure permitted data sources' },
  { id: 'bots', label: 'Bots', icon: Bot, description: '10-bot automation control center' },
  { id: 'exports', label: 'Exports', icon: Download, description: 'Download CSV / XLSX / JSON exports' },
  { id: 'audit-logs', label: 'Audit Logs', icon: ScrollText, description: 'Immutable admin activity log' },
  { id: 'rules', label: 'Rules', icon: BookCheck, description: '16 server-enforced operating rules' },
]

function NavList({
  active,
  onNavigate,
}: {
  active: AdminSection
  onNavigate: (id: AdminSection) => void
}) {
  return (
    <nav className="flex flex-col gap-1 px-3 py-2" aria-label="Admin sections">
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
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50',
              isActive
                ? 'bg-cyan-400/15 text-cyan-300 shadow-[0_0_14px_rgba(0,212,255,0.18)]'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
            )}
          >
            <Icon
              className={cn(
                'size-4 shrink-0',
                isActive ? 'text-cyan-300' : 'text-slate-500 group-hover:text-slate-300'
              )}
            />
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}

function Sidebar({ active, onNavigate }: { active: AdminSection; onNavigate: (id: AdminSection) => void }) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-cyan-400/15 bg-[#0a1628]/80 backdrop-blur-md lg:flex">
      <div className="flex h-16 items-center border-b border-cyan-400/15 px-4">
        <PlayBeatLogo size="sm" onClick={() => onNavigate('overview')} />
      </div>
      <div className="flex-1 overflow-y-auto pb-scroll">
        <NavList active={active} onNavigate={onNavigate} />
      </div>
      <div className="border-t border-cyan-400/15 p-3">
        <div className="rounded-lg bg-cyan-400/5 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
            MORE LEADS
          </p>
          <p className="text-[10px] text-slate-400">SMARTER GROWTH</p>
        </div>
      </div>
    </aside>
  )
}

function TopBar({
  active,
  onOpenMobileNav,
  onLogout,
  adminEmail,
}: {
  active: AdminSection
  onOpenMobileNav: () => void
  onLogout: () => void
  adminEmail: string
}) {
  const item = NAV_ITEMS.find((n) => n.id === active)
  const Icon = item?.icon ?? LayoutDashboard
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-cyan-400/15 bg-[#020617]/80 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="lg:hidden text-slate-300 hover:bg-white/5"
          onClick={onOpenMobileNav}
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </Button>
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
            <Icon className="size-4" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-slate-100">{item?.label}</h1>
            <p className="hidden truncate text-[11px] text-slate-500 sm:block">{item?.description}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-md border border-cyan-400/20 bg-cyan-400/5 px-3 py-1.5 sm:flex">
          <StatusDot tone="cyan" pulse />
          <span className="text-[11px] font-medium text-cyan-300">{adminEmail}</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onLogout}
          className="min-h-[40px] border-rose-500/30 bg-rose-500/5 text-rose-300 hover:bg-rose-500/15"
        >
          <LogOut className="mr-1.5 size-4" />
          Logout
        </Button>
      </div>
    </header>
  )
}

export function AdminView() {
  const { setView, admin, goToAdmin, campaignIdContext, adminSection, setAdminSection } = usePb()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)

  const navigate = React.useCallback(
    (s: AdminSection) => {
      setAdminSection(s)
      setMobileNavOpen(false)
    },
    [setAdminSection]
  )

  const section = adminSection

  // Optional: brief refresh on focus
  React.useEffect(() => {
    const onFocus = () => qc.invalidateQueries()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [qc])

  async function handleLogout() {
    try {
      await pbApi.logout()
    } catch {
      // ignore — proceed to landing regardless
    }
    toast({ title: 'Signed out', description: 'You have been logged out.' })
    setView('landing')
  }

  function renderSection() {
    switch (section) {
      case 'overview':   return <OverviewSection onNavigate={goToAdmin} />
      case 'extract':    return <ExtractSection onNavigate={goToAdmin} />
      case 'leads':      return <LeadsSection />
      case 'jobs':       return <JobsSection onNavigate={goToAdmin} />
      case 'sources':    return <SourcesSection />
      case 'bots':       return <BotsSection />
      case 'exports':    return <ExportsSection />
      case 'audit-logs': return <AuditLogsSection />
      case 'rules':      return <RulesSection />
      default:           return <OverviewSection onNavigate={goToAdmin} />
    }
  }

  const activeItem = NAV_ITEMS.find((n) => n.id === section)

  return (
    <div className="pb-hex-grid relative flex min-h-screen">
      <Sidebar active={section} onNavigate={navigate} />

      {/* Mobile nav */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-72 border-cyan-400/15 bg-[#0a1628] p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-16 items-center border-b border-cyan-400/15 px-4">
            <PlayBeatLogo size="sm" onClick={() => navigate('overview')} />
          </div>
          <NavList active={section} onNavigate={navigate} />
        </SheetContent>
      </Sheet>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <TopBar
          active={section}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onLogout={handleLogout}
          adminEmail={admin?.email ?? 'admin'}
        />
        <main className="flex-1 overflow-y-auto pb-scroll">
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
            >
              <div className="mb-5 flex items-center justify-between gap-3 lg:hidden">
                <div>
                  <h2 className="text-lg font-bold text-slate-100">{activeItem?.label}</h2>
                  <p className="text-xs text-slate-400">{activeItem?.description}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => qc.invalidateQueries()}
                  className="text-slate-300 hover:bg-white/5"
                >
                  <RefreshCw className="mr-1.5 size-3.5" />
                  Refresh
                </Button>
              </div>
              {renderSection()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
