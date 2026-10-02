-- -*- coding: utf-8 -*-
-- migracion_v2.sql — Actualiza las tablas de la PRIMERA versión
-- ------------------------------------------------------------------
-- Ejecutar UNA vez en Supabase → SQL Editor, si ya habías corrido el
-- schema.sql original. Es seguro repetirla: no rompe nada si ya se aplicó.
--
-- Qué cambia:
--   · clientes: el NIT deja de ser único (hay clientes que comparten NIT)
--               y se agregan codigo_cliente, ambito y vendedor.
--   · productos: se agregan codigo, linea, subclase y stock.

-- ─── clientes ────────────────────────────────────────────────────────
alter table clientes drop constraint if exists clientes_nit_key;

alter table clientes add column if not exists codigo_cliente text;
alter table clientes add column if not exists ambito         text;
alter table clientes add column if not exists vendedor       text;

create unique index if not exists clientes_codigo_uidx on clientes (codigo_cliente);
create index        if not exists clientes_nit_idx    on clientes (nit);

-- ─── productos ───────────────────────────────────────────────────────
alter table productos add column if not exists codigo   text;
alter table productos add column if not exists linea    text;
alter table productos add column if not exists subclase text;
alter table productos add column if not exists stock    integer;

create unique index if not exists productos_codigo_uidx on productos (codigo);
