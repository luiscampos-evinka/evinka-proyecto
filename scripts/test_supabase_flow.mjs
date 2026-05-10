import fs from 'node:fs';
import path from 'node:path';

function loadEnvFile(file = '.env') {
  const envPath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_KEY;
const DRY_RUN = String(process.env.DRY_RUN || '').toLowerCase() === 'true';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

const baseUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1`;

async function sb(pathname, { method = 'GET', body, headers = {}, prefer, selectObject = false } = {}) {
  const url = `${baseUrl}/${pathname}`;
  const finalHeaders = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...headers,
  };
  if (prefer) finalHeaders.Prefer = prefer;
  if (selectObject) finalHeaders.Accept = 'application/vnd.pgrst.object+json';

  const res = await fetch(url, {
    method,
    headers: finalHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    throw new Error(`${method} ${pathname} -> ${res.status} ${res.statusText}\n${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}`);
  }
  return { data, headers: res.headers };
}

function ticketFor(date, suffix = '73B7E190') {
  return `WA-${date.replaceAll('-', '')}-${suffix}`;
}

function compactSuffix(input, fallback = '73B7E190') {
  const clean = String(input || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return (clean || fallback).slice(-8).padStart(8, '0');
}

const flow = {
  userId: process.env.TEST_USER_ID || 'whatsapp_51987654321',
  phone: process.env.TEST_PHONE || '987654321',
  email: process.env.TEST_EMAIL || 'carlos.mendoza@gmail.com',
  fullName: 'Carlos Mendoza Pérez',
  dni: '45871236',
  ruc: '20123456789',
  installationAddress: 'Jr. Huaraz 2096',
  installationRefs: 'Portón negro, casa de dos pisos, tocar timbre EVINKA',
  district: 'Pueblo Libre',
  province: 'Lima',
  zone: 'LIMA CENTRO',
  powerKw: 7.4,
  vehicleBrand: 'BYD',
  vehicleModel: 'Yuan Up',
  vehicleType: 'BEV',
  citaDate: '2026-04-28',
  citaStartTime: '14:00:00',
  citaEndTime: '14:45:00',
  citaStartIso: '2026-04-28T14:00:00-05:00',
  citaEndIso: '2026-04-28T14:45:00-05:00',
  ticket: ticketFor('2026-04-28', compactSuffix(process.env.TEST_USER_ID || '73B7E190')),
  previousTicket: ticketFor('2026-04-21', compactSuffix(`${process.env.TEST_USER_ID || '11AA22BB'}PREV`, '11AA22BB')),
  channel: 'whatsapp',
  reciboUrl: 'https://storage.evinka.local/recibos/WA-20260428-73B7E190.pdf',
  reciboNombreArchivo: 'recibo-luz-carlos-mendoza.pdf',
  reciboTipoArchivo: 'application/pdf',
  googleEventId: 'google_evt_73B7E190',
  microsoftEventId: 'ms_evt_73B7E190',
};

const transcript = [
  { rol: 'assistant', contenido: '¡Hola! 👋\nBienvenido a EVINKA.\n\nTe puedo ayudar con una de estas opciones:\n\nA. Instalar un cargador\nB. Comprar un cargador\nC. Hablar con un asesor\nD. Reprogramar o cancelar cita\nPor favor responde con la letra de la opción que deseas.', tipo_mensaje: 'text' },
  { rol: 'user', contenido: 'A', tipo_mensaje: 'text' },
  { rol: 'assistant', contenido: 'Perfecto 👍\n\nPara continuar, primero necesitaremos tu DNI o RUC y un recibo de luz actualizado. Con esa información podremos validar la potencia contratada y confirmar la dirección donde se realizará la instalación.\n\nLuego coordinaremos una visita técnica con nuestro equipo especializado para evaluar la viabilidad de la instalación, las condiciones del sitio y los requerimientos técnicos.\n\nCon esa evaluación podremos preparar una cotización precisa y adecuada para tu caso.\n\nAntes de continuar, EVINKA usará los datos y documentos que nos compartas únicamente para:\n- evaluar tu instalación\n- coordinar tu visita técnica\n- preparar tu cotización\n\n¿Autorizas este uso para esa finalidad?\n\nA. Sí, autorizo\nB. No autorizo\n\nPor favor responde con la letra de la opción que deseas.', tipo_mensaje: 'text' },
  { rol: 'user', contenido: 'A', tipo_mensaje: 'text' },
  { rol: 'assistant', contenido: 'Perfecto 👍\n\nAhora necesito el recibo de luz para continuar con la evaluación de la instalación.\n\nPuedes elegir una de estas opciones:\n\nA. Enviar foto o PDF del recibo\nB. Escribir los datos del recibo\n\nPor favor responde con la letra de la opción que deseas.', tipo_mensaje: 'text' },
  { rol: 'user', contenido: 'B', tipo_mensaje: 'text' },
  { rol: 'assistant', contenido: 'Perfecto 👍\n\nEntonces envíame los datos del recibo. De preferencia incluye esto:\n- titular\n- dirección del suministro\n- distrito\n- provincia\n- potencia contratada\n\nNo es obligatorio copiar exactamente ese formato, pero sí necesito que esos datos se entiendan con claridad para continuar.', tipo_mensaje: 'text' },
  { rol: 'user', contenido: 'Carlos Mendoza Pérez\nJr Huaraz 2096\nPueblo Libre\nLima\n7.4', tipo_mensaje: 'text' },
  { rol: 'assistant', contenido: 'Perfecto 👍\n\nYa registré los datos corregidos del recibo:\n\n- Nombre del titular: Carlos Mendoza Pérez\n- Dirección del suministro: Jr. Huaraz 2096\n- Distrito: Pueblo Libre\n- Provincia: Lima\n- Potencia contratada: 7.4\n\n¿Me confirmas si estos datos son correctos?\n\nA. Sí\nB. No, quiero corregirlos\n\nPor favor responde con la letra de la opción que deseas.', tipo_mensaje: 'text' },
  { rol: 'user', contenido: 'A', tipo_mensaje: 'text' },
  { rol: 'assistant', contenido: 'Gracias, ya tengo el recibo 👍\n\nPaso 2 de 5: persona que recibirá la visita\n\nAhora necesito confirmar algo importante:\n\nA. Yo mismo voy a recibir al técnico\nB. Otra persona va a recibir al técnico\n\nPor favor responde con la letra de la opción que deseas.', tipo_mensaje: 'text' },
  { rol: 'user', contenido: 'A', tipo_mensaje: 'text' },
  { rol: 'assistant', contenido: 'Perfecto 👍\n\nEntonces los siguientes datos deben ser tuyos.\n\nPaso 3 de 5: datos de la persona que recibirá la visita\n\nGracias. Para continuar solo me faltan estos datos:\n\n- nombre completo\n- DNI o RUC\n- teléfono de contacto\n- correo electrónico\n\nPuedes enviarlo todo en un solo mensaje.', tipo_mensaje: 'text' },
  { rol: 'user', contenido: 'Carlos Mendoza Pérez\n45871236\n987654321\ncarlos.mendoza@gmail.com', tipo_mensaje: 'text' },
  { rol: 'assistant', contenido: 'Perfecto 👍\n\nYa tengo los datos de contacto.\n\nPaso 4 de 5: dirección exacta del punto de instalación\n\nEn el recibo que me compartiste figura esta dirección de suministro:\n\nJr. Huaraz 2096\n\n¿Esa es la dirección exacta donde se realizará la instalación?\n\nA. Sí\nB. No\n\nPor favor responde con la letra de la opción que deseas.', tipo_mensaje: 'text' },
  { rol: 'user', contenido: 'A', tipo_mensaje: 'text' },
  { rol: 'assistant', contenido: 'Tomaré esa como la dirección correcta de instalación.\n\nPerfecto 👍\n\nPaso 5 de 5: vehículo\n\nAhora indícame:\n\n- marca\n- modelo\n- si es BEV (Battery Electric Vehicle) o PHEV (Plug-in Hybrid Electric Vehicle)\n\nEjemplo:\nBYD Yuan Up\nBEV', tipo_mensaje: 'text' },
  { rol: 'user', contenido: 'BYD\nYuan Up\nBEV', tipo_mensaje: 'text' },
  { rol: 'assistant', contenido: 'Perfecto. Ya tengo lo necesario para continuar ✅\n\nAntes de agendar, te explico brevemente qué haremos en la visita técnica:\n\n- revisaremos el tablero eléctrico\n- veremos la distancia hasta el punto de carga\n- validaremos el lugar donde iría el cargador\n- revisaremos si hay condiciones adecuadas para instalar\n- y con eso prepararemos la cotización\n\nLa visita dura 45 minutos.\n\n¿Deseas agendar la visita técnica?\n\nA. Sí\nB. No por ahora\n\nPor favor responde con la letra de la opción que deseas.', tipo_mensaje: 'text' },
  { rol: 'user', contenido: 'A', tipo_mensaje: 'text' },
  { rol: 'assistant', contenido: 'Perfecto 👍\n\nEstos son los días disponibles para tu zona:\n\nA. Lunes 28/04/2026\nB. Miércoles 30/04/2026\nC. Viernes 02/05/2026\n\nPor favor responde con la letra de la opción que prefieras.', tipo_mensaje: 'text' },
  { rol: 'user', contenido: 'A', tipo_mensaje: 'text' },
  { rol: 'assistant', contenido: 'Perfecto.\n\nEstos son los horarios disponibles para ese día:\n\nA. 10:00 a. m.\nB. 11:30 a. m.\nC. 2:00 p. m.\nD. 3:30 p. m.\n\nPor favor responde con la letra de la opción que prefieras.', tipo_mensaje: 'text' },
  { rol: 'user', contenido: 'C', tipo_mensaje: 'text' },
  { rol: 'assistant', contenido: 'Listo ✅\nTu visita técnica quedó confirmada.\n\nFecha: Lunes 28/04/2026\nHora: 2:00 p. m.\nDirección: Jr. Huaraz 2096 Pueblo Libre Lima\n\nSi más adelante necesitas reprogramar o cancelar, escríbenos por este mismo medio.\n\n¡Gracias por elegir EVINKA! ⚡', tipo_mensaje: 'text' },
];

async function main() {
  if (DRY_RUN) {
    console.log('DRY_RUN=true -> no se escribirá nada.');
    console.log(JSON.stringify({ flow, transcriptCount: transcript.length }, null, 2));
    return;
  }

  console.log('Preparando usuario...');
  await sb(`usuarios?id_usuario=eq.${encodeURIComponent(flow.userId)}`, {
    method: 'PATCH',
    body: {
      nombre_visible: flow.fullName,
      nombre_usuario: flow.fullName,
      correo_electronico: flow.email,
      telefono_principal: flow.phone,
    },
  }).catch(async (err) => {
    if (!String(err.message).includes('204')) throw err;
  });

  const existingUser = await sb(`usuarios?id_usuario=eq.${encodeURIComponent(flow.userId)}&select=id_usuario`, { method: 'GET' });
  if (!Array.isArray(existingUser.data) || existingUser.data.length === 0) {
    await sb('usuarios', {
      method: 'POST',
      body: [{
        id_usuario: flow.userId,
        nombre_visible: flow.fullName,
        nombre_usuario: flow.fullName,
        correo_electronico: flow.email,
        telefono_principal: flow.phone,
      }],
      prefer: 'return=representation',
    });
  }

  console.log('Creando conversación...');
  const { data: conversationRows } = await sb('conversaciones', {
    method: 'POST',
    body: [{
      id_usuario: flow.userId,
      canal: flow.channel,
      intencion_principal: 'instalacion_cargador',
      estado_conversacion: 'closed',
      paso_actual: 'cita_confirmada',
      subestado_flujo: 'agenda_confirmada',
      dio_consentimiento: true,
      consentimiento_fecha: new Date().toISOString(),
      consentimiento_version: 'v1',
      resumen: 'Cliente completó flujo de instalación, tuvo apoyo humano para validar agenda y confirmó visita técnica',
      accion_ticket_actual: 'confirm',
      codigo_ticket_solicitado: flow.ticket,
      requiere_handoff: true,
      motivo_handoff: 'Validación manual de coherencia entre agenda operativa y disponibilidad final.',
      cerrada_en: new Date().toISOString(),
    }],
    prefer: 'return=representation',
  });
  const conversation = conversationRows[0];

  console.log('Creando perfil...');
  const { data: profileRows } = await sb('perfiles_cliente', {
    method: 'POST',
    body: [{
      id_usuario: flow.userId,
      id_conversacion: conversation.id_conversacion,
      nombre_receptor: flow.fullName,
      dni_receptor: flow.dni,
      ruc_receptor: flow.ruc,
      telefono_receptor: flow.phone,
      correo_receptor: flow.email,
      direccion_instalacion: flow.installationAddress,
      distrito_instalacion: flow.district,
      provincia_instalacion: flow.province,
      zona_cliente: flow.zone,
      referencias_instalacion: flow.installationRefs,
      marca_vehiculo: flow.vehicleBrand,
      modelo_vehiculo: flow.vehicleModel,
      titular_recibo: flow.fullName,
      direccion_recibo: flow.installationAddress,
      distrito_recibo: flow.district,
      provincia_recibo: flow.province,
      potencia_kw: flow.powerKw,
      fase_electrica: 'no_definido',
      validacion_recibo: true,
      origen_recibo: 'pdf',
      recibo_url: flow.reciboUrl,
      recibo_nombre_archivo: flow.reciboNombreArchivo,
      recibo_tipo_archivo: flow.reciboTipoArchivo,
      lectura_recibo_exitosa: true,
      datos_recibo_extraidos: {
        titular: flow.fullName,
        direccion_suministro: flow.installationAddress,
        distrito: flow.district,
        provincia: flow.province,
        potencia_contratada: flow.powerKw,
        fuente: ['pdf-parse', 'pdfjs-dist', 'tesseract.js'],
      },
      datos_recibo_manuales: {
        titular: flow.fullName,
        direccion_suministro: flow.installationAddress,
        distrito: flow.district,
        provincia: flow.province,
        potencia_contratada: flow.powerKw,
      },
      campos_faltantes_recibo: {
        medidor: true,
        numero_suministro: true
      },
      estado_perfil: 'scheduled',
      notas_recibo: `tipo_vehiculo=${flow.vehicleType}`,
      direccion_instalacion_coincide_con_recibo: true,
    }],
    prefer: 'return=representation',
  });
  const profile = profileRows[0];

  console.log('Insertando cita...');
  const { data: citaRows } = await sb('citas', {
    method: 'POST',
    body: [{
      id_usuario: flow.userId,
      id_conversacion: conversation.id_conversacion,
      id_perfil: profile.id_perfil,
      codigo_cita: flow.ticket,
      fecha_cita: flow.citaDate,
      hora_inicio: flow.citaStartTime,
      hora_fin: flow.citaEndTime,
      fecha_hora_inicio: flow.citaStartIso,
      fecha_hora_fin: flow.citaEndIso,
      nombre_cliente: flow.fullName,
      telefono_cliente: flow.phone,
      dni_cliente: flow.dni,
      correo_cliente: flow.email,
      direccion_cita: flow.installationAddress,
      distrito_cita: flow.district,
      provincia_cita: flow.province,
      zona_cliente: flow.zone,
      zona_dia: flow.zone,
      control_zona: flow.zone,
      etiqueta_horario: '2:00 p. m.',
      marca_vehiculo: flow.vehicleBrand,
      modelo_vehiculo: flow.vehicleModel,
      potencia_kw: flow.powerKw,
      fase_electrica: 'no_definido',
      validacion_recibo: true,
      estado_cita: 'cancelada',
      aprobacion: 'aprobada',
      observaciones: 'Caso de prueba integral con confirmación inicial y posterior simulación de gestión por ticket.',
      motivo_reprogramacion: 'Prueba de llenado de campo para validar estructura de datos.',
      motivo_cancelacion: 'Prueba de llenado de campo para validar cancelación y cierre.',
      google_event_id: flow.googleEventId,
      microsoft_event_id: flow.microsoftEventId,
      notificacion_24h_enviada: true,
      notificacion_2h_enviada: false,
      confirmada_por_cliente: true,
      confirmada_en: new Date().toISOString(),
      cancelada_en: new Date().toISOString(),
    }],
    prefer: 'return=representation',
  });
  const cita = citaRows[0];

  console.log('Insertando mensajes...');
  for (const msg of transcript) {
    await sb('mensajes', {
      method: 'POST',
      body: [{
        id_conversacion: conversation.id_conversacion,
        id_usuario: flow.userId,
        rol: msg.rol,
        contenido: msg.contenido,
        tipo_mensaje: msg.tipo_mensaje,
        payload_crudo: {
          source: 'test-script',
          channel: flow.channel,
          ticket: flow.ticket,
          previous_ticket: flow.previousTicket,
          raw_text: msg.contenido,
        },
        entrada_valida: msg.rol === 'user' ? true : null,
        confianza_lectura: msg.rol === 'assistant' ? 0.98 : 0.91,
      }],
      prefer: 'return=minimal',
    });
  }

  console.log('OK: flujo de prueba insertado.');
  console.log(JSON.stringify({
    usuario: flow.userId,
    conversacion: conversation.id_conversacion,
    perfil: profile.id_perfil,
    cita: cita.id_cita,
    ticket: cita.codigo_cita,
    mensajes: transcript.length,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
