# Android / APK - BioPlástico Educa

## Estado
- Wrapper Android creado con Capacitor.
- Proyecto nativo disponible en `bioplasticoeduca-web/android`.
- `webDir` apunta a `public`.
- App ID: `net.evinka.bioplasticoeduca`

## Scripts
```bash
npm run android:sync
npm run android:build:debug
npm run android:open
```

## Bloqueo actual
La compilación quedó bloqueada porque este servidor no tiene Android SDK configurado.
Gradle devuelve:

```text
SDK location not found. Define a valid SDK location with an ANDROID_HOME environment variable or by setting the sdk.dir path...
```

## También se corrigió
- Gradle estaba tomando Java 21 sin compilador completo.
- La compilación ya quedó preparada para usar Java 17:
  `/usr/lib/jvm/java-17-openjdk-amd64`

## Siguiente paso
Instalar/configurar Android SDK y luego ejecutar:

```bash
cd /root/.openclaw/workspace/bioplasticoeduca-web
npm run android:build:debug
```

Si se quiere firmar APK de release o generar AAB, eso va en una segunda pasada.
