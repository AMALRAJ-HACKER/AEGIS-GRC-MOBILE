
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
