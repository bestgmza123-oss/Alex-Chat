// Types matching supabase/schema.sql

export type Profile = {
  id: string;
  username: string;
  bio: string;
  avatar_urls: string[];
  access_code?: string;
  created_at: string;
};

export type Chat = {
  id: string;
  is_group: boolean;
  name: string | null;
  created_by: string;
  pinned?: boolean;
  created_at: string;
};

export type ChatMember = {
  chat_id: string;
  user_id: string;
  joined_at: string;
};

export type Group = {
  chat_id: string;
  invite_code: string;
  created_by: string;
  created_at: string;
};

export type MessageType = "text" | "image" | "video";

export type Message = {
  id: string;
  chat_id: string;
  sender_id: string;
  type: MessageType;
  content: string | null;
  media_url: string | null;
  created_at: string;
  expires_at: string;
  sender?: Pick<Profile, "id" | "username">;
};

export type Post = {
  id: string;
  user_id: string;
  image_url: string;
  caption: string;
  expires_at?: string | null;
  created_at: string;
  author?: Pick<Profile, "id" | "username">;
};

export type Notification = {
  id: string;
  user_id: string;
  from_user_id: string;
  type: "mention_post" | "mention_chat";
  ref_id: string;
  read: boolean;
  created_at: string;
};
