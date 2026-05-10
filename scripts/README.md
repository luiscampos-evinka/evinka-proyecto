# Scripts

Utilidades, migraciones, generadores y pruebas del monorepo.

## Grupos
- pruebas de flujo del chatbot y Supabase
- generadores de Excel y PDFs
- limpieza / scoring de MapCo
- helpers de booking y stress tests
- validadores de datos y regresiones

## Regla
Muchos scripts dependen de rutas del monorepo y de `.env`. No asumir que son portables fuera de este repo.

## Recomendación
Antes de correr uno, leer su cabecera y revisar si escribe en `data/`, `deliverables/` o en una app específica.
