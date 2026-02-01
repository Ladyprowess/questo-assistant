
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Profiles
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  country text default 'Nigeria',
  timezone text default 'Africa/Lagos',
  plan text check (plan in ('free', 'pro')) default 'free',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Tasks
create table tasks (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  description text,
  due_at timestamp with time zone,
  priority text check (priority in ('low', 'medium', 'high')) default 'medium',
  status text check (status in ('todo', 'doing', 'done')) default 'todo',
  recurring_rule text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Events
create table events (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  description text,
  start_at timestamp with time zone not null,
  end_at timestamp with time zone not null,
  location text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Notes
create table notes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  content text not null,
  tags text[],
  scheduled_at timestamp with time zone, -- Added time for notes
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Reminders
create table reminders (
  id uuid default uuid_generate_v4() primary key,
  user_id references profiles(id) on delete cascade not null,
  type text check (type in ('task', 'event', 'custom')) not null,
  reference_id uuid,
  remind_at timestamp with time zone not null,
  status text check (status in ('scheduled', 'sent', 'cancelled')) default 'scheduled',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Drafts
create table drafts (
  id uuid default uuid_generate_v4() primary key,
  user_id references profiles(id) on delete cascade not null,
  channel text check (channel in ('email', 'message')) not null,
  recipient text,
  subject text,
  body text not null,
  status text check (status in ('draft', 'approved', 'cancelled')) default 'draft',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Assistant Actions (Audit Log)
create table assistant_actions (
  id uuid default uuid_generate_v4() primary key,
  user_id references profiles(id) on delete cascade not null,
  action_type text not null,
  input_payload jsonb,
  result_payload jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. Subscriptions
create table subscriptions (
  id uuid default uuid_generate_v4() primary key,
  user_id references profiles(id) on delete cascade not null,
  provider text check (provider in ('paystack', 'paypal')),
  plan text check (plan in ('pro')) default 'pro',
  status text check (status in ('active', 'inactive', 'cancelled')) default 'active',
  current_period_end timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. Payments
create table payments (
  id uuid default uuid_generate_v4() primary key,
  user_id references profiles(id) on delete cascade not null,
  provider text check (provider in ('paystack', 'paypal')) not null,
  reference text unique not null,
  amount integer not null,
  currency text not null,
  status text check (status in ('pending', 'success', 'failed')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table profiles enable row level security;
alter table tasks enable row level security;
alter table events enable row level security;
alter table notes enable row level security;
alter table reminders enable row level security;
alter table drafts enable row level security;
alter table assistant_actions enable row level security;
alter table subscriptions enable row level security;
alter table payments enable row level security;

-- RLS Policies
create policy "Owner can access profile" on profiles for all using (auth.uid() = id);
create policy "Owner can access tasks" on tasks for all using (auth.uid() = user_id);
create policy "Owner can access events" on events for all using (auth.uid() = user_id);
create policy "Owner can access notes" on notes for all using (auth.uid() = user_id);
create policy "Owner can access reminders" on reminders for all using (auth.uid() = user_id);
create policy "Owner can access drafts" on drafts for all using (auth.uid() = user_id);
create policy "Owner can access assistant_actions" on assistant_actions for all using (auth.uid() = user_id);
create policy "Owner can access subscriptions" on subscriptions for all using (auth.uid() = user_id);
create policy "Owner can access payments" on payments for all using (auth.uid() = user_id);
