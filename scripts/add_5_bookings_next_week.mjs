import { loadEnv } from '../src/config.mjs';
import { SupabaseRest } from '../src/supabase.mjs';
import { ChatbotEngine } from '../src/chatbotEngine.mjs';
import { MicrosoftGraphClient } from '../src/microsoftGraph.mjs';

loadEnv();
const sb = new SupabaseRest({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY });
const engine = new ChatbotEngine({ sb, calendar: new MicrosoftGraphClient() });

const cases = [
  {
    name: 'centro_next_1', phone: '910001010',
    receipt: ['AV AREQUIPA 1500', 'Lince', 'Lima', '7.4'],
    person: ['Paola Nuñez Rios', '76298610', '904432110', 'luis.campos+test10@evinka.tech'],
    vehicle: ['BYD', 'Dolphin', 'BEV'],
    targetDate: '2026-04-28', targetHour: '11:30 a. m.'
  },
  {
    name: 'centro_next_2', phone: '910001011',
    receipt: ['AV BRASIL 1210', 'Pueblo Libre', 'Lima', '9.9'],
    person: ['Renzo Salas Ortiz', '76298611', '904432111', 'luis.campos+test11@evinka.tech'],
    vehicle: ['Tesla', 'Model Y', 'BEV'],
    targetDate: '2026-04-29', targetHour: '11:30 a. m.'
  },
  {
    name: 'centro_next_3', phone: '910001012',
    receipt: ['AV SALAVERRY 2400', 'Jesus Maria', 'Lima', '7.4'],
    person: ['Mariela Ponce Ruiz', '76298612', '904432112', 'luis.campos+test12@evinka.tech'],
    vehicle: ['Audi', 'Q4', 'BEV'],
    targetDate: '2026-04-29', targetHour: '2:00 p. m.'
  },
  {
    name: 'norte_next_1', phone: '910001013',
    receipt: ['AV UNIVERSITARIA 7200', 'Comas', 'Lima', '7.2'],
    person: ['Hector Cueva Ramos', '76298613', '904432113', 'luis.campos+test13@evinka.tech'],
    vehicle: ['Kia', 'EV5', 'BEV'],
    targetDate: '2026-04-30', targetHour: '11:30 a. m.'
  },
  {
    name: 'norte_next_2', phone: '910001014',
    receipt: ['AV ANTUNEZ DE MAYOLO 4100', 'Los Olivos', 'Lima', '9.9'],
    person: ['Sandra Mejia Leon', '76298614', '904432114', 'luis.campos+test14@evinka.tech'],
    vehicle: ['Volvo', 'XC40', 'PHEV'],
    targetDate: '2026-05-01', targetHour: '3:30 p. m.'
  },
];

async function send(phone, text) {
  return engine.handleIncoming({ phone, text });
}

function extractOptions(text, regex) {
  return [...String(text || '').matchAll(regex)].map(m => ({ code: m[1], label: m[2] }));
}

function norm(s) { return String(s || '').toLowerCase().replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u'); }

const results = [];
for (const c of cases) {
  const transcript = [];
  const push = async (text) => {
    const out = await send(c.phone, text);
    transcript.push({ in: text, out });
    return out;
  };

  for (const t of ['hola','A','A','B', ...c.receipt, 'A','A', ...c.person, 'A','A', ...c.vehicle, 'A','A']) {
    await push(t);
  }

  const dayOffer = transcript.at(-1)?.out || '';
  const offeredDays = extractOptions(dayOffer, /([A-E])\.\s+([^\n]+)/g);
  const dayChoice = offeredDays.find(o => norm(o.label).includes(c.targetDate.split('-').reverse().join('/')));
  if (!dayChoice) throw new Error(`No se ofrecio la fecha ${c.targetDate} para ${c.name}. Dias: ${JSON.stringify(offeredDays)}`);
  const hourOffer = await push(dayChoice.code);
  const offeredHours = extractOptions(hourOffer, /([A-D])\.\s+([^\n]+)/g);
  const hourChoice = offeredHours.find(o => o.label === c.targetHour);
  if (!hourChoice) throw new Error(`No se ofrecio la hora ${c.targetHour} para ${c.name}. Horas: ${JSON.stringify(offeredHours)}`);
  const finalReply = await push(hourChoice.code);
  const userId = `whatsapp_${c.phone}`;
  const citas = await sb.select('citas', `id_usuario=eq.${encodeURIComponent(userId)}&order=creado_en.desc&limit=1&select=id_cita,codigo_cita,fecha_cita,hora_inicio,zona_cliente,nombre_cliente,microsoft_event_id`);
  results.push({ case: c.name, targetDate: c.targetDate, targetHour: c.targetHour, offeredDays, offeredHours, finalReply, cita: citas[0] || null });
}

console.log(JSON.stringify(results, null, 2));
