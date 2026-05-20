-- EVINKA v28
-- Auditoría operativa total

create table if not exists public.operational_audit_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  country_code text not null default 'PE',
  entity_type text not null,
  entity_id text not null,
  action text not null,
  status text not null default 'success',
  summary text not null default '',
  actor jsonb,
  detail jsonb not null default '{}'::jsonb
);

create index if not exists operational_audit_events_created_at_idx
  on public.operational_audit_events (created_at desc);

create index if not exists operational_audit_events_country_idx
  on public.operational_audit_events (country_code, created_at desc);

create index if not exists operational_audit_events_entity_idx
  on public.operational_audit_events (entity_type, entity_id, created_at desc);

alter table public.operational_audit_events enable row level security;

create policy if not exists "service_role_manage_operational_audit_events"
  on public.operational_audit_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
