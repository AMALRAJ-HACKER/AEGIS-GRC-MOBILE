-- AEGIS GRC — PRD alignment migration (0003)
-- Adds: task approval workflow states, profile/org settings fields,
--       team invitations table, notification prefs, extra framework seed controls.

-- 1) Task status: PRD approval workflow (Open / In Progress / Pending Review / Approved / Closed)
alter type task_status add value if not exists 'pending_review';
alter type task_status add value if not exists 'approved';

-- 2) Task approval metadata
alter table tasks add column if not exists review_note text;
alter table tasks add column if not exists review_requested_at timestamptz;

-- 3) Profile fields (Screen 22: User Profile)
alter table profiles add column if not exists job_title text;
alter table profiles add column if not exists department text;
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists notification_prefs jsonb default '{}'::jsonb;

-- 4) Organization fields (Screen 23: Organization Settings)
alter table organizations add column if not exists country text;
alter table organizations add column if not exists timezone text;
alter table organizations add column if not exists logo_url text;
alter table organizations add column if not exists report_schedule jsonb default '{}'::jsonb;

-- 5) Team invitations (Screen 23: Team tab — invite by email with role)
create table if not exists invitations (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role user_role not null default 'staff',
  token uuid not null default uuid_generate_v4(),
  status text default 'pending', -- pending | accepted | revoked
  invited_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique(organization_id, email)
);
alter table invitations enable row level security;
drop policy if exists invitations_member_select on invitations;
create policy invitations_member_select on invitations for select using (is_org_member(organization_id));
drop policy if exists invitations_admin_manage on invitations;
create policy invitations_admin_manage on invitations for all using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));

-- 6) Additional preloaded controls for catalog frameworks (PRD 2.3 templates)
insert into framework_controls (framework_id, control_id, title, description, category, implementation_guidance)
select f.id, c.control_id, c.title, c.description, c.category, c.guidance from frameworks f,
(values
 ('A.5.9','Inventory of information and other associated assets','Maintain asset inventory including cloud assets','Governance','Asset register with owners, classification, review cadence.'),
 ('A.5.15','Access control','Control access to information assets','Access Control','Role-based access, least privilege, access review quarterly.'),
 ('A.5.16','Identity management','Manage identities through lifecycle','Access Control','SSO, joiner-mover-leaver process, unique IDs.'),
 ('A.8.8','Management of technical vulnerabilities','Identify and remediate vulnerabilities','Technical','Vulnerability scanning, patch SLAs by severity.'),
 ('A.8.15','Logging','Record events and generate logs','Monitoring','Centralized logs, tamper protection, 365-day retention (CERT-In: 180 days).'),
 ('A.8.16','Monitoring activities','Detect anomalous behaviour','Monitoring','SIEM/alerting, use of AI for anomaly detection with review.')
) as c(control_id, title, description, category, guidance)
where f.slug='iso27001'
on conflict (framework_id, control_id) do nothing;

insert into framework_controls (framework_id, control_id, title, description, category, implementation_guidance)
select f.id, c.control_id, c.title, c.description, c.category, c.guidance from frameworks f,
(values
 ('PR-A','Privacy notice and consent','Publish notice; obtain, record and manage consent','Consent','Consent artefacts, withdrawal workflow, consent manager integration.'),
 ('PR-B','Data inventory and purpose limitation','Map personal data, limit processing to stated purpose','Data Mapping','RoPA, purpose registry, retention schedule.'),
 ('PR-C','Data subject rights','Honour access, correction, erasure and grievance rights','Data Rights','Rights request portal, 7-day acknowledgment, identity verification.'),
 ('PR-D','Breach notification','Notify DPA and affected principals without delay','Incident Response','Breach playbook, 72h internal escalation, evidence of notification.')
) as c(control_id, title, description, category, guidance)
where f.slug='dpdp-act'
on conflict (framework_id, control_id) do nothing;

insert into framework_controls (framework_id, control_id, title, description, category, implementation_guidance)
select f.id, c.control_id, c.title, c.description, c.category, c.guidance from frameworks f,
(values
 ('CC1.1','Control environment and integrity','Demonstrate integrity and ethical values','Governance','Code of conduct, board oversight, whistleblowing.'),
 ('CC6.1','Logical access security','Restrict logical access to systems and data','Access Control','MFA, RBAC, access provisioning and deprovisioning.'),
 ('CC7.2','System monitoring','Monitor for anomalies and security events','Monitoring','Monitoring pipeline, incident response SLAs.'),
 ('CC8.1','Change management','Authorise, test and track changes','Change','Change advisory board, CI/CD approvals, rollback plans.')
) as c(control_id, title, description, category, guidance)
where f.slug='soc2'
on conflict (framework_id, control_id) do nothing;

insert into framework_controls (framework_id, control_id, title, description, category, implementation_guidance)
select f.id, c.control_id, c.title, c.description, c.category, c.guidance from frameworks f,
(values
 ('GV.RM-01','Risk management process','Establish and perform risk management','Governance','Risk criteria, register, treatment plans, review cadence.'),
 ('ID.AM-01','Asset identification','Inventory hardware, software and data assets','Identify','CMDB, data discovery, ownership mapping.'),
 ('PR.AA-05','Access management','Manage authorisation and authentication','Protect','MFA, PAM, privileged access reviews.'),
 ('RS.MA-01','Incident response process','Manage incidents per plan','Respond','IR plan, on-call rota, tabletop exercises.')
) as c(control_id, title, description, category, guidance)
where f.slug='nist-csf'
on conflict (framework_id, control_id) do nothing;

insert into framework_controls (framework_id, control_id, title, description, category, implementation_guidance)
select f.id, c.control_id, c.title, c.description, c.category, c.guidance from frameworks f,
(values
 ('CI-1','6-hour incident reporting','Report cyber incidents within 6 hours of noticing','Incident Reporting','CERT-In form, SOC watch, escalation tree.'),
 ('CI-2','180-day log retention','Synchronise ICT logs with government clock; retain 180 days','Logging','NTP sync, centralized SIEM, immutable storage.'),
 ('CI-3','KYA — Know Your Customers','Maintain designated contact for incident reporting','Governance',' nominate CISO/CIO, publish contact details, annual refresh.')
) as c(control_id, title, description, category, guidance)
where f.slug='cert-in'
on conflict (framework_id, control_id) do nothing;

insert into framework_controls (framework_id, control_id, title, description, category, implementation_guidance)
select f.id, c.control_id, c.title, c.description, c.category, c.guidance from frameworks f,
(values
 ('R1','Cyber security policy','Board-approved cyber security policy','Governance','Annual review, board approval, publication.'),
 ('R5','Baseline protections','Baseline security controls for core banking systems','Technical','Hardening standards, CIS benchmarks, patching.'),
 ('R9','Incident reporting to RBI','Report significant cyber incidents to RBI','Incident Reporting','RBI reporting template, 2-6 hour internal escalation.')
) as c(control_id, title, description, category, guidance)
where f.slug='rbi-csf'
on conflict (framework_id, control_id) do nothing;

insert into framework_controls (framework_id, control_id, title, description, category, implementation_guidance)
select f.id, c.control_id, c.title, c.description, c.category, c.guidance from frameworks f,
(values
 ('U1','IT governance','Institutional IT policy and governance structure','Governance','IT policy, committee, annual audit.'),
 ('U4','Student data protection','Protect student and staff personal data','Data Protection','Consent, access control, retention limits.'),
 ('U6','Incident handling','Cyber incident response and reporting','Incident Response','IRT, reporting to UGC/CERT-In, drills.')
) as c(control_id, title, description, category, guidance)
where f.slug='ugc-it'
on conflict (framework_id, control_id) do nothing;
