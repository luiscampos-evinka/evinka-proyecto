# Cómo generar el APK - EVINKA Conformidad (integrada con cotizador)

## Qué hace esta versión
- Carga una orden EVINKA desde el cotizador (`ORD-...` o `COT-...`)
- Precarga datos base de cliente / instalación
- Genera PDF de conformidad
- Guarda historial local
- Sube evidencia a Firebase
- Sincroniza el cierre con el cotizador EVINKA

## Requisitos
- Flutter SDK
- Java 17
- Android SDK
- `google-services.json` ya incluido en `android/app/`

## Compilación
```bash
flutter pub get
flutter build apk --release
```

## Salida esperada
```bash
build/app/outputs/flutter-apk/app-release.apk
```

## Backend esperado
La app consulta:
- `https://cotizador.evinka.net/api/mobile/orders/:id`
- `https://cotizador.evinka.net/api/mobile/conformities`

Con header interno de app configurado en el código.

## Flujo esperado
1. Aceptar cotización en el cotizador
2. Crear orden de instalación
3. Abrir la app EVINKA Conformidad
4. Cargar orden por código
5. Completar protocolo
6. Generar PDF y sincronizar cierre
