# EVINKA monorepo

Repositorio central de EVINKA para chatbot, cotizador, suite móvil, bandeja de asesor, status y frentes satélite.

## Estado actual del repo
- **Fase actual:** ordenar y consolidar el monorepo para seguir creciendo sin mezclar Perú y Colombia.
- **Objetivo de esta fase:** dejar claro qué frente vive dónde, qué componentes son compartidos y qué ya debe separarse por país.
- **Falta para cerrarla:** terminar de agrupar cambios pendientes en commits limpios y empujar la reorganización a GitHub.

## Estructura principal
- `apps/` → aplicaciones por frente
- `src/` → servicios Node compartidos
- `scripts/` → automatizaciones, utilidades y validaciones
- `data/` → estados y datos locales no versionados
- `docs/` → arquitectura, despliegue y decisiones operativas
- `deliverables/` → entregables y artefactos de release fuera del repo
- `supabase/` → esquema, migraciones y configuración

## Separación por país
La regla vigente del proyecto es **una sola plataforma EVINKA**, pero con separación real de contexto entre **Perú (PE)** y **Colombia (CO)**.

Puntos clave:
- configuración comercial separada por país
- cotizaciones, visitas, órdenes y conformidades aisladas por país
- app móvil con variantes PE/CO
- entregables distribuidos en carpetas independientes

Documentos clave:
- `docs/START_HERE.md`
- `docs/ARCHITECTURE.md`
- `docs/DEPLOYMENT.md`
- `docs/GITHUB_ORGANIZATION.md`
- `docs/COUNTRY_SEPARATION.md`

## Apps principales
- `apps/evinka-suite` → app Flutter principal con variantes PE/CO
- `apps/cotizador-web` → cotizador web con lógica por país
- `apps/advisor-inbox` → bandeja humana / handoff asesor
- `apps/overview-app` → overview operativo y status
- `apps/mapco-web` → prospecting / mapa
- `apps/bioplasticoeduca-web` → wrapper Android/web
- `apps/stock-web-v1` → stock web
- `apps/google-cotizador-mvp` → MVP Google Apps Script

## Comandos rápidos
```bash
npm run cotizador:web
npm run overview:web
npm run evinka:apk
npm run bioplasticoeduca:android:build
```
