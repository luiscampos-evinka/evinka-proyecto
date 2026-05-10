# EVINKA Cotizador Web

Cotizador web principal de EVINKA.

## Qué hace
- login técnico/admin
- cotización guiada
- selección de perfil comercial
- selección de cargador y cable
- cálculo subtotal / IGV / total
- generación de PDF
- persistencia local en JSON
- panel admin de configuración

## Estructura
- `public/` → frontend
- `server.mjs` → backend HTTP
- `data/` → estado y registros
- `storage/quotes/` → PDFs generados

## Ejecutar
Desde la raíz:
```bash
node apps/cotizador-web/server.mjs
```

## Nota
La app vive separada para poder desplegarla y auditarla sin tocar la app Flutter principal.
