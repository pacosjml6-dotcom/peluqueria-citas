-- Anade el indicador de "tiempo extra" (30 minutos adicionales) que se puede
-- marcar, como maximo una vez por cita, al darla de alta o editarla, por si
-- el servicio se alarga o necesita mas tiempo del habitual.
--
-- Ejecutar en el SQL Editor de Supabase.

alter table citas add column if not exists extra_time boolean not null default false;
