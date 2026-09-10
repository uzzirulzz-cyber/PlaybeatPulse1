'use client'

// PlayBeat — Sources section
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Database, Settings2, Loader2, AlertTriangle,
} from 'lucide-react'
import { pbApi } from '@/lib/playbeat-api'
import {
  GlassCard, PbStatusBadge, PbEmptyState, PbSkeleton, StatusDot,
} from '@/components/playbeat/ui'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'

export function SourcesSection() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { data: sources, isLoading } = useQuery({
    queryKey: ['pb-sources'],
    queryFn: () => pbApi.sources(),
  })

  const [editing, setEditing] = React.useState<any | null>(null)

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      pbApi.updateSource(id, { enabled }),
    onMutate: async ({ id, enabled }) => {
      await qc.cancelQueries({ queryKey: ['pb-sources'] })
      const prev = qc.getQueryData<any[]>(['pb-sources'])
      qc.setQueryData<any[]>(['pb-sources'], (old) =>
        old?.map((s) => (s.id === id ? { ...s, enabled } : s))
      )
      return { prev }
    },
    onError: (err: any, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['pb-sources'], ctx.prev)
      toast({
        title: 'Failed to toggle source',
        description: err?.message,
        variant: 'destructive',
      })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['pb-sources'] }),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Database className="size-4 text-cyan-300" />
        <h2 className="text-sm font-semibold text-slate-100">
          Permitted Data Sources <span className="text-slate-500">({sources?.length ?? 0})</span>
        </h2>
      </div>

      <GlassCard className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <PbSkeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : !sources || sources.length === 0 ? (
          <PbEmptyState
            title="No sources configured"
            description="Sources are seeded automatically on first API call."
            icon={Database}
          />
        ) : (
          <div className="overflow-x-auto pb-scroll">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Source</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Enabled</th>
                  <th className="hidden px-3 py-2 text-right sm:table-cell">Priority</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="hidden px-3 py-2 text-left lg:table-cell">Requests Today</th>
                  <th className="hidden px-3 py-2 text-right md:table-cell">Per Min</th>
                  <th className="hidden px-3 py-2 text-left xl:table-cell">Last Error</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sources.map((s: any) => {
                  const pct = s.dailyLimit ? Math.min(100, (s.requestsToday / s.dailyLimit) * 100) : 0
                  return (
                    <tr key={s.id} className="hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-slate-200">{s.name}</div>
                        {s.endpoint && (
                          <div className="max-w-[200px] truncate text-[10px] text-slate-500">
                            {s.endpoint}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="rounded-md border border-cyan-400/20 bg-cyan-400/5 px-2 py-0.5 text-[10px] font-mono text-cyan-300">
                          {s.type}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <Switch
                          checked={s.enabled}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ id: s.id, enabled: checked })
                          }
                          className="data-[state=checked]:bg-cyan-400"
                        />
                      </td>
                      <td className="hidden px-3 py-2.5 text-right text-slate-300 sm:table-cell">
                        {s.priority}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <StatusDot
                            tone={s.status === 'active' ? 'green' : s.status === 'error' ? 'red' : 'amber'}
                            pulse={s.status === 'active'}
                          />
                          <span className="text-[11px] text-slate-300">{s.status}</span>
                        </div>
                      </td>
                      <td className="hidden px-3 py-2.5 lg:table-cell">
                        <div className="w-32">
                          <div className="flex justify-between text-[10px] text-slate-400">
                            <span>{s.requestsToday}</span>
                            <span>{s.dailyLimit}</span>
                          </div>
                          <Progress value={pct} className="mt-0.5 h-1 bg-white/10" />
                        </div>
                      </td>
                      <td className="hidden px-3 py-2.5 text-right text-slate-300 md:table-cell">
                        {s.perMinute}
                      </td>
                      <td className="hidden max-w-[200px] px-3 py-2.5 xl:table-cell">
                        {s.lastError ? (
                          <span className="truncate text-[11px] text-rose-300" title={s.lastError}>
                            {s.lastError}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing(s)}
                          className="text-cyan-300 hover:bg-cyan-400/10"
                        >
                          <Settings2 className="size-3.5" />
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

      {editing && (
        <EditSourceDialog
          source={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function EditSourceDialog({ source, onClose }: { source: any; onClose: () => void }) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [enabled, setEnabled] = React.useState(source.enabled)
  const [dailyLimit, setDailyLimit] = React.useState(source.dailyLimit)
  const [perMinute, setPerMinute] = React.useState(source.perMinute)
  const [priority, setPriority] = React.useState(source.priority)

  const mutation = useMutation({
    mutationFn: () =>
      pbApi.updateSource(source.id, { enabled, dailyLimit, perMinute, priority }),
    onSuccess: () => {
      toast({ title: 'Source updated' })
      qc.invalidateQueries({ queryKey: ['pb-sources'] })
      onClose()
    },
    onError: (e: any) => toast({
      title: 'Update failed', description: e?.message, variant: 'destructive',
    }),
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="border-cyan-400/20 bg-[#0a1628] text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="size-4 text-cyan-300" />
            Edit Source
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {source.name} ({source.type})
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-cyan-400/15 bg-white/[0.02] p-3">
            <div>
              <p className="text-sm font-medium text-slate-200">Enabled</p>
              <p className="text-[11px] text-slate-500">Toggle this source on/off</p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              className="data-[state=checked]:bg-cyan-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Priority (1=high)</Label>
              <Input
                type="number"
                min={1}
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value, 10) || 1)}
                className="min-h-[44px] border-cyan-400/20 bg-white/[0.04] text-slate-100"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Daily Limit</Label>
              <Input
                type="number"
                min={1}
                value={dailyLimit}
                onChange={(e) => setDailyLimit(parseInt(e.target.value, 10) || 1)}
                className="min-h-[44px] border-cyan-400/20 bg-white/[0.04] text-slate-100"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-300">Per Minute</Label>
            <Input
              type="number"
              min={1}
              value={perMinute}
              onChange={(e) => setPerMinute(parseInt(e.target.value, 10) || 1)}
              className="min-h-[44px] border-cyan-400/20 bg-white/[0.04] text-slate-100"
            />
          </div>
          {source.lastError && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{source.lastError}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            className="border-cyan-400/20 bg-transparent text-slate-300 hover:bg-white/5"
          >
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="bg-cyan-400 text-[#021018] hover:bg-cyan-300"
          >
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
