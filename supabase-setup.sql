-- Chat App 2 - clean Supabase setup
-- Run this once in Supabase SQL Editor on a new/blank project.
-- Creates the profile/message tables, RLS policies, storage bucket,
-- storage policies, indexes, Data API grants, and Realtime publication entries.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  device_id text not null unique,
  username text not null default 'Anonymous',
  pfp_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'public',
  device_id text not null,
  username text not null default 'Anonymous',
  pfp_url text,
  message text not null default '',
  image text,
  files jsonb not null default '[]'::jsonb,
  edited boolean not null default false,
  game_message boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_device_id_idx on public.profiles(device_id);
create index if not exists messages_channel_created_at_idx on public.messages(channel, created_at);
create index if not exists messages_device_id_idx on public.messages(device_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists messages_set_updated_at on public.messages;
create trigger messages_set_updated_at before update on public.messages
for each row execute function public.set_updated_at();

-- The app currently uses a browser-generated device_id instead of Supabase Auth.
-- Therefore the current frontend needs public anon access to these operations.
alter table public.profiles enable row level security;
alter table public.messages enable row level security;

grant select, insert, update, delete on public.profiles to anon, authenticated;
grant select, insert, update, delete on public.messages to anon, authenticated;

drop policy if exists "profiles_select_public" on public.profiles;
drop policy if exists "profiles_insert_public" on public.profiles;
drop policy if exists "profiles_update_public" on public.profiles;
drop policy if exists "profiles_delete_public" on public.profiles;
drop policy if exists "messages_select_public" on public.messages;
drop policy if exists "messages_insert_public" on public.messages;
drop policy if exists "messages_update_public" on public.messages;
drop policy if exists "messages_delete_public" on public.messages;

create policy "profiles_select_public" on public.profiles for select to anon, authenticated using (true);
create policy "profiles_insert_public" on public.profiles for insert to anon, authenticated with check (true);
create policy "profiles_update_public" on public.profiles for update to anon, authenticated using (true) with check (true);
create policy "profiles_delete_public" on public.profiles for delete to anon, authenticated using (true);

create policy "messages_select_public" on public.messages for select to anon, authenticated using (true);
create policy "messages_insert_public" on public.messages for insert to anon, authenticated with check (true);
create policy "messages_update_public" on public.messages for update to anon, authenticated using (true) with check (true);
create policy "messages_delete_public" on public.messages for delete to anon, authenticated using (true);

-- Profile picture bucket.
insert into storage.buckets (id, name, public)
values ('profile-pictures', 'profile-pictures', true)
on conflict (id) do update set public = true;

drop policy if exists "profile_pictures_select_public" on storage.objects;
drop policy if exists "profile_pictures_insert_public" on storage.objects;
drop policy if exists "profile_pictures_update_public" on storage.objects;
drop policy if exists "profile_pictures_delete_public" on storage.objects;

create policy "profile_pictures_select_public" on storage.objects
for select to anon, authenticated using (bucket_id = 'profile-pictures');
create policy "profile_pictures_insert_public" on storage.objects
for insert to anon, authenticated with check (bucket_id = 'profile-pictures');
create policy "profile_pictures_update_public" on storage.objects
for update to anon, authenticated using (bucket_id = 'profile-pictures') with check (bucket_id = 'profile-pictures');
create policy "profile_pictures_delete_public" on storage.objects
for delete to anon, authenticated using (bucket_id = 'profile-pictures');

-- Realtime/Postgres Changes requires messages to be in supabase_realtime.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;

-- Optional profile change events are also enabled.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end;
$$;

-- Verification.
select 'profiles' as table_name, count(*) as rows from public.profiles
union all
select 'messages', count(*) from public.messages;
