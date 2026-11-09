# AEGIS GRC — AI-Powered Governance, Risk & Compliance

Premium React Native + Expo app for cybersecurity teams, GRC analysts, auditors, IT, and management.

## Tech Stack
- Expo 51 + TypeScript + Expo Router
- Supabase (Auth, Postgres, Storage, Edge Functions, RLS)
- TanStack Query, React Hook Form + Zod, Zustand, SecureStore
- Victory Native for charts

## Setup

1. Install: `npm install`
2. Create Supabase project
3. Run migrations: `supabase/migrations/*.sql` in order
4. Run `supabase/seed.sql` for demo frameworks & data
5. Set env from `.env.example` -> `.env`
6. `npx expo start`

### Edge Functions
```
supabase functions deploy ai-assistant --no-verify-jwt
supabase secrets set AI_PROVIDER_API_KEY=sk-...
```

### Storage Buckets
- `evidence` (private, RLS)
- `audit-reports` (private)
- `avatars` (public)

## Architecture
- `/app` — Expo Router screens
- `/src/components` — Design system
- `/src/lib` — Supabase, tokens, types
- `/supabase/migrations` — Postgres schema + RLS
- `/supabase/functions` — AI + Reports

## Roles
Super Admin > Org Admin > GRC Analyst > IT/Security > Auditor > Management > Staff

All authorization enforced via RLS, not UI only.

## Security Notes
- No service-role key in client
- Signed URLs for evidence (60s TTL)
- Audit logs immutable (no UPDATE/DELETE RLS)
- Zod validation on all forms
- SecureStore for refresh token caching only

## Build
- Android: `eas build -p android`
- iOS: `eas build -p ios`

## Disclaimer
Demo data labeled as sample. App does NOT guarantee compliance or certification. AI outputs are suggestions, not legal advice.
