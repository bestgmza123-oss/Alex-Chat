# Supabase Setup — ขั้นตอนที่เหลือ

ทำตาม 2 ขั้นตอนนี้ให้เสร็จ แล้ว app จะใช้งานได้ 100%

---

## ขั้นตอนที่ 5: Deploy Edge Function

Edge Function คือตัวลบ media files ใน Storage เมื่อข้อความหมดอายุ
(Postgres ลบได้แค่ DB row ไม่ลบไฟล์จริงใน Storage ได้)

### วิธี A: Deploy ผ่าน Dashboard (ง่ายสุด)

1. ไปที่ **Supabase Dashboard → Edge Functions** (หรือ Edge Functions ใน sidebar)
2. กด **"Create a new function"**
3. ชื่อ function: **`cleanup-expired`**
4. วาง code นี้แทนที่:

```typescript
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
  if (mediaMessages.length > 0) {
    const paths = mediaMessages.map((m) => m.media_url as string);
    const { error: removeErr } = await supabase.storage.from("chat-media").remove(paths);
    if (removeErr) {
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
```

5. กด **Deploy**
6. หลัง deploy เสร็จ → คัดลอก **Function URL** ที่ได้ (จะเป็นแบบ `https://vnlebfnwxyqfceurxhwq.functions.supabase.co/cleanup-expired`)

### วิธี B: Deploy ผ่าน CLI (ต้อง terminal)

```bash
npx supabase login
npx supabase link --project-ref vnlebfnwxyqfceurxhwq
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZubGViZm53eHlxZmNldXJ4aHdxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzgzODY5OCwiZXhwIjoyMTAzNDE0Njk4fQ.xW0awPzV63dYBkOl5Hn2S9NXauW8_XwqKYAV68VaXUE
npx supabase functions deploy cleanup-expired --no-verify-jwt
```

---

## ขั้นตอนที่ 6: Re-run Cron Schedule (ให้ใช้ PROJECT_REF จริง)

Schema ที่คุณ run ไปแล้วใช้ `<PROJECT_REF>` placeholder ยังไม่ทำงานจริง
ต้อง re-run cron schedule ด้วยค่าจริง:

1. ไปที่ **SQL Editor → New Query**
2. วาง code นี้แล้วกด **Run**:

```sql
-- ลบ cron job เดิมที่ยังไม่ work
SELECT cron.unschedule('cleanup-expired-messages');

-- สร้างใหม่ด้วย PROJECT_REF จริง
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
```

---

## ข้อมูลสรุป

| ค่า | ค่าจริง |
|-----|---------|
| Project URL | `https://vnlebfnwxyqfceurxhwq.supabase.co` |
| PIN | `1234` (เปลี่ยนได้ทีหลัง) |
| PIN Hash (SHA256) | `03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4` |
