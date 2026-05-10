# MVP Google Cotizador EVINKA

## Qué hace
- Crea el Google Form de visita técnica.
- Conecta el Form al Google Sheet indicado.
- Crea hojas base: `CONFIG`, `CATALOGO_PRECIOS`, `COTIZACIONES`.
- Instala trigger `onFormSubmit`.
- Calcula cotización de instalación.
- Genera un PDF básico en la carpeta de Drive indicada.
- Envía correo de revisión a Raúl + Luis.

## IDs usados
- Spreadsheet: `1XMksioNHwpo32wIHmEW-N3oD1QRZp4dgi_OkotEMjvM`
- Drive folder: `1WLDzC5XpC7C2xK5y6ESu12cba8Zp4pfX`

## Antes de ejecutar
1. Ajustar `CONFIG.reviewEmail` en `Code.gs` si el correo real de Raúl no es `raul@evinka.tech`.
2. Abrir el Google Sheet.
3. Ir a **Extensiones → Apps Script**.
4. Pegar `Code.gs` y `appsscript.json`.
5. Si quieres empezar limpio total, ejecuta `resetMvpFromScratch()`.
6. Si no, ejecuta `bootstrapMvp()`.
7. Acepta permisos.

## Resultado esperado
- Se crea el Form.
- El Form queda conectado al Sheet.
- Las respuestas entran a `FORM_RESPONSES_RAW`.
- Cada envío genera una fila en `COTIZACIONES`.
- Se crea un PDF en Drive.
- Se notifica por correo para revisión.
- Se aplica formato visual automático a `CONFIG`, `CATALOGO_PRECIOS` y `COTIZACIONES`.

## Si ya corriste el MVP antes
- Reemplaza `Code.gs` por la versión nueva.
- Ejecuta `refreshMvpDesign()` para aplicar solo el diseño.
- Ejecuta `syncMvpForm()` para actualizar preguntas/obligatorios del Form.
- Si quieres reinstalar todo limpio, ejecuta `resetMvpFromScratch()`.
- Si solo quieres reinstalar sin borrar el Form anterior, ejecuta `bootstrapMvp()`.

## Siguiente fase
Luego reemplazar `buildQuoteHtml_()` por la plantilla comercial final cuando Luis comparta el diseño oficial.
