import { loadEnv } from '../src/config.mjs';
import { SupabaseRest } from '../src/supabase.mjs';
import { ChatbotEngine } from '../src/chatbotEngine.mjs';
import { MicrosoftGraphClient } from '../src/microsoftGraph.mjs';

loadEnv();
const sb = new SupabaseRest({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY });
const engine = new ChatbotEngine({ sb, calendar: new MicrosoftGraphClient() });

const cases = [
  {
    name: 'centro_27_extra', phone: '910001020',
    receipt: ['AV AREQUIPA 2220', 'Lince', 'Lima', '7.4'],
    person: ['Gina Torres Silva', '76298620', '904432120', 'luis.campos+test20@evinka.tech'],
    vehicle: ['BYD', 'Seal', 'BEV'],
    targetDate: '2026-04-27', targetHour: '11:30 a. m.'
  },
  {
    name: 'centro_28_extra', phone: '910001021',
    receipt: ['AV BRASIL 980', 'Pueblo Libre', 'Lima', '9.9'],
    person: ['Alvaro Mena Ruiz', '76298621', '904432121', 'luis.campos+test21@evinka.tech'],
    vehicle: ['Tesla', 'Model 3', 'BEV'],
    targetDate: '2026-04-28', targetHour: '11:30 a. m.'
  },
  {
    name: 'norte_30_extra', phone: '910001022',
    receipt: ['AV UNIVERSITARIA 6800', 'Comas', 'Lima', '7.2'],
    person: ['Nora Cueva Rojas', '76298622', '904432122', 'luis.campos+test22@evinka.tech'],
    vehicle: ['Kia', 'EV5', 'BEV'],
    targetDate: '2026-04-30', targetHour: '11:30 a. m.'
  }
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
  const targetDateText = c.targetDate.slice(8,10) + '/' + c.targetDate.slice(5,7) + '/' + c.targetDate.slice(0,4);
  const dayChoice = offeredDays.find(o => o.label.includes(targetDateText));
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
