# MVP Google Cotizador EVINKA

Cotizador mínimo en Google Apps Script.

## Qué hace
- crea el Google Form de visita técnica
- conecta el Form al Google Sheet
- crea hojas base
- instala trigger `onFormSubmit`
- calcula cotización
- genera PDF básico
- envía correo de revisión

## Archivos
- `Code.gs`
- `appsscript.json`

## Uso
1. Pegar los archivos en Apps Script.
2. Ajustar `CONFIG.reviewEmail`.
3. Ejecutar `bootstrapMvp()` o `resetMvpFromScratch()`.

## Nota
Sirve como base funcional, no como producto final.
