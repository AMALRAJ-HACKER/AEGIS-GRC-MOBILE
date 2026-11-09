-- 0006_org_slug.sql — auto-generate organizations.slug on insert.
--
-- organizations.slug is NOT NULL + UNIQUE, and the in-app onboarding flow
-- (app/onboarding.tsx) only supplies name/created_by. This trigger fills the
-- slug automatically: slugified name + a short random suffix so the unique
-- constraint always holds (e.g. "acme-corp-3f9a2b").

create or replace function public.org_generate_slug()
returns trigger
language plpgsql
as $fn$
declare
  base text;
begin
  if new.slug is null or btrim(new.slug) = '' then
    base := regexp_replace(lower(coalesce(new.name, 'org')), '[^a-z0-9]+', '-', 'g');
    base := trim(both '-' from base);
    if base = '' then base := 'org'; end if;
    new.slug := base || '-' || substr(md5(gen_random_uuid()::text), 1, 6);
  end if;
  return new;
end;
$fn$;

drop trigger if exists orgs_slug on public.organizations;
create trigger orgs_slug
  before insert on public.organizations
  for each row
  execute function public.org_generate_slug();
