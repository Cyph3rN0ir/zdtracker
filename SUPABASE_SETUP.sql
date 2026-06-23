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


-- =====================================================================
-- Personal-finance module (appended from SUPABASE_PERSONAL_FINANCE.sql)
-- Idempotent — safe to re-run.
-- =====================================================================
-- =====================================================================
-- ZeroSync — Personal Finance module (Phase 1 schema)
-- Run this in Supabase SQL editor AFTER SUPABASE_SETUP.sql.
-- All tables are accessed only via the service_role (server functions),
-- so RLS is enabled but no anon/authenticated policies are needed.
-- =====================================================================

-- ---------- Accounts (cash / bank / wallet / card / investment / savings) ----------
create table if not exists public.personal_accounts (
  id              uuid primary key default gen_random_uuid(),
  owner_user_id   uuid not null references public.app_users(id) on delete cascade,
  profile_id      uuid not null references public.personal_profiles(id) on delete cascade,
  name            text not null,
  type            text not null check (type in ('cash','bank','wallet','card','investment','savings','other')),
  opening_balance numeric(14,2) not null default 0,
  currency        text not null default 'INR',
  archived        boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists idx_paccts_profile on public.personal_accounts(profile_id);

-- ---------- Categories ----------
create table if not exists public.personal_categories (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.app_users(id) on delete cascade,
  profile_id    uuid not null references public.personal_profiles(id) on delete cascade,
  name          text not null,
  kind          text not null check (kind in ('income','expense')),
  color         text not null default '#6366f1',
  icon          text not null default 'circle',
  archived      boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists idx_pcats_profile on public.personal_categories(profile_id);

-- ---------- Counterparties (people / vendors / employers) ----------
create table if not exists public.personal_counterparties (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.app_users(id) on delete cascade,
  profile_id    uuid not null references public.personal_profiles(id) on delete cascade,
  name          text not null,
  kind          text not null default 'person' check (kind in ('person','vendor','employer','other')),
  note          text not null default '',
  created_at    timestamptz not null default now()
);
create index if not exists idx_pcps_profile on public.personal_counterparties(profile_id);

-- ---------- Loans (both directions) ----------
create table if not exists public.personal_loans (
  id               uuid primary key default gen_random_uuid(),
  owner_user_id    uuid not null references public.app_users(id) on delete cascade,
  profile_id       uuid not null references public.personal_profiles(id) on delete cascade,
  direction        text not null check (direction in ('i_owe','owed_to_me')),
  counterparty_id  uuid references public.personal_counterparties(id) on delete set null,
  principal        numeric(14,2) not null check (principal >= 0),
  interest_rate    numeric(6,3) not null default 0,
  started_on       date not null default current_date,
  due_on           date,
  status           text not null default 'open' check (status in ('open','closed')),
  note             text not null default '',
  created_at       timestamptz not null default now()
);
create index if not exists idx_ploans_profile on public.personal_loans(profile_id, status);

-- ---------- Budgets ----------
create table if not exists public.personal_budgets (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.app_users(id) on delete cascade,
  profile_id    uuid not null references public.personal_profiles(id) on delete cascade,
  name          text not null,
  period        text not null check (period in ('week','month')),
  amount        numeric(14,2) not null check (amount >= 0),
  category_id   uuid references public.personal_categories(id) on delete set null,
  start_date    date not null default current_date,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists idx_pbudgets_profile on public.personal_budgets(profile_id, active);

-- ---------- Widen personal_transactions ----------
-- Add new columns (idempotent).
alter table public.personal_transactions
  add column if not exists account_id          uuid references public.personal_accounts(id) on delete set null,
  add column if not exists category_id         uuid references public.personal_categories(id) on delete set null,
  add column if not exists counterparty_id     uuid references public.personal_counterparties(id) on delete set null,
  add column if not exists transfer_account_id uuid references public.personal_accounts(id) on delete set null,
  add column if not exists linked_loan_id      uuid references public.personal_loans(id)    on delete set null;

-- Migrate legacy kind values to the new vocabulary.
update public.personal_transactions set kind = 'income'        where kind = 'earning';
update public.personal_transactions set kind = 'loan_taken'    where kind = 'debt';
update public.personal_transactions set kind = 'repayment_out' where kind = 'repayment';

-- Replace the CHECK constraint with the widened set.
alter table public.personal_transactions drop constraint if exists personal_transactions_kind_check;
alter table public.personal_transactions
  add constraint personal_transactions_kind_check check (kind in (
    'income','expense','transfer',
    'investment_buy','investment_sell',
    'savings_deposit','savings_withdraw',
    'loan_given','loan_taken',
    'repayment_in','repayment_out'
  ));

create index if not exists idx_ptx_account     on public.personal_transactions(account_id);
create index if not exists idx_ptx_category    on public.personal_transactions(category_id);
create index if not exists idx_ptx_loan        on public.personal_transactions(linked_loan_id);
create index if not exists idx_ptx_occurred_on on public.personal_transactions(profile_id, occurred_on desc);

-- ---------- RLS + grants (mirror the existing pattern: service_role only) ----------
alter table public.personal_accounts        enable row level security;
alter table public.personal_categories      enable row level security;
alter table public.personal_counterparties  enable row level security;
alter table public.personal_loans           enable row level security;
alter table public.personal_budgets         enable row level security;

revoke all on public.personal_accounts,
              public.personal_categories,
              public.personal_counterparties,
              public.personal_loans,
              public.personal_budgets
from anon, authenticated;

grant all on public.personal_accounts,
             public.personal_categories,
             public.personal_counterparties,
             public.personal_loans,
             public.personal_budgets
to service_role;

-- ----------------------------------------------------------------------------
-- Safety net: ensure RLS + grants on personal_transactions if this migration
-- ever runs against a DB that skipped SUPABASE_SETUP.sql.
-- ----------------------------------------------------------------------------
alter table if exists public.personal_transactions enable row level security;
revoke all on public.personal_transactions from anon, authenticated;
grant all on public.personal_transactions to service_role;
