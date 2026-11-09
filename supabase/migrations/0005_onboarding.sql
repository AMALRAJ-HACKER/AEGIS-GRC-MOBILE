-- 0005_onboarding.sql — self-serve organization setup + profile auto-creation.
--
-- Root cause this fixes: sign-up created an auth user only. No organization,
-- membership, or profile row was ever created, so the workspace had no data
-- context (Profile showed no organization name / generic role, and every
-- org-scoped query ran with an empty orgId).
--
-- 1) Auto-create the profiles row on signup (standard Supabase pattern).
-- 2) Backfill profiles for users who signed up before the trigger existed.
-- Organization + membership creation happens in the app (app/onboarding.tsx)
-- using the existing RLS policies: orgs_create, memberships_self_insert,
-- profiles_self. The org creator gets role 'org_admin' (matches is_org_admin).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.profiles (id, email, full_name)
  select new.id,
         new.email,
         coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')
  where not exists (select 1 from public.profiles p where p.id = new.id);
  return new;
end;
$fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Backfill profiles for users who signed up before the trigger existed.
-- full_name falls back to the email local-part so the Profile screen is
-- never blank; the user can edit it from Profile -> Save.
insert into public.profiles (id, email, full_name)
select u.id,
       u.email,
       coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1))
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
