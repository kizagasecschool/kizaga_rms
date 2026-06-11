-- Kizaga Secondary School - Create profiles table
-- Run this in Supabase SQL Editor

-- Drop table first (removes policies + data automatically)
drop table if exists public.profiles;

-- Drop trigger and functions
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user;
drop function if exists public.get_my_role;

-- Create profiles table
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  role       text not null default 'teacher' check (role in ('admin', 'headmaster', 'academic', 'teacher')),
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Helper: get role without triggering RLS recursion (security definer bypasses RLS)
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Policies (using get_my_role() to avoid self-referencing recursion)
create policy "Admin full access"
  on public.profiles for all
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

create policy "Headmaster read only"
  on public.profiles for select
  using (public.get_my_role() = 'headmaster');

create policy "Academic select"
  on public.profiles for select
  using (public.get_my_role() = 'academic');

create policy "Academic update"
  on public.profiles for update
  using (public.get_my_role() = 'academic')
  with check (public.get_my_role() = 'academic');

create policy "Teacher read own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Index
create index if not exists idx_profiles_role on public.profiles(role);

-- Trigger: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'role', 'teacher')
  );
  return new;
exception
  when others then
    return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
