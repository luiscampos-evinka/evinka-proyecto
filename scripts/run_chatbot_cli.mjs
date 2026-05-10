import fs from 'node:fs';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { loadEnv, requiredEnv } from '../src/config.mjs';
import { SupabaseRest } from '../src/supabase.mjs';
import { ChatbotEngine } from '../src/chatbotEngine.mjs';

loadEnv();

const sb = new SupabaseRest({
  url: requiredEnv('SUPABASE_URL'),
  key: requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
});

const engine = new ChatbotEngine({ sb });
const phone = process.env.TEST_PHONE || '900000001';

async function runPiped() {
  const raw = fs.readFileSync(0, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    if (line.trim() === '/exit') break;
    const response = await engine.handleIncoming({ phone, text: line || 'hola' });
    console.log(`\nTú: ${line}\n\nBot:\n${response}\n`);
  }
}

async function runInteractive() {
  const rl = readline.createInterface({ input, output });
  console.log(`CLI EVINKA listo. Teléfono de prueba: ${phone}`);
  console.log('Escribe /exit para salir.');
  while (true) {
    const text = await rl.question('Tú: ');
    if (text.trim() === '/exit') break;
    const response = await engine.handleIncoming({ phone, text: text || 'hola' });
    console.log(`\nBot:\n${response}\n`);
  }
  rl.close();
}

if (process.stdin.isTTY) {
  await runInteractive();
} else {
  await runPiped();
}
