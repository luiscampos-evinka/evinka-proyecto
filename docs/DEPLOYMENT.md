# EVINKA deployment guide

## 1) EVINKA Suite (Flutter)
```bash
cd apps/evinka-suite
/opt/flutter/bin/flutter pub get
JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 /opt/flutter/bin/flutter build apk --release
```
Salida típica:
- `apps/evinka-suite/build/app/outputs/flutter-apk/app-release.apk`

## 2) Cotizador web
```bash
node apps/cotizador-web/server.mjs
```
Normalmente corre en `http://localhost:3008`.

## 3) Overview app
```bash
cd apps/overview-app
npm run build:data
npm run serve
```
Normalmente corre en `http://localhost:8081`.

## 4) Bioplástico Educa
```bash
cd apps/bioplasticoeduca-web
npm run android:sync
npm run android:build:debug
```

## 5) MapCo web
- App estática para hosting web.
- Punto de entrada: `apps/mapco-web/public/index.html`
- Servir con el hosting del subdominio o un server estático.

## 6) Advisor inbox
- App estática / Node de soporte.
- Punto de entrada: `apps/advisor-inbox/public/index.html`

## 7) Google Cotizador MVP
- Google Apps Script.
- Archivos: `apps/google-cotizador-mvp/Code.gs` y `appsscript.json`

## 8) Supabase
- Esquema local preparado en `supabase/`.
- Migraciones versionadas en `supabase/migrations/`.
- Seed opcional en `supabase/seed.sql`.
- Variables frontend: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Variables backend: `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
- Al conectar GitHub ↔ Supabase, usa la rama `main` para producción y ramas preview para pruebas.

## Reglas de orden
- No mezclar data viva con código.
- No subir `node_modules`, `build`, `tmp`, `memory` ni `.env`.
- Cada release importante debe quedar versionada en `deliverables/` con nota de cambios.
