-- FIX: infinite recursion on chat_members RLS policy
-- Run this in Supabase SQL Editor

-- 1. Drop the recursive policies
drop policy if exists "members can view chat membership" on chat_members;
drop policy if exists "members can view their chats" on chats;
drop policy if exists "members can view messages in their chats" on messages;
drop policy if exists "members can send messages in their chats" on messages;
drop policy if exists "chat members can read chat media" on storage.objects;
drop policy if exists "chat members can upload chat media" on storage.objects;

-- 2. Create a SECURITY DEFINER function (bypasses RLS, runs as owner)
create or replace function is_chat_member(chat_uuid uuid)
returns boolean as $$
  select exists (
    select 1 from chat_members
    where chat_id = chat_uuid and user_id = auth.uid()
  );
$$ language sql security definer;

-- 3. Recreate policies using the function (no recursion)
create policy "members can view chat membership"
  on chat_members for select
  using (is_chat_member(chat_id));

create policy "members can view their chats"
  on chats for select
  using (is_chat_member(id));

create policy "members can view messages in their chats"
  on messages for select
  using (is_chat_member(chat_id));

create policy "members can send messages in their chats"
  on messages for insert
  with check (
    auth.uid() = sender_id
    and is_chat_member(chat_id)
  );

create policy "chat members can read chat media"
  on storage.objects for select
  using (
    bucket_id = 'chat-media'
    and is_chat_member((storage.foldername(name))[1]::uuid)
  );

create policy "chat members can upload chat media"
  on storage.objects for insert
  with check (
    bucket_id = 'chat-media'
    and is_chat_member((storage.foldername(name))[1]::uuid)
  );

-- Done! All policies now use security definer function = no recursion
