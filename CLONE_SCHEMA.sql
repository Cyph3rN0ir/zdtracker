-- =====================================================================
-- ZeroSync / ZeroTrack — COMPLETE DATABASE SNAPSHOT (structure only)
-- Generated from the live production database.
--
-- HOW TO USE (new Supabase project):
--   1. Supabase Dashboard -> SQL Editor -> New query
--   2. Paste this ENTIRE file and press Run
--   3. It is idempotent: safe to re-run.
--
-- Auth model: the app does NOT use Supabase Auth. It has its own
-- app_users table + cookie sessions, and the server talks to the DB with
-- the service_role key only. Therefore every table has RLS enabled with
-- NO anon/authenticated policies, and all privileges go to service_role.
-- Default admin login after running this file:  admin / 1234
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- TABLES
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  role text not null check (role in ('admin','owner','investor','member')),
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  role_in_business text not null check (role_in_business in ('owner','investor','member')),
  created_at timestamptz not null default now(),
  equity_percent numeric(7,3) not null default 0
    check (equity_percent >= 0 and equity_percent <= 100),
  unique (business_id, user_id, role_in_business)
);

create table if not exists public.business_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  type text not null check (type in ('cash','bank','wallet','card','investment','savings','other')),
  opening_balance numeric(14,2) not null default 0,
  currency text not null default 'BDT',
  archived boolean not null default false,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.business_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null check (kind in ('investment','earning','expense','profit_distribution','transfer')),
  amount numeric(14,2) not null check (amount >= 0),
  party_user_id uuid references public.app_users(id) on delete set null,
  note text not null default '',
  occurred_on date not null default current_date,
  created_at timestamptz not null default now(),
  account_id uuid references public.business_accounts(id) on delete set null,
  transfer_account_id uuid references public.business_accounts(id) on delete set null
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  assignee_user_id uuid not null references public.app_users(id) on delete cascade,
  title text not null,
  details text not null default '',
  due_date date not null,
  status text not null default 'pending' check (status in ('pending','done')),
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  remark text,
  remark_at timestamptz,
  remark_by uuid references public.app_users(id)
);

-- ----- Personal finance -----
create table if not exists public.personal_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.app_users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.personal_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.app_users(id) on delete cascade,
  profile_id uuid not null references public.personal_profiles(id) on delete cascade,
  name text not null,
  type text not null check (type in ('cash','bank','wallet','card','investment','savings','other')),
  opening_balance numeric(14,2) not null default 0,
  currency text not null default 'INR',
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.personal_categories (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.app_users(id) on delete cascade,
  profile_id uuid not null references public.personal_profiles(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('income','expense')),
  color text not null default '#6366f1',
  icon text not null default 'circle',
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.personal_counterparties (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.app_users(id) on delete cascade,
  profile_id uuid not null references public.personal_profiles(id) on delete cascade,
  name text not null,
  kind text not null default 'person' check (kind in ('person','vendor','employer','other')),
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.personal_loans (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.app_users(id) on delete cascade,
  profile_id uuid not null references public.personal_profiles(id) on delete cascade,
  direction text not null check (direction in ('i_owe','owed_to_me')),
  counterparty_id uuid references public.personal_counterparties(id) on delete set null,
  principal numeric(14,2) not null check (principal >= 0),
  interest_rate numeric(6,3) not null default 0,
  started_on date not null default current_date,
  due_on date,
  status text not null default 'open' check (status in ('open','closed')),
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.personal_budgets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.app_users(id) on delete cascade,
  profile_id uuid not null references public.personal_profiles(id) on delete cascade,
  name text not null,
  period text not null check (period in ('week','month')),
  amount numeric(14,2) not null check (amount >= 0),
  category_id uuid references public.personal_categories(id) on delete set null,
  start_date date not null default current_date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.personal_transactions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.app_users(id) on delete cascade,
  profile_id uuid not null references public.personal_profiles(id) on delete cascade,
  kind text not null check (kind in (
    'income','expense','transfer',
    'investment_buy','investment_sell',
    'savings_deposit','savings_withdraw',
    'loan_given','loan_taken',
    'repayment_in','repayment_out'
  )),
  amount numeric(14,2) not null check (amount >= 0),
  note text not null default '',
  occurred_on date not null default current_date,
  created_at timestamptz not null default now(),
  account_id uuid references public.personal_accounts(id) on delete set null,
  category_id uuid references public.personal_categories(id) on delete set null,
  counterparty_id uuid references public.personal_counterparties(id) on delete set null,
  transfer_account_id uuid references public.personal_accounts(id) on delete set null,
  linked_loan_id uuid references public.personal_loans(id) on delete set null
);

-- ----- Notebook (notes / lists / todos) -----
create table if not exists public.note_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  title text not null,
  color text not null default '#6366f1',
  icon text not null default 'notebook',
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  list_id uuid references public.note_lists(id) on delete set null,
  title text not null default '',
  body_md text not null default '',
  pinned boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  list_id uuid references public.note_lists(id) on delete set null,
  note_id uuid references public.notes(id) on delete cascade,
  title text not null,
  details text not null default '',
  due_date date,
  done_at timestamptz,
  priority smallint not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----- Chat -----
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null check (kind in ('group','direct')),
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid references public.app_users(id) on delete set null,
  body text not null check (char_length(body) >= 1 and char_length(body) <= 4000),
  reply_to_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ----- Web push -----
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- --------------------------------------------------------------- INDEXES
create index if not exists idx_baccts_business on public.business_accounts(business_id);
create index if not exists idx_btx_business on public.business_transactions(business_id);
create index if not exists idx_btx_kind on public.business_transactions(business_id, kind);
create index if not exists idx_btx_account on public.business_transactions(account_id);
create index if not exists idx_tasks_assignee on public.tasks(assignee_user_id, due_date);
create index if not exists idx_tasks_business on public.tasks(business_id, due_date);
create index if not exists idx_personal_owner on public.personal_profiles(owner_user_id);
create index if not exists idx_paccts_profile on public.personal_accounts(profile_id);
create index if not exists idx_pcats_profile on public.personal_categories(profile_id);
create index if not exists idx_pcps_profile on public.personal_counterparties(profile_id);
create index if not exists idx_ploans_profile on public.personal_loans(profile_id, status);
create index if not exists idx_pbudgets_profile on public.personal_budgets(profile_id, active);
create index if not exists idx_ptx_owner on public.personal_transactions(owner_user_id);
create index if not exists idx_ptx_profile on public.personal_transactions(profile_id);
create index if not exists idx_ptx_account on public.personal_transactions(account_id);
create index if not exists idx_ptx_category on public.personal_transactions(category_id);
create index if not exists idx_ptx_loan on public.personal_transactions(linked_loan_id);
create index if not exists idx_ptx_occurred_on on public.personal_transactions(profile_id, occurred_on desc);
create index if not exists idx_note_lists_user on public.note_lists(user_id, archived_at, sort_order);
create index if not exists idx_notes_user on public.notes(user_id, archived_at, updated_at desc);
create index if not exists idx_notes_list on public.notes(list_id);
create index if not exists idx_notes_pinned on public.notes(user_id, pinned);
create index if not exists idx_todos_user_due on public.todos(user_id, due_date);
create index if not exists idx_todos_user_list on public.todos(user_id, list_id);
create index if not exists idx_todos_done on public.todos(user_id, done_at);
create index if not exists conversation_members_user_idx on public.conversation_members(user_id);
create index if not exists messages_conv_created_idx on public.messages(conversation_id, created_at desc);
create unique index if not exists conversations_one_group_per_business
  on public.conversations(business_id) where (kind = 'group');
create index if not exists push_subs_user_idx on public.push_subscriptions(user_id);

-- ------------------------------------------- FUNCTIONS + TRIGGERS (chat)
create or replace function public.chat_create_group_conversation_for_business()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare conv_id uuid;
begin
  insert into public.conversations (business_id, kind)
  values (new.id, 'group') returning id into conv_id;
  if new.created_by is not null then
    insert into public.conversation_members (conversation_id, user_id)
    values (conv_id, new.created_by) on conflict do nothing;
  end if;
  return new;
end; $$;

create or replace function public.chat_sync_business_member_insert()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare conv_id uuid;
begin
  select id into conv_id from public.conversations
    where business_id = new.business_id and kind = 'group';
  if conv_id is null then
    insert into public.conversations (business_id, kind)
    values (new.business_id, 'group') returning id into conv_id;
  end if;
  insert into public.conversation_members (conversation_id, user_id)
  values (conv_id, new.user_id) on conflict do nothing;
  return new;
end; $$;

create or replace function public.chat_sync_business_member_delete()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare conv_id uuid;
begin
  select id into conv_id from public.conversations
    where business_id = old.business_id and kind = 'group';
  if conv_id is not null then
    delete from public.conversation_members
    where conversation_id = conv_id and user_id = old.user_id;
  end if;
  return old;
end; $$;

drop trigger if exists trg_chat_business_insert on public.businesses;
create trigger trg_chat_business_insert after insert on public.businesses
for each row execute function public.chat_create_group_conversation_for_business();

drop trigger if exists trg_chat_member_insert on public.business_members;
create trigger trg_chat_member_insert after insert on public.business_members
for each row execute function public.chat_sync_business_member_insert();

drop trigger if exists trg_chat_member_delete on public.business_members;
create trigger trg_chat_member_delete after delete on public.business_members
for each row execute function public.chat_sync_business_member_delete();

-- ------------------------------------------------------- RLS + PRIVILEGES
do $$
declare t text;
begin
  foreach t in array array[
    'app_users','businesses','business_members','business_accounts',
    'business_transactions','tasks',
    'personal_profiles','personal_accounts','personal_categories',
    'personal_counterparties','personal_loans','personal_budgets',
    'personal_transactions',
    'note_lists','notes','todos',
    'conversations','conversation_members','messages',
    'push_subscriptions'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- Explicit deny-all policies on chat tables (defence in depth; the
-- service_role bypasses RLS, everyone else gets nothing).
do $$
declare t text;
begin
  foreach t in array array['conversations','conversation_members','messages'] loop
    execute format('drop policy if exists "deny all" on public.%I', t);
    execute format('create policy "deny all" on public.%I for all using (false)', t);
  end loop;
end $$;

-- ------------------------------------------------------------ SEED ADMIN
-- bcrypt(1234, cost 10) — CHANGE THIS PASSWORD AFTER FIRST LOGIN.
insert into public.app_users (username, password_hash, role, display_name)
values ('admin', '$2b$10$iF4o1Y0zHri2Wybd2T/g6en7jkXnrWeOI/8AhPLcTG28rAnjAD2RK', 'admin', 'Administrator')
on conflict (username) do nothing;

-- Done. 20 tables, 3 trigger functions, 3 triggers, RLS locked to service_role.
