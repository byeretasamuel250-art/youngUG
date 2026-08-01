# YoungUG — Setup Guide

A national group — like a WhatsApp group everyone in the country is
in — where members send text, voice notes, or photos/posters.
Login is name + phone number only, no password, no OTP, same
approach as newplus. Admins can deactivate/activate members and
manage a single text-only ad slot.

## Files

- `index.html` — login screen + the group chat (main app)
- `app.js` — chat logic (login, recording, sending, rendering)
- `admin.html` — passcode-gated dashboard: Users, Ad, Messages tabs
- `shared.js` — Supabase calls used by both pages
- `config.js` — your Supabase project keys go here
- `style.css` — styling for everything
- `schema.sql` — database + storage setup

## 1. Create the Supabase project

1. Go to supabase.com → New project.
2. Once it's ready, open **SQL Editor → New query**.
3. Paste the entire contents of `schema.sql` and run it.
   This creates the `users`, `posts`, and `ads` tables, the
   row-level security policies, and the `audio-posts` storage
   bucket for voice notes.

> **Already set this up before?** `schema.sql` is safe to re-run —
> it adds the new `active` column and `ads` table without touching
> your existing data.

## 2. Connect the app to your project

1. In Supabase, go to **Settings → API**.
2. Copy the **Project URL** and the **anon public** key.
3. Open `config.js` and paste them in:
   ```js
   const SUPABASE_URL = "https://your-project.supabase.co";
   const SUPABASE_ANON_KEY = "your-anon-public-key";
   ```

## 3. Set your admin passcode

Open `admin.html`, find this line near the top of the `<script>`
block, and change it to something only you know:
```js
const ADMIN_PASSCODE = "changeme123";
```
This is a simple gate, not full security — anyone with your
Supabase anon key can still call the API directly. Keep the
`admin.html` link private and don't share it publicly.

## 4. Push to GitHub

1. Create a new repository, e.g. `youngug`.
2. Add all the files in this folder and push:
   ```bash
   git init
   git add .
   git commit -m "YoungUG — initial version"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/youngug.git
   git push -u origin main
   ```

## 5. Deploy on Vercel

1. Go to vercel.com → **Add New → Project**.
2. Import the GitHub repo you just pushed.
3. Framework preset: **Other** (this is a plain static site,
   no build step needed).
4. Click **Deploy**.
5. Once it's live, you'll get a URL like
   `youngug.vercel.app` — that's your main app.
   Moderation lives at `youngug.vercel.app/admin.html`.

## How login works

- A user enters their name and phone number.
- If that phone number is already in the `users` table, they're
  logged straight in under the name already on file — as long as
  their account is still active.
- If it's new, an account is created on the spot, active by default.
- The session is just remembered in the browser (`localStorage`) —
  there's no password to forget or reset.
- If an admin deactivates someone, they're signed out automatically
  (checked each time the app loads) and blocked from logging back
  in until reactivated.

## How posting works

- Text messages: type in the box, tap **Send**.
- Voice notes: tap **Record a voice note**, speak, tap again to
  stop, preview it, then tap **Send**. Recordings are uploaded to
  the `audio-posts` storage bucket and linked to the message.
- Photos/posters: tap **Photo / poster**, choose an image, add an
  optional caption in the text box, then tap **Send**. Photos are
  uploaded to the `post-images` storage bucket.
- Only one attachment at a time — picking a photo clears any
  recording in progress, and vice versa.
- Everyone shares one single group, newest messages at the bottom,
  own messages on the right — just like a WhatsApp group.
- A member can delete their own messages. Admins can delete any
  message from `admin.html`.

## Admin dashboard (`admin.html`)

Three tabs, behind the passcode gate:

- **Users** — every member's name and phone number, when they
  joined, and an Activate/Deactivate button. Deactivating someone
  logs them out and blocks them from logging back in.
- **Ad** — one text-only ad slot. Write the text, tick "Show this
  ad in the group," and save — it appears pinned at the top of
  everyone's chat. Ads are text only; there's no audio ad slot.
- **Messages** — every text/voice message sent, with delete
  controls, for moderation.

## Known limitations to know about

- Because there's no real login session (matching how you wanted
  newplus kept simple), row-level security has to stay permissive.
  Technically, anyone with your anon key could write to the
  database directly, not just through the app. This is the same
  tradeoff you accepted for newplus.
- No content filtering yet. At real scale (thousands of daily
  posts), you'll likely want either more admin moderators, or a
  "report post" button so the community can flag bad content —
  happy to add either whenever you're ready.
- Two people could technically register with the same phone
  number typed slightly differently (e.g. with/without a leading
  0). Worth deciding on a standard phone format later.
