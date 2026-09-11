'use client'

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Radar, MapPin, Briefcase, Contact, Gauge, Sparkles, Info } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'
import { SectionHeader } from '@/components/common/ui'
import { campaignsApi, type CreateCampaignInput } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import type { SectionNavigate } from './_shared'
import type {
  LocationFilters, BusinessFilters, ContactFilters, QualityFilters,
} from '@/lib/types'
import { cn } from '@/lib/utils'

const TARGET_OPTIONS = [100, 250, 500, 1000, 2500, 5000]

const COUNTRY_SUGGESTIONS = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France',
  'Spain', 'Italy', 'Netherlands', 'India', 'Brazil', 'Mexico', 'Japan', 'Singapore',
  'United Arab Emirates', 'Saudi Arabia', 'South Africa', 'Nigeria', 'Kenya',
]

const INDUSTRY_SUGGESTIONS = [
  'Restaurant', 'Cafe', 'Hotels & Hospitality', 'Real Estate', 'Legal Services',
  'Medical & Dental', 'Beauty & Wellness', 'Automotive', 'Retail Stores',
  'Construction & Contractors', 'Marketing Agencies', 'IT & Software',
  'Fitness & Gyms', 'Education & Training', 'Financial Services',
]

const BUSINESS_TYPES = [
  { value: 'local', label: 'Local Business' },
  { value: 'online', label: 'Online' },
  { value: 'service', label: 'Service' },
  { value: 'retail', label: 'Retail' },
  { value: 'manufacturer', label: 'Manufacturer' },
  { value: 'distributor', label: 'Distributor' },
  { value: 'agency', label: 'Agency' },
  { value: 'startup', label: 'Startup' },
  { value: 'ecommerce', label: 'E-commerce' },
]

function KeywordInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const [draft, setDraft] = React.useState('')
  const add = () => {
    const t = draft.trim()
    if (t && !value.includes(t)) onChange([...value, t])
    setDraft('')
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder || 'Type and press Enter'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              add()
            }
          }}
        />
        <Button type="button" variant="secondary" onClick={add} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((k) => (
            <span
              key={k}
              className="inline-flex items-center gap-1 rounded-md border bg-muted px-2 py-0.5 text-xs"
            >
              {k}
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== k))}
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${k}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function FindLeadsSection({ navigate }: { navigate: SectionNavigate }) {
  const { toast } = useToast()
  const qc = useQueryClient()

  // Form state
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [target, setTarget] = React.useState<number>(250)

  const [country, setCountry] = React.useState('')
  const [state, setState] = React.useState('')
  const [city, setCity] = React.useState('')
  const [area, setArea] = React.useState('')
  const [postal, setPostal] = React.useState('')
  const [radiusKm, setRadiusKm] = React.useState<number>(15)
  const [multiCities, setMultiCities] = React.useState<string[]>([])

  const [nature, setNature] = React.useState('')
  const [industry, setIndustry] = React.useState('')
  const [category, setCategory] = React.useState('')
  const [subcategory, setSubcategory] = React.useState('')
  const [keywords, setKeywords] = React.useState<string[]>([])
  const [businessType, setBusinessType] = React.useState('')
  const [b2bB2c, setB2bB2c] = React.useState('')
  const [employeeMin, setEmployeeMin] = React.useState('')
  const [employeeMax, setEmployeeMax] = React.useState('')

  const [hasEmail, setHasEmail] = React.useState(false)
  const [hasWhatsApp, setHasWhatsApp] = React.useState(false)
  const [hasPhone, setHasPhone] = React.useState(false)
  const [hasWebsite, setHasWebsite] = React.useState(false)
  const [hasSocial, setHasSocial] = React.useState(false)
  const [hasContactPage, setHasContactPage] = React.useState(false)
  const [multipleContacts, setMultipleContacts] = React.useState(false)

  const [minScore, setMinScore] = React.useState<number>(0)
  const [minEmailConfidence, setMinEmailConfidence] = React.useState<number>(0)
  const [minWhatsAppConfidence, setMinWhatsAppConfidence] = React.useState<number>(0)
  const [websiteActive, setWebsiteActive] = React.useState(false)
  const [businessActive, setBusinessActive] = React.useState(false)

  const [error, setError] = React.useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: async (input: CreateCampaignInput) => {
      const created = await campaignsApi.create(input)
      await campaignsApi.start(created.id)
      return created
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast({
        title: 'Campaign started',
        description: `"${created.name}" is now queued and the worker will pick it up.`,
      })
      navigate('campaigns')
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      toast({ variant: 'destructive', title: 'Failed to start campaign', description: msg })
    },
  })

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Campaign name is required.')
    if (!country.trim() && !city.trim() && multiCities.length === 0) {
      return setError('At least a country, a city, or multiple cities must be specified.')
    }
    if (!target) return setError('Target number of leads is required.')

    const locationFilters: LocationFilters = {
      country: country.trim() || undefined,
      state: state.trim() || undefined,
      city: city.trim() || undefined,
      area: area.trim() || undefined,
      postal: postal.trim() || undefined,
      radiusKm,
      cities: multiCities.length ? multiCities : undefined,
    }
    const businessFilters: BusinessFilters = {
      nature: nature.trim() || undefined,
      industry: industry.trim() || undefined,
      category: category.trim() || undefined,
      subcategory: subcategory.trim() || undefined,
      keywords: keywords.length ? keywords : undefined,
      businessType: (businessType as any) || undefined,
      b2bB2c: (b2bB2c as any) || undefined,
      employeeMin: employeeMin ? Number(employeeMin) : undefined,
      employeeMax: employeeMax ? Number(employeeMax) : undefined,
    }
    const contactFilters: ContactFilters = {
      hasEmail, hasWhatsApp, hasPhone, hasWebsite, hasSocial, hasContactPage, multipleContacts,
    }
    const qualityFilters: QualityFilters = {
      minScore,
      minEmailConfidence,
      minWhatsAppConfidence,
      websiteActive,
      businessActive,
    }

    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      target,
      locationFilters,
      businessFilters,
      contactFilters,
      qualityFilters,
    })
  }

  const summaryItems: { label: string; value: string }[] = [
    { label: 'Name', value: name || '—' },
    { label: 'Target', value: String(target) },
    { label: 'Location', value: [city, state, country].filter(Boolean).join(', ') || (multiCities.length ? `${multiCities.length} cities` : '—') },
    { label: 'Nature', value: nature || '—' },
    { label: 'Industry', value: industry || '—' },
    { label: 'Keywords', value: keywords.length ? `${keywords.length} tags` : '—' },
    { label: 'Min score', value: String(minScore) },
  ]

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Find Leads"
        description="Configure a new discovery campaign targeting public business data"
        icon={Radar}
      />

      <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4 text-emerald-600" /> Basics
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 pt-4 sm:grid-cols-2">
              <Field label="Campaign name *">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Cafes in Berlin — Q1"
                  required
                />
              </Field>
              <Field label="Target leads" hint="Actual results depend on publicly available data.">
                <Select value={String(target)} onValueChange={(v) => setTarget(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TARGET_OPTIONS.map((t) => (
                      <SelectItem key={t} value={String(t)}>{t.toLocaleString()} leads</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Description">
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What is this campaign for?"
                    rows={2}
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Accordion type="multiple" defaultValue={['location', 'business']} className="space-y-3">
            <Card className="overflow-hidden py-0">
              <AccordionItem value="location" className="border-b-0">
                <CardHeader className="border-b py-4">
                  <AccordionTrigger className="hover:no-underline">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <MapPin className="size-4 text-emerald-600" /> Location
                    </CardTitle>
                  </AccordionTrigger>
                </CardHeader>
                <AccordionContent>
                  <CardContent className="grid gap-4 py-4 sm:grid-cols-2">
                    <Field label="Country">
                      <Input
                        list="country-list"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        placeholder="e.g. Germany"
                      />
                      <datalist id="country-list">
                        {COUNTRY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
                      </datalist>
                    </Field>
                    <Field label="State / Province">
                      <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="e.g. Berlin" />
                    </Field>
                    <Field label="City">
                      <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Berlin" />
                    </Field>
                    <Field label="Area / District">
                      <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Mitte" />
                    </Field>
                    <Field label="Postal code">
                      <Input value={postal} onChange={(e) => setPostal(e.target.value)} placeholder="e.g. 10115" />
                    </Field>
                    <Field label={`Search radius — ${radiusKm} km`}>
                      <Slider
                        value={[radiusKm]}
                        min={1}
                        max={100}
                        step={1}
                        onValueChange={(v) => setRadiusKm(v[0])}
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Multiple cities" hint="Comma-separated list of additional city names to search.">
                        <KeywordInput
                          value={multiCities}
                          onChange={setMultiCities}
                          placeholder="Type a city and press Enter"
                        />
                      </Field>
                    </div>
                  </CardContent>
                </AccordionContent>
              </AccordionItem>
            </Card>

            <Card className="overflow-hidden py-0">
              <AccordionItem value="business" className="border-b-0">
                <CardHeader className="border-b py-4">
                  <AccordionTrigger className="hover:no-underline">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Briefcase className="size-4 text-emerald-600" /> Business
                    </CardTitle>
                  </AccordionTrigger>
                </CardHeader>
                <AccordionContent>
                  <CardContent className="grid gap-4 py-4 sm:grid-cols-2">
                    <Field label="Nature of business" hint="Free-text describing what the business does.">
                      <Input
                        value={nature}
                        onChange={(e) => setNature(e.target.value)}
                        placeholder="e.g. specialty coffee shop"
                      />
                    </Field>
                    <Field label="Industry">
                      <Input
                        list="industry-list"
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        placeholder="e.g. Restaurant"
                      />
                      <datalist id="industry-list">
                        {INDUSTRY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
                      </datalist>
                    </Field>
                    <Field label="Category">
                      <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Food & Beverage" />
                    </Field>
                    <Field label="Subcategory">
                      <Input value={subcategory} onChange={(e) => setSubcategory(e.target.value)} placeholder="e.g. Specialty Coffee" />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Keywords">
                        <KeywordInput
                          value={keywords}
                          onChange={setKeywords}
                          placeholder="e.g. espresso, single origin, roastery"
                        />
                      </Field>
                    </div>
                    <Field label="Business type">
                      <Select value={businessType} onValueChange={setBusinessType}>
                        <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                        <SelectContent>
                          {BUSINESS_TYPES.map((b) => (
                            <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="B2B / B2C">
                      <Select value={b2bB2c} onValueChange={setB2bB2c}>
                        <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="B2B">B2B</SelectItem>
                          <SelectItem value="B2C">B2C</SelectItem>
                          <SelectItem value="B2B_B2C">B2B &amp; B2C</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Employees (min)">
                      <Input
                        type="number"
                        min={0}
                        value={employeeMin}
                        onChange={(e) => setEmployeeMin(e.target.value)}
                        placeholder="0"
                      />
                    </Field>
                    <Field label="Employees (max)">
                      <Input
                        type="number"
                        min={0}
                        value={employeeMax}
                        onChange={(e) => setEmployeeMax(e.target.value)}
                        placeholder="∞"
                      />
                    </Field>
                  </CardContent>
                </AccordionContent>
              </AccordionItem>
            </Card>

            <Card className="overflow-hidden py-0">
              <AccordionItem value="contact" className="border-b-0">
                <CardHeader className="border-b py-4">
                  <AccordionTrigger className="hover:no-underline">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Contact className="size-4 text-emerald-600" /> Contact Requirements
                    </CardTitle>
                  </AccordionTrigger>
                </CardHeader>
                <AccordionContent>
                  <CardContent className="grid gap-3 py-4 sm:grid-cols-2">
                    {[
                      { label: 'Has email', value: hasEmail, set: setHasEmail },
                      { label: 'Has WhatsApp', value: hasWhatsApp, set: setHasWhatsApp },
                      { label: 'Has phone', value: hasPhone, set: setHasPhone },
                      { label: 'Has website', value: hasWebsite, set: setHasWebsite },
                      { label: 'Has social profile', value: hasSocial, set: setHasSocial },
                      { label: 'Has contact page', value: hasContactPage, set: setHasContactPage },
                      { label: 'Multiple contact methods', value: multipleContacts, set: setMultipleContacts },
                    ].map((c) => (
                      <label
                        key={c.label}
                        className={cn(
                          'flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent',
                          c.value && 'border-emerald-500/30 bg-emerald-500/5'
                        )}
                      >
                        <span className="font-medium">{c.label}</span>
                        <Switch checked={c.value} onCheckedChange={c.set} />
                      </label>
                    ))}
                  </CardContent>
                </AccordionContent>
              </AccordionItem>
            </Card>

            <Card className="overflow-hidden py-0">
              <AccordionItem value="quality" className="border-b-0">
                <CardHeader className="border-b py-4">
                  <AccordionTrigger className="hover:no-underline">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Gauge className="size-4 text-emerald-600" /> Quality Filters
                    </CardTitle>
                  </AccordionTrigger>
                </CardHeader>
                <AccordionContent>
                  <CardContent className="space-y-5 py-4">
                    <Field label={`Minimum lead score — ${minScore}`}>
                      <Slider value={[minScore]} min={0} max={100} step={5} onValueChange={(v) => setMinScore(v[0])} />
                    </Field>
                    <Field label={`Minimum email confidence — ${minEmailConfidence}`}>
                      <Slider value={[minEmailConfidence]} min={0} max={100} step={5} onValueChange={(v) => setMinEmailConfidence(v[0])} />
                    </Field>
                    <Field label={`Minimum WhatsApp confidence — ${minWhatsAppConfidence}`}>
                      <Slider value={[minWhatsAppConfidence]} min={0} max={100} step={5} onValueChange={(v) => setMinWhatsAppConfidence(v[0])} />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent">
                        <span className="font-medium">Website must be active</span>
                        <Switch checked={websiteActive} onCheckedChange={setWebsiteActive} />
                      </label>
                      <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent">
                        <span className="font-medium">Business must be active</span>
                        <Switch checked={businessActive} onCheckedChange={setBusinessActive} />
                      </label>
                    </div>
                  </CardContent>
                </AccordionContent>
              </AccordionItem>
            </Card>
          </Accordion>

          {error && (
            <div className="flex items-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">
              <Info className="size-4 shrink-0" /> {error}
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <Card className="lg:sticky lg:top-20">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-base">Campaign Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <dl className="space-y-2 text-sm">
                {summaryItems.map((s) => (
                  <div key={s.label} className="flex items-start justify-between gap-2">
                    <dt className="text-muted-foreground">{s.label}</dt>
                    <dd className="max-w-[60%] truncate text-right font-medium">{s.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                <Info className="mb-1 inline size-3.5" />
                {' '}Worker picks up the campaign from the queue and starts discovering public
                business leads via OpenStreetMap Overpass + website contact-page extraction.
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Starting…' : (
                  <>
                    <Radar className="mr-2 size-4" /> Start Campaign
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  )
}
