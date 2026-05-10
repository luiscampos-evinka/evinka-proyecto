# MapCo Web MVP

Mapa web para detectar hosts potenciales para cargadores EV.

## MVP incluido
- mapa interactivo
- filtro por ciudad
- filtro por código territorial (campo `ubigeo`)
- filtro por categoría
- búsqueda por operador/sede
- filtro de parking probable
- ranking por operador / grupo

## Nota Colombia
Para Colombia, el código territorial oficial equivalente al "ubigeo" es DIVIPOLA. En este MVP el filtro se deja como `ubigeo` para mantener el lenguaje pedido por negocio, pero el campo puede mapearse a DIVIPOLA sin problema.

## Dataset actual
`public/data/places.json`

## Siguiente paso
Cargar dataset real de Bogotá y luego replicar Medellín / Cali.
