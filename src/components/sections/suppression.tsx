'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ban, Plus, Trash2, Mail, Phone, MessageCircle, Globe, Building2, Calendar } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { SectionHeader, EmptyState } from '@/components/common/ui'
import { suppressionApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const SUPPRESSION_TYPES = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'phone', label: 'Phone', icon: Phone },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'domain', label: 'Domain', icon: Globe },
  { value: 'business_name', label: 'Business Name', icon: Building2 },
  { value: 'website', label: 'Website', icon: Globe },
]

function TypeIcon({ type }: { type: string }) {
  const t = SUPPRESSION_TYPES.find((s) => s.value === type)
  if (!t) return <Ban className="size-3.5" />
  const Icon = t.icon
  return <Icon className="size-3.5" />
}

function fmtDate(s?: string) {
  if (!s) return '—'
  try {
    return new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return s
  }
}

export function SuppressionSection() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const { data, isLoading, error } = useQuery({
    queryKey: ['suppression'],
    queryFn: suppressionApi.list,
  })

  const [createOpen, setCreateOpen] = React.useState(false)
  const [deleteId, setDeleteId] = React.useState<string | null>(null)

  const deleteMutation = useMutation({
    mutationFn: suppressionApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppression'] })
      toast({ title: 'Entry deleted' })
      setDeleteId(null)
    },
    onError: (err: unknown) =>
      toast({ variant: 'destructive', title: 'Delete failed', description: err instanceof Error ? err.message : String(err) }),
  })

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Suppression List"
        description="Block emails, phones, domains and businesses from your results"
        icon={Ban}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-4" /> Add Entry
          </Button>
        }
      />

      {error && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
          {error instanceof Error ? error.message : 'Failed to load suppression list'}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !data || data.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Ban}
                title="Suppression list is empty"
                description="Add emails, phones, WhatsApp numbers, domains or business names to exclude them from future campaigns."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          <TypeIcon type={e.type} />
                          <span className="ml-1">{e.type.replace('_', ' ')}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{e.value}</TableCell>
                      <TableCell className="max-w-[20rem] truncate text-sm text-muted-foreground" title={e.reason || ''}>
                        {e.reason || '—'}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="size-3.5" /> {fmtDate(e.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="size-7 p-0 text-rose-600 hover:text-rose-700"
                          onClick={() => setDeleteId(e.id)}
                          aria-label="Delete"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {createOpen && <CreateEntryDialog onClose={() => setCreateOpen(false)} />}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove suppression entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This entry will be removed from the suppression list and may appear in future discovery results.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-rose-600 hover:bg-rose-700"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function CreateEntryDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [type, setType] = React.useState('email')
  const [value, setValue] = React.useState('')
  const [reason, setReason] = React.useState('')

  const mutation = useMutation({
    mutationFn: () => suppressionApi.create({ type, value: value.trim().toLowerCase(), reason: reason.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppression'] })
      toast({ title: 'Entry added to suppression list' })
      onClose()
    },
    onError: (err: unknown) =>
      toast({ variant: 'destructive', title: 'Add failed', description: err instanceof Error ? err.message : String(err) }),
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="size-5 text-emerald-600" /> Add Suppression Entry
          </DialogTitle>
          <DialogDescription>Block a specific contact, domain or business from results.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SUPPRESSION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="capitalize">{t.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Value</Label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={
                type === 'email' ? 'spam@example.com'
                  : type === 'phone' || type === 'whatsapp' ? '+1234567890'
                    : type === 'domain' || type === 'website' ? 'example.com'
                      : 'Business Name'
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Reason (optional)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this suppressed?" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !value.trim()}>
            {mutation.isPending ? 'Adding…' : 'Add entry'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
