# EVINKA Overview App

Overview operativo separado del chatbot.

## Incluye
- login demo
- dashboard ejecutivo
- métricas y alertas
- mapa operativo
- reportes mensuales

## Datos
Se genera en:
- `public/data/overview-data.json`

## Generar datos
Desde la raíz del monorepo:
```bash
node scripts/build_evinka_overview_data.mjs
```

## Ejecutar localmente
```bash
cd apps/overview-app
npm run build:data
npm run serve
```

Abre:
- `http://localhost:8081`
