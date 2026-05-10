# BioPlástico Educa Web

Wrapper web/Android con Capacitor para BioPlástico Educa.

## Qué incluye
- frontend web estático
- wrapper Android
- sincronización Capacitor
- build de debug Android

## Estructura
- `public/` → app web
- `android/` → proyecto Android generado por Capacitor

## Scripts
```bash
npm run android:sync
npm run android:open
npm run android:build:debug
```

## Nota
Se mantiene separado porque su ciclo de build y publicación es distinto al resto del monorepo.
