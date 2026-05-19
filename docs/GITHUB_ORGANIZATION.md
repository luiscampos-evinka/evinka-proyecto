# Organización de GitHub

## Objetivo
Mantener un solo repositorio EVINKA, pero bien ordenado por frentes y sin mezclar Perú con Colombia.

## Estructura recomendada
- `apps/` → cada producto o frontend vive aquí
- `src/` → servicios backend compartidos
- `scripts/` → automatizaciones técnicas
- `docs/` → decisiones, arquitectura y operación
- `supabase/` → SQL, migraciones y configuración
- `deliverables/` → releases locales y paquetes fuera del repo

## Frentes principales hoy
1. `apps/evinka-suite`
2. `apps/cotizador-web`
3. `apps/advisor-inbox`
4. `apps/overview-app`
5. `apps/mapco-web`

## Regla de commits
Agrupar por frente, no por impulso.

Ejemplos correctos:
- `feat(evinka-suite): separa config PE/CO por flavor`
- `feat(cotizador-web): ajusta copy y labels para Colombia`
- `docs(repo): documenta organización general del monorepo`

Evitar:
- un mismo commit mezclando Flutter + cotizador + overview + scripts sin relación
- subir builds, ZIPs, PDFs demo o data viva

## Regla de ramas
- `main` → estado estable del proyecto
- ramas de trabajo por bloque concreto
  - `feat/pe-co-separation`
  - `feat/advisor-inbox-native`
  - `docs/repo-organization`

## Regla para GitHub
Antes de empujar cambios:
1. separar por bloque funcional
2. revisar `git status`
3. confirmar que no entren artefactos generados
4. verificar que la documentación refleje la nueva estructura

## Qué debe quedar fuera del repo
- `.env`
- `node_modules/`
- builds Android / Flutter
- ZIPs, APKs y backups
- data viva, storage local y temporales
- PDFs generados para demo o prueba

## Criterio PE / CO en GitHub
Aunque el repo sea único, los cambios deben dejar visible cuándo algo es:
- compartido
- específico de Perú
- específico de Colombia

Cuando aplique, nombrar variables, docs, commits y carpetas con claridad (`PE`, `CO`, `peru`, `colombia`).
