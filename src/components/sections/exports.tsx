'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, FileSpreadsheet, FileText, Calendar, Hash } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { SectionHeader, EmptyState } from '@/components/common/ui'
import { exportsApi } from '@/lib/api'

function fmtDate(s?: string) {
  if (!s) return '—'
  try {
    return new Date(s).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return s
  }
}

interface ExportRow {
  id: string
  format: string
  scope: string
  leadCount: number
  fileUrl?: string
  createdAt: string
  campaign?: { name: string } | null
  campaignName?: string
}

export function ExportsSection() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['exports'],
    queryFn: exportsApi.list,
  })

  const rows: ExportRow[] = (data ?? []) as ExportRow[]

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Exports"
        description="Download CSV and XLSX exports of discovered leads"
        icon={Download}
      />

      {error && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
          {error instanceof Error ? error.message : 'Failed to load exports'}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Download}
                title="No exports yet"
                description="Use the Export button on the Leads page to generate CSV or XLSX files of discovered leads."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Format</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const format = String(r.format || '').toLowerCase()
                    const isXlsx = format === 'xlsx'
                    const Icon = isXlsx ? FileSpreadsheet : FileText
                    const campaignName = r.campaign?.name || r.campaignName
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`flex size-8 items-center justify-center rounded-md ${isXlsx ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-sky-500/10 text-sky-600 dark:text-sky-400'}`}>
                              <Icon className="size-4" />
                            </div>
                            <span className="font-medium uppercase">{r.format}</span>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{r.scope}</Badge></TableCell>
                        <TableCell>
                          <span className="text-sm">{campaignName || '—'}</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.leadCount}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="size-3.5" /> {fmtDate(r.createdAt)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {r.fileUrl ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => exportsApi.download(r.fileUrl!)}
                            >
                              <Download className="mr-1.5 size-3.5" /> Download
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Unavailable</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Hash className="size-3.5" />
        Exports are saved to <code className="rounded bg-muted px-1">/public/exports/</code> and tracked in the database.
      </div>
    </div>
  )
}
