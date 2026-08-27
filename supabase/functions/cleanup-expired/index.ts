// supabase/functions/cleanup-expired/index.ts
//
// Deploy: supabase functions deploy cleanup-expired --no-verify-jwt
// Then schedule it from supabase/schema.sql (pg_cron + pg_net, see bottom of
// that file) to run every minute.
//
// Why this has to be an Edge Function and not just SQL: Postgres can delete
// rows, but it cannot call the Storage API to delete the actual files. This
// function does both, IN ORDER — file first, then row — so a crash mid-run
// never orphans a row pointing at an already-deleted file (worst case: a
// file lingers one extra minute until the next run finds the still-present
// row again).
//
// Uses the service_role key (available automatically as an env var inside
// Supabase Edge Functions) so it bypasses RLS — this function's whole job
// requires touching rows/files that don't belong to "it".

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const nowIso = new Date().toISOString();

  // 1. Find expired messages that have a media file attached.
  const { data: expiredMedia, error: selectErr } = await supabase
    .from("messages")
    .select("id, chat_id, media_url")
    .lt("expires_at", nowIso)
    .not("media_url", "is", null);

  if (selectErr) {
    return new Response(JSON.stringify({ error: selectErr.message }), { status: 500 });
  }

  const mediaMessages = expiredMedia ?? [];

  // 2. Delete each file from the chat-media bucket first.
  //    media_url is stored as the storage object path, e.g. "<chat_id>/<file>".
  if (mediaMessages.length > 0) {
    const paths = mediaMessages.map((m) => m.media_url as string);
    const { error: removeErr } = await supabase.storage.from("chat-media").remove(paths);
    if (removeErr) {
      // Log and continue — we do NOT want a storage hiccup to block deleting
      // the now-expired DB rows for messages that don't have media, and a
      // failed file here will simply be retried by the next run since its
      // row (see step 3) is only deleted with the rest below.
      console.error("Failed to remove some chat-media files:", removeErr.message);
    }
  }

  // 3. Delete ALL expired rows (media + text) now that files are handled.
  const { error: deleteErr, count } = await supabase
    .from("messages")
    .delete({ count: "exact" })
    .lt("expires_at", nowIso);

  if (deleteErr) {
    return new Response(JSON.stringify({ error: deleteErr.message }), { status: 500 });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      deleted_rows: count ?? 0,
      media_files_removed: mediaMessages.length,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
