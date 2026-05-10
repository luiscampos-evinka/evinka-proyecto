# Shared Node services

Servicios Node compartidos por varias apps del monorepo.

## Archivos principales
- `chatbotEngine.mjs` → motor conversacional
- `microsoftGraph.mjs` → correo y Microsoft Graph
- `supabase.mjs` → cliente Supabase REST
- `whatsappMeta.mjs` → integración WhatsApp Meta
- `receiptOcr.mjs` → OCR y extracción de recibos
- `statusAuthServer.mjs` → auth/estado del Status EVINKA
- `mapcoAuthServer.mjs` → auth de MapCo
- `advisorInboxServer.mjs` → backend de la bandeja humana
- `advisorInboxState.mjs` / `advisorMediaStore.mjs` → estado y adjuntos
- `metaWebhookServer.mjs` → webhook de entrada

## Cómo se usan
Estos módulos los consumen scripts y servidores del repo. No son apps independientes.
