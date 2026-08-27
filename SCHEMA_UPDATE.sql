-- ============================================================
-- SCHEMA UPDATE — Run this in Supabase SQL Editor after schema.sql
-- ============================================================

-- 1. NOTIFICATIONS TABLE
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  from_user_id uuid references profiles(id) on delete cascade,
  type text not null check (type in ('mention_post', 'mention_chat')),
  ref_id uuid not null,
  read boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_notifications_user on notifications(user_id, read);
alter table notifications enable row level security;

create policy "users can view their own notifications"
  on notifications for select
  using (auth.uid() = user_id);

create policy "users can create notifications"
  on notifications for insert
  with check (auth.uid() = from_user_id);

create policy "users can mark own notifications read"
  on notifications for update
  using (auth.uid() = user_id);

-- 2. ACCESS CODE for profiles
alter table profiles add column if not exists access_code text unique;

-- 3. POST LIKES
create table if not exists post_likes (
  post_id uuid references posts(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

alter table post_likes enable row level security;

create policy "anyone can view likes"
  on post_likes for select
  using (auth.role() = 'authenticated');

create policy "users can like posts"
  on post_likes for insert
  with check (auth.uid() = user_id);

create policy "users can unlike posts"
  on post_likes for delete
  using (auth.uid() = user_id);

-- 4. POST EXPIRY support (nullable expires_at)
alter table posts add column if not exists expires_at timestamptz;

-- 5. CHAT PINS (stored as metadata in chats table)
alter table chats add column if not exists pinned boolean default false;

-- 6. Messages: add 'job' type support
-- (existing check constraint needs updating)
alter table messages drop constraint if exists messages_type_check;
alter table messages add constraint messages_type_check check (type in ('text', 'image', 'video', 'job'));
