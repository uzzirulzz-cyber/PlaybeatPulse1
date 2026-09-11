'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Users, Search, Filter, Download, Eye, Pencil, Star, Ban, CheckCircle2,
  Copy as CopyIcon, ExternalLink, Globe, Mail, MessageCircle, Phone, ChevronLeft,
  ChevronRight, Facebook, Linkedin, Twitter, Instagram, Youtube,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { SectionHeader, EmptyState, CopyButton } from '@/components/common/ui'
import {
  GradeBadge, LeadStatusBadge, ConfidenceBadge, EmailQualityBadge,
} from '@/components/common/badges'
import { campaignsApi, leadsApi } from '@/lib/api'
import type { LeadQuery } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import type { SectionNavigate } from './_shared'
import type { Lead } from '@/lib/types'
import { cn } from '@/lib/utils'

function fmtDate(s?: string) {
  if (!s) return '—'
  try {
    return new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return s
  }
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'verified', label: 'Verified' },
  { value: 'favorite', label: 'Favorite' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'edited', label: 'Edited' },
]

export function LeadsSection({ navigate, initialFilters }: { navigate: SectionNavigate; initialFilters?: LeadQuery }) {
  const { toast } = useToast()
  const qc = useQueryClient()

  // Filters
  const [search, setSearch] = React.useState(initialFilters?.search ?? '')
  const [campaignId, setCampaignId] = React.useState(initialFilters?.campaignId ?? 'all')
  const [country, setCountry] = React.useState(initialFilters?.country ?? '')
  const [city, setCity] = React.useState(initialFilters?.city ?? '')
  const [category, setCategory] = React.useState(initialFilters?.category ?? '')
  const [minScore, setMinScore] = React.useState(initialFilters?.minScore ?? 0)
  const [hasEmail, setHasEmail] = React.useState(initialFilters?.hasEmail ?? false)
  const [hasWhatsApp, setHasWhatsApp] = React.useState(initialFilters?.hasWhatsApp ?? false)
  const [hasPhone, setHasPhone] = React.useState(initialFilters?.hasPhone ?? false)
  const [status, setStatus] = React.useState(initialFilters?.status ?? 'all')
  const [page, setPage] = React.useState(0)
  const [pageSize, setPageSize] = React.useState(25)
  const [filtersOpenMobile, setFiltersOpenMobile] = React.useState(false)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [viewLead, setViewLead] = React.useState<Lead | null>(null)
  const [editLead, setEditLead] = React.useState<Lead | null>(null)
  const [exportOpen, setExportOpen] = React.useState(false)

  const { data: campaigns } = useQuery({
    queryKey: ['campaigns'],
    queryFn: campaignsApi.list,
  })

  const filters: LeadQuery = React.useMemo(() => {
    const f: LeadQuery = {
      page: page + 1,
      pageSize,
    }
    if (search) f.search = search
    if (campaignId !== 'all') f.campaignId = campaignId
    if (country) f.country = country
    if (city) f.city = city
    if (category) f.category = category
    if (minScore > 0) f.minScore = minScore
    if (hasEmail) f.hasEmail = true
    if (hasWhatsApp) f.hasWhatsApp = true
    if (hasPhone) f.hasPhone = true
    if (status !== 'all') f.status = status
    return f
  }, [search, campaignId, country, city, category, minScore, hasEmail, hasWhatsApp, hasPhone, status, page, pageSize])

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['leads', filters],
    queryFn: () => leadsApi.list(filters),
    placeholderData: (prev) => prev,
  })

  const leads = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Reset page when filters change
  React.useEffect(() => { setPage(0) }, [search, campaignId, country, city, category, minScore, hasEmail, hasWhatsApp, hasPhone, status, pageSize])

  // Mutations
  const patchMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Lead> }) => leadsApi.update(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['lead'] })
    },
    onError: (err: unknown) => {
      toast({ variant: 'destructive', title: 'Update failed', description: err instanceof Error ? err.message : String(err) })
    },
  })

  const onAction = (lead: Lead, action: string) => {
    switch (action) {
      case 'view':
        setViewLead(lead)
        break
      case 'verify':
        patchMutation.mutate(
          { id: lead.id, patch: { status: 'verified' } },
          { onSuccess: () => toast({ title: 'Lead marked as verified' }) }
        )
        break
      case 'edit':
        setEditLead(lead)
        break
      case 'favorite':
        patchMutation.mutate(
          { id: lead.id, patch: { favorite: !lead.status || lead.status !== 'favorite' } as any },
          { onSuccess: () => toast({ title: 'Favorite toggled' }) }
        )
        break
      case 'reject':
        patchMutation.mutate(
          { id: lead.id, patch: { status: 'rejected' } },
          { onSuccess: () => toast({ title: 'Lead rejected' }) }
        )
        break
      case 'copy-email':
        if (lead.email) { navigator.clipboard?.writeText(lead.email); toast({ title: 'Email copied' }) }
        break
      case 'copy-whatsapp':
        if (lead.whatsapp) { navigator.clipboard?.writeText(lead.whatsapp); toast({ title: 'WhatsApp copied' }) }
        break
      case 'open-website':
        if (lead.website) window.open(lead.website.startsWith('http') ? lead.website : `https://${lead.website}`, '_blank')
        break
    }
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === leads.length) setSelected(new Set())
    else setSelected(new Set(leads.map((l) => l.id)))
  }

  const onClearFilters = () => {
    setSearch(''); setCampaignId('all'); setCountry(''); setCity(''); setCategory('')
    setMinScore(0); setHasEmail(false); setHasWhatsApp(false); setHasPhone(false); setStatus('all')
  }

  const activeFilterCount = [
    search, campaignId !== 'all' ? 'x' : '', country, city, category,
    minScore > 0 ? 'x' : '', hasEmail ? 'x' : '', hasWhatsApp ? 'x' : '',
    hasPhone ? 'x' : '', status !== 'all' ? 'x' : '',
  ].filter(Boolean).length

  const FiltersPanel = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Filters</p>
        {activeFilterCount > 0 && (
          <button onClick={onClearFilters} className="text-xs text-muted-foreground hover:text-foreground">
            Clear ({activeFilterCount})
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Search</Label>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, email, city…"
            className="pl-8"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Campaign</Label>
        <Select value={campaignId} onValueChange={setCampaignId}>
          <SelectTrigger><SelectValue placeholder="All campaigns" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All campaigns</SelectItem>
            {campaigns?.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Country</Label>
          <Input value={country} onChange={(e) => setCountry(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">City</Label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Category</Label>
        <Input value={category} onChange={(e) => setCategory(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Min lead score — {minScore}</Label>
        <Slider value={[minScore]} min={0} max={100} step={5} onValueChange={(v) => setMinScore(v[0])} />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Contact availability</Label>
        {[
          { label: 'Has email', v: hasEmail, set: setHasEmail },
          { label: 'Has WhatsApp', v: hasWhatsApp, set: setHasWhatsApp },
          { label: 'Has phone', v: hasPhone, set: setHasPhone },
        ].map((c) => (
          <label key={c.label} className="flex min-h-[36px] cursor-pointer items-center justify-between gap-2 text-sm">
            <span>{c.label}</span>
            <Switch checked={c.v} onCheckedChange={c.set} />
          </label>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Leads"
        description="Browse, filter and export discovered business leads"
        icon={Users}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setFiltersOpenMobile(true)} className="lg:hidden">
              <Filter className="mr-2 size-4" /> Filters
              {activeFilterCount > 0 && <Badge variant="secondary" className="ml-1">{activeFilterCount}</Badge>}
            </Button>
            <Button onClick={() => setExportOpen(true)}>
              <Download className="mr-2 size-4" /> Export
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        {/* Desktop filters */}
        <Card className="hidden lg:block">
          <CardContent className="p-4">{FiltersPanel}</CardContent>
        </Card>

        {/* Mobile filters sheet */}
        <Sheet open={filtersOpenMobile} onOpenChange={setFiltersOpenMobile}>
          <SheetContent side="left" className="w-80 overflow-y-auto p-4">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            {FiltersPanel}
            <div className="mt-4">
              <Button className="w-full" onClick={() => setFiltersOpenMobile(false)}>Show {total} results</Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Table */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b px-4 py-2.5 text-sm">
              <p className="text-muted-foreground">
                {selected.size > 0 ? (
                  <span>{selected.size} selected · </span>
                ) : null}
                <span className="font-medium text-foreground">{(page * pageSize) + 1}–{Math.min((page + 1) * pageSize, total)}</span> of {total} leads
              </p>
              {isFetching && <span className="text-xs text-muted-foreground">Updating…</span>}
            </div>
            <div className="max-h-[70vh] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={leads.length > 0 && selected.size === leads.length}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Business</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Website</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={11}><Skeleton className="h-8 w-full" /></TableCell>
                      </TableRow>
                    ))
                  ) : leads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="p-0">
                        <div className="p-6">
                          <EmptyState
                            icon={Users}
                            title="No leads found"
                            description="Try adjusting your filters, or launch a new campaign to discover more leads."
                            action={<Button onClick={() => navigate('find-leads')}>Find Leads</Button>}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    leads.map((l) => {
                      const isSelected = selected.has(l.id)
                      return (
                        <TableRow
                          key={l.id}
                          data-state={isSelected ? 'selected' : undefined}
                          className="cursor-pointer"
                          onClick={() => setViewLead(l)}
                        >
                          <TableCell onClick={(e) => { e.stopPropagation(); toggleSelect(l.id) }}>
                            <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(l.id)} aria-label="Select row" />
                          </TableCell>
                          <TableCell><GradeBadge grade={l.leadGrade} score={l.leadScore} /></TableCell>
                          <TableCell>
                            <div className="max-w-[14rem]">
                              <p className="truncate font-medium">{l.businessName}</p>
                              {l.nature && <p className="truncate text-xs text-muted-foreground">{l.nature}</p>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[10rem]">
                              <p className="truncate text-sm">{l.city || '—'}</p>
                              <p className="truncate text-xs text-muted-foreground">{l.country || '—'}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {l.website ? (
                              <a
                                href={l.website.startsWith('http') ? l.website : `https://${l.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:underline dark:text-emerald-400"
                                title={l.website}
                              >
                                <Globe className="size-3.5" />
                                <span className="max-w-[8rem] truncate">{l.website.replace(/^https?:\/\//, '')}</span>
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {l.email ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="max-w-[12rem] truncate text-sm" title={l.email}>{l.email}</span>
                                <ConfidenceBadge value={l.emailConfidence} />
                              </div>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>
                            {l.whatsapp ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="max-w-[10rem] truncate text-sm" title={l.whatsapp}>{l.whatsapp}</span>
                                <ConfidenceBadge value={l.whatsappConfidence} />
                              </div>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>
                            {l.phone ? <span className="text-sm">{l.phone}</span> : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>
                            <span className="max-w-[8rem] truncate text-xs text-muted-foreground" title={l.sourceName}>
                              {l.sourceName || '—'}
                            </span>
                          </TableCell>
                          <TableCell><LeadStatusBadge status={l.status} /></TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="size-7 p-0" aria-label="Row actions">
                                  <span className="text-lg leading-none">⋯</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onClick={() => onAction(l, 'view')}>
                                  <Eye className="mr-2 size-4" /> View
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onAction(l, 'edit')}>
                                  <Pencil className="mr-2 size-4" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onAction(l, 'verify')}>
                                  <CheckCircle2 className="mr-2 size-4" /> Verify
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onAction(l, 'favorite')}>
                                  <Star className="mr-2 size-4" /> {l.status === 'favorite' ? 'Unfavorite' : 'Favorite'}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onAction(l, 'reject')}>
                                  <Ban className="mr-2 size-4" /> Reject
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => onAction(l, 'copy-email')} disabled={!l.email}>
                                  <CopyIcon className="mr-2 size-4" /> Copy email
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onAction(l, 'copy-whatsapp')} disabled={!l.whatsapp}>
                                  <CopyIcon className="mr-2 size-4" /> Copy WhatsApp
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onAction(l, 'open-website')} disabled={!l.website}>
                                  <ExternalLink className="mr-2 size-4" /> Open website
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col gap-2 border-t px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Rows per page</span>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className="h-7 w-16"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50, 100].map((s) => (
                      <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="size-4" /> Prev
                </Button>
                <span className="px-2 text-xs tabular-nums text-muted-foreground">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page + 1 >= totalPages}
                >
                  Next <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View dialog */}
      {viewLead && (
        <LeadDetailDialog
          lead={viewLead}
          onClose={() => setViewLead(null)}
          onEdit={() => { setEditLead(viewLead); setViewLead(null) }}
        />
      )}

      {/* Edit dialog */}
      {editLead && (
        <LeadEditDialog
          lead={editLead}
          onClose={() => setEditLead(null)}
          onSave={(patch) => {
            patchMutation.mutate(
              { id: editLead.id, patch },
              {
                onSuccess: () => {
                  toast({ title: 'Lead updated' })
                  setEditLead(null)
                },
              }
            )
          }}
          saving={patchMutation.isPending}
        />
      )}

      {/* Export dialog */}
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        filters={filters}
        selectedIds={Array.from(selected)}
        campaigns={campaigns ?? []}
        campaignId={campaignId === 'all' ? undefined : campaignId}
        onExported={() => {
          setSelected(new Set())
          toast({ title: 'Export ready', description: 'Your file has been generated and downloaded.' })
          navigate('exports')
        }}
      />
    </div>
  )
}

function SocialIcon({ platform }: { platform: string }) {
  const p = platform.toLowerCase()
  if (p.includes('facebook')) return <Facebook className="size-3.5" />
  if (p.includes('linkedin')) return <Linkedin className="size-3.5" />
  if (p.includes('twitter') || p.includes('x.com')) return <Twitter className="size-3.5" />
  if (p.includes('instagram')) return <Instagram className="size-3.5" />
  if (p.includes('youtube')) return <Youtube className="size-3.5" />
  return <Globe className="size-3.5" />
}

function LeadDetailDialog({ lead, onClose, onEdit }: { lead: Lead; onClose: () => void; onEdit: () => void }) {
  const { data: fullLead } = useQuery({
    queryKey: ['lead', lead.id],
    queryFn: () => leadsApi.get(lead.id),
    enabled: !!lead.id,
  })
  const l = fullLead ?? lead
  const contacts = l.contacts ?? []

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="pr-8">{l.businessName}</DialogTitle>
          <DialogDescription>
            {[l.nature, l.category, l.city, l.country].filter(Boolean).join(' · ')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-md border p-2 text-center">
            <p className="text-xs text-muted-foreground">Score</p>
            <p className="text-lg font-bold tabular-nums">{l.leadScore}</p>
            <div className="mt-1 flex justify-center"><GradeBadge grade={l.leadGrade} /></div>
          </div>
          <div className="rounded-md border p-2 text-center">
            <p className="text-xs text-muted-foreground">Status</p>
            <div className="mt-2 flex justify-center"><LeadStatusBadge status={l.status} /></div>
          </div>
          <div className="rounded-md border p-2 text-center">
            <p className="text-xs text-muted-foreground">Discovered</p>
            <p className="mt-1 text-xs font-medium">{fmtDate(l.discoveredAt)}</p>
          </div>
          <div className="rounded-md border p-2 text-center">
            <p className="text-xs text-muted-foreground">Source</p>
            <p className="mt-1 truncate text-xs font-medium" title={l.sourceName}>{l.sourceName || '—'}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Contact</h3>
            <div className="space-y-1.5 text-sm">
              {l.email && (
                <div className="flex items-center gap-2">
                  <Mail className="size-4 text-sky-500" />
                  <span className="truncate" title={l.email}>{l.email}</span>
                  <ConfidenceBadge value={l.emailConfidence} />
                  <CopyButton value={l.email} />
                </div>
              )}
              {l.whatsapp && (
                <div className="flex items-center gap-2">
                  <MessageCircle className="size-4 text-emerald-500" />
                  <span className="truncate" title={l.whatsapp}>{l.whatsapp}</span>
                  <ConfidenceBadge value={l.whatsappConfidence} />
                  <CopyButton value={l.whatsapp} />
                </div>
              )}
              {l.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="size-4 text-violet-500" />
                  <span className="truncate">{l.phone}</span>
                  <CopyButton value={l.phone} />
                </div>
              )}
              {l.website && (
                <a
                  href={l.website.startsWith('http') ? l.website : `https://${l.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  <Globe className="size-4" />
                  <span className="truncate">{l.website}</span>
                  <ExternalLink className="size-3" />
                </a>
              )}
              {l.socialProfiles && Object.keys(l.socialProfiles).length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {Object.entries(l.socialProfiles).map(([k, v]) => (
                    <a
                      key={k}
                      href={v}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                      title={v}
                    >
                      <SocialIcon platform={k} />
                      <span className="capitalize">{k}</span>
                    </a>
                  ))}
                </div>
              )}
              {!l.email && !l.whatsapp && !l.phone && !l.website && (
                <p className="text-xs text-muted-foreground">No contact info available.</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Business</h3>
            <div className="space-y-1 text-sm">
              <p><span className="text-muted-foreground">Nature:</span> {l.nature || '—'}</p>
              <p><span className="text-muted-foreground">Category:</span> {l.category || '—'}</p>
              <p><span className="text-muted-foreground">Address:</span> {l.address || '—'}</p>
              <p><span className="text-muted-foreground">Source URL:</span>{' '}
                {l.sourceUrl ? (
                  <a href={l.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline dark:text-emerald-400">
                    <span className="inline-flex items-center gap-1">
                      <ExternalLink className="size-3" /> link
                    </span>
                  </a>
                ) : '—'}
              </p>
            </div>
          </div>
        </div>

        {l.notes && (
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold">Notes</h3>
            <div className="rounded-md border bg-muted/30 p-3 text-sm">{l.notes}</div>
          </div>
        )}

        {contacts.length > 0 && (
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold">Contact Evidence ({contacts.length})</h3>
            <div className="max-h-60 space-y-1.5 overflow-y-auto">
              {contacts.map((c) => (
                <div key={c.id} className="rounded-md border bg-card/50 p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium capitalize">{c.type}</span>
                    <div className="flex items-center gap-1">
                      <ConfidenceBadge value={c.confidence} />
                      {c.quality && <EmailQualityBadge quality={c.quality} />}
                      {c.verified && <Badge variant="outline" className="text-[10px] text-emerald-600">verified</Badge>}
                    </div>
                  </div>
                  <p className="mt-1 truncate font-mono" title={c.value}>{c.value}</p>
                  {c.sourceUrl && (
                    <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-0.5 block truncate text-emerald-600 hover:underline dark:text-emerald-400" title={c.sourceUrl}>
                      {c.sourceUrl}
                    </a>
                  )}
                  {(c.evidence || c.pageSection) && (
                    <p className="mt-0.5 text-muted-foreground">
                      {c.pageSection && <span className="font-medium">[{c.pageSection}] </span>}
                      {c.evidence && <span>“{c.evidence.slice(0, 120)}{c.evidence.length > 120 ? '…' : ''}”</span>}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={onEdit}><Pencil className="mr-2 size-4" /> Edit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LeadEditDialog({
  lead, onClose, onSave, saving,
}: {
  lead: Lead
  onClose: () => void
  onSave: (patch: Partial<Lead>) => void
  saving: boolean
}) {
  const [email, setEmail] = React.useState(lead.email ?? '')
  const [phone, setPhone] = React.useState(lead.phone ?? '')
  const [whatsapp, setWhatsapp] = React.useState(lead.whatsapp ?? '')
  const [notes, setNotes] = React.useState(lead.notes ?? '')
  const [status, setStatus] = React.useState<Lead['status']>(lead.status)

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Lead</DialogTitle>
          <DialogDescription>{lead.businessName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@business.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">WhatsApp</Label>
              <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as Lead['status'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Add internal notes…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({ email, phone, whatsapp, notes, status })} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ExportDialog({
  open, onOpenChange, filters, selectedIds, campaigns, campaignId, onExported,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  filters: LeadQuery
  selectedIds: string[]
  campaigns: { id: string; name: string }[]
  campaignId?: string
  onExported: () => void
}) {
  const { toast } = useToast()
  const [format, setFormat] = React.useState<'csv' | 'xlsx'>('xlsx')
  const [scope, setScope] = React.useState<'all' | 'campaign' | 'filtered' | 'selected'>('filtered')
  const [exportCampaignId, setExportCampaignId] = React.useState(campaignId ?? '')

  const mutation = useMutation({
    mutationFn: () =>
      leadsApi.export({
        format,
        scope,
        campaignId: scope === 'campaign' ? exportCampaignId : undefined,
        filters: scope === 'filtered' ? filters : undefined,
        ids: scope === 'selected' ? selectedIds : undefined,
      }),
    onSuccess: (res) => {
      if (res.fileUrl) window.open(res.fileUrl, '_blank')
      onExported()
      onOpenChange(false)
    },
    onError: (err: unknown) =>
      toast({ variant: 'destructive', title: 'Export failed', description: err instanceof Error ? err.message : String(err) }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Leads</DialogTitle>
          <DialogDescription>Choose format and scope. Files are saved to the Exports section.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as 'csv' | 'xlsx')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="xlsx">XLSX (Excel)</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Scope</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="filtered">Current filter ({filters.page ? 'all pages' : 'all'})</SelectItem>
                <SelectItem value="all">All leads</SelectItem>
                <SelectItem value="campaign">Specific campaign</SelectItem>
                <SelectItem value="selected" disabled={selectedIds.length === 0}>
                  Selected ({selectedIds.length})
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {scope === 'campaign' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Campaign</Label>
              <Select value={exportCampaignId} onValueChange={setExportCampaignId}>
                <SelectTrigger><SelectValue placeholder="Select a campaign" /></SelectTrigger>
                <SelectContent>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
            Export includes 17 columns: business info, contact info, source URL & evidence.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || (scope === 'selected' && selectedIds.length === 0)}>
            {mutation.isPending ? 'Generating…' : 'Generate export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

