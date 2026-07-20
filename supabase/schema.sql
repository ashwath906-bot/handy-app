-- Handy APP — Supabase schema
-- Run this once in the Supabase SQL editor (Database > SQL editor > New query).

create extension if not exists "pgcrypto";

create table if not exists handy_households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists handy_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references handy_households(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists handy_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references handy_households(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists handy_list_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references handy_households(id) on delete cascade,
  list_id uuid not null references handy_lists(id) on delete cascade,
  content text not null,
  done boolean not null default false,
  added_by uuid references handy_members(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists handy_reminders (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references handy_households(id) on delete cascade,
  content text not null,
  due_at timestamptz not null,
  done boolean not null default false,
  added_by uuid references handy_members(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists handy_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references handy_households(id) on delete cascade,
  title text not null,
  event_date date not null,
  event_time text,
  location text,
  notes text,
  list_id uuid references handy_lists(id) on delete set null,
  added_by uuid references handy_members(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_members_household on handy_members(household_id);
create index if not exists idx_lists_household on handy_lists(household_id);
create index if not exists idx_items_household on handy_list_items(household_id);
create index if not exists idx_reminders_household on handy_reminders(household_id);
create index if not exists idx_events_household on handy_events(household_id);

-- Row level security: open to the anon key.
-- Access control relies on the household id being an unguessable UUID
-- that only your family knows. Fine for a family list app; do not store
-- sensitive data here. See README for a hardening path with Supabase Auth.
alter table handy_households enable row level security;
alter table handy_members enable row level security;
alter table handy_lists enable row level security;
alter table handy_list_items enable row level security;
alter table handy_reminders enable row level security;
alter table handy_events enable row level security;

create policy "anon full access" on handy_households for all to anon using (true) with check (true);
create policy "anon full access" on handy_members for all to anon using (true) with check (true);
create policy "anon full access" on handy_lists for all to anon using (true) with check (true);
create policy "anon full access" on handy_list_items for all to anon using (true) with check (true);
create policy "anon full access" on handy_reminders for all to anon using (true) with check (true);
create policy "anon full access" on handy_events for all to anon using (true) with check (true);

-- Realtime: broadcast row changes so every family member's app updates live.
alter publication supabase_realtime add table handy_members;
alter publication supabase_realtime add table handy_lists;
alter publication supabase_realtime add table handy_list_items;
alter publication supabase_realtime add table handy_reminders;
alter publication supabase_realtime add table handy_events;
