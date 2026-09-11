'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Megaphone, Play, Pause, RotateCcw, XCircle, Trash2, Eye, Plus, Loader2,
  Target, Mail, MessageCircle, Phone, Star, Copy as CopyIcon, AlertTriangle,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { SectionHeader, EmptyState, StatCard } from '@/components/common/ui'
import { StatusBadge } from '@/components/common/badges'
import { campaignsApi, subscribeToCampaign } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import type { SectionNavigate } from './_shared'
import type { Campaign, CampaignProgressEvent, Lead } from '@/lib/types'
import { cn } from '@/lib/utils'

function fmtDate(s?: string) {
  if (!s) return '—'
  try {
    return new Date(s).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return s
  }
}

export function CampaignsSection({ navigate }: { navigate: SectionNavigate }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [detailCampaign, setDetailCampaign] = React.useState<Campaign | null>(null)
  const [deleteId, setDeleteId] = React.useState<string | null>(null)

  const { data: campaigns, isLoading, error } = useQuery({
    queryKey: ['campaigns'],
    queryFn: campaignsApi.list,
    refetchInterval: (query) => {
      const list = query.state.data
      const anyActive = list?.some((c) => c.status === 'running' || c.status === 'queued')
      return anyActive ? 5000 : false
    },
  })

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'start' | 'pause' | 'resume' | 'cancel' }) => {
      return campaignsApi[action](id)
    },
    onMutate: ({ id, action }) => {
      // optimistic: bump status
      qc.setQueryData<Campaign[]>(['campaigns'], (old) =>
        old?.map((c) => {
          if (c.id !== id) return c
          const next: Campaign['status'] =
            action === 'start' ? 'queued'
              : action === 'pause' ? 'paused'
                : action === 'resume' ? 'queued'
                  : 'cancelled'
          return { ...c, status: next }
        })
      )
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
    onError: (err: unknown) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      toast({
        variant: 'destructive',
        title: 'Action failed',
        description: err instanceof Error ? err.message : String(err),
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: campaignsApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      toast({ title: 'Campaign deleted' })
      setDeleteId(null)
    },
    onError: (err: unknown) =>
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: err instanceof Error ? err.message : String(err),
      }),
  })

  // Note: actual batch processing is driven by the global worker-tick poller
  // in page.tsx. This section just refreshes its data frequently while active.

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Campaigns"
        description="Manage and monitor your discovery campaigns"
        icon={Megaphone}
        actions={
          <Button onClick={() => navigate('find-leads')}>
            <Plus className="mr-2 size-4" /> New Campaign
          </Button>
        }
      />

      {error && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
          {error instanceof Error ? error.message : 'Failed to load campaigns'}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : !campaigns || campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description="Start your first discovery campaign to find real public business leads."
          action={<Button onClick={() => navigate('find-leads')}><Plus className="mr-2 size-4" /> New Campaign</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => {
            const running = c.status === 'running'
            return (
              <Card
                key={c.id}
                className={cn(
                  'group relative overflow-hidden transition-shadow hover:shadow-md',
                  running && 'ring-1 ring-emerald-500/30'
                )}
              >
                {running && (
                  <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                    <span className="relative flex size-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                    </span>
                    Live
                  </div>
                )}
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start gap-3 pr-8">
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => setDetailCampaign(c)}
                        className="block max-w-full text-left"
                      >
                        <p className="truncate text-sm font-semibold hover:underline">{c.name}</p>
                      </button>
                      {c.description && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusBadge status={c.status} pulse={running} />
                    <span className="text-xs text-muted-foreground">{fmtDate(c.createdAt)}</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium tabular-nums">{c.validContacts}/{c.target} leads</span>
                    </div>
                    <Progress value={c.progress} className="h-1.5" />
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-md bg-muted p-2">
                      <Mail className="mx-auto mb-0.5 size-3.5 text-sky-500" />
                      <p className="font-semibold tabular-nums">{c.emailsDiscovered}</p>
                      <p className="text-[10px] text-muted-foreground">Emails</p>
                    </div>
                    <div className="rounded-md bg-muted p-2">
                      <MessageCircle className="mx-auto mb-0.5 size-3.5 text-emerald-500" />
                      <p className="font-semibold tabular-nums">{c.whatsappDiscovered}</p>
                      <p className="text-[10px] text-muted-foreground">WhatsApp</p>
                    </div>
                    <div className="rounded-md bg-muted p-2">
                      <Phone className="mx-auto mb-0.5 size-3.5 text-violet-500" />
                      <p className="font-semibold tabular-nums">{c.phonesDiscovered}</p>
                      <p className="text-[10px] text-muted-foreground">Phones</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setDetailCampaign(c)}
                    >
                      <Eye className="mr-1.5 size-3.5" /> Details
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="px-2" aria-label="More actions">
                          <span className="text-lg leading-none">⋯</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        {c.status === 'draft' && (
                          <DropdownMenuItem onClick={() => actionMutation.mutate({ id: c.id, action: 'start' })}>
                            <Play className="mr-2 size-4" /> Start
                          </DropdownMenuItem>
                        )}
                        {c.status === 'running' && (
                          <DropdownMenuItem onClick={() => actionMutation.mutate({ id: c.id, action: 'pause' })}>
                            <Pause className="mr-2 size-4" /> Pause
                          </DropdownMenuItem>
                        )}
                        {c.status === 'paused' && (
                          <DropdownMenuItem onClick={() => actionMutation.mutate({ id: c.id, action: 'resume' })}>
                            <RotateCcw className="mr-2 size-4" /> Resume
                          </DropdownMenuItem>
                        )}
                        {(c.status === 'running' || c.status === 'paused' || c.status === 'queued') && (
                          <DropdownMenuItem onClick={() => actionMutation.mutate({ id: c.id, action: 'cancel' })}>
                            <XCircle className="mr-2 size-4" /> Cancel
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => navigate('leads', { campaignId: c.id })}>
                          <Eye className="mr-2 size-4" /> View Results
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-rose-600 focus:text-rose-700"
                          onClick={() => setDeleteId(c.id)}
                          disabled={c.status === 'running' || c.status === 'queued'}
                        >
                          <Trash2 className="mr-2 size-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {detailCampaign && (
        <CampaignDetailDialog
          campaign={detailCampaign}
          onClose={() => setDetailCampaign(null)}
          onViewLeads={(id) => {
            setDetailCampaign(null)
            navigate('leads', { campaignId: id })
          }}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the campaign and its progress. Discovered leads will remain in the Leads section.
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

function CampaignDetailDialog({
  campaign,
  onClose,
  onViewLeads,
}: {
  campaign: Campaign
  onClose: () => void
  onViewLeads: (id: string) => void
}) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [live, setLive] = React.useState<Campaign>(campaign)
  const [recentLeads, setRecentLeads] = React.useState<Lead[]>([])

  // Poll for leads while running
  const { data: leadsData } = useQuery({
    queryKey: ['campaign', live.id, 'leads'],
    queryFn: () => campaignsApi.leads(live.id, { pageSize: 10 }),
    refetchInterval: live.status === 'running' || live.status === 'queued' ? 3000 : false,
  })

  React.useEffect(() => {
    if (leadsData?.data) setRecentLeads(leadsData.data)
  }, [leadsData])

  // Re-fetch campaign periodically
  const { data: fresh } = useQuery({
    queryKey: ['campaign', live.id],
    queryFn: () => campaignsApi.get(live.id),
    refetchInterval: live.status === 'running' || live.status === 'queued' ? 3000 : false,
  })
  React.useEffect(() => {
    if (fresh) setLive(fresh)
  }, [fresh])

  // Socket subscription
  React.useEffect(() => {
    const unsub = subscribeToCampaign(
      live.id,
      (e: CampaignProgressEvent) => {
        setLive((prev) => ({
          ...prev,
          status: e.status,
          progress: e.progress,
          target: e.target,
          businessesDiscovered: e.stats.businessesDiscovered,
          websitesAnalyzed: e.stats.websitesAnalyzed,
          emailsDiscovered: e.stats.emailsDiscovered,
          whatsappDiscovered: e.stats.whatsappDiscovered,
          phonesDiscovered: e.stats.phonesDiscovered,
          duplicatesRemoved: e.stats.duplicatesRemoved,
          invalidRemoved: e.stats.invalidRemoved,
          highQualityLeads: e.stats.highQualityLeads,
          validContacts: e.stats.validContacts,
        }))
        if (e.recentLead) {
          setRecentLeads((prev) => {
            const next = [e.recentLead!, ...prev]
            return next.slice(0, 10)
          })
        }
      },
      (e) => {
        toast({ title: 'Campaign completed', description: `"${live.name}" finished successfully.` })
        qc.invalidateQueries({ queryKey: ['campaigns'] })
        qc.invalidateQueries({ queryKey: ['dashboard'] })
      },
      (e) => {
        toast({
          variant: 'destructive',
          title: 'Campaign failed',
          description: e?.error || 'The campaign encountered an error.',
        })
      }
    )
    return unsub
  }, [live.id, live.name, qc, toast])

  const c = live
  const running = c.status === 'running'

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            <span className="truncate">{c.name}</span>
            <StatusBadge status={c.status} pulse={running} />
          </DialogTitle>
          <DialogDescription>
            {c.description || 'Campaign live detail'} · Created {fmtDate(c.createdAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Target" value={c.target} icon={Target} loading={false} />
          <StatCard label="Discovered" value={c.businessesDiscovered} icon={Megaphone} tone="sky" />
          <StatCard label="Valid leads" value={c.validContacts} icon={Star} tone="emerald" />
          <StatCard label="High Quality" value={c.highQualityLeads} icon={Star} tone="amber" />
          <StatCard label="Emails" value={c.emailsDiscovered} icon={Mail} tone="sky" />
          <StatCard label="WhatsApp" value={c.whatsappDiscovered} icon={MessageCircle} tone="emerald" />
          <StatCard label="Duplicates" value={c.duplicatesRemoved} icon={CopyIcon} tone="amber" />
          <StatCard label="Invalid" value={c.invalidRemoved} icon={AlertTriangle} tone="rose" />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium tabular-nums">{c.progress}% · {c.validContacts}/{c.target}</span>
          </div>
          <Progress value={c.progress} className="h-2" />
        </div>

        {c.errorMessage && (
          <div className="flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{c.errorMessage}</span>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Recent Leads</h3>
            <Button variant="ghost" size="sm" onClick={() => onViewLeads(c.id)}>
              View all
            </Button>
          </div>
          {recentLeads.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              {running ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" /> Waiting for first lead…
                </span>
              ) : (
                'No leads discovered yet.'
              )}
            </div>
          ) : (
            <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {recentLeads.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-2 rounded-md border bg-card/50 p-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{l.businessName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[l.city, l.country].filter(Boolean).join(', ') || l.nature || '—'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {l.email && <Mail className="size-3.5 text-sky-500" />}
                    {l.whatsapp && <MessageCircle className="size-3.5 text-emerald-500" />}
                    {l.phone && <Phone className="size-3.5 text-violet-500" />}
                    <Badge variant="outline" className="ml-1 text-[10px]">{l.leadScore}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
