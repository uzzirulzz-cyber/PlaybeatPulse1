'use client'

import * as React from 'react'
import { useToast } from '@/hooks/use-toast'

// Shared navigate type for sections that need to switch views
export type SectionNavigate = (id: string, opts?: { campaignId?: string }) => void

// Convenience hook for invalidating queries when realtime events arrive
export function useRealtimeBanner() {
  const [message, setMessage] = React.useState<string | null>(null)
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const show = React.useCallback((msg: string) => {
    setMessage(msg)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setMessage(null), 4000)
  }, [])
  React.useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [])
  return { message, show }
}

export function useToastError() {
  const { toast } = useToast()
  return React.useCallback(
    (err: unknown, title = 'Something went wrong') => {
      const msg = err instanceof Error ? err.message : String(err)
      toast({ variant: 'destructive', title, description: msg })
    },
    [toast]
  )
}
