-- Marca en la propia cita si la creó el cliente desde el QR (reservar.html)
-- o el negocio desde la agenda, para poder distinguirlas en la lista del día
-- y en las estadísticas.
--
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de booking-otp.sql.

alter table citas add column if not exists created_by_client boolean not null default false;

-- Vuelve a crear verify_appointment_otp (ver booking-otp.sql) para que, al
-- confirmar el código, la cita se cree ya marcada como creada por el cliente.
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

  insert into citas (name, phone, dial_code, phone_local, email, employee_id, client_id, date, time, notes, created_by_client)
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
    true
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
