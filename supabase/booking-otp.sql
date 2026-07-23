-- Verificación por código antes de crear una cita desde el enlace público
-- (reservar.html). El cliente rellena el formulario, se le envía un código
-- de 6 dígitos por correo (lo manda la Edge Function "send-booking-otp") y
-- solo si lo introduce a tiempo se llega a crear la cita.
--
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de public-booking-policies.sql.

-- 1) Tabla donde se guarda cada solicitud de código mientras está pendiente
--    de confirmar. No se guarda el código en claro, solo su hash. RLS
--    activado y SIN políticas para anon/authenticated: solo es accesible
--    desde la Edge Function (con la service role key) y desde la función
--    verify_appointment_otp() de más abajo (security definer).
create table if not exists reserva_otp (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  payload jsonb not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists reserva_otp_email_idx on reserva_otp (email, created_at);

alter table reserva_otp enable row level security;

-- 2) Ya no se permite crear citas directamente desde el cliente anónimo:
--    a partir de ahora toda cita pública tiene que pasar por el código de
--    verificación, así que se retira el permiso de inserción directa que
--    se dio en public-booking-policies.sql.
drop policy if exists "public insert appointments" on citas;

-- 3) Comprueba el código introducido por el cliente. Si es correcto, crea la
--    cita (reutilizando los datos guardados junto al código) y borra la
--    solicitud; si no, cuenta el intento fallido. security definer para
--    poder leer reserva_otp y escribir en citas pese a que el rol "anon" no
--    tiene permiso directo sobre ninguna de las dos.
create or replace function verify_appointment_otp(p_request_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row reserva_otp;
  v_payload jsonb;
  v_conflict boolean;
  v_appt citas;
begin
  select * into v_row from reserva_otp where id = p_request_id for update;

  if v_row is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if now() > v_row.expires_at then
    delete from reserva_otp where id = p_request_id;
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  if v_row.attempts >= 5 then
    delete from reserva_otp where id = p_request_id;
    return jsonb_build_object('ok', false, 'error', 'too_many_attempts');
  end if;

  if encode(digest(p_code, 'sha256'), 'hex') <> v_row.code_hash then
    update reserva_otp set attempts = attempts + 1 where id = p_request_id;
    return jsonb_build_object('ok', false, 'error', 'invalid_code', 'attempts_left', 5 - (v_row.attempts + 1));
  end if;

  v_payload := v_row.payload;

  -- Vuelve a comprobar que el empleado sigue libre a esa hora: puede haber
  -- pasado más de un minuto entre rellenar el formulario y confirmar el código.
  v_conflict := exists (
    select 1 from citas c
    where c.employee_id = (v_payload->>'employee_id')::uuid
      and c.date = (v_payload->>'date')::date
      and abs(
        (split_part(c.time, ':', 1)::int * 60 + split_part(c.time, ':', 2)::int)
        - (split_part(v_payload->>'time', ':', 1)::int * 60 + split_part(v_payload->>'time', ':', 2)::int)
      ) < 20
  );

  if v_conflict then
    delete from reserva_otp where id = p_request_id;
    return jsonb_build_object('ok', false, 'error', 'slot_taken');
  end if;

  insert into citas (name, phone, dial_code, phone_local, email, employee_id, client_id, date, time, notes)
  values (
    v_payload->>'name',
    v_payload->>'phone',
    v_payload->>'dial_code',
    v_payload->>'phone_local',
    v_payload->>'email',
    (v_payload->>'employee_id')::uuid,
    null,
    (v_payload->>'date')::date,
    v_payload->>'time',
    v_payload->>'notes'
  )
  returning * into v_appt;

  delete from reserva_otp where id = p_request_id;

  return jsonb_build_object(
    'ok', true,
    'appointment', jsonb_build_object('date', v_appt.date, 'time', v_appt.time, 'employee_id', v_appt.employee_id)
  );
end;
$$;

revoke all on function verify_appointment_otp(uuid, text) from public;
grant execute on function verify_appointment_otp(uuid, text) to anon;
