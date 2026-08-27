-- Enable realtime (use DO block to handle if already added)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE posts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE posts ALTER COLUMN expires_at DROP NOT NULL;

-- RPC functions
CREATE OR REPLACE FUNCTION create_post(p_user_id uuid, p_image_url text, p_caption text, p_expires_at timestamptz DEFAULT NULL)
RETURNS uuid AS $$ DECLARE v_id uuid; BEGIN
  INSERT INTO posts (user_id, image_url, caption, expires_at) VALUES (p_user_id, p_image_url, p_caption, p_expires_at) RETURNING id INTO v_id; RETURN v_id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION send_message(p_chat_id uuid, p_sender_id uuid, p_type text, p_content text DEFAULT NULL, p_media_url text DEFAULT NULL)
RETURNS uuid AS $$ DECLARE v_id uuid; BEGIN
  INSERT INTO messages (chat_id, sender_id, type, content, media_url) VALUES (p_chat_id, p_sender_id, p_type, p_content, p_media_url) RETURNING id INTO v_id; RETURN v_id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
