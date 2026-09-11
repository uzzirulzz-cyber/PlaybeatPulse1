'use client'

// PlayBeat — Admin Overview section
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Users, Mail, MessageCircle, Phone, Briefcase, Bot, AlertTriangle,
  TrendingUp, Activity, Database, Globe, CheckCircle2,
} from 'lucide-react'
import { pbApi } from '@/lib/playbeat-api'
import { usePb, type AdminSection } from '@/components/playbeat/context'
import {
  StatCard, GlassCard, PbStatusBadge, PbEmptyState, PbSkeleton, StatusDot,
} from '@/components/playbeat/ui'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

interface OverviewProps {
  onNavigate: (section?: AdminSection, opts?: { campaignId?: string }) => void
}

export function OverviewSection({ onNavigate }: OverviewProps) {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['pb-dashboard'],
    queryFn: () => pbApi.dashboard(),
    refetchInterval: 15_000,
  })
  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['pb-health-admin'],
    queryFn: () => pbApi.health(),
    refetchInterval: 30_000,
  })
  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['pb-extraction-jobs'],
    queryFn: () => pbApi.extractionJobs(),
    refetchInterval: 10_000,
  })
  const { data: bots } = useQuery({
    queryKey: ['pb-bots'],
    queryFn: () => pbApi.bots(),
    refetchInterval: 20_000,
  })

  const recentJobs = React.useMemo(() => {
    if (!jobs) return []
    return jobs.slice(0, 5)
  }, [jobs])

  const botSummary = React.useMemo(() => {
    if (!bots) return { total: 0, running: 0, idle: 0, failed: 0, disabled: 0, paused: 0 }
    return {
      total: bots.length,
      running: bots.filter((b: any) => b.status === 'running').length,
      idle: bots.filter((b: any) => b.status === 'idle').length,
      failed: bots.filter((b: any) => b.status === 'failed').length,
      disabled: bots.filter((b: any) => b.status === 'disabled' || !b.enabled).length,
      paused: bots.filter((b: any) => b.status === 'paused').length,
    }
  }, [bots])

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <StatCard
          label="Unique Leads"
          value={stats?.totalLeads ?? 0}
          icon={Users}
          tone="cyan"
          loading={statsLoading}
        />
        <StatCard
          label="New (Today)"
          value={stats?.todaysLeads ?? 0}
          icon={TrendingUp}
          tone="green"
          loading={statsLoading}
        />
        <StatCard
          label="Verified Emails"
          value={stats?.emails ?? 0}
          icon={Mail}
          tone="blue"
          loading={statsLoading}
        />
        <StatCard
          label="WhatsApp / Phone"
          value={(stats?.whatsapp ?? 0) + (stats?.phones ?? 0)}
          icon={MessageCircle}
          tone="green"
          loading={statsLoading}
          hint={`${stats?.whatsapp ?? 0} WhatsApp • ${stats?.phones ?? 0} phones`}
        />
        <StatCard
          label="Extraction Jobs"
          value={jobs?.length ?? 0}
          icon={Briefcase}
          tone="cyan"
          loading={jobsLoading}
        />
        <StatCard
          label="Active Bots"
          value={botSummary.running + botSummary.idle}
          icon={Bot}
          tone="amber"
          hint={`${botSummary.failed} failed`}
        />
        <StatCard
          label="Failed Jobs"
          value={stats?.failedJobs ?? 0}
          icon={AlertTriangle}
          tone="red"
          loading={statsLoading}
        />
      </div>

      {/* Health + bot summary */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-cyan-300" />
              <h2 className="text-sm font-semibold text-slate-100">System Health</h2>
            </div>
            <PbStatusBadge status={health?.status ?? '—'} />
          </div>
          {healthLoading ? (
            <div className="space-y-3">
              <PbSkeleton className="h-16 w-full" />
              <PbSkeleton className="h-16 w-full" />
            </div>
          ) : health ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <HealthTile
                icon={Database}
                label="Database"
                value={health.checks?.database?.status ?? '—'}
                ok={health.checks?.database?.status === 'ok'}
              />
              <HealthTile
                icon={Globe}
                label="Sources"
                value={health.checks?.sources ? `${health.checks.sources.active}/${health.checks.sources.total}` : '—'}
                ok={health.checks?.sources?.active > 0}
              />
              <HealthTile
                icon={Bot}
                label="Bots"
                value={health.checks?.bots?.summary ? `${health.checks.bots.summary.total - health.checks.bots.summary.disabled}/${health.checks.bots.summary.total}` : '—'}
                ok={health.checks?.bots?.status === 'ok'}
              />
              <HealthTile
                icon={Activity}
                label="API"
                value={health.checks?.api?.status ?? '—'}
                ok={health.checks?.api?.status === 'ok'}
              />
            </div>
          ) : (
            <PbEmptyState
              title="Unable to load health status"
              icon={AlertTriangle}
              description="The /api/health endpoint did not respond. Please retry."
            />
          )}
        </GlassCard>

        <GlassCard>
          <div className="mb-4 flex items-center gap-2">
            <Bot className="size-4 text-cyan-300" />
            <h2 className="text-sm font-semibold text-slate-100">Bot Status Summary</h2>
          </div>
          <div className="space-y-2">
            <BotRow label="Running" tone="cyan" pulse count={botSummary.running} />
            <BotRow label="Idle" tone="gray" count={botSummary.idle} />
            <BotRow label="Failed" tone="red" count={botSummary.failed} />
            <BotRow label="Disabled" tone="gray" count={botSummary.disabled} />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 w-full border-cyan-400/30 bg-cyan-400/5 text-cyan-300 hover:bg-cyan-400/15"
            onClick={() => onNavigate('bots')}
          >
            <Bot className="mr-1.5 size-3.5" />
            Open Bot Control Center
          </Button>
        </GlassCard>
      </div>

      {/* Recent jobs */}
      <GlassCard>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="size-4 text-cyan-300" />
            <h2 className="text-sm font-semibold text-slate-100">Recent Extraction Jobs</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('jobs')}
            className="text-cyan-300 hover:bg-cyan-400/10"
          >
            View all
          </Button>
        </div>
        {jobsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <PbSkeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : recentJobs.length === 0 ? (
          <PbEmptyState
            title="No extraction jobs yet"
            description="Launch your first job — minimum 1,000 unique leads."
            icon={Briefcase}
            action={
              <Button
                onClick={() => onNavigate('extract')}
                className="bg-cyan-400 text-[#021018] hover:bg-cyan-300"
              >
                Start Extraction
                <Activity className="ml-1.5 size-3.5" />
              </Button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-cyan-400/10">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="hidden px-3 py-2 text-left sm:table-cell">Progress</th>
                  <th className="hidden px-3 py-2 text-right sm:table-cell">Valid</th>
                  <th className="px-3 py-2 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentJobs.map((job: any) => {
                  const pct = Math.min(100, Math.max(0, Math.round(job.progress ?? 0)))
                  return (
                    <tr key={job.id} className="hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5">
                        <div className="truncate font-medium text-slate-200">{job.name}</div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(job.createdAt).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-3 py-2.5"><PbStatusBadge status={job.status} /></td>
                      <td className="hidden px-3 py-2.5 sm:table-cell">
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="h-1.5 w-24 bg-white/10" />
                          <span className="text-[11px] text-slate-400">{pct}%</span>
                        </div>
                      </td>
                      <td className="hidden px-3 py-2.5 text-right text-xs text-slate-300 sm:table-cell">
                        {job.validContacts ?? 0} / {job.target ?? 0}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onNavigate('leads', { campaignId: job.id })}
                          className="text-cyan-300 hover:bg-cyan-400/10"
                        >
                          Leads
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <QuickAction
          icon={Activity}
          title="Extract Leads"
          desc="Launch a new job (min 1,000)"
          onClick={() => onNavigate('extract')}
        />
        <QuickAction
          icon={CheckCircle2}
          title="Verify Leads"
          desc="Browse, filter & score"
          onClick={() => onNavigate('leads')}
        />
        <QuickAction
          icon={Database}
          title="Configure Sources"
          desc="Permitted data sources"
          onClick={() => onNavigate('sources')}
        />
      </div>
    </div>
  )
}

function HealthTile({
  icon: Icon,
  label,
  value,
  ok,
}: {
  icon: typeof Activity
  label: string
  value: string
  ok: boolean
}) {
  return (
    <div className="rounded-lg border border-cyan-400/15 bg-white/[0.02] p-3">
      <div className="flex items-center gap-2">
        <Icon className="size-3.5 text-cyan-300" />
        <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      </div>
      <p className="mt-1.5 text-sm font-semibold capitalize text-slate-100">
        <span className="mr-1.5 inline-flex">
          <StatusDot tone={ok ? 'green' : 'red'} pulse={ok} className="!size-1.5" />
        </span>
        {value}
      </p>
    </div>
  )
}

function BotRow({
  label,
  tone,
  count,
  pulse = false,
}: {
  label: string
  tone: 'cyan' | 'gray' | 'red' | 'green'
  count: number
  pulse?: boolean
}) {
  return (
    <div className="flex items-center justify-between rounded-md bg-white/[0.02] px-3 py-2">
      <div className="flex items-center gap-2">
        <StatusDot tone={tone} pulse={pulse} />
        <span className="text-xs text-slate-300">{label}</span>
      </div>
      <span className="text-sm font-semibold text-slate-100">{count}</span>
    </div>
  )
}

function QuickAction({
  icon: Icon,
  title,
  desc,
  onClick,
}: {
  icon: typeof Activity
  title: string
  desc: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pb-glass pb-glass-hover flex items-center gap-3 p-4 text-left"
    >
      <div className="flex size-10 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-100">{title}</p>
        <p className="text-xs text-slate-400">{desc}</p>
      </div>
    </button>
  )
}
