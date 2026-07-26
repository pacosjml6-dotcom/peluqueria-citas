# Configurar el envío del código de confirmación (Brevo)

Sin un dominio propio verificado, no se puede usar un proveedor que exija
verificación por DNS (como Resend en su modo gratuito, que solo entrega
correos a la dirección con la que te diste de alta). Brevo permite enviar a
cualquier destinatario verificando solo la dirección remitente con un clic,
sin tocar DNS.

## 1. Cuenta y remitente en Brevo

1. Crea una cuenta gratuita en https://www.brevo.com (plan gratuito: 300
   correos/día, de sobra para esto).
2. Ve a **Settings → Senders, Domains & Dedicated IPs → Senders → Add a
   sender**. Pon un nombre (p. ej. "Confirmación de cita") y el correo desde
   el que quieres que salgan los códigos (puede ser tu propio Gmail u otro
   que uses habitualmente).
3. Brevo te manda un correo de confirmación a esa dirección: ábrelo y pulsa
   el enlace para verificarla. Sin este paso, el envío fallará.

## 2. Clave de API

En **Settings → SMTP & API → API Keys → Generate a new API key**. Copia la
clave (empieza por `xkeysib-`), solo se muestra una vez.

## 3. Configurar los secretos en Supabase

En el dashboard del proyecto: **Edge Functions → send-booking-otp →
Secrets** (o con la CLI, si la tienes instalada):

```
supabase secrets set BREVO_API_KEY=xkeysib-xxxxxxxx
supabase secrets set BOOKING_OTP_FROM_EMAIL=el-correo-que-verificaste@ejemplo.com
supabase secrets set BOOKING_OTP_FROM_NAME="Confirmación de cita"
```

`BOOKING_OTP_FROM_EMAIL` tiene que coincidir exactamente con el remitente
verificado en el paso 1, letra por letra, o Brevo rechazará el envío.

Puedes borrar el secreto `RESEND_API_KEY` si ya no lo usas para nada más.

## 4. Volver a desplegar la función

Después de cambiar el código o los secretos:

```
supabase functions deploy send-booking-otp
```

Si no tienes la CLI instalada, puedes pegar el contenido de `index.ts` en el
editor de la función desde el dashboard de Supabase (Edge Functions →
send-booking-otp → Code) y desplegar desde ahí.

## 5. Probar

Reserva una cita de prueba desde `reservar.html` con un correo distinto al
tuyo (por ejemplo uno personal secundario o un alias) y confirma que el
código llega ahí y no a tu correo habitual.
