'use client'

// PlayBeat — Extraction Jobs section
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Briefcase, Eye, RefreshCw, Loader2, Activity, AlertTriangle, Users,
} from 'lucide-react'
import { pbApi } from '@/lib/playbeat-api'
import { usePb, type AdminSection } from '@/components/playbeat/context'
import {
  GlassCard, PbStatusBadge, PbEmptyState, PbSkeleton, StatusDot,
} from '@/components/playbeat/ui'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

interface JobsProps {
  onNavigate: (section?: AdminSection, opts?: { campaignId?: string }) => void
}

export function JobsSection({ onNavigate }: JobsProps) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { data: jobs, isLoading } = useQuery({
    queryKey: ['pb-extraction-jobs'],
    queryFn: () => pbApi.extractionJobs(),
    refetchInterval: 8_000,
  })

  const [viewJob, setViewJob] = React.useState<any | null>(null)

  const retryMutation = useMutation({
    mutationFn: (id: string) => pbApi.retryJob(id),
    onSuccess: () => {
      toast({ title: 'Job queued for retry' })
      qc.invalidateQueries({ queryKey: ['pb-extraction-jobs'] })
    },
    onError: (e: any) => toast({
      title: 'Retry failed', description: e?.message, variant: 'destructive',
    }),
  })

  const hasRunning = jobs?.some((j: any) => j.status === 'running' || j.status === 'queued')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Briefcase className="size-4 text-cyan-300" />
          <h2 className="text-sm font-semibold text-slate-100">
            Extraction Jobs <span className="text-slate-500">({jobs?.length ?? 0})</span>
          </h2>
          {hasRunning && (
            <span className="ml-2 flex items-center gap-1.5 rounded-md border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[11px] text-cyan-300">
              <StatusDot tone="cyan" pulse className="size-1.5" />
              Live
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate('extract')}
          className="border-cyan-400/30 bg-cyan-400/5 text-cyan-300 hover:bg-cyan-400/15"
        >
          <Activity className="mr-1.5 size-3.5" />
          New Extraction
        </Button>
      </div>

      <GlassCard className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <PbSkeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !jobs || jobs.length === 0 ? (
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
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto pb-scroll">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="hidden px-3 py-2 text-right sm:table-cell">Target</th>
                  <th className="hidden px-3 py-2 text-right sm:table-cell">Valid Leads</th>
                  <th className="px-3 py-2 text-left">Progress</th>
                  <th className="hidden px-3 py-2 text-left md:table-cell">Created</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {jobs.map((job: any) => {
                  const pct = Math.min(100, Math.max(0, Math.round(job.progress ?? 0)))
                  return (
                    <tr key={job.id} className="hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5">
                        <div className="truncate font-medium text-slate-200">{job.name}</div>
                        <div className="text-[10px] text-slate-500">
                          {job.locationFilters?.city}, {job.locationFilters?.country}
                        </div>
                      </td>
                      <td className="px-3 py-2.5"><PbStatusBadge status={job.status} /></td>
                      <td className="hidden px-3 py-2.5 text-right text-slate-300 sm:table-cell">
                        {job.target?.toLocaleString() ?? '—'}
                      </td>
                      <td className="hidden px-3 py-2.5 text-right text-slate-300 sm:table-cell">
                        {job.validContacts ?? 0}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="h-1.5 w-20 bg-white/10" />
                          <span className="text-[11px] text-slate-400">{pct}%</span>
                        </div>
                      </td>
                      <td className="hidden px-3 py-2.5 text-slate-400 md:table-cell">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewJob(job)}
                            className="text-cyan-300 hover:bg-cyan-400/10"
                            aria-label="View job progress"
                          >
                            <Eye className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onNavigate('leads', { campaignId: job.id })}
                            className="text-slate-300 hover:bg-white/5"
                            aria-label="View leads"
                          >
                            <Users className="size-3.5" />
                          </Button>
                          {(job.status === 'failed' || job.status === 'cancelled') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => retryMutation.mutate(job.id)}
                              disabled={retryMutation.isPending}
                              className="text-amber-300 hover:bg-amber-400/10"
                              aria-label="Retry job"
                            >
                              <RefreshCw className={`size-3.5 ${retryMutation.isPending ? 'animate-spin' : ''}`} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {viewJob && (
        <JobProgressDialog job={viewJob} onClose={() => setViewJob(null)} onNavigate={onNavigate} />
      )}
    </div>
  )
}

function JobProgressDialog({
  job,
  onClose,
  onNavigate,
}: {
  job: any
  onClose: () => void
  onNavigate: (section?: AdminSection, opts?: { campaignId?: string }) => void
}) {
  const [progress, setProgress] = React.useState<any>(null)
  const isLive = job.status === 'running' || job.status === 'queued'

  React.useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    async function tick() {
      if (job.status !== 'running' && job.status !== 'queued') return
      try {
        const result = await pbApi.workerTick(job.id)
        if (cancelled) return
        setProgress(result)
        if (result.done || result.status === 'completed' || result.status === 'failed' || result.status === 'cancelled') {
          return
        }
      } catch {
        // ignore
      }
      timer = setTimeout(tick, 3000)
    }
    if (isLive) tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [job.id, job.status, isLive])

  const stats = progress?.stats || job
  const pct = progress?.progress ? Math.min(100, Math.round(progress.progress)) : Math.min(100, Math.round(job.progress ?? 0))
  const status = progress?.status ?? job.status

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto pb-scroll border-cyan-400/20 bg-[#0a1628] text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="size-4 text-cyan-300" />
            {job.name}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {job.locationFilters?.city}, {job.locationFilters?.country} • Target {job.target?.toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <PbStatusBadge status={status} />
            <span className="font-mono text-sm text-cyan-300">{pct}%</span>
          </div>
          <Progress value={pct} className="h-2 bg-white/10" />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Businesses" value={stats.businessesDiscovered ?? 0} />
            <StatTile label="Valid Leads" value={stats.validContacts ?? 0} />
            <StatTile label="Emails" value={stats.emailsDiscovered ?? 0} />
            <StatTile label="WhatsApp" value={stats.whatsappDiscovered ?? 0} />
            <StatTile label="Phones" value={stats.phonesDiscovered ?? 0} />
            <StatTile label="Duplicates" value={stats.duplicatesRemoved ?? 0} />
            <StatTile label="Invalid" value={stats.invalidRemoved ?? 0} />
            <StatTile label="Sources Scanned" value={stats.websitesAnalyzed ?? 0} />
          </div>

          {progress?.error && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{progress.error}</span>
            </div>
          )}

          {isLive && (
            <p className="flex items-center gap-2 text-[11px] text-slate-400">
              <Loader2 className="size-3 animate-spin text-cyan-300" />
              Polling worker tick every 3s…
            </p>
          )}

          {!isLive && (
            <Button
              onClick={() => {
                onClose()
                onNavigate('leads', { campaignId: job.id })
              }}
              className="w-full bg-cyan-400 text-[#021018] hover:bg-cyan-300"
            >
              <Users className="mr-1.5 size-4" />
              View Leads for this Job
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-cyan-400/15 bg-white/[0.02] p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-100">{value.toLocaleString()}</p>
    </div>
  )
}
