-- 1. Groups: add leader, capacity, recruiting
ALTER TABLE groups ADD COLUMN IF NOT EXISTS leader_id uuid REFERENCES profiles(id);
ALTER TABLE groups ADD COLUMN IF NOT EXISTS capacity integer DEFAULT 0;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS is_recruiting boolean DEFAULT false;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS group_pin text;

-- Make group name unique (name = invite code)
ALTER TABLE groups ADD CONSTRAINT groups_name_unique UNIQUE (name);

-- 2. Posts: add job board fields
ALTER TABLE posts ADD COLUMN IF NOT EXISTS post_type text DEFAULT 'text' CHECK (post_type IN ('text', 'image', 'job_recruit'));
ALTER TABLE posts ADD COLUMN IF NOT EXISTS group_link uuid REFERENCES chats(id);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS requirements text;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS contact_info text;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS slot_total integer DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS slot_filled integer DEFAULT 0;

-- 3. Make posts globally visible (anyone can read)
DROP POLICY IF EXISTS p_post_sel ON posts;
CREATE POLICY p_post_sel ON posts FOR SELECT USING (true);

-- 4. RPC: join group by name
CREATE OR REPLACE FUNCTION join_group_by_name(p_group_name text, p_user_id uuid)
RETURNS jsonb AS $$
DECLARE v_chat_id uuid; v_group record; v_count integer;
BEGIN
  SELECT g.chat_id, g.capacity, g.is_recruiting INTO v_chat_id, v_group.capacity, v_group.is_recruiting
  FROM groups g WHERE g.name = p_group_name;
  IF v_chat_id IS NULL THEN RETURN jsonb_build_object('error', 'Group not found'); END IF;

  SELECT count(*) INTO v_count FROM chat_members WHERE chat_id = v_chat_id;
  IF v_group.is_recruiting AND v_group.capacity > 0 AND v_count >= v_group.capacity THEN
    RETURN jsonb_build_object('error', 'Group is full');
  END IF;

  INSERT INTO chat_members (chat_id, user_id) VALUES (v_chat_id, p_user_id) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('chat_id', v_chat_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC: kick member (leader only)
CREATE OR REPLACE FUNCTION kick_member(p_chat_id uuid, p_leader_id uuid, p_target_id uuid)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM groups WHERE chat_id = p_chat_id AND leader_id = p_leader_id) THEN
    RAISE EXCEPTION 'Only group leader can kick members';
  END IF;
  DELETE FROM chat_members WHERE chat_id = p_chat_id AND user_id = p_target_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC: count group members
CREATE OR REPLACE FUNCTION get_group_member_count(p_chat_id uuid)
RETURNS integer AS $$ SELECT count(*)::integer FROM chat_members WHERE chat_id = p_chat_id; $$ LANGUAGE sql SECURITY DEFINER;
