'use client'

// PlayBeat shared UI primitives — logo, badges, stat cards, helpers
import * as React from 'react'
import { motion } from 'framer-motion'
import { Activity, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// PlayBeat Logo — "PLAYBEAT" + ECG pulse line motif + "LEAD PULSE" tag
// ---------------------------------------------------------------------------
export function PlayBeatLogo({
  size = 'md',
  showTag = true,
  onClick,
}: {
  size?: 'sm' | 'md' | 'lg'
  showTag?: boolean
  onClick?: () => void
}) {
  const dim = size === 'sm' ? 'size-7' : size === 'lg' ? 'size-12' : 'size-9'
  const title = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-xl' : 'text-base'
  const tag = size === 'sm' ? 'text-[9px]' : size === 'lg' ? 'text-[11px]' : 'text-[10px]'
  const strokeW = size === 'sm' ? 2 : 2.5

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-md"
      aria-label="PlayBeat Lead Extractor — home"
    >
      <div
        className={cn(
          'relative flex items-center justify-center rounded-lg',
          'bg-gradient-to-br from-cyan-400/20 to-blue-500/20',
          'border border-cyan-400/40 shadow-[0_0_16px_rgba(0,212,255,0.4)]',
          'transition-all group-hover:shadow-[0_0_24px_rgba(0,212,255,0.65)]',
          dim
        )}
      >
        <Activity
          className="size-1/2 text-cyan-300"
          strokeWidth={strokeW}
          aria-hidden="true"
        />
      </div>
      <div className="leading-tight text-left">
        <div className={cn('font-extrabold tracking-tight text-slate-100', title)}>
          PLAY<span className="pb-text-gradient">BEAT</span>
        </div>
        {showTag && (
          <div
            className={cn(
              'font-mono uppercase tracking-[0.22em] text-cyan-300/80',
              tag
            )}
          >
            Lead Pulse
          </div>
        )}
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// ECG pulse line — animated SVG
// ---------------------------------------------------------------------------
export function EcgPulseLine({
  className,
  height = 32,
  width = 220,
}: {
  className?: string
  height?: number
  width?: number
}) {
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 220 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="pb-ecg-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#00d4ff" stopOpacity="0" />
          <stop offset="50%" stopColor="#00d4ff" stopOpacity="1" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        className="pb-ecg-line"
        d="M0 16 H60 L70 16 L78 4 L86 28 L94 16 L110 16 L120 16 L128 10 L138 22 L148 16 H220"
        stroke="url(#pb-ecg-grad)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Status dot — pulsing
// ---------------------------------------------------------------------------
export function StatusDot({
  tone = 'cyan',
  pulse = false,
  className,
}: {
  tone?: 'cyan' | 'green' | 'amber' | 'red' | 'gray'
  pulse?: boolean
  className?: string
}) {
  const colors: Record<string, string> = {
    cyan: 'bg-cyan-400 shadow-[0_0_8px_rgba(0,212,255,0.7)]',
    green: 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)]',
    amber: 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.7)]',
    red: 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]',
    gray: 'bg-slate-500',
  }
  return (
    <span
      className={cn(
        'inline-block size-2 rounded-full',
        colors[tone],
        pulse && 'pb-pulse-dot',
        className
      )}
      aria-hidden="true"
    />
  )
}

// ---------------------------------------------------------------------------
// Glass card
// ---------------------------------------------------------------------------
export const GlassCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }
>(({ className, hover = false, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'pb-glass p-4 sm:p-6',
      hover && 'pb-glass-hover',
      className
    )}
    {...props}
  />
))
GlassCard.displayName = 'GlassCard'

// ---------------------------------------------------------------------------
// Stat card (dashboard)
// ---------------------------------------------------------------------------
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'cyan',
  hint,
  loading = false,
}: {
  label: string
  value: React.ReactNode
  icon?: LucideIcon
  tone?: 'cyan' | 'green' | 'amber' | 'red' | 'blue' | 'gray'
  hint?: string
  loading?: boolean
}) {
  const tones: Record<string, { text: string; bg: string; glow: string }> = {
    cyan: { text: 'text-cyan-300', bg: 'bg-cyan-400/10', glow: 'shadow-[0_0_18px_rgba(0,212,255,0.18)]' },
    green: { text: 'text-emerald-300', bg: 'bg-emerald-400/10', glow: 'shadow-[0_0_18px_rgba(16,185,129,0.18)]' },
    amber: { text: 'text-amber-300', bg: 'bg-amber-400/10', glow: 'shadow-[0_0_18px_rgba(245,158,11,0.18)]' },
    red: { text: 'text-rose-300', bg: 'bg-rose-400/10', glow: 'shadow-[0_0_18px_rgba(239,68,68,0.18)]' },
    blue: { text: 'text-blue-300', bg: 'bg-blue-400/10', glow: 'shadow-[0_0_18px_rgba(59,130,246,0.18)]' },
    gray: { text: 'text-slate-300', bg: 'bg-slate-400/10', glow: '' },
  }
  const t = tones[tone]
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        'pb-glass relative overflow-hidden p-4 sm:p-5',
        t.glow
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {label}
          </p>
          <div className="mt-2 text-2xl font-bold text-slate-100">
            {loading ? (
              <span className="inline-block h-7 w-16 animate-pulse rounded bg-white/10" />
            ) : (
              value
            )}
          </div>
          {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
        </div>
        {Icon && (
          <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', t.bg)}>
            <Icon className={cn('size-5', t.text)} />
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Status badge for jobs/bots
// ---------------------------------------------------------------------------
export function PbStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; pulse?: boolean }> = {
    running:   { label: 'Running',   cls: 'bg-cyan-400/15 text-cyan-300 border-cyan-400/40',   pulse: true },
    queued:    { label: 'Queued',    cls: 'bg-blue-400/15 text-blue-300 border-blue-400/40' },
    completed: { label: 'Completed', cls: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/40' },
    failed:    { label: 'Failed',    cls: 'bg-rose-500/15 text-rose-300 border-rose-500/40' },
    cancelled: { label: 'Cancelled', cls: 'bg-slate-500/15 text-slate-300 border-slate-500/40' },
    paused:    { label: 'Paused',    cls: 'bg-amber-400/15 text-amber-300 border-amber-400/40' },
    idle:      { label: 'Idle',      cls: 'bg-slate-500/15 text-slate-300 border-slate-500/40' },
    disabled:  { label: 'Disabled',  cls: 'bg-slate-600/15 text-slate-400 border-slate-600/40' },
    draft:     { label: 'Draft',     cls: 'bg-slate-500/15 text-slate-300 border-slate-500/40' },
    active:    { label: 'Active',    cls: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/40' },
    rate_limited: { label: 'Rate Limited', cls: 'bg-amber-400/15 text-amber-300 border-amber-400/40' },
    error:     { label: 'Error',     cls: 'bg-rose-500/15 text-rose-300 border-rose-500/40' },
  }
  const m = map[status] || { label: status, cls: 'bg-slate-500/15 text-slate-300 border-slate-500/40' }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold',
        m.cls
      )}
    >
      {m.pulse && <StatusDot tone="cyan" pulse className="size-1.5" />}
      {m.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
export function PbEmptyState({
  title,
  description,
  icon: Icon,
  action,
}: {
  title: string
  description?: string
  icon?: LucideIcon
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-cyan-400/20 bg-white/[0.02] p-10 text-center">
      {Icon && (
        <div className="flex size-12 items-center justify-center rounded-full bg-cyan-400/10 text-cyan-300">
          <Icon className="size-6" />
        </div>
      )}
      <div>
        <p className="text-sm font-semibold text-slate-200">{title}</p>
        {description && (
          <p className="mx-auto mt-1 max-w-sm text-xs text-slate-400">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------
export function PbSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-white/[0.06]', className)}
      aria-hidden="true"
    />
  )
}
