import { loadEnv } from '../src/config.mjs';
import { SupabaseRest } from '../src/supabase.mjs';
import { ChatbotEngine } from '../src/chatbotEngine.mjs';
import { MicrosoftGraphClient } from '../src/microsoftGraph.mjs';

loadEnv();
const cases = {
  centro_3: { name:'centro_3', phone:'910001007', receipt:['AV BRASIL 1820','Jesus Maria','Lima','9.9'], person:['Rosa Mendoza Gil','76298597','904432107','luis.campos+test7@evinka.tech'], vehicle:['Audi','Q5','PHEV'] },
  sur_2: { name:'sur_2', phone:'910001008', receipt:['AV EL SOL 999','Villa El Salvador','Lima','7.4'], person:['Jorge Castro Leon','76298598','904432108','luis.campos+test8@evinka.tech'], vehicle:['BYD','Yuan Up','BEV'] },
};
const key = process.argv[2];
const c = cases[key];
if (!c) throw new Error('Unknown case');
const sb = new SupabaseRest({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY });
const calendar = new MicrosoftGraphClient();
const engine = new ChatbotEngine({ sb, calendar });
const transcript = [];
async function push(text) { const out = await engine.handleIncoming({ phone: c.phone, text }); transcript.push({ in:text, out }); return out; }
for (const t of ['hola','A','A','B', ...c.receipt, 'A','A', ...c.person, 'A','A', ...c.vehicle, 'A','A']) await push(t);
const dayOffer = transcript.at(-1)?.out || '';
const offeredDays = [...dayOffer.matchAll(/([A-E])\.\s+([^\n]+)/g)].map(m => ({ code:m[1], label:m[2] }));
const chosenDay = offeredDays[0]?.code || 'A';
const hoursReply = await push(chosenDay);
const offeredHours = [...hoursReply.matchAll(/([A-D])\.\s+([^\n]+)/g)].map(m => ({ code:m[1], label:m[2] }));
const chosenHour = offeredHours[0]?.code || 'A';
const finalReply = await push(chosenHour);
const userId = `whatsapp_${c.phone}`;
const citas = await sb.select('citas', `id_usuario=eq.${encodeURIComponent(userId)}&order=creado_en.desc&limit=1&select=*`);
console.log(JSON.stringify({ case:key, offeredDays, offeredHours, finalReply, cita:citas[0] || null, tail: transcript.slice(-8) }, null, 2));
