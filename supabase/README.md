# Supabase

Este directorio queda listo para la integración GitHub ↔ Supabase.

## Proyecto
- Project ref: `lzveyvrdvtflywrdanis`

## Qué va aquí
- `migrations/`: migraciones SQL versionadas.
- `config.toml`: configuración de ramas/branches, auth local, storage y despliegues.
- `seed.sql`: datos de prueba para ramas preview si hacen falta.

## Flujo recomendado
1. Cambiar schema en una migración nueva.
2. Subir el commit a GitHub.
3. Dejar que Supabase Branching sincronice preview branches.
4. Mergear a `main` para producción.

## Nota
La integración GitHub de Supabase despliega migraciones nuevas, Edge Functions y buckets declarados en `config.toml` al hacer merge/push a la rama de producción.
