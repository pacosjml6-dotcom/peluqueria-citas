-- Permite la autorreserva de citas por parte del cliente desde el enlace del
-- código QR (pantalla "reservar.html"), sin necesitar iniciar sesión, y sin
-- exponer los datos de contacto (nombre/teléfono/email) de citas ni clientes
-- ya existentes a usuarios anónimos.
--
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de auth-policies.sql.

-- 1) Lectura pública de empleados y horario: necesaria para mostrar en el
--    formulario el listado de profesionales y las horas disponibles según el
--    horario laboral configurado.
drop policy if exists "public read employees" on empleados;
create policy "public read employees" on empleados
  for select to anon using (true);

drop policy if exists "public read horario" on horario;
create policy "public read horario" on horario
  for select to anon using (true);

-- 2) Alta pública de citas: cualquiera con el enlace puede crear una cita
--    nueva, pero no puede leer, modificar ni borrar las citas existentes
--    (eso sigue restringido a usuarios autenticados por auth-policies.sql).
drop policy if exists "public insert appointments" on citas;
create policy "public insert appointments" on citas
  for insert to anon with check (true);

-- 3) Función para comprobar qué huecos están ya ocupados (empleado + hora)
--    sin exponer nombre, teléfono, email ni notas de las citas existentes.
--    security definer + search_path fijo para que funcione pese a que la
--    tabla "citas" tiene RLS activado y el rol "anon" no tiene permiso de
--    SELECT directo sobre ella.
create or replace function public_occupied_slots(p_date date)
returns table(employee_id uuid, "time" text)
language sql
security definer
set search_path = public
stable
as $$
  select citas.employee_id, citas.time from citas where citas.date = p_date;
$$;

revoke all on function public_occupied_slots(date) from public;
grant execute on function public_occupied_slots(date) to anon, authenticated;
