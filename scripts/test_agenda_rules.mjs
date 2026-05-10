import { loadEnv } from '../src/config.mjs';
import { SupabaseRest } from '../src/supabase.mjs';
import { ChatbotEngine } from '../src/chatbotEngine.mjs';
import { MicrosoftGraphClient } from '../src/microsoftGraph.mjs';

loadEnv();

const sb = new SupabaseRest({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY });
const realCalendar = new MicrosoftGraphClient();

function fakeEvent({ id, createdDateTime, start, end, zone, cancelled = false }) {
  return {
    id,
    createdDateTime,
    isCancelled: cancelled,
    start: { dateTime: start, timeZone: 'America/Lima' },
    end: { dateTime: end, timeZone: 'America/Lima' },
    bodyPreview: `Zona: ${zone}`,
  };
}

class FakeCalendar {
  constructor(map = {}) { this.map = map; }
  async listEvents({ startDateTime }) {
    const date = String(startDateTime).slice(0, 10);
    return this.map[date] || [];
  }
}

async function runCase(name, fn) {
  try {
    const result = await fn();
    console.log(`TEST ${name}: OK`);
    if (result) console.log(JSON.stringify(result, null, 2));
    return true;
  } catch (error) {
    console.log(`TEST ${name}: FAIL`);
    console.log(String(error?.stack || error));
    return false;
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

const tests = [
  async function max5_days() {
    const engine = new ChatbotEngine({ sb: null, calendar: new FakeCalendar({}) });
    const days = await engine.availableDaysForZone('LIMA CENTRO');
    assert(days.length === 5, `esperaba 5 días, obtuve ${days.length}`);
    assert(days[0].code === 'A' && days[4].code === 'E', 'las letras deben ir de A a E');
    return days;
  },
  async function block_other_zone() {
    const engine = new ChatbotEngine({ sb: null, calendar: new FakeCalendar({
      '2026-04-28': [fakeEvent({ id:'1', createdDateTime:'2026-04-24T10:00:00Z', start:'2026-04-28T10:00:00-05:00', end:'2026-04-28T10:45:00-05:00', zone:'LIMA NORTE' })],
    })});
    const hours = await engine.availableHoursForDate('2026-04-28', { clientZone: 'LIMA CENTRO' });
    assert(hours.length === 0, 'no debía mostrar horarios para otra zona');
  },
  async function allow_same_zone() {
    const engine = new ChatbotEngine({ sb: null, calendar: new FakeCalendar({
      '2026-04-28': [fakeEvent({ id:'1', createdDateTime:'2026-04-24T10:00:00Z', start:'2026-04-28T10:00:00-05:00', end:'2026-04-28T10:45:00-05:00', zone:'LIMA CENTRO' })],
    })});
    const hours = await engine.availableHoursForDate('2026-04-28', { clientZone: 'LIMA CENTRO' });
    assert(hours.length >= 1, 'debía dejar horarios de la misma zona');
    assert(!hours.some(h => h.time === '10:00:00'), 'debía bloquear el horario ocupado');
  },
  async function skip_weekends() {
    const engine = new ChatbotEngine({ sb: null, calendar: new FakeCalendar({}) });
    const days = await engine.availableDaysForZone('LIMA CENTRO');
    assert(days.every(d => !['sabado','sábado','domingo'].includes(d.weekday)), 'no debe incluir fin de semana');
  },
  async function renumber_filtered_days() {
    const engine = new ChatbotEngine({ sb: null, calendar: new FakeCalendar({
      '2026-04-28': [fakeEvent({ id:'1', createdDateTime:'2026-04-24T10:00:00Z', start:'2026-04-28T10:00:00-05:00', end:'2026-04-28T10:45:00-05:00', zone:'LIMA NORTE' })],
    })});
    const days = await engine.availableDaysForZone('LIMA CENTRO');
    assert(days.map(d => d.code).join(',') === 'A,B,C,D,E', 'debe renumerar limpio A-E');
  },
  async function full_day_occupied_hides_day() {
    const slots = [
      ['10:00:00','10:45:00'],['11:30:00','12:15:00'],['14:00:00','14:45:00'],['15:30:00','16:15:00']
    ];
    const map = {
      '2026-04-27': slots.map((s,i) => fakeEvent({ id:String(i+1), createdDateTime:`2026-04-24T10:0${i}:00Z`, start:`2026-04-27T${s[0]}-05:00`, end:`2026-04-27T${s[1]}-05:00`, zone:'LIMA CENTRO' }))
    };
    const engine = new ChatbotEngine({ sb: null, calendar: new FakeCalendar(map) });
    const days = await engine.availableDaysForZone('LIMA CENTRO');
    assert(!days.some(d => d.date === '2026-04-27'), 'no debe mostrar día sin horarios');
  },
  async function different_zone_day_hidden() {
    const engine = new ChatbotEngine({ sb: null, calendar: new FakeCalendar({
      '2026-04-27': [fakeEvent({ id:'1', createdDateTime:'2026-04-24T09:00:00Z', start:'2026-04-27T10:00:00-05:00', end:'2026-04-27T10:45:00-05:00', zone:'LIMA SUR' })]
    })});
    const days = await engine.availableDaysForZone('LIMA CENTRO');
    assert(!days.some(d => d.date === '2026-04-27'), 'día de otra zona no debe aparecer');
  },
  async function reprogram_excludes_current_event() {
    const engine = new ChatbotEngine({ sb: null, calendar: new FakeCalendar({
      '2026-04-29': [fakeEvent({ id:'same', createdDateTime:'2026-04-24T09:00:00Z', start:'2026-04-29T10:00:00-05:00', end:'2026-04-29T10:45:00-05:00', zone:'LIMA CENTRO' })]
    })});
    const hours = await engine.availableHoursForDate('2026-04-29', { clientZone: 'LIMA CENTRO', excludeEventId: 'same' });
    assert(hours.some(h => h.time === '10:00:00'), 'al reprogramar debe ignorar su propio evento actual');
  },
  async function real_calendar_access() {
    const calendar = await realCalendar.getDefaultCalendar();
    assert(Boolean(calendar.id), 'calendar real debe responder');
    return { id: calendar.id, name: calendar.name };
  },
  async function real_create_and_cleanup() {
    const event = await realCalendar.createEvent({
      subject: 'Test Agenda Rules',
      startDateTime: '2026-04-28T10:00:00',
      endDateTime: '2026-04-28T10:45:00',
      timeZone: 'America/Lima',
      body: 'Prueba automática de reglas de agenda.',
      location: 'Prueba EVINKA',
      categories: ['EVINKA']
    });
    assert(Boolean(event.id), 'debe crear evento real');
    await realCalendar.cancelEvent(event.id, 'Limpieza de test automático.');
    return { eventId: event.id };
  },
  async function real_list_window_offset() {
    const events = await realCalendar.listEvents({ startDateTime: '2026-04-24T00:00:00-05:00', endDateTime: '2026-04-25T00:00:00-05:00', top: 20 });
    assert(Array.isArray(events), 'debe listar ventana real');
    return { count: events.length };
  },
];

let ok = 0;
for (const test of tests) {
  const pass = await runCase(test.name, test);
  if (pass) ok += 1;
}
console.log(`SUMMARY ${ok}/${tests.length} OK`);
process.exit(ok === tests.length ? 0 : 1);
