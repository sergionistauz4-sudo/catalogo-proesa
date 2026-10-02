-- -*- coding: utf-8 -*-
-- migracion_v3.sql — Registro de accesos (reporte de entradas al catálogo)
-- ------------------------------------------------------------------
-- Correr UNA vez en Supabase → SQL Editor. Se puede repetir sin problema.
-- (Las instalaciones nuevas ya lo traen en schema.sql.)

create table if not exists accesos (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid        not null references clientes(id) on delete cascade,
  creado      timestamptz not null default now()
);

create index if not exists accesos_creado_idx  on accesos (creado);
create index if not exists accesos_cliente_idx on accesos (cliente_id, creado desc);

alter table accesos enable row level security;   -- sin políticas: solo el backend (service key)
