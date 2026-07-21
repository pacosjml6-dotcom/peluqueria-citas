-- Restringe el acceso a las tablas a usuarios autenticados (login con
-- email + contraseña), en vez del acceso público que se configuró antes.
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de crear el usuario en
-- Authentication -> Users.

drop policy if exists "public access" on empleados;
drop policy if exists "public access" on clientes;
drop policy if exists "public access" on citas;
drop policy if exists "public access" on horario;

drop policy if exists "authenticated access" on empleados;
drop policy if exists "authenticated access" on clientes;
drop policy if exists "authenticated access" on citas;
drop policy if exists "authenticated access" on horario;

create policy "authenticated access" on empleados
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated access" on clientes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated access" on citas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated access" on horario
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
