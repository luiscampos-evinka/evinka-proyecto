# EVINKA Suite

App principal Flutter de EVINKA.

## Qué hace
- login y bootstrap de sesión
- dashboard por rol
- módulo de visitas técnicas
- cotizaciones
- conformidad / protocolo
- historial
- panel admin comercial
- generación de PDF
- sync con backend / Firebase

## Piezas importantes
- `lib/main.dart` → arranque de la app
- `lib/screens/` → pantallas
- `lib/services/` → lógica de integración y PDF
- `lib/models/` → modelos de dominio
- `android/` → wrapper Android

## Build local
```bash
/opt/flutter/bin/flutter pub get
JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 /opt/flutter/bin/flutter build apk --release
```

## Archivo de integración
- `README_INTEGRACION.md` → describe el flujo integrado con el cotizador
