create extension if not exists "uuid-ossp";

-- =============================================
-- AUTH.JS ADAPTER TABLES
-- =============================================
create table public.users (
  id uuid default uuid_generate_v4() primary key,
  name text,
  email text unique,
  password text,
  "emailVerified" timestamptz,
  image text
);

create table public.accounts (
  id uuid default uuid_generate_v4() primary key,
  "userId" uuid not null references public.users(id) on delete cascade,
  type text not null,
  provider text not null,
  "providerAccountId" text not null,
  refresh_token text,
  access_token text,
  expires_at bigint,
  token_type text,
  scope text,
  id_token text,
  session_state text
);

create table public.sessions (
  id uuid default uuid_generate_v4() primary key,
  "sessionToken" text not null unique,
  "userId" uuid not null references public.users(id) on delete cascade,
  expires timestamptz not null
);

create table public.verification_tokens (
  identifier text not null,
  token text not null unique,
  expires timestamptz not null,
  primary key (identifier, token)
);

-- =============================================
-- APP TABLES
-- =============================================

create table public.profiles (
  user_id uuid references public.users(id) on delete cascade primary key,
  avatar text default '😎',
  color text default '#E8C547',
  bank text,
  acc_num text,
  acc_type text,
  branch text,
  phone text,
  updated_at timestamptz default now()
);

create table public.groups (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  icon text default '🔄',
  code text unique not null,
  monthly_amount integer default 500,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.group_members (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  is_admin boolean default false,
  joined_at timestamptz default now(),
  unique(group_id, user_id)
);

create table public.rotation_order (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  position integer not null,
  unique(group_id, user_id)
);

create table public.contributions (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  month integer not null check (month >= 0 and month <= 11),
  year integer not null,
  paid boolean default false,
  paid_at timestamptz,
  marked_by uuid references public.users(id),
  created_at timestamptz default now(),
  unique(group_id, user_id, month, year)
);

-- Indexes
create index idx_group_members_group on public.group_members(group_id);
create index idx_group_members_user on public.group_members(user_id);
create index idx_contributions_lookup on public.contributions(group_id, month, year);
create index idx_rotation_group on public.rotation_order(group_id);
create index idx_groups_code on public.groups(code);

-- Helper: generate unique 6-char invite code
create or replace function public.generate_group_code()
returns text as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
begin
  loop
    result := '';
    for i in 1..6 loop
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    end loop;
    if not exists (select 1 from public.groups where code = result) then
      return result;
    end if;
  end loop;
end;
$$ language plpgsql;
