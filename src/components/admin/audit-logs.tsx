'use client'

// PlayBeat — Audit Logs section
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ScrollText, ChevronLeft, ChevronRight, Filter, User,
} from 'lucide-react'
import { pbApi } from '@/lib/playbeat-api'
import {
  GlassCard, PbEmptyState, PbSkeleton,
} from '@/components/playbeat/ui'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const PAGE_SIZE = 50

export function AuditLogsSection() {
  const [page, setPage] = React.useState(1)
  const [actionFilter, setActionFilter] = React.useState('all')
  const [search, setSearch] = React.useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['pb-audit-logs', page],
    queryFn: () => pbApi.auditLogs(page),
  })

  const allLogs = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Client-side filter (action & search)
  const filtered = React.useMemo(() => {
    let arr = allLogs
    if (actionFilter && actionFilter !== 'all') {
      arr = arr.filter((l: any) => l.action?.includes(actionFilter))
    }
    if (search) {
      const q = search.toLowerCase()
      arr = arr.filter((l: any) =>
        (l.detail || '').toLowerCase().includes(q) ||
        (l.adminEmail || '').toLowerCase().includes(q) ||
        (l.entity || '').toLowerCase().includes(q) ||
        (l.action || '').toLowerCase().includes(q)
      )
    }
    return arr
  }, [allLogs, actionFilter, search])

  // Unique actions for filter
  const uniqueActions = React.useMemo(() => {
    const set = new Set<string>()
    allLogs.forEach((l: any) => { if (l.action) set.add(l.action) })
    return Array.from(set).sort()
  }, [allLogs])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ScrollText className="size-4 text-cyan-300" />
        <h2 className="text-sm font-semibold text-slate-100">
          Audit Logs <span className="text-slate-500">({total.toLocaleString()})</span>
        </h2>
      </div>

      {/* Filters */}
      <GlassCard className="p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Filter className="size-3.5" />
            Filter:
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search detail, admin, entity…"
            className="h-9 flex-1 border-cyan-400/20 bg-white/[0.04] text-xs text-slate-100 placeholder:text-slate-500"
          />
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="h-9 w-full border-cyan-400/20 bg-white/[0.04] text-xs text-slate-100 sm:w-56">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent className="border-cyan-400/20 bg-[#0a1628] text-slate-100">
              <SelectItem value="all">All actions</SelectItem>
              {uniqueActions.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </GlassCard>

      <GlassCard className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <PbSkeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <PbEmptyState
            title="No audit log entries"
            description="Admin actions and extraction events will appear here."
            icon={ScrollText}
          />
        ) : (
          <div className="overflow-x-auto pb-scroll">
            <table className="w-full text-xs">
              <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Timestamp</th>
                  <th className="px-3 py-2 text-left">Action</th>
                  <th className="hidden px-3 py-2 text-left sm:table-cell">Admin</th>
                  <th className="hidden px-3 py-2 text-left md:table-cell">Entity</th>
                  <th className="px-3 py-2 text-left">Detail</th>
                  <th className="hidden px-3 py-2 text-left lg:table-cell">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((log: any) => (
                  <tr key={log.id} className="hover:bg-white/[0.02]">
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className="border-cyan-400/30 text-cyan-300">
                        {log.action}
                      </Badge>
                    </td>
                    <td className="hidden px-3 py-2.5 sm:table-cell">
                      {log.adminEmail ? (
                        <span className="flex items-center gap-1.5 text-slate-300">
                          <User className="size-3 text-slate-500" />
                          {log.adminEmail}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="hidden px-3 py-2.5 text-slate-300 md:table-cell">
                      {log.entity ? (
                        <div>
                          <div className="text-slate-300">{log.entity}</div>
                          {log.entityId && (
                            <div className="font-mono text-[10px] text-slate-500">{log.entityId.slice(0, 12)}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="max-w-md px-3 py-2.5 text-slate-400">
                      <span className="line-clamp-2">{log.detail ?? '—'}</span>
                    </td>
                    <td className="hidden px-3 py-2.5 font-mono text-[10px] text-slate-500 lg:table-cell">
                      {log.ip ?? '—'}
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
              Page {page} of {totalPages} • {total.toLocaleString()} entries
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
  )
}
