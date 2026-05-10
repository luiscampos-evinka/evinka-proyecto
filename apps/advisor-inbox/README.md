# EVINKA Advisor Inbox

Bandeja humana para tomar handoffs de WhatsApp y atender conversaciones derivadas.

## Qué hace
- login
- lista de conversaciones / sesiones
- detalle del hilo
- acciones humanas para seguir o cerrar una conversación
- manejo de adjuntos y media

## Estructura
- `public/` → frontend estático
- `data/` → sesiones locales
- backend en `src/advisorInboxServer.mjs`

## Uso
Se sirve como web app interna, conectada a los servicios compartidos del monorepo.

## Nota
Está aislada del chatbot para no mezclar atención humana con el flujo automático.
