-- Permite marcar los 30 minutos extra (ver citas-extra-time.sql) también
-- desde la autorreserva pública (reservar.html), y hace que el hueco quede
-- correctamente bloqueado para los demás clientes que reserven por su cuenta.
--
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de citas-extra-time.sql y
-- booking-created-by-client.sql.

-- 1) public_occupied_slots también devuelve si cada cita ocupada tiene los
--    30 minutos extra, para que el cliente calcule bien qué huecos están
--    realmente libres (mismo criterio que el panel de administración).
--    Hay que borrarla antes de recrearla: Postgres no permite cambiar con
--    "create or replace" la forma de la tabla que devuelve una función.
drop function if exists public_occupied_slots(date);
create function public_occupied_slots(p_date date)
returns table(employee_id uuid, "time" text, extra_time boolean)
language sql
security definer
set search_path = public
stable
as $$
  select citas.employee_id, citas.time, citas.extra_time from citas where citas.date = p_date;
$$;

revoke all on function public_occupied_slots(date) from public;
grant execute on function public_occupied_slots(date) to anon, authenticated;

-- 2) Vuelve a crear verify_appointment_otp (ver booking-created-by-client.sql)
--    para que la cita se cree con los 30 minutos extra si el cliente los
--    marcó en el formulario.
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

  insert into citas (name, phone, dial_code, phone_local, email, employee_id, client_id, date, time, notes, created_by_client, extra_time)
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
    v_payload->>'notes',
    true,
    coalesce((v_payload->>'extra_time')::boolean, false)
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
