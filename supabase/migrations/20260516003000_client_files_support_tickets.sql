create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public, file_size_limit)
values ('evinka-client-files', 'evinka-client-files', false, 20971520)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

create table if not exists public.client_files (
  id uuid primary key default gen_random_uuid(),
  client_id text null,
  client_name text null,
  phone text not null,
  ticket_id text null,
  message_id text null,
  conversation_id uuid null,
  country_code text null,
  file_name text not null,
  file_type text null,
  mime_type text null,
  file_size bigint null,
  storage_bucket text null,
  storage_path text null,
  public_url text null,
  signed_url text null,
  source_platform text not null default 'whatsapp',
  created_at timestamptz not null default now()
);

create index if not exists idx_client_files_phone on public.client_files(phone);
create index if not exists idx_client_files_ticket on public.client_files(ticket_id);
create index if not exists idx_client_files_conversation on public.client_files(conversation_id);
create index if not exists idx_client_files_created_at on public.client_files(created_at desc);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid null,
  client_id text null,
  phone text not null,
  status text not null default 'nuevo',
  priority text not null default 'normal',
  assigned_to text null,
  handoff_active boolean not null default false,
  created_at timestamptz not null default now(),
  last_customer_message_at timestamptz null,
  last_agent_message_at timestamptz null,
  timeout_checked_at timestamptz null,
  closed_at timestamptz null,
  close_reason text null
);

create index if not exists idx_support_tickets_phone on public.support_tickets(phone);
create index if not exists idx_support_tickets_conversation on public.support_tickets(conversation_id);
create index if not exists idx_support_tickets_status on public.support_tickets(status);
create index if not exists idx_support_tickets_created_at on public.support_tickets(created_at desc);
