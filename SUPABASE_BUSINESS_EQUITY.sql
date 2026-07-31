-- Business equity ownership: percentage of the company each member holds.
-- Run this once in the Supabase SQL editor.

alter table public.business_members
  add column if not exists equity_percent numeric(7,3) not null default 0
  check (equity_percent >= 0 and equity_percent <= 100);
