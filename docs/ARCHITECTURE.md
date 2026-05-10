# EVINKA monorepo architecture

## Raíz
- `apps/` → aplicaciones separadas por frente
- `src/` → servicios Node compartidos
- `scripts/` → utilidades, generadores y pruebas
- `docs/` → guía, specs y mapa operativo
- `data/` → datos locales y estados compartidos
- `deliverables/` → notas de entrega y artefactos de release

## Apps
- `apps/evinka-suite` → app principal Flutter de EVINKA
- `apps/cotizador-web` → cotizador web Node
- `apps/advisor-inbox` → bandeja humana del asesor
- `apps/bioplasticoeduca-web` → wrapper web/Android con Capacitor
- `apps/mapco-web` → mapa de prospecting EVINKA
- `apps/overview-app` → overview operativo
- `apps/stock-web-v1` → tablero de stock
- `apps/google-cotizador-mvp` → MVP Google Apps Script

## Backend / shared services
- `src/chatbotEngine.mjs`
- `src/evinka_api_service` and services auxiliares
- `src/metaWebhookServer.mjs`
- `src/statusAuthServer.mjs`
- `src/mapcoAuthServer.mjs`
- `src/advisorInboxServer.mjs`

## Criterio
Cada frente vive separado para facilitar:
- despliegues independientes
- commits pequeños
- revisión por equipo
- mantenimiento sin mezclar dominios
