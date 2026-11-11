-- Existing installations: avoid redundant SELECT policies without changing access.
begin;
alter policy "Published content" on public.site_content to anon;
alter policy "Owner reads all" on public.site_content using (published or (select private.is_site_admin()));
commit;
