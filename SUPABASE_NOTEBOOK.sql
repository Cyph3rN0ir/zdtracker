-- =====================================================================
-- ZeroSync — Personal Notebook (notes + todos + lists)
-- All access is via service_role (server functions). RLS enabled defensively.
-- =====================================================================

create table if not exists public.note_lists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.app_users(id) on delete cascade,
  title       text not null,
  color       text not null default '#6366f1',
  icon        text not null default 'notebook',
  sort_order  int  not null default 0,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_note_lists_user on public.note_lists(user_id, archived_at, sort_order);

create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.app_users(id) on delete cascade,
  list_id     uuid references public.note_lists(id) on delete set null,
  title       text not null default '',
  body_md     text not null default '',
  pinned      boolean not null default false,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_notes_user on public.notes(user_id, archived_at, updated_at desc);
create index if not exists idx_notes_list on public.notes(list_id);
create index if not exists idx_notes_pinned on public.notes(user_id, pinned);

create table if not exists public.todos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.app_users(id) on delete cascade,
  list_id     uuid references public.note_lists(id) on delete set null,
  note_id     uuid references public.notes(id) on delete cascade,
  title       text not null,
  details     text not null default '',
  due_date    date,
  done_at     timestamptz,
  priority    smallint not null default 0,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_todos_user_due on public.todos(user_id, due_date);
create index if not exists idx_todos_user_list on public.todos(user_id, list_id);
create index if not exists idx_todos_done on public.todos(user_id, done_at);

alter table public.note_lists enable row level security;
alter table public.notes enable row level security;
alter table public.todos enable row level security;

grant select, insert, update, delete on public.note_lists to authenticated;
grant select, insert, update, delete on public.notes to authenticated;
grant select, insert, update, delete on public.todos to authenticated;
grant all on public.note_lists, public.notes, public.todos to service_role;
