'use client'

// PlayBeat — Leads section
// Table with filters, pagination, view-detail dialog (contacts evidence), delete, export
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Search, Eye, Trash2, Download, ChevronLeft, ChevronRight,
  Mail, Phone, MessageCircle, Globe, Star, ExternalLink, X, FileText, FileSpreadsheet,
  Users, Filter, Loader2,
} from 'lucide-react'
import { pbApi } from '@/lib/playbeat-api'
import { usePb } from '@/components/playbeat/context'
import { GlassCard, PbStatusBadge, PbEmptyState, PbSkeleton, StatusDot } from '@/components/playbeat/ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Sheet, SheetContent, SheetTrigger, SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'

const PAGE_SIZE = 20

export function LeadsSection() {
  const { campaignIdContext } = usePb()
  const { toast } = useToast()
  const qc = useQueryClient()

  // Filters
  const [search, setSearch] = React.useState('')
  const [campaignId, setCampaignId] = React.useState(campaignIdContext ?? '')
  const [country, setCountry] = React.useState('')
  const [city, setCity] = React.useState('')
  const [category, setCategory] = React.useState('')
  const [minScore, setMinScore] = React.useState(0)
  const [status, setStatus] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [hasEmail, setHasEmail] = React.useState(false)
  const [hasWhatsApp, setHasWhatsApp] = React.useState(false)
  const [hasPhone, setHasPhone] = React.useState(false)

  const [filtersOpenMobile, setFiltersOpenMobile] = React.useState(false)
  const [viewLeadId, setViewLeadId] = React.useState<string | null>(null)
  const [deleteLeadId, setDeleteLeadId] = React.useState<string | null>(null)
  const [exportOpen, setExportOpen] = React.useState(false)

  React.useEffect(() => {
    if (campaignIdContext) {
      setCampaignId(campaignIdContext)
      setPage(1)
    }
  }, [campaignIdContext])

  const queryParams = React.useMemo(() => ({
    search: search || undefined,
    campaignId: campaignId || undefined,
    country: country || undefined,
    city: city || undefined,
    category: category || undefined,
    minScore: minScore > 0 ? minScore : undefined,
    status: status || undefined,
    hasEmail: hasEmail || undefined,
    hasWhatsApp: hasWhatsApp || undefined,
    hasPhone: hasPhone || undefined,
    page,
    pageSize: PAGE_SIZE,
  }), [search, campaignId, country, city, category, minScore, status, hasEmail, hasWhatsApp, hasPhone, page])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['pb-leads', queryParams],
    queryFn: () => pbApi.leads(queryParams),
    refetchInterval: 30_000,
  })

  const { data: campaigns } = useQuery({
    queryKey: ['pb-extraction-jobs'],
    queryFn: () => pbApi.extractionJobs(),
  })

  const leads = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const activeFiltersCount = [
    search, campaignId, country, city, category, status,
    hasEmail && 'e', hasWhatsApp && 'w', hasPhone && 'p', minScore > 0 ? 's' : '',
  ].filter(Boolean).length

  function clearFilters() {
    setSearch(''); setCampaignId(''); setCountry(''); setCity('')
    setCategory(''); setMinScore(0); setStatus('')
    setHasEmail(false); setHasWhatsApp(false); setHasPhone(false)
    setPage(1)
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => pbApi.deleteLead(id),
    onSuccess: () => {
      toast({ title: 'Lead deleted' })
      qc.invalidateQueries({ queryKey: ['pb-leads'] })
      qc.invalidateQueries({ queryKey: ['pb-dashboard'] })
      setDeleteLeadId(null)
    },
    onError: (e: any) => toast({
      title: 'Delete failed', description: e?.message, variant: 'destructive',
    }),
  })

  const exportMutation = useMutation({
    mutationFn: (data: { format: 'csv' | 'xlsx' | 'json'; scope: 'all' | 'filtered' }) =>
      pbApi.exportLeads({
        format: data.format === 'json' ? 'csv' : data.format, // backend supports csv/xlsx
        scope: data.scope,
        filters: data.scope === 'filtered' ? {
          search, campaignId, country, city, category, minScore,
          hasEmail, hasWhatsApp, hasPhone, status,
        } : undefined,
      }),
    onSuccess: (result) => {
      toast({
        title: 'Export ready',
        description: `${result.leadCount} leads exported`,
      })
      window.open(result.fileUrl, '_blank')
      qc.invalidateQueries({ queryKey: ['pb-exports'] })
      setExportOpen(false)
    },
    onError: (e: any) => toast({
      title: 'Export failed', description: e?.message, variant: 'destructive',
    }),
  })

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-cyan-300" />
          <h2 className="text-sm font-semibold text-slate-100">
            Leads <span className="text-slate-500">({total.toLocaleString()})</span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile filter trigger */}
          <Sheet open={filtersOpenMobile} onOpenChange={setFiltersOpenMobile}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden border-cyan-400/30 bg-cyan-400/5 text-cyan-300"
              >
                <Filter className="mr-1.5 size-3.5" />
                Filters
                {activeFiltersCount > 0 && (
                  <Badge className="ml-1.5 bg-cyan-400 text-[#021018]">{activeFiltersCount}</Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 border-cyan-400/15 bg-[#0a1628]">
              <SheetTitle className="sr-only">Filters</SheetTitle>
              <FiltersPanel
                search={search} setSearch={setSearch}
                campaignId={campaignId} setCampaignId={setCampaignId}
                country={country} setCountry={setCountry}
                city={city} setCity={setCity}
                category={category} setCategory={setCategory}
                minScore={minScore} setMinScore={setMinScore}
                status={status} setStatus={setStatus}
                hasEmail={hasEmail} setHasEmail={setHasEmail}
                hasWhatsApp={hasWhatsApp} setHasWhatsApp={setHasWhatsApp}
                hasPhone={hasPhone} setHasPhone={setHasPhone}
                campaigns={campaigns}
                activeCount={activeFiltersCount}
                onClear={clearFilters}
                onApply={() => setFiltersOpenMobile(false)}
              />
            </SheetContent>
          </Sheet>
          <Button
            onClick={() => setExportOpen(true)}
            className="bg-cyan-400 text-[#021018] hover:bg-cyan-300"
            size="sm"
          >
            <Download className="mr-1.5 size-3.5" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Desktop filters */}
        <div className="hidden lg:block">
          <GlassCard className="lg:sticky lg:top-20">
            <FiltersPanel
              search={search} setSearch={setSearch}
              campaignId={campaignId} setCampaignId={setCampaignId}
              country={country} setCountry={setCountry}
              city={city} setCity={setCity}
              category={category} setCategory={setCategory}
              minScore={minScore} setMinScore={setMinScore}
              status={status} setStatus={setStatus}
              hasEmail={hasEmail} setHasEmail={setHasEmail}
              hasWhatsApp={hasWhatsApp} setHasWhatsApp={setHasWhatsApp}
              hasPhone={hasPhone} setHasPhone={setHasPhone}
              campaigns={campaigns}
              activeCount={activeFiltersCount}
              onClear={clearFilters}
            />
          </GlassCard>
        </div>

        {/* Table */}
        <div className="lg:col-span-3">
          <GlassCard className="p-0">
            {isError ? (
              <PbEmptyState
                title="Failed to load leads"
                icon={Trash2}
                description="The API returned an error. Please try again."
              />
            ) : isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <PbSkeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : leads.length === 0 ? (
              <PbEmptyState
                title="No leads found"
                description="Try adjusting your filters or start a new extraction job."
                icon={Users}
              />
            ) : (
              <div className="overflow-x-auto pb-scroll">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Business</th>
                      <th className="hidden px-3 py-2 text-left md:table-cell">Location</th>
                      <th className="hidden px-3 py-2 text-left sm:table-cell">Website</th>
                      <th className="px-3 py-2 text-left">Email</th>
                      <th className="hidden px-3 py-2 text-left lg:table-cell">WhatsApp</th>
                      <th className="px-3 py-2 text-left">Score</th>
                      <th className="hidden px-3 py-2 text-left xl:table-cell">Source</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {leads.map((lead: any) => (
                      <tr key={lead.id} className="hover:bg-white/[0.02]">
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-slate-200">{lead.businessName}</div>
                          <div className="text-[10px] text-slate-500">{lead.category ?? lead.nature}</div>
                        </td>
                        <td className="hidden px-3 py-2.5 text-slate-400 md:table-cell">
                          {[lead.city, lead.country].filter(Boolean).join(', ') || '—'}
                        </td>
                        <td className="hidden px-3 py-2.5 sm:table-cell">
                          {lead.website ? (
                            <a
                              href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-cyan-300 hover:underline"
                            >
                              <Globe className="size-3" />
                              <span className="max-w-[120px] truncate">{lead.website.replace(/^https?:\/\//, '').replace(/^www\./, '')}</span>
                            </a>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {lead.email ? (
                            <span className="text-slate-300">{lead.email}</span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="hidden px-3 py-2.5 text-slate-300 lg:table-cell">
                          {lead.whatsapp ?? '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <ScoreBadge score={lead.leadScore} grade={lead.leadGrade} />
                        </td>
                        <td className="hidden px-3 py-2.5 text-slate-400 xl:table-cell">
                          <span className="truncate">{lead.sourceName ?? '—'}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <PbStatusBadge status={lead.status} />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setViewLeadId(lead.id)}
                              className="text-cyan-300 hover:bg-cyan-400/10"
                              aria-label="View lead"
                            >
                              <Eye className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteLeadId(lead.id)}
                              className="text-rose-400 hover:bg-rose-500/10"
                              aria-label="Delete lead"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {total > 0 && (
              <div className="flex items-center justify-between border-t border-cyan-400/10 px-3 py-3">
                <p className="text-[11px] text-slate-500">
                  Page {page} of {totalPages} • {total.toLocaleString()} leads
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="border-cyan-400/20 bg-transparent text-slate-300 hover:bg-cyan-400/10"
                  >
                    <ChevronLeft className="size-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="border-cyan-400/20 bg-transparent text-slate-300 hover:bg-cyan-400/10"
                  >
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      {/* View detail dialog */}
      <LeadDetailDialog leadId={viewLeadId} onClose={() => setViewLeadId(null)} />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteLeadId} onOpenChange={(o) => !o && setDeleteLeadId(null)}>
        <AlertDialogContent className="border-cyan-400/20 bg-[#0a1628] text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete lead?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This action is permanent. An audit log entry will be created.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-cyan-400/20 bg-transparent text-slate-300 hover:bg-white/5">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteLeadId && deleteMutation.mutate(deleteLeadId)}
              className="bg-rose-500 text-white hover:bg-rose-600"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Export dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="border-cyan-400/20 bg-[#0a1628] text-slate-100">
          <DialogHeader>
            <DialogTitle>Export Leads</DialogTitle>
            <DialogDescription className="text-slate-400">
              Choose format & scope. Backend supports CSV and XLSX.
            </DialogDescription>
          </DialogHeader>
          <ExportForm
            onSubmit={(data) => exportMutation.mutate(data)}
            loading={exportMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ScoreBadge({ score, grade }: { score: number; grade?: string }) {
  const tone =
    grade === 'excellent' || grade === 'high' ? 'green' :
    grade === 'good' ? 'cyan' :
    grade === 'medium' ? 'amber' : 'gray'
  const colors: Record<string, string> = {
    green: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/40',
    cyan: 'bg-cyan-400/15 text-cyan-300 border-cyan-400/40',
    amber: 'bg-amber-400/15 text-amber-300 border-amber-400/40',
    gray: 'bg-slate-500/15 text-slate-300 border-slate-500/40',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${colors[tone]}`}>
      <Star className="size-2.5" />
      {score}
    </span>
  )
}

function FiltersPanel(props: {
  search: string; setSearch: (v: string) => void
  campaignId: string; setCampaignId: (v: string) => void
  country: string; setCountry: (v: string) => void
  city: string; setCity: (v: string) => void
  category: string; setCategory: (v: string) => void
  minScore: number; setMinScore: (v: number) => void
  status: string; setStatus: (v: string) => void
  hasEmail: boolean; setHasEmail: (v: boolean) => void
  hasWhatsApp: boolean; setHasWhatsApp: (v: boolean) => void
  hasPhone: boolean; setHasPhone: (v: boolean) => void
  campaigns?: any[]
  activeCount: number
  onClear: () => void
  onApply?: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100">Filters</h3>
        {props.activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={props.onClear} className="text-cyan-300 hover:bg-cyan-400/10">
            Clear ({props.activeCount})
          </Button>
        )}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-slate-300">Search</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
          <Input
            value={props.search}
            onChange={(e) => props.setSearch(e.target.value)}
            placeholder="business, email, city…"
            className="h-9 border-cyan-400/20 bg-white/[0.04] pl-8 text-xs text-slate-100 placeholder:text-slate-500"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-slate-300">Campaign</Label>
        <Select value={props.campaignId} onValueChange={props.setCampaignId}>
          <SelectTrigger className="h-9 border-cyan-400/20 bg-white/[0.04] text-xs text-slate-100">
            <SelectValue placeholder="All campaigns" />
          </SelectTrigger>
          <SelectContent className="border-cyan-400/20 bg-[#0a1628] text-slate-100">
            <SelectItem value="">All campaigns</SelectItem>
            {props.campaigns?.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-300">Country</Label>
          <Input
            value={props.country}
            onChange={(e) => props.setCountry(e.target.value)}
            placeholder="Any"
            className="h-9 border-cyan-400/20 bg-white/[0.04] text-xs text-slate-100 placeholder:text-slate-500"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-300">City</Label>
          <Input
            value={props.city}
            onChange={(e) => props.setCity(e.target.value)}
            placeholder="Any"
            className="h-9 border-cyan-400/20 bg-white/[0.04] text-xs text-slate-100 placeholder:text-slate-500"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-slate-300">Category</Label>
        <Input
          value={props.category}
          onChange={(e) => props.setCategory(e.target.value)}
          placeholder="Any"
          className="h-9 border-cyan-400/20 bg-white/[0.04] text-xs text-slate-100 placeholder:text-slate-500"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-slate-300">Min Score: {props.minScore}</Label>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={props.minScore}
          onChange={(e) => props.setMinScore(parseInt(e.target.value, 10))}
          className="w-full accent-cyan-400"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-slate-300">Status</Label>
        <Select value={props.status} onValueChange={props.setStatus}>
          <SelectTrigger className="h-9 border-cyan-400/20 bg-white/[0.04] text-xs text-slate-100">
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent className="border-cyan-400/20 bg-[#0a1628] text-slate-100">
            <SelectItem value="">Any</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="favorite">Favorite</SelectItem>
            <SelectItem value="edited">Edited</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 rounded-lg border border-cyan-400/15 bg-white/[0.02] p-3">
        <p className="text-[10px] uppercase tracking-wider text-slate-500">Must have</p>
        <ToggleRow label="Email" checked={props.hasEmail} onChange={props.setHasEmail} />
        <ToggleRow label="WhatsApp" checked={props.hasWhatsApp} onChange={props.setHasWhatsApp} />
        <ToggleRow label="Phone" checked={props.hasPhone} onChange={props.setHasPhone} />
      </div>
      {props.onApply && (
        <Button onClick={props.onApply} className="w-full bg-cyan-400 text-[#021018] hover:bg-cyan-300">
          Apply
        </Button>
      )}
    </div>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-300">{label}</span>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-cyan-400"
      />
    </div>
  )
}

function LeadDetailDialog({ leadId, onClose }: { leadId: string | null; onClose: () => void }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['pb-lead-detail', leadId],
    queryFn: () => pbApi.leadDetail(leadId!),
    enabled: !!leadId,
  })

  return (
    <Dialog open={!!leadId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto pb-scroll border-cyan-400/20 bg-[#0a1628] text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="size-4 text-cyan-300" />
            Lead Detail
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Evidence-backed contact information for this lead
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2 py-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <PbSkeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : isError || !data ? (
          <PbEmptyState title="Failed to load lead" icon={X} />
        ) : (
          <LeadDetailBody lead={data} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function LeadDetailBody({ lead }: { lead: any }) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-100">{lead.businessName}</h3>
          <p className="text-xs text-slate-400">
            {[lead.category, lead.nature].filter(Boolean).join(' • ')}
            {lead.city && ` • ${[lead.city, lead.country].filter(Boolean).join(', ')}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ScoreBadge score={lead.leadScore} grade={lead.leadGrade} />
          <PbStatusBadge status={lead.status} />
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <DetailTile label="Email" value={lead.email ?? '—'} icon={Mail} tone={lead.email ? 'cyan' : 'gray'} />
        <DetailTile label="WhatsApp" value={lead.whatsapp ?? '—'} icon={MessageCircle} tone={lead.whatsapp ? 'green' : 'gray'} />
        <DetailTile label="Phone" value={lead.phone ?? '—'} icon={Phone} tone={lead.phone ? 'cyan' : 'gray'} />
        <DetailTile label="Website" value={lead.website ?? '—'} icon={Globe} tone={lead.website ? 'cyan' : 'gray'} />
      </div>

      {/* Business info */}
      <div className="rounded-lg border border-cyan-400/15 bg-white/[0.02] p-4">
        <p className="mb-2 text-[10px] uppercase tracking-wider text-cyan-300">Business</p>
        <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
          <DetailRow label="Category" value={lead.category} />
          <DetailRow label="Nature" value={lead.nature} />
          <DetailRow label="Address" value={lead.address} />
          <DetailRow label="City" value={lead.city} />
          <DetailRow label="Country" value={lead.country} />
          <DetailRow label="Source" value={lead.sourceName} />
        </dl>
        {lead.sourceUrl && (
          <a
            href={lead.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-[11px] text-cyan-300 hover:underline"
          >
            <ExternalLink className="size-3" />
            View source URL
          </a>
        )}
      </div>

      {/* Social profiles */}
      {lead.socialProfiles && Object.keys(lead.socialProfiles).length > 0 && (
        <div className="rounded-lg border border-cyan-400/15 bg-white/[0.02] p-4">
          <p className="mb-2 text-[10px] uppercase tracking-wider text-cyan-300">Social Profiles</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(lead.socialProfiles).map(([k, v]) => (
              <a
                key={k}
                href={v as string}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-cyan-400/30 bg-cyan-400/5 px-2 py-1 text-[11px] text-cyan-300 hover:bg-cyan-400/15"
              >
                <ExternalLink className="size-3" />
                {k}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Contact evidence */}
      {lead.contacts && lead.contacts.length > 0 && (
        <div className="rounded-lg border border-cyan-400/15 bg-white/[0.02] p-4">
          <p className="mb-3 text-[10px] uppercase tracking-wider text-cyan-300">
            Contact Evidence ({lead.contacts.length})
          </p>
          <div className="max-h-96 space-y-2 overflow-y-auto pb-scroll">
            {lead.contacts.map((c: any) => (
              <div key={c.id} className="rounded-md border border-white/5 bg-white/[0.02] p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ContactIcon type={c.type} />
                    <span className="font-mono text-slate-200">{c.value}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.verified && <StatusDot tone="green" />}
                    <Badge variant="outline" className="border-cyan-400/30 text-cyan-300">
                      {Math.round((c.confidence ?? 0) * 100)}% conf
                    </Badge>
                    {c.quality && (
                      <Badge variant="outline" className="border-cyan-400/30 text-slate-300">
                        {c.quality}
                      </Badge>
                    )}
                  </div>
                </div>
                {c.sourceUrl && (
                  <a
                    href={c.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-cyan-300 hover:underline"
                  >
                    <ExternalLink className="size-2.5" />
                    {c.sourceName ?? 'source'}
                    {c.pageSection && ` • ${c.pageSection}`}
                  </a>
                )}
                {c.evidence && (
                  <p className="mt-1.5 rounded bg-black/20 p-2 font-mono text-[10px] text-slate-400">
                    {c.evidence}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {lead.notes && (
        <div className="rounded-lg border border-cyan-400/15 bg-white/[0.02] p-4">
          <p className="mb-2 text-[10px] uppercase tracking-wider text-cyan-300">Notes</p>
          <p className="text-xs text-slate-300">{lead.notes}</p>
        </div>
      )}

      <div className="border-t border-white/5 pt-3 text-[10px] text-slate-500">
        Discovered: {new Date(lead.discoveredAt).toLocaleString()} • Created: {new Date(lead.createdAt).toLocaleString()}
      </div>
    </div>
  )
}

function DetailTile({
  label, value, icon: Icon, tone,
}: {
  label: string; value: string; icon: typeof Mail; tone: 'cyan' | 'green' | 'gray'
}) {
  const colors: Record<string, string> = {
    cyan: 'text-cyan-300 border-cyan-400/30',
    green: 'text-emerald-300 border-emerald-400/30',
    gray: 'text-slate-400 border-slate-500/30',
  }
  return (
    <div className={`rounded-lg border bg-white/[0.02] p-3 ${colors[tone]}`}>
      <div className="flex items-center gap-1.5">
        <Icon className="size-3" />
        <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      </div>
      <p className="mt-1 truncate text-xs font-semibold text-slate-200">{value}</p>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-[11px] uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="truncate text-slate-300">{value || '—'}</dd>
    </div>
  )
}

function ContactIcon({ type }: { type: string }) {
  const Icon = type === 'email' ? Mail : type === 'whatsapp' ? MessageCircle : type === 'phone' ? Phone : type === 'website' ? Globe : ExternalLink
  return <Icon className="size-3.5 text-cyan-300" />
}

function ExportForm({
  onSubmit,
  loading,
}: {
  onSubmit: (data: { format: 'csv' | 'xlsx' | 'json'; scope: 'all' | 'filtered' }) => void
  loading: boolean
}) {
  const [format, setFormat] = React.useState<'csv' | 'xlsx' | 'json'>('xlsx')
  const [scope, setScope] = React.useState<'all' | 'filtered'>('filtered')

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-slate-300">Format</Label>
        <div className="grid grid-cols-3 gap-2">
          {(['xlsx', 'csv', 'json'] as const).map((f) => {
            const Icon = f === 'xlsx' ? FileSpreadsheet : f === 'csv' ? FileText : FileText
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={`flex min-h-[60px] flex-col items-center gap-1.5 rounded-lg border p-3 transition-all ${
                  format === f
                    ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-300'
                    : 'border-cyan-400/15 bg-white/[0.02] text-slate-300 hover:border-cyan-400/30'
                }`}
              >
                <Icon className="size-4" />
                <span className="text-[11px] uppercase">{f}</span>
              </button>
            )
          })}
        </div>
        {format === 'json' && (
          <p className="text-[10px] text-amber-300">
            Note: backend currently supports CSV and XLSX. JSON will fall back to CSV.
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-slate-300">Scope</Label>
        <div className="grid grid-cols-2 gap-2">
          {(['filtered', 'all'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={`min-h-[44px] rounded-lg border px-3 text-sm font-medium transition-all ${
                scope === s
                  ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-300'
                  : 'border-cyan-400/15 bg-white/[0.02] text-slate-300 hover:border-cyan-400/30'
              }`}
            >
              {s === 'filtered' ? 'Current filters' : 'All leads'}
            </button>
          ))}
        </div>
      </div>
      <Button
        onClick={() => onSubmit({ format, scope })}
        disabled={loading}
        className="w-full bg-cyan-400 text-[#021018] hover:bg-cyan-300"
      >
        {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}
        Generate Export
      </Button>
    </div>
  )
}
