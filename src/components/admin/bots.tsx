'use client'

// PlayBeat — Bots Control Center section
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bot, Play, Square, RotateCw, Eye, Loader2, Activity, CheckCircle2, XCircle,
  ScanSearch, FileCheck2, Layers, Mail, Database, Filter, Zap, Copy, Eye as EyeIcon,
} from 'lucide-react'
import { pbApi } from '@/lib/playbeat-api'
import {
  GlassCard, PbStatusBadge, PbEmptyState, PbSkeleton, StatusDot,
} from '@/components/playbeat/ui'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

const BOT_ICONS: Record<string, typeof Bot> = {
  discovery: ScanSearch,
  extraction: FileCheck2,
  dedup: Layers,
  validation: CheckCircle2,
  enrichment: Database,
  classification: Filter,
  scoring: Zap,
  cleanup: Copy,
  monitoring: EyeIcon,
  scheduler: Activity,
}

export function BotsSection() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { data: bots, isLoading } = useQuery({
    queryKey: ['pb-bots'],
    queryFn: () => pbApi.bots(),
    refetchInterval: 15_000,
  })

  const [viewType, setViewType] = React.useState<string | null>(null)

  const controlMutation = useMutation({
    mutationFn: ({ type, action }: { type: string; action: 'enable' | 'disable' | 'restart' }) =>
      pbApi.botControl(type, action),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pb-bots'] })
      toast({ title: 'Bot control applied' })
    },
    onError: (e: any) => toast({
      title: 'Failed', description: e?.message, variant: 'destructive',
    }),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Bot className="size-4 text-cyan-300" />
        <h2 className="text-sm font-semibold text-slate-100">
          Bot Control Center <span className="text-slate-500">({bots?.length ?? 0} bots)</span>
        </h2>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <PbSkeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : !bots || bots.length === 0 ? (
        <PbEmptyState
          title="No bots registered"
          description="Bots are seeded on first /api/bots call."
          icon={Bot}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bots.map((bot: any) => {
            const Icon = BOT_ICONS[bot.type] ?? Bot
            return (
              <GlassCard key={bot.id} hover className="flex flex-col">
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300 shadow-[0_0_14px_rgba(0,212,255,0.2)]">
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100">{bot.name}</h3>
                      <p className="font-mono text-[10px] text-slate-500">{bot.type}</p>
                    </div>
                  </div>
                  <PbStatusBadge status={bot.status} />
                </div>

                <p className="mb-3 line-clamp-2 text-[11px] text-slate-400">
                  {bot.description}
                </p>

                <div className="mb-3 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-md bg-white/[0.02] p-2">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500">Success</p>
                    <p className="font-semibold text-emerald-300">{bot.successCount ?? 0}</p>
                  </div>
                  <div className="rounded-md bg-white/[0.02] p-2">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500">Failures</p>
                    <p className="font-semibold text-rose-300">{bot.failureCount ?? 0}</p>
                  </div>
                  <div className="rounded-md bg-white/[0.02] p-2">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500">Processed</p>
                    <p className="font-semibold text-slate-200">{bot.jobsProcessed ?? 0}</p>
                  </div>
                  <div className="rounded-md bg-white/[0.02] p-2">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500">Queue</p>
                    <p className="font-semibold text-slate-200">{bot.queueDepth ?? 0}</p>
                  </div>
                </div>

                {bot.currentTask && (
                  <div className="mb-3 flex items-center gap-1.5 rounded-md border border-cyan-400/20 bg-cyan-400/[0.05] px-2 py-1 text-[10px] text-cyan-300">
                    <Activity className="size-2.5" />
                    <span className="truncate">{bot.currentTask}</span>
                  </div>
                )}

                {bot.lastError && (
                  <div className="mb-3 flex items-start gap-1.5 rounded-md border border-rose-500/20 bg-rose-500/[0.05] px-2 py-1 text-[10px] text-rose-300">
                    <XCircle className="mt-0.5 size-2.5 shrink-0" />
                    <span className="line-clamp-2">{bot.lastError}</span>
                  </div>
                )}

                <div className="mt-auto flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewType(bot.type)}
                    className="flex-1 text-cyan-300 hover:bg-cyan-400/10"
                  >
                    <Eye className="mr-1 size-3.5" />
                    Runs
                  </Button>
                  {bot.enabled ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => controlMutation.mutate({ type: bot.type, action: 'disable' })}
                      disabled={controlMutation.isPending}
                      className="text-amber-300 hover:bg-amber-400/10"
                      aria-label="Disable bot"
                    >
                      <Square className="size-3.5" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => controlMutation.mutate({ type: bot.type, action: 'enable' })}
                      disabled={controlMutation.isPending}
                      className="text-emerald-300 hover:bg-emerald-400/10"
                      aria-label="Enable bot"
                    >
                      <Play className="size-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => controlMutation.mutate({ type: bot.type, action: 'restart' })}
                    disabled={controlMutation.isPending}
                    className="text-cyan-300 hover:bg-cyan-400/10"
                    aria-label="Restart bot"
                  >
                    <RotateCw className={`size-3.5 ${controlMutation.isPending ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </GlassCard>
            )
          })}
        </div>
      )}

      {viewType && (
        <BotRunsDialog type={viewType} onClose={() => setViewType(null)} />
      )}
    </div>
  )
}

function BotRunsDialog({ type, onClose }: { type: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['pb-bot-runs', type],
    queryFn: () => pbApi.botDetail(type),
  })

  const Icon = BOT_ICONS[type] ?? Bot

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto pb-scroll border-cyan-400/20 bg-[#0a1628] text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="size-4 text-cyan-300" />
            {data?.bot?.name ?? `${type} Bot`} — Recent Runs
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Last 20 runs of this bot
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2 py-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <PbSkeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !data?.runs || data.runs.length === 0 ? (
          <PbEmptyState
            title="No runs yet"
            description="This bot has not executed any runs in the current session."
            icon={Activity}
          />
        ) : (
          <div className="space-y-2">
            {data.runs.map((run: any) => (
              <div
                key={run.id}
                className="rounded-lg border border-cyan-400/15 bg-white/[0.02] p-3 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {run.status === 'completed' ? (
                      <CheckCircle2 className="size-3.5 text-emerald-300" />
                    ) : run.status === 'failed' ? (
                      <XCircle className="size-3.5 text-rose-300" />
                    ) : (
                      <Loader2 className="size-3.5 animate-spin text-cyan-300" />
                    )}
                    <span className="font-medium text-slate-200">{run.task ?? run.status}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {new Date(run.completedAt ?? run.startedAt).toLocaleString()}
                  </span>
                </div>
                {run.duration && (
                  <p className="mt-1 text-[10px] text-slate-500">
                    Duration: {run.duration}ms
                  </p>
                )}
                {run.error && (
                  <p className="mt-1 text-[10px] text-rose-300">{run.error}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
