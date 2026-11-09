-- 0007_accept_invitation.sql — let an invited teammate join an organization.
--
-- Context: the admin side exists (Settings -> Team creates an invitation row
-- and shares its token). But invitations RLS only lets org members read
-- invitations, so an invitee could never look up their own invite. This
-- SECURITY DEFINER function does the lookup server-side with strict checks:
--
--   1. caller must be signed in (auth.uid())
--   2. invitation must exist and be still 'pending'
--   3. the invitation's email must match the caller's auth email
--      (a leaked/shared token cannot be redeemed by another account)
--   4. creates the membership with the admin-chosen role, marks invite used

create or replace function public.accept_invitation(invite_token uuid)
returns table (organization_id uuid, role user_role)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_email text;
  inv record;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  select u.email into v_email from auth.users u where u.id = v_uid;
  if v_email is null then
    raise exception 'This account has no email address';
  end if;

  select * into inv
  from public.invitations i
  where i.token = invite_token and i.status = 'pending';
  if not found then
    raise exception 'Invitation not found or already used';
  end if;

  if lower(inv.email) <> lower(v_email) then
    raise exception 'This invitation was sent to % — sign in with that email to accept it', inv.email;
  end if;

  if not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = inv.organization_id and m.user_id = v_uid and m.status = 'active'
  ) then
    insert into public.organization_memberships (organization_id, user_id, role, status)
    values (inv.organization_id, v_uid, inv.role, 'active');
  end if;

  update public.invitations set status = 'accepted' where id = inv.id;

  return query select inv.organization_id, inv.role;
end;
$fn$;

revoke execute on function public.accept_invitation(uuid) from public, anon;
grant execute on function public.accept_invitation(uuid) to authenticated;
