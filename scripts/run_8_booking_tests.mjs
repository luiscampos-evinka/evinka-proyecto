import fs from 'node:fs';
import { loadEnv } from '../src/config.mjs';
import { SupabaseRest } from '../src/supabase.mjs';
import { ChatbotEngine } from '../src/chatbotEngine.mjs';
import { MicrosoftGraphClient } from '../src/microsoftGraph.mjs';

loadEnv();
const outPath = '/root/.openclaw/workspace/.runtime/booking-tests-8.json';
fs.writeFileSync(outPath, '');
const log = (obj) => fs.appendFileSync(outPath, `${JSON.stringify(obj)}\n`);

const sb = new SupabaseRest({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY });
const calendar = new MicrosoftGraphClient();
const engine = new ChatbotEngine({ sb, calendar });

const cases = [
  { name:'centro_1', phone:'910001001', receipt:['AV ALMIRANTE CORNEJO 2049','Surquillo','Lima','9.9'], person:['Luis Campos Vega','76298591','904432101','luis.campos+test1@evinka.tech'], vehicle:['BYD','A','BEV'] },
  { name:'centro_2', phone:'910001002', receipt:['JR HUARAZ 2096','Pueblo Libre','Lima','7.4'], person:['Carla Ramos Pineda','76298592','904432102','luis.campos+test2@evinka.tech'], vehicle:['Tesla','Model 3','BEV'] },
  { name:'norte_1', phone:'910001003', receipt:['CALLE ALMIRANTE VACA 1203','Comas','Lima','9.9'], person:['Mario Flores Quispe','76298593','904432103','luis.campos+test3@evinka.tech'], vehicle:['Kia','EV5','BEV'] },
  { name:'norte_2', phone:'910001004', receipt:['AV PERU 5050','Los Olivos','Lima','7.2'], person:['Ana Ruiz Salazar','76298594','904432104','luis.campos+test4@evinka.tech'], vehicle:['Toyota','Prius Prime','PHEV'] },
  { name:'sur_1', phone:'910001005', receipt:['AV DEFENSORES 880','Chorrillos','Lima','11'], person:['Lucia Torres Mena','76298595','904432105','luis.campos+test5@evinka.tech'], vehicle:['Volvo','XC60','PHEV'] },
  { name:'este_1', phone:'910001006', receipt:['AV LOS QUECHUAS 140','Ate','Lima','7.4'], person:['Diego Perez Luna','76298596','904432106','luis.campos+test6@evinka.tech'], vehicle:['Nissan','Leaf','BEV'] },
  { name:'centro_3', phone:'910001007', receipt:['AV BRASIL 1820','Jesus Maria','Lima','9.9'], person:['Rosa Mendoza Gil','76298597','904432107','luis.campos+test7@evinka.tech'], vehicle:['Audi','Q5','PHEV'] },
  { name:'sur_2', phone:'910001008', receipt:['AV EL SOL 999','Villa El Salvador','Lima','7.4'], person:['Jorge Castro Leon','76298598','904432108','luis.campos+test8@evinka.tech'], vehicle:['BYD','Yuan Up','BEV'] },
];

async function send(phone, text = '', media = null) {
  return engine.handleIncoming({ phone, text, media });
}

for (const c of cases) {
  log({ case:c.name, status:'starting' });
  const transcript = [];
  const push = async (text = '', media = null) => {
    const out = await send(c.phone, text, media);
    transcript.push({ in: media ? '[media]' : text, out });
    return out;
  };
  try {
    for (const t of ['hola','A','A','B', ...c.receipt, 'A','A', ...c.person, 'A','A', ...c.vehicle, 'A','A']) {
      await push(t);
    }
    const dayOffer = transcript.at(-1)?.out || '';
    const offeredDayLetters = [...dayOffer.matchAll(/([A-E])\.\s+([^\n]+)/g)].map(m => ({ code: m[1], label: m[2] }));
    const chosenDay = offeredDayLetters[0]?.code || 'A';
    const dayReply = await push(chosenDay);
    const offeredHourLetters = [...dayReply.matchAll(/([A-D])\.\s+([^\n]+)/g)].map(m => ({ code: m[1], label: m[2] }));
    const chosenHour = offeredHourLetters[0]?.code || 'A';
    const finalReply = await push(chosenHour);
    const userId = `whatsapp_${c.phone}`;
    const citas = await sb.select('citas', `id_usuario=eq.${encodeURIComponent(userId)}&order=creado_en.desc&limit=1&select=*`);
    const cita = citas[0] || null;
    log({
      case: c.name,
      status: 'done',
      zone: cita?.zona_cliente || null,
      offeredDays: offeredDayLetters,
      offeredHours: offeredHourLetters,
      chosenDay,
      chosenHour,
      ticket: cita?.codigo_cita || null,
      date: cita?.fecha_cita || null,
      start: cita?.hora_inicio || null,
      microsoftEventId: cita?.microsoft_event_id || null,
      finalReply,
    });
  } catch (error) {
    log({ case:c.name, status:'error', error:String(error?.stack || error), tail: transcript.slice(-6) });
  }
}
console.log(fs.readFileSync(outPath, 'utf8'));
