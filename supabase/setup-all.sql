-- AEGIS GRC - combined setup (schema + RLS + storage + seed)
-- Run this once in the Supabase SQL Editor, then click Run.


-- AEGIS GRC Initial Schema
-- Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Enums
create type user_role as enum ('super_admin','org_admin','grc_analyst','it_security','auditor','management','staff');
create type control_status as enum ('not_started','in_progress','implemented','needs_review','non_compliant');
create type risk_severity as enum ('critical','high','medium','low');
create type evidence_status as enum ('pending','approved','rejected','expired');
create type task_status as enum ('todo','in_progress','done','blocked');
create type task_priority as enum ('critical','high','medium','low');
create type audit_status as enum ('planned','in_progress','completed','cancelled');

-- Profiles
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Organizations
create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  industry text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- Memberships
create table organization_memberships (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role user_role not null default 'staff',
  status text default 'active',
  created_at timestamptz default now(),
  unique(organization_id, user_id)
);
create index on organization_memberships(organization_id);
create index on organization_memberships(user_id);

-- Frameworks
create table frameworks (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  version text not null,
  description text,
  category text not null, -- e.g. ISO, NIST, Indian Law
  source_url text,
  is_demo boolean default true,
  created_at timestamptz default now()
);

-- Controls library
create table framework_controls (
  id uuid primary key default uuid_generate_v4(),
  framework_id uuid not null references frameworks(id) on delete cascade,
  control_id text not null, -- e.g. A.5.1, DP-7
  title text not null,
  description text,
  category text,
  implementation_guidance text,
  created_at timestamptz default now(),
  unique(framework_id, control_id)
);
create index on framework_controls(framework_id);

-- Compliance assessments (per org per control)
create table compliance_assessments (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  control_id uuid not null references framework_controls(id) on delete cascade,
  status control_status not null default 'not_started',
  owner_id uuid references profiles(id),
  reviewer_id uuid references profiles(id),
  implementation_notes text,
  completion_pct int check (completion_pct between 0 and 100) default 0,
  remediation text,
  last_assessed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(organization_id, control_id)
);

-- Risks
create table risks (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  description text,
  category text,
  likelihood int check (likelihood between 1 and 5) not null,
  impact int check (impact between 1 and 5) not null,
  inherent_score int generated always as (likelihood * impact) stored,
  residual_likelihood int check (residual_likelihood between 1 and 5),
  residual_impact int check (residual_impact between 1 and 5),
  residual_score int,
  severity risk_severity not null,
  owner_id uuid references profiles(id),
  status text default 'open',
  affected_assets text[],
  existing_safeguards text,
  mitigation_plan text,
  target_date date,
  accepted_at timestamptz,
  accepted_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on risks(organization_id);
create index on risks(severity);

-- Risk history (immutable audit)
create table risk_history (
  id uuid primary key default uuid_generate_v4(),
  risk_id uuid not null references risks(id) on delete cascade,
  changed_by uuid references profiles(id),
  field_changed text,
  old_value text,
  new_value text,
  created_at timestamptz default now()
);

-- Evidence
create table evidence (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  type text,
  description text,
  owner_id uuid references profiles(id),
  file_path text not null, -- storage path private
  file_size int,
  mime_type text,
  expiry_date date,
  status evidence_status default 'pending',
  version int default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table evidence_versions (
  id uuid primary key default uuid_generate_v4(),
  evidence_id uuid not null references evidence(id) on delete cascade,
  file_path text not null,
  version int not null,
  uploaded_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table evidence_control_links (
  evidence_id uuid references evidence(id) on delete cascade,
  control_assessment_id uuid references compliance_assessments(id) on delete cascade,
  primary key (evidence_id, control_assessment_id)
);

-- Tasks
create table tasks (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  description text,
  status task_status default 'todo',
  priority task_priority default 'medium',
  owner_id uuid references profiles(id),
  assigned_to uuid references profiles(id),
  due_date date,
  linked_risk_id uuid references risks(id),
  linked_control_id uuid references compliance_assessments(id),
  linked_audit_id uuid,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table task_comments (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid references profiles(id),
  comment text not null,
  created_at timestamptz default now()
);

-- Audits
create table audits (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  status audit_status default 'planned',
  scope text,
  objectives text,
  auditor_ids uuid[],
  scheduled_start date,
  scheduled_end date,
  progress_pct int default 0,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table audit_findings (
  id uuid primary key default uuid_generate_v4(),
  audit_id uuid not null references audits(id) on delete cascade,
  title text not null,
  description text,
  severity risk_severity,
  status text default 'open',
  remediation_deadline date,
  corrective_action text,
  created_at timestamptz default now()
);

-- Notifications
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  is_read boolean default false,
  resource_type text,
  resource_id uuid,
  created_at timestamptz default now()
);
create index on notifications(user_id, is_read);

-- Activity logs (append-only)
create table activity_logs (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  actor_id uuid references profiles(id),
  action text not null,
  resource_type text not null,
  resource_id uuid,
  metadata jsonb,
  created_at timestamptz default now()
);
create index on activity_logs(organization_id, created_at desc);

-- AI
create table ai_conversations (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  user_id uuid references profiles(id),
  title text,
  created_at timestamptz default now()
);
create table ai_messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references ai_conversations(id) on delete cascade,
  role text check (role in ('user','assistant','system')),
  content text not null,
  sources jsonb,
  is_demo boolean default false,
  created_at timestamptz default now()
);


-- Enable RLS on all tenant tables
alter table profiles enable row level security;
alter table organizations enable row level security;
alter table organization_memberships enable row level security;
alter table frameworks enable row level security;
alter table framework_controls enable row level security;
alter table compliance_assessments enable row level security;
alter table risks enable row level security;
alter table risk_history enable row level security;
alter table evidence enable row level security;
alter table evidence_versions enable row level security;
alter table evidence_control_links enable row level security;
alter table tasks enable row level security;
alter table task_comments enable row level security;
alter table audits enable row level security;
alter table audit_findings enable row level security;
alter table notifications enable row level security;
alter table activity_logs enable row level security;
alter table ai_conversations enable row level security;
alter table ai_messages enable row level security;

-- Helper function: is member of org
create or replace function is_org_member(org_id uuid)
returns boolean language sql security definer as $$
  select exists (select 1 from organization_memberships where organization_id = org_id and user_id = auth.uid() and status='active');
$$;

create or replace function is_org_admin(org_id uuid)
returns boolean language sql security definer as $$
  select exists (select 1 from organization_memberships where organization_id=org_id and user_id=auth.uid() and role in ('super_admin','org_admin') and status='active');
$$;

-- Profiles: user can read all in same org, update own
create policy "profiles_self" on profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_read_org" on profiles for select using (true); -- limited via app, but allow directory

-- Organizations: members can select their orgs
create policy "orgs_member_select" on organizations for select using (is_org_member(id) OR created_by = auth.uid());
create policy "orgs_create" on organizations for insert with check (auth.uid() is not null);
create policy "orgs_admin_update" on organizations for update using (is_org_admin(id));

-- Memberships
create policy "memberships_member_select" on organization_memberships for select using (user_id = auth.uid() or is_org_member(organization_id));
create policy "memberships_admin_modify" on organization_memberships for all using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));
create policy "memberships_self_insert" on organization_memberships for insert with check (user_id = auth.uid());

-- Frameworks: public read (catalog), only super_admin write
create policy "frameworks_read_all" on frameworks for select using (true);
create policy "frameworks_admin_write" on frameworks for all using (exists (select 1 from organization_memberships where user_id=auth.uid() and role='super_admin')) with check (exists (select 1 from organization_memberships where user_id=auth.uid() and role='super_admin'));

-- Controls
create policy "controls_read_all" on framework_controls for select using (true);
create policy "controls_admin_write" on framework_controls for all using (exists (select 1 from organization_memberships where user_id=auth.uid() and role='super_admin')) with check (true);

-- Compliance assessments: scoped to org membership
create policy "assess_select_member" on compliance_assessments for select using (is_org_member(organization_id));
create policy "assess_modify_member" on compliance_assessments for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));

-- Risks
create policy "risks_member" on risks for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "risk_history_member" on risk_history for select using (exists (select 1 from risks where risks.id = risk_history.risk_id and is_org_member(risks.organization_id)));

-- Evidence
create policy "evidence_member" on evidence for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "evidence_versions_member" on evidence_versions for all using (exists (select 1 from evidence where evidence.id = evidence_versions.evidence_id and is_org_member(evidence.organization_id))) with check (true);
create policy "evidence_links_member" on evidence_control_links for all using (exists (select 1 from evidence where evidence.id = evidence_control_links.evidence_id and is_org_member(evidence.organization_id))) with check (true);

-- Tasks
create policy "tasks_member" on tasks for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "task_comments_member" on task_comments for all using (exists (select 1 from tasks where tasks.id = task_comments.task_id and is_org_member(tasks.organization_id))) with check (true);

-- Audits
create policy "audits_member" on audits for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "audit_findings_member" on audit_findings for all using (exists (select 1 from audits where audits.id = audit_findings.audit_id and is_org_member(audits.organization_id))) with check (true);

-- Notifications: only own
create policy "notifs_own" on notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Activity logs: org members read, no update/delete
create policy "activity_read_member" on activity_logs for select using (is_org_member(organization_id));
create policy "activity_insert_member" on activity_logs for insert with check (is_org_member(organization_id));

-- AI
create policy "ai_conv_member" on ai_conversations for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy "ai_msg_member" on ai_messages for all using (exists (select 1 from ai_conversations where ai_conversations.id = ai_messages.conversation_id and is_org_member(ai_conversations.organization_id))) with check (true);


-- Storage buckets
insert into storage.buckets (id, name, public) values ('evidence','evidence', false), ('audit-reports','audit-reports', false), ('avatars','avatars', true) on conflict (id) do nothing;

-- Storage policies: evidence private, scoped to org via path prefix orgId/
create policy "evidence_storage_member_read" on storage.objects for select using (bucket_id='evidence' and is_org_member((string_to_array(name,'/'))[1]::uuid));
create policy "evidence_storage_member_write" on storage.objects for insert with check (bucket_id='evidence' and is_org_member((string_to_array(name,'/'))[1]::uuid));
create policy "evidence_storage_member_update" on storage.objects for update using (bucket_id='evidence' and is_org_member((string_to_array(name,'/'))[1]::uuid));
create policy "evidence_storage_member_delete" on storage.objects for delete using (bucket_id='evidence' and is_org_member((string_to_array(name,'/'))[1]::uuid));

create policy "avatars_public_read" on storage.objects for select using (bucket_id='avatars');
create policy "avatars_user_write" on storage.objects for insert with check (bucket_id='avatars' and auth.uid()::text = (storage.foldername(name))[1]);


-- Seed Frameworks (demo labeled)
insert into frameworks (name, slug, version, description, category, is_demo) values
('ISO/IEC 27001:2022','iso27001','2022','Information security management systems','ISO', true),
('NIST Cybersecurity Framework 2.0','nist-csf','2.0','Govern, Identify, Protect, Detect, Respond, Recover','NIST', true),
('SOC 2 Trust Services Criteria','soc2','2017','Security, Availability, Processing Integrity, Confidentiality, Privacy','SOC', true),
('Digital Personal Data Protection Act, 2023','dpdp-act','2023','India DPDP Act obligations for Data Fiduciaries','Indian Law', true),
('CERT-In Directions 2022','cert-in','2022','Incident reporting, log retention, sync, contacts','Indian Regulation', true),
('RBI Cyber Security Framework for Banks','rbi-csf','2023','RBI requirements for Banks, NBFCs','Indian Regulation', true),
('UGC IT Guidelines','ugc-it','2023','University Grants Commission IT & data guidelines','Indian Regulation', true)
on conflict (slug) do nothing;

-- Sample controls for ISO
insert into framework_controls (framework_id, control_id, title, description, category, implementation_guidance)
select f.id, c.control_id, c.title, c.description, c.category, c.guidance from frameworks f,
(values
('A.5.1','Policies for information security','Management direction for information security','Governance','Document, approve, publish ISMS policies, review annually.'),
('A.5.31','Legal, statutory, regulatory and contractual requirements','Compliance with laws','Compliance','Maintain legal register including DPDP, CERT-In, RBI.'),
('A.8.10','Information deletion','Data retention and deletion','Data Protection','Define retention schedule and secure deletion per DPDP Sec 8.'),
('A.8.12','Data leakage prevention','Prevent unauthorized disclosure','Data Protection','DLP controls, classification, labeling.')
) as c(control_id, title, description, category, guidance)
where f.slug='iso27001'
on conflict (framework_id, control_id) do nothing;

-- DPDP controls
insert into framework_controls (framework_id, control_id, title, description, category, implementation_guidance)
select f.id, c.control_id, c.title, c.description, c.category, c.guidance from frameworks f,
(values
('DP-1','Notice and Consent','Provide clear notice and obtain verifiable consent per Sec 6','Consent','Publish privacy notice, maintain consent artifact, consent manager integration.'),
('DP-7','Retention and Erasure','Erase personal data when purpose fulfilled or consent withdrawn','Data Rights','Implement retention policy, automated purge, consent withdrawal workflow.'),
('DP-8','Data Principal Rights','Implement grievance redressal and rights handling','Data Rights','Rights portal, 7-day acknowledgment, logs.'),
('DP-12','Security Safeguards','Reasonable security safeguards per Sec 8(4)','Security','Encryption, access control, audit logs, breach notification to DPA within 72h.')
) as c(control_id, title, description, category, guidance)
where f.slug='dpdp-act'
on conflict (framework_id, control_id) do nothing;

-- Demo org and risk scoring note
-- risk scoring: inherent = likelihood*impact (1-25). Severity mapping: 1-4 Low, 5-9 Medium, 10-16 High, 17-25 Critical. Residual calculated similarly.
