'use client'

// PlayBeat — Landing page (public SPA view)
import * as React from 'react'
import { motion } from 'framer-motion'
import {
  Mail, MessageCircle, Filter, MapPin, Copy, Download,
  ShieldCheck, Activity, Bot, Database, Globe, Lock,
  Zap, Target, CheckCircle2, ArrowRight, Eye, ScanSearch,
  Layers, FileCheck2,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { usePb } from '@/components/playbeat/context'
import { PlayBeatLogo, EcgPulseLine, StatusDot, GlassCard } from '@/components/playbeat/ui'
import { pbApi } from '@/lib/playbeat-api'
import { PbSkeleton } from '@/components/playbeat/ui'

// ---------------------------------------------------------------------------
// Nav bar
// ---------------------------------------------------------------------------
function NavBar() {
  const { setView } = usePb()
  return (
    <header className="sticky top-0 z-40 border-b border-cyan-400/15 bg-[#020617]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <PlayBeatLogo onClick={() => setView('landing')} />
        <nav className="hidden items-center gap-8 md:flex" aria-label="Sections">
          <a href="#features" className="text-sm text-slate-300 transition-colors hover:text-cyan-300">
            Features
          </a>
          <a href="#workflow" className="text-sm text-slate-300 transition-colors hover:text-cyan-300">
            Workflow
          </a>
          <a href="#security" className="text-sm text-slate-300 transition-colors hover:text-cyan-300">
            Security
          </a>
        </nav>
        <Button
          type="button"
          variant="outline"
          onClick={() => setView('login')}
          className="min-h-[44px] border-cyan-400/40 bg-cyan-400/5 text-cyan-300 hover:bg-cyan-400/15 hover:text-cyan-200"
        >
          Admin Login
        </Button>
      </div>
    </header>
  )
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------
function Hero() {
  const { setView } = usePb()
  return (
    <section className="relative overflow-hidden pb-16 pt-12 sm:pt-20">
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center text-center"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/5 px-4 py-1.5">
            <StatusDot tone="cyan" pulse />
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-cyan-300">
              More Leads • Smarter Growth
            </span>
          </div>

          <h1 className="max-w-4xl text-4xl font-extrabold leading-tight tracking-tight text-slate-100 sm:text-5xl md:text-6xl">
            Extract <span className="pb-text-gradient">1,000+ Real</span> Business Leads
          </h1>

          <p className="mt-6 max-w-2xl text-base text-slate-400 sm:text-lg">
            Discover real business emails, WhatsApp numbers, and phones from permitted public sources —
            OpenStreetMap Overpass, Nominatim geocoding, and public website contact pages. No mock data,
            no dummy records, ever.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <Button
              type="button"
              size="lg"
              asChild
              className="min-h-[48px] bg-cyan-400 text-[#021018] hover:bg-cyan-300 shadow-[0_0_24px_rgba(0,212,255,0.5)]"
            >
              <a href="#features">
                <Zap className="mr-2 size-4" />
                Get Started
              </a>
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={() => setView('login')}
              className="min-h-[48px] border-cyan-400/40 bg-transparent text-cyan-300 hover:bg-cyan-400/10"
            >
              Admin Login
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>

          <div className="mt-12 w-full max-w-3xl">
            <EcgPulseLine width={680} height={48} className="mx-auto" />
          </div>
        </motion.div>
      </div>

      {/* Floating orbs */}
      <div className="pointer-events-none absolute -top-24 left-1/2 z-0 size-[420px] -translate-x-1/2 rounded-full bg-cyan-500/20 blur-[120px]" />
      <div className="pointer-events-none absolute -right-32 top-40 z-0 size-[320px] rounded-full bg-blue-500/20 blur-[120px]" />
      <div className="pointer-events-none absolute -left-32 top-64 z-0 size-[260px] rounded-full bg-emerald-500/15 blur-[120px]" />
    </section>
  )
}

// ---------------------------------------------------------------------------
// Live stats bar (from /api/health — public)
// ---------------------------------------------------------------------------
function LiveStatsBar() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['pb-health'],
    queryFn: () => pbApi.health(),
    refetchInterval: 30_000,
    retry: 1,
  })

  const items = React.useMemo(() => {
    if (!data) return []
    const db = data.checks?.database
    const bots = data.checks?.bots
    const sources = data.checks?.sources
    return [
      {
        label: 'Database',
        value: db?.status === 'ok' ? 'Connected' : db?.status === 'down' ? 'Offline' : (db?.status ?? '—'),
        tone: db?.status === 'ok' ? 'green' : 'red',
      },
      {
        label: 'Active Sources',
        value: sources ? `${sources.active}/${sources.total}` : '—',
        tone: sources && sources.active > 0 ? 'green' : 'amber',
      },
      {
        label: 'System Status',
        value: data.status === 'ok' ? 'Operational' : data.status === 'degraded' ? 'Degraded' : 'Down',
        tone: data.status === 'ok' ? 'green' : data.status === 'degraded' ? 'amber' : 'red',
      },
      {
        label: 'Bots Online',
        value: bots?.summary ? `${(bots.summary.total ?? 0) - (bots.summary.disabled ?? 0)}/${bots.summary.total ?? 0}` : '—',
        tone: 'cyan',
      },
    ] as { label: string; value: string; tone: 'green' | 'red' | 'amber' | 'cyan' }[]
  }, [data])

  return (
    <section className="relative z-10 mx-auto -mt-2 max-w-6xl px-4 sm:px-6 lg:px-8">
      <GlassCard className="p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="size-4 text-cyan-300" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Live System Status
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <PbSkeleton key={i} className="h-12 w-full" />
            ))
          ) : isError || items.length === 0 ? (
            <div className="col-span-4 text-center text-sm text-amber-300">
              Connecting…
            </div>
          ) : (
            items.map((it) => (
              <div key={it.label} className="rounded-lg border border-cyan-400/15 bg-white/[0.02] p-3">
                <div className="flex items-center gap-1.5">
                  <StatusDot tone={it.tone} pulse={it.tone !== 'red'} />
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                    {it.label}
                  </p>
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-100">{it.value}</p>
              </div>
            ))
          )}
        </div>
      </GlassCard>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Features grid
// ---------------------------------------------------------------------------
const FEATURES = [
  {
    icon: Mail,
    title: 'Business Email Discovery',
    desc: 'Extract real business emails from public website contact pages, JSON-LD, and mailto links — with confidence scoring and disposable-domain detection.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp / Phone Discovery',
    desc: 'Detect WhatsApp numbers from wa.me, api.whatsapp.com, wa.link, and explicit buttons. All phones normalized to E.164 format.',
  },
  {
    icon: Filter,
    title: 'Business / Category Filtering',
    desc: 'Target by industry, category, subcategory, B2B/B2C, employee count — powered by OpenStreetMap tags and keyword analysis.',
  },
  {
    icon: MapPin,
    title: 'City / Country Filtering',
    desc: 'Geocode any city or country with Nominatim, search by radius, or scan multiple cities in one campaign.',
  },
  {
    icon: Copy,
    title: 'Duplicate Prevention',
    desc: 'Canonical identifiers (domain, email, phone, name+city, OSM ID) prevent re-insertion. Duplicates are flagged and removed in real time.',
  },
  {
    icon: Download,
    title: 'Export (CSV / XLSX / JSON)',
    desc: 'Download filtered leads as CSV, XLSX, or JSON — including evidence (source URL, page section, confidence, quality).',
  },
]

function Features() {
  return (
    <section id="features" className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="mb-12 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-cyan-300">
          Capabilities
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-100 sm:text-4xl">
          Everything you need to extract <span className="pb-text-gradient">real leads</span>
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-400">
          Each lead is sourced from a permitted public source and validated before storage.
          No mock data, ever.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => {
          const Icon = f.icon
          return (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.35, delay: (i % 3) * 0.05 }}
            >
              <GlassCard hover className="h-full">
                <div className="mb-4 inline-flex size-11 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300 shadow-[0_0_18px_rgba(0,212,255,0.25)]">
                  <Icon className="size-5" />
                </div>
                <h3 className="text-base font-semibold text-slate-100">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.desc}</p>
              </GlassCard>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Workflow stepper (5 steps)
// ---------------------------------------------------------------------------
const WORKFLOW = [
  { icon: Target, title: 'Select Target', desc: 'Choose country, city, and category — minimum 1,000 unique leads.' },
  { icon: ScanSearch, title: 'Discover Sources', desc: 'OSM Overpass API + z-ai web search discover real businesses matching your criteria.' },
  { icon: FileCheck2, title: 'Extract & Validate', desc: 'Visit each business website, extract emails/phones/WhatsApp, validate syntax & domain.' },
  { icon: Layers, title: 'Deduplicate', desc: 'Canonical identifiers (domain, email, phone, name+city) prevent duplicate insertion.' },
  { icon: Download, title: 'Export', desc: 'Download as CSV, XLSX, or JSON with full source provenance and evidence.' },
]

function Workflow() {
  return (
    <section id="workflow" className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="mb-12 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-cyan-300">
          How it works
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-100 sm:text-4xl">
          From target to <span className="pb-text-gradient">verified export</span>
        </h2>
      </div>

      <div className="relative grid grid-cols-1 gap-6 md:grid-cols-5">
        {/* Connecting neon line (desktop) */}
        <div className="absolute left-0 right-0 top-12 hidden h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent md:block" />
        {WORKFLOW.map((s, i) => {
          const Icon = s.icon
          return (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.35, delay: i * 0.08 }}
              className="relative flex flex-col items-center text-center"
            >
              <div className="relative z-10 mb-4 flex size-12 items-center justify-center rounded-full border border-cyan-400/40 bg-[#0a1628] text-cyan-300 shadow-[0_0_18px_rgba(0,212,255,0.4)]">
                <Icon className="size-5" />
                <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-cyan-400 text-[10px] font-bold text-[#021018]">
                  {i + 1}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-slate-100">{s.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{s.desc}</p>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Security / privacy section
// ---------------------------------------------------------------------------
function Security() {
  const points = [
    { icon: ShieldCheck, title: 'Permitted Sources Only', desc: 'OpenStreetMap (ODbL), Nominatim, public website contact pages. No stolen or leaked data.' },
    { icon: Lock, title: 'SSRF Protection', desc: 'Every outbound fetch is IP-pinned, DNS-checked, and blocks private ranges (RFC 1918) + cloud metadata endpoints.' },
    { icon: Activity, title: 'Rate Limiting', desc: 'Per-source in-memory rate limiter respects daily limits and per-minute quotas — no source abuse.' },
    { icon: CheckCircle2, title: 'GDPR / CAN-SPAM Aware', desc: 'Every record carries source URL + evidence for auditability. Users must comply with applicable laws.' },
    { icon: Eye, title: 'No Dummy Data', desc: 'Rule 14 (server-enforced): the production UI never displays mock lead data. Empty states only.' },
    { icon: Database, title: 'Evidence-Backed Contacts', desc: 'Each email/phone stores source URL, page section, evidence text, confidence score.' },
  ]
  return (
    <section id="security" className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <GlassCard className="overflow-hidden p-6 sm:p-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div>
            <div className="mb-4 inline-flex size-12 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300 shadow-[0_0_18px_rgba(0,212,255,0.3)]">
              <ShieldCheck className="size-6" />
            </div>
            <h2 className="text-2xl font-bold text-slate-100">
              Built for <span className="pb-text-gradient">compliance</span>
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              PlayBeat enforces 16 mandatory operating rules server-side — they cannot be bypassed through
              the frontend. Every lead is sourced from a permitted public source and validated before storage.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:col-span-2">
            {points.map((p) => {
              const Icon = p.icon
              return (
                <div key={p.title} className="flex gap-3">
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
                    <Icon className="size-4.5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{p.title}</p>
                    <p className="mt-1 text-xs text-slate-400">{p.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </GlassCard>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Bots / automation section
// ---------------------------------------------------------------------------
const BOTS = [
  { name: 'Discovery', icon: ScanSearch },
  { name: 'Extraction', icon: FileCheck2 },
  { name: 'Validation', icon: CheckCircle2 },
  { name: 'Dedup', icon: Layers },
  { name: 'Scoring', icon: Zap },
  { name: 'Enrichment', icon: Database },
  { name: 'Classification', icon: Filter },
  { name: 'Cleanup', icon: Copy },
  { name: 'Monitoring', icon: Eye },
  { name: 'Scheduler', icon: Bot },
]

function BotsSection() {
  return (
    <section className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="mb-10 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-cyan-300">
          Automation engine
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-100 sm:text-4xl">
          10 specialized <span className="pb-text-gradient">bots</span> orchestrate every extraction
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-400">
          Each bot handles one stage of the pipeline — discovery, extraction, validation, dedup, scoring, and more.
          Their state persists across restarts; admins can enable, disable, or restart any bot from the dashboard.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {BOTS.map((b, i) => {
          const Icon = b.icon
          return (
            <motion.div
              key={b.name}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.25, delay: (i % 5) * 0.05 }}
              className="pb-glass flex flex-col items-center gap-2 p-4 text-center"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
                <Icon className="size-5" />
              </div>
              <span className="text-xs font-semibold text-slate-200">{b.name} Bot</span>
              <span className="flex items-center gap-1 text-[10px] text-emerald-300">
                <StatusDot tone="green" pulse className="size-1.5" />
                Ready
              </span>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// CTA
// ---------------------------------------------------------------------------
function CTA() {
  const { setView } = usePb()
  return (
    <section className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <GlassCard className="relative overflow-hidden p-8 text-center sm:p-12">
        <div className="pointer-events-none absolute -top-24 left-1/2 size-[420px] -translate-x-1/2 rounded-full bg-cyan-500/15 blur-[100px]" />
        <div className="relative">
          <h2 className="text-3xl font-bold tracking-tight text-slate-100 sm:text-4xl">
            Start extracting <span className="pb-text-gradient">real leads</span> today
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-400">
            Log into the admin dashboard to launch a new extraction job. Minimum 1,000 unique leads —
            backed by a server-enforced rule engine.
          </p>
          <Button
            type="button"
            size="lg"
            onClick={() => setView('login')}
            className="mt-7 min-h-[48px] bg-cyan-400 text-[#021018] hover:bg-cyan-300 shadow-[0_0_24px_rgba(0,212,255,0.5)]"
          >
            Admin Login
            <ArrowRight className="ml-2 size-4" />
          </Button>
        </div>
      </GlassCard>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Footer (sticky)
// ---------------------------------------------------------------------------
function Footer() {
  return (
    <footer className="relative z-10 mt-auto border-t border-cyan-400/15 bg-[#020617]/80">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <PlayBeatLogo size="sm" />
          <p className="text-center text-[11px] text-slate-500 md:text-right">
            Public business lead discovery from permitted sources — OpenStreetMap, Nominatim, and public website contact pages.
            <br className="hidden sm:block" />
            Users are responsible for ensuring their use of any discovered contact information complies with applicable laws.
          </p>
        </div>
        <div className="mt-6 border-t border-white/5 pt-4 text-center">
          <p className="text-[11px] text-slate-600">
            © {new Date().getFullYear()} PlayBeat Lead Extractor • MORE LEADS • SMARTER GROWTH
          </p>
        </div>
      </div>
    </footer>
  )
}

// ---------------------------------------------------------------------------
// Landing root
// ---------------------------------------------------------------------------
export function LandingView() {
  return (
    <div className="pb-hex-grid relative flex min-h-screen flex-col">
      <div className="relative z-10 flex flex-1 flex-col">
        <NavBar />
        <main className="flex-1">
          <Hero />
          <LiveStatsBar />
          <Features />
          <Workflow />
          <Security />
          <BotsSection />
          <CTA />
        </main>
        <Footer />
      </div>
    </div>
  )
}
