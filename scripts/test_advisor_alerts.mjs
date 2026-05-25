import assert from 'node:assert/strict';
import {
  resolveAdvisorAlertRecipients,
  resolveAdvisorQueue,
} from '../src/advisorAlertRouting.mjs';

const users = [
  {
    id: 'admin-luis',
    name: 'Luis Campos',
    email: 'luis.campos@evinka.tech',
    employeeCode: 'LUIS',
    notificationPhone: '+51904432138',
    role: 'admin',
    status: 'active',
    allowedCountries: ['PE'],
    allowedQueues: [],
  },
  {
    id: 'kam-raul',
    name: 'Raul Flores',
    email: 'raul.flores@evinka.tech',
    employeeCode: 'RAUL',
    notificationPhone: '+51923587116',
    role: 'kam_b2c',
    status: 'active',
    allowedCountries: ['PE'],
    allowedQueues: ['comercial', 'b2b'],
  },
  {
    id: 'kam-antonio',
    name: 'ANTONIO',
    email: 'antonio.milla@evinka.tech',
    employeeCode: 'ANTONIO',
    notificationPhone: '+51997446447',
    role: 'kam_b2c',
    status: 'active',
    allowedCountries: ['PE'],
    allowedQueues: ['comercial', 'b2b'],
  },
  {
    id: 'admin-julio',
    name: 'Julio Campos',
    email: 'julio.campos@evinka.tech',
    employeeCode: 'ADMIN1',
    notificationPhone: '+51945149285',
    role: 'admin',
    status: 'active',
    allowedCountries: ['PE'],
    allowedQueues: [],
  },
  {
    id: 'co-luisa',
    name: 'Luisa Trillos',
    email: 'luisa.trillos@evinka.tech',
    employeeCode: 'LUISA',
    notificationPhone: '+573028564794',
    role: 'asesor_co',
    status: 'active',
    allowedCountries: ['CO'],
    allowedQueues: ['comercial'],
  },
];

const commercialPe = resolveAdvisorAlertRecipients(users, { countryCode: 'PE', queueKey: 'comercial' });
assert.deepEqual(commercialPe.map((user) => user.name), ['Luis Campos', 'Raul Flores']);
console.log('✓ comercial PE notifica solo a Luis + Raúl (sin Antonio ni otros admins)');

const b2bPe = resolveAdvisorAlertRecipients(users, { countryCode: 'PE', queueKey: 'b2b' });
assert.deepEqual(b2bPe.map((user) => user.name), ['ANTONIO', 'Luis Campos', 'Raul Flores']);
console.log('✓ b2b PE notifica a los 3 con Antonio priorizado');

const commercialCo = resolveAdvisorAlertRecipients(users, { countryCode: 'CO', queueKey: 'comercial' });
assert.deepEqual(commercialCo.map((user) => user.name), ['Luisa Trillos']);
console.log('✓ comercial CO respeta país');

assert.equal(resolveAdvisorQueue({ conversation: { motivo_handoff: 'Cliente empresa solicita asesor corporativo' } }), 'b2b');
assert.equal(resolveAdvisorQueue({ conversation: { motivo_handoff: 'Quiero hablar con asesor para mi casa' } }), 'comercial');
console.log('✓ clasificación de cola comercial vs b2b OK');

console.log('\n4 pruebas de alertas de asesor OK.');
