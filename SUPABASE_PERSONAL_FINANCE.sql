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
