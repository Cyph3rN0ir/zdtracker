-- =====================================================================
-- ZeroTrack — Supabase schema setup
-- Run this ONCE in Supabase Dashboard → SQL Editor → New query → Run
-- =====================================================================

-- Extensions
create extension if not exists pgcrypto;

-- ---------- Users (custom auth, NOT Supabase Auth) ----------
create table if not exists public.app_users (
  id            uuid primary key default gen_random_uuid(),
  username      text unique not null,
  password_hash text not null,
  role          text not null check (role in ('admin','owner','investor','member')),
  display_name  text not null default '',
  created_at    timestamptz not null default now()
);

-- ---------- Businesses ----------
create table if not exists public.businesses (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.business_members (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  user_id         uuid not null references public.app_users(id) on delete cascade,
  role_in_business text not null check (role_in_business in ('owner','investor','member')),
  created_at      timestamptz not null default now(),
  unique (business_id, user_id, role_in_business)
);

-- ---------- Business money ledger ----------
create table if not exists public.business_transactions (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  kind          text not null check (kind in ('investment','earning','expense','profit_distribution')),
  amount        numeric(14,2) not null check (amount >= 0),
  party_user_id uuid references public.app_users(id) on delete set null,
  note          text not null default '',
  occurred_on   date not null default current_date,
  created_at    timestamptz not null default now()
);
create index if not exists idx_btx_business on public.business_transactions(business_id);
create index if not exists idx_btx_kind on public.business_transactions(business_id, kind);

-- ---------- Personal money (fully separate) ----------
create table if not exists public.personal_profiles (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.app_users(id) on delete cascade,
  name          text not null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_personal_owner on public.personal_profiles(owner_user_id);

create table if not exists public.personal_transactions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.personal_profiles(id) on delete cascade,
  kind        text not null check (kind in ('earning','expense','debt','repayment')),
  amount      numeric(14,2) not null check (amount >= 0),
  note        text not null default '',
  occurred_on date not null default current_date,
  created_at  timestamptz not null default now()
);
create index if not exists idx_ptx_profile on public.personal_transactions(profile_id);

-- ---------- Tasks ----------
create table if not exists public.tasks (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses(id) on delete cascade,
  assignee_user_id uuid not null references public.app_users(id) on delete cascade,
  title            text not null,
  details          text not null default '',
  due_date         date not null,
  status           text not null default 'pending' check (status in ('pending','done')),
  created_by       uuid references public.app_users(id) on delete set null,
  created_at       timestamptz not null default now(),
  completed_at     timestamptz
);
create index if not exists idx_tasks_assignee on public.tasks(assignee_user_id, due_date);
create index if not exists idx_tasks_business on public.tasks(business_id, due_date);

-- ---------- Lock everything down: only the service role (server) can read/write ----------
alter table public.app_users              enable row level security;
alter table public.businesses             enable row level security;
alter table public.business_members       enable row level security;
alter table public.business_transactions  enable row level security;
alter table public.personal_profiles      enable row level security;
alter table public.personal_transactions  enable row level security;
alter table public.tasks                  enable row level security;

-- Revoke from Data API roles. Server uses service_role which bypasses RLS.
revoke all on public.app_users,
                public.businesses,
                public.business_members,
                public.business_transactions,
                public.personal_profiles,
                public.personal_transactions,
                public.tasks
from anon, authenticated;

grant all on public.app_users,
              public.businesses,
              public.business_members,
              public.business_transactions,
              public.personal_profiles,
              public.personal_transactions,
              public.tasks
to service_role;

-- ---------- Seed default admin (admin / 1234) ----------
-- bcrypt hash of "1234" (cost 10)
insert into public.app_users (username, password_hash, role, display_name)
values ('admin', '$2b$10$iF4o1Y0zHri2Wybd2T/g6en7jkXnrWeOI/8AhPLcTG28rAnjAD2RK', 'admin', 'Administrator')
on conflict (username) do nothing;
