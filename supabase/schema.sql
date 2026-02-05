create extension if not exists "pgcrypto";

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_agent text
);

create table if not exists media (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  asset_url text not null,
  kind text not null check (kind in ('image', 'video')),
  caption text,
  origin text,
  model_name text not null default 'unknown',
  prompt text,
  year integer,
  ai_generated boolean not null default true,
  rating_count integer not null default 0,
  rating_sum integer not null default 0,
  rating_sum_sq bigint not null default 0,
  score double precision not null default 50,
  confidence double precision not null default 0,
  status text not null default 'active',
  is_hidden boolean not null default false
);

create table if not exists ratings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id uuid not null references sessions(id) on delete cascade,
  media_id uuid not null references media(id) on delete cascade,
  rating integer not null check (rating >= 1 and rating <= 100),
  constraint ratings_session_media_unique unique (session_id, media_id)
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id uuid references sessions(id) on delete set null,
  media_id uuid references media(id) on delete set null,
  reason text not null,
  details text,
  media_asset_url text,
  media_kind text,
  media_caption text,
  status text not null default 'open',
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_note text
);

create table if not exists admin_users (
  user_id uuid primary key,
  email text not null,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create index if not exists media_created_at_idx on media (created_at desc);
create index if not exists ratings_media_id_idx on ratings (media_id);
create index if not exists reports_media_id_idx on reports (media_id);
