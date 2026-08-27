-- CLEAN RESET — drop everything and recreate without recursion
-- Run this in Supabase SQL Editor if you get "invalid or incompatible" errors

-- =====================================================
-- STEP 1: DROP ALL EXISTING POLICIES
-- =====================================================
-- Profiles
drop policy if exists "profiles are viewable by any logged-in user" on profiles;
drop policy if exists "users can update their own profile" on profiles;
drop policy if exists "users can insert their own profile" on profiles;

-- Chats
drop policy if exists "members can view their chats" on chats;
drop policy if exists "authenticated users can create chats" on chats;

-- Chat members
drop policy if exists "members can view chat membership" on chat_members;
drop policy if exists "users can join chats (insert own membership)" on chat_members;
drop policy if exists "creator can add members when creating a chat" on chat_members;

-- Messages
drop policy if exists "members can view messages in their chats" on messages;
drop policy if exists "members can send messages in their chats" on messages;

-- Posts
drop policy if exists "any authenticated user can view all posts" on posts;
drop policy if exists "users can create their own posts" on posts;
drop policy if exists "users can delete their own posts" on posts;

-- Groups
drop policy if exists "authenticated users can look up groups by code" on groups;
drop policy if exists "chat creator can attach invite code" on groups;

-- Storage
drop policy if exists "avatars are publicly readable" on storage.objects;
drop policy if exists "users can upload their own avatar files" on storage.objects;
drop policy if exists "users can delete their own avatar files" on storage.objects;
drop policy if exists "post images are publicly readable" on storage.objects;
drop policy if exists "users can upload their own post images" on storage.objects;
drop policy if exists "users can delete their own post images" on storage.objects;
drop policy if exists "chat members can read chat media" on storage.objects;
drop policy if exists "chat members can upload chat media" on storage.objects;

-- =====================================================
-- STEP 2: DROP AND RECREATE FUNCTION
-- =====================================================
drop function if exists is_chat_member(uuid);
drop function if exists delete_expired_messages();
drop trigger if exists trg_avatar_limit on profiles;
drop function if exists enforce_avatar_limit();

-- =====================================================
-- STEP 3: CREATE HELPER FUNCTIONS
-- =====================================================

-- Security definer: checks chat membership without triggering RLS recursion
create or replace function is_chat_member(chat_uuid uuid)
returns boolean as $$
  select exists (
    select 1 from chat_members
    where chat_id = chat_uuid and user_id = auth.uid()
  );
$$ language sql security definer;

-- Avatar limit trigger
create or replace function enforce_avatar_limit()
returns trigger as $$
begin
  if array_length(new.avatar_urls, 1) is not null and array_length(new.avatar_urls, 1) > 3 then
    raise exception 'Maximum 3 profile pictures allowed';
  end if;
  return new;
end;
$$ language plpgsql;

-- Expired message cleanup
create or replace function delete_expired_messages()
returns void as $$
begin
  delete from messages where expires_at < now();
end;
$$ language plpgsql security definer;

-- =====================================================
-- STEP 4: CREATE ALL POLICIES (NO RECURSION)
-- =====================================================

-- PROFILES
create policy "profiles_select_auth"
  on profiles for select
  using (auth.role() = 'authenticated');

create policy "profiles_update_own"
  on profiles for update
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on profiles for insert
  with check (auth.uid() = id);

-- CHATS
create policy "chats_select_members"
  on chats for select
  using (is_chat_member(id));

create policy "chats_insert_creator"
  on chats for insert
  with check (auth.uid() = created_by);

-- CHAT_MEMBERS
create policy "chat_members_select"
  on chat_members for select
  using (is_chat_member(chat_id));

create policy "chat_members_insert_self"
  on chat_members for insert
  with check (auth.uid() = user_id);

-- MESSAGES
create policy "messages_select"
  on messages for select
  using (is_chat_member(chat_id));

create policy "messages_insert"
  on messages for insert
  with check (
    auth.uid() = sender_id
    and is_chat_member(chat_id)
  );

-- POSTS
create policy "posts_select"
  on posts for select
  using (auth.role() = 'authenticated');

create policy "posts_insert_own"
  on posts for insert
  with check (auth.uid() = user_id);

create policy "posts_delete_own"
  on posts for delete
  using (auth.uid() = user_id);

-- GROUPS
create policy "groups_select"
  on groups for select
  using (auth.role() = 'authenticated');

create policy "groups_insert"
  on groups for insert
  with check (
    exists (select 1 from chats where id = chat_id and created_by = auth.uid())
  );

-- STORAGE: Avatars
create policy "avatars_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_delete"
  on storage.objects for delete
  using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- STORAGE: Post images
create policy "post_images_read"
  on storage.objects for select
  using (bucket_id = 'post-images');

create policy "post_images_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "post_images_delete"
  on storage.objects for delete
  using (
    bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- STORAGE: Chat media (uses security definer function = no recursion)
create policy "chat_media_read"
  on storage.objects for select
  using (
    bucket_id = 'chat-media'
    and is_chat_member((storage.foldername(name))[1]::uuid)
  );

create policy "chat_media_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'chat-media'
    and is_chat_member((storage.foldername(name))[1]::uuid)
  );

-- =====================================================
-- STEP 5: RECREATE TRIGGER
-- =====================================================
drop trigger if exists trg_avatar_limit on profiles;
create trigger trg_avatar_limit
  before insert or update on profiles
  for each row execute function enforce_avatar_limit();

-- =====================================================
-- DONE — All policies use is_chat_member() = NO recursion
-- =====================================================
