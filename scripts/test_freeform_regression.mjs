import { loadEnv } from '../src/config.mjs';
import { SupabaseRest } from '../src/supabase.mjs';
import { ChatbotEngine } from '../src/chatbotEngine.mjs';

loadEnv();
const sb = new SupabaseRest({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY });
const engine = new ChatbotEngine({ sb });

async function runCase(name, phone, steps) {
  const out = [];
  for (const text of steps) {
    const reply = await engine.handleIncoming({ phone, text });
    out.push({ text, reply });
  }
  return { name, out };
}

const pre = ['hola','A','A','B','Jiron Huaraz 2096\nPueblo Libre\nLima\n9.9','A','A'];
const cases = [
  ['persona_frase_larga', '910000201', [...pre, 'hola soy luis angel campos valenzuela , mi dni es 76298591 mi celu es 904432138 y mi correo es luis.campos.v@gmail.com', 'A']],
  ['persona_desordenada', '910000202', [...pre, 'mi correo es frozenflamem4@gmail.com\n904432138\nme llamo luis angel campos valenzuela\ndni 76298591', 'A']],
  ['persona_slash', '910000203', [...pre, 'LUIS ANGEL CAMPOS VALENZUELA / 76298591 / +51 904 432 138 / luis.campos.v@gmail.com', 'A']],
  ['persona_bullets', '910000204', [...pre, 'Hola, te paso mis datos:\n- Nombre: Luis Angel Campos Valenzuela\n- DNI: 76298591\n- Celular: 904432138\n- Correo: luis.campos.v@gmail.com', 'A']],
  ['persona_incompleta', '910000205', [...pre, 'Luis Angel Campos Valenzuela\n76298591\nluis.campos.v@gmail.com']],
  ['recibo_semicolon', '910000206', ['hola','A','A','B','📍 Dirección del suministro: Jiron Huaraz 2096; Distrito: Pueblo Libre; Provincia: Lima; Potencia: 9.9 kW']],
  ['recibo_compacto', '910000207', ['hola','A','A','B','Jiron Huaraz 2096 Pueblo Libre Lima 9.9']],
  ['vehiculo_labels', '910000208', [...pre, 'Luis Angel Campos Valenzuela\n76298591\n904432138\nluis.campos.v@gmail.com', 'A', 'Marca: BYD\nModelo: Yuan Up\nTipo: BEV']],
  ['vehiculo_basura_luego_ok', '910000209', [...pre, 'Luis Angel Campos Valenzuela\n76298591\n904432138\nluis.campos.v@gmail.com', 'A', 'asdf qwer zxcv', 'OÑO AFSKDJ\nBEV', 'BYD Yuan Up\nBEV']],
  ['rama_d_texto_doc', '910000032', ['hola','D','ticket malo','Mi DNI es 12345678 gracias']],
  ['flujo_completo_hasta_agenda', '910000210', [...pre, 'Luis Angel Campos Valenzuela / 76298591 / 904432138 / luis.campos.v@gmail.com', 'A', 'BYD Yuan Up\nBEV', 'A', 'A', 'A']],
];

for (const [name, phone, steps] of cases) {
  const res = await runCase(name, phone, steps);
  console.log(`\n=== ${res.name} ===`);
  for (const item of res.out) {
    console.log('---');
    console.log(item.text.replace(/\n/g, ' / '));
    console.log(item.reply.replace(/\n/g, ' | '));
  }
}
process.exit(0);
