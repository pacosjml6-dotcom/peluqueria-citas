-- Anade el estado de pago de cada cita: pendiente de cobro (por defecto) o cobrada.
--
-- Ejecutar en el SQL Editor de Supabase.

alter table citas add column if not exists paid boolean not null default false;
