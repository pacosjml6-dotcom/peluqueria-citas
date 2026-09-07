// Regenera el contenido de la pestaña "Tendencias" (js/trends.js) con IA
// (Gemini, igual que "chat-assistant") y lo guarda en la tabla "tendencias"
// (ver supabase/trends-content.sql). Se invoca tanto a mano, desde el botón
// "Actualizar tendencias" del panel (con la sesión del usuario logueado),
// como automáticamente una vez al mes desde un cron de Supabase (ver
// supabase/trends-content-cron.sql, que manda la service role key como
// token de autenticación).
//
// Por eso esta función SÍ exige un JWT válido al desplegarla (a diferencia
// de send-satisfaction-survey o rate-appointment): tanto el usuario logueado
// como la service role key son JWT válidos, así que no hace falta ningún
// secreto aparte.
//
// Los iconos, colores y el enlace de "Ver inspiración" de cada categoría
// siguen fijos en js/trends.js (no son cosa de la IA); aquí solo se genera
// el subtítulo y la lista de estilos (título + descripción) de cada una.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MODEL = 'gemini-3.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// Mismas categorías fijas que TREND_CATEGORIES en js/trends.js: si se añade
// o quita una categoría ahí, hay que reflejarlo también aquí.
const CATEGORY_IDS = ['cortes', 'cortes-masculinos', 'tintes', 'peinados', 'barbas'];
const ITEMS_PER_SECTION = 4;
const MAX_TITLE_LENGTH = 60;
const MAX_DESC_LENGTH = 220;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function currentSeasonLabel(): string {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const year = now.getFullYear();
  // Estaciones meteorológicas del hemisferio norte.
  if (month === 11 || month <= 1) return `Invierno ${month === 11 ? year + 1 : year}`;
  if (month <= 4) return `Primavera ${year}`;
  if (month <= 7) return `Verano ${year}`;
  return `Otoño ${year}`;
}

function buildPrompt(): string {
  return `Eres un editor de moda capilar para una peluquería/barbería en España. Genera contenido de tendencias ACTUALES (temporada: ${currentSeasonLabel()}) para mostrar a los clientes en un salón, en español de España.

Categorías (usa EXACTAMENTE estos 5 ids, uno por categoría, sin añadir ni quitar ninguna): ${CATEGORY_IDS.join(', ')}.

Para cada categoría:
- "subtitle": una frase corta (máx. 70 caracteres) tipo "Los cortes que más se piden esta temporada".
- "items": exactamente ${ITEMS_PER_SECTION} estilos concretos y realistas, cada uno con:
  - "title": nombre del estilo, corto (máx. 40 caracteres), ej. "Bob italiano" o "Buzz cut".
  - "desc": una sola frase (máx. 160 caracteres) describiendo el estilo y por qué está de moda ahora.

Tono profesional pero cercano, como si lo escribiera la propia peluquería para sus clientes. No inventes marcas ni cites fuentes. No uses markdown ni emojis.`;
}

function geminiResponseSchema() {
  return {
    type: 'OBJECT',
    properties: {
      sections: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            id: { type: 'STRING', enum: CATEGORY_IDS },
            subtitle: { type: 'STRING' },
            items: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  title: { type: 'STRING' },
                  desc: { type: 'STRING' },
                },
                required: ['title', 'desc'],
              },
            },
          },
          required: ['id', 'subtitle', 'items'],
        },
      },
    },
    required: ['sections'],
  };
}

type TrendItem = { title: string; desc: string };
type TrendSection = { id: string; subtitle: string; items: TrendItem[] };

// Valida y sanea lo que devuelve el modelo antes de guardarlo: nunca hay que
// fiarse a ciegas de un LLM para lo que va a acabar en la base de datos y
// pintado en la pantalla de otra persona, aunque se haya pedido un JSON Schema.
function sanitizeSections(raw: unknown, fallback: TrendSection[]): { sections: TrendSection[]; usedFallback: string[] } {
  const fallbackById = new Map(fallback.map((s) => [s.id, s]));
  const usedFallback: string[] = [];
  const rawSections = Array.isArray((raw as { sections?: unknown })?.sections) ? (raw as { sections: unknown[] }).sections : [];
  const byId = new Map<string, TrendSection>();

  for (const entry of rawSections) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.id !== 'string' || !CATEGORY_IDS.includes(e.id)) continue;
    const subtitle = typeof e.subtitle === 'string' ? e.subtitle.trim().slice(0, 120) : '';
    const items: TrendItem[] = Array.isArray(e.items)
      ? (e.items as unknown[])
          .filter((it): it is Record<string, unknown> => !!it && typeof it === 'object')
          .map((it) => ({
            title: typeof it.title === 'string' ? it.title.trim().slice(0, MAX_TITLE_LENGTH) : '',
            desc: typeof it.desc === 'string' ? it.desc.trim().slice(0, MAX_DESC_LENGTH) : '',
          }))
          .filter((it) => it.title && it.desc)
          .slice(0, ITEMS_PER_SECTION)
      : [];

    if (!subtitle || items.length === 0) continue;
    byId.set(e.id, { id: e.id, subtitle, items });
  }

  const sections = CATEGORY_IDS.map((id) => {
    const generated = byId.get(id);
    if (generated) return generated;
    usedFallback.push(id);
    return fallbackById.get(id) || { id, subtitle: '', items: [] };
  });

  return { sections, usedFallback };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: current } = await admin.from('tendencias').select('data').eq('id', true).maybeSingle();
  const fallbackSections: TrendSection[] = Array.isArray(current?.data) ? current!.data : [];

  let geminiJson: unknown;
  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt() }] }],
        generationConfig: {
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
          responseSchema: geminiResponseSchema(),
        },
      }),
    });

    if (!res.ok) throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);

    const data = await res.json();
    if (data.promptFeedback?.blockReason) throw new Error(`Respuesta bloqueada: ${data.promptFeedback.blockReason}`);
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;
    if (!text) throw new Error(`Respuesta de Gemini sin contenido (finishReason: ${candidate?.finishReason || 'desconocido'})`);
    try {
      geminiJson = JSON.parse(text);
    } catch {
      throw new Error(`JSON incompleto de Gemini (finishReason: ${candidate?.finishReason || 'desconocido'}, ${text.length} caracteres)`);
    }
  } catch (err) {
    console.error('No se pudo generar el contenido de tendencias con Gemini', err);
    return jsonResponse({ ok: false, error: 'generation_failed', detail: err instanceof Error ? err.message : String(err) }, 502);
  }

  const { sections, usedFallback } = sanitizeSections(geminiJson, fallbackSections);

  const { error: upsertError } = await admin
    .from('tendencias')
    .upsert({ id: true, data: sections, generated_at: new Date().toISOString() }, { onConflict: 'id' });

  if (upsertError) {
    console.error('No se pudo guardar el contenido de tendencias generado', upsertError);
    return jsonResponse({ ok: false, error: 'save_failed' }, 500);
  }

  return jsonResponse({ ok: true, usedFallbackFor: usedFallback });
});
