create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  session_id uuid,
  path text,
  event_type text not null,
  meta jsonb
);

alter table analytics_events enable row level security;

create policy "analytics_insert_public"
on analytics_events
for insert
to anon, authenticated
with check (true);
