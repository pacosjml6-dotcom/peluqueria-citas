-- Encuesta de satisfacción por correo cuando una cita ya ha pasado: añade a
-- "citas" lo necesario para (a) marcar que ya se envió el correo de una cita
-- concreta, para no duplicarlo, y (b) guardar la valoración (1 a 5
-- estrellas) que el cliente da pulsando un enlace del correo, sin tener que
-- iniciar sesión.
--
-- Ejecutar en el SQL Editor de Supabase (o `supabase db push`) DESPUÉS de
-- schema.sql y company-settings.sql.

alter table citas add column if not exists survey_sent_at timestamptz;
alter table citas add column if not exists survey_token uuid not null default gen_random_uuid();
alter table citas add column if not exists rating smallint;
alter table citas add column if not exists rated_at timestamptz;

alter table citas drop constraint if exists citas_rating_range;
alter table citas add constraint citas_rating_range check (rating is null or rating between 1 and 5);

-- Acelera la consulta que hace la Edge Function "send-satisfaction-survey"
-- (citas con encuesta pendiente, ordenadas por fecha/hora).
create index if not exists citas_survey_pending_idx on citas (date, time) where survey_sent_at is null;

-- Importante: sin este backfill, la primera vez que corra el job de envío
-- intentaría mandar la encuesta de TODAS las citas ya pasadas desde que
-- existe la app. Al marcarlas aquí como "ya enviada" de golpe, el job solo
-- empieza a enviar correos para citas que pasen A PARTIR de ahora.
update citas
set survey_sent_at = now()
where survey_sent_at is null
  and (date < current_date or (date = current_date and time <= to_char(now(), 'HH24:MI')));
