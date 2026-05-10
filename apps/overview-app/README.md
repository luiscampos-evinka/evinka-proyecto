# EVINKA Overview App

Overview operativo separado del chatbot.

## Qué hace
- login demo
- dashboard ejecutivo
- métricas
- alertas
- mapa operativo
- páginas de detalle
- bloque de reportes

## Datos
La salida principal vive en:
- `public/data/overview-data.json`

## Generar datos
Desde la raíz del monorepo:
```bash
node scripts/build_evinka_overview_data.mjs
```

## Ejecutar
```bash
cd apps/overview-app
npm run build:data
npm run serve
```

## Nota
La autenticación real y los reportes automáticos quedan para una fase posterior.
