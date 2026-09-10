// Manda un correo de encuesta de satisfacción (valorar de 1 a 5 estrellas)
// por cada cita que ya haya pasado y para la que aún no se haya enviado.
// Pensada para invocarse periódicamente (cada pocos minutos) desde un cron
// de Supabase (pg_cron + pg_net, ver supabase/satisfaction-survey-cron.sql),
// no desde la app. Reutiliza el remitente de Brevo ya verificado para
// "send-booking-otp" salvo que se configuren secretos propios.
//
// Protegida con un secreto compartido (cabecera "x-cron-secret") para que
// no cualquiera pueda invocarla y forzar el envío de correos antes de
// tiempo: si se define el secreto CRON_SECRET, hay que mandarlo o se
// rechaza la petición.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')!;
const EMAIL_FROM_ADDRESS = Deno.env.get('SURVEY_FROM_EMAIL') || Deno.env.get('BOOKING_OTP_FROM_EMAIL')!;
const EMAIL_FROM_NAME = Deno.env.get('SURVEY_FROM_NAME') || Deno.env.get('BOOKING_OTP_FROM_NAME') || 'Tu opinión nos importa';
const CRON_SECRET = Deno.env.get('CRON_SECRET') || '';

// Una cita se considera "pasada" (lista para encuestar) 2 minutos después de
// su hora de inicio.
const SURVEY_DELAY_MINUTES = 2;
// Tope por ejecución: evita mandar cientos de correos de golpe si el cron
// estuvo parado un tiempo, y se mantiene por debajo del límite diario
// gratuito de Brevo (300/día).
const MAX_PER_RUN = 30;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Content-Type': 'application/json',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
}

// "Ahora" en la hora local de España (la app guarda fecha/hora de las citas
// tal cual las introduce el salón, sin zona horaria), para no desfasar la
// comparación por estar el servidor de la función en UTC.
function nowInMadrid(): { dateStr: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const dateStr = `${get('year')}-${get('month')}-${get('day')}`;
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));
  return { dateStr, minutes };
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function formatSpanishDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (CRON_SECRET && req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { dateStr: today, minutes: nowMinutes } = nowInMadrid();

  // Candidatas: cualquier cita sin encuesta enviada, con fecha hasta hoy
  // (las de días anteriores siempre están "pasadas"; las de hoy se filtran
  // por hora justo debajo). No hace falta descartar fechas futuras: nunca
  // cumplirán el filtro de abajo.
  const { data: candidates, error: fetchError } = await admin
    .from('citas')
    .select('id, name, email, date, time, survey_token')
    .is('survey_sent_at', null)
    .lte('date', today)
    .order('date', { ascending: true })
    .limit(200);

  if (fetchError) {
    console.error('No se pudieron leer las citas pendientes de encuesta', fetchError);
    return jsonResponse({ ok: false, error: 'server_error' }, 500);
  }

  const due = (candidates || []).filter((c) => {
    if (c.date < today) return true;
    return nowMinutes - timeToMinutes(c.time) >= SURVEY_DELAY_MINUTES;
  }).slice(0, MAX_PER_RUN);

  if (due.length === 0) {
    return jsonResponse({ ok: true, sent: 0 });
  }

  const { data: company } = await admin.from('empresa').select('name, phone').eq('id', true).maybeSingle();
  const companyName = company?.name || '';
  const companyLine = company && (company.name || company.phone)
    ? `<p>${[company.name, company.phone].filter(Boolean).map(escapeHtml).join(' · ')}</p>`
    : '';

  const STAR_LABELS = ['Muy mala', 'Mala', 'Normal', 'Buena', 'Excelente'];
  let sent = 0;
  const failedIds: string[] = [];

  for (const appt of due) {
    const starsRow = [1, 2, 3, 4, 5].map((n) => {
      const link = `${SUPABASE_URL}/functions/v1/rate-appointment?id=${appt.id}&token=${appt.survey_token}&rating=${n}`;
      const stars = '★'.repeat(n) + '☆'.repeat(5 - n);
      return `<tr><td style="padding:4px 0;">
        <a href="${link}" style="display:block; text-decoration:none; border:1px solid #e7e7e2; border-radius:10px;
           padding:10px 14px; color:#171716; font-family:sans-serif;">
          <span style="color:#d9a441; font-size:18px; letter-spacing:2px;">${stars}</span>
          <span style="margin-left:8px; font-size:13px; color:#5a5a56;">${STAR_LABELS[n - 1]}</span>
        </a></td></tr>`;
    }).join('');

    const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: EMAIL_FROM_NAME, email: EMAIL_FROM_ADDRESS },
        to: [{ email: appt.email, name: appt.name }],
        subject: 'Valoración de tu cita',
        htmlContent: `${companyLine}
          <h2 style="margin:0 0 12px; font-size:18px;">Valoración de tu cita</h2>
          <p>Hola ${escapeHtml(appt.name)},</p>
          <p>Gracias por venir${companyName ? ` a ${escapeHtml(companyName)}` : ''} el ${formatSpanishDate(appt.date)}. ¿Cómo valorarías tu experiencia?</p>
          <table cellpadding="0" cellspacing="0" style="margin:16px 0;">${starsRow}</table>
          <p style="font-size:12px; color:#8a8a86;">Solo tienes que pulsar una opción, no hace falta nada más.</p>`,
      }),
    });

    if (emailRes.ok) {
      const { error: updateError } = await admin
        .from('citas')
        .update({ survey_sent_at: new Date().toISOString() })
        .eq('id', appt.id);
      if (updateError) {
        console.error(`Correo enviado pero no se pudo marcar la cita ${appt.id}`, updateError);
        failedIds.push(appt.id);
      } else {
        sent += 1;
      }
    } else {
      console.error(`Brevo respondió con error para la cita ${appt.id}`, await emailRes.text());
      failedIds.push(appt.id);
    }
  }

  return jsonResponse({ ok: true, sent, failed: failedIds.length });
});
