# EVINKA Stock Web v1

MVP estático para control de stock disponible, stock comprometido, pedidos por llegar y alertas de reorden.

## Qué incluye
- Dashboard web responsive
- KPIs principales
- Alertas automáticas por stock crítico / riesgo
- Tabla maestra con punto de reorden
- Modo demo listo
- Conexión preparada para Google Sheets vía CSV público

## Estructura esperada de Sheets

### Hoja 1: inventario
Columnas:
- sku
- producto
- categoria
- stock_actual
- stock_comprometido
- stock_seguridad
- demanda_mensual
- lead_time_dias

### Hoja 2: ingresos
Columnas:
- sku
- producto
- cantidad
- fecha_estimada
- estado
- proveedor

## Activar modo Sheets
1. Publicar ambas hojas como CSV o exponerlas con Apps Script.
2. Abrir `public/config.js`.
3. Cambiar `useDemoData: false`.
4. Pegar las URLs en:
   - `inventoryCsvUrl`
   - `incomingCsvUrl`

## Publicación
- Este paquete está listo para subirse a un hosting estático.
- Si se va a publicar en `stock.evinka.net`, basta con copiar el contenido de `public/` al web root del subdominio.
