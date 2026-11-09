-- 0010_notification_alerts.sql
-- In-app notification generation.
--   * task assigned / reassigned
--   * task completed / blocked
--   * risk assigned / high-critical risk escalation
--   * evidence approved / rejected
--   * daily job: overdue + due-soon tasks, expiring/expired evidence
-- Honours each user's notification_prefs. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Core insert helper: validates membership, checks preference, optional dedupe
-- ---------------------------------------------------------------------------
create or replace function public.notify_user(
  p_user_id uuid,
  p_organization_id uuid,
  p_type text,
  p_title text,
  p_body text default null,
  p_resource_type text default null,
  p_resource_id uuid default null,
  p_pref_key text default null,
  p_dedupe_hours int default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_pref boolean;
begin
  if p_user_id is null or p_organization_id is null then
    return null;
  end if;

  if not exists (
    select 1 from organization_memberships
    where organization_id = p_organization_id
      and user_id = p_user_id
      and status = 'active'
  ) then
    return null;
  end if;

  if p_pref_key is not null then
    select coalesce((notification_prefs ->> p_pref_key)::boolean, true)
      into v_pref
      from profiles where id = p_user_id;
    if v_pref is false then
      return null;
    end if;
  end if;

  if p_dedupe_hours is not null and exists (
    select 1 from notifications n
    where n.user_id = p_user_id
      and n.type = p_type
      and n.resource_id is not distinct from p_resource_id
      and n.created_at > now() - make_interval(hours => p_dedupe_hours)
  ) then
    return null;
  end if;

  insert into notifications (user_id, organization_id, type, title, body, resource_type, resource_id)
  values (p_user_id, p_organization_id, p_type, p_title, p_body, p_resource_type, p_resource_id)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.notify_user(uuid, uuid, text, text, text, text, uuid, text, int) from anon, public;

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
create or replace function public.trg_notify_tasks() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_recipient uuid;
begin
  v_actor_name := coalesce((select full_name from profiles where id = v_actor), 'A teammate');

  if tg_op = 'INSERT' then
    if new.assigned_to is not null and new.assigned_to is distinct from v_actor then
      perform public.notify_user(
        new.assigned_to, new.organization_id, 'task_assigned',
        'New task assigned: ' || new.title,
        'Priority: ' || new.priority
          || coalesce(' · Due ' || to_char(new.due_date, 'Mon DD'), ''),
        'task', new.id, 'task_assigned');
    end if;
    return new;
  end if;

  -- reassignment
  if new.assigned_to is distinct from old.assigned_to
     and new.assigned_to is not null
     and new.assigned_to is distinct from v_actor then
    perform public.notify_user(
      new.assigned_to, new.organization_id, 'task_assigned',
      'Task assigned to you: ' || new.title,
      'Priority: ' || new.priority
        || coalesce(' · Due ' || to_char(new.due_date, 'Mon DD'), ''),
      'task', new.id, 'task_assigned');
  end if;

  -- status changes
  if new.status is distinct from old.status then
    if new.status = 'done' then
      v_recipient := coalesce(new.created_by, new.owner_id, new.assigned_to);
      if v_recipient is distinct from v_actor then
        perform public.notify_user(
          v_recipient, new.organization_id, 'task_completed',
          'Task completed: ' || new.title,
          v_actor_name || ' marked this task as done.',
          'task', new.id, null);
      end if;
    elsif new.status = 'blocked' then
      v_recipient := coalesce(new.created_by, new.owner_id, new.assigned_to);
      if v_recipient is distinct from v_actor then
        perform public.notify_user(
          v_recipient, new.organization_id, 'task_blocked',
          'Task blocked: ' || new.title,
          v_actor_name || ' marked this task as blocked.',
          'task', new.id, null);
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tasks_notifications on tasks;
create trigger trg_tasks_notifications
  after insert or update of assigned_to, status, owner_id, created_by
  on tasks
  for each row execute function public.trg_notify_tasks();

-- ---------------------------------------------------------------------------
-- Risks
-- ---------------------------------------------------------------------------
create or replace function public.trg_notify_risks() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_member record;
  v_is_new boolean := (tg_op = 'INSERT');
begin
  -- (re)assignment to a risk owner
  if new.owner_id is not null and new.owner_id is distinct from v_actor
     and (v_is_new or new.owner_id is distinct from old.owner_id) then
    perform public.notify_user(
      new.owner_id, new.organization_id, 'risk_assigned',
      'Risk assigned: ' || new.title,
      'Severity: ' || new.severity || ' · Score ' || new.inherent_score,
      'risk', new.id, 'risk_changes');
  end if;

  -- escalate newly high / critical risks to admins, analysts and management
  if new.severity in ('critical', 'high')
     and (v_is_new or new.severity is distinct from old.severity) then
    for v_member in
      select user_id from organization_memberships
      where organization_id = new.organization_id
        and status = 'active'
        and role in ('org_admin', 'grc_analyst', 'management')
        and user_id is distinct from new.owner_id
    loop
      perform public.notify_user(
        v_member.user_id, new.organization_id, 'risk_escalated',
        'New ' || new.severity || ' risk: ' || new.title,
        'Score ' || new.inherent_score
          || coalesce(' · ' || new.category, ' · unclassified')
          || coalesce(' · target ' || to_char(new.target_date, 'Mon DD'), ''),
        'risk', new.id, 'risk_changes', 12);
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_risks_notifications on risks;
create trigger trg_risks_notifications
  after insert or update of owner_id, severity, title
  on risks
  for each row execute function public.trg_notify_risks();

-- ---------------------------------------------------------------------------
-- Evidence (approval decisions)
-- ---------------------------------------------------------------------------
create or replace function public.trg_notify_evidence() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.status is distinct from old.status
     and new.status in ('approved', 'rejected')
     and new.owner_id is not null
     and new.owner_id is distinct from auth.uid() then
    perform public.notify_user(
      new.owner_id, new.organization_id,
      case new.status when 'approved' then 'evidence_approved' else 'evidence_rejected' end,
      'Evidence ' || new.status || ': ' || new.title,
      case when new.expiry_date is not null
        then 'Expiry date ' || to_char(new.expiry_date, 'Mon DD, YYYY')
        else 'No expiry date set' end,
      'evidence', new.id, null);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_evidence_notifications on evidence;
create trigger trg_evidence_notifications
  after update of status on evidence
  for each row execute function public.trg_notify_evidence();

-- ---------------------------------------------------------------------------
-- Daily job: due-soon / overdue tasks and expiring evidence
-- ---------------------------------------------------------------------------
create or replace function public.run_daily_notification_jobs() returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task record;
  v_ev record;
  v_admin record;
  v_who uuid;
  v_count int := 0;
begin
  -- tasks due within 2 days, or already overdue
  for v_task in
    select t.* from tasks t
    where t.status <> 'done'
      and t.due_date is not null
      and t.due_date <= current_date + 2
  loop
    v_who := coalesce(v_task.assigned_to, v_task.owner_id, v_task.created_by);
    if v_task.due_date < current_date then
      if public.notify_user(
        v_who, v_task.organization_id, 'task_overdue',
        'Overdue: ' || v_task.title,
        'Was due ' || to_char(v_task.due_date, 'Mon DD, YYYY') || ' · status: ' || v_task.status,
        'task', v_task.id, 'task_due_soon', 20) is not null then
        v_count := v_count + 1;
      end if;
    else
      if public.notify_user(
        v_who, v_task.organization_id, 'task_due_soon',
        'Due soon: ' || v_task.title,
        'Due ' || to_char(v_task.due_date, 'Mon DD, YYYY') || ' · status: ' || v_task.status,
        'task', v_task.id, 'task_due_soon', 20) is not null then
        v_count := v_count + 1;
      end if;
    end if;
  end loop;

  -- evidence expiring in the next 30 days (or already past its expiry date)
  for v_ev in
    select e.* from evidence e
    where e.expiry_date is not null
      and e.expiry_date <= current_date + 30
      and e.status <> 'expired'
  loop
    v_who := v_ev.owner_id;
    if v_who is null then
      for v_admin in
        select user_id from organization_memberships
        where organization_id = v_ev.organization_id
          and status = 'active' and role = 'org_admin'
      loop
        if public.notify_user(
          v_admin.user_id, v_ev.organization_id,
          case when v_ev.expiry_date < current_date then 'evidence_expired' else 'evidence_expiring' end,
          case when v_ev.expiry_date < current_date then 'Evidence expired: ' else 'Evidence expiring: ' end || v_ev.title,
          'Expiry date ' || to_char(v_ev.expiry_date, 'Mon DD, YYYY'),
          'evidence', v_ev.id, 'evidence_expiring', 144) is not null then
          v_count := v_count + 1;
        end if;
      end loop;
    else
      if public.notify_user(
        v_who, v_ev.organization_id,
        case when v_ev.expiry_date < current_date then 'evidence_expired' else 'evidence_expiring' end,
        case when v_ev.expiry_date < current_date then 'Evidence expired: ' else 'Evidence expiring: ' end || v_ev.title,
        'Expiry date ' || to_char(v_ev.expiry_date, 'Mon DD, YYYY'),
        'evidence', v_ev.id, 'evidence_expiring', 144) is not null then
        v_count := v_count + 1;
      end if;
    end if;
  end loop;

  -- reflect the date in the evidence records themselves
  update evidence
     set status = 'expired', updated_at = now()
   where expiry_date is not null
     and expiry_date < current_date
     and status not in ('expired', 'rejected');

  return v_count;
end;
$$;

revoke execute on function public.run_daily_notification_jobs() from anon, public;

-- schedule it once a day at 07:00 UTC (if pg_cron is available on this project)
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
  end if;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $q$
      select cron.schedule(
        'aegis-daily-notification-jobs',
        '0 7 * * *',
        'select public.run_daily_notification_jobs();'
      )
      where not exists (select 1 from cron.job where jobname = 'aegis-daily-notification-jobs')
    $q$;
  end if;
end;
$$;
