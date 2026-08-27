-- ============================================================
-- FINAL SQL — รันไฟล์นี้ไฟล์เดียวจบใน Supabase SQL Editor
-- ============================================================

-- STEP 1: Enable realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE messages; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE posts; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE notifications; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- STEP 2: Fix schema
ALTER TABLE posts ALTER COLUMN expires_at DROP NOT NULL;
ALTER TABLE posts ALTER COLUMN image_url DROP NOT NULL;

-- Groups: add columns
ALTER TABLE groups ADD COLUMN IF NOT EXISTS leader_id uuid REFERENCES profiles(id);
ALTER TABLE groups ADD COLUMN IF NOT EXISTS capacity integer DEFAULT 0;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS is_recruiting boolean DEFAULT false;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS group_pin text;

-- Chats: add pinned
ALTER TABLE chats ADD COLUMN IF NOT EXISTS pinned boolean DEFAULT false;

-- Posts: add job board fields
ALTER TABLE posts ADD COLUMN IF NOT EXISTS post_type text DEFAULT 'text';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS group_link uuid REFERENCES chats(id);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS requirements text;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS contact_info text;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS slot_total integer DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS slot_filled integer DEFAULT 0;

-- Profiles: add access_code
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS access_code text UNIQUE;

-- Messages: update type check
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_type_check CHECK (type IN ('text', 'image', 'video', 'job'));

-- Notifications table
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

-- Post likes table
CREATE TABLE IF NOT EXISTS post_likes (
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

-- STEP 3: Make posts globally visible
DROP POLICY IF EXISTS p_post_sel ON posts;
CREATE POLICY p_post_sel ON posts FOR SELECT USING (true);

-- STEP 4: RPC FUNCTIONS (bypass RLS)

-- Create chat + add creator
CREATE OR REPLACE FUNCTION create_chat_with_member(p_created_by uuid, p_is_group boolean, p_name text DEFAULT NULL)
RETURNS uuid AS $$ DECLARE v_id uuid; BEGIN
  INSERT INTO chats (created_by, is_group, name) VALUES (p_created_by, p_is_group, p_name) RETURNING id INTO v_id;
  INSERT INTO chat_members (chat_id, user_id) VALUES (v_id, p_created_by);
  RETURN v_id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Join chat
CREATE OR REPLACE FUNCTION join_chat(p_chat_id uuid, p_user_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO chat_members (chat_id, user_id) VALUES (p_chat_id, p_user_id) ON CONFLICT DO NOTHING;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create group with member + invite code = name
CREATE OR REPLACE FUNCTION create_group_with_member(p_created_by uuid, p_name text, p_invite_code text)
RETURNS uuid AS $$ DECLARE v_id uuid; BEGIN
  INSERT INTO chats (created_by, is_group, name) VALUES (p_created_by, true, p_name) RETURNING id INTO v_id;
  INSERT INTO chat_members (chat_id, user_id) VALUES (v_id, p_created_by);
  INSERT INTO groups (chat_id, invite_code, created_by, leader_id) VALUES (v_id, p_invite_code, p_created_by, p_created_by);
  RETURN v_id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Join group by name
CREATE OR REPLACE FUNCTION join_group_by_name(p_group_name text, p_user_id uuid)
RETURNS jsonb AS $$ DECLARE v_chat_id uuid; v_cap int; v_rec boolean; v_cnt int; BEGIN
  SELECT c.id, g.capacity, g.is_recruiting INTO v_chat_id, v_cap, v_rec
  FROM chats c JOIN groups g ON g.chat_id = c.id WHERE c.name = p_group_name AND c.is_group = true;
  IF v_chat_id IS NULL THEN RETURN jsonb_build_object('error', 'Group not found'); END IF;
  SELECT count(*) INTO v_cnt FROM chat_members WHERE chat_id = v_chat_id;
  IF v_rec AND v_cap > 0 AND v_cnt >= v_cap THEN RETURN jsonb_build_object('error', 'Group is full'); END IF;
  INSERT INTO chat_members (chat_id, user_id) VALUES (v_chat_id, p_user_id) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('chat_id', v_chat_id);
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kick member (leader only)
CREATE OR REPLACE FUNCTION kick_member(p_chat_id uuid, p_leader_id uuid, p_target_id uuid)
RETURNS void AS $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM groups WHERE chat_id = p_chat_id AND leader_id = p_leader_id) THEN
    RAISE EXCEPTION 'Only group leader can kick members';
  END IF;
  DELETE FROM chat_members WHERE chat_id = p_chat_id AND user_id = p_target_id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Count group members
CREATE OR REPLACE FUNCTION get_group_member_count(p_chat_id uuid)
RETURNS integer AS $$ SELECT count(*)::integer FROM chat_members WHERE chat_id = p_chat_id; $$ LANGUAGE sql SECURITY DEFINER;

-- Create post
CREATE OR REPLACE FUNCTION create_post(p_user_id uuid, p_image_url text, p_caption text, p_expires_at timestamptz DEFAULT NULL)
RETURNS uuid AS $$ DECLARE v_id uuid; BEGIN
  INSERT INTO posts (user_id, image_url, caption, expires_at) VALUES (p_user_id, p_image_url, p_caption, p_expires_at) RETURNING id INTO v_id;
  RETURN v_id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Send message
CREATE OR REPLACE FUNCTION send_message(p_chat_id uuid, p_sender_id uuid, p_type text, p_content text DEFAULT NULL, p_media_url text DEFAULT NULL)
RETURNS uuid AS $$ DECLARE v_id uuid; BEGIN
  INSERT INTO messages (chat_id, sender_id, type, content, media_url) VALUES (p_chat_id, p_sender_id, p_type, p_content, p_media_url) RETURNING id INTO v_id;
  RETURN v_id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- DONE! All features ready
-- ============================================================
