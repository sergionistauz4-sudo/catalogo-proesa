-- -*- coding: utf-8 -*-
-- schema.sql — Tablas del Catálogo PROESA
-- ------------------------------------------------------------------
-- Ejecutar una sola vez en Supabase → SQL Editor → New query → Run.
--
-- El admin (asesor de ventas) NO vive en esta base: sus credenciales
-- salen de las variables de entorno ADMIN_USUARIO / ADMIN_PASSWORD
-- del backend. Acá solo están los clientes (farmacéuticos) y los
-- productos del catálogo.

create extension if not exists "pgcrypto";

-- ─── Clientes (farmacéuticos) ────────────────────────────────────────
-- Login: nombre + NIT (el NIT funciona como contraseña).
-- El NIT se guarda "limpio": solo letras y números, en mayúsculas
-- (sin puntos, guiones ni espacios) — el backend lo normaliza solo.
create table if not exists clientes (
  id          uuid primary key default gen_random_uuid(),
  nombre      text        not null,
  nit         text        not null unique,
  activo      boolean     not null default true,   -- false = no puede iniciar sesión
  created_at  timestamptz not null default now()
);

create index if not exists clientes_nombre_idx on clientes (lower(nombre));

-- ─── Productos del catálogo ──────────────────────────────────────────
create table if not exists productos (
  id                uuid primary key default gen_random_uuid(),
  nombre            text          not null,
  descripcion       text          not null default '',
  precio            numeric(12,2) not null check (precio >= 0),
  imagen_url        text,
  imagen_public_id  text,                            -- id en Cloudinary (para borrar/reemplazar)
  activo            boolean       not null default true,  -- false = oculto para los clientes
  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now()
);

create index if not exists productos_nombre_idx on productos (lower(nombre));

-- updated_at automático
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists productos_updated_at on productos;
create trigger productos_updated_at
  before update on productos
  for each row execute function set_updated_at();

-- ─── Seguridad ───────────────────────────────────────────────────────
-- RLS activado SIN políticas: nadie puede leer/escribir con la anon key.
-- El backend usa la SERVICE key, que saltea RLS — todo pasa por la API.
alter table clientes  enable row level security;
alter table productos enable row level security;
