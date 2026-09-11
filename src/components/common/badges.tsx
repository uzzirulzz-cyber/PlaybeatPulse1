'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import type { CampaignStatus, LeadStatus, LeadGrade, EmailQuality } from '@/lib/types'

const STATUS_COLORS: Record<CampaignStatus, string> = {
  draft: 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20',
  queued: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  running: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  paused: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/20',
  completed: 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 border-emerald-600/20',
  failed: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  cancelled: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20',
}

const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
  verified: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  favorite: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  rejected: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  edited: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
}

const GRADE_COLORS: Record<LeadGrade, string> = {
  excellent: 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border-emerald-600/30',
  high: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  good: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
  medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  low: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20',
}

const EMAIL_QUALITY_COLORS: Record<EmailQuality, string> = {
  high: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  low: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
}

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  pulse?: boolean
}

function BadgeBase({ className, pulse, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium',
        pulse && 'animate-pulse',
        className
      )}
      {...rest}
    >
      {children}
    </span>
  )
}

export function StatusBadge({ status, pulse }: { status: CampaignStatus; pulse?: boolean }) {
  return (
    <BadgeBase className={STATUS_COLORS[status]} pulse={pulse}>
      {pulse && <span className="size-1.5 rounded-full bg-current" />}
      <span className="capitalize">{status}</span>
    </BadgeBase>
  )
}

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <BadgeBase className={LEAD_STATUS_COLORS[status]}><span className="capitalize">{status}</span></BadgeBase>
}

export function GradeBadge({ grade, score }: { grade?: LeadGrade; score?: number }) {
  if (!grade) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <BadgeBase className={GRADE_COLORS[grade]} title={score !== undefined ? `Score ${score}` : undefined}>
      <span className="uppercase">{grade}</span>
      {score !== undefined && <span className="opacity-70">·{score}</span>}
    </BadgeBase>
  )
}

export function EmailQualityBadge({ quality }: { quality?: EmailQuality }) {
  if (!quality) return null
  return <BadgeBase className={EMAIL_QUALITY_COLORS[quality]}><span className="capitalize">{quality}</span></BadgeBase>
}

export function ConfidenceBadge({ value }: { value?: number }) {
  if (value === undefined || value === null) return <span className="text-xs text-muted-foreground">—</span>
  const pct = Math.round(value)
  const color =
    pct >= 80 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
    : pct >= 50 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
  return <BadgeBase className={color}>{pct}%</BadgeBase>
}
