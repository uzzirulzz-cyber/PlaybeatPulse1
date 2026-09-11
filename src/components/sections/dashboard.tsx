'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Users, Mail, MessageCircle, Phone, Star, Megaphone, AlertTriangle,
  TrendingUp, Activity, ShieldCheck, Radar,
} from 'lucide-react'
import { analyticsApi, campaignsApi, settingsApi, subscribeToDashboard } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { StatCard, SectionHeader, EmptyState } from '@/components/common/ui'
import { StatusBadge } from '@/components/common/badges'
import type { SectionNavigate } from './_shared'

export function DashboardSection({ navigate }: { navigate: SectionNavigate }) {
  const qc = useQueryClient()
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: analyticsApi.dashboard,
    refetchInterval: 15_000,
  })
  const { data: campaigns } = useQuery({
    queryKey: ['campaigns'],
    queryFn: campaignsApi.list,
    refetchInterval: 10_000,
  })
  const { data: compliance } = useQuery({
    queryKey: ['compliance'],
    queryFn: settingsApi.getCompliance,
  })

  // Realtime banner
  const [liveMsg, setLiveMsg] = React.useState<string | null>(null)
  const hideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  React.useEffect(() => {
    const unsub = subscribeToDashboard((e) => {
      setLiveMsg(
        `Campaign ${e.campaignId.slice(0, 8)}… ${e.status} · ${e.stats.validContacts}/${e.target} leads`
      )
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      if (hideTimer.current) clearTimeout(hideTimer.current)
      hideTimer.current = setTimeout(() => setLiveMsg(null), 3500)
    })
    return () => {
      unsub()
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [qc])

  const recentCampaigns = React.useMemo(() => {
    if (!campaigns) return []
    return [...campaigns]
      .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
      .slice(0, 5)
  }, [campaigns])

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Dashboard"
        description="Real-time overview of your lead discovery pipeline"
        icon={Activity}
        actions={
          <Button onClick={() => navigate('find-leads')}>
            <Radar className="mr-2 size-4" /> New Campaign
          </Button>
        }
      />

      {liveMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-700 dark:text-emerald-300">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <span className="font-medium">Live:</span>
          <span>{liveMsg}</span>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Total Leads" value={stats?.totalLeads ?? 0} icon={Users} tone="default" loading={isLoading} />
        <StatCard label="Today's Leads" value={stats?.todaysLeads ?? 0} icon={TrendingUp} tone="emerald" loading={isLoading} />
        <StatCard label="Emails" value={stats?.emails ?? 0} icon={Mail} tone="sky" loading={isLoading} />
        <StatCard label="WhatsApp" value={stats?.whatsapp ?? 0} icon={MessageCircle} tone="emerald" loading={isLoading} />
        <StatCard label="Phones" value={stats?.phones ?? 0} icon={Phone} tone="violet" loading={isLoading} />
        <StatCard label="High Quality" value={stats?.highQualityLeads ?? 0} icon={Star} tone="amber" loading={isLoading} />
        <StatCard label="Active Campaigns" value={stats?.activeCampaigns ?? 0} icon={Megaphone} tone="emerald" loading={isLoading} />
        <StatCard label="Failed Jobs" value={stats?.failedJobs ?? 0} icon={AlertTriangle} tone={stats && stats.failedJobs > 0 ? 'rose' : 'default'} loading={isLoading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent campaigns */}
        <Card className="lg:col-span-2">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center justify-between text-base">
              <span>Recent Campaigns</span>
              <Button variant="ghost" size="sm" onClick={() => navigate('campaigns')}>
                View all
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : recentCampaigns.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={Megaphone}
                  title="No campaigns yet"
                  description="Launch your first discovery campaign to start collecting real business leads from OpenStreetMap."
                  action={
                    <Button onClick={() => navigate('find-leads')}>
                      <Radar className="mr-2 size-4" /> Find Leads
                    </Button>
                  }
                />
              </div>
            ) : (
              <ul className="divide-y">
                {recentCampaigns.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => navigate('campaigns')}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold">{c.name}</p>
                          <StatusBadge status={c.status} pulse={c.status === 'running'} />
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <Progress value={c.progress} className="h-1.5 flex-1" />
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {c.validContacts}/{c.target}
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Compliance */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4 text-emerald-600" /> Compliance Notice
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted-foreground">
            {!compliance ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <p>{compliance.notice}</p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-4 w-full"
              onClick={() => navigate('settings')}
            >
              View settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
