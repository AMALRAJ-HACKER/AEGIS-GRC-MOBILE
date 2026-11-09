-- 0004_realtime.sql — enable Supabase Realtime for the whole workspace.
--
-- Adds every public table to the `supabase_realtime` publication so the app
-- receives INSERT/UPDATE/DELETE events over websockets and refreshes live
-- (notification badge, tasks, risks, dashboard, settings, etc.).
--
-- Security: Supabase Realtime applies RLS — each subscriber only receives
-- rows they are allowed to SELECT under their JWT's role/policies. All 20
-- tables already have RLS enabled, so org isolation holds without
-- client-side filters.
--
-- Applied live via pooler psql (source of truth for re-application).

alter publication supabase_realtime add table
  activity_logs,
  ai_conversations,
  ai_messages,
  audit_findings,
  audits,
  compliance_assessments,
  evidence,
  evidence_control_links,
  evidence_versions,
  framework_controls,
  frameworks,
  invitations,
  notifications,
  organization_memberships,
  organizations,
  profiles,
  risk_history,
  risks,
  task_comments,
  tasks;
