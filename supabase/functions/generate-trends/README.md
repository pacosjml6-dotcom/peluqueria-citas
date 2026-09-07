# Configurar la actualización automática de Tendencias

El contenido de la pestaña "Tendencias" (subtítulo y estilos de cada
categoría) ya no está fijo en `js/trends.js`: vive en la tabla `tendencias`
y se regenera con IA (Gemini, el mismo modelo que ya usa el asistente de
chat). Los iconos, colores y el enlace de "Ver inspiración" de cada
categoría siguen fijos en el código, solo cambia el texto.

## 1. Aplicar la migración

En el SQL Editor de Supabase (o `supabase db push`), ejecuta
`supabase/trends-content.sql`. Crea la tabla `tendencias` con el mismo
contenido que había fijo en `js/trends.js`, para que la pestaña no aparezca
vacía hasta la primera regeneración.

## 2. Desplegar la Edge Function

```
supabase functions deploy generate-trends
```

Sin `--no-verify-jwt`: a diferencia de `send-satisfaction-survey` o
`rate-appointment`, esta función solo la invocan la propia app (con la
sesión del usuario logueado) o el cron (con la service role key), así que
puede quedarse con la verificación de JWT por defecto.

## 3. Secretos

Si ya tienes configurado `GEMINI_API_KEY` (lo usa `chat-assistant`), no
hace falta nada más.

## 4. Programar la actualización mensual (opcional)

Ejecuta `supabase/trends-content-cron.sql` en el SQL Editor, sustituyendo
`project_ref` y `SERVICE_ROLE_KEY_AQUI` (Project Settings → API → `service_role`
key — no la subas nunca al repositorio). Programa una regeneración
automática el día 1 de cada mes.

No es imprescindible: desde la app hay un botón "Actualizar tendencias"
que llama a esta misma función a mano, en el momento en que se quiera.

## 5. Probar

- Pulsa "Actualizar tendencias" en la pestaña Tendencias de la app.
- O invócala a mano:
  ```
  curl -X POST https://project_ref.supabase.co/functions/v1/generate-trends \
    -H "Authorization: Bearer LA_ANON_O_SERVICE_ROLE_KEY"
  ```
- El contenido debería refrescarse (compáralo con lo que había antes;
  Gemini no siempre cambia gran cosa de una vez a otra, es normal).
