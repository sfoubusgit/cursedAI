create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id uuid references sessions(id) on delete set null,
  score integer not null check (score >= 1 and score <= 5),
  notes text
);

alter table feedback enable row level security;

create policy "feedback_insert_public"
on feedback
for insert
to anon, authenticated
with check (true);
