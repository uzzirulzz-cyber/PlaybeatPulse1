'use client'

// PlayBeat — Admin login view
import * as React from 'react'
import { motion } from 'framer-motion'
import { Mail, Lock, ArrowLeft, Loader2, AlertCircle, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { usePb } from '@/components/playbeat/context'
import { PlayBeatLogo, EcgPulseLine } from '@/components/playbeat/ui'
import { pbApi, UnauthorizedError } from '@/lib/playbeat-api'

export function LoginView() {
  const { setView, setAdmin } = usePb()
  const { toast } = useToast()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('Email and password are required.')
      return
    }
    setLoading(true)
    try {
      await pbApi.login(email.trim(), password)
      const me = await pbApi.me()
      setAdmin(me)
      toast({
        title: 'Welcome back',
        description: `Signed in as ${me.email}`,
      })
      setView('admin')
    } catch (err: any) {
      if (err instanceof UnauthorizedError) {
        setError('Invalid credentials. Please try again.')
      } else {
        setError(err?.message || 'Login failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="pb-hex-grid relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      {/* Floating orbs */}
      <div className="pointer-events-none absolute -top-24 left-1/2 z-0 size-[420px] -translate-x-1/2 rounded-full bg-cyan-500/15 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-24 right-0 z-0 size-[320px] rounded-full bg-blue-500/15 blur-[120px]" />

      <button
        type="button"
        onClick={() => setView('landing')}
        className="absolute left-4 top-4 z-20 flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm text-slate-300 transition-colors hover:text-cyan-300"
      >
        <ArrowLeft className="size-4" />
        Back to landing
      </button>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="pb-glass pb-glow-soft p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <PlayBeatLogo size="lg" />
            <div className="mt-4">
              <EcgPulseLine width={220} height={28} />
            </div>
            <h1 className="mt-4 text-xl font-bold text-slate-100">Admin Sign In</h1>
            <p className="mt-1 text-xs text-slate-400">
              Access the PlayBeat Lead Extractor dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-slate-300">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@playbeat"
                  className="min-h-[44px] border-cyan-400/20 bg-white/[0.04] pl-9 text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus-visible:ring-cyan-400/40"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-slate-300">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="min-h-[44px] border-cyan-400/20 bg-white/[0.04] pl-9 text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus-visible:ring-cyan-400/40"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="min-h-[44px] w-full bg-cyan-400 text-[#021018] hover:bg-cyan-300 shadow-[0_0_24px_rgba(0,212,255,0.4)]"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="size-3.5 text-cyan-400/70" />
            Protected by JWT + HttpOnly cookie + IP rate limiting
          </div>
        </div>
      </motion.div>
    </div>
  )
}
