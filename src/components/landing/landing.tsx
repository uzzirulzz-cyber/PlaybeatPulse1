'use client'

// PlayBeat — Landing page (public SPA view) — rebuilt to match reference design.
//
// Layout (top → bottom):
//   1. Hero logo  — massive chrome "PLAYBEAT" + swoosh arc + "LEAD PULS[E]" + ECG line
//   2. Nav bar    — small PlayBeat logo + center menu + Admin Login / Get Started / hamburger
//   3. Hero content — split layout: left = headline + CTAs + stats, right = device mockup
//   4. Footer feature bar — sticky bottom strip with 4 features
//
// Live data: phone mockup polls GET /api/health every 30s (system status, active sources, DB).
import * as React from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BarChart3,
  Bot,
  Cpu,
  Crosshair,
  type LucideIcon,
  Megaphone,
  PlayCircle,
  Share2,
  Shield,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { usePb } from '@/components/playbeat/context'
import { PlayBeatLogo, StatusDot } from '@/components/playbeat/ui'
import { pbApi } from '@/lib/playbeat-api'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Hero Logo Section — massive chrome "PLAYBEAT" + swoosh + LEAD PULSE + ECG
// ---------------------------------------------------------------------------
function HeroLogo() {
  return (
    <section
      id="top"
      className="relative overflow-hidden px-4 pb-6 pt-12 sm:pt-16"
    >
      {/* Floating orbs */}
      <div className="pointer-events-none absolute -top-20 left-1/2 z-0 size-[420px] -translate-x-1/2 rounded-full bg-cyan-500/15 blur-[120px]" />
      <div className="pointer-events-none absolute -left-32 top-32 z-0 size-[280px] rounded-full bg-blue-500/15 blur-[120px]" />
      <div className="pointer-events-none absolute -right-32 top-32 z-0 size-[280px] rounded-full bg-cyan-500/15 blur-[120px]" />

      {/* Symmetrical neon spotlight bars (from both sides) */}
      <div className="pointer-events-none absolute left-0 top-1/2 z-0 h-px w-2/5 -translate-y-1/2 bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
      <div className="pointer-events-none absolute right-0 top-1/2 z-0 h-px w-2/5 -translate-y-1/2 bg-gradient-to-l from-transparent via-cyan-400/60 to-transparent" />
      <div className="pointer-events-none absolute left-0 top-1/2 z-0 h-[2px] w-1/4 -translate-y-1/2 bg-gradient-to-r from-transparent to-cyan-400/50 blur-[2px]" />
      <div className="pointer-events-none absolute right-0 top-1/2 z-0 h-[2px] w-1/4 -translate-y-1/2 bg-gradient-to-l from-transparent to-cyan-400/50 blur-[2px]" />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="relative z-10 mx-auto flex max-w-4xl flex-col items-center"
      >
        {/* SVG swoosh arc curving over PLAYBEAT */}
        <svg
          aria-hidden="true"
          width="100%"
          height="120"
          viewBox="0 0 680 120"
          fill="none"
          preserveAspectRatio="xMidYMid meet"
          className="pb-swoosh-glow pointer-events-none absolute -top-12 left-1/2 z-0 w-full max-w-[680px] -translate-x-1/2"
        >
          <defs>
            <linearGradient id="pb-swoosh-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#00e5ff" stopOpacity="0" />
              <stop offset="50%" stopColor="#00e5ff" stopOpacity="1" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
            <filter id="pb-swoosh-blur" x="-10%" y="-50%" width="120%" height="200%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>
          <path
            d="M20 100 Q340 -30 660 100"
            stroke="url(#pb-swoosh-grad)"
            strokeWidth="4"
            fill="none"
            filter="url(#pb-swoosh-blur)"
            opacity="0.7"
          />
          <path
            d="M20 100 Q340 -30 660 100"
            stroke="url(#pb-swoosh-grad)"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>

        {/* PLAYBEAT chrome */}
        <div className="relative">
          <h1
            className="pb-chrome-text select-none text-center font-extrabold italic leading-none tracking-tight"
            style={{ fontSize: 'clamp(2.75rem, 12vw, 7.5rem)' }}
          >
            PLAYBEAT
          </h1>
          {/* Reflective floor mirror */}
          <div
            aria-hidden="true"
            className="pb-chrome-text pointer-events-none absolute left-0 right-0 top-full select-none text-center font-extrabold italic leading-none tracking-tight opacity-25"
            style={{
              fontSize: 'clamp(2.75rem, 12vw, 7.5rem)',
              transform: 'scaleY(-1)',
              maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 55%)',
              WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 55%)',
              marginTop: '-0.15em',
            }}
          >
            PLAYBEAT
          </div>
        </div>

        {/* LEAD PULS[E] — final "E" transitions into the ECG heartbeat line */}
        <div className="relative z-10 mt-6 flex items-center justify-center gap-1.5">
          <span
            className="pb-chrome-text-sub font-extrabold uppercase tracking-[0.32em]"
            style={{ fontSize: 'clamp(0.875rem, 2.4vw, 1.625rem)' }}
          >
            LEAD PULS
          </span>
          <svg
            aria-hidden="true"
            width="160"
            height="32"
            viewBox="0 0 160 32"
            fill="none"
            className="ml-1"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <linearGradient id="pb-ecg-hero" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#00e5ff" stopOpacity="1" />
                <stop offset="80%" stopColor="#00e5ff" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              className="pb-ecg-line"
              d="M0 16 H30 L36 16 L40 6 L46 26 L52 16 L70 16 L78 12 L84 20 L90 16 H160"
              stroke="url(#pb-ecg-hero)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              style={{ filter: 'drop-shadow(0 0 6px rgba(0,229,255,0.8))' }}
            />
          </svg>
        </div>
      </motion.div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Navigation Bar (sticky, below hero logo)
// ---------------------------------------------------------------------------
function NavBar() {
  const { setView } = usePb()
  return (
    <header className="sticky top-0 z-40 border-b border-cyan-400/15 bg-[#020617]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <PlayBeatLogo onClick={() => setView('landing')} />

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setView('login')}
            className="hidden min-h-[40px] text-cyan-200 hover:bg-cyan-400/10 hover:text-cyan-100 sm:inline-flex"
          >
            Admin Login
          </Button>
          <Button
            type="button"
            size="sm"
            asChild
            className="min-h-[40px] rounded-full border border-cyan-400/50 bg-cyan-400/10 text-cyan-100 shadow-[0_0_16px_rgba(0,229,255,0.3)] hover:bg-cyan-400/20 hover:text-cyan-50"
          >
            <a href="#top">Get Started</a>
          </Button>
        </div>
      </div>
    </header>
  )
}

// ---------------------------------------------------------------------------
// Hero Content Section (split layout)
// ---------------------------------------------------------------------------
function StatBlock({
  icon: Icon,
  value,
  label,
  delay = 0,
}: {
  icon: LucideIcon
  value: string
  label: string
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="flex items-center gap-3 rounded-lg border border-cyan-400/15 bg-white/[0.02] p-3 shadow-[0_0_12px_rgba(0,229,255,0.1)]"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300 shadow-[0_0_12px_rgba(0,229,255,0.3)]">
        <Icon className="size-4" />
      </div>
      <div>
        <p className="text-lg font-bold text-white">{value}</p>
        <p className="text-[11px] text-slate-400">{label}</p>
      </div>
    </motion.div>
  )
}

function HeroContent() {
  const { setView } = usePb()
  return (
    <section
      id="features"
      className="relative z-10 mx-auto w-full max-w-7xl scroll-mt-20 px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20"
    >
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
        {/* Left column */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-col items-start text-left"
        >
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/5 px-3 py-1">
            <StatusDot tone="cyan" pulse />
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-300">
              MORE LEADS • SMARTER GROWTH
            </span>
          </span>

          <h2 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            <span className="block text-white">Turn Visitors Into</span>
            <span
              className="block bg-gradient-to-r from-cyan-300 via-cyan-400 to-blue-500 bg-clip-text text-transparent"
              style={{ textShadow: '0 0 28px rgba(0,229,255,0.55)' }}
            >
              Real Opportunities
            </span>
          </h2>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
            PlayBeat Lead Pulse extracts real business contacts from permitted public
            sources — OpenStreetMap, Nominatim, and public website contact pages — then
            validates, dedupes, and exports them.
          </p>
          <p className="mt-2 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
            No mock data, no dummy records. Just real, evidence-backed leads ready for
            your funnel.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              size="lg"
              onClick={() => setView('login')}
              className="min-h-[48px] rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 text-white shadow-[0_0_24px_rgba(0,229,255,0.5)] hover:from-cyan-300 hover:to-blue-400"
            >
              Get Started Now
              <ArrowRight className="ml-2 size-4" />
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="min-h-[48px] rounded-full border-cyan-400/50 bg-transparent text-cyan-200 hover:bg-cyan-400/10 hover:text-cyan-100"
            >
              <PlayCircle className="mr-2 size-4" />
              Watch Demo
            </Button>
          </div>

          {/* Stats row */}
          <div className="mt-10 grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
            <StatBlock icon={Zap} value="10x" label="More Leads" delay={0.4} />
            <StatBlock
              icon={BarChart3}
              value="3x"
              label="Higher Conversions"
              delay={0.5}
            />
            <StatBlock
              icon={Shield}
              value="100%"
              label="Secure & Reliable"
              delay={0.6}
            />
          </div>
        </motion.div>

        {/* Right column — device mockup */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="relative flex items-center justify-center"
        >
          <DeviceMockup />
        </motion.div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Device Mockup — isometric laptop + phone + wireframe globe + glowing platform
// ---------------------------------------------------------------------------
function DeviceMockup() {
  return (
    <div className="relative flex h-[460px] w-full items-center justify-center sm:h-[560px] lg:h-[620px]">
      {/* Wireframe globe behind devices */}
      <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
        <WireframeGlobe />
      </div>

      {/* Floating bar charts (background growth symbolism) */}
      <FloatingBars />

      {/* Glowing platform — concentric neon rings (sci-fi landing pad) */}
      <div
        aria-hidden="true"
        className="absolute bottom-10 z-0 h-[280px] w-[340px] rounded-[50%] border border-cyan-400/30 shadow-[0_0_40px_rgba(0,229,255,0.3)]"
        style={{ transform: 'perspective(800px) rotateX(72deg)' }}
      />
      <div
        aria-hidden="true"
        className="absolute bottom-12 z-0 h-[200px] w-[240px] rounded-[50%] border border-cyan-400/25"
        style={{ transform: 'perspective(800px) rotateX(72deg)' }}
      />
      <div
        aria-hidden="true"
        className="absolute bottom-14 z-0 h-[140px] w-[170px] rounded-[50%] border border-cyan-400/20"
        style={{ transform: 'perspective(800px) rotateX(72deg)' }}
      />
      <div
        aria-hidden="true"
        className="absolute bottom-16 z-0 h-[80px] w-[100px] rounded-[50%] border border-cyan-400/15"
        style={{ transform: 'perspective(800px) rotateX(72deg)' }}
      />
      {/* Glow under platform */}
      <div className="absolute bottom-8 z-0 h-12 w-[70%] rounded-[50%] bg-cyan-400/25 blur-2xl" />

      {/* Laptop (isometric, primary) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="absolute inset-0 z-20 flex items-center justify-center"
      >
        <div className="pb-float">
          <div
            style={{
              transform:
                'perspective(1200px) rotateY(-22deg) rotateX(8deg) rotateZ(-2deg)',
              transformStyle: 'preserve-3d',
            }}
          >
            <LaptopMockup />
          </div>
        </div>
      </motion.div>

      {/* Phone (steeper angle, front-right) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.7 }}
        className="absolute bottom-[6%] right-[6%] z-30"
      >
        <div className="pb-float-slow">
          <div
            style={{
              transform:
                'perspective(1000px) rotateY(-15deg) rotateX(18deg) rotateZ(2deg)',
            }}
          >
            <PhoneMockup />
          </div>
        </div>
      </motion.div>

      {/* Particle sparkles */}
      <Sparkles />
    </div>
  )
}

function LaptopMockup() {
  return (
    <div className="relative w-[280px] sm:w-[340px] lg:w-[380px]">
      {/* Screen frame */}
      <div className="relative rounded-t-xl border border-t-cyan-400/30 border-x-cyan-400/30 bg-gradient-to-b from-slate-700 to-slate-900 p-1.5 shadow-[0_0_30px_rgba(0,229,255,0.4)]">
        <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-[#020617]">
          {/* Screen content — PlayBeat logo + bar chart */}
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
            <div className="font-mono text-[8px] uppercase tracking-[0.4em] text-cyan-300/60">
              Dashboard
            </div>
            <div
              className="font-mono text-2xl font-extrabold italic tracking-tight sm:text-3xl"
              style={{
                background:
                  'linear-gradient(180deg, #f8fafc 0%, #cbd5e1 45%, #38bdf8 55%, #1e3a5f 90%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                textShadow: '0 2px 0 #0c1838, 0 0 12px rgba(0,229,255,0.4)',
              }}
            >
              PLAYBEAT
            </div>
            <div className="font-mono text-[8px] uppercase tracking-[0.5em] text-cyan-300/70">
              Lead Pulse
            </div>
            <div className="mt-1 h-px w-32 bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
            {/* Mini bar chart on screen */}
            <div className="mt-2 flex items-end gap-1.5">
              <div className="h-2 w-3 rounded-sm bg-cyan-400/40" />
              <div className="h-3 w-3 rounded-sm bg-cyan-400/55" />
              <div className="h-5 w-3 rounded-sm bg-cyan-400/65" />
              <div className="h-4 w-3 rounded-sm bg-cyan-400/55" />
              <div className="h-6 w-3 rounded-sm bg-cyan-400/80" />
              <div className="h-8 w-3 rounded-sm bg-cyan-400 shadow-[0_0_8px_rgba(0,229,255,0.7)]" />
            </div>
          </div>
          {/* Top bar dots */}
          <div className="absolute left-2 top-2 flex gap-1">
            <div className="size-1.5 rounded-full bg-rose-400/60" />
            <div className="size-1.5 rounded-full bg-amber-400/60" />
            <div className="size-1.5 rounded-full bg-emerald-400/60" />
          </div>
        </div>
      </div>
      {/* Base / keyboard */}
      <div className="relative h-2 w-full bg-gradient-to-b from-slate-700 to-slate-900" />
      <div className="mx-auto h-[6px] w-[112%] -translate-x-[5.4%] rounded-b-lg bg-gradient-to-b from-slate-600 to-slate-800 shadow-[0_8px_20px_rgba(0,0,0,0.6)]" />
    </div>
  )
}

// Phone mockup — pulls LIVE data from /api/health (no fake stats)
function PhoneMockup() {
  const { data, isLoading } = useQuery({
    queryKey: ['pb-health-landing'],
    queryFn: () => pbApi.health(),
    refetchInterval: 30_000,
    retry: 1,
  })

  const status = !data
    ? isLoading
      ? 'Connecting…'
      : '—'
    : data.status === 'ok'
      ? 'Operational'
      : data.status === 'degraded'
        ? 'Degraded'
        : 'Down'
  const activeSources = data?.checks?.sources
    ? `${data.checks.sources.active}/${data.checks.sources.total}`
    : '—'
  const dbStatus = !data
    ? '…'
    : data.checks?.database?.status === 'ok'
      ? 'Online'
      : 'Offline'
  const version = data?.version ?? '—'
  const tone: 'amber' | 'green' | 'red' = !data
    ? 'amber'
    : data.status === 'ok'
      ? 'green'
      : data.status === 'degraded'
        ? 'amber'
        : 'red'

  return (
    <div className="relative w-[125px] sm:w-[150px] lg:w-[165px]">
      {/* Phone body */}
      <div className="relative rounded-[1.6rem] border border-cyan-400/30 bg-gradient-to-b from-slate-800 to-slate-900 p-1.5 shadow-[0_0_30px_rgba(0,229,255,0.5)]">
        {/* Notch */}
        <div className="absolute left-1/2 top-2 z-10 h-1 w-10 -translate-x-1/2 rounded-full bg-slate-900" />

        <div className="relative aspect-[9/19] overflow-hidden rounded-[1.2rem] bg-[#020617]">
          <div className="flex h-full flex-col p-2 pt-5">
            {/* Header */}
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <div className="size-3 rounded-sm border border-cyan-400/40 bg-gradient-to-br from-cyan-400/40 to-blue-500/40" />
                <span className="text-[6px] font-bold tracking-tight text-slate-100">
                  PLAY<span className="text-cyan-300">BEAT</span>
                </span>
              </div>
              <div className="flex items-center gap-0.5">
                <StatusDot tone={tone} pulse className="size-1" />
                <span className="text-[6px] text-slate-400">Live</span>
              </div>
            </div>

            {/* System status card */}
            <div className="mb-1.5 rounded border border-cyan-400/20 bg-cyan-400/5 p-1.5">
              <p className="text-[6px] uppercase tracking-wider text-slate-400">
                System Status
              </p>
              <p className="text-[10px] font-bold text-cyan-300">{status}</p>
            </div>

            {/* Active sources + line graph */}
            <div className="mb-1.5 rounded border border-cyan-400/20 bg-white/[0.03] p-1.5">
              <div className="flex items-baseline justify-between">
                <p className="text-[6px] uppercase tracking-wider text-slate-400">
                  Active Sources
                </p>
                <span className="flex items-center gap-0.5 text-[7px] font-bold text-emerald-400">
                  <TrendingUp className="size-1.5" />
                  Live
                </span>
              </div>
              <p className="text-[10px] font-bold text-slate-100">{activeSources}</p>
              {/* Trending line graph (decorative — no fake numbers) */}
              <svg
                width="100%"
                height="22"
                viewBox="0 0 100 22"
                fill="none"
                className="mt-0.5"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="pb-phone-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#00e5ff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 18 L15 16 L25 17 L40 12 L55 13 L70 7 L85 8 L100 2"
                  stroke="#00e5ff"
                  strokeWidth="1.2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ filter: 'drop-shadow(0 0 2px rgba(0,229,255,0.7))' }}
                />
                <path
                  d="M0 18 L15 16 L25 17 L40 12 L55 13 L70 7 L85 8 L100 2 L100 22 L0 22 Z"
                  fill="url(#pb-phone-grad)"
                />
              </svg>
            </div>

            {/* DB + version */}
            <div className="mb-1.5 grid grid-cols-2 gap-1">
              <div className="rounded border border-cyan-400/15 bg-white/[0.02] p-1">
                <p className="text-[5px] uppercase tracking-wider text-slate-500">DB</p>
                <p className="text-[7px] font-bold text-slate-100">{dbStatus}</p>
              </div>
              <div className="rounded border border-cyan-400/15 bg-white/[0.02] p-1">
                <p className="text-[5px] uppercase tracking-wider text-slate-500">Ver</p>
                <p className="truncate text-[7px] font-bold text-slate-100">{version}</p>
              </div>
            </div>

            {/* Bottom menu icons */}
            <div className="mt-auto flex justify-around border-t border-cyan-400/15 pt-1.5">
              <PhoneMenuItem icon={Users} label="Leads" />
              <PhoneMenuItem icon={Megaphone} label="Camp" />
              <PhoneMenuItem icon={BarChart3} label="Stats" />
              <PhoneMenuItem icon={Bot} label="Auto" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PhoneMenuItem({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <Icon className="size-2.5 text-cyan-300" />
      <span className="text-[5px] text-slate-500">{label}</span>
    </div>
  )
}

function WireframeGlobe() {
  const dots = React.useMemo(() => {
    return Array.from({ length: 36 }).map((_, i) => {
      const angle = (i / 36) * Math.PI * 2
      const r = 130 + ((i % 4) * 8)
      return {
        x: 190 + Math.cos(angle) * r,
        y: 190 + Math.sin(angle) * r * 0.95,
        r: 1 + (i % 3) * 0.4,
      }
    })
  }, [])
  return (
    <svg
      aria-hidden="true"
      width="380"
      height="380"
      viewBox="0 0 380 380"
      fill="none"
      className="opacity-40"
      style={{ filter: 'drop-shadow(0 0 20px rgba(0,229,255,0.4))' }}
    >
      <defs>
        <radialGradient id="pb-globe-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.08" />
          <stop offset="70%" stopColor="#00e5ff" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#00e5ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="190" cy="190" r="150" fill="url(#pb-globe-grad)" />
      <circle
        cx="190"
        cy="190"
        r="150"
        stroke="#00e5ff"
        strokeWidth="0.6"
        strokeOpacity="0.4"
        fill="none"
      />
      {/* Latitudes */}
      <ellipse cx="190" cy="190" rx="150" ry="40" fill="none" stroke="#00e5ff" strokeWidth="0.4" strokeOpacity="0.3" />
      <ellipse cx="190" cy="190" rx="150" ry="80" fill="none" stroke="#00e5ff" strokeWidth="0.4" strokeOpacity="0.3" />
      <ellipse cx="190" cy="190" rx="150" ry="120" fill="none" stroke="#00e5ff" strokeWidth="0.4" strokeOpacity="0.3" />
      {/* Longitudes */}
      <ellipse cx="190" cy="190" rx="40" ry="150" fill="none" stroke="#00e5ff" strokeWidth="0.4" strokeOpacity="0.3" />
      <ellipse cx="190" cy="190" rx="80" ry="150" fill="none" stroke="#00e5ff" strokeWidth="0.4" strokeOpacity="0.3" />
      <ellipse cx="190" cy="190" rx="120" ry="150" fill="none" stroke="#00e5ff" strokeWidth="0.4" strokeOpacity="0.3" />
      {/* Connecting lines between dots */}
      {dots.map((d, i) => {
        const next = dots[(i + 3) % dots.length]
        return (
          <line
            key={`l-${i}`}
            x1={d.x}
            y1={d.y}
            x2={next.x}
            y2={next.y}
            stroke="#00e5ff"
            strokeWidth="0.3"
            strokeOpacity="0.2"
          />
        )
      })}
      {/* Dots */}
      {dots.map((d, i) => (
        <circle key={`d-${i}`} cx={d.x} cy={d.y} r={d.r} fill="#00e5ff" opacity="0.8" />
      ))}
    </svg>
  )
}

function FloatingBars() {
  const bars = [
    { left: '6%', bottom: '22%', height: 28, delay: 0 },
    { left: '10%', bottom: '18%', height: 44, delay: 0.6 },
    { left: '14%', bottom: '26%', height: 22, delay: 1.2 },
    { right: '8%', bottom: '28%', height: 32, delay: 0.4 },
    { right: '12%', bottom: '22%', height: 48, delay: 1 },
    { right: '5%', bottom: '30%', height: 18, delay: 1.6 },
  ]
  return (
    <>
      {bars.map((b, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="pb-float absolute z-10 w-1.5 rounded-t bg-gradient-to-t from-cyan-400/10 to-cyan-400/60 shadow-[0_0_10px_rgba(0,229,255,0.4)]"
          style={{
            left: b.left,
            right: b.right,
            bottom: b.bottom,
            height: b.height,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}
    </>
  )
}

function Sparkles() {
  const sparks = React.useMemo(
    () =>
      Array.from({ length: 12 }).map((_, i) => ({
        x: 10 + ((i * 7.5) % 80),
        y: 15 + ((i * 13) % 60),
        size: 1 + (i % 3) * 0.5,
        delay: (i * 0.3) % 3,
      })),
    []
  )
  return (
    <>
      {sparks.map((s, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="pb-sparkle absolute rounded-full bg-cyan-300"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
            boxShadow: '0 0 6px rgba(0,229,255,0.8)',
          }}
        />
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// Sticky footer feature bar
// ---------------------------------------------------------------------------
const FOOTER_FEATURES = [
  { icon: Crosshair, label: 'Lead Capture', desc: 'Target & collect' },
  { icon: Cpu, label: 'AI Automation', desc: 'Smart bots' },
  { icon: TrendingUp, label: 'Analytics & Reports', desc: 'Live insights' },
  { icon: Share2, label: 'Multi-Channel', desc: 'All sources' },
]

function FooterFeatureBar() {
  return (
    <div className="sticky bottom-0 z-30 mt-auto border-t border-cyan-400/15 bg-[#020617]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col divide-y divide-cyan-400/10 sm:flex-row sm:divide-x sm:divide-y-0">
        {FOOTER_FEATURES.map((f) => {
          const Icon = f.icon
          return (
            <div
              key={f.label}
              className="flex flex-1 items-center justify-center gap-3 px-4 py-3 sm:py-4"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 shadow-[0_0_12px_rgba(0,229,255,0.3)]">
                <Icon className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100">{f.label}</p>
                <p className="text-[10px] text-slate-500">{f.desc}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Landing root
// ---------------------------------------------------------------------------
export function LandingView() {
  return (
    <div className="pb-hex-grid relative flex min-h-screen flex-col">
      <div className="relative z-10 flex flex-1 flex-col">
        <HeroLogo />
        <NavBar />
        <main className="flex-1">
          <HeroContent />
        </main>
        <FooterFeatureBar />
      </div>
    </div>
  )
}
