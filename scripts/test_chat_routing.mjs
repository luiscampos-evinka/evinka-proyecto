import assert from 'node:assert/strict';
import { classifyRoutingTarget, detectCorporateLead } from '../src/chatRouting.mjs';

const cases = [
  {
    name: 'b2c_geely_compra_personal',
    text: 'Buenas tardes. Le saluda Christian Juárez. Actualmente me encuentro en la compra de un vehículo Geely Ex5 EMI. Y me comenta la ejecutiva Rosario Ortiz que tengo que evaluar la instalación del cargador con ustedes. Mi dirección queda en Mariabi Cornejo 1685, Pueblo Libre. Quería saber cómo podríamos gestionar una visita para evaluar la instalación.',
    route: 'bot',
  },
  {
    name: 'b2c_byd_casa',
    text: 'Hola, voy a comprar un BYD y quiero instalar un cargador en mi casa. Mi dirección es en Surco.',
    route: 'bot',
  },
  {
    name: 'b2c_marca_y_recibo',
    text: 'Compré un Toyota y quiero cotizar el cargador para mi domicilio. Tengo mi recibo de luz listo.',
    route: 'bot',
  },
  {
    name: 'b2c_consulta_normal',
    text: 'Quiero coordinar una visita para evaluar la instalación del cargador en mi casa.',
    route: 'bot',
  },
  {
    name: 'b2b_intro_empresa',
    text: 'Hola, soy Christian Juárez de Geely y quiero coordinar la evaluación de cargadores para nuestros clientes.',
    route: 'advisor_b2b',
    companyName: 'Geely',
  },
  {
    name: 'b2b_somos_empresa',
    text: 'Somos de Astara y necesitamos instalar varios cargadores en nuestra sede.',
    route: 'advisor_b2b',
    companyName: 'Astara',
  },
  {
    name: 'b2b_contexto_sin_marca',
    text: 'Necesitamos una propuesta para nuestra empresa y para varias sedes con múltiples cargadores.',
    route: 'advisor_b2b',
  },
  {
    name: 'b2b_concesionario',
    text: 'Te escribo de Grupo Pana por un proyecto de concesionario y flota.',
    route: 'advisor_b2b',
    companyName: 'Grupo Pana',
  },
  {
    name: 'b2b_suffix',
    text: 'Hola, soy Ana de Inversiones Eléctricas SAC y queremos una solución para nuestra flota.',
    route: 'advisor_b2b',
    companyName: 'Inversiones Eléctricas SAC',
  },
  {
    name: 'ambiguous_brand_only',
    text: 'Geely',
    route: 'bot',
  },
  {
    name: 'ambiguous_de_distrito',
    text: 'Hola soy Luis de Pueblo Libre y quiero instalar un cargador en mi casa.',
    route: 'bot',
  },
  {
    name: 'consumer_mention_ejecutiva',
    text: 'La ejecutiva de BYD me dijo que coordine la visita con ustedes para mi domicilio.',
    route: 'bot',
  },
];

let passed = 0;
for (const testCase of cases) {
  const result = classifyRoutingTarget(testCase.text);
  assert.equal(result.route, testCase.route, `${testCase.name}: ruta inesperada (${result.route})`);
  if (testCase.route === 'advisor_b2b') {
    const corporateLead = detectCorporateLead(testCase.text);
    assert.ok(corporateLead, `${testCase.name}: debía detectar lead corporativo`);
    if (testCase.companyName) {
      assert.equal(corporateLead.companyName, testCase.companyName, `${testCase.name}: empresa inesperada`);
    }
  } else {
    assert.equal(detectCorporateLead(testCase.text), null, `${testCase.name}: no debía detectar lead corporativo`);
  }
  passed += 1;
  console.log(`✓ ${testCase.name} -> ${result.route}`);
}

console.log(`\n${passed} pruebas de routing OK.`);
