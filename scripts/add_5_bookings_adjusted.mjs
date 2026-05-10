import { loadEnv } from '../src/config.mjs';
import { SupabaseRest } from '../src/supabase.mjs';
import { ChatbotEngine } from '../src/chatbotEngine.mjs';
import { MicrosoftGraphClient } from '../src/microsoftGraph.mjs';

loadEnv();
const sb = new SupabaseRest({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY });
const engine = new ChatbotEngine({ sb, calendar: new MicrosoftGraphClient() });

const cases = [
  {
    name: 'norte_extra_1', phone: '910001015',
    receipt: ['AV TUPAC AMARU 4500', 'Comas', 'Lima', '7.4'],
    person: ['Paola Nuñez Rios', '76298615', '904432115', 'luis.campos+test15@evinka.tech'],
    vehicle: ['BYD', 'Dolphin', 'BEV'],
    targetDate: '2026-05-01', targetHour: '2:00 p. m.'
  },
  {
    name: 'norte_extra_2', phone: '910001016',
    receipt: ['AV LAS PALMERAS 5100', 'Los Olivos', 'Lima', '9.9'],
    person: ['Renzo Salas Ortiz', '76298616', '904432116', 'luis.campos+test16@evinka.tech'],
    vehicle: ['Tesla', 'Model Y', 'BEV'],
    targetDate: '2026-05-01', targetHour: '3:30 p. m.'
  },
  {
    name: 'centro_extra_1', phone: '910001017',
    receipt: ['AV AREQUIPA 1500', 'Lince', 'Lima', '7.4'],
    person: ['Mariela Ponce Ruiz', '76298617', '904432117', 'luis.campos+test17@evinka.tech'],
    vehicle: ['Audi', 'Q4', 'BEV'],
    targetDate: '2026-05-07', targetHour: '10:00 a. m.'
  },
  {
    name: 'centro_extra_2', phone: '910001018',
    receipt: ['AV BRASIL 1210', 'Pueblo Libre', 'Lima', '9.9'],
    person: ['Hector Cueva Ramos', '76298618', '904432118', 'luis.campos+test18@evinka.tech'],
    vehicle: ['Kia', 'EV5', 'BEV'],
    targetDate: '2026-05-07', targetHour: '11:30 a. m.'
  },
  {
    name: 'sur_extra_1', phone: '910001019',
    receipt: ['AV PROLONGACION HUAYLAS 2200', 'Chorrillos', 'Lima', '7.2'],
    person: ['Sandra Mejia Leon', '76298619', '904432119', 'luis.campos+test19@evinka.tech'],
    vehicle: ['Volvo', 'XC40', 'PHEV'],
    targetDate: '2026-05-08', targetHour: '10:00 a. m.'
  },
];

async function send(phone, text) {
  return engine.handleIncoming({ phone, text });
}

function extractOptions(text, regex) {
  return [...String(text || '').matchAll(regex)].map(m => ({ code: m[1], label: m[2] }));
}

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
  const dayChoice = offeredDays.find(o => o.label.includes(c.targetDate.slice(8,10) + '/' + c.targetDate.slice(5,7) + '/' + c.targetDate.slice(0,4)));
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
