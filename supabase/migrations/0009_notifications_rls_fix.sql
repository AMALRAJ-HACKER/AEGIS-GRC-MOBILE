-- Allow org members to create notifications for other members in the same org
drop policy if exists "notifs_own" on notifications;
create policy "notifs_own" on notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid() or is_org_member(organization_id));
