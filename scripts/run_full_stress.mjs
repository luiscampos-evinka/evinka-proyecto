import { loadEnv } from '../src/config.mjs';
import { SupabaseRest } from '../src/supabase.mjs';
import { ChatbotEngine } from '../src/chatbotEngine.mjs';
loadEnv();
const sb = new SupabaseRest({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY });
const engine = new ChatbotEngine({ sb });

async function runCase(name, phone, steps, checks = []) {
  const transcript = [];
  const failed = [];
  for (const step of steps) {
    const reply = await engine.handleIncoming({ phone, text: step.text || '', media: step.media || null });
    transcript.push({ in: step.text || '[media]', out: reply });
  }
  for (const check of checks) {
    let ok = false;
    try { ok = check.fn(transcript); } catch (e) { failed.push(`${check.label}: ${e.message}`); continue; }
    if (!ok) failed.push(check.label);
  }
  return { name, ok: failed.length === 0, failed, transcript };
}

const includes = (needle) => (t) => t.some(x => x.out.includes(needle));
const lastIncludes = (needle) => (t) => t.at(-1)?.out.includes(needle);

const cases = [
  {
    name: 'principal_ok', phone: '910000501',
    steps: ['hola','A','A','B','Jiron Huaraz 2096\nPueblo Libre\nLima\n9.9','A','A','Luis Angel Campos Valenzuela','76298591','904432138','frozenflamem4@gmail.com','A','A','BYD Yuan Up\nBEV','A','A','B','B'].map(text => ({ text })),
    checks: [{ label: 'ticket final', fn: lastIncludes('Ticket: WA-') },{ label: 'confirmacion final', fn: lastIncludes('Tu visita técnica quedó confirmada') }]
  },
  {
    name: 'persona_invalidos_y_correccion', phone: '910000502',
    steps: ['hola','A','A','B','Jiron Huaraz 2096\nPueblo Libre\nLima\n9.9','A','A','Luis','Luis Angel Campos Valenzuela','123','76298591','12345','904432138','correo-malo','frozenflamem4@gmail.com','B','D','frozenflamem5@gmail.com','A'].map(text => ({ text })),
    checks: [
      { label: 'rechaza nombre invalido', fn: includes('No pude leer un nombre completo válido') },
      { label: 'rechaza doc invalido', fn: includes('No pude leer un DNI o RUC válido de Perú') },
      { label: 'rechaza telefono invalido', fn: includes('No pude leer un teléfono peruano válido') },
      { label: 'rechaza correo invalido', fn: includes('No pude leer un correo electrónico válido') },
      { label: 'vuelve a resumen tras correccion', fn: lastIncludes('frozenflamem5@gmail.com') }
    ]
  },
  {
    name: 'archivo_antes_de_tiempo', phone: '910000503',
    steps: [{ text: 'hola' },{ text: 'A' },{ media: { id: 'mx1', mimeType: 'image/jpeg', fileName: 'recibo.jpg', error: 'not-in-step' } }],
    checks: [{ label: 'avisa A o B', fn: lastIncludes('respon') }]
  },
  {
    name: 'rama_d_fallback_e', phone: '910000504',
    steps: ['hola','D','ticket malo','76298591','E','A','A','D','A'].map(text => ({ text })),
    checks: [
      { label: 'seleccion E abre cita', fn: includes('¿Confirmas que esta es la cita que deseas gestionar?') },
      { label: 'reprograma', fn: lastIncludes('Tu visita técnica quedó confirmada') }
    ]
  },
  {
    name: 'rama_d_cancelacion', phone: '910000505',
    steps: ['hola','D','WA-20260427-72A3A31C','A','B'].map(text => ({ text })),
    checks: [{ label: 'cancelacion ok', fn: lastIncludes('Tu cita ha sido cancelada correctamente') }]
  },
  {
    name: 'vehiculo_basura_luego_ok', phone: '910000506',
    steps: ['hola','A','A','B','Jiron Huaraz 2096\nPueblo Libre\nLima\n9.9','A','A','Luis Angel Campos Valenzuela','76298591','904432138','frozenflamem4@gmail.com','A','A','asdf qwer','BYD Yuan Up\nBEV','A'].map(text => ({ text })),
    checks: [{ label: 'llega a agenda', fn: lastIncludes('¿Deseas agendar la visita técnica?') }]
  },
  {
    name: 'recibo_parcial_manual', phone: '910000507',
    steps: [{ text:'hola' },{ text:'A' },{ text:'A' },{ media: { id:'mocr1', mimeType:'image/jpeg', fileName:'recibo.jpg', ocr:{ ok:true, fields:{ titular:null, direccion:null, distrito:null, provincia:null, potencia:9.9 }, rawText:'', source:'image_ocr' } } },{ text:'A' },{ text:'Jiron Huaraz 2096\nPueblo Libre\nLima' },{ text:'A' }],
    checks: [{ label:'ocr parcial', fn: includes('Pude leer parte del recibo') },{ label:'avance paso 2', fn:lastIncludes('Paso 2 de 5: persona que recibirá la visita') }]
  }
];

for (const c of cases) {
  try {
    const r = await runCase(c.name, c.phone, c.steps, c.checks);
    console.log(`CASE ${r.name}: ${r.ok ? 'OK' : 'FAIL'}`);
    if (!r.ok) {
      console.log('FAILED', JSON.stringify(r.failed));
      for (const item of r.transcript.slice(-8)) {
        console.log('---');
        console.log(item.in.replace(/\n/g, ' / '));
        console.log(item.out.replace(/\n/g, ' | '));
      }
    }
  } catch (e) {
    console.log(`CASE ${c.name}: EXCEPTION`);
    console.log(String(e?.stack || e));
  }
}
process.exit(0);
