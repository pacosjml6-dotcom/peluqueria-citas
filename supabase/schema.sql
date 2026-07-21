-- Esquema de base de datos para "Bella Studio · Gestión de Citas"
-- Ejecutar una sola vez en el SQL Editor de Supabase (dashboard del proyecto -> SQL Editor -> New query).

create extension if not exists pgcrypto;

create table if not exists empleados (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  photo text,
  created_at timestamptz not null default now()
);

create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dial_code text not null,
  phone_local text not null,
  full_phone text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists clientes_full_phone_idx on clientes (full_phone);
create unique index if not exists clientes_email_idx on clientes (lower(email));

create table if not exists citas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  dial_code text not null,
  phone_local text not null,
  email text not null,
  employee_id uuid references empleados(id) on delete set null,
  client_id uuid references clientes(id) on delete set null,
  date date not null,
  time text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists citas_date_idx on citas (date);
create index if not exists citas_client_id_idx on citas (client_id);
create index if not exists citas_employee_id_idx on citas (employee_id);

create table if not exists horario (
  day_index int primary key,
  closed boolean not null default false,
  morning_open text,
  morning_close text,
  afternoon_open text,
  afternoon_close text
);

insert into horario (day_index, closed, morning_open, morning_close, afternoon_open, afternoon_close) values
  (0, false, '09:00', '14:00', '15:30', '19:30'),
  (1, false, '09:00', '14:00', '15:30', '19:30'),
  (2, false, '09:00', '14:00', '15:30', '19:30'),
  (3, false, '09:00', '14:00', '15:30', '19:30'),
  (4, false, '09:00', '14:00', '15:30', '19:30'),
  (5, false, '10:00', '14:00', null, null),
  (6, true, null, null, null, null)
on conflict (day_index) do nothing;

-- RLS: sin sistema de login en la app todavía, así que se permite acceso público
-- (lectura y escritura) a través de la clave "anon". Cualquiera que tenga la URL
-- y la clave publicable del proyecto podría leer/escribir estos datos.
-- Si en el futuro se añade un login, esto debería sustituirse por políticas
-- restringidas a usuarios autenticados.
alter table empleados enable row level security;
alter table clientes enable row level security;
alter table citas enable row level security;
alter table horario enable row level security;

create policy "public access" on empleados for all using (true) with check (true);
create policy "public access" on clientes for all using (true) with check (true);
create policy "public access" on citas for all using (true) with check (true);
create policy "public access" on horario for all using (true) with check (true);

-- Habilita las actualizaciones en tiempo real (para que varios dispositivos
-- vean los cambios de los demás sin recargar la página).
alter publication supabase_realtime add table citas, clientes, empleados, horario;
