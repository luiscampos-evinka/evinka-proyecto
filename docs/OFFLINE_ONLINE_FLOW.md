# EVINKA offline → online flow

## Objetivo
Permitir que EVINKA Suite siga trabajando sin internet y que, cuando vuelva la conexión, suba todo de forma ordenada sin perder datos.

## Estado actual
La app ya tiene una base offline parcial:
- guarda sesión localmente
- guarda PDFs e historial en el dispositivo
- puede iniciar aunque Firebase falle
- genera documentos localmente antes de sincronizar

Pero todavía depende de internet para:
- iniciar sesión / restaurar sesión
- cargar órdenes, catálogos y cotizaciones
- subir archivos a Firebase
- sincronizar conformidad / garantía con el backend del cotizador

## Qué debe funcionar offline
### 1) Captura de trabajo
La app debe permitir completar sin red:
- formulario de conformidad
- fotos
- firmas
- observaciones
- generación de PDF
- generación de garantía

### 2) Guardado local
Cada documento debe guardarse en el teléfono con:
- PDF
- metadatos
- estado de sync
- fecha local
- ids de trazabilidad cuando existan

### 3) Cola de pendientes
Todo lo que no pudo subirse debe quedar marcado como:
- `local`
- `pending`
- `error`

## Qué debe pasar al volver internet
### Orden recomendado
1. Detectar conexión.
2. Validar sesión.
3. Subir archivos primero.
4. Enviar el registro al backend.
5. Confirmar estado final.
6. Marcar como `synced`.

### Orden real de sincronización
#### Conformidad
- subir PDF
- subir fotos
- subir firmas
- enviar payload al cotizador
- guardar estado final

#### Garantía
- subir PDF
- enviar payload al cotizador
- guardar estado final

## Reglas importantes
- Nunca borrar el trabajo local antes de confirmar subida.
- Si una subida falla, conservar el documento local.
- Si el backend responde mal, dejar `error` y permitir reintento.
- No depender de la red para terminar la acción principal del usuario.

## UX deseada
La app debería mostrar algo así:
- `Guardado local`
- `Pendiente de sincronización`
- `Sincronizado`
- `Error de sincronización`

Y una cola tipo:
- documento
- fecha
- estado
- botón reintentar

## Qué faltaría implementar
- sincronización automática en background
- resolución de conflictos si el registro ya existe en servidor
- reintentos con backoff
- alertas push cuando una sync quedó pendiente mucho tiempo

## Ya implementado en esta fase
- banner de conectividad en el dashboard
- módulo de sincronización visible como pantalla separada
- marca de documento local / pendiente / sincronizado / error
- reintento manual desde el historial
- payload local guardado para reintentar la subida luego

## Decisión de producto
La dirección correcta es **offline-first parcial**:
- el técnico puede seguir trabajando sin internet
- la sincronización queda para después
- el sistema nunca debe hacer perder el trabajo local
