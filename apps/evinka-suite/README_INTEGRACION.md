# EVINKA Conformidad · Versión integrada con Cotizador

## Qué cambia en esta versión
Esta app ya no funciona solo como protocolo aislado. Ahora está pensada para el flujo:

1. Cotización emitida
2. Cotización aceptada
3. Orden de instalación creada en el cotizador
4. La app carga esa orden
5. El técnico completa la conformidad
6. Se genera PDF y se sincroniza el cierre con el cotizador

## Punto de entrada
En la parte superior del formulario existe el bloque **ORDEN EVINKA**.

Ahí se puede ingresar:
- código de orden (`ORD-...`)
- o código de cotización (`COT-...`)

La app consulta al backend del cotizador y precarga:
- cliente
- dirección base
- marca / perfil comercial
- voltaje
- amperaje
- IDs de trazabilidad

## Qué sincroniza de vuelta
Cuando el PDF se genera y el upload a Firebase sale bien, la app envía al cotizador:
- `installationOrderId`
- `quoteId`
- datos del protocolo
- URLs del PDF
- URLs de fotos
- URLs de firmas

## Backend esperado
La app está configurada para consumir:
- `https://cotizador.evinka.net/api/mobile/orders/:id`
- `https://cotizador.evinka.net/api/mobile/conformities`

Con header:
- `x-evinka-app-key`

## Nota
La app todavía mantiene guardado local e historial en el teléfono, además del guardado en Firebase.
