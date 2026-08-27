-- ============================================================
-- NUCLEAR FIX — รันไฟล์นี้ไฟล์เดียวจบ ทุกปัญหา!
-- ============================================================

-- DROP ALL old policies on EVERY table
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- DROP storage policies that depend on is_chat_member
DROP POLICY IF EXISTS "chat_media_read" ON storage.objects;
DROP POLICY IF EXISTS "chat_media_insert" ON storage.objects;

-- DROP old functions
DROP TRIGGER IF EXISTS trg_avatar_limit ON profiles;
DROP FUNCTION IF EXISTS is_chat_member(uuid) CASCADE;
DROP FUNCTION IF EXISTS enforce_avatar_limit();
DROP FUNCTION IF EXISTS delete_expired_messages();

-- ============================================================
-- FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION is_chat_member(chat_uuid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM chat_members WHERE chat_id = chat_uuid AND user_id = auth.uid());
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION enforce_avatar_limit()
RETURNS trigger AS $$
BEGIN
  IF array_length(new.avatar_urls, 1) IS NOT NULL AND array_length(new.avatar_urls, 1) > 3 THEN
    RAISE EXCEPTION 'Maximum 3 profile pictures allowed';
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_avatar_limit
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION enforce_avatar_limit();

-- ============================================================
-- POLICIES — simple, permissive, no recursion
-- ============================================================

-- PROFILES: anyone logged in can read, owner can write
CREATE POLICY "p_profiles_select" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "p_profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "p_profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- CHATS: authenticated can read own, authenticated can create
CREATE POLICY "p_chats_select" ON chats FOR SELECT USING (is_chat_member(id));
CREATE POLICY "p_chats_insert" ON chats FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- CHAT_MEMBERS: members can read, authenticated can insert
CREATE POLICY "p_cm_select" ON chat_members FOR SELECT USING (is_chat_member(chat_id));
CREATE POLICY "p_cm_insert" ON chat_members FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- MESSAGES: members can read, authenticated can send
CREATE POLICY "p_msgs_select" ON messages FOR SELECT USING (is_chat_member(chat_id));
CREATE POLICY "p_msgs_insert" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id AND is_chat_member(chat_id));

-- POSTS: anyone can read, authenticated can create/delete own
CREATE POLICY "p_posts_select" ON posts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "p_posts_insert" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "p_posts_delete" ON posts FOR DELETE USING (auth.uid() = user_id);

-- GROUPS: anyone can read, authenticated can create
CREATE POLICY "p_groups_select" ON groups FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "p_groups_insert" ON groups FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- NOTIFICATIONS
CREATE POLICY "p_notif_select" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "p_notif_insert" ON notifications FOR INSERT WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "p_notif_update" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- POST LIKES
CREATE POLICY "p_likes_select" ON post_likes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "p_likes_insert" ON post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "p_likes_delete" ON post_likes FOR DELETE USING (auth.uid() = user_id);

-- STORAGE
CREATE POLICY "p_stor_av_read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "p_stor_av_ins" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "p_stor_av_del" ON storage.objects FOR DELETE USING (bucket_id = 'avatars');
CREATE POLICY "p_stor_pi_read" ON storage.objects FOR SELECT USING (bucket_id = 'post-images');
CREATE POLICY "p_stor_pi_ins" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'post-images');
CREATE POLICY "p_stor_pi_del" ON storage.objects FOR DELETE USING (bucket_id = 'post-images');
CREATE POLICY "p_stor_cm_read" ON storage.objects FOR SELECT USING (bucket_id = 'chat-media');
CREATE POLICY "p_stor_cm_ins" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat-media');

-- ============================================================
-- SCHEMA UPDATES
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  from_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('mention_post', 'mention_chat')),
  ref_id uuid NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);

CREATE TABLE IF NOT EXISTS post_likes (
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS access_code text UNIQUE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE posts ALTER COLUMN image_url DROP NOT NULL;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS pinned boolean DEFAULT false;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_type_check CHECK (type IN ('text', 'image', 'video', 'job'));

-- ============================================================
-- DONE! ✅
-- ============================================================
