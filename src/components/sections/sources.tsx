'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Database, Plus, Pencil, Trash2, KeyRound } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { SectionHeader, EmptyState } from '@/components/common/ui'
import { sourcesApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import type { Source } from '@/lib/types'
import { cn } from '@/lib/utils'

const SOURCE_TYPES = [
  { value: 'overpass', label: 'OpenStreetMap Overpass' },
  { value: 'nominatim', label: 'Nominatim (Geocoding)' },
  { value: 'websearch', label: 'Web Search' },
  { value: 'website', label: 'Website Contact Analyzer' },
  { value: 'directory', label: 'Business Directory' },
]

function StatusBadge({ status }: { status: Source['status'] }) {
  const map: Record<Source['status'], string> = {
    active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    rate_limited: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    error: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    disabled: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20',
  }
  return <Badge variant="outline" className={cn('capitalize', map[status])}>{status.replace('_', ' ')}</Badge>
}

export function SourcesSection() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const { data, isLoading, error } = useQuery({
    queryKey: ['sources'],
    queryFn: sourcesApi.list,
  })

  const [editSource, setEditSource] = React.useState<Source | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [deleteId, setDeleteId] = React.useState<string | null>(null)

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      sourcesApi.update(id, { enabled }),
    onMutate: async ({ id, enabled }) => {
      await qc.cancelQueries({ queryKey: ['sources'] })
      const prev = qc.getQueryData<Source[]>(['sources'])
      qc.setQueryData<Source[]>(['sources'], (old) =>
        old?.map((s) => (s.id === id ? { ...s, enabled } : s))
      )
      return { prev }
    },
    onError: (err: unknown, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['sources'], ctx.prev)
      toast({ variant: 'destructive', title: 'Update failed', description: err instanceof Error ? err.message : String(err) })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sources'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: sourcesApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sources'] })
      toast({ title: 'Source deleted' })
      setDeleteId(null)
    },
    onError: (err: unknown) =>
      toast({ variant: 'destructive', title: 'Delete failed', description: err instanceof Error ? err.message : String(err) }),
  })

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Sources"
        description="Configure discovery sources, rate limits and API keys"
        icon={Database}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-4" /> Add Source
          </Button>
        }
      />

      {error && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
          {error instanceof Error ? error.message : 'Failed to load sources'}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : !data || data.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Database}
                title="No sources configured"
                description="Default sources (OSM Overpass, Nominatim, Website Contact Analyzer) should appear automatically. Add a custom source to extend discovery."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Enabled</TableHead>
                    <TableHead className="text-right">Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Requests Today</TableHead>
                    <TableHead className="text-right">Limit / Min</TableHead>
                    <TableHead className="text-right">Timeout</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((s) => {
                    const usedPct = s.dailyLimit > 0 ? Math.min(100, (s.requestsToday / s.dailyLimit) * 100) : 0
                    return (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex size-8 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              <Database className="size-4" />
                            </div>
                            <div>
                              <p className="font-medium">{s.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {SOURCE_TYPES.find((t) => t.value === s.type)?.label || s.type}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={s.enabled}
                            onCheckedChange={(v) => toggleMutation.mutate({ id: s.id, enabled: v })}
                            aria-label="Toggle enabled"
                          />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{s.priority}</TableCell>
                        <TableCell><StatusBadge status={s.status} /></TableCell>
                        <TableCell>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-xs tabular-nums">
                              {s.requestsToday} / {s.dailyLimit}
                            </span>
                            <Progress value={usedPct} className="h-1 w-20" />
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{s.perMinute}/min</TableCell>
                        <TableCell className="text-right tabular-nums">{(s.timeoutMs / 1000).toFixed(1)}s</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="size-7 p-0" onClick={() => setEditSource(s)} aria-label="Edit">
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="size-7 p-0 text-rose-600 hover:text-rose-700" onClick={() => setDeleteId(s.id)} aria-label="Delete">
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit / Create dialog */}
      {(editSource || createOpen) && (
        <SourceEditDialog
          source={editSource}
          onClose={() => { setEditSource(null); setCreateOpen(false) }}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete source?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the source configuration. Already discovered leads remain untouched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-rose-600 hover:bg-rose-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SourceEditDialog({ source, onClose }: { source: Source | null; onClose: () => void }) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const isCreate = !source

  const [name, setName] = React.useState(source?.name ?? '')
  const [type, setType] = React.useState(source?.type ?? 'overpass')
  const [enabled, setEnabled] = React.useState(source?.enabled ?? true)
  const [priority, setPriority] = React.useState(source?.priority ?? 10)
  const [dailyLimit, setDailyLimit] = React.useState(source?.dailyLimit ?? 10000)
  const [perMinute, setPerMinute] = React.useState(source?.perMinute ?? 60)
  const [timeoutMs, setTimeoutMs] = React.useState(source?.timeoutMs ?? 15000)
  const [retryCount, setRetryCount] = React.useState(source?.retryCount ?? 2)
  const [endpoint, setEndpoint] = React.useState(source?.endpoint ?? '')
  const [apiKey, setApiKey] = React.useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: Partial<Source> = {
        name, type: type as Source['type'], enabled, priority,
        dailyLimit, perMinute, timeoutMs, retryCount,
        endpoint: endpoint || undefined,
        apiKey: apiKey || undefined,
      }
      if (isCreate) return sourcesApi.create(payload)
      return sourcesApi.update(source!.id, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sources'] })
      toast({ title: isCreate ? 'Source created' : 'Source updated' })
      onClose()
    },
    onError: (err: unknown) =>
      toast({ variant: 'destructive', title: 'Save failed', description: err instanceof Error ? err.message : String(err) }),
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="size-5 text-emerald-600" />
            {isCreate ? 'Add Source' : 'Edit Source'}
          </DialogTitle>
          <DialogDescription>
            Configure the source endpoint, rate limits and authentication.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. OSM Overpass" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as Source['type'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SOURCE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Endpoint URL</Label>
            <Input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://overpass-api.de/api/interpreter" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">API Key {source && <span className="text-muted-foreground">(leave blank to keep existing)</span>}</Label>
            <div className="relative">
              <KeyRound className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={source ? '•••••••• (unchanged)' : 'Optional'}
                className="pl-8"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Priority</Label>
              <Input type="number" min={1} value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Daily limit</Label>
              <Input type="number" min={0} value={dailyLimit} onChange={(e) => setDailyLimit(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Per minute</Label>
              <Input type="number" min={0} value={perMinute} onChange={(e) => setPerMinute(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Timeout (ms)</Label>
              <Input type="number" min={1000} step={500} value={timeoutMs} onChange={(e) => setTimeoutMs(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Retry count</Label>
              <Input type="number" min={0} value={retryCount} onChange={(e) => setRetryCount(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Enabled</Label>
              <div className="flex h-9 items-center">
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !name.trim()}>
            {mutation.isPending ? 'Saving…' : isCreate ? 'Create' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
