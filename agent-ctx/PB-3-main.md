# PB-3 — PlayBeat Lead Extractor Frontend

## Task
Build the frontend for PlayBeat Lead Extractor — a production business lead extraction platform. SPA at `/` route (Next.js 16 App Router) with client-side view switching between landing | login | admin.

## Files created
- src/lib/playbeat-api.ts
- src/components/playbeat/ui.tsx
- src/components/playbeat/context.ts
- src/components/landing/landing.tsx
- src/components/admin/login.tsx
- src/components/admin/shell.tsx
- src/components/admin/overview.tsx
- src/components/admin/extract.tsx
- src/components/admin/leads.tsx
- src/components/admin/jobs.tsx
- src/components/admin/sources.tsx
- src/components/admin/bots.tsx
- src/components/admin/exports.tsx
- src/components/admin/audit-logs.tsx
- src/components/admin/rules.tsx

## Files modified
- src/app/layout.tsx (PlayBeat dark theme forced)
- src/app/globals.css (cyberpunk dark theme + animations)
- src/app/page.tsx (complete rewrite — SPA view switching)

## Lint status
0 errors, 1 pre-existing warning (mini-services/lead-worker, not in scope).

## Pre-existing infra issue (NOT a frontend problem)
The dev server's parent shell exports `DATABASE_URL=file:/home/z/my-project/db/custom.db` (stale SQLite path from LeadPulse), overriding the .env postgres URL. This causes /api/health → 503 and /api/auth/login → 500. The frontend handles this gracefully:
- LiveStatsBar shows "Connecting…" when /api/health returns 503
- All admin endpoints correctly return 401 (auth-guard works)
- Login fails with 500 — but this is a backend DB issue, not a frontend issue
- Frontend renders cleanly at `/` (HTTP 200, 23,747 bytes)

## What works
- Landing page renders with full PlayBeat branding (hex grid, ECG pulse, glassmorphism, cyan glow)
- All view-state switching (landing → login → admin)
- All 9 admin sections compile and render with skeletons/empty states
- Lint clean

## Next steps for end-to-end testing
Restart the dev server with `unset DATABASE_URL` (or deploy to Vercel where env vars are correct), then test the full login → admin → extract flow.
