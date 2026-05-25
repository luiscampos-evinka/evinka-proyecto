create extension if not exists pgcrypto;
create extension if not exists citext;

-- =========================================================
-- LIMPIEZA (REBUILD COMPLETO)
-- =========================================================
drop view if exists public.v_hilos_conversacion;
drop view if exists public.v_resumen_citas;

drop table if exists public.mensajes cascade;
drop table if exists public.citas cascade;
drop table if exists public.perfiles_cliente cascade;
drop table if exists public.conversaciones cascade;
drop table if exists public.usuarios cascade;

drop function if exists public.actualiza_fecha_modificacion();

-- =========================================================
-- FUNCIÓN updated_at
-- =========================================================
create or replace function public.actualiza_fecha_modificacion()
returns trigger
language plpgsql
as $$
begin
 new.actualizado_en = now();
 return new;
end;
$$;

-- =========================================================
-- 1) USUARIOS
-- =========================================================
create table public.usuarios (
 id_usuario varchar(20) not null,
 nombre_visible varchar(255) null,
 nombre_usuario varchar(255) null,
 correo_electronico citext null,
 telefono_principal varchar(30) null,
 rol_usuario varchar(20) not null default 'cliente',
 fuente_rol varchar(30) null,
 creado_en timestamptz not null default now(),
 actualizado_en timestamptz not null default now(),

 constraint usuarios_pkey primary key (id_usuario),
 constraint usuarios_correo_key unique (correo_electronico),
 constraint usuarios_telefono_check
 check (
 telefono_principal is null
 or telefono_principal ~ '^[+0-9][0-9]{7,20}$'
 ),
 constraint usuarios_rol_check
 check (rol_usuario in ('cliente', 'tecnico', 'asesor')),
 constraint usuarios_fuente_rol_check
 check (
 fuente_rol is null
 or fuente_rol in ('auto', 'manual', 'admin', 'whatsapp_role_map', 'advisor_inbox', 'migration')
 )
);

create trigger trg_usuarios_actualizado_en
before update on public.usuarios
for each row
execute function public.actualiza_fecha_modificacion();

-- =========================================================
-- 2) CONVERSACIONES
-- =========================================================
create table public.conversaciones (
 id_conversacion uuid not null default gen_random_uuid(),
 id_usuario varchar(20) not null,
 canal varchar(30) not null default 'whatsapp',
 intencion_principal varchar(50) null,
 estado_conversacion varchar(30) not null default 'open',
 paso_actual varchar(100) null,
 subestado_flujo varchar(100) null,

 dio_consentimiento boolean not null default false,
 consentimiento_fecha timestamptz null,
 consentimiento_version varchar(50) null,

 resumen text null,
 accion_ticket_actual varchar(30) null,
 codigo_ticket_solicitado varchar(50) null,
 requiere_handoff boolean not null default false,
 motivo_handoff text null,

 iniciada_en timestamptz not null default now(),
 ultimo_mensaje_en timestamptz not null default now(),
 cerrada_en timestamptz null,
 creado_en timestamptz not null default now(),
 actualizado_en timestamptz not null default now(),

 constraint conversaciones_pkey primary key (id_conversacion),

 constraint conversaciones_usuario_fkey
 foreign key (id_usuario)
 references public.usuarios(id_usuario),

 constraint conversaciones_canal_check
 check (canal in ('whatsapp', 'web_mapa')),

 constraint conversaciones_intencion_check
 check (
 intencion_principal is null
 or intencion_principal in (
 'instalacion_cargador',
 'compra_cargador',
 'hablar_con_asesor',
 'mapa_publico',
 'otro'
 )
 ),

 constraint conversaciones_estado_check
 check (estado_conversacion in ('open', 'paused', 'closed', 'handoff')),

 constraint conversaciones_accion_ticket_check
 check (
 accion_ticket_actual is null
 or accion_ticket_actual in ('confirm', 'reschedule', 'cancel')
 )
);

create trigger trg_conversaciones_actualizado_en
before update on public.conversaciones
for each row
execute function public.actualiza_fecha_modificacion();

-- =========================================================
-- 3) MENSAJES
-- =========================================================
create table public.mensajes (
 id_mensaje bigserial not null,
 id_conversacion uuid not null,
 id_usuario varchar(20) not null,
 rol varchar(20) not null,
 contenido text not null,
 tipo_mensaje varchar(30) not null default 'text',
 payload_crudo jsonb null,
 entrada_valida boolean null,
 confianza_lectura numeric(5,2) null,
 creado_en timestamptz not null default now(),

 constraint mensajes_pkey primary key (id_mensaje),

 constraint mensajes_conversacion_fkey
 foreign key (id_conversacion)
 references public.conversaciones(id_conversacion)
 on delete cascade,

 constraint mensajes_usuario_fkey
 foreign key (id_usuario)
 references public.usuarios(id_usuario),

 constraint mensajes_rol_check
 check (rol in ('user', 'assistant', 'advisor', 'system', 'tool')),

 constraint mensajes_tipo_check
 check (
 tipo_mensaje in (
 'text',
 'image',
 'audio',
 'video',
 'document',
 'location',
 'interactive',
 'template',
 'reaction',
 'system_event'
 )
 ),

 constraint mensajes_confianza_check
 check (
 confianza_lectura is null
 or (confianza_lectura >= 0 and confianza_lectura <= 1)
 )
);

-- =========================================================
-- 4) PERFIL DEL CLIENTE / PUNTO DE INSTALACIÓN
-- =========================================================
create table public.perfiles_cliente (
 id_perfil bigserial not null,
 id_usuario varchar(20) not null,
 id_conversacion uuid null,

 -- persona que recibirá la visita
 nombre_receptor varchar(255) null,
 dni_receptor varchar(20) null,
 ruc_receptor varchar(20) null,
 telefono_receptor varchar(30) null,
 correo_receptor citext null,

 -- dirección del punto de instalación
 direccion_instalacion text null,
 distrito_instalacion varchar(100) null,
 provincia_instalacion varchar(100) null,
 zona_cliente varchar(100) null,
 referencias_instalacion text null,

 -- vehículo
 marca_vehiculo varchar(100) null,
 modelo_vehiculo varchar(100) null,

 -- recibo de luz
 titular_recibo varchar(255) null,
 direccion_recibo text null,
 distrito_recibo varchar(100) null,
 provincia_recibo varchar(100) null,
 potencia_kw numeric(10,2) null,
 fase_electrica varchar(30) null,

 validacion_recibo boolean not null default false,
 origen_recibo varchar(30) null default 'manual',
 recibo_url text null,
 recibo_nombre_archivo varchar(255) null,
 recibo_tipo_archivo varchar(100) null,
 lectura_recibo_exitosa boolean not null default false,
 datos_recibo_extraidos jsonb null,
 datos_recibo_manuales jsonb null,
 campos_faltantes_recibo jsonb null,
 notas_recibo text null,
 direccion_instalacion_coincide_con_recibo boolean null,

 estado_perfil varchar(30) not null default 'incomplete',
 creado_en timestamptz not null default now(),
 actualizado_en timestamptz not null default now(),

 constraint perfiles_cliente_pkey primary key (id_perfil),

 constraint perfiles_cliente_usuario_fkey
 foreign key (id_usuario)
 references public.usuarios(id_usuario),

 constraint perfiles_cliente_conversacion_fkey
 foreign key (id_conversacion)
 references public.conversaciones(id_conversacion)
 on delete set null,

 constraint perfiles_cliente_estado_check
 check (estado_perfil in ('incomplete', 'ready_for_schedule', 'scheduled')),

 constraint perfiles_cliente_origen_recibo_check
 check (
 origen_recibo is null
 or origen_recibo in ('manual', 'image', 'pdf', 'vision', 'ocr')
 ),

 constraint perfiles_cliente_fase_check
 check (
 fase_electrica is null
 or fase_electrica in ('monofasica', 'trifasica', 'no_definido')
 ),

 constraint perfiles_cliente_dni_receptor_check
 check (
 dni_receptor is null
 or dni_receptor ~ '^[0-9]{8,20}$'
 ),

 constraint perfiles_cliente_ruc_receptor_check
 check (
 ruc_receptor is null
 or ruc_receptor ~ '^[0-9]{11,20}$'
 ),

 constraint perfiles_cliente_telefono_receptor_check
 check (
 telefono_receptor is null
 or telefono_receptor ~ '^[+0-9][0-9]{7,20}$'
 ),

 constraint perfiles_cliente_potencia_check
 check (
 potencia_kw is null
 or potencia_kw >= 0
 )
);

create unique index uq_perfiles_cliente_conversacion
 on public.perfiles_cliente(id_conversacion)
 where id_conversacion is not null;

create index idx_perfiles_cliente_usuario
 on public.perfiles_cliente(id_usuario);

create index idx_perfiles_cliente_conversacion
 on public.perfiles_cliente(id_conversacion);

create index idx_perfiles_cliente_dni_receptor
 on public.perfiles_cliente(dni_receptor);

create index idx_perfiles_cliente_telefono_receptor
 on public.perfiles_cliente(telefono_receptor);

create trigger trg_perfiles_cliente_actualizado_en
before update on public.perfiles_cliente
for each row
execute function public.actualiza_fecha_modificacion();

-- =========================================================
-- 5) CITAS / TICKETS
-- =========================================================
create table public.citas (
 id_cita bigserial not null,
 id_usuario varchar(20) not null,
 id_conversacion uuid null,
 id_perfil bigint null,

 creado_en timestamptz not null default now(),
 actualizado_en timestamptz not null default now(),

 -- ticket / código
 codigo_cita varchar(50) not null,

 fecha_cita date not null,
 hora_inicio time not null,
 hora_fin time null,
 fecha_hora_inicio timestamptz not null,
 fecha_hora_fin timestamptz null,

 -- snapshot del cliente al reservar
 nombre_cliente varchar(255) not null,
 telefono_cliente varchar(30) null,
 dni_cliente varchar(20) null,
 correo_cliente citext null,

 direccion_cita text null,
 distrito_cita varchar(100) null,
 provincia_cita varchar(100) null,
 zona_cliente varchar(100) null,
 zona_dia varchar(100) null,
 control_zona varchar(100) null,
 etiqueta_horario varchar(20) null,

 marca_vehiculo varchar(100) null,
 modelo_vehiculo varchar(100) null,
 potencia_kw numeric(10,2) null,
 fase_electrica varchar(30) null,
 validacion_recibo boolean not null default false,

 estado_cita varchar(30) not null default 'pendiente',
 aprobacion varchar(30) not null default 'pendiente',

 observaciones text null,
 motivo_reprogramacion text null,
 motivo_cancelacion text null,

 google_event_id text null,
 microsoft_event_id text null,
 notificacion_24h_enviada boolean not null default false,
 notificacion_2h_enviada boolean not null default false,
 confirmada_por_cliente boolean not null default false,
 confirmada_en timestamptz null,
 cancelada_en timestamptz null,

 constraint citas_pkey primary key (id_cita),

 constraint citas_codigo_key unique (codigo_cita),
 constraint citas_google_event_id_key unique (google_event_id),
 constraint citas_microsoft_event_id_key unique (microsoft_event_id),

 constraint citas_usuario_fkey
 foreign key (id_usuario)
 references public.usuarios(id_usuario),

 constraint citas_conversacion_fkey
 foreign key (id_conversacion)
 references public.conversaciones(id_conversacion)
 on delete set null,

 constraint citas_perfil_fkey
 foreign key (id_perfil)
 references public.perfiles_cliente(id_perfil)
 on delete set null,

 constraint citas_estado_check
 check (
 estado_cita in (
 'pendiente',
 'confirmada',
 'en_proceso',
 'completada',
 'reprogramada',
 'cancelada'
 )
 ),

 constraint citas_aprobacion_check
 check (
 aprobacion in ('pendiente', 'aprobada', 'rechazada')
 ),

 constraint citas_fase_check
 check (
 fase_electrica is null
 or fase_electrica in ('monofasica', 'trifasica', 'no_definido')
 ),

 constraint citas_dni_cliente_check
 check (
 dni_cliente is null
 or dni_cliente ~ '^[0-9]{8,20}$'
 ),

 constraint citas_telefono_cliente_check
 check (
 telefono_cliente is null
 or telefono_cliente ~ '^[+0-9][0-9]{7,20}$'
 ),

 constraint citas_potencia_check
 check (
 potencia_kw is null
 or potencia_kw >= 0
 ),

 constraint citas_horas_check
 check (
 hora_fin is null
 or hora_fin > hora_inicio
 ),

 constraint citas_fechas_check
 check (
 fecha_hora_fin is null
 or fecha_hora_fin > fecha_hora_inicio
 )
);

create index idx_citas_usuario
 on public.citas(id_usuario);

create index idx_citas_conversacion
 on public.citas(id_conversacion);

create index idx_citas_perfil
 on public.citas(id_perfil);

create index idx_citas_fecha_hora_inicio
 on public.citas(fecha_hora_inicio);

create index idx_citas_fecha_cita
 on public.citas(fecha_cita);

create index idx_citas_estado
 on public.citas(estado_cita);

create index idx_citas_aprobacion
 on public.citas(aprobacion);

create index idx_citas_zona_dia
 on public.citas(zona_dia);

create index idx_citas_codigo
 on public.citas(codigo_cita);

create index idx_citas_dni_cliente
 on public.citas(dni_cliente);

create trigger trg_citas_actualizado_en
before update on public.citas
for each row
execute function public.actualiza_fecha_modificacion();

-- =========================================================
-- 6) ÍNDICES ÚTILES GENERALES
-- =========================================================
create index idx_conversaciones_usuario
 on public.conversaciones(id_usuario);

create index idx_conversaciones_estado
 on public.conversaciones(estado_conversacion);

create index idx_conversaciones_ultimo_mensaje
 on public.conversaciones(ultimo_mensaje_en);

create index idx_mensajes_conversacion_creado
 on public.mensajes(id_conversacion, creado_en);

create index idx_mensajes_usuario
 on public.mensajes(id_usuario);

create index idx_mensajes_rol
 on public.mensajes(rol);

-- =========================================================
-- 7) VIEW: HISTORIAL AGRUPADO POR CONVERSACIÓN
-- =========================================================
create view public.v_hilos_conversacion as
select
 c.id_conversacion,
 c.id_usuario,
 u.nombre_visible,
 u.nombre_usuario,
 u.correo_electronico,
 u.telefono_principal,
 c.canal,
 c.intencion_principal,
 c.estado_conversacion,
 c.paso_actual,
 c.subestado_flujo,
 c.dio_consentimiento,
 c.consentimiento_fecha,
 c.consentimiento_version,
 c.resumen,
 c.accion_ticket_actual,
 c.codigo_ticket_solicitado,
 c.requiere_handoff,
 c.motivo_handoff,
 c.iniciada_en,
 c.ultimo_mensaje_en,
 c.cerrada_en,
 c.creado_en,
 c.actualizado_en,

 coalesce(
 json_agg(
 json_build_object(
 'id_mensaje', m.id_mensaje,
 'rol', m.rol,
 'contenido', m.contenido,
 'tipo_mensaje', m.tipo_mensaje,
 'entrada_valida', m.entrada_valida,
 'confianza_lectura', m.confianza_lectura,
 'creado_en', m.creado_en
 )
 order by m.creado_en
 ) filter (where m.id_mensaje is not null),
 '[]'::json
 ) as mensajes

from public.conversaciones c
join public.usuarios u
 on u.id_usuario = c.id_usuario
left join public.mensajes m
 on m.id_conversacion = c.id_conversacion
group by
 c.id_conversacion,
 c.id_usuario,
 u.nombre_visible,
 u.nombre_usuario,
 u.correo_electronico,
 u.telefono_principal,
 c.canal,
 c.intencion_principal,
 c.estado_conversacion,
 c.paso_actual,
 c.subestado_flujo,
 c.dio_consentimiento,
 c.consentimiento_fecha,
 c.consentimiento_version,
 c.resumen,
 c.accion_ticket_actual,
 c.codigo_ticket_solicitado,
 c.requiere_handoff,
 c.motivo_handoff,
 c.iniciada_en,
 c.ultimo_mensaje_en,
 c.cerrada_en,
 c.creado_en,
 c.actualizado_en;

-- =========================================================
-- 8) VIEW: RESUMEN OPERATIVO DE CITAS
-- =========================================================
create view public.v_resumen_citas as
select
 ci.id_cita,
 ci.codigo_cita,
 ci.fecha_cita,
 ci.hora_inicio,
 ci.hora_fin,
 ci.fecha_hora_inicio,
 ci.fecha_hora_fin,
 ci.estado_cita,
 ci.aprobacion,
 ci.nombre_cliente,
 ci.telefono_cliente,
 ci.dni_cliente,
 ci.correo_cliente,
 ci.direccion_cita,
 ci.distrito_cita,
 ci.provincia_cita,
 ci.zona_cliente,
 ci.zona_dia,
 ci.control_zona,
 ci.etiqueta_horario,
 ci.marca_vehiculo,
 ci.modelo_vehiculo,
 ci.potencia_kw,
 ci.fase_electrica,
 ci.validacion_recibo,
 ci.google_event_id,
 ci.microsoft_event_id,
 ci.notificacion_24h_enviada,
 ci.notificacion_2h_enviada,
 ci.confirmada_por_cliente,
 ci.confirmada_en,
 ci.cancelada_en,
 ci.observaciones,
 ci.motivo_reprogramacion,
 ci.motivo_cancelacion,
 ci.creado_en,
 ci.actualizado_en,
 u.nombre_visible,
 u.nombre_usuario,
 u.correo_electronico,
 u.telefono_principal,
 p.id_perfil,
 p.nombre_receptor,
 p.telefono_receptor,
 p.correo_receptor,
 p.direccion_instalacion,
 p.distrito_instalacion,
 p.provincia_instalacion,
 p.titular_recibo,
 p.potencia_kw as potencia_kw_perfil,
 p.fase_electrica as fase_electrica_perfil
from public.citas ci
join public.usuarios u
 on u.id_usuario = ci.id_usuario
left join public.perfiles_cliente p
 on p.id_perfil = ci.id_perfil;

-- =========================================================
-- 9) BOOKING APPOINTMENTS CO (MICROSOFT BOOKINGS)
-- =========================================================
create table if not exists public.booking_appointments_co (
 id bigserial primary key,
 booking_appointment_id varchar(120) null,
 idempotency_key varchar(128) null,
 booking_business_id varchar(255) null,
 booking_service_id varchar(120) null,
 booking_service_name varchar(255) null,
 booking_staff_id varchar(120) null,
 whatsapp_phone varchar(20) not null,
 customer_phone varchar(20) null,
 customer_name varchar(255) null,
 customer_email citext null,
 starts_at_local timestamptz null,
 ends_at_local timestamptz null,
 local_date date null,
 local_start_time time null,
 local_end_time time null,
 zone varchar(150) null,
 status varchar(40) not null default 'pending_create',
 ticket varchar(50) null,
 id_usuario varchar(20) null,
 id_conversacion uuid null,
 id_cita bigint null,
 cancel_reason text null,
 graph_payload jsonb null,
 graph_last_response jsonb null,
 creado_en timestamptz not null default now(),
 actualizado_en timestamptz not null default now(),

 constraint booking_appointments_co_appointment_key unique (booking_appointment_id),
 constraint booking_appointments_co_idempotency_key unique (idempotency_key),
 constraint booking_appointments_co_status_check
 check (status in ('pending_create', 'booked', 'rescheduled', 'cancelled', 'sync_error')),
 constraint booking_appointments_co_whatsapp_phone_check
 check (whatsapp_phone ~ '^[0-9]{10,15}$'),
 constraint booking_appointments_co_customer_phone_check
 check (customer_phone is null or customer_phone ~ '^[0-9]{10,15}$'),
 constraint booking_appointments_co_usuario_fkey
 foreign key (id_usuario)
 references public.usuarios(id_usuario)
 on delete set null,
 constraint booking_appointments_co_conversacion_fkey
 foreign key (id_conversacion)
 references public.conversaciones(id_conversacion)
 on delete set null,
 constraint booking_appointments_co_cita_fkey
 foreign key (id_cita)
 references public.citas(id_cita)
 on delete set null
);

create index if not exists idx_booking_appointments_co_whatsapp_phone
 on public.booking_appointments_co (whatsapp_phone, starts_at_local desc);

create index if not exists idx_booking_appointments_co_ticket
 on public.booking_appointments_co (ticket);

create index if not exists idx_booking_appointments_co_status
 on public.booking_appointments_co (status);

create trigger trg_booking_appointments_co_actualizado_en
before update on public.booking_appointments_co
for each row
execute function public.actualiza_fecha_modificacion();
