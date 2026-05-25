# Integración WhatsApp Colombia + Microsoft Bookings

## Fase actual
Integración embebida dentro del bot actual de Colombia, reutilizando la UI conversacional existente y reemplazando la capa de agenda por Microsoft Bookings cuando `BOOKINGS_ENABLED=true`.

## Objetivo de esta fase
Permitir disponibilidad real, creación, reprogramación y cancelación de citas de Colombia usando Bookings + Graph, con trazabilidad local en Supabase y sin romper validaciones ni mensajes existentes del flujo actual.

## Qué falta para cerrar completamente la fase
- ejecutar prueba real end-to-end con credenciales Bookings válidas
- crear la tabla `booking_appointments_co` en Supabase
- completar documentación operativa final del flujo conversacional actualizado

---

## Archivos involucrados
- `/root/.openclaw/workspace/src/bookingsClient.mjs`
- `/root/.openclaw/workspace/src/chatbotEngine.mjs`
- `/root/.openclaw/workspace/src/metaWebhookServer.mjs`
- `/root/.openclaw/workspace/src/microsoftGraph.mjs`
- `/root/.openclaw/workspace/src/config.mjs`
- `/root/.openclaw/workspace/docs/supabase_schema_chatbot_v1.sql`
- `/root/.openclaw/workspace/scripts/test_controlled_suite.mjs`

## Arquitectura lógica

### 1. Activación
El webhook crea `ChatbotEngine` y le inyecta `bookings` desde `src/metaWebhookServer.mjs`.

### 2. Alcance
La integración Bookings se usa solo para Colombia (`CO`) y solo cuando:
- existe `bookings`
- `BOOKINGS_ENABLED` no está en `false`

### 3. Capa Graph encapsulada
`src/bookingsClient.mjs` encapsula:
- autenticación Graph reutilizando `MicrosoftGraphClient`
- resolución de `bookingBusiness`
- lectura de `services`, `staffMembers` y `customQuestions`
- disponibilidad por zona usando Bookings
- creación de citas
- actualización de fecha/hora
- cancelación
- búsqueda de cita por `appointmentId` o `whatsapp_phone`

### 4. Persistencia local
El bot sigue guardando la cita conversacional en `citas`, pero además mantiene un espejo técnico en `booking_appointments_co` para:
- idempotencia
- lookup por `whatsapp_phone`
- trazabilidad de `booking_appointment_id`
- vínculo con `id_cita`, `id_usuario` e `id_conversacion`
- snapshots de payload/respuesta Graph

### 5. Regla de identificación
La cita Bookings de Colombia se identifica por `whatsapp_phone` en formato E.164 sin `+`.

### 6. Regla de selección de horario
Ya no se autoasigna el primer horario. El usuario siempre elige un slot.

---

## Máquina de estados conversacional CO + Bookings

### Nuevo agendamiento
1. El usuario entra al flujo Colombia.
2. El bot detecta zona.
3. El bot obtiene disponibilidad real con `buildManagedColombiaSlots()` → `bookingsClient.getAvailability()`.
4. Si el usuario viene del flujo clásico día/hora, se preserva el slot elegido y se revalida antes de crear.
5. Si faltan datos, el bot usa la misma captura existente:
   - nombre
   - teléfono
   - correo
   - dirección
   - barrio
   - tipo/número de documento
   - marca del vehículo
6. En `confirmando_datos_booking_residencial`:
   - si ya existe slot elegido, se intenta crear directo con revalidación
   - si no existe slot elegido, se muestran opciones y pasa a `seleccionando_bloque_horario`
7. En `seleccionando_bloque_horario`:
   - se crea la cita en Bookings
   - se sincroniza `citas`
   - se sincroniza `booking_appointments_co`
   - se programa recordatorio WhatsApp
   - se publica la visita técnica

### Reprogramación
1. El usuario entra por menú o recordatorio.
2. Si la cita es Bookings Colombia, el bot la busca por `whatsapp_phone`.
3. Se muestran nuevos slots válidos.
4. El usuario elige uno.
5. El bot actualiza solo:
   - `startDateTime`
   - `endDateTime`
6. Luego sincroniza `citas` y `booking_appointments_co`.

### Cancelación
1. El usuario entra por menú, ticket o recordatorio.
2. Si la cita es Bookings Colombia, el bot cancela en Graph.
3. Luego marca cancelación local en `citas` y `booking_appointments_co`.

### Handoff a asesor
Se deriva a asesor cuando:
- no hay cita encontrada por `whatsapp_phone`
- se pierden 2 slots consecutivos
- hay 2 inputs no entendidos seguidos durante captura/selección
- falla Graph en creación/reprogramación/cancelación
- no quedan slots válidos de reemplazo

---

## Reglas de negocio cableadas
- mínimo desde mañana
- máximo según `service.schedulingPolicy.maximumAdvance`
- duración por `service.schedulingPolicy`
- sábados permitidos si el servicio los expone
- el bot ignora staff legacy y administradores
- el técnico no se elige en conversación
- reprogramación v1 solo mueve fecha/hora
- cancelación se puede hacer en cualquier momento

## Variables de entorno nuevas
Agregar en `.env`:

```bash
BOOKINGS_ENABLED=true
BOOKINGS_BUSINESS_ID=VisitaTecnicaCotizarInstalacion@evinka.tech
BOOKINGS_TIMEZONE=SA Pacific Standard Time
BOOKINGS_LOCAL_TIMEZONE=America/Bogota
BOOKINGS_ALLOWED_STAFF_IDS=["d6d1f1c1-aeaa-43ab-8619-fac082f9beaa","cd2460f9-0eae-4d42-954f-3f445bc963d6","cfd37644-7133-40c0-8c8c-8ff47ece13a4"]
BOOKINGS_ZONE_SERVICE_MAP_JSON={}
BOOKINGS_CUSTOM_QUESTION_IDS_JSON={}
BOOKINGS_STATE_TABLE=booking_appointments_co
```

## Contrato actual de `BookingsClient`
- `getToken()`
- `getAvailability({ zone, limit })`
- `createAppointment({ zone, slot, whatsappPhone, customer, answers, notes })`
- `updateAppointment({ appointmentId, startDate, startTime, endTime })`
- `cancelAppointment({ appointmentId, reason })`
- `getAppointment({ appointmentId, whatsappPhone })`

## Persistencia local propuesta
Tabla: `booking_appointments_co`

Campos clave:
- `booking_appointment_id`
- `idempotency_key`
- `booking_business_id`
- `booking_service_id`
- `booking_staff_id`
- `whatsapp_phone`
- `customer_phone`
- `customer_name`
- `customer_email`
- `local_date`
- `local_start_time`
- `local_end_time`
- `starts_at_local`
- `ends_at_local`
- `zone`
- `status`
- `ticket`
- `id_usuario`
- `id_conversacion`
- `id_cita`
- `graph_payload`
- `graph_last_response`
- `cancel_reason`

## Validación mínima ejecutada
Se ejecutó:

```bash
node --check src/bookingsClient.mjs
node --check src/chatbotEngine.mjs
node --check src/metaWebhookServer.mjs
node scripts/test_controlled_suite.mjs
```

Resultado:
- sintaxis OK
- suite controlada OK

## Nota importante
La parte que falta validar en vivo no es la lógica del bot, sino la conectividad real con Microsoft Bookings usando credenciales válidas del entorno.
