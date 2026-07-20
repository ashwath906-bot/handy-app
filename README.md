# Handy APP

A shared family organizer PWA: shopping lists, reminders, and events that sync live between every family member's phone. Built with React + Vite + Tailwind, data and realtime sync by Supabase, hosted on Vercel.

## How it works

- Your family shares one **household**, identified by an unguessable code (a UUID).
- One person creates the household in the app and shares the invite code (Family panel → "Copy invite code").
- Everyone else installs the app and joins with that code. Each person picks who they are once per device.
- All lists, reminders, and events sync live — check off milk and everyone sees it instantly.

## Setup (about 15 minutes)

### 1. Supabase (database)

1. Go to [supabase.com](https://supabase.com) → your dashboard → **New project**. Name it `handy-app`, pick a region near you, and set a database password (you won't need it again for this app).
2. When the project is ready, open **SQL Editor** → **New query**, paste the full contents of `supabase/schema.sql` from this repo, and click **Run**. You should see "Success. No rows returned".
3. Go to **Project Settings → API** and copy two values:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (the long string under "Project API keys")

### 2. Run locally (optional but recommended)

Requires Node.js 18+.

```bash
npm install
cp .env.example .env
# edit .env and paste your Supabase URL and anon key
npm run dev
```

Open http://localhost:5173, create a household, add members, and try it out.

### 3. GitHub

```bash
git init
git add .
git commit -m "Handy APP v1"
```

Create a new repository on GitHub (private is fine), then:

```bash
git remote add origin https://github.com/YOUR-USERNAME/handy-app.git
git branch -M main
git push -u origin main
```

### 4. Vercel (hosting)

1. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import your `handy-app` GitHub repo.
2. Vercel auto-detects Vite. Before deploying, open **Environment Variables** and add:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon public key
3. Click **Deploy**. In a minute you'll get a URL like `https://handy-app.vercel.app`.

Every future `git push` to `main` redeploys automatically.

### 5. Install on phones

Share your Vercel URL with the family:

- **Android (Chrome):** open the URL → menu (⋮) → **Add to Home screen** / **Install app**.
- **iPhone (Safari):** open the URL → Share button → **Add to Home Screen**.

It opens full-screen like a native app, with the Handy icon.

## Things to know

- **All tables are prefixed `handy_`** (`handy_lists`, `handy_events`, ...), so the schema can be run inside an existing Supabase project without clashing with your other tables.

- **Reminders** pop up (with a notification, if allowed) while the app is open. True push notifications with the app closed require a native app or web-push server — not included in v1.
- **Security model:** anyone with your household code can read and edit your household's data. The code is a random UUID, so it can't be guessed, but treat it like a house key — don't post it publicly, and don't store anything sensitive in the app. For real accounts and per-user permissions, the upgrade path is Supabase Auth with row-level-security policies per household membership.
- **Free tiers** of Supabase and Vercel comfortably cover a family's usage.

## Project structure

```
├── index.html              app shell
├── vite.config.js          Vite + Tailwind + PWA manifest/service worker
├── public/icons/           app icons
├── src/
│   ├── App.jsx             the whole app (join flow, tabs, components)
│   ├── supabase.js         Supabase client
│   ├── main.jsx            React entry
│   └── index.css           Tailwind import
└── supabase/schema.sql     database tables, security policies, realtime
```
