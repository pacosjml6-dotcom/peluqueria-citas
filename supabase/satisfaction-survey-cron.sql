-- Programa la Edge Function "send-satisfaction-survey" para que se ejecute
-- sola cada minuto, usando pg_cron (planificador) + pg_net (para poder
-- hacer una petición HTTP desde dentro de Postgres). Cada minuto porque la
-- cita se considera "pasada" solo 2 minutos después de su hora (ver
-- SURVEY_DELAY_MINUTES en send-satisfaction-survey/index.ts): con un cron
-- menos frecuente el correo llegaría tarde respecto a ese margen.
--
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de:
--   1. Aplicar satisfaction-survey.sql
--   2. Desplegar send-satisfaction-survey y rate-appointment (ver sus README)
--   3. Sustituir project_ref y CRON_SECRET_AQUI más abajo por los valores
--      reales (el mismo CRON_SECRET que se configure como secreto de la
--      función con `supabase secrets set CRON_SECRET=...`).
--
-- Si "create extension pg_cron" da un error de permisos, actívalo desde el
-- dashboard: Database -> Extensions -> busca "pg_cron" y "pg_net" -> Enable.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('send-satisfaction-survey-minutely')
where exists (select 1 from cron.job where jobname = 'send-satisfaction-survey-minutely');

select cron.schedule(
  'send-satisfaction-survey-minutely',
  '* * * * *', -- cada minuto
  $$
  select net.http_post(
    url := 'https://project_ref.supabase.co/functions/v1/send-satisfaction-survey',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'CRON_SECRET_AQUI'),
    body := '{}'::jsonb
  );
  $$
);

-- Para comprobar que está programado:
--   select jobid, jobname, schedule, active from cron.job;
-- Para ver el historial de ejecuciones:
--   select * from cron.job_run_details order by start_time desc limit 20;
-- Para desactivarlo sin borrarlo: select cron.alter_job((select jobid from cron.job where jobname = 'send-satisfaction-survey-minutely'), active := false);
