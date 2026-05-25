# Motor de flujo EVINKA (primera versión)

## Fase actual
Motor por estados con persistencia en Supabase y prueba local por CLI.

## Qué hace hoy
- crea/recupera `usuarios`
- crea/recupera `conversaciones`
- crea/recupera `perfiles_cliente`
- guarda todos los mensajes en `mensajes`
- actualiza `paso_actual` y `subestado_flujo`
- crea/actualiza `citas` cuando se confirma agenda
- permite probar el flujo por consola

## Scripts
```bash
npm run check:chatbot
npm run chatbot:cli
```

## Variables necesarias
Usa `.env` con:
```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
TEST_PHONE=900000001
```

## Cómo probar
1. Crea `.env`
2. Ejecuta:
```bash
npm run chatbot:cli
```
3. Escribe por ejemplo:
- `hola`
- `A`
- `A`
- `B`
- datos manuales del recibo
- `A`
- `A`
- datos de contacto
- `A`
- vehículo
- `A`
- `A`
- `C`

## Estado actual
Esto ya guarda de verdad en Supabase, pero todavía es una primera versión.

## Integración Colombia + Microsoft Bookings
Existe una implementación nueva orientada al canal Colombia que reutiliza el flujo conversacional actual del bot y cambia la capa de agenda hacia Microsoft Bookings.

Documento de referencia:
- `/root/.openclaw/workspace/docs/README-bookings-colombia.md`

Resumen:
- `src/metaWebhookServer.mjs` inyecta `BookingsClient` al motor
- `src/bookingsClient.mjs` encapsula Graph + Bookings
- `src/chatbotEngine.mjs` usa Bookings en CO para disponibilidad, creación, reprogramación y cancelación
- la selección de horario en CO ya no autoasigna el primer slot; el usuario elige explícitamente
- la trazabilidad local propuesta queda en `booking_appointments_co`

## Lo que falta después
- ejecutar prueba real end-to-end contra Bookings
- crear la tabla `booking_appointments_co` en Supabase
- endurecer validaciones y casos borde de Graph/slot perdido
