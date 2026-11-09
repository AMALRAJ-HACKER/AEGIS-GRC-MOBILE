
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
