# EVINKA Overview App

Primera versión del overview operativo separada del chatbot.

## Qué incluye
- Login visual demo
- Dashboard ejecutivo
- Resumen por métricas
- Estaciones caídas
- Alertas activas
- Tabla de cargadores con filtros
- Mapa del Perú con Leaflet
- Bloque base para reportes mensuales
- Módulo visual de alertas WhatsApp / anti-spam

## Fuente de datos
El JSON que consume la app se genera desde HAR reales guardados en Supabase Storage (`bucket EVINKA`).

Script:
```bash
node ../scripts/build_evinka_overview_data.mjs
```

Salida:
- `public/data/overview-data.json`

## Probar localmente
```bash
cd overview-app
npm run build:data
npm run serve
```

Luego abrir:
- `http://localhost:8081`

## Nota
El login actual es visual/demo. La autenticación real, alertas WhatsApp operativas y reportes automáticos quedan como siguiente fase de integración.
