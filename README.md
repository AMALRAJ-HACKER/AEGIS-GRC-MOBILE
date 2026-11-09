<div align="center">

# 🛡️ AEGIS GRC

### Where Compliance Meets Intelligence

**Mobile Edition** · AI-Powered Governance, Risk & Compliance for iOS & Android

![React Native](https://img.shields.io/badge/React%20Native-0.88-61DAFB?style=for-the-badge&logo=react)
![Expo](https://img.shields.io/badge/Expo-SDK%2058-000020?style=for-the-badge&logo=expo)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

A native, AI-powered Governance, Risk, Compliance, Audit, and Security Management app built with React Native, Expo, and Supabase.

</div>

---

## 📋 Overview

AEGIS GRC Mobile is the native iOS and Android client for the AEGIS GRC platform. It gives compliance teams a complete, pocket-sized command centre for frameworks, controls, risks, evidence, remediation tasks, audits, reporting, and AI-assisted compliance work — backed by the same multi-tenant PostgreSQL database, row-level security, and audit trail as the web platform.

The app is designed for people who move between meetings, audits, and field work without losing governance context:

- Native tab-first navigation with a floating glass dock
- Live workspace updates over Supabase Realtime
- A cached, query-driven UI that stays responsive through transient network failures
- Secure-by-default authentication, file access, and tenant isolation
- A light-first interface that stays readable in any environment

Built for:

- Chief Information Security Officers (CISOs)
- GRC Analysts
- Compliance Officers
- Auditors
- IT Administrators
- Security Teams
- Risk Managers
- Executive Leadership
- Enterprise Staff

---

## 📱 Platform Highlights

| Area | Implementation |
|---|---|
| Runtime | Expo SDK 58 · React Native 0.88 · React 19.3 |
| Language | TypeScript 6.0 (strict mode) |
| Navigation | Expo Router 58 with typed routes · deep link scheme `aegisgrc://` |
| Bottom tabs | Dashboard · Frameworks · Risks · Tasks · Assistant |
| Data layer | Supabase Postgres + Row Level Security · TanStack Query cache |
| Live updates | Supabase Realtime, debounced cache invalidation |
| Auth | Email/password · invitation tokens · Expo SecureStore session |
| Files | Private Supabase Storage · 1-hour signed URLs |
| AI | Supabase Edge Function proxy · OpenAI GPT-4o mini |
| Exports | PDF (`expo-print`) · CSV · native share sheet |
| Platforms | iOS (iPhone + iPad) · Android · Expo web preview |

---

# ✨ Key Features

## 📊 Executive Dashboard

Gain complete visibility into your organization's compliance and security posture from the first screen.

### Features

- Overall compliance score ring
- Per-framework compliance health with status labels
- Control status breakdown across all activated frameworks
- Open-risk severity counters
- My tasks, with overdue highlighting
- 14-day upcoming deadline feed
- Recent team activity
- Unread notification badge
- Quick actions: add risk, upload evidence, assign task, framework overview
- Quick tools: evidence, audits, reports, profile

---

## 🏛 Compliance Management

Manage compliance programs across multiple standards and regulations.

### Supported Frameworks

The seed catalogue ships with:

- ISO/IEC 27001:2022
- SOC 2
- NIST Cybersecurity Framework (CSF) 2.0
- Digital Personal Data Protection Act (DPDP Act 2023)
- CERT-In Directions 2022
- RBI Cyber Security Framework
- UGC IT Guidelines

Organizations can also create **custom frameworks** or **clone** an existing framework and adapt its controls.

### Compliance Capabilities

- Framework catalogue
- Framework activation (seeds assessments for the organization)
- Control library
- Custom frameworks and cloned frameworks
- Compliance assessments per control
- Gap analysis through control status
- Control ownership (assign to me)
- Control notes and activity history
- Evidence linked to controls
- Tasks linked to controls
- Risk-to-control mapping
- Compliance scoring and framework health
- Control-level review workflow

### Control Statuses

- Not Started
- In Progress
- Implemented
- Needs Review
- Non-Compliant
- Not Applicable

Controls marked **Not Applicable** are excluded from the compliance score. The framework score is:

```text
score = implemented / (assessed controls − not applicable) × 100
```

---

## ⚠️ Risk Management

Create, assess, track, and remediate organizational risks.

### Features

- Enterprise risk register
- 5×5 likelihood × impact risk assessment
- Automatic inherent severity (`1–4 Low`, `5–9 Medium`, `10–16 High`, `17–25 Critical`)
- Residual risk scoring after mitigation
- Interactive risk matrix and list views
- Risk treatment / mitigation plan
- Risk ownership and target dates
- Risk-to-control links
- Full risk change history
- Risk archive (history retained)
- CSV risk register export
- Risk escalation notifications

### Risk Severity Levels

- Critical
- High
- Medium
- Low

### Scoring Model

```text
Inherent score = likelihood (1–5) × impact (1–5)   → 1–25
Severity       = 1–4 Low · 5–9 Medium · 10–16 High · 17–25 Critical
Residual score = residual likelihood × residual impact
Mitigation     = inherent score − residual score
```

---

## 📁 Evidence Management

Securely collect, manage, and review compliance evidence.

### Features

- Secure file uploads to a private storage bucket
- PDF, image, and document support
- 25 MB per-file limit
- Evidence linked to controls and assessments
- Framework visibility through linked controls
- Expiry / review date tracking
- Expiry health: valid, expiring within 30 days, expired, no expiry
- Version-aware evidence records
- Review status: pending, approved, rejected, expired
- Signed-URL preview and download (1-hour TTL)
- Native download / share sheet
- Evidence coverage reporting
- Evidence expiry alerts

### Supported Evidence Sources

- Policies and procedures
- Screenshots
- Reports
- Audit artifacts
- Compliance records
- System and configuration evidence
- Signed attestations

---

## ✅ Task & Remediation Management

Track compliance and risk actions from assignment to completion.

### Features

- Task creation and assignment
- Priority management
- Due-date tracking
- Task linked to a control or risk
- Reviewer assignment
- Approval and rejection workflow with review notes
- Task comments
- Activity history
- In-app notifications on assignment, completion, and blocking
- Overdue and due-soon alerts
- Recurrence metadata
- My-tasks and team task views

### Task Statuses

- To Do
- In Progress
- Pending Review
- Approved
- Done
- Blocked

### Task Priorities

- Critical
- High
- Medium
- Low

---

## 📝 Audit Management

Manage the complete audit lifecycle on mobile.

### Features

- Audit planning
- Scope and objective definition
- Scheduled start and end dates
- Audit status tracking
- Findings register
- Finding severity and description
- Corrective action plans
- Remediation deadlines
- Finding closure workflow
- Audit progress monitoring
- Audit activity logging

### Audit Statuses

- Planned
- In Progress
- Completed
- Cancelled

### Finding Severity Levels

- Critical
- High
- Medium
- Low

---

## 📈 Reports & Analytics

Generate actionable compliance and security insights from live workspace data.

### Report Types

- Control Status Summary
- Evidence Coverage
- Risk Summary
- Task Progress
- Compliance Health (Audit Readiness)

### Export Formats

- PDF (native print + share)
- CSV (native share)

The Reports screen stores a cadence preference (`off`, `weekly`, or `monthly`). Automated scheduled delivery is on the roadmap.

---

## 🤖 AI Compliance Assistant

The AEGIS AI Assistant helps compliance teams accelerate governance and compliance activities without leaving the app.

### AI Capabilities

- Explain security controls
- Identify compliance gaps
- Draft remediation plans
- Draft policies and procedures
- Summarize evidence requirements
- Prepare audit checklists
- Recommend corrective actions
- Answer framework questions (ISO 27001, SOC 2, NIST, DPDP, CERT-In, RBI, UGC)
- Turn a suggestion into a remediation task

### Context Modes

- General
- Frameworks
- Risks
- Evidence

### Example Prompts

```text
What are our most critical compliance gaps?

What evidence do I need for ISO 27001 A.5.15 Access Control?

Draft a risk treatment plan for unencrypted data backups.

How often should access review evidence be collected and signed off?

What controls should we prioritize for SOC 2 Type II readiness?
```

### AI Security Principles

- Secure backend processing through a Supabase Edge Function
- Organization-aware context from workspace data
- No AI provider key on the client
- Source attribution on responses
- Copy and export actions for every answer
- Human review required before acting on output

When no provider key is configured, the assistant returns clearly labelled demo responses so the mobile experience remains testable.

---

## 🔔 Notifications & Alerts

Keep the team moving without email.

### In-App Notifications

- Task assigned
- Task completed
- Task blocked
- Task due soon / overdue
- Risk assigned
- High / critical risk changes
- Evidence approved / rejected
- Evidence expiring / expired
- Approval requests
- System messages

### Delivery

- Database triggers create notifications on key events
- A scheduled daily job (when `pg_cron` is available) raises due-soon, overdue, and evidence-expiry alerts
- Notification list with category filters and mark-all-read
- Live badge count on the dashboard
- RLS-gated Realtime delivery

---

## 🧾 Audit Trail

Every meaningful workspace action is recorded.

- Immutable `activity_logs` table
- Actor, action, resource type, resource ID, and details
- Resource-type filters
- Timestamped activity feed on the dashboard
- Dedicated Audit Log screen
- CSV export of the audit trail
- Control-level activity history

---

## 🏢 Workspace & Team

Manage the organization from the Settings screen.

- Organization profile (name, industry, country, timezone)
- Team directory with roles
- Invitation creation and invite-token sharing
- Role assignment during invitation
- Notification preferences per event type
- Theme preference (light / dark)
- Profile editing with avatar upload
- Secure sign-out
- Integration placeholders for Jira, Slack, GitHub, and ServiceNow

---

# 🏗 Architecture

```text
┌──────────────────────────────────────┐
│          AEGIS GRC Mobile            │
│  Expo SDK 58 · React Native 0.88     │
│  Expo Router · TanStack Query        │
│  SecureStore · Realtime client       │
└──────────────────┬───────────────────┘
                   │ HTTPS / WSS
                   ▼
┌──────────────────────────────────────┐
│               Supabase               │
├──────────────────────────────────────┤
│ Auth (email/password + invitations)  │
│ PostgreSQL + Row Level Security      │
│ Storage (private buckets)            │
│ Realtime (RLS-gated)                 │
│ Edge Function: ai-assistant          │
└──────────────────┬───────────────────┘
                   │ server-side only
                   ▼
┌──────────────────────────────────────┐
│           AI Service Layer           │
│      OpenAI · GPT-4o mini            │
│      Compliance Intelligence         │
└──────────────────────────────────────┘
```

### Request & State Flow

1. Screens read workspace data through typed service functions in `src/services/api.ts`.
2. TanStack Query caches responses and deduplicates requests.
3. Supabase enforces organization membership and role rules with RLS.
4. Realtime events invalidate the cache after a short debounce, so open screens refresh automatically.
5. File access is granted through short-lived signed URLs, never public evidence links.

---

# 🎨 Design System

## Design Inspiration

- Vanta
- Comp AI
- Drata
- Secureframe

## Design Principles

- Enterprise first
- Security focused
- Mobile first
- Accessibility driven
- Calm, modern, and legible
- Clear information hierarchy
- Light-first with an optional dark palette
- Motion with reduced-motion support

---

## Color Palette

### Primary Colors

| Name | Hex |
|------|-----|
| Midnight Navy | `#0A1931` |
| Deep Navy | `#162447` |
| Aqua Teal | `#0FA3B1` |
| Water Deep | `#087B95` |
| Ice Blue | `#E6F0FF` |

### Status Colors

| State | Color |
|-------|-------|
| Success | `#10B981` |
| Warning | `#F59E0B` |
| Critical | `#EF4444` |
| Information | `#0FA3B1` |

### Neutral Colors

| Name | Hex |
|------|-----|
| Background | `#F8FAFC` |
| Surface | `#FFFFFF` |
| Border | `#E2E8F0` |
| Primary Text | `#0F172A` |
| Secondary Text | `#64748B` |

### Water Scale

`#F0FDFF` · `#D6F0FA` · `#A5EAF2` · `#5AC8E1` · `#0FA3B1` · `#0A8FA6` · `#087B95` · `#066A84` · `#055A73`

---

## Typography

The app uses the platform system font (San Francisco on iOS, Roboto on Android) for native feel and zero font-loading cost.

| Token | Size | Weight | Line Height |
|-------|------|--------|-------------|
| `h1` | 28 | 700 | 34 |
| `h2` | 22 | 700 | 28 |
| `h3` | 18 | 600 | 24 |
| `body` | 15 | 400 | 22 |
| `small` | 13 | 400 | 18 |
| `caption` | 12 | 500 | 16 |

### Spacing & Radius

| Token | Values |
|-------|--------|
| Spacing | 4 · 8 · 16 · 24 · 32 · 48 |
| Radius | 8 · 12 · 16 · 24 · 999 |

---

## Motion & Mobile Chrome

- **Aurora** ambient background gradients
- **FadeIn / SlideIn** screen entrances
- **Pulse / GlobalLoadingPulse** loading states
- **Celebration** overlay for approvals and milestones
- **Reduced-motion** support via `useReducedMotion`
- **Floating midnight-glass tab dock** with native blur, gradient, specular highlight, sliding active capsule, and safe-area-aware placement
- **Responsive layout** tuned for phones and tablets

### Responsive Breakpoints

| Range | Behaviour |
|-------|-----------|
| `< 692 px` | Phone layout, 16 px horizontal padding |
| `692–1023 px` | Tablet layout, 32 px padding, 760 px max content |
| `≥ 1024 px` | Large tablet / desktop preview, 48 px padding, 960 px max content |

---

# 🛠 Technology Stack

## Frontend

- React Native 0.88
- Expo SDK 58
- React 19.3
- TypeScript 6.0 (strict)
- Expo Router 58 (typed routes)

## State & Data

- TanStack Query 5 (server cache, retries, invalidation)
- React Context (session, workspace, theme)
- Supabase Realtime (live cache invalidation)
- AsyncStorage (local preferences)

## Backend

- Supabase Auth
- PostgreSQL 15+
- Row Level Security (RLS)
- Supabase Storage
- Supabase Edge Functions (Deno)
- PostgreSQL triggers, RPCs, and scheduled jobs

## Native Modules & Device Capabilities

- `expo-blur` + `expo-linear-gradient` — glass surfaces
- `react-native-svg` — icons and charts
- `react-native-safe-area-context` — notch / home-indicator layout
- `expo-secure-store` — encrypted session storage
- `expo-document-picker` / `expo-image-picker` — evidence and avatars
- `expo-file-system` / `expo-sharing` — CSV and PDF export
- `expo-print` — PDF report generation
- `expo-web-browser` — signed evidence preview
- `expo-clipboard` — copy answers, tokens, invite codes
- `expo-linking` — deep links (`aegisgrc://`)

## Security

- JWT authentication
- Role-Based Access Control
- Row Level Security
- Tenant isolation
- Private storage buckets
- Short-lived signed URLs
- Secure session storage
- Backend-only service-role access

---

# 📱 Application Modules

```text
Splash / Welcome
│
├── Authentication
│   ├── Login
│   ├── Sign Up / Workspace Creation
│   ├── Email Verification
│   ├── Forgot / Reset Password
│   ├── Workspace Onboarding
│   └── Invitation Redemption
│
├── Dashboard (tab)
│
├── Compliance
│   ├── Frameworks (tab)
│   ├── Framework Detail
│   ├── Control Detail
│   ├── Add / New Framework
│   └── Evidence
│       ├── Evidence Library
│       ├── Upload Evidence
│       └── Evidence Detail
│
├── Risks (tab)
│   ├── Risk Register
│   ├── Risk Matrix
│   ├── New Risk
│   └── Risk Detail / Edit / History
│
├── Tasks (tab)
│   ├── Task List
│   ├── New Task
│   └── Task Detail / Comments / Approval
│
├── Audits
│   ├── Audit List
│   ├── New Audit
│   └── Audit Detail / Findings
│
├── Reports
├── Notifications
├── Audit Log
├── Profile
├── Settings
│   ├── General
│   ├── Team
│   ├── Notifications
│   └── Integrations
│
└── AI Assistant (tab)
```

---

# 🗺 Screen Map

| Screen | Purpose |
|--------|---------|
| Splash | Session check and branded launch |
| Welcome / Onboarding | Value proposition and entry points |
| Login | Email/password sign-in |
| Sign Up | Account and workspace creation |
| Verify | Email confirmation |
| Reset Password | Password recovery request |
| Workspace Onboarding | Create an organization or redeem an invite |
| Dashboard | Compliance, risk, task, deadline, and activity overview |
| Frameworks | Framework catalogue and activation |
| Framework Detail | Controls, scores, and assessment progress |
| Control Detail | Status, notes, evidence, tasks, risks, and history |
| New / Add Framework | Create or clone a framework |
| Risks | Register, matrix, filters, and CSV export |
| New / Edit Risk | 5×5 assessment and mitigation plan |
| Risk Detail | Inherent/residual scores, links, and history |
| Tasks | My tasks, team tasks, filters, and priorities |
| New / Detail Task | Assignment, comments, approval, and rejection |
| Evidence | Library with validity and review filters |
| Upload Evidence | File, title, expiry, and control link |
| Audits | Audit schedule and status |
| Audit Detail | Scope, progress, findings, and corrective actions |
| Reports | Five report types with PDF/CSV export and cadence |
| Notifications | Categorised alerts and mark-all-read |
| Audit Log | Immutable activity trail with CSV export |
| Profile | Avatar, contact details, and role |
| Settings | Organization, team, notifications, integrations |
| AI Assistant | Context-aware compliance chat with task creation |

---

# 🔐 User Roles

| Role | Responsibilities |
|------|------------------|
| Super Admin | Full platform and workspace administration |
| Organization Admin | Organization profile, members, invitations, and configuration |
| GRC Analyst | Compliance operations, risk authoring, task review, and evidence review |
| IT / Security Team | Control implementation, risk authoring, and remediation |
| Auditor | Audit activities, findings, and reporting |
| Management | Executive reporting, risk oversight, and visibility |
| Staff | Assigned tasks and evidence submission |

Authorization is enforced in the database, not only in the UI. Client-side role helpers in `src/lib/permissions.ts` mirror the same rules so screens can hide actions the user cannot perform.

---

# 🗄 Database Modules

## Core Tables

- `profiles`
- `organizations`
- `organization_memberships`
- `invitations`

## Compliance

- `frameworks`
- `framework_controls`
- `compliance_assessments`

## Risk Management

- `risks`
- `risk_control_links`
- `risk_history`

## Evidence Management

- `evidence`
- `evidence_versions`
- `evidence_control_links`

## Task Management

- `tasks`
- `task_comments`

## Audit Management

- `audits`
- `audit_findings`

## Platform Services

- `notifications`
- `activity_logs`
- `ai_conversations`
- `ai_messages`

## Storage Buckets

| Bucket | Visibility | Purpose |
|--------|------------|---------|
| `evidence` | Private | Compliance evidence, org-scoped paths |
| `audit-reports` | Private | Exported audit reports |
| `avatars` | Public read | User profile images |

---

# ⚙️ Environment Variables

Create a `.env` file in the project root from `.env.example`.

```env
# Supabase project
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional: override the Metro host served to Expo Go on your LAN
# REACT_NATIVE_PACKAGER_HOSTNAME=192.168.1.10
```

Server-side secrets are configured in Supabase, never in the mobile bundle:

```bash
supabase secrets set AI_PROVIDER_API_KEY=sk-...
```

| Variable | Where | Purpose |
|----------|-------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | `.env` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `.env` | Publishable anon key (safe for client bundles) |
| `REACT_NATIVE_PACKAGER_HOSTNAME` | `.env.local` | Optional LAN host for Expo Go |
| `AI_PROVIDER_API_KEY` | Supabase secrets | OpenAI key used by the AI edge function |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase runtime | Injected into edge functions only |

**Never commit `.env`, `.env.local`, service-role keys, or provider API keys.** Both env files are git-ignored; `.env.example` is the safe template.

---

# 🚀 Getting Started

## Prerequisites

- Node.js 20+
- npm 10+
- Expo Go on a device, or an iOS/Android simulator
- Supabase CLI (for migrations and edge functions)
- EAS CLI (optional, for store builds)

## Install Dependencies

```bash
npm install
```

## Configure Environment

```bash
cp .env.example .env
# edit .env with your Supabase URL and anon key
```

## Set Up the Database

**Option A — Supabase CLI (recommended)**

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

This applies every migration in `supabase/migrations/` in order, including RLS policies, storage buckets, Realtime publications, notification triggers, and onboarding RPCs.

**Option B — SQL Editor (fresh project)**

Run `supabase/setup-all.sql` once in the Supabase SQL Editor. It combines schema, RLS, storage, and demo seed data.

## Seed Demo Data

Run `supabase/seed.sql` in the SQL Editor, or:

```bash
psql "$DATABASE_URL" -f supabase/seed.sql
```

Seed data is labelled as sample data and is safe to remove in production.

## Deploy the AI Function

```bash
supabase functions deploy ai-assistant
supabase secrets set AI_PROVIDER_API_KEY=sk-...
```

Without a provider key the assistant falls back to clearly labelled demo responses.

## Start the Development Server

```bash
npm run start
```

Useful variants:

```bash
npm run android      # Expo Go on Android
npm run ios          # Expo Go on iOS
npm run web          # Metro web preview
npx expo start --tunnel   # tunnel when LAN discovery fails
```

## Run on a Device

1. Start Metro with `npm run start`.
2. Scan the QR code with Expo Go (Android) or the Camera app (iOS).
3. Sign up to create a workspace, or redeem an invite token from an administrator.

## Build for Stores

```bash
eas build -p android --profile preview
eas build -p android --profile production
eas build -p ios --profile production
```

The `eas.json` profiles cover development, preview (APK), and production (AAB / App Store).

## Type Checking

```bash
npx tsc --noEmit
```

## Project Layout

```text
app/                  Expo Router screens and layouts
src/components/       Design system, charts, motion, navigation
src/hooks/            Workspace, realtime, and motion hooks
src/lib/              Supabase client, tokens, types, permissions, responsive
src/services/         Typed data-access layer
src/theme/            Light and dark palettes
supabase/migrations/  Schema, RLS, storage, triggers, RPCs
supabase/functions/   Edge functions (AI assistant)
supabase/seed.sql     Framework and demo data
tests/                Unit-test scaffold
```

---

# 🧪 Testing Strategy

### Unit Tests

- Risk scoring and severity mapping
- Compliance score calculation
- Permission helpers
- Formatting and date utilities

A Jest-compatible scaffold lives in `tests/riskScoring.test.ts`. Type checking is wired today via `npx tsc --noEmit`; connecting a test runner is part of the hardening roadmap.

### Integration Tests

- Authentication and session refresh
- Organization membership and RLS isolation
- Framework activation and assessment seeding
- Risk, task, and evidence CRUD
- Invitation redemption
- Realtime cache invalidation

### End-to-End Tests

- Sign-up → workspace creation → first framework activation
- Create risk → assign mitigation task → approval
- Upload evidence → link to control → expiry tracking
- Create audit → log finding → corrective action → closure
- Generate and export a report
- Ask the AI assistant for a remediation plan and create a task

---

# 🔒 Security Principles

AEGIS GRC follows a security-by-design approach.

### Security Controls

- Multi-tenant isolation
- Row Level Security on every workspace table
- Role-Based Access Control
- Private storage buckets with org-scoped paths
- One-hour signed URLs for evidence
- Encrypted session storage via Expo SecureStore
- Immutable audit logging
- RLS-gated Realtime delivery
- Encrypted HTTPS / WSS transport
- Backend-only AI provider access

### Security Guidelines

- Never expose the service-role key to the client.
- Never trust client-supplied role claims.
- Validate authorization on every backend operation.
- Keep evidence in private buckets and grant short-lived access only.
- Log security events without exposing confidential information.
- Keep `.env` files, provider keys, and service-role keys out of source control.
- Treat AI output as guidance that requires human review.

---

# 🗺 Roadmap

### Phase 1 — Foundation · ✅ Shipped

- Authentication and session management
- Organization creation and onboarding
- Invitations and role-based membership
- Dashboard
- Profile and settings

### Phase 2 — Compliance · ✅ Shipped

- Framework catalogue and activation
- Controls and assessments
- Custom and cloned frameworks
- Evidence library, expiry tracking, and control links
- Compliance scoring

### Phase 3 — Risk & Remediation · ✅ Shipped

- Risk register and 5×5 matrix
- Inherent and residual scoring
- Risk history and archiving
- Task assignment, comments, and approvals
- Risk / control / task linking

### Phase 4 — Audit & Reporting · ✅ Shipped

- Audits and findings
- Corrective actions and deadlines
- PDF and CSV reports
- Notifications and alerts
- Audit trail
- Realtime workspace sync

### Phase 5 — Intelligence & Integrations · 🚧 In Progress

- AI compliance assistant · ✅ shipped
- Push notifications
- Offline write queue and conflict handling
- Jira, Slack, GitHub, and ServiceNow integrations
- Advanced analytics and trend reporting
- Automated test pipeline and E2E coverage
- Scheduled report delivery
- SSO / SAML for enterprise workspaces

---

# ⚠️ Compliance Disclaimer

AEGIS GRC assists organizations in managing governance, risk, compliance, audit, and security activities.

The platform does not guarantee compliance, certification, regulatory approval, legal advice, audit success, or official accreditation.

Organizations remain responsible for validating controls, policies, evidence, risk decisions, compliance outcomes, and regulatory obligations. AI-generated content is advisory only and must be reviewed by a qualified professional before use.

---

# 📄 License

This project is licensed under the MIT License.

---

<div align="center">

## 🛡️ AEGIS GRC

### Where Compliance Meets Intelligence

Modern Governance • Risk Management • Compliance • Audit Readiness • AI-Powered Operations

Built for Security Teams, Compliance Professionals, and Enterprise Organizations.

</div>
