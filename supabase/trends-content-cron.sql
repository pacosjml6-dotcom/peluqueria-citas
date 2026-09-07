-- Programa la Edge Function "generate-trends" para que se ejecute sola una
-- vez al mes, usando pg_cron + pg_net. A diferencia del cron de la encuesta
-- de satisfacción, esta función SÍ exige un JWT válido (no usa un secreto
-- propio), así que aquí se manda la service role key como token: es un JWT
-- válido y firmado por el propio proyecto, así que pasa la verificación.
--
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de:
--   1. Aplicar trends-content.sql
--   2. Desplegar generate-trends (ver su README) SIN --no-verify-jwt
--   3. Sustituir project_ref y SERVICE_ROLE_KEY_AQUI más abajo (Project
--      Settings -> API -> service_role key; NO la publiques en el repo).
--
-- Si "create extension pg_cron" da un error de permisos, actívalo desde el
-- dashboard: Database -> Extensions -> busca "pg_cron" y "pg_net" -> Enable.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('generate-trends-monthly')
where exists (select 1 from cron.job where jobname = 'generate-trends-monthly');

select cron.schedule(
  'generate-trends-monthly',
  '0 6 1 * *', -- a las 6:00 del día 1 de cada mes
  $$
  select net.http_post(
    url := 'https://project_ref.supabase.co/functions/v1/generate-trends',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer SERVICE_ROLE_KEY_AQUI'),
    body := '{}'::jsonb
  );
  $$
);

-- Para comprobar que está programado:
--   select jobid, jobname, schedule, active from cron.job;
-- Para ver el historial de ejecuciones:
--   select * from cron.job_run_details order by start_time desc limit 20;
-- Para desactivarlo sin borrarlo: select cron.alter_job((select jobid from cron.job where jobname = 'generate-trends-monthly'), active := false);
