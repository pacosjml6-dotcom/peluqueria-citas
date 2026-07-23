-- Datos de la empresa (nombre, teléfono, dirección), configurables desde la
-- app ("Datos de empresa"). Se muestran en la pantalla principal, en el
-- email de confirmación de cita y en la página pública de reserva (QR).
-- Fila única (id fijo a "true").
--
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de auth-policies.sql.

create table if not exists empresa (
  id boolean primary key default true,
  name text,
  phone text,
  address text,
  constraint empresa_singleton check (id)
);

insert into empresa (id, name, phone, address) values (true, 'FJML', '630431853', '')
on conflict (id) do nothing;

alter table empresa enable row level security;

-- Solo el personal autenticado (la app principal) puede leer y modificar los
-- datos de empresa.
drop policy if exists "authenticated access" on empresa;
create policy "authenticated access" on empresa
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Lectura pública: necesaria para mostrar el nombre y el teléfono en la
-- página de autorreserva (reservar.html), abierta sin haber iniciado sesión,
-- y desde la Edge Function que envía el email de confirmación.
drop policy if exists "public read empresa" on empresa;
create policy "public read empresa" on empresa
  for select to anon using (true);

alter publication supabase_realtime add table empresa;
