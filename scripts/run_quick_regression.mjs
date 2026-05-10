import { loadEnv } from '../src/config.mjs';
import { SupabaseRest } from '../src/supabase.mjs';
import { ChatbotEngine } from '../src/chatbotEngine.mjs';

loadEnv();
const sb = new SupabaseRest({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY });
const engine = new ChatbotEngine({ sb });

async function runCase(name, phone, steps) {
  const out = [];
  for (const step of steps) {
    const reply = await engine.handleIncoming({ phone, ...step });
    out.push({ in: step.text || (step.media ? `[media:${step.media.mimeType}]` : ''), out: reply });
  }
  return { name, out };
}

const cases = [];

cases.push(await runCase('normal_manual_sin_titular', '910000001', [
  { text: 'hola' },
  { text: 'A' },
  { text: 'A' },
  { text: 'B' },
  { text: 'Jiron Huaraz 2096\nPueblo Libre\nLima\n9.9' },
  { text: 'A' },
  { text: 'A' },
  { text: 'Luis Campos\n76298591\n904432138\nluis@test.com' },
  { text: 'A' },
  { text: 'BYD Yuan Up\nBEV' },
  { text: 'A' },
  { text: 'A' },
  { text: 'A' },
]));

cases.push(await runCase('basura_1_recibo_compacto', '910000002', [
  { text: 'hola' },
  { text: 'A' },
  { text: 'A' },
  { text: 'B' },
  { text: 'asdasd 123 !!!' },
  { text: 'Jiron Huaraz 2096 Pueblo Libre Lima 9.9' },
]));

cases.push(await runCase('basura_2_faltantes_con_coma', '910000003', [
  { text: 'hola' },
  { text: 'A' },
  { text: 'A' },
  { text: 'A', media: { id:'m5', fileName:'r.jpg', mimeType:'image/jpeg', ocr: { ok:true, fields: { titular:null, direccion:'Jiron Huaraz 2096', distrito:null, provincia:null, potencia:9.9 }, rawText:'', source:'image_ocr' } } },
  { text: 'A' },
  { text: 'Pueblo Libre, Lima' },
]));

cases.push(await runCase('basura_3_faltantes_solo_dni_rama_d', '910000004', [
  { text: 'hola' },
  { text: 'D' },
  { text: 'WA-XXXX' },
  { text: '12345678' },
]));

cases.push(await runCase('basura_4_vehiculo_ruido', '910000005', [
  { text: 'hola' },
  { text: 'A' },
  { text: 'A' },
  { text: 'B' },
  { text: 'Jiron Huaraz 2096\nPueblo Libre\nLima\n9.9' },
  { text: 'A' },
  { text: 'A' },
  { text: 'Luis Campos\n76298591\n904432138\nluis2@test.com' },
  { text: 'A' },
  { text: 'ASDFA AF ASDA F' },
  { text: 'OÑO AFSKDJ\nBEV' },
]));

cases.push(await runCase('basura_5_compra_ocr_parcial', '910000006', [
  { text: 'hola' },
  { text: 'B' },
  { text: 'A' },
  { text: 'A' },
  { text: 'A', media: { id:'m6', fileName:'r.jpg', mimeType:'image/jpeg', ocr: { ok:true, fields: { titular:'Detalle De Importes', direccion:null, distrito:null, provincia:null, potencia:9.9 }, rawText:'', source:'image_ocr' } } },
  { text: 'B' },
  { text: 'Jiron Huaraz 2096\nPueblo Libre\nLima\n9.9' },
]));

for (const c of cases) {
  console.log(`\n=== ${c.name} ===`);
  c.out.forEach((x, i) => {
    console.log(`\n[${i+1}] IN: ${x.in}`);
    console.log(x.out);
  });
}
