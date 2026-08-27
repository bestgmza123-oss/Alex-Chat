// Object path conventions for each Storage bucket. Kept in one place because
// the RLS policies in supabase/schema.sql check the FIRST path segment
// (storage.foldername(name))[1]) to decide access — these helpers and those
// policies must always agree.

export function avatarPath(userId: string, filename: string) {
  return `${userId}/${Date.now()}-${filename}`;
}

export function postImagePath(userId: string, filename: string) {
  return `${userId}/${Date.now()}-${filename}`;
}

// chat-media policies check (storage.foldername(name))[1] against the
// user's chat_members rows, so the chat id must be the first path segment.
export function chatMediaPath(chatId: string, filename: string) {
  return `${chatId}/${Date.now()}-${filename}`;
}
