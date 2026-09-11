'use client'

// PlayBeat — Exports section
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Download, FileText, FileSpreadsheet, ExternalLink,
} from 'lucide-react'
import { pbApi } from '@/lib/playbeat-api'
import {
  GlassCard, PbEmptyState, PbSkeleton,
} from '@/components/playbeat/ui'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { usePb, type AdminSection } from '@/components/playbeat/context'

export function ExportsSection() {
  const { data: exports, isLoading } = useQuery({
    queryKey: ['pb-exports'],
    queryFn: () => pbApi.exports(),
  })

  const { goToAdmin } = usePb()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Download className="size-4 text-cyan-300" />
          <h2 className="text-sm font-semibold text-slate-100">
            Exports <span className="text-slate-500">({exports?.length ?? 0})</span>
          </h2>
        </div>
        <Button
          onClick={() => goToAdmin('leads')}
          className="bg-cyan-400 text-[#021018] hover:bg-cyan-300"
          size="sm"
        >
          <Download className="mr-1.5 size-3.5" />
          New Export
        </Button>
      </div>

      <GlassCard className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <PbSkeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !exports || exports.length === 0 ? (
          <PbEmptyState
            title="No exports yet"
            description="Generate CSV / XLSX exports from the Leads section."
            icon={Download}
            action={
              <Button
                onClick={() => goToAdmin('leads')}
                className="bg-cyan-400 text-[#021018] hover:bg-cyan-300"
              >
                Go to Leads
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto pb-scroll">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Format</th>
                  <th className="px-3 py-2 text-left">Scope</th>
                  <th className="hidden px-3 py-2 text-left md:table-cell">Campaign</th>
                  <th className="px-3 py-2 text-right">Leads</th>
                  <th className="hidden px-3 py-2 text-left sm:table-cell">Created</th>
                  <th className="px-3 py-2 text-right">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {exports.map((ex: any) => {
                  const Icon = ex.format === 'xlsx' ? FileSpreadsheet : FileText
                  return (
                    <tr key={ex.id} className="hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className={`flex size-8 items-center justify-center rounded-md ${
                            ex.format === 'xlsx'
                              ? 'bg-emerald-400/10 text-emerald-300'
                              : 'bg-cyan-400/10 text-cyan-300'
                          }`}>
                            <Icon className="size-4" />
                          </div>
                          <span className="font-mono text-xs uppercase text-slate-200">
                            {ex.format}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant="outline" className="border-cyan-400/30 text-cyan-300">
                          {ex.scope}
                        </Badge>
                      </td>
                      <td className="hidden px-3 py-2.5 text-slate-300 md:table-cell">
                        {ex.campaignName ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-200">
                        {ex.leadCount?.toLocaleString() ?? 0}
                      </td>
                      <td className="hidden px-3 py-2.5 text-slate-400 sm:table-cell">
                        {new Date(ex.createdAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {ex.fileUrl ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(ex.fileUrl, '_blank')}
                            className="text-cyan-300 hover:bg-cyan-400/10"
                          >
                            <Download className="mr-1 size-3.5" />
                            Download
                            <ExternalLink className="ml-1 size-3" />
                          </Button>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  )
}
