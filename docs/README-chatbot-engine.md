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

## Lo que falta después
- conectar WhatsApp real
- conectar OCR real
- conectar Microsoft Calendar real
- completar rama D de ticket/reprogramación/cancelación
- endurecer validaciones y casos borde
