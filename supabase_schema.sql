
-- 1. EXTENSIONS & SEARCH PATH
create extension if not exists "uuid-ossp" with schema extensions;
grant usage on schema extensions to anon, authenticated;

-- 2. CORE TABLES
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  country text default 'Nigeria',
  timezone text default 'Africa/Lagos',
  plan text check (plan in ('free', 'pro')) default 'free',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.subscriptions (
  id uuid default extensions.uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  plan text not null default 'free',
  status text not null default 'active',
  current_period_end timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.tasks (
  id uuid default extensions.uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  due_at timestamp with time zone,
  priority text check (priority in ('low', 'medium', 'high')) default 'medium',
  status text check (status in ('todo', 'doing', 'done')) default 'todo',
  recurring_rule text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.events (
  id uuid default extensions.uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  start_at timestamp with time zone not null,
  end_at timestamp with time zone not null,
  location text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.notes (
  id uuid default extensions.uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  content text not null,
  tags text[],
  scheduled_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.assistant_actions (
  id uuid default extensions.uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  action_type text not null,
  input_payload jsonb,
  result_payload jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.drafts (
  id uuid default extensions.uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  channel text not null,
  recipient text,
  subject text,
  body text not null,
  status text default 'draft',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. PERMISSIONS & RLS
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.tasks enable row level security;
alter table public.events enable row level security;
alter table public.notes enable row level security;
alter table public.assistant_actions enable row level security;
alter table public.drafts enable row level security;

-- Global grants
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;

-- RLS Policies (Idempotent)
do $$ 
begin
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'Users can access own profile') then
    create policy "Users can access own profile" on public.profiles for all using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'subscriptions' and policyname = 'Users can access own subscriptions') then
    create policy "Users can access own subscriptions" on public.subscriptions for all using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'tasks' and policyname = 'Users can access own tasks') then
    create policy "Users can access own tasks" on public.tasks for all using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'events' and policyname = 'Users can access own events') then
    create policy "Users can access own events" on public.events for all using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'notes' and policyname = 'Users can access own notes') then
    create policy "Users can access own notes" on public.notes for all using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'assistant_actions' and policyname = 'Users can access own actions') then
    create policy "Users can access own actions" on public.assistant_actions for all using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'drafts' and policyname = 'Users can access own drafts') then
    create policy "Users can access own drafts" on public.drafts for all using (auth.uid() = user_id);
  end if;
end $$;

-- 4. ATOMIC AUTH TRIGGER
create or replace function public.handle_new_user()
returns trigger 
language plpgsql 
security definer 
set search_path = public, auth, extensions
as $$
begin
  insert into public.profiles (id, full_name, plan)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'New User'), 
    'free'
  )
  on conflict (id) do nothing;

  insert into public.subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
