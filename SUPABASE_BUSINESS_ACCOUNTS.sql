-- =====================================================================
-- ZeroSync — Business accounts (asset buckets: cash / bank / wallet …)
-- Run this in the Supabase SQL editor AFTER SUPABASE_SETUP.sql.
-- All access goes through service_role (server functions), so RLS is
-- enabled with no anon/authenticated policies.
-- =====================================================================

create table if not exists public.business_accounts (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  name            text not null,
  type            text not null check (type in ('cash','bank','wallet','card','investment','savings','other')),
  opening_balance numeric(14,2) not null default 0,
  currency        text not null default 'BDT',
  archived        boolean not null default false,
  created_by      uuid references public.app_users(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists idx_baccts_business on public.business_accounts(business_id);

alter table public.business_accounts enable row level security;

grant all on public.business_accounts to service_role;

-- ---------- Link transactions to accounts ----------
alter table public.business_transactions
  add column if not exists account_id uuid references public.business_accounts(id) on delete set null;

alter table public.business_transactions
  add column if not exists transfer_account_id uuid references public.business_accounts(id) on delete set null;

create index if not exists idx_btx_account on public.business_transactions(account_id);

-- Allow the 'transfer' kind (account -> account movement, net zero).
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.business_transactions'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%kind%';
  if cname is not null then
    execute format('alter table public.business_transactions drop constraint %I', cname);
  end if;
end $$;

alter table public.business_transactions
  add constraint business_transactions_kind_check
  check (kind in ('investment','earning','expense','profit_distribution','transfer'));
