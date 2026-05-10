import { loadEnv, requiredEnv } from '../src/config.mjs';
import { WhatsAppMetaClient } from '../src/whatsappMeta.mjs';

loadEnv();

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const part = argv[i];
    if (!part.startsWith('--')) continue;
    const key = part.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    out[key] = value;
  }
  return out;
}

const args = parseArgs(process.argv);
const to = String(args.to || '').trim();
const ticket = String(args.ticket || '').trim();
const dateLabel = String(args['date-label'] || '').trim();
const hourLabel = String(args['hour-label'] || '').trim();
const address = String(args.address || '').trim();

if (!to || !ticket || !dateLabel || !hourLabel || !address) {
  throw new Error('Faltan argumentos requeridos: --to --ticket --date-label --hour-label --address');
}

const meta = new WhatsAppMetaClient({
  accessToken: requiredEnv('WHATSAPP_ACCESS_TOKEN'),
  phoneNumberId: requiredEnv('WHATSAPP_PHONE_NUMBER_ID'),
  appSecret: process.env.META_APP_SECRET,
});

const body = `Recordatorio de cita EVINKA ⏰\n\nTicket: ${ticket}\nFecha: ${dateLabel}\nHora: ${hourLabel}\nDirección: ${address}\n\n¿Confirmas?`;

const result = await meta.sendText(to, body);
console.log(JSON.stringify({ ok: true, to, ticket, result }, null, 2));
