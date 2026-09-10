'use client'

// PlayBeat Lead Extractor — Single Page Application
// View modes via client state: landing | login | admin
//
// - On mount: check GET /api/admin/me — if valid cookie, jump straight to admin
// - Otherwise: default to landing
// - On 401 from any pbApi call: flip to login view
import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PbContext, type PbContextValue, type PbView, type AdminSection } from '@/components/playbeat/context'
import { pbApi, UnauthorizedError } from '@/lib/playbeat-api'
import { useToast } from '@/hooks/use-toast'
import { useQueryClient } from '@tanstack/react-query'

import { LandingView } from '@/components/landing/landing'
import { LoginView } from '@/components/admin/login'
import { AdminView } from '@/components/admin/shell'

export default function PlayBeatPage() {
  const { toast } = useToast()
  const qc = useQueryClient()

  const [view, setView] = React.useState<PbView>('landing')
  const [admin, setAdmin] = React.useState<PbContextValue['admin']>(null)
  const [campaignIdContext, setCampaignIdContext] = React.useState<string | undefined>(undefined)
  const [adminSection, setAdminSection] = React.useState<AdminSection>('overview')
  const [bootstrapped, setBootstrapped] = React.useState(false)

  // On mount: check if there's a valid session cookie
  React.useEffect(() => {
    let cancelled = false
    async function checkSession() {
      try {
        const me = await pbApi.me()
        if (cancelled) return
        setAdmin(me)
        setView('admin')
      } catch (err) {
        if (cancelled) return
        // No valid session — stay on landing (expected on first visit)
        void err
      } finally {
        if (!cancelled) setBootstrapped(true)
      }
    }
    checkSession()
    return () => { cancelled = true }
  }, [])

  // Global 401 handler — flip to login on UNAUTHORIZED from any pbApi call
  React.useEffect(() => {
    function onUnhandled(ev: PromiseRejectionEvent) {
      if (ev.reason instanceof UnauthorizedError) {
        setAdmin(null)
        setView('login')
        toast({
          title: 'Session expired',
          description: 'Please sign in again.',
          variant: 'destructive',
        })
        qc.clear()
      }
    }
    window.addEventListener('unhandledrejection', onUnhandled)
    return () => window.removeEventListener('unhandledrejection', onUnhandled)
  }, [toast, qc])

  const goToAdmin = React.useCallback(
    (section?: AdminSection, opts?: { campaignId?: string }) => {
      setView('admin')
      if (section) setAdminSection(section)
      if (opts?.campaignId) setCampaignIdContext(opts.campaignId)
    },
    []
  )

  const ctx: PbContextValue = {
    view,
    setView,
    admin,
    setAdmin,
    goToAdmin,
    campaignIdContext,
    setCampaignIdContext,
    adminSection,
    setAdminSection,
  }

  // Render nothing during the brief bootstrap to avoid an unnecessary flash
  // of the landing page when a valid session is being restored.
  if (!bootstrapped) {
    return (
      <div className="pb-hex-grid relative flex min-h-screen items-center justify-center">
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="size-10 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-cyan-300">
            PlayBeat Lead Pulse
          </p>
        </div>
      </div>
    )
  }

  return (
    <PbContext.Provider value={ctx}>
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {view === 'landing' && <LandingView />}
          {view === 'login' && <LoginView />}
          {view === 'admin' && <AdminView />}
        </motion.div>
      </AnimatePresence>
    </PbContext.Provider>
  )
}
