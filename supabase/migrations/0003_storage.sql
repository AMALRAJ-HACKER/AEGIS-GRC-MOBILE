
-- Storage buckets
insert into storage.buckets (id, name, public) values ('evidence','evidence', false), ('audit-reports','audit-reports', false), ('avatars','avatars', true) on conflict (id) do nothing;

-- Storage policies: evidence private, scoped to org via path prefix orgId/
create policy "evidence_storage_member_read" on storage.objects for select using (bucket_id='evidence' and is_org_member((string_to_array(name,'/'))[1]::uuid));
create policy "evidence_storage_member_write" on storage.objects for insert with check (bucket_id='evidence' and is_org_member((string_to_array(name,'/'))[1]::uuid));
create policy "evidence_storage_member_update" on storage.objects for update using (bucket_id='evidence' and is_org_member((string_to_array(name,'/'))[1]::uuid));
create policy "evidence_storage_member_delete" on storage.objects for delete using (bucket_id='evidence' and is_org_member((string_to_array(name,'/'))[1]::uuid));

create policy "avatars_public_read" on storage.objects for select using (bucket_id='avatars');
create policy "avatars_user_write" on storage.objects for insert with check (bucket_id='avatars' and auth.uid()::text = (storage.foldername(name))[1]);
