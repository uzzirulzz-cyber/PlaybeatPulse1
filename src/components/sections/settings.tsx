'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Settings as SettingsIcon, Gauge, SlidersHorizontal, ShieldCheck, Info,
  Save, RotateCcw, Globe, Server, Lock, Code,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { SectionHeader } from '@/components/common/ui'
import { settingsApi } from '@/lib/api'
import { DEFAULT_SCORING } from '@/lib/types'
import { useToast } from '@/hooks/use-toast'
import type { ScoringConfig, CampaignLimits } from '@/lib/types'

const SCORING_FIELDS: { key: keyof ScoringConfig; label: string; description: string }[] = [
  { key: 'website', label: 'Has website', description: 'Business has a discoverable website' },
  { key: 'businessNameCategoryMatch', label: 'Name ↔ Category match', description: 'Business name aligns with category/nature' },
  { key: 'businessEmail', label: 'Business email', description: 'Email is on a business domain (not free provider)' },
  { key: 'verifiedEmail', label: 'Verified email', description: 'Email passed syntax + domain validation' },
  { key: 'whatsappEvidence', label: 'WhatsApp evidence', description: 'WhatsApp link found on website with high confidence' },
  { key: 'phone', label: 'Phone present', description: 'Phone number discovered' },
  { key: 'businessAddress', label: 'Business address', description: 'Physical address available' },
  { key: 'socialProfile', label: 'Social profile', description: 'Social media profiles discovered' },
  { key: 'activeWebsite', label: 'Active website', description: 'Website responded successfully during analysis' },
]

export function SettingsSection() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Settings"
        description="Tune lead scoring, campaign limits and review compliance"
        icon={SettingsIcon}
      />
      <Tabs defaultValue="scoring">
        <TabsList className="grid w-full grid-cols-2 sm:flex sm:w-auto">
          <TabsTrigger value="scoring"><Gauge className="mr-1.5 size-3.5" /> Scoring</TabsTrigger>
          <TabsTrigger value="limits"><SlidersHorizontal className="mr-1.5 size-3.5" /> Limits</TabsTrigger>
          <TabsTrigger value="compliance"><ShieldCheck className="mr-1.5 size-3.5" /> Compliance</TabsTrigger>
          <TabsTrigger value="about"><Info className="mr-1.5 size-3.5" /> About</TabsTrigger>
        </TabsList>

        <TabsContent value="scoring"><ScoringTab /></TabsContent>
        <TabsContent value="limits"><LimitsTab /></TabsContent>
        <TabsContent value="compliance"><ComplianceTab /></TabsContent>
        <TabsContent value="about"><AboutTab /></TabsContent>
      </Tabs>
    </div>
  )
}

function ScoringTab() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'scoring'],
    queryFn: settingsApi.getScoring,
  })

  const [cfg, setCfg] = React.useState<ScoringConfig>(DEFAULT_SCORING)
  const [dirty, setDirty] = React.useState(false)

  React.useEffect(() => {
    if (data) {
      setCfg(data)
      setDirty(false)
    }
  }, [data])

  const total = SCORING_FIELDS.reduce((sum, f) => sum + (cfg[f.key] ?? 0), 0)

  const mutation = useMutation({
    mutationFn: () => settingsApi.setScoring(cfg),
    onSuccess: (saved) => {
      setCfg(saved)
      setDirty(false)
      qc.invalidateQueries({ queryKey: ['settings', 'scoring'] })
      toast({ title: 'Scoring weights saved' })
    },
    onError: (err: unknown) =>
      toast({ variant: 'destructive', title: 'Save failed', description: err instanceof Error ? err.message : String(err) }),
  })

  const reset = () => {
    setCfg(DEFAULT_SCORING)
    setDirty(true)
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="size-4 text-emerald-600" /> Lead Scoring Weights
        </CardTitle>
        <CardDescription>
          Each weight contributes to a lead's overall score (0–100). Total is normalized to 100 at runtime.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
              <div>
                <p className="text-sm font-medium">Total configured weight</p>
                <p className="text-xs text-muted-foreground">Will be normalized to 100 for lead scoring</p>
              </div>
              <Badge
                variant="outline"
                className={
                  total === 100
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                }
              >
                {total} / 100
              </Badge>
            </div>
            <div className="space-y-4">
              {SCORING_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">{f.label}</Label>
                      <p className="text-xs text-muted-foreground">{f.description}</p>
                    </div>
                    <span className="ml-2 min-w-[3rem] text-right text-sm font-semibold tabular-nums">
                      {cfg[f.key] ?? 0}
                    </span>
                  </div>
                  <Slider
                    value={[cfg[f.key] ?? 0]}
                    min={0}
                    max={40}
                    step={1}
                    onValueChange={(v) => {
                      setCfg((prev) => ({ ...prev, [f.key]: v[0] }))
                      setDirty(true)
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={reset} disabled={isLoading}>
                <RotateCcw className="mr-2 size-4" /> Reset to defaults
              </Button>
              <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !dirty}>
                <Save className="mr-2 size-4" /> {mutation.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function LimitsTab() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'limits'],
    queryFn: settingsApi.getLimits,
  })

  const [maxConcurrent, setMaxConcurrent] = React.useState(2)
  const [maxTarget, setMaxTarget] = React.useState(5000)
  const [maxWebsites, setMaxWebsites] = React.useState(200)
  const [dirty, setDirty] = React.useState(false)

  React.useEffect(() => {
    if (data) {
      setMaxConcurrent(data.maxConcurrentCampaigns)
      setMaxTarget(data.maxTargetPerCampaign)
      setMaxWebsites(data.maxWebsitesPerCampaign)
      setDirty(false)
    }
  }, [data])

  const mutation = useMutation({
    mutationFn: () =>
      settingsApi.setLimits({
        maxConcurrentCampaigns: maxConcurrent,
        maxTargetPerCampaign: maxTarget,
        maxWebsitesPerCampaign: maxWebsites,
      }),
    onSuccess: (saved) => {
      setMaxConcurrent(saved.maxConcurrentCampaigns)
      setMaxTarget(saved.maxTargetPerCampaign)
      setMaxWebsites(saved.maxWebsitesPerCampaign)
      setDirty(false)
      qc.invalidateQueries({ queryKey: ['settings', 'limits'] })
      toast({ title: 'Campaign limits saved' })
    },
    onError: (err: unknown) =>
      toast({ variant: 'destructive', title: 'Save failed', description: err instanceof Error ? err.message : String(err) }),
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3 p-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          <SlidersHorizontal className="size-4 text-emerald-600" /> Campaign Limits
        </CardTitle>
        <CardDescription>Control resource usage of the worker pipeline.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Max concurrent campaigns</Label>
          <Input
            type="number"
            min={1}
            max={10}
            value={maxConcurrent}
            onChange={(e) => { setMaxConcurrent(Number(e.target.value)); setDirty(true) }}
          />
          <p className="text-xs text-muted-foreground">Number of campaigns the worker will process in parallel.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Max target leads per campaign</Label>
          <Input
            type="number"
            min={10}
            step={100}
            value={maxTarget}
            onChange={(e) => { setMaxTarget(Number(e.target.value)); setDirty(true) }}
          />
          <p className="text-xs text-muted-foreground">Upper bound for the target field when creating a campaign.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Max websites analyzed per campaign</Label>
          <Input
            type="number"
            min={10}
            step={50}
            value={maxWebsites}
            onChange={(e) => { setMaxWebsites(Number(e.target.value)); setDirty(true) }}
          />
          <p className="text-xs text-muted-foreground">Caps the number of outbound website fetches per campaign (SSRF-protected).</p>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !dirty}>
            <Save className="mr-2 size-4" /> {mutation.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ComplianceTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['compliance'],
    queryFn: settingsApi.getCompliance,
  })

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4 text-emerald-600" /> Compliance &amp; Responsible Use
        </CardTitle>
        <CardDescription>Read carefully before using discovered contact information.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-4 text-sm leading-relaxed text-muted-foreground">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            <p>{data?.notice}</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>OpenStreetMap data is © OpenStreetMap contributors, licensed under ODbL.</li>
              <li>Nominatim usage policy must be respected (max 1 request/sec, no heavy bulk usage).</li>
              <li>All outbound website fetches are SSRF-protected: localhost, private IP ranges and cloud metadata endpoints are blocked at DNS resolution time.</li>
              <li>Website fetching is rate-limited per source and times out at the configured timeout (default 15s).</li>
              <li>You are responsible for ensuring your use of any discovered contact information complies with CAN-SPAM, GDPR, CCPA, ePrivacy and local regulations.</li>
              <li>Always honor opt-out requests and never use contact data for unsolicited commercial communications where prohibited by law.</li>
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function AboutTab() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="size-4 text-emerald-600" /> About LeadPulse
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4 text-sm leading-relaxed text-muted-foreground">
          <p>
            LeadPulse is a production-ready business lead discovery platform that surfaces real, publicly
            available business contact information from permitted sources. There is no mock data —
            every lead originates from a real OpenStreetMap POI tag or an extracted contact from a
            public website's contact page.
          </p>
          <p>
            Discovery runs in a background worker (port 3003) connected via socket.io. The worker polls
            the database for queued/running campaigns, geocodes the target location via Nominatim,
            queries OpenStreetMap Overpass API for matching business POIs, then for each business
            with a website it fetches and parses the homepage + linked contact/about/team/support pages
            to extract emails, WhatsApp links, phone numbers and social profiles — each with
            evidence (source URL, page section, raw evidence text) and a confidence score.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Globe className="size-4 text-emerald-600" /> Real Data Sources
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-3 text-sm">
            <div>
              <p className="font-medium">OpenStreetMap Overpass API</p>
              <p className="text-xs text-muted-foreground">Business POIs (amenity, shop, office, tourism, craft, leisure tags) with name, phone, website, email, addr:* fields.</p>
            </div>
            <div>
              <p className="font-medium">Nominatim</p>
              <p className="text-xs text-muted-foreground">Geocodes city/state/country strings into bounding boxes for Overpass queries.</p>
            </div>
            <div>
              <p className="font-medium">Public website contact pages</p>
              <p className="text-xs text-muted-foreground">SSRF-protected fetch of homepage + linked contact/about/team/support pages. Extracts mailto:, JSON-LD, tel:, wa.me links and social profile URLs.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Lock className="size-4 text-emerald-600" /> Safety &amp; Privacy Guarantees
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-3 text-sm">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <p className="text-xs"><span className="font-medium text-foreground">Anti-SSRF:</span> All outbound fetches are IP-pinned after DNS resolution; private ranges, localhost and cloud metadata endpoints are blocked.</p>
            </div>
            <div className="flex items-start gap-2">
              <Server className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <p className="text-xs"><span className="font-medium text-foreground">Rate limits:</span> Per-source per-minute and daily quotas are enforced in-memory by the worker.</p>
            </div>
            <div className="flex items-start gap-2">
              <Lock className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <p className="text-xs"><span className="font-medium text-foreground">No login wall:</span> API keys are stored encrypted at rest and never returned to the client.</p>
            </div>
            <div className="flex items-start gap-2">
              <Code className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <p className="text-xs"><span className="font-medium text-foreground">Evidence-backed:</span> Every contact (email, phone, WhatsApp) is stored with its source URL, page section and confidence score.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
