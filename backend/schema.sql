-- -*- coding: utf-8 -*-
-- schema.sql — Tablas del Catálogo PROESA (instalación NUEVA)
-- ------------------------------------------------------------------
-- Ejecutar una sola vez en Supabase → SQL Editor → New query → Run.
-- Si ya tenés la base creada, NO lo vuelvas a correr: usá migracion_v2.sql
-- (si venías de la primera versión) y migracion_v3.sql (reporte de accesos).
--
-- El admin (asesor de ventas) NO vive en esta base: sus credenciales
-- salen de las variables de entorno ADMIN_USUARIO / ADMIN_PASSWORD
-- del backend. Acá solo están los clientes (farmacéuticos) y los
-- productos del catálogo.

create extension if not exists "pgcrypto";

-- ─── Clientes (farmacéuticos) ────────────────────────────────────────
-- Login: nombre + NIT (el NIT funciona como contraseña).
-- El NIT se guarda "limpio": solo letras y números, en mayúsculas.
-- El NIT NO es único: varias sucursales/códigos pueden compartirlo;
-- lo que identifica a cada cliente es su código (codigo_cliente).
create table if not exists clientes (
  id              uuid primary key default gen_random_uuid(),
  codigo_cliente  text,                               -- ej. C0219576
  nombre          text        not null,
  nit             text        not null,
  ambito          text,                               -- "Amb. Compra" (ej. FARMACIA)
  vendedor        text,
  activo          boolean     not null default true,  -- false = no puede iniciar sesión
  created_at      timestamptz not null default now()
);

create unique index if not exists clientes_codigo_uidx on clientes (codigo_cliente);
create index if not exists clientes_nit_idx    on clientes (nit);
create index if not exists clientes_nombre_idx on clientes (lower(nombre));

-- ─── Productos del catálogo ──────────────────────────────────────────
create table if not exists productos (
  id                uuid primary key default gen_random_uuid(),
  codigo            text,                              -- código interno (ej. 50024)
  linea             text,                              -- ej. KENVUE
  subclase          text,                              -- ej. BABY CARE
  nombre            text          not null,
  descripcion       text          not null default '',
  precio            numeric(12,2) not null check (precio >= 0),   -- precio por unidad
  stock             integer,                           -- solo lo ve el admin
  imagen_url        text,
  imagen_public_id  text,                              -- id en Cloudinary (para borrar/reemplazar)
  activo            boolean       not null default true,  -- false = oculto para los clientes
  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now()
);

create unique index if not exists productos_codigo_uidx on productos (codigo);
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

-- ─── Accesos (cada vez que un cliente entra al catálogo) ─────────────
create table if not exists accesos (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid        not null references clientes(id) on delete cascade,
  creado      timestamptz not null default now()
);

create index if not exists accesos_creado_idx  on accesos (creado);
create index if not exists accesos_cliente_idx on accesos (cliente_id, creado desc);

-- ─── Seguridad ───────────────────────────────────────────────────────
-- RLS activado SIN políticas: nadie puede leer/escribir con la anon key.
-- El backend usa la SERVICE key, que saltea RLS — todo pasa por la API.
alter table clientes  enable row level security;
alter table productos enable row level security;
alter table accesos   enable row level security;
