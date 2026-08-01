-- =========================================================
-- OUR VOICE UGANDA — Database Schema
-- Run this once in your Supabase project's SQL Editor
-- (Project → SQL Editor → New query → paste → Run)
-- =========================================================

-- Needed for gen_random_uuid()
create extension if not exists pgcrypto;

-- ---------------------------------------------------------
-- USERS
-- Login is name + phone number only (no password, no OTP)
-- Phone number is the unique identifier
-- ---------------------------------------------------------
create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text not null unique,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- If you already ran an earlier version of this schema, this adds
-- the new column to your existing table (safe to run either way).
alter table users add column if not exists active boolean not null default true;

-- ---------------------------------------------------------
-- POSTS
-- A post is either text OR a recorded audio clip
-- user_name is duplicated onto the post so the feed never
-- needs a join, and so a name always shows even if a user
-- record is edited later
-- ---------------------------------------------------------
create table if not exists posts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id) on delete cascade,
  user_name      text not null,
  type           text not null check (type in ('text','audio','image')),
  content        text,           -- used when type = 'text', optional caption when type = 'image'
  audio_url      text,           -- used when type = 'audio'
  audio_seconds  int,            -- clip length, for display
  image_url      text,           -- used when type = 'image'
  created_at     timestamptz not null default now()
);

-- If you already ran an earlier version of this schema, these
-- bring an existing posts table up to date (safe to run either way).
alter table posts drop constraint if exists posts_type_check;
alter table posts add constraint posts_type_check check (type in ('text','audio','image'));
alter table posts add column if not exists image_url text;

create index if not exists posts_created_at_idx on posts (created_at desc);
create index if not exists posts_user_id_idx on posts (user_id);

-- ---------------------------------------------------------
-- ADS
-- One text-only ad slot the admin can set/update. It's shown
-- pinned in the group when active = true. Ads never apply to
-- voice notes, only text.
-- ---------------------------------------------------------
create table if not exists ads (
  id          uuid primary key default gen_random_uuid(),
  text        text not null,
  active      boolean not null default false,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Row Level Security
-- Because there's no Supabase Auth session (login is just
-- name + phone, matching how newplus works), these policies
-- stay permissive — the anon key can read/write. This is the
-- same tradeoff you accepted on newplus to avoid OTP/passwords.
-- Keep your anon key for THIS project separate from newplus.
-- ---------------------------------------------------------
alter table users enable row level security;
alter table posts enable row level security;
alter table ads enable row level security;

create policy "public read users"   on users for select using (true);
create policy "public insert users" on users for insert with check (true);
create policy "public update users" on users for update using (true);

create policy "public read posts"   on posts for select using (true);
create policy "public insert posts" on posts for insert with check (true);
create policy "public delete posts" on posts for delete using (true);

create policy "public read ads"   on ads for select using (true);
create policy "public insert ads" on ads for insert with check (true);
create policy "public update ads" on ads for update using (true);

-- ---------------------------------------------------------
-- Storage bucket for audio clips
-- Run this too, or create the bucket manually in
-- Storage → New bucket → name it "audio-posts" → Public
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('audio-posts', 'audio-posts', true)
on conflict (id) do nothing;

create policy "public read audio"
  on storage.objects for select
  using (bucket_id = 'audio-posts');

create policy "public upload audio"
  on storage.objects for insert
  with check (bucket_id = 'audio-posts');

create policy "public delete audio"
  on storage.objects for delete
  using (bucket_id = 'audio-posts');

-- ---------------------------------------------------------
-- Storage bucket for photos / posters
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

create policy "public read images"
  on storage.objects for select
  using (bucket_id = 'post-images');

create policy "public upload images"
  on storage.objects for insert
  with check (bucket_id = 'post-images');

create policy "public delete images"
  on storage.objects for delete
  using (bucket_id = 'post-images');
