# ALEX-CHAT

> Private ephemeral comms — messages self-destruct 10 minutes after sending.

A secret cyber-agent themed private chat web app for 10-20 people. Built with Next.js 14, Supabase, and a "Ghost Channel" terminal aesthetic.

## Features

- **PIN Lock** — Shared PIN required before accessing the app; auto-locks after 5 minutes idle
- **Private Chat (DM)** — 1:1 messaging with text, images, and videos; all messages expire in 10 minutes with visible countdown
- **Group Chat** — Create groups, share invite codes, chat with multiple people; same 10-minute expiry
- **Post Board** — Permanent image-only public feed (no expiry)
- **Profile** — Username, bio, up to 3 profile pictures
- **Matrix Rain** — Signature ambient canvas background (cyan + magenta, respects `prefers-reduced-motion`)
- **Responsive** — Desktop sidebar + mobile bottom nav

## Tech Stack

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling:** Tailwind CSS (cyber/hacker theme tokens)
- **Backend:** Supabase Free tier (Auth, Postgres, Storage, Realtime, Edge Functions)
- **Fonts:** JetBrains Mono (display) + IBM Plex Mono (body)

## Setup

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In **Project Settings → API**, copy:
   - `Project URL` (e.g. `https://xxxxx.supabase.co`)
   - `anon` public key

### 2. Set Up the Database

1. In Supabase Dashboard, go to **SQL Editor → New Query**
2. Paste the entire contents of `supabase/schema.sql` and run it
3. Enable the required extensions: go to **Database → Extensions** and enable `pg_cron` and `pg_net`

### 3. Set Up Storage Buckets

The SQL file creates the buckets, but verify in **Storage** dashboard:
- `avatars` — public read
- `post-images` — public read
- `chat-media` — private (signed URLs only)

### 4. Configure Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# PIN lock — generate the SHA256 hash of your chosen PIN:
#   node -e "console.log(require('crypto').createHash('sha256').update('YOUR_PIN').digest('hex'))"
ALEX_PIN_SHA256=your-sha256-pin-hash
```

### 5. Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to the PIN lock screen first.

### 6. Deploy the Edge Function (for message expiry cleanup)

The Edge Function deletes expired media files from Storage (SQL can only delete DB rows):

```bash
# Install Supabase CLI: https://supabase.com/docs/guides/cli
supabase login
supabase link --project-ref your-project-ref

# Set the service role key (found in Supabase Dashboard → Settings → API)
supabase secrets set SERVICE_ROLE_KEY=your-service-role-key

# Deploy the function
supabase functions deploy cleanup-expired --no-verify-jwt
```

Then update the `schema.sql` cron schedule, replacing `<PROJECT_REF>` and `<SERVICE_ROLE_KEY>` with your actual values.

### 7. Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com), import the repo
3. Add the same environment variables from step 4
4. Deploy — Vercel handles Next.js builds automatically

## Project Structure

```
app/
├── layout.tsx                    # Root layout (MatrixRain, fonts)
├── page.tsx                      # Redirect → /channels
├── globals.css                   # Tailwind + theme tokens
├── lock/page.tsx                 # PIN lock screen (boot animation)
├── login/page.tsx                # Supabase Auth login
├── signup/page.tsx               # Supabase Auth signup
├── api/pin/route.ts              # PIN verification endpoint
└── (main)/
    ├── layout.tsx                # NavBar (sidebar + bottom nav)
    ├── channels/
    │   ├── page.tsx              # DM chat list + start new DM
    │   └── [chatId]/page.tsx     # Individual DM
    ├── groups/
    │   ├── page.tsx              # Create/join groups
    │   └── [chatId]/page.tsx     # Group chat
    ├── feed/page.tsx             # Post board (image feed)
    └── profile/page.tsx          # Profile (avatar, bio, logout)
components/
├── ChatWindow.tsx                # Full chat UI + realtime
├── Logo.tsx                      # Animated SVG logo
├── MatrixRain.tsx                # Canvas background effect
├── MessageCountdown.tsx          # Circular countdown timer
└── NavBar.tsx                    # Desktop sidebar + mobile bottom nav
lib/
├── types.ts                      # TypeScript types
├── useUser.ts                    # Client auth guard hook
├── storage-paths.ts              # Storage path helpers
├── pin-session.ts                # PIN session logic
└── supabase/
    ├── client.ts                 # Browser Supabase client
    └── server.ts                 # Server Supabase client
supabase/
├── schema.sql                    # Full DB schema + RLS + cron
└── functions/cleanup-expired/    # Edge Function for file deletion
middleware.ts                     # PIN session enforcement
```

## Design

See `DESIGN.md` for the full "Ghost Channel" theme spec — color tokens, typography, signature elements, and restraint guidelines.

## Important Notes

- **Message expiry:** Every message expires exactly 10 minutes after sending (not on a rolling batch). The Edge Function handles both DB row deletion AND Storage file deletion.
- **Input state isolation:** The realtime subscription never touches the input field state — this prevents a known bug where sync events wipe out in-progress typing.
- **PIN is shared:** One PIN for all users — this is a "keep strangers out" lock for a private tool, not a security boundary.
