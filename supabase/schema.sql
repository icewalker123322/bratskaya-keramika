-- Execute once in Supabase SQL Editor, then execute seed.sql.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;
create table public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.site_admins enable row level security;
revoke all on public.site_admins from anon, authenticated;
grant select on public.site_admins to authenticated;
create policy "Read own membership" on public.site_admins for select to authenticated
  using (user_id = (select auth.uid()));

create function private.is_site_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.site_admins where user_id = (select auth.uid()));
$$;
revoke all on function private.is_site_admin() from public;
grant execute on function private.is_site_admin() to anon, authenticated;

create table public.site_content (
  id text primary key check (length(id) between 1 and 100),
  section text not null check(length(section)<=200),
  label text not null check(length(label)<=200),
  kind text not null check(kind in ('text','image','link','settings','class','gallery','benefit','faq')),
  data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<=100000),
  position integer not null default 0,
  published boolean not null default false,
  updated_at timestamptz not null default now(),
  check (id <> 'settings' or (kind='settings' and published))
);
alter table public.site_content enable row level security;
revoke all on public.site_content from anon, authenticated;
grant select on public.site_content to anon;
grant select,insert,update,delete on public.site_content to authenticated;
create policy "Published content" on public.site_content for select to anon, authenticated using(published);
create policy "Owner reads all" on public.site_content for select to authenticated using((select private.is_site_admin()));
create policy "Owner inserts" on public.site_content for insert to authenticated with check((select private.is_site_admin()));
create policy "Owner updates" on public.site_content for update to authenticated using((select private.is_site_admin())) with check((select private.is_site_admin()));
create policy "Owner deletes" on public.site_content for delete to authenticated using((select private.is_site_admin()) and kind in ('class','gallery','benefit','faq'));
create function public.stamp_site_content() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=clock_timestamp(); return new; end; $$;
create trigger stamp_site_content before update on public.site_content for each row execute function public.stamp_site_content();

create function public.move_site_content(item_id text, direction integer) returns void
language plpgsql security invoker set search_path='' as $$
declare current_item public.site_content; neighbor public.site_content;
begin
  if not private.is_site_admin() then raise exception 'Forbidden'; end if;
  if direction not in (-1,1) then raise exception 'Invalid direction'; end if;
  perform pg_advisory_xact_lock(718420);
  select * into current_item from public.site_content where id=item_id;
  if not found or current_item.kind not in ('class','gallery','benefit','faq') then raise exception 'Invalid item'; end if;
  -- Normalize positions so concurrent inserts with equal positions remain reorderable.
  with ordered as (select id,row_number() over(order by position,id)::integer as n from public.site_content where kind=current_item.kind)
    update public.site_content c set position=o.n from ordered o where c.id=o.id;
  select * into current_item from public.site_content where id=item_id;
  select * into neighbor from public.site_content where kind=current_item.kind and position=current_item.position+direction;
  if found then
    update public.site_content set position=case when id=current_item.id then neighbor.position else current_item.position end where id in (current_item.id,neighbor.id);
  end if;
end; $$;
revoke all on function public.move_site_content(text,integer) from public;
grant execute on function public.move_site_content(text,integer) to authenticated;

-- Create site-images through the Storage API: public, 5 MB, JPG/PNG/WebP.
-- Public images are intentional. Hidden content rows are private; images with a known URL are not.
create policy "Owner lists images" on storage.objects for select to authenticated
  using(bucket_id='site-images' and (select private.is_site_admin()));
create policy "Owner uploads images" on storage.objects for insert to authenticated
  with check(bucket_id='site-images' and (select private.is_site_admin()) and name ~ '^[a-f0-9-]+\.(jpg|png|webp)$');
-- No UPDATE policy: replacements use a new UUID, avoiding cache and overwrite issues.
create policy "Owner deletes unused images" on storage.objects for delete to authenticated
  using(bucket_id='site-images' and (select private.is_site_admin()) and not exists (
    select 1 from public.site_content c where c.data->>'image' like '%/storage/v1/object/public/site-images/' || name
  ));
commit;
