create table public.password_reset_tokens (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  token text not null unique,
  expires_at timestamptz not null,
  used boolean default false,
  created_at timestamptz default now()
);

create index idx_reset_token on public.password_reset_tokens(token);
