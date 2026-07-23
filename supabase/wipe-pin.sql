-- PIN de seguridad para poder vaciar la base de datos desde el botón
-- "Vaciar base de datos" de la app. Solo se guarda el hash (SHA-256), nunca
-- el PIN en claro. Fila única, sin ninguna política para el rol "anon": a
-- diferencia de "empresa", esta tabla no debe ser legible públicamente.
--
-- Ejecutar en el SQL Editor de Supabase.

create table if not exists app_settings (
  id boolean primary key default true,
  wipe_pin_hash text,
  constraint app_settings_singleton check (id)
);

insert into app_settings (id) values (true) on conflict (id) do nothing;

alter table app_settings enable row level security;

drop policy if exists "authenticated access" on app_settings;
create policy "authenticated access" on app_settings
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
