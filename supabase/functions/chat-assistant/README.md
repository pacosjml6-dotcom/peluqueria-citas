# Configurar el asistente de chat con IA (Google Gemini)

Este asistente responde dudas frecuentes, consulta disponibilidad real
(nunca inventada) y puede crear citas nuevas, tanto desde el panel interno
(`index.html`, personal ya autenticado) como desde la página pública de
autorreserva (`reservar.html`, sin login):

- **Modo staff**: crea la cita directamente con la herramienta
  `create_appointment`, sin pasos adicionales (el personal ya está
  autenticado).
- **Modo público**: solo puede crear una cita pasando por el mismo código de
  verificación por correo que ya usa el formulario normal de autorreserva
  (`request_appointment_otp` envía el código reutilizando internamente la
  Edge Function `send-booking-otp`; `confirm_appointment_otp` lo valida y
  crea la cita).

El asistente nunca modifica ni cancela una cita ya existente: para eso
siempre redirige al flujo de edición/cancelación que ya existe en la app.

## 1. Clave de API de Gemini

Crea una clave en https://aistudio.google.com/apikey (Google AI Studio).

## 2. Configurar los secretos en Supabase

```
supabase secrets set GEMINI_API_KEY=xxxxxxxx
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

## 5. Desplegar también `send-booking-otp` (si no estaba ya)

`request_appointment_otp` invoca internamente a la Edge Function
`send-booking-otp` (con la `service role key`, sin necesitar secretos
adicionales en `chat-assistant`). Asegúrate de que también está desplegada
sin verificación de JWT y con sus propios secretos configurados (ver
`supabase/functions/send-booking-otp/README.md`):

```
supabase functions deploy send-booking-otp --no-verify-jwt
```

## 6. Probar

- Desde `index.html` (con sesión iniciada): el asistente puede buscar citas
  de cualquier cliente por nombre, teléfono o correo, y crear una cita nueva
  directamente pidiéndoselo por chat.
- Desde `reservar.html` (sin sesión): el asistente solo puede mostrar las
  citas futuras de quien facilite, en el propio chat, el mismo teléfono Y
  correo con los que reservó, y puede crear una cita nueva pidiendo primero
  un código de verificación por correo.

## Notas de seguridad

- La clave de Gemini nunca se envía al navegador: todas las llamadas al
  modelo y a Supabase ocurren dentro de esta función, con la `service role`.
- El modo "público" solo puede leer datos ya expuestos por el resto de la
  app (empleados, horario, huecos libres) o las citas del propio cliente,
  verificado por teléfono + correo exactos.
- La creación de citas en modo público exige el mismo código de verificación
  por correo que el formulario normal de autorreserva (`reserva_otp`,
  `supabase/booking-otp.sql`) — el chat nunca puede crear una cita pública
  sin ese paso.
- Cada petición limita el número de vueltas del bucle de herramientas
  (`MAX_TOOL_ITERATIONS`) y el tamaño del historial de conversación enviado
  al modelo, para acotar el coste y la latencia por mensaje.

## Cambiar de modelo

El modelo se fija en la constante `MODEL` de `index.ts` (por defecto
`gemini-3.5-flash`). Se puede cambiar a otro modelo de Gemini que soporte
function calling sin tocar el resto del código; comprueba primero qué
modelos están disponibles para tu clave en
https://generativelanguage.googleapis.com/v1beta/models?key=TU_CLAVE,
ya que Google retira periódicamente versiones antiguas para claves nuevas.
