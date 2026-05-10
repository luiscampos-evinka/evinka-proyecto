import fs from 'node:fs';
import { loadEnv } from '../src/config.mjs';
import { SupabaseRest } from '../src/supabase.mjs';
import { ChatbotEngine } from '../src/chatbotEngine.mjs';

loadEnv();

const sb = new SupabaseRest({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY });
const engine = new ChatbotEngine({ sb });
const outPath = '/root/.openclaw/workspace/.runtime/chat-stress-30-report.json';
fs.mkdirSync('/root/.openclaw/workspace/.runtime', { recursive: true });

const DISTRICTS = [
  ['Pueblo Libre', 'JR HUARAZ 2096', '7.4', 'LIMA CENTRO'],
  ['Jesus Maria', 'AV BRASIL 1820', '9.9', 'LIMA CENTRO'],
  ['Surquillo', 'AV ALMIRANTE CORNEJO 2049', '9.9', 'LIMA CENTRO'],
  ['San Miguel', 'AV LA MARINA 2450', '7.4', 'LIMA CENTRO'],
  ['Comas', 'AV TUPAC AMARU 6500', '9.9', 'LIMA NORTE'],
  ['Los Olivos', 'AV PERU 5050', '7.2', 'LIMA NORTE'],
  ['Chorrillos', 'AV DEFENSORES 880', '11', 'LIMA SUR'],
  ['Villa El Salvador', 'AV EL SOL 999', '7.4', 'LIMA SUR'],
  ['Ate', 'AV LOS QUECHUAS 140', '7.4', 'LIMA ESTE'],
  ['La Molina', 'AV LOS INGENIEROS 845', '9.9', 'LIMA ESTE'],
  ['Lince', 'AV AREQUIPA 2220', '7.4', 'LIMA CENTRO'],
  ['Barranco', 'AV GRAU 120', '7.4', 'LIMA CENTRO'],
  ['San Juan de Lurigancho', 'AV PROCERES 3100', '7.4', 'LIMA ESTE'],
  ['Miraflores', 'AV BENAVIDES 1234', '9.9', 'LIMA CENTRO'],
  ['San Borja', 'AV AVIACION 3200', '7.4', 'LIMA CENTRO'],
  ['Magdalena del Mar', 'AV BRASIL 3500', '7.4', 'LIMA CENTRO'],
  ['San Isidro', 'AV JAVIER PRADO 1200', '11', 'LIMA CENTRO'],
  ['Villa Maria del Triunfo', 'AV PACHACUTEC 1800', '7.4', 'LIMA SUR'],
];

function phoneFor(index) {
  return String(919300000 + index).slice(0, 9);
}

function personFor(index) {
  const doc = String(76000000 + index);
  return {
    name: `Cliente Prueba ${index}`,
    doc,
    phone: String(900000000 + index),
    email: `luis.campos+stress${index}@evinka.tech`,
  };
}

function replyText(reply) {
  if (typeof reply === 'string') return reply;
  if (reply && typeof reply.text === 'string') return reply.text;
  return '';
}

function replyKind(reply) {
  if (typeof reply === 'string') return 'text';
  return reply?.kind || typeof reply;
}

function pickOption(reply, index = 0) {
  if (!reply || typeof reply !== 'object') return 'A';
  if (reply.kind === 'buttons') {
    const buttons = (reply.buttons || []).filter(b => b?.id && b.id !== 'ASESOR');
    return buttons[index % buttons.length]?.id || buttons[0]?.id || 'A';
  }
  if (reply.kind === 'list') {
    const rows = [];
    for (const section of reply.sections || []) {
      for (const row of section.rows || []) {
        if (row?.id && row.id !== 'ASESOR') rows.push(row);
      }
    }
    return rows[index % rows.length]?.id || rows[0]?.id || 'A';
  }
  return 'A';
}

function normalize(s = '') {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function detectLoop(transcript) {
  let streak = 1;
  for (let i = 1; i < transcript.length; i += 1) {
    const prev = normalize(replyText(transcript[i - 1].out));
    const cur = normalize(replyText(transcript[i].out));
    if (prev && prev === cur) {
      streak += 1;
      if (streak >= 3) return { ok: false, sample: replyText(transcript[i].out) };
    } else {
      streak = 1;
    }
  }
  return { ok: true };
}

function basicReplyIssues(transcript) {
  const issues = [];
  for (const item of transcript) {
    const text = replyText(item.out);
    if (!text) issues.push(`respuesta vacía tras input: ${item.in}`);
    if (text.includes('undefined')) issues.push(`respuesta con undefined tras input: ${item.in}`);
    if (text.includes('[object Object]')) issues.push(`respuesta serializada mal tras input: ${item.in}`);
  }
  const loop = detectLoop(transcript);
  if (!loop.ok) issues.push(`posible bucle: 3 respuestas iguales seguidas -> ${loop.sample.slice(0, 120)}`);
  return issues;
}

async function getLatestAppointment(userId) {
  const rows = await sb.select('citas', `id_usuario=eq.${encodeURIComponent(userId)}&order=creado_en.desc&limit=1&select=*`);
  return rows[0] || null;
}

async function getLatestConversation(userId) {
  const rows = await sb.select('conversaciones', `id_usuario=eq.${encodeURIComponent(userId)}&order=actualizado_en.desc&limit=1&select=*`);
  return rows[0] || null;
}

async function runScheduleCase({ name, index, district, address, power, expectedZone, corrections = {} }) {
  const person = personFor(index);
  const phone = phoneFor(index);
  const transcript = [];
  const push = async (text = '', media = null) => {
    const out = await engine.handleIncoming({ phone, text, media });
    transcript.push({ in: media ? '[media]' : text, out });
    return out;
  };

  await push('hola');
  await push('A');
  await push('A');
  await push('B');
  await push(address);
  await push(district);
  await push('Lima');
  await push(power);
  await push('A');
  await push('A');
  await push(person.name);

  if (corrections.docInvalid) await push('123');
  await push(person.doc);

  if (corrections.phoneInvalid) await push('555');
  await push(person.phone);

  if (corrections.emailInvalid) await push('correo-malo');
  await push(person.email);
  await push('A');

  if (corrections.addressRestart) {
    await push('B');
    await push('B');
    await push(address);
    await push(district);
    await push('Lima');
    await push(power);
    await push('A');
    await push('A');
    await push(person.name);
    await push(person.doc);
    await push(person.phone);
    await push(person.email);
    await push('A');
    await push('A');
  } else {
    await push('A');
  }

  await push('BYD');
  if (corrections.vehicleInvalid) await push('???');
  await push('Yuan Up');
  await push('BEV');
  await push('A');
  const dayMenu = await push(corrections.noAgenda ? 'B' : 'A');

  const issues = basicReplyIssues(transcript);
  const userId = `whatsapp_${phone}`;

  if (corrections.noAgenda) {
    const conv = await getLatestConversation(userId);
    const finalText = replyText(dayMenu);
    if (!finalText.includes('No agendaremos la visita técnica por ahora')) issues.push('no respondió correctamente al elegir no agendar');
    return { name, ok: issues.length === 0, issues, phone, transcriptTail: transcript.slice(-8), finalText, kindCounts: summarizeKinds(transcript), conversationStep: conv?.paso_actual || null };
  }

  if (corrections.expectZoneHandoff) {
    const conv = await getLatestConversation(userId);
    const finalText = replyText(dayMenu);
    if (!finalText.includes('No pude identificar una zona válida')) issues.push('no hizo handoff esperado por zona inválida');
    if (conv?.paso_actual !== 'handoff_asesor') issues.push(`paso final inesperado para handoff: ${conv?.paso_actual || 'null'}`);
    return { name, ok: issues.length === 0, issues, phone, transcriptTail: transcript.slice(-8), finalText, kindCounts: summarizeKinds(transcript), conversationStep: conv?.paso_actual || null };
  }

  const dayChoice = pickOption(dayMenu, index);
  const hourMenu = await push(dayChoice);
  const hourChoice = pickOption(hourMenu, index + 1);
  const finalReply = await push(hourChoice);

  const cita = await getLatestAppointment(userId);
  const conv = await getLatestConversation(userId);
  const finalText = replyText(finalReply);

  if (!finalText.includes('Ticket: WA-')) issues.push('no devolvió ticket final');
  if (!finalText.includes('Tu visita técnica quedó confirmada')) issues.push('no devolvió confirmación final');
  if (!cita) issues.push('no se encontró cita en Supabase');
  if (cita && cita.estado_cita !== 'confirmada') issues.push(`estado_cita inesperado: ${cita.estado_cita}`);
  if (cita && cita.zona_cliente !== expectedZone) issues.push(`zona_cliente inesperada: ${cita?.zona_cliente} != ${expectedZone}`);
  if (conv && conv.paso_actual !== 'cita_confirmada') issues.push(`paso_actual inesperado: ${conv?.paso_actual}`);

  return {
    name,
    ok: issues.length === 0,
    issues,
    phone,
    ticket: cita?.codigo_cita || null,
    doc: person.doc,
    kindCounts: summarizeKinds(transcript),
    finalText,
    transcriptTail: transcript.slice(-8),
    appointment: cita ? { ticket: cita.codigo_cita, date: cita.fecha_cita, hour: cita.hora_inicio, zone: cita.zona_cliente, status: cita.estado_cita } : null,
    conversationStep: conv?.paso_actual || null,
  };
}

function summarizeKinds(transcript) {
  return transcript.reduce((acc, item) => {
    const kind = replyKind(item.out);
    acc[kind] = (acc[kind] || 0) + 1;
    return acc;
  }, {});
}

async function runSimpleCase({ name, index, steps, expectIncludes = [], expectStep = null }) {
  const phone = phoneFor(index);
  const transcript = [];
  const push = async (text = '', media = null) => {
    const out = await engine.handleIncoming({ phone, text, media });
    transcript.push({ in: media ? '[media]' : text, out });
    return out;
  };

  for (const step of steps) {
    await push(step.text || '', step.media || null);
  }

  const issues = basicReplyIssues(transcript);
  const finalText = replyText(transcript.at(-1)?.out);
  for (const needle of expectIncludes) {
    if (!transcript.some(item => replyText(item.out).includes(needle))) issues.push(`faltó texto esperado: ${needle}`);
  }
  const conv = await getLatestConversation(`whatsapp_${phone}`);
  if (expectStep && conv?.paso_actual !== expectStep) issues.push(`paso_actual inesperado: ${conv?.paso_actual || 'null'} != ${expectStep}`);
  return {
    name,
    ok: issues.length === 0,
    issues,
    phone,
    kindCounts: summarizeKinds(transcript),
    finalText,
    transcriptTail: transcript.slice(-8),
    conversationStep: conv?.paso_actual || null,
  };
}

async function runReprogramCase({ name, index, ticket }) {
  const phone = phoneFor(index);
  const transcript = [];
  const push = async (text = '') => {
    const out = await engine.handleIncoming({ phone, text });
    transcript.push({ in: text, out });
    return out;
  };
  await push('hola');
  await push('B');
  await push(ticket);
  const dayMenu = await push('A');
  const dayChoice = pickOption(dayMenu, 1);
  const hourMenu = await push(dayChoice);
  const hourChoice = pickOption(hourMenu, 2);
  const finalReply = await push(hourChoice);
  const rows = await sb.select('citas', `codigo_cita=eq.${encodeURIComponent(ticket)}&select=*`);
  const cita = rows[0] || null;
  const issues = basicReplyIssues(transcript);
  const finalText = replyText(finalReply);
  if (!finalText.includes('Ticket: WA-')) issues.push('no devolvió ticket al reprogramar');
  if (!cita || cita.estado_cita !== 'reprogramada') issues.push(`estado de reprogramación inesperado: ${cita?.estado_cita || 'null'}`);
  return { name, ok: issues.length === 0, issues, phone, ticket, finalText, transcriptTail: transcript.slice(-8), kindCounts: summarizeKinds(transcript), appointment: cita ? { date: cita.fecha_cita, hour: cita.hora_inicio, status: cita.estado_cita } : null };
}

async function runCancelCase({ name, index, ticket }) {
  const phone = phoneFor(index);
  const transcript = [];
  const push = async (text = '') => {
    const out = await engine.handleIncoming({ phone, text });
    transcript.push({ in: text, out });
    return out;
  };
  await push('hola');
  await push('C');
  await push(ticket);
  const finalReply = await push('A');
  const rows = await sb.select('citas', `codigo_cita=eq.${encodeURIComponent(ticket)}&select=*`);
  const cita = rows[0] || null;
  const issues = basicReplyIssues(transcript);
  const finalText = replyText(finalReply);
  if (!finalText.includes('Tu cita ha sido cancelada correctamente')) issues.push('no confirmó cancelación');
  if (!cita || cita.estado_cita !== 'cancelada') issues.push(`estado de cancelación inesperado: ${cita?.estado_cita || 'null'}`);
  return { name, ok: issues.length === 0, issues, phone, ticket, finalText, transcriptTail: transcript.slice(-8), kindCounts: summarizeKinds(transcript), appointment: cita ? { status: cita.estado_cita } : null };
}

async function runIdentityLookupCase({ name, index, doc, expectedAction }) {
  const phone = phoneFor(index);
  const transcript = [];
  const push = async (text = '') => {
    const out = await engine.handleIncoming({ phone, text });
    transcript.push({ in: text, out });
    return out;
  };
  await push('hola');
  await push(expectedAction === 'cancel' ? 'C' : 'B');
  await push('WA-FAKE-0000');
  await push(doc);
  const confirmReply = await push('A');
  let finalReply = confirmReply;
  if (expectedAction === 'cancel') {
    finalReply = await push('A');
  } else {
    const dayReply = await push('A');
    const hourReply = await push(pickOption(dayReply, 0));
    finalReply = await push(pickOption(hourReply, 0));
  }
  const issues = basicReplyIssues(transcript);
  const text = replyText(finalReply);
  if (expectedAction === 'cancel' && !text.includes('Tu cita ha sido cancelada correctamente')) issues.push('lookup por identidad no terminó en cancelación');
  if (expectedAction === 'reschedule' && !text.includes('Ticket: WA-')) issues.push('lookup por identidad no terminó en reprogramación');
  return { name, ok: issues.length === 0, issues, phone, finalText: text, transcriptTail: transcript.slice(-8), kindCounts: summarizeKinds(transcript) };
}

const results = [];
const ticketBag = [];

function persistProgress() {
  const summary = {
    totalPlanned: 30,
    finished: results.length,
    passed: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    failedNames: results.filter(r => !r.ok).map(r => r.name),
  };
  fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), summary, results }, null, 2));
}

function recordResult(result) {
  results.push(result);
  persistProgress();
  console.log(`CASE ${results.length}/30 ${result.name}: ${result.ok ? 'OK' : 'FAIL'}`);
  if (!result.ok) console.log(`ISSUES ${result.name}: ${result.issues.join(' | ')}`);
}

for (let i = 0; i < DISTRICTS.length; i += 1) {
  const [district, address, power, zone] = DISTRICTS[i];
  const corrections = {};
  if (i === 12) corrections.docInvalid = true;
  if (i === 13) corrections.phoneInvalid = true;
  if (i === 14) corrections.emailInvalid = true;
  if (i === 15) corrections.vehicleInvalid = true;
  if (i === 16) corrections.noAgenda = true;
  console.log(`START schedule ${i + 1}/18 ${district}`);
  const result = await runScheduleCase({
    name: `schedule_${String(i + 1).padStart(2, '0')}_${normalize(district).replace(/ /g, '_')}`,
    index: i + 1,
    district,
    address,
    power,
    expectedZone: zone,
    corrections,
  });
  recordResult(result);
  if (result.ticket) ticketBag.push({ ticket: result.ticket, doc: result.doc });
}

console.log('START case 19/30 no_consent');
recordResult(await runSimpleCase({
  name: 'simple_19_no_consent',
  index: 19,
  steps: [{ text: 'hola' }, { text: 'A' }, { text: 'B' }, { text: 'A' }],
  expectIncludes: ['Sin tu autorización no puedo continuar', 'Bienvenido a EVINKA'],
}));

console.log('START case 20/30 directo_asesor');
recordResult(await runSimpleCase({
  name: 'simple_20_directo_asesor',
  index: 20,
  steps: [{ text: 'hola' }, { text: 'D' }],
  expectIncludes: ['Te voy a derivar con un asesor'],
  expectStep: 'handoff_asesor',
}));

console.log('START case 21/30 saludo_reinicia');
recordResult(await runSimpleCase({
  name: 'simple_21_saludo_reinicia',
  index: 21,
  steps: [{ text: 'hola' }, { text: 'A' }, { text: 'hola' }],
  expectIncludes: ['Bienvenido a EVINKA'],
  expectStep: 'menu_principal',
}));

console.log('START case 22/30 archivo_antes_de_tiempo');
recordResult(await runSimpleCase({
  name: 'simple_22_archivo_antes_de_tiempo',
  index: 22,
  steps: [{ text: 'hola' }, { text: 'A' }, { media: { id: 'mx1', mimeType: 'image/jpeg', fileName: 'recibo.jpg', error: 'not-in-step' } }],
  expectIncludes: ['Todavía no estamos en el paso del recibo'],
}));

console.log('START case 23/30 ocr_parcial');
recordResult(await runSimpleCase({
  name: 'simple_23_ocr_parcial',
  index: 23,
  steps: [
    { text: 'hola' },
    { text: 'A' },
    { text: 'A' },
    { media: { id: 'mocr1', mimeType: 'image/jpeg', fileName: 'recibo.jpg', ocr: { ok: true, fields: { titular: null, direccion: null, distrito: null, provincia: null, potencia: 9.9 }, rawText: '', source: 'image_ocr' } } },
    { text: 'A' },
    { text: 'JR HUARAZ 2096' },
    { text: 'Pueblo Libre' },
    { text: 'Lima' },
    { text: '7.4' },
    { text: 'A' }
  ],
  expectIncludes: ['Pude leer parte del recibo', 'Paso 2 de 5: persona que recibirá la visita'],
}));

console.log('START case 24/30 unknown_district_handoff');
recordResult(await runScheduleCase({
  name: 'schedule_24_unknown_district_handoff',
  index: 24,
  district: 'Huancayo',
  address: 'JR PRUEBA 123',
  power: '7.4',
  expectedZone: null,
  corrections: { expectZoneHandoff: true },
}));

console.log('START case 25/30 address_restart');
recordResult(await runScheduleCase({
  name: 'schedule_25_address_restart',
  index: 25,
  district: 'Jesus Maria',
  address: 'AV BRASIL 1900',
  power: '7.4',
  expectedZone: 'LIMA CENTRO',
  corrections: { addressRestart: true },
}));

if (ticketBag[0]) {
  console.log('START case 26/30 reprogram_ticket_directo');
  recordResult(await runReprogramCase({ name: 'manage_26_reprogram_ticket_directo', index: 26, ticket: ticketBag[0].ticket }));
}
if (ticketBag[1]) {
  console.log('START case 27/30 cancel_ticket_directo');
  recordResult(await runCancelCase({ name: 'manage_27_cancel_ticket_directo', index: 27, ticket: ticketBag[1].ticket }));
}
if (ticketBag[2]) {
  console.log('START case 28/30 lookup_por_dni_reprograma');
  recordResult(await runIdentityLookupCase({ name: 'manage_28_lookup_por_dni_reprograma', index: 28, doc: ticketBag[2].doc, expectedAction: 'reschedule' }));
}
if (ticketBag[3]) {
  console.log('START case 29/30 lookup_por_dni_cancela');
  recordResult(await runIdentityLookupCase({ name: 'manage_29_lookup_por_dni_cancela', index: 29, doc: ticketBag[3].doc, expectedAction: 'cancel' }));
}

console.log('START case 30/30 ticket_inexistente_sin_resultados');
recordResult(await runSimpleCase({
  name: 'simple_30_ticket_inexistente_sin_resultados',
  index: 30,
  steps: [{ text: 'hola' }, { text: 'C' }, { text: 'WA-FAKE-1234' }, { text: '12345678' }, { text: 'B' }],
  expectIncludes: ['No pude encontrar una cita con ese ticket', 'No pude encontrar citas registradas con esos datos', 'Te voy a derivar con un asesor'],
  expectStep: 'handoff_asesor',
}));

const summary = {
  total: results.length,
  passed: results.filter(r => r.ok).length,
  failed: results.filter(r => !r.ok).length,
  failedNames: results.filter(r => !r.ok).map(r => r.name),
};

const report = { generatedAt: new Date().toISOString(), summary, results };
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (summary.failed) {
  for (const item of results.filter(r => !r.ok)) {
    console.log(`FAIL ${item.name}: ${item.issues.join(' | ')}`);
  }
}
console.log(`REPORT ${outPath}`);
