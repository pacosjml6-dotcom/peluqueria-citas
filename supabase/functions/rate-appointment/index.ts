// Registra la valoración (1-5 estrellas) de una cita cuando el cliente pulsa
// uno de los enlaces del correo de encuesta (ver Edge Function
// "send-satisfaction-survey"). Se abre directamente desde el correo, sin
// pasar por la app y sin que el cliente inicie sesión, así que valida la
// cita por su id + un token aleatorio (citas.survey_token) en vez de exigir
// autenticación. Devuelve una página HTML autocontenida (no depende de
// css/styles.css: se sirve desde el dominio de Supabase, no desde la app).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const STAR_LABELS = ['', 'Muy mala', 'Mala', 'Normal', 'Buena', 'Excelente'];

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
}

function starsHtml(count: number): string {
  const stars = Array.from({ length: 5 }, (_, i) => (i < count ? '★' : '☆')).join('');
  return `<span style="font-size:36px;letter-spacing:4px;color:#d9a441;">${stars}</span>`;
}

function sentBadge(): string {
  return '<p class="badge">✓ Valoración enviada</p>';
}

function page(title: string, bodyHtml: string, status = 200): Response {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  body { margin:0; padding:32px 16px; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:#f1f1ee; font-family:'Inter',system-ui,sans-serif; color:#171716; box-sizing:border-box; }
  .card { max-width:420px; width:100%; background:#ffffff; border:1px solid #e7e7e2; border-radius:18px;
          padding:32px 28px; text-align:center; box-shadow:0 6px 16px rgba(20,20,25,0.06); }
  .badge { display:inline-block; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px;
           color:#1a8754; background:rgba(26,135,84,.12); padding:4px 10px; border-radius:999px; margin:0 0 14px; }
  h1 { font-size:20px; margin:16px 0 8px; }
  p { font-size:14px; line-height:1.5; color:#5a5a56; margin:0 0 4px; }
</style>
</head>
<body><div class="card">${bodyHtml}</div></body>
</html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get('id') || '';
  const token = url.searchParams.get('token') || '';
  const ratingParam = url.searchParams.get('rating') || '';
  const rating = Number(ratingParam);

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(id) || !uuidRe.test(token) || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return page('Enlace no válido', `
      <h1>Enlace no válido</h1>
      <p>Este enlace de valoración no es correcto o está incompleto.</p>`, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: appt, error } = await admin
    .from('citas')
    .select('id, name, survey_token, rating, rated_at')
    .eq('id', id)
    .maybeSingle();

  if (error || !appt || appt.survey_token !== token) {
    return page('Enlace no válido', `
      <h1>Enlace no válido</h1>
      <p>No hemos podido identificar tu cita a partir de este enlace.</p>`, 404);
  }

  if (appt.rated_at) {
    return page('Valoración ya enviada', `
      ${sentBadge()}
      ${starsHtml(appt.rating || 0)}
      <h1>Esta valoración ya se envió</h1>
      <p>La valoraste con ${appt.rating} de 5. Ya no se puede volver a enviar ni cambiar desde este enlace.</p>`);
  }

  // Update "atómico": solo escribe si SIGUE sin valorar en este mismo
  // instante (comprobado por Postgres, no por el código de arriba), para
  // blindar el caso de dos clics casi seguidos en el correo -- por
  // ejemplo, tocar dos estrellas distintas muy rápido, o abrir el mismo
  // enlace en dos pestañas -- que sin esta condición podrían colar dos
  // valoraciones distintas para la misma cita.
  const { data: updated, error: updateError } = await admin
    .from('citas')
    .update({ rating, rated_at: new Date().toISOString() })
    .eq('id', id)
    .is('rated_at', null)
    .select('rating')
    .maybeSingle();

  if (updateError) {
    console.error('No se pudo guardar la valoración', updateError);
    return page('Algo ha ido mal', `
      <h1>No se ha podido guardar</h1>
      <p>Inténtalo de nuevo en unos minutos.</p>`, 500);
  }

  if (!updated) {
    // Alguien se adelantó justo entre la comprobación de arriba y este
    // update (mismo margen de segundos): se respeta esa primera valoración.
    const { data: fresh } = await admin.from('citas').select('rating').eq('id', id).maybeSingle();
    return page('Valoración ya enviada', `
      ${sentBadge()}
      ${starsHtml(fresh?.rating || rating)}
      <h1>Esta valoración ya se envió</h1>
      <p>La valoraste con ${fresh?.rating ?? rating} de 5. Ya no se puede volver a enviar ni cambiar desde este enlace.</p>`);
  }

  return page('Valoración enviada', `
    ${sentBadge()}
    ${starsHtml(rating)}
    <h1>¡Gracias, ${escapeHtml(appt.name || '')}!</h1>
    <p>Has valorado tu cita como "${STAR_LABELS[rating]}" (${rating} de 5).</p>
    <p>Tu opinión nos ayuda a mejorar. ¡Hasta la próxima!</p>`);
});
