create table if not exists public.client_artifacts (
  id uuid primary key default gen_random_uuid(),
  client_id text null,
  client_name text null,
  phone text not null,
  ticket_id text null,
  message_id text null,
  conversation_id uuid null,
  country_code text null,
  artifact_type text not null,
  title text null,
  summary text null,
  payload jsonb null,
  source_platform text not null default 'whatsapp',
  created_at timestamptz not null default now()
);

create index if not exists idx_client_artifacts_phone on public.client_artifacts(phone);
create index if not exists idx_client_artifacts_ticket on public.client_artifacts(ticket_id);
create index if not exists idx_client_artifacts_conversation on public.client_artifacts(conversation_id);
create index if not exists idx_client_artifacts_message on public.client_artifacts(message_id);
create index if not exists idx_client_artifacts_type on public.client_artifacts(artifact_type);
create index if not exists idx_client_artifacts_created_at on public.client_artifacts(created_at desc);
