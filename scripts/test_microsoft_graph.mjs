import { loadEnv } from '../src/config.mjs';
import { MicrosoftGraphClient } from '../src/microsoftGraph.mjs';

loadEnv();

const graph = new MicrosoftGraphClient();

const calendar = await graph.getDefaultCalendar();
console.log('CALENDAR', JSON.stringify({ id: calendar.id, name: calendar.name, owner: calendar.owner?.address || calendar.owner?.emailAddress?.address || null }, null, 2));

const events = await graph.listEvents({ top: 5 });
console.log('EVENTS', JSON.stringify(events.map(e => ({ id: e.id, subject: e.subject, start: e.start, end: e.end })), null, 2));
