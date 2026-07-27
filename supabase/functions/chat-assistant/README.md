# Configurar el asistente de chat con IA (Anthropic Claude)

Este asistente responde dudas frecuentes y consulta disponibilidad real
(nunca inventada) tanto desde el panel interno (`index.html`, personal ya
autenticado) como desde la página pública de autorreserva (`reservar.html`,
sin login). Es de solo lectura: no crea, modifica ni cancela citas; siempre
redirige al flujo de reserva/edición que ya existe en la app.

## 1. Clave de API de Anthropic

Crea una clave en https://console.anthropic.com (Settings → API Keys).

## 2. Configurar los secretos en Supabase

```
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
```

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya están disponibles
automáticamente en toda Edge Function de Supabase, no hace falta
configurarlos.

## 3. Desplegar la función SIN verificación de JWT obligatoria

El widget público (`reservar.html`) invoca esta función sin que el usuario
haya iniciado sesión, así que la verificación automática de JWT de Supabase
debe estar desactivada para esta función (igual que `send-booking-otp`). La
propia función comprueba por su cuenta, con el header `Authorization`, si
quien llama es personal autenticado o un cliente público, y ajusta lo que
puede consultar en cada caso.

```
supabase functions deploy chat-assistant --no-verify-jwt
```

Si despliegas desde el dashboard (Edge Functions → chat-assistant →
Settings), desmarca la opción "Verify JWT" antes de guardar.

## 4. Ejecutar la migración de base de datos

Ejecuta `supabase/chat-assistant.sql` en el SQL Editor de Supabase (añade la
columna `services_info` a la tabla `empresa`). Después, desde el botón
"Datos de empresa" en el panel, rellena el nuevo campo "Información de
servicios" con los servicios, duraciones y precios orientativos que quieras
que el asistente pueda ofrecer — si lo dejas vacío, el asistente avisará al
cliente de que consulte los precios llamando al salón.

## 5. Probar

- Desde `index.html` (con sesión iniciada): el asistente puede buscar citas
  de cualquier cliente por nombre, teléfono o correo.
- Desde `reservar.html` (sin sesión): el asistente solo puede mostrar las
  citas futuras de quien facilite, en el propio chat, el mismo teléfono Y
  correo con los que reservó.

## Notas de seguridad

- La clave de Anthropic nunca se envía al navegador: todas las llamadas al
  modelo y a Supabase ocurren dentro de esta función, con la `service role`.
- El modo "público" solo puede leer datos ya expuestos por el resto de la
  app (empleados, horario, huecos libres) o las citas del propio cliente,
  verificado por teléfono + correo exactos.
- Si en el futuro se quiere reforzar la verificación en el modo público
  (por ejemplo, exigiendo un código OTP como en la reserva), se puede
  reutilizar el mecanismo de `supabase/booking-otp.sql`.
- Cada petición limita el número de vueltas del bucle de herramientas
  (`MAX_TOOL_ITERATIONS`) y el tamaño del historial de conversación enviado
  al modelo, para acotar el coste y la latencia por mensaje.
