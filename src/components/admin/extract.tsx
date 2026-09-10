'use client'

// PlayBeat — Extract Leads section
// Form: Country/City/Category/Target/Sources/Required fields/Verification level
// On submit → pbApi.extractLeads → toast → navigate to Jobs section
// Live progress: poll /api/worker/tick every 3s with progress bar
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  MapPin, Briefcase, Target, Layers, Mail, Phone, MessageCircle, Globe,
  Activity, Loader2, Rocket, AlertTriangle, CheckCircle2, X,
} from 'lucide-react'
import { pbApi } from '@/lib/playbeat-api'
import { usePb, type AdminSection } from '@/components/playbeat/context'
import { GlassCard, StatusDot, PbStatusBadge } from '@/components/playbeat/ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'

const CATEGORIES = [
  'Software companies',
  'Marketing agencies',
  'Restaurants',
  'Hotels',
  'Real estate',
  'E-commerce',
  'SaaS',
  'IT services',
  'Web development',
  'Accounting',
  'Law firms',
  'Clinics',
  'Manufacturers',
  'Retailers',
  'Local services',
]

const TARGETS = [1000, 2000, 5000, 10000]

const VERIFICATION_LEVELS = [
  { value: 'basic', label: 'Basic (syntax check)' },
  { value: 'standard', label: 'Standard (syntax + domain MX)' },
  { value: 'strict', label: 'Strict (full validation, slower)' },
]

interface ExtractProps {
  onNavigate: (section?: AdminSection, opts?: { campaignId?: string }) => void
}

export function ExtractSection({ onNavigate }: ExtractProps) {
  const { toast } = useToast()
  const qc = useQueryClient()

  const [country, setCountry] = React.useState('United Arab Emirates')
  const [city, setCity] = React.useState('Dubai')
  const [category, setCategory] = React.useState(CATEGORIES[0])
  const [customCategory, setCustomCategory] = React.useState('')
  const [target, setTarget] = React.useState(1000)
  const [customTarget, setCustomTarget] = React.useState<string>('')
  const [selectedSources, setSelectedSources] = React.useState<string[]>([])
  const [requiredFields, setRequiredFields] = React.useState<string[]>(['email', 'phone'])
  const [verificationLevel, setVerificationLevel] = React.useState('standard')

  const [activeJob, setActiveJob] = React.useState<{ id: string; name: string } | null>(null)
  const [progress, setProgress] = React.useState<any>(null)

  const { data: sources } = useQuery({
    queryKey: ['pb-sources'],
    queryFn: () => pbApi.sources(),
  })

  const effectiveCategory = customCategory.trim() || category
  const effectiveTarget = React.useMemo(() => {
    const t = customTarget ? parseInt(customTarget, 10) : target
    if (!t || isNaN(t) || t < 1000) return 1000
    return t
  }, [customTarget, target])

  const startMutation = useMutation({
    mutationFn: () =>
      pbApi.extractLeads({
        category: effectiveCategory,
        city: city.trim(),
        country: country.trim(),
        target: effectiveTarget,
        sources: selectedSources.length ? selectedSources : undefined,
        requiredFields,
        verificationLevel,
      }),
    onSuccess: (campaign) => {
      toast({
        title: 'Extraction started',
        description: `Target: ${effectiveTarget.toLocaleString()} unique leads`,
      })
      setActiveJob({ id: campaign.id, name: campaign.name })
      setProgress(null)
      qc.invalidateQueries({ queryKey: ['pb-extraction-jobs'] })
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to start extraction',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      })
    },
  })

  // Poll worker tick while activeJob is set
  React.useEffect(() => {
    if (!activeJob) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    async function tick() {
      try {
        const result = await pbApi.workerTick(activeJob!.id)
        if (cancelled) return
        setProgress(result)
        if (result.done || result.status === 'completed' || result.status === 'failed' || result.status === 'cancelled') {
          qc.invalidateQueries({ queryKey: ['pb-extraction-jobs'] })
          qc.invalidateQueries({ queryKey: ['pb-dashboard'] })
          qc.invalidateQueries({ queryKey: ['pb-leads'] })
          if (result.status === 'failed') {
            toast({
              title: 'Extraction failed',
              description: result.error || 'See jobs for details.',
              variant: 'destructive',
            })
          } else if (result.status === 'completed' || result.done) {
            toast({
              title: 'Extraction complete',
              description: `Discovered ${result.stats?.validContacts ?? 0} valid leads.`,
            })
          }
          return
        }
      } catch (err: any) {
        if (cancelled) return
        // network / 401 — keep polling
      }
      timer = setTimeout(tick, 3000)
    }
    tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [activeJob?.id])

  function toggleRequired(field: string) {
    setRequiredFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    )
  }
  function toggleSource(name: string) {
    setSelectedSources((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]
    )
  }

  const pct = progress?.progress ? Math.min(100, Math.round(progress.progress)) : 0
  const isRunning = activeJob && !progress?.done && progress?.status !== 'completed' && progress?.status !== 'failed' && progress?.status !== 'cancelled'

  return (
    <div className="space-y-6">
      {/* Minimum target callout */}
      <GlassCard className="border-cyan-400/30 bg-cyan-400/[0.04]">
        <div className="flex items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
            <Target className="size-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-100">
              Minimum target: 1,000 unique leads
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Rule 1 (server-enforced): every extraction starts with a minimum of 1,000 unique leads.
              Targets below 1,000 are automatically bumped up. Actual results depend on publicly
              available data in your selected location and category.
            </p>
          </div>
          <Badge className="bg-cyan-400/15 text-cyan-300 border border-cyan-400/30">
            Enforced
          </Badge>
        </div>
      </GlassCard>

      {/* Active extraction live progress */}
      {activeJob && (
        <GlassCard className="border-cyan-400/40 pb-glow">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-cyan-300" />
              <h2 className="text-sm font-semibold text-slate-100">Live Progress</h2>
              <PbStatusBadge status={progress?.status ?? 'queued'} />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setActiveJob(null)
                setProgress(null)
                onNavigate('jobs')
              }}
              className="text-slate-400 hover:bg-white/5"
            >
              <X className="mr-1.5 size-3.5" />
              Close
            </Button>
          </div>

          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-slate-300">{activeJob.name}</span>
            <span className="font-mono text-cyan-300">{pct}%</span>
          </div>
          <Progress value={pct} className="mb-5 h-2 bg-white/10" />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            <ProgressStat label="Businesses" value={progress?.stats?.businessesDiscovered ?? 0} />
            <ProgressStat label="Valid leads" value={progress?.stats?.validContacts ?? 0} />
            <ProgressStat label="Emails" value={progress?.stats?.emailsDiscovered ?? 0} />
            <ProgressStat label="WhatsApp" value={progress?.stats?.whatsappDiscovered ?? 0} />
            <ProgressStat label="Phones" value={progress?.stats?.phonesDiscovered ?? 0} />
            <ProgressStat label="Duplicates" value={progress?.stats?.duplicatesRemoved ?? 0} />
            <ProgressStat label="Invalid" value={progress?.stats?.invalidRemoved ?? 0} />
            <ProgressStat label="Sources" value={progress?.stats?.websitesAnalyzed ?? 0} />
          </div>

          {progress?.error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{progress.error}</span>
            </div>
          )}

          {isRunning && (
            <p className="mt-4 flex items-center gap-2 text-[11px] text-slate-400">
              <Loader2 className="size-3 animate-spin text-cyan-300" />
              Polling /api/worker/tick every 3s…
            </p>
          )}
          {!isRunning && (
            <Button
              onClick={() => onNavigate('leads', { campaignId: activeJob.id })}
              className="mt-4 bg-cyan-400 text-[#021018] hover:bg-cyan-300"
            >
              <CheckCircle2 className="mr-1.5 size-4" />
              View leads
            </Button>
          )}
        </GlassCard>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main form */}
        <div className="space-y-6 lg:col-span-2">
          {/* Location */}
          <GlassCard>
            <div className="mb-4 flex items-center gap-2">
              <MapPin className="size-4 text-cyan-300" />
              <h2 className="text-sm font-semibold text-slate-100">Location</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="country" className="text-xs text-slate-300">Country *</Label>
                <Input
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="United Arab Emirates"
                  className="min-h-[44px] border-cyan-400/20 bg-white/[0.04] text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city" className="text-xs text-slate-300">City *</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Dubai"
                  className="min-h-[44px] border-cyan-400/20 bg-white/[0.04] text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60"
                />
              </div>
            </div>
          </GlassCard>

          {/* Business */}
          <GlassCard>
            <div className="mb-4 flex items-center gap-2">
              <Briefcase className="size-4 text-cyan-300" />
              <h2 className="text-sm font-semibold text-slate-100">Business Category</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Category *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="min-h-[44px] border-cyan-400/20 bg-white/[0.04] text-slate-100">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="border-cyan-400/20 bg-[#0a1628] text-slate-100">
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c} className="focus:bg-cyan-400/10">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custom-cat" className="text-xs text-slate-300">
                  Custom category (overrides)
                </Label>
                <Input
                  id="custom-cat"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="e.g. Dental clinics"
                  className="min-h-[44px] border-cyan-400/20 bg-white/[0.04] text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60"
                />
              </div>
            </div>
          </GlassCard>

          {/* Required fields */}
          <GlassCard>
            <div className="mb-4 flex items-center gap-2">
              <Layers className="size-4 text-cyan-300" />
              <h2 className="text-sm font-semibold text-slate-100">Required Contact Fields</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <RequiredToggle
                icon={Mail}
                label="Email"
                checked={requiredFields.includes('email')}
                onToggle={() => toggleRequired('email')}
              />
              <RequiredToggle
                icon={Phone}
                label="Phone"
                checked={requiredFields.includes('phone')}
                onToggle={() => toggleRequired('phone')}
              />
              <RequiredToggle
                icon={MessageCircle}
                label="WhatsApp"
                checked={requiredFields.includes('whatsapp')}
                onToggle={() => toggleRequired('whatsapp')}
              />
              <RequiredToggle
                icon={Globe}
                label="Website"
                checked={requiredFields.includes('website')}
                onToggle={() => toggleRequired('website')}
              />
            </div>
          </GlassCard>

          {/* Sources */}
          <GlassCard>
            <div className="mb-4 flex items-center gap-2">
              <Layers className="size-4 text-cyan-300" />
              <h2 className="text-sm font-semibold text-slate-100">Sources</h2>
              <span className="text-[11px] text-slate-500">(leave empty = all enabled)</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {sources?.map((s: any) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-cyan-400/15 bg-white/[0.02] p-3 transition-colors hover:border-cyan-400/40"
                >
                  <Checkbox
                    checked={selectedSources.includes(s.name)}
                    onCheckedChange={() => toggleSource(s.name)}
                    className="border-cyan-400/40 data-[state=checked]:bg-cyan-400 data-[state=checked]:text-[#021018]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-200">{s.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {s.type} • {s.enabled ? 'enabled' : 'disabled'}
                    </p>
                  </div>
                  <StatusDot tone={s.status === 'active' ? 'green' : s.status === 'error' ? 'red' : 'amber'} />
                </label>
              ))}
              {!sources || sources.length === 0 ? (
                <p className="text-xs text-slate-500">Loading sources…</p>
              ) : null}
            </div>
          </GlassCard>
        </div>

        {/* Sidebar: target + verification + start */}
        <div className="space-y-6">
          <GlassCard className="lg:sticky lg:top-20">
            <div className="mb-4 flex items-center gap-2">
              <Target className="size-4 text-cyan-300" />
              <h2 className="text-sm font-semibold text-slate-100">Target</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {TARGETS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTarget(t)
                    setCustomTarget('')
                  }}
                  className={`min-h-[44px] rounded-lg border px-3 text-sm font-semibold transition-all ${
                    !customTarget && target === t
                      ? 'border-cyan-400/60 bg-cyan-400/15 text-cyan-300 shadow-[0_0_14px_rgba(0,212,255,0.2)]'
                      : 'border-cyan-400/20 bg-white/[0.02] text-slate-300 hover:border-cyan-400/40'
                  }`}
                >
                  {t.toLocaleString()}
                </button>
              ))}
            </div>
            <div className="mt-3 space-y-1.5">
              <Label htmlFor="custom-target" className="text-xs text-slate-300">
                Custom target (min 1,000)
              </Label>
              <Input
                id="custom-target"
                type="number"
                min={1000}
                step={500}
                value={customTarget}
                onChange={(e) => setCustomTarget(e.target.value)}
                placeholder="e.g. 1500"
                className="min-h-[44px] border-cyan-400/20 bg-white/[0.04] text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60"
              />
              {customTarget && parseInt(customTarget, 10) < 1000 && (
                <p className="text-[11px] text-amber-300">
                  Will be bumped to 1,000 (server-enforced Rule 1).
                </p>
              )}
            </div>
            <div className="mt-4 rounded-lg bg-cyan-400/[0.06] p-3">
              <p className="text-[10px] uppercase tracking-wider text-cyan-300">Effective Target</p>
              <p className="mt-1 text-2xl font-bold text-slate-100">
                {effectiveTarget.toLocaleString()}
              </p>
            </div>

            <div className="mt-4 space-y-1.5">
              <Label className="text-xs text-slate-300">Verification Level</Label>
              <Select value={verificationLevel} onValueChange={setVerificationLevel}>
                <SelectTrigger className="min-h-[44px] border-cyan-400/20 bg-white/[0.04] text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-cyan-400/20 bg-[#0a1628] text-slate-100">
                  {VERIFICATION_LEVELS.map((v) => (
                    <SelectItem key={v.value} value={v.value}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              disabled={startMutation.isPending || !country.trim() || !city.trim()}
              onClick={() => startMutation.mutate()}
              className="mt-5 min-h-[48px] w-full bg-cyan-400 text-[#021018] hover:bg-cyan-300 shadow-[0_0_24px_rgba(0,212,255,0.4)]"
            >
              {startMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Starting…
                </>
              ) : (
                <>
                  <Rocket className="mr-2 size-4" />
                  Start Extraction
                </>
              )}
            </Button>
            <p className="mt-2 text-center text-[10px] text-slate-500">
              Creates a queued campaign — worker picks it up automatically
            </p>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}

function ProgressStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-cyan-400/15 bg-white/[0.02] p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-100">{value.toLocaleString()}</p>
    </div>
  )
}

function RequiredToggle({
  icon: Icon,
  label,
  checked,
  onToggle,
}: {
  icon: typeof Mail
  label: string
  checked: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex min-h-[60px] flex-col items-center justify-center gap-2 rounded-lg border p-3 transition-all ${
        checked
          ? 'border-cyan-400/60 bg-cyan-400/10 shadow-[0_0_12px_rgba(0,212,255,0.18)]'
          : 'border-cyan-400/15 bg-white/[0.02] hover:border-cyan-400/30'
      }`}
    >
      <Icon className={`size-4 ${checked ? 'text-cyan-300' : 'text-slate-400'}`} />
      <span className={`text-xs font-medium ${checked ? 'text-cyan-300' : 'text-slate-300'}`}>
        {label}
      </span>
    </button>
  )
}
