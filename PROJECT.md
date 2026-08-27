# ALEX-CHAT — Project Handoff Document

> อ่านไฟล์นี้ก่อนไฟล์อื่นเสมอ ถ้าคุณคือ AI agent ตัวใหม่ที่เข้ามารับงานต่อ ไฟล์นี้คือ source of truth ว่าโปรเจกต์นี้คืออะไร ต้องทำอะไร และทำไปถึงไหนแล้ว

## 1. โปรเจกต์นี้คืออะไร

Alex-Chat = เว็บแอปแชทส่วนตัว/ชั่วคราว ธีม "secret cyber agent" (hacker aesthetic)
เว็บปิด ใช้กันเองไม่เกิน 10-20 คน ไม่ใช่ public product

**หัวใจของโปรเจกต์ (ต้องถูกต้อง 100%):** ทุกข้อความในแชท (ส่วนตัว + กลุ่ม) มีอายุ **10 นาทีนับจากเวลาที่ส่ง** (ไม่ใช่ลบเป็นรอบทุก 10 นาที) เมื่อหมดอายุต้องลบทั้ง DB row และไฟล์ media จริงใน Storage

## 2. Requirement ทั้งหมด (ยืนยันกับ user แล้ว)

| ส่วน | รายละเอียด |
|---|---|
| Account | username, bio, profile picture (**จำกัด 3 รูปต่อ account**), login/signup ผ่าน Supabase Auth |
| Private Chat | 1:1, ข้อความ/รูป/วิดีโอ, หมดอายุ 10 นาทีต่อข้อความ พร้อม countdown ที่ผู้ใช้เห็นแบบเรียลไทม์ |
| Group Chat | สร้างกลุ่ม/join กลุ่ม/คุยในกลุ่ม, expiry 10 นาทีเหมือนกัน |
| Post | **โพสต์ได้แค่รูป** (ไม่มีวิดีโอ), **อยู่ถาวร** (ไม่หมดอายุ), **public feed ทุกคนเห็นหมด** |
| Master PIN | PIN **เดียวใช้ร่วมกันทั้งเว็บ** (ไม่แยกต่อ user), เป็น **app lock ก่อนเข้าเว็บ**, session-based — ถ้า idle/ออกจากแอปเกิน **5 นาที** ต้องใส่ PIN ใหม่ |
| Backend | Supabase **Free tier**: Auth + Postgres + Storage + Realtime + Edge Functions (สำหรับ cron ลบข้อความหมดอายุ) |
| Theme | Cyber/hacker aesthetic — ดู `DESIGN.md` |
| Responsive | ต้อง responsive ตั้งแต่แรก ทั้ง PC และ mobile ไม่ใช่ desktop-first แล้วค่อยย่อ |
| Deploy | Code → GitHub repo → Deploy (Vercel แนะนำ เพราะฟรีและเข้ากับ Next.js) → Public URL |
| ⚠️ ข้อควรระวังพิเศษจาก user | user เคยเจอบั๊ก realtime sync ทำให้ข้อความที่กำลังพิมพ์ในช่อง input หายไปเพราะ re-render ทับจาก sync event — **ห้ามให้ realtime subscription ไป re-render/ทับ state ของ input field เด็ดขาด** ต้องแยก local state ของ input ออกจาก state ที่ sync จาก server ให้ชัดเจน |

## 3. สถานะปัจจุบัน (อัปเดตโดย session ที่ 2 — จัดเรียงโครงสร้าง + สร้างหน้าครบ)

✅ เสร็จแล้ว (ทั้งหมด):
- **โครงสร้างโปรเจกต์** — Next.js 14 (App Router) + TypeScript + Tailwind, จัดเรียงไฟล์เป็น folder structure ที่ถูกต้องแล้ว:
  ```
  app/
  ├── layout.tsx              # root layout (MatrixRain, fonts)
  ├── globals.css
  ├── page.tsx                # redirect → /channels
  ├── lock/page.tsx           # PIN lock screen (boot animation)
  ├── login/page.tsx          # Supabase Auth login
  ├── signup/page.tsx         # Supabase Auth signup
  ├── api/pin/route.ts        # PIN verification API
  └── (main)/
      ├── layout.tsx          # NavBar sidebar + bottom nav
      ├── channels/
      │   ├── page.tsx        # DM chat list + start new DM
      │   └── [chatId]/page.tsx  # Individual DM (ChatWindow)
      ├── groups/
      │   ├── page.tsx        # Group list + create/join
      │   └── [chatId]/page.tsx  # Group chat (ChatWindow)
      ├── feed/page.tsx       # Post feed (image-only, permanent)
      └── profile/page.tsx    # Profile (avatar, bio, logout)
  components/
  ├── ChatWindow.tsx          # Full chat UI (send text/media, realtime, countdown)
  ├── Logo.tsx                # Animated SVG logo
  ├── MatrixRain.tsx          # Canvas background effect
  ├── MessageCountdown.tsx    # Circular countdown timer
  └── NavBar.tsx              # Sidebar (desktop) + bottom nav (mobile)
  lib/
  ├── types.ts                # TypeScript types
  ├── useUser.ts              # Client auth guard hook
  ├── storage-paths.ts        # Storage path helpers
  ├── pin-session.ts          # PIN session logic
  └── supabase/
      ├── client.ts           # Browser Supabase client
      └── server.ts           # Server Supabase client
  supabase/
  ├── schema.sql              # Full DB schema + RLS + cron
  └── functions/cleanup-expired/index.ts  # Edge Function for file deletion
  middleware.ts                # PIN session enforcement
  ```
- `supabase/schema.sql` — schema เต็ม: profiles, chats, chat_members, messages, groups, posts + RLS policies + trigger/function สำหรับลบข้อความหมดอายุ (pg_cron)
- **PIN lock system** (`app/lock`, `middleware.ts`, `lib/pin-session.ts`, `app/api/pin/route.ts`) — ทำงานได้จริง ใช้ shared PIN + session timeout 5 นาที, boot animation terminal-style
- **Theme tokens** + `globals.css` + Matrix-rain background effect
- **Supabase client setup** (`lib/supabase/client.ts`, `server.ts`)
- **Auth pages** — login + signup เชื่อม Supabase Auth, username validation
- **ChatWindow component** — ส่งข้อความ (text/image/video), อัปโหลดไฟล์, realtime subscription, media display, MessageCountdown — **แยก input state ออกจาก message list state แล้ว**
- **DM channels page** — list chats, search username เพื่อเริ่ม DM ใหม่, ตรวจ duplicate
- **Group chat pages** — สร้าง group (auto-generate invite code), join ด้วย invite code, group chat UI
- **Post feed page** — upload รูป + caption, grid feed, delete own posts, public (no expiry)
- **Profile page** — upload/delete avatars (max 3), edit username/bio, logout
- **MessageCountdown** — countdown ring สี cyan → magenta → danger red, client-side จาก expires_at

🔲 ยังไม่เสร็จ / ต้องทำต่อ:
1. **Edge Function deploy** — ตอนนี้มี `supabase/functions/cleanup-expired/index.ts` แล้ว แต่ยังไม่ได้ deploy จริง ต้อง: (a) สร้าง Supabase project (b) รัน schema.sql (c) deploy Edge Function (d) ตั้ง cron schedule ใน schema.sql ใส่ PROJECT_REF จริง
2. **Responsive polish** — ทดสอบทุกหน้าบนมือถือจริง โดยเฉพาะหน้าแชท + groups + feed
3. **Test RLS policies** — ทดสอบ permissions จริงว่า user อื่นเข้าถึง chat ที่ไม่ใช่ของตัวเองไม่ได้
4. **Deploy** — user ต้อง: (a) สร้าง Supabase project (b) รัน `supabase/schema.sql` (c) push GitHub (d) เชื่อม Vercel deploy

## 4. ทำไมต้องมีไฟล์นี้

User กังวลว่า AI session ปัจจุบันอาจ token หมดก่อนทำเสร็จ แล้วต้องเริ่มอธิบายใหม่กับ agent ตัวอื่น — **ทุกครั้งที่ session ใหม่เข้ามาทำงานต่อ ให้อัปเดต "สถานะปัจจุบัน" ด้านบนนี้ก่อนเริ่มงาน และอัปเดตอีกครั้งก่อนจบ session** เพื่อให้ agent ตัวถัดไปรู้ว่าทำอะไรไปแล้วบ้าง

## 5. ไฟล์ที่เกี่ยวข้อง

- `DESIGN.md` — design tokens, ธีมสี, ฟอนต์, signature element
- `supabase/schema.sql` — DB schema ทั้งหมด รันใน Supabase SQL editor ได้เลย
- `supabase/functions/cleanup-expired/index.ts` — Edge Function สำหรับลบ expired media files

## 6. Flow ของ App

```
User เปิดเว็บ
  → middleware.ts ตรวจ PIN cookie
  → ถ้าไม่มี/หมดอายุ → redirect /lock
  → Lock screen (boot animation → PIN input)
  → POST /api/pin → ถูก → ตั้ง cookie → redirect กลับ
  → /channels (DM list) หรือหน้าอื่น
  → useUser hook ตรวจ Supabase Auth session
  → ถ้าไม่ login → redirect /login
  → เข้าใช้งานได้
```
