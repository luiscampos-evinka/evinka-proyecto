# Probar guardado en Supabase

## Fase actual
Preparación de un probador mínimo real para Supabase.

## Qué hace
El script `scripts/test_supabase_flow.mjs` inserta un flujo de prueba completo en:
- `usuarios`
- `conversaciones`
- `perfiles_cliente`
- `citas`
- `mensajes`

## Antes de correrlo
1. Crea un archivo `.env` en la raíz del workspace.
2. Copia `.env.example` y completa:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Opcional: cambia `TEST_USER_ID`, `TEST_PHONE`, `TEST_EMAIL`

## Probar sin escribir nada
```bash
DRY_RUN=true npm run test:flow
```

## Probar escribiendo en Supabase
```bash
npm run test:flow
```

## Qué inserta
- un usuario de prueba
- una conversación completa de instalación
- un perfil_cliente coherente
- una cita confirmada
- el historial de mensajes del flujo ejemplo

## Nota
No ejecuté escrituras reales en tu Supabase. El script quedó listo para que lo corras cuando quieras.
