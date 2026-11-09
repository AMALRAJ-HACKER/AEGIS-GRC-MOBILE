-- Create notification for any org member (bypasses RLS while enforcing membership)
create or replace function create_notification(
  p_user_id uuid,
  p_organization_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_resource_type text default null,
  p_resource_id uuid default null
) returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  -- Enforce that caller is member of the org and target is member of same org (safety)
  if not is_org_member(p_organization_id) then
    raise exception 'not authorized';
  end if;
  -- Optional: ensure target is in same org
  if not exists (
    select 1 from organization_memberships
    where organization_id = p_organization_id and user_id = p_user_id and status = 'active'
  ) then
    raise exception 'target user not in organization';
  end if;
  insert into notifications (user_id, organization_id, type, title, body, resource_type, resource_id)
  values (p_user_id, p_organization_id, p_type, p_title, p_body, p_resource_type, p_resource_id)
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function create_notification(uuid, uuid, text, text, text, text, uuid) to authenticated;
revoke execute on function create_notification(uuid, uuid, text, text, text, text, uuid) from anon, public;
