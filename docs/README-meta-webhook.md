# WhatsApp Cloud API de Meta - integración inicial

## Fase actual
Webhook local conectado al motor del chatbot y a Supabase.

## Qué hace hoy
- verifica `GET /meta-webhook` con `hub.challenge`
- recibe `POST /meta-webhook` de Meta
- valida firma `x-hub-signature-256` si `META_APP_SECRET` está presente
- procesa mensajes de texto
- responde por WhatsApp Cloud API
- persiste el flujo en Supabase

## Scripts
```bash
npm run check:meta
npm run meta:webhook
```

## Variables usadas
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TOKEN`
- `META_APP_SECRET`
- `WHATSAPP_WEBHOOK_PATH`
- `PORT`

## Ruta local
- webhook: `/meta-webhook`
- health: `/health`

## Para activarlo en Meta
1. Levantar el servidor
2. Exponerlo públicamente en la URL final
3. Configurar en Meta:
   - callback URL: la pública
   - verify token: el mismo `WHATSAPP_VERIFY_TOKEN`
4. Suscribir el webhook de mensajes

## Limitaciones actuales
- solo texto
- todavía no descarga imágenes o PDFs
- todavía no usa OCR real
- todavía no consulta Microsoft Calendar real
