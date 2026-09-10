'use client'

// PlayBeat — Rules section (read-only display of the 16 operating rules)
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BookCheck, ShieldCheck, Lock, Database, AlertTriangle,
} from 'lucide-react'
import { pbApi } from '@/lib/playbeat-api'
import {
  GlassCard, PbEmptyState, PbSkeleton,
} from '@/components/playbeat/ui'
import { Badge } from '@/components/ui/badge'

const CATEGORY_META: Record<string, { label: string; color: string; icon: typeof BookCheck }> = {
  operating: { label: 'Operating', color: 'border-cyan-400/30 text-cyan-300 bg-cyan-400/5', icon: ShieldCheck },
  data:      { label: 'Data',      color: 'border-emerald-400/30 text-emerald-300 bg-emerald-400/5', icon: Database },
  security:  { label: 'Security',  color: 'border-amber-400/30 text-amber-300 bg-amber-400/5', icon: Lock },
}

export function RulesSection() {
  const { data: rules, isLoading } = useQuery({
    queryKey: ['pb-rules'],
    queryFn: () => pbApi.rules(),
  })

  return (
    <div className="space-y-4">
      {/* Compliance notice */}
      <GlassCard className="border-cyan-400/30 bg-cyan-400/[0.04]">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300 shadow-[0_0_18px_rgba(0,212,255,0.25)]">
            <ShieldCheck className="size-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-100">Compliance Notice</h2>
              <Badge className="bg-cyan-400/15 text-cyan-300 border border-cyan-400/30">
                {rules?.length ?? 16} Rules Enforced
              </Badge>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              These {rules?.length ?? 16} mandatory operating rules are <strong className="text-slate-200">server-enforced</strong>.
              They cannot be bypassed through the frontend, modified via the API, or disabled by an admin.
              Every extraction, lead insert, and export is governed by this rule engine.
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Rules grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <PbSkeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : !rules || rules.length === 0 ? (
        <PbEmptyState
          title="No rules loaded"
          description="Rules are seeded on first /api/rules call."
          icon={AlertTriangle}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rules.map((rule: any) => {
            const cat = CATEGORY_META[rule.category] ?? CATEGORY_META.operating
            const CatIcon = cat.icon
            return (
              <GlassCard key={rule.id} hover>
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-400/5 text-cyan-300">
                    <span className="text-sm font-bold">{rule.number}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-100">{rule.title}</h3>
                      <Badge variant="outline" className={cat.color}>
                        <CatIcon className="mr-1 size-3" />
                        {cat.label}
                      </Badge>
                      <Badge className="bg-emerald-400/15 text-emerald-300 border border-emerald-400/30">
                        <Lock className="mr-1 size-2.5" />
                        Enforced
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-400">
                      {rule.description}
                    </p>
                  </div>
                </div>
              </GlassCard>
            )
          })}
        </div>
      )}

      {/* Footer note */}
      <GlassCard className="border-cyan-400/15">
        <div className="flex items-center gap-3">
          <BookCheck className="size-5 text-cyan-300" />
          <div>
            <p className="text-xs text-slate-300">
              These rules form the foundation of PlayBeat&apos;s compliance posture. They are
              embedded in the source code of the API and worker, and an audit log entry is
              created whenever an action is performed.
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Rule violations are logged with error codes and surfaced in the Jobs section.
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
