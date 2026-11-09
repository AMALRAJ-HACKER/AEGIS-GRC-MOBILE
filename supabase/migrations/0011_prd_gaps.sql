-- 0011_prd_gaps.sql — additive PRD alignment.
--
-- No destructive changes: existing columns, rows and policies are preserved.
--   * PRD control status "Not Applicable"
--   * Risk archive flag + risk <-> control links
--   * Task recurring schedule + named reviewer
--   * Organization default framework
--   * risk_history write policy (the app already logs changes, but only a
--     SELECT policy existed, so history writes were silently rejected)
--   * Pending-review notification trigger (replaces a client-side insert that
--     RLS correctly rejected because it targeted another user)
-- Safe to re-run.

-- 1) Control status: PRD uses Not Applicable rather than Non-Compliant.
--    Keep the legacy value for existing rows; new UI exposes not_applicable.
alter type control_status add value if not exists 'not_applicable';

-- 2) Risks: archive without deleting history.
alter table risks add column if not exists archived_at timestamptz;
create index if not exists risks_org_active_idx on risks (organization_id, archived_at);

-- 3) Tasks: recurring schedule + named reviewer.
alter table tasks add column if not exists recurrence text not null default 'none';
alter table tasks add column if not exists reviewer_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_reviewer_id_fkey') then
    alter table tasks
      add constraint tasks_reviewer_id_fkey
      foreign key (reviewer_id) references profiles(id) on delete set null;
  end if;
end $$;

-- 4) Organization default framework (used when opening the workspace).
alter table organizations add column if not exists default_framework_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'organizations_default_framework_id_fkey') then
    alter table organizations
      add constraint organizations_default_framework_id_fkey
      foreign key (default_framework_id) references frameworks(id) on delete set null;
  end if;
end $$;

-- 5) Risk <-> control links (PRD: link risks to affected controls).
create table if not exists risk_control_links (
  id uuid primary key default gen_random_uuid(),
  risk_id uuid not null references risks(id) on delete cascade,
  control_assessment_id uuid not null references compliance_assessments(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (risk_id, control_assessment_id)
);
create index if not exists risk_control_links_risk_idx on risk_control_links (risk_id);

alter table risk_control_links enable row level security;
drop policy if exists risk_control_links_member on risk_control_links;
create policy risk_control_links_member on risk_control_links for all
  using (
    exists (
      select 1 from risks r
      where r.id = risk_control_links.risk_id
        and is_org_member(r.organization_id)
    )
  )
  with check (
    exists (
      select 1 from risks r
      where r.id = risk_control_links.risk_id
        and is_org_member(r.organization_id)
    )
  );

-- 6) History writes were missing a policy. Only org members may append.
drop policy if exists risk_history_insert_member on risk_history;
create policy risk_history_insert_member on risk_history for insert
  with check (
    exists (
      select 1 from risks r
      where r.id = risk_history.risk_id
        and is_org_member(r.organization_id)
    )
  );

-- 7) Pending-review notifications. The previous client-side insert targeted
--    another user and was rejected by notifications RLS (`user_id = auth.uid()`).
create or replace function public.trg_notify_task_review() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_recipient uuid;
  v_member record;
begin
  if new.status = 'pending_review' and old.status is distinct from 'pending_review' then
    v_recipient := coalesce(new.reviewer_id, new.created_by);

    if v_recipient is not null and v_recipient is distinct from v_actor then
      perform public.notify_user(
        v_recipient, new.organization_id, 'approval',
        'Task awaiting your review: ' || new.title,
        'Submitted by your teammate. Open the task to approve or reject.',
        'task', new.id, 'approval_requests');
    elsif v_recipient is null then
      for v_member in
        select user_id from organization_memberships
        where organization_id = new.organization_id
          and status = 'active'
          and role in ('org_admin', 'grc_analyst')
          and user_id is distinct from v_actor
      loop
        perform public.notify_user(
          v_member.user_id, new.organization_id, 'approval',
          'Task awaiting review: ' || new.title,
          'A teammate submitted this task for approval.',
          'task', new.id, 'approval_requests');
      end loop;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_task_review_notifications on tasks;
create trigger trg_task_review_notifications
  after update of status on tasks
  for each row execute function public.trg_notify_task_review();
