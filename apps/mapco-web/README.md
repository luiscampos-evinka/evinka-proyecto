# MapCo Web MVP

Mapa web para detectar hosts potenciales para cargadores EV.

## Qué hace
- mapa interactivo
- filtros por ciudad, zona y categoría
- búsqueda por operador / sede
- ranking de operadores
- estados del dato y parking probable

## Estructura
- `public/` → frontend estático
- `public/data/` → dataset y salidas generadas

## Nota de negocio
Se usa `ubigeo` como nombre funcional del campo territorial, aunque en Colombia el equivalente sea DIVIPOLA.

## Siguiente fase
Cargar el dataset real por ciudad y seguir refinando el scoring.
