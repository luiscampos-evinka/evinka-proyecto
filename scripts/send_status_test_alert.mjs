import { loadEnv, requiredEnv } from '../src/config.mjs';
import { WhatsAppMetaClient } from '../src/whatsappMeta.mjs';

loadEnv();

const rawTo = process.argv[2] || '';
const to = rawTo.replace(/\D/g, '');
if (!to) {
  console.error('Uso: node scripts/send_status_test_alert.mjs 51904432138');
  process.exit(1);
}

const meta = new WhatsAppMetaClient({
  accessToken: requiredEnv('WHATSAPP_ACCESS_TOKEN'),
  phoneNumberId: requiredEnv('WHATSAPP_PHONE_NUMBER_ID'),
  appSecret: process.env.META_APP_SECRET,
});

const body = [
  '🚨 EVINKA ALERTA',
  'Estación: La Cabrera - Surco',
  'Qué pasó: Offline',
  'Significa: el cargador perdió comunicación',
  'Dónde: La Cabrera - El Polo',
  'Cuándo: 8:58 PM',
].join('\n');

const result = await meta.sendButtons(to, {
  body,
  footer: 'Prueba interna de notificaciones EVINKA',
  buttons: [
    { id: 'status_alerts_24h', title: 'Silenciar alertas' },
    { id: 'status_states_24h', title: 'Silenciar estados' },
    { id: 'status_resume_on', title: 'Reactivar' },
  ],
});

console.log(JSON.stringify({ ok: true, to, result }, null, 2));
