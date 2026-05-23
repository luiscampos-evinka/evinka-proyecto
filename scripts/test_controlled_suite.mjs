import assert from 'node:assert/strict';
import { ChatbotEngine } from '../src/chatbotEngine.mjs';
import { classifyRoutingTarget } from '../src/chatRouting.mjs';

function fakeEvent({ id, createdDateTime, start, end, zone, country = null, cancelled = false }) {
  return {
    id,
    createdDateTime,
    isCancelled: cancelled,
    start: { dateTime: start, timeZone: 'America/Lima' },
    end: { dateTime: end, timeZone: 'America/Lima' },
    bodyPreview: `${country ? `País: ${country}\n` : ''}Zona: ${zone}`,
  };
}

class FakeCalendar {
  constructor(map = {}) { this.map = map; }
  async listEvents({ startDateTime }) {
    const date = String(startDateTime).slice(0, 10);
    return this.map[date] || [];
  }
}

async function run(name, fn) {
  await fn();
  console.log(`✓ ${name}`);
}

await run('routing_b2c_geely_keeps_bot', async () => {
  const result = classifyRoutingTarget('Buenas tardes. Actualmente me encuentro en la compra de un vehículo Geely Ex5 EMI y quiero evaluar la instalación del cargador en mi casa.');
  assert.equal(result.route, 'bot');
});

await run('routing_b2b_empresa_goes_b2b', async () => {
  const result = classifyRoutingTarget('Hola, soy Christian Juárez de Geely y queremos coordinar cargadores para nuestros clientes.');
  assert.equal(result.route, 'advisor_b2b');
});

await run('agenda_max_5_days', async () => {
  const engine = new ChatbotEngine({ sb: null, calendar: new FakeCalendar({}) });
  const days = await engine.availableDaysForZone('LIMA CENTRO');
  assert.equal(days.length, 5);
});

await run('agenda_ignores_other_zone_occupancy', async () => {
  const engine = new ChatbotEngine({ sb: null, calendar: new FakeCalendar({
    '2026-04-28': [fakeEvent({ id:'1', createdDateTime:'2026-04-24T10:00:00Z', start:'2026-04-28T10:00:00-05:00', end:'2026-04-28T10:45:00-05:00', zone:'LIMA NORTE', country:'PE' })],
  }) });
  const hours = await engine.availableHoursForDate('2026-04-28', { clientZone: 'LIMA CENTRO' });
  assert.ok(hours.some((h) => h.time === '10:00:00'));
});

await run('agenda_allows_same_zone_except_busy_slot', async () => {
  const engine = new ChatbotEngine({ sb: null, calendar: new FakeCalendar({
    '2026-04-28': [fakeEvent({ id:'1', createdDateTime:'2026-04-24T10:00:00Z', start:'2026-04-28T10:00:00-05:00', end:'2026-04-28T10:45:00-05:00', zone:'LIMA CENTRO', country:'PE' })],
  }) });
  const hours = await engine.availableHoursForDate('2026-04-28', { clientZone: 'LIMA CENTRO' });
  assert.ok(hours.length >= 1);
  assert.ok(!hours.some((h) => h.time === '10:00:00'));
});

await run('agenda_skips_weekends', async () => {
  const engine = new ChatbotEngine({ sb: null, calendar: new FakeCalendar({}) });
  const days = await engine.availableDaysForZone('LIMA CENTRO');
  assert.ok(days.every((d) => !['sabado', 'sábado', 'domingo'].includes(d.weekday)));
});

await run('agenda_hides_full_day', async () => {
  const slots = [
    ['10:00:00','10:45:00'],['11:30:00','12:15:00'],['14:00:00','14:45:00'],['15:30:00','16:15:00'],
  ];
  const engine = new ChatbotEngine({ sb: null, calendar: new FakeCalendar({
    '2026-04-27': slots.map((s, i) => fakeEvent({ id:String(i+1), createdDateTime:`2026-04-24T10:0${i}:00Z`, start:`2026-04-27T${s[0]}-05:00`, end:`2026-04-27T${s[1]}-05:00`, zone:'LIMA CENTRO' })),
  }) });
  const days = await engine.availableDaysForZone('LIMA CENTRO');
  assert.ok(!days.some((d) => d.date === '2026-04-27'));
});

await run('agenda_reprogram_ignores_own_event', async () => {
  const engine = new ChatbotEngine({ sb: null, calendar: new FakeCalendar({
    '2026-04-29': [fakeEvent({ id:'same', createdDateTime:'2026-04-24T09:00:00Z', start:'2026-04-29T10:00:00-05:00', end:'2026-04-29T10:45:00-05:00', zone:'LIMA CENTRO', country:'PE' })],
  }) });
  const hours = await engine.availableHoursForDate('2026-04-29', { clientZone: 'LIMA CENTRO', excludeEventId: 'same' });
  assert.ok(hours.some((h) => h.time === '10:00:00'));
});

await run('agenda_country_prevents_cross_country_block', async () => {
  const engine = new ChatbotEngine({ sb: null, calendar: new FakeCalendar({
    '2026-04-30': [fakeEvent({ id:'co-1', createdDateTime:'2026-04-24T09:00:00Z', start:'2026-04-30T10:00:00-05:00', end:'2026-04-30T10:45:00-05:00', zone:'ÁREA 1 — SUBA–USAQUÉN', country:'CO' })],
  }) });
  const hours = await engine.availableHoursForDate('2026-04-30', { clientZone: 'LIMA CENTRO' });
  assert.ok(hours.some((h) => h.time === '10:00:00'));
});

console.log('\nSuite controlada OK.');
