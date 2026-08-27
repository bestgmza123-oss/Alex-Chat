-- ============================================================
-- FINAL SETUP — รันไฟล์นี้ไฟล์เดียวจบ!
-- หลังจาก CLEAN_RESET.sql แล้ว
-- ============================================================

-- 1. AVATAR TRIGGER (ถูก drop ไปตอน reset)
drop trigger if exists trg_avatar_limit on profiles;
create trigger trg_avatar_limit
  before insert or update on profiles
  for each row execute function enforce_avatar_limit();

-- 2. NOTIFICATIONS TABLE
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

-- 3. ACCESS CODE for profiles
alter table profiles add column if not exists access_code text unique;

-- 4. POST LIKES
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

-- 5. POST EXPIRY support
alter table posts add column if not exists expires_at timestamptz;

-- 6. CHAT PINS
alter table chats add column if not exists pinned boolean default false;

-- 7. Messages: add 'job' type
alter table messages drop constraint if exists messages_type_check;
alter table messages add constraint messages_type_check check (type in ('text', 'image', 'video', 'job'));

-- DONE!
