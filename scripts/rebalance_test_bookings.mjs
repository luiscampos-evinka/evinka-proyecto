import { loadEnv } from '../src/config.mjs';
import { SupabaseRest } from '../src/supabase.mjs';
import { ChatbotEngine } from '../src/chatbotEngine.mjs';
import { MicrosoftGraphClient } from '../src/microsoftGraph.mjs';

loadEnv();
const sb = new SupabaseRest({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY });
const engine = new ChatbotEngine({ sb, calendar: new MicrosoftGraphClient() });

const SLOT_MAP = {
  '10:00': { label: '10:00 a. m.', start: '10:00:00', end: '10:45:00' },
  '11:30': { label: '11:30 a. m.', start: '11:30:00', end: '12:15:00' },
  '14:00': { label: '2:00 p. m.', start: '14:00:00', end: '14:45:00' },
  '15:30': { label: '3:30 p. m.', start: '15:30:00', end: '16:15:00' },
};

const TARGETS = {
  28: ['2026-04-28', '10:00'],
  29: ['2026-04-29', '10:00'],
  30: ['2026-04-30', '10:00'],
  36: ['2026-05-01', '10:00'],
  31: ['2026-05-01', '11:30'],
  38: ['2026-05-01', '14:00'],
  32: ['2026-05-04', '10:00'],
  39: ['2026-05-04', '11:30'],
  37: ['2026-05-04', '14:00'],
  41: ['2026-05-04', '15:30'],
  34: ['2026-05-05', '10:00'],
  40: ['2026-05-05', '11:30'],
  42: ['2026-05-06', '10:00'],
  33: ['2026-05-06', '11:30'],
  35: ['2026-05-06', '14:00'],
};

function dateLabel(date) {
  return new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(new Date(`${date}T12:00:00-05:00`))
    .replace(',', '')
    .replace(/^./, c => c.toUpperCase());
}

const rows = await sb.select('citas', `id_cita=in.(${Object.keys(TARGETS).join(',')})&select=*`);
const byId = new Map(rows.map(r => [r.id_cita, r]));
const results = [];

for (const [idRaw, [date, slotKey]] of Object.entries(TARGETS)) {
  const id = Number(idRaw);
  const cita = byId.get(id);
  if (!cita) throw new Error(`No se encontró cita ${id}`);
  const profileRows = await sb.select('perfiles_cliente', `id_perfil=eq.${cita.id_perfil}&select=*`);
  const profile = profileRows[0] || {};
  const slot = SLOT_MAP[slotKey];
  const patch = {
    fecha_cita: date,
    hora_inicio: slot.start,
    hora_fin: slot.end,
    fecha_hora_inicio: `${date}T${slot.start}-05:00`,
    fecha_hora_fin: `${date}T${slot.end}-05:00`,
    etiqueta_horario: slot.label,
    zona_dia: cita.zona_cliente,
    control_zona: cita.zona_cliente,
    observaciones: 'Reprogramada para balancear slots de pruebas internas y validar reagendación.',
    motivo_reprogramacion: 'Balanceo de pruebas internas EVINKA',
  };
  const appointment = { ...cita, ...patch };
  const eventId = await engine.ensureCalendarEvent({
    appointment,
    profile,
    dateLabel: dateLabel(date),
    hourLabel: slot.label,
    ticket: cita.codigo_cita,
  });
  await sb.update('citas', `id_cita=eq.${id}`, { ...patch, microsoft_event_id: eventId, actualizado_en: new Date().toISOString() });
  results.push({ id_cita: id, ticket: cita.codigo_cita, zone: cita.zona_cliente, date, slot: slot.label, moved: cita.fecha_cita !== date || cita.hora_inicio !== slot.start });
}

results.sort((a,b)=> `${a.date} ${a.slot}`.localeCompare(`${b.date} ${b.slot}`));
console.log(JSON.stringify(results, null, 2));
