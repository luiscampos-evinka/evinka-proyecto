# EVINKA monorepo architecture

## Raíz
- `apps/` → aplicaciones separadas por frente
- `src/` → servicios Node compartidos
- `scripts/` → utilidades, generadores y pruebas
- `docs/` → guía, specs y mapa operativo
- `data/` → datos locales y estados compartidos
- `deliverables/` → artefactos de release fuera del versionado
- `supabase/` → esquema y migraciones

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
- `src/chatbotEngine.mjs` → motor conversacional / reglas de bot
- `src/metaWebhookServer.mjs` → webhook WhatsApp Meta
- `src/statusAuthServer.mjs` → auth y sesiones del status
- `src/mapcoAuthServer.mjs` → auth MapCo
- `src/advisorInboxServer.mjs` → backend de bandeja asesor
- `src/accessAudit.mjs` → auditoría de accesos
- `src/microsoftGraph.mjs` / integraciones auxiliares

## Separación PE / CO
La arquitectura vigente **no divide en dos repositorios**; divide por **contexto de país dentro del mismo monorepo**.

### Compartido
- motor base del chatbot
- servicios backend comunes
- UI base y componentes reutilizables
- utilidades de scripts, auditoría y despliegue
- esquema general de Supabase

### Separado por país
- configuración comercial
- copy y etiquetas documentales (`RUC/DNI` vs `NIT/CC`)
- host/base URL por variante
- catálogos, reglas, cotizaciones, visitas y conformidades
- entregables móviles en carpetas distintas: `deliverables/app-peru/` y `deliverables/app-colombia/`

### Regla estructural
Si un cambio puede alterar precios, catálogos, documentos o flujos operativos de un país, debe quedar preparado para que **CO no toque PE** y **PE no toque CO**.

## Criterio
Cada frente vive separado para facilitar:
- despliegues independientes
- commits pequeños
- revisión por equipo
- mantenimiento sin mezclar dominios
- evolución controlada de Perú y Colombia dentro de la misma plataforma
