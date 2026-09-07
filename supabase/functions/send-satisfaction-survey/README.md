# Configurar la encuesta de satisfacción por correo

Cuando una cita ya ha pasado (2 minutos después de su hora), se manda
automáticamente un correo al cliente pidiéndole que valore el servicio de 1
a 5 estrellas. Reutiliza el remitente de Brevo ya configurado para
`send-booking-otp`.

## 1. Aplicar la migración

En el SQL Editor de Supabase (o `supabase db push`), ejecuta
`supabase/satisfaction-survey.sql`. Añade a `citas` las columnas
`survey_sent_at`, `survey_token`, `rating` y `rated_at`, y marca como "ya
enviadas" todas las citas que ya hubieran pasado hasta ese momento, para
que el primer envío automático no dispare correos de golpe para todo el
historial.

## 2. Desplegar las dos Edge Functions

```
supabase functions deploy send-satisfaction-survey --no-verify-jwt
supabase functions deploy rate-appointment --no-verify-jwt
```

`--no-verify-jwt` es necesario en ambas: `rate-appointment` se abre
directamente desde el enlace del correo (sin apikey), y
`send-satisfaction-survey` la invoca el cron, no la app.

## 3. Secretos

Si ya tienes configurados `BREVO_API_KEY`, `BOOKING_OTP_FROM_EMAIL` y
`BOOKING_OTP_FROM_NAME` (de `send-booking-otp`), no hace falta nada más:
esta función los reutiliza como remitente. Si prefieres un remitente o
nombre distintos para estos correos en concreto (debe ser una dirección
también verificada en Brevo), puedes definir:

```
supabase secrets set SURVEY_FROM_EMAIL=el-correo-verificado@ejemplo.com
supabase secrets set SURVEY_FROM_NAME="Tu opinión nos importa"
```

Además, define un secreto para que nadie más pueda disparar el envío de
correos llamando directamente a la función:

```
supabase secrets set CRON_SECRET=una-cadena-larga-y-aleatoria
```

## 4. Programar el envío automático

Ejecuta `supabase/satisfaction-survey-cron.sql` en el SQL Editor,
sustituyendo antes `project_ref` (la referencia de tu proyecto, la misma
que usas en `supabase link`) y `CRON_SECRET_AQUI` por el valor que
configuraste en el paso 3. Programa la función para que se compruebe cada
minuto si hay citas pendientes de encuesta (así el correo sale poco después
de los 2 minutos de margen).

## 5. Probar

- Crea o edita una cita de prueba con fecha/hora de hace más de 2 minutos y
  un correo tuyo.
- Invoca la función a mano para no esperar al cron:
  ```
  curl -X POST https://project_ref.supabase.co/functions/v1/send-satisfaction-survey \
    -H "x-cron-secret: el-mismo-valor-que-configuraste"
  ```
- Debería llegarte el correo; al pulsar una de las opciones de estrellas
  debería abrirse una página de agradecimiento y quedar guardada la
  valoración en `citas.rating`.
