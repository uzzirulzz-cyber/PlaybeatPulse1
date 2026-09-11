'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3, BarChart2, Globe2, Building2, PieChart, TrendingUp, Database, Megaphone,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { SectionHeader, EmptyState, StatCard } from '@/components/common/ui'
import { analyticsApi } from '@/lib/api'

const CHART_COLORS = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)',
  'var(--chart-4)', 'var(--chart-5)',
  'oklch(0.7 0.15 200)', 'oklch(0.7 0.15 100)', 'oklch(0.7 0.15 300)',
]

const QUALITY_COLORS: Record<string, string> = {
  excellent: 'oklch(0.65 0.18 145)',
  high: 'oklch(0.7 0.15 160)',
  good: 'oklch(0.7 0.12 180)',
  medium: 'oklch(0.75 0.15 80)',
  low: 'oklch(0.65 0.04 0)',
}

function ChartCard({
  title, icon: Icon, children, className,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader className="border-b pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="size-4 text-emerald-600" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  )
}

function Empty({ height = 240 }: { height?: number }) {
  return (
    <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
      No data yet — launch a campaign to populate analytics.
    </div>
  )
}

export function AnalyticsSection() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics'],
    queryFn: analyticsApi.get,
    refetchInterval: 30_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Analytics" description="Geographic & industry insights from your real lead data" icon={BarChart3} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Analytics" description="Geographic & industry insights from your real lead data" icon={BarChart3} />
        <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
          {error instanceof Error ? error.message : 'Failed to load analytics'}
        </div>
      </div>
    )
  }

  const { totals, leadsByCountry, leadsByCity, leadsByIndustry, leadQualityDistribution, sourcePerformance, campaignStats } = data
  const hasData = totals.totalLeads > 0

  const qualityData = leadQualityDistribution.map((q) => ({
    name: q.label,
    value: q.value,
    fill: QUALITY_COLORS[q.label.toLowerCase()] || 'var(--chart-1)',
  }))

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Analytics"
        description="Geographic & industry insights from your real lead data"
        icon={BarChart3}
      />

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <StatCard label="Total Leads" value={totals.totalLeads} icon={Building2} tone="default" />
        <StatCard label="High Quality" value={totals.highQualityLeads} icon={TrendingUp} tone="emerald" />
        <StatCard label="Active Campaigns" value={totals.activeCampaigns} icon={Megaphone} tone="amber" />
        <StatCard label="Active Sources" value={totals.sourcesActive} icon={Database} tone="sky" />
      </div>

      {!hasData ? (
        <EmptyState
          icon={BarChart3}
          title="No analytics yet"
          description="Once you launch a discovery campaign and leads start flowing in, geographic, industry, quality and source performance charts will appear here."
        />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Country bar */}
            <ChartCard title="Leads by Country (Top 10)" icon={Globe2}>
              {leadsByCountry.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={leadsByCountry.slice(0, 10)} layout="vertical" margin={{ left: 16, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={110}
                      tick={{ fontSize: 11 }}
                      stroke="var(--muted-foreground)"
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--popover)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="value" name="Leads" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* City bar */}
            <ChartCard title="Leads by City (Top 12)" icon={BarChart2}>
              {leadsByCity.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={leadsByCity.slice(0, 12)} margin={{ left: -8, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10 }}
                      stroke="var(--muted-foreground)"
                      interval={0}
                      angle={-30}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--popover)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="value" name="Leads" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Industry donut */}
            <ChartCard title="Leads by Industry" icon={PieChart}>
              {leadsByIndustry.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <RePieChart>
                    <Pie
                      data={leadsByIndustry.slice(0, 8)}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={45}
                      paddingAngle={2}
                    >
                      {leadsByIndustry.slice(0, 8).map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'var(--popover)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </RePieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Quality distribution */}
            <ChartCard title="Lead Quality Distribution" icon={TrendingUp}>
              {qualityData.every((q) => q.value === 0) ? <Empty /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={qualityData} margin={{ left: -8, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--popover)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="value" name="Leads" radius={[4, 4, 0, 0]}>
                      {qualityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* Source performance table */}
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Database className="size-4 text-emerald-600" /> Source Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {sourcePerformance.length === 0 ? (
                <div className="p-4"><Empty /></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">Businesses</TableHead>
                        <TableHead className="text-right">Emails</TableHead>
                        <TableHead className="text-right">WhatsApp</TableHead>
                        <TableHead className="text-right">Email rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sourcePerformance.map((s) => (
                        <TableRow key={s.name}>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell className="text-right tabular-nums">{s.businesses}</TableCell>
                          <TableCell className="text-right tabular-nums">{s.emails}</TableCell>
                          <TableCell className="text-right tabular-nums">{s.whatsapp}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span className={`font-medium ${s.emailRate >= 50 ? 'text-emerald-600 dark:text-emerald-400' : s.emailRate >= 20 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                              {s.emailRate}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Campaign stats */}
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Megaphone className="size-4 text-emerald-600" /> Campaign Status Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {campaignStats.length === 0 ? <Empty height={80} /> : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                  {campaignStats.map((c) => (
                    <div key={c.label} className="rounded-lg border bg-card/50 p-3 text-center">
                      <p className="text-2xl font-bold tabular-nums">{c.value}</p>
                      <p className="mt-0.5 text-xs capitalize text-muted-foreground">{c.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
