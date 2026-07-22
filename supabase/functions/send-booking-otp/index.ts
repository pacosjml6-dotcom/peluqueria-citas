// Genera un código de 6 dígitos, lo guarda (solo su hash) junto a los datos
// de la cita pendiente, y se lo envía al cliente por correo con Resend.
// Se invoca desde reservar.html (js/public-booking.js) antes de crear la
// cita: la cita solo llega a crearse si el cliente introduce el código a
// tiempo, mediante verify_appointment_otp() (ver supabase/booking-otp.sql).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EMAIL_FROM = Deno.env.get('BOOKING_OTP_FROM') || 'Bella Studio <onboarding@resend.dev>';

const OTP_TTL_SECONDS = 45;
const REQUIRED_FIELDS = ['name', 'phone', 'dial_code', 'phone_local', 'email', 'employee_id', 'date', 'time'];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function randomCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const n = new DataView(bytes.buffer).getUint32(0) % 1000000;
  return String(n).padStart(6, '0');
}

async function sha256Hex(text: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  let body: { payload?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_payload' }, 400);
  }

  const payload = body.payload;
  if (!payload || typeof payload !== 'object') {
    return jsonResponse({ ok: false, error: 'invalid_payload' }, 400);
  }
  for (const field of REQUIRED_FIELDS) {
    if (!payload[field]) return jsonResponse({ ok: false, error: 'missing_field', field }, 400);
  }
  const email = String(payload.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ ok: false, error: 'invalid_email' }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Evita que se pueda usar este endpoint para bombardear a alguien con
  // correos: como máximo 3 códigos por email en el último minuto.
  const { count } = await admin
    .from('reserva_otp')
    .select('*', { count: 'exact', head: true })
    .eq('email', email)
    .gt('created_at', new Date(Date.now() - 60_000).toISOString());
  if ((count || 0) >= 3) {
    return jsonResponse({ ok: false, error: 'rate_limited' }, 429);
  }

  const code = randomCode();
  const codeHash = await sha256Hex(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();

  const { data: row, error: insertError } = await admin
    .from('reserva_otp')
    .insert({ email, code_hash: codeHash, payload, expires_at: expiresAt })
    .select('id')
    .single();

  if (insertError || !row) {
    console.error('No se pudo guardar la solicitud de código', insertError);
    return jsonResponse({ ok: false, error: 'server_error' }, 500);
  }

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: email,
      subject: 'Tu código para confirmar la cita',
      html: `<p>Hola ${escapeHtml(String(payload.name))},</p>
        <p>Tu código para confirmar la cita es:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:4px;">${code}</p>
        <p>Caduca en ${OTP_TTL_SECONDS} segundos. Si no has pedido esta cita, ignora este correo.</p>`,
    }),
  });

  if (!emailRes.ok) {
    console.error('Resend respondió con error', await emailRes.text());
    await admin.from('reserva_otp').delete().eq('id', row.id);
    return jsonResponse({ ok: false, error: 'email_failed' }, 502);
  }

  return jsonResponse({ ok: true, requestId: row.id, expiresInSeconds: OTP_TTL_SECONDS });
});
