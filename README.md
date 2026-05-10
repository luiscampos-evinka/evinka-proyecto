# EVINKA monorepo

Repositorio central ordenado por frentes.

## Qué hay aquí
- `apps/` → aplicaciones separadas
- `src/` → servicios Node compartidos
- `scripts/` → utilidades, pruebas y generadores
- `data/` → datos locales y estados compartidos
- `docs/` → arquitectura, deploy y guías
- `deliverables/` → notas de entrega y artefactos

## Cómo leer el repo
Empieza por:
- `docs/START_HERE.md`
- `docs/ARCHITECTURE.md`
- `docs/DEPLOYMENT.md`

## Apps principales
- `apps/evinka-suite` → app Flutter principal
- `apps/cotizador-web` → cotizador web
- `apps/advisor-inbox` → bandeja humana
- `apps/bioplasticoeduca-web` → wrapper Android/web
- `apps/mapco-web` → MapCo prospecting
- `apps/overview-app` → overview operativo
- `apps/stock-web-v1` → stock web
- `apps/google-cotizador-mvp` → MVP Google Apps Script

## Comandos rápidos
```bash
npm run cotizador:web
npm run overview:web
npm run evinka:apk
npm run bioplasticoeduca:android:build
```
