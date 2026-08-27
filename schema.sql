-- ALEX-CHAT DATABASE SCHEMA
-- Run this whole file in the Supabase SQL Editor (Project -> SQL Editor -> New query).
-- Requires: pg_cron and pg_net extensions (enable in Database -> Extensions).

-- =========================================================
-- EXTENSIONS
-- =========================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- =========================================================
-- PROFILES
-- =========================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  bio text default '',
  avatar_urls text[] default '{}',  -- max 3, enforced by trigger below
  created_at timestamptz default now()
);

-- enforce max 3 avatar images per profile
create or replace function enforce_avatar_limit()
returns trigger as $$
begin
  if array_length(new.avatar_urls, 1) is not null and array_length(new.avatar_urls, 1) > 3 then
    raise exception 'Maximum 3 profile pictures allowed';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_avatar_limit on profiles;
create trigger trg_avatar_limit
  before insert or update on profiles
  for each row execute function enforce_avatar_limit();

alter table profiles enable row level security;

create policy "profiles are viewable by any logged-in user"
  on profiles for select
  using (auth.role() = 'authenticated');

create policy "users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

create policy "users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

-- =========================================================
-- CHATS (covers both 1:1 and group — is_group flag distinguishes)
-- =========================================================
create table if not exists chats (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  name text,              -- only used for groups
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists chat_members (
  chat_id uuid references chats(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (chat_id, user_id)
);

alter table chats enable row level security;
alter table chat_members enable row level security;

create policy "members can view their chats"
  on chats for select
  using (
    id in (select chat_id from chat_members where user_id = auth.uid())
  );

create policy "authenticated users can create chats"
  on chats for insert
  with check (auth.uid() = created_by);

create policy "members can view chat membership"
  on chat_members for select
  using (
    chat_id in (select chat_id from chat_members where user_id = auth.uid())
  );

create policy "users can join chats (insert own membership)"
  on chat_members for insert
  with check (auth.uid() = user_id);

create policy "creator can add members when creating a chat"
  on chat_members for insert
  with check (
    auth.uid() = user_id
    or exists (select 1 from chats where id = chat_id and created_by = auth.uid())
  );

-- =========================================================
-- GROUPS — metadata for group chats (invite-code join flow).
-- A group is just a `chats` row with is_group = true; this table only adds
-- the invite code. Group messages live in the same `messages` table as DMs.
-- =========================================================
create table if not exists groups (
  chat_id uuid primary key references chats(id) on delete cascade,
  invite_code text unique not null,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

alter table groups enable row level security;

-- Any logged-in user can look up a group by invite code in order to join it.
create policy "authenticated users can look up groups by code"
  on groups for select
  using (auth.role() = 'authenticated');

create policy "chat creator can attach invite code"
  on groups for insert
  with check (
    exists (select 1 from chats where id = chat_id and created_by = auth.uid())
  );

-- =========================================================
-- MESSAGES — the core of the app. expires_at = created_at + 10 minutes.
-- =========================================================
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid references chats(id) on delete cascade,
  sender_id uuid references profiles(id),
  type text not null check (type in ('text', 'image', 'video')),
  content text,           -- text body, or null for media
  media_url text,         -- storage path, or null for text
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);

create index if not exists idx_messages_chat_id on messages(chat_id);
create index if not exists idx_messages_expires_at on messages(expires_at);

alter table messages enable row level security;

create policy "members can view messages in their chats"
  on messages for select
  using (
    chat_id in (select chat_id from chat_members where user_id = auth.uid())
  );

create policy "members can send messages in their chats"
  on messages for insert
  with check (
    auth.uid() = sender_id
    and chat_id in (select chat_id from chat_members where user_id = auth.uid())
  );

-- =========================================================
-- POSTS — public, permanent, image-only feed
-- =========================================================
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  image_url text not null,
  caption text default '',
  created_at timestamptz default now()
);

alter table posts enable row level security;

create policy "any authenticated user can view all posts"
  on posts for select
  using (auth.role() = 'authenticated');

create policy "users can create their own posts"
  on posts for insert
  with check (auth.uid() = user_id);

create policy "users can delete their own posts"
  on posts for delete
  using (auth.uid() = user_id);

-- =========================================================
-- EXPIRY CLEANUP
-- =========================================================
-- This function deletes expired message ROWS. It does NOT delete the actual
-- files in Storage (SQL can't call the Storage API directly). File deletion
-- must happen in the Edge Function described in supabase/functions/cleanup-expired/
-- — that function should:
--   1. select id, media_url from messages where expires_at < now() and media_url is not null
--   2. delete those files from the `chat-media` bucket via the Storage API
--   3. then delete the expired rows (or call this SQL function)
create or replace function delete_expired_messages()
returns void as $$
begin
  delete from messages where expires_at < now();
end;
$$ language plpgsql security definer;

-- Primary cleanup path: call the `cleanup-expired` Edge Function every
-- minute. It deletes the Storage files for expired media messages FIRST,
-- then deletes the DB rows (media + text) — so a file is never orphaned in
-- Storage. Replace <PROJECT_REF> and <ANON_OR_SERVICE_KEY> after deploying
-- the function (see supabase/functions/cleanup-expired/index.ts and the
-- README for the exact `supabase functions deploy` + secret-setting steps).
select cron.schedule(
  'cleanup-expired-messages',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://vnlebfnwxyqfceurxhwq.functions.supabase.co/cleanup-expired',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZubGViZm53eHlxZmNldXJ4aHdxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzgzODY5OCwiZXhwIjoyMTAzNDE0Njk4fQ.xW0awPzV63dYBkOl5Hn2S9NXauW8_XwqKYAV68VaXUE'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Safety-net fallback (rare case: Edge Function invocation fails/times out
-- for a stretch) — sweeps any leftover expired rows every 5 minutes so text
-- messages never linger even if the function above has an outage. This only
-- deletes DB rows; it never touches Storage, so it will NOT orphan-delete a
-- media row before its file is cleaned up faster than it runs.
select cron.schedule(
  'delete-expired-messages-fallback',
  '*/5 * * * *',
  $$ select delete_expired_messages(); $$
);

-- =========================================================
-- STORAGE BUCKETS
-- Create these in Supabase Dashboard -> Storage (or via SQL below):
--   avatars      (public read, owner write)
--   chat-media   (private-ish: readable only by chat members — enforce via
--                 signed URLs generated server-side, not a public bucket)
--   post-images  (public read, owner write)
-- =========================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', false)
on conflict (id) do nothing;

-- =========================================================
-- STORAGE POLICIES
-- Buckets with public=true still need SELECT/INSERT policies on
-- storage.objects, or authenticated clients get "not authorized" on upload.
-- Convention: object path always starts with the uploader's user id, e.g.
-- `${user.id}/${filename}` — this lets policies check ownership via the
-- first path segment (storage.foldername(name))[1].
-- =========================================================

-- avatars: public read, owner-only write, max-3 enforced in app layer + trigger above
create policy "avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "users can upload their own avatar files"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can delete their own avatar files"
  on storage.objects for delete
  using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- post-images: public read (feed is public to any logged-in user), owner-only write
create policy "post images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'post-images');

create policy "users can upload their own post images"
  on storage.objects for insert
  with check (
    bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can delete their own post images"
  on storage.objects for delete
  using (
    bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- chat-media: private bucket. Object path convention: `${chat_id}/${filename}`.
-- Only members of that chat may read or upload; access is via short-lived
-- signed URLs generated server/client-side, never a public URL.
create policy "chat members can read chat media"
  on storage.objects for select
  using (
    bucket_id = 'chat-media'
    and (storage.foldername(name))[1]::uuid in (
      select chat_id from chat_members where user_id = auth.uid()
    )
  );

create policy "chat members can upload chat media"
  on storage.objects for insert
  with check (
    bucket_id = 'chat-media'
    and (storage.foldername(name))[1]::uuid in (
      select chat_id from chat_members where user_id = auth.uid()
    )
  );

-- Deletion of chat-media files happens via the cleanup-expired Edge Function
-- using the service_role key (bypasses RLS), not by end users directly.
