import { requiredEnv } from './config.mjs';

function clickupBaseUrl() {
  return (process.env.CLICKUP_API_BASE_URL || 'https://api.clickup.com/api/v2').replace(/\/$/, '');
}

function parseDateTime(dateTime, timeZone = 'America/Lima') {
  if (!dateTime) return null;
  const raw = String(dateTime).trim();
  if (!raw) return null;
  if (/Z|[+-]\d{2}:?\d{2}$/.test(raw)) return new Date(raw);
  if (timeZone === 'America/Lima') return new Date(`${raw}-05:00`);
  return new Date(raw);
}

function toIsoLocal(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return date.toISOString().replace(/\.\d{3}Z$/, '');
}

export class ClickUpCalendarClient {
  constructor({
    apiToken = requiredEnv('CLICKUP_API_TOKEN'),
    listId = requiredEnv('CLICKUP_B2C_LIST_ID'),
    pendingStatus = process.env.CLICKUP_B2C_STATUS || 'Open',
    closedStatus = process.env.CLICKUP_CANCELLED_STATUS || 'Closed',
    defaultTimeZone = process.env.MICROSOFT_TIMEZONE || 'America/Lima',
    defaultAssigneeId = Number(process.env.CLICKUP_B2C_DEFAULT_ASSIGNEE_ID || 0),
    defaultDurationMinutes = Number(process.env.CLICKUP_DEFAULT_DURATION_MINUTES || 60),
    baseUrl = clickupBaseUrl(),
  } = {}) {
    this.apiToken = apiToken;
    this.listId = String(listId || '').trim();
    this.pendingStatus = String(pendingStatus || 'Open').trim().toLowerCase();
    this.closedStatus = String(closedStatus || 'Closed').trim();
    this.defaultTimeZone = defaultTimeZone;
    this.defaultAssigneeId = Number.isFinite(defaultAssigneeId) ? defaultAssigneeId : 0;
    this.defaultDurationMinutes = Number.isFinite(defaultDurationMinutes) && defaultDurationMinutes > 0
      ? defaultDurationMinutes
      : 60;
    this.baseUrl = baseUrl;
    this.provider = 'clickup';
  }

  async request(path, { method = 'GET', body } = {}) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: this.apiToken,
        'Content-Type': 'application/json',
      },
      body: body == null ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      throw new Error(`ClickUp ${method} ${path} -> ${res.status} ${res.statusText}\n${JSON.stringify(data, null, 2)}`);
    }
    return data;
  }

  normalizeTaskAsEvent(task = {}) {
    const start = task.start_date ? new Date(Number(task.start_date)) : null;
    const end = task.due_date ? new Date(Number(task.due_date)) : null;
    return {
      id: String(task.id || '').trim(),
      subject: task.name || '',
      isCancelled: false,
      bodyPreview: task.description || task.text_content || '',
      body: { content: task.description || task.text_content || '' },
      start: start ? { dateTime: toIsoLocal(start), timeZone: this.defaultTimeZone } : null,
      end: end ? { dateTime: toIsoLocal(end), timeZone: this.defaultTimeZone } : null,
      location: { displayName: '' },
      attendees: [],
      categories: ['EVINKA'],
      raw: task,
    };
  }

  async listEvents({ top = 100, startDateTime = null, endDateTime = null } = {}) {
    const rangeStart = parseDateTime(startDateTime, this.defaultTimeZone);
    const rangeEnd = parseDateTime(endDateTime, this.defaultTimeZone);
    const tasks = [];
    let page = 0;
    while (true) {
      const data = await this.request(`/list/${encodeURIComponent(this.listId)}/task?archived=false&page=${page}`);
      const pageTasks = Array.isArray(data?.tasks) ? data.tasks : [];
      tasks.push(...pageTasks);
      if (data?.last_page) break;
      page += 1;
      if (page > 50) break;
    }

    return tasks
      .filter((task) => String(task?.status?.status || '').trim().toLowerCase() === this.pendingStatus)
      .filter((task) => {
        const start = task.start_date ? new Date(Number(task.start_date)) : null;
        const end = task.due_date ? new Date(Number(task.due_date)) : start;
        if (!start || Number.isNaN(start.getTime())) return false;
        if (rangeStart && end && end <= rangeStart) return false;
        if (rangeEnd && start >= rangeEnd) return false;
        return true;
      })
      .slice(0, top)
      .map((task) => this.normalizeTaskAsEvent(task));
  }

  async findTaskByTicket(ticket = '') {
    const needle = String(ticket || '').trim().toLowerCase();
    if (!needle) return null;
    let page = 0;
    while (true) {
      const data = await this.request(`/list/${encodeURIComponent(this.listId)}/task?archived=false&page=${page}`);
      const pageTasks = Array.isArray(data?.tasks) ? data.tasks : [];
      const match = pageTasks.find((task) => {
        const haystack = [
          String(task?.name || ''),
          String(task?.description || ''),
          String(task?.text_content || ''),
        ].join('\n').toLowerCase();
        return haystack.includes(needle);
      });
      if (match) return match;
      if (data?.last_page) break;
      page += 1;
      if (page > 50) break;
    }
    return null;
  }

  buildBasePayload({ subject, startDateTime, endDateTime, timeZone = this.defaultTimeZone, body = '' }) {
    const start = parseDateTime(startDateTime, timeZone);
    const end = parseDateTime(endDateTime, timeZone);
    const due = end && !Number.isNaN(end.getTime())
      ? end
      : (start && !Number.isNaN(start.getTime())
          ? new Date(start.getTime() + this.defaultDurationMinutes * 60 * 1000)
          : null);
    return {
      name: String(subject || 'Visita EVINKA').trim() || 'Visita EVINKA',
      description: String(body || '').trim(),
      status: process.env.CLICKUP_B2C_STATUS || 'Open',
      start_date: start ? String(start.getTime()) : undefined,
      start_date_time: Boolean(start),
      due_date: due ? String(due.getTime()) : undefined,
      due_date_time: Boolean(due),
      priority: 3,
    };
  }

  async createEvent({ subject, startDateTime, endDateTime, timeZone = this.defaultTimeZone, body = '' }) {
    const payload = this.buildBasePayload({ subject, startDateTime, endDateTime, timeZone, body });
    payload.status = process.env.CLICKUP_B2C_STATUS || 'Open';
    if (this.defaultAssigneeId > 0) payload.assignees = [this.defaultAssigneeId];
    return this.request(`/list/${encodeURIComponent(this.listId)}/task`, {
      method: 'POST',
      body: payload,
    });
  }

  async updateEvent(eventId, patch = {}) {
    const payload = {};
    if (patch.subject) payload.name = String(patch.subject || '').trim();
    if (patch.body?.content != null) payload.description = String(patch.body.content || '').trim();
    if (patch.start?.dateTime) {
      const start = parseDateTime(patch.start.dateTime, patch.start.timeZone || this.defaultTimeZone);
      if (start && !Number.isNaN(start.getTime())) {
        payload.start_date = String(start.getTime());
        payload.start_date_time = true;
      }
    }
    if (patch.end?.dateTime) {
      const end = parseDateTime(patch.end.dateTime, patch.end.timeZone || this.defaultTimeZone);
      if (end && !Number.isNaN(end.getTime())) {
        payload.due_date = String(end.getTime());
        payload.due_date_time = true;
      }
    }
    if (!Object.keys(payload).length) return { ok: true, skipped: true };
    return this.request(`/task/${encodeURIComponent(eventId)}`, {
      method: 'PUT',
      body: payload,
    });
  }

  async cancelEvent(eventId, comment = 'Cancelada desde EVINKABOT.') {
    await this.request(`/task/${encodeURIComponent(eventId)}`, {
      method: 'PUT',
      body: {
        status: this.closedStatus,
        description: String(comment || '').trim() || 'Cancelada desde EVINKABOT.',
      },
    });
    return { ok: true };
  }
}
