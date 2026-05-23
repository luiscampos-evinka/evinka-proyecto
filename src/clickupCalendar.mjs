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

function toIsoLocal(date, timeZone = 'America/Lima') {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

function resolvePreferredPendingStatus(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return 'pendiente visita técnica';
  if (raw.toLowerCase() === 'open') return 'pendiente visita técnica';
  return raw;
}

function normalizeStatusKey(value = '') {
  return String(value || '').trim().toLowerCase();
}

function customFieldValue(task = {}, fieldName = '') {
  const normalizedName = String(fieldName || '').trim().toLowerCase();
  if (!normalizedName) return '';
  const field = (task.custom_fields || []).find((item) => String(item?.name || '').trim().toLowerCase() === normalizedName);
  const value = field?.value;
  return value == null ? '' : String(value).trim();
}

function extractDistrictFromAddress(address = '') {
  const value = String(address || '').replace(/\s+/g, ' ').trim();
  if (!value) return '';
  const numberMatch = value.match(/\d+[A-Za-z-]*\s+(.*)$/);
  const tail = String(numberMatch?.[1] || '').trim();
  if (!tail) return '';
  const tokens = tail.split(/\s+/).filter(Boolean);
  while (tokens.length > 1 && ['lima', 'callao', 'peru', 'perú', 'colombia', 'bogota', 'bogotá', 'medellin', 'medellín', 'cali'].includes(tokens[tokens.length - 1].toLowerCase())) {
    tokens.pop();
  }
  if (!tokens.length) return '';
  if (tokens.length >= 2) return tokens.slice(-2).join(' ');
  return tokens[0];
}

function extractDistrictFromText(text = '') {
  const match = String(text || '').match(/(?:distrito|localidad)\s*:\s*([^\n\r]+)/i);
  if (match) return String(match[1] || '').trim();
  const addressMatch = String(text || '').match(/direcci[oó]n\s*:\s*([^\n\r]+)/i);
  return extractDistrictFromAddress(addressMatch?.[1] || '');
}

export class ClickUpCalendarClient {
  constructor({
    apiToken = requiredEnv('CLICKUP_API_TOKEN'),
    listId = requiredEnv('CLICKUP_B2C_LIST_ID'),
    pendingStatus = process.env.CLICKUP_B2C_STATUS || 'Open',
    closedStatus = process.env.CLICKUP_CANCELLED_STATUS || 'Closed',
    defaultTimeZone = process.env.MICROSOFT_TIMEZONE || 'America/Lima',
    defaultAssigneeId = Number(process.env.CLICKUP_B2C_DEFAULT_ASSIGNEE_ID || 0),
    defaultDurationMinutes = Number(process.env.CLICKUP_DEFAULT_DURATION_MINUTES || 45),
    baseUrl = clickupBaseUrl(),
  } = {}) {
    this.apiToken = apiToken;
    this.listId = String(listId || '').trim();
    this.pendingStatus = resolvePreferredPendingStatus(pendingStatus);
    this.pendingStatusKeys = [...new Set([
      normalizeStatusKey(this.pendingStatus),
      'pendiente a visita',
      'pendiente visita técnica',
      'open',
      'en ejecución',
      'en ejecucion',
    ].filter(Boolean))];
    this.closedStatus = String(closedStatus || 'Closed').trim();
    this.defaultTimeZone = defaultTimeZone;
    this.defaultAssigneeId = Number.isFinite(defaultAssigneeId) ? defaultAssigneeId : 0;
    this.defaultDurationMinutes = Number.isFinite(defaultDurationMinutes) && defaultDurationMinutes > 0
      ? defaultDurationMinutes
      : 45;
    this.baseUrl = baseUrl;
    this.provider = 'clickup';
    this.tasksCache = null;
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

  async getFieldMap() {
    if (this.fieldMap) return this.fieldMap;
    const data = await this.request(`/list/${encodeURIComponent(this.listId)}/field`);
    const map = {};
    for (const field of data?.fields || []) {
      const name = String(field?.name || '').trim().toLowerCase();
      if (!name) continue;
      map[name] = field;
    }
    this.fieldMap = map;
    return map;
  }

  invalidateTasksCache() {
    this.tasksCache = null;
  }

  async getAllTasks() {
    const now = Date.now();
    if (this.tasksCache && this.tasksCache.expiresAt > now) {
      if (this.tasksCache.promise) return this.tasksCache.promise;
      return this.tasksCache.tasks;
    }

    const promise = (async () => {
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
      this.tasksCache = { expiresAt: Date.now() + 30000, tasks };
      return tasks;
    })();

    this.tasksCache = { expiresAt: now + 30000, promise };
    try {
      return await promise;
    } catch (error) {
      this.tasksCache = null;
      throw error;
    }
  }

  async setCustomFieldByName(taskId, fieldName, value) {
    const cleaned = String(value || '').trim();
    if (!taskId || !fieldName || !cleaned) return { ok: true, skipped: true };
    const fieldMap = await this.getFieldMap();
    const field = fieldMap[String(fieldName || '').trim().toLowerCase()];
    if (!field?.id) return { ok: true, skipped: true };
    return this.request(`/task/${encodeURIComponent(taskId)}/field/${encodeURIComponent(field.id)}`, {
      method: 'POST',
      body: { value: cleaned },
    });
  }

  async syncDistrictField(taskId, text = '') {
    const district = extractDistrictFromText(text);
    if (!district) return { ok: true, skipped: true };
    return this.setCustomFieldByName(taskId, 'DISTRITO', district);
  }

  normalizeTaskAsEvent(task = {}) {
    const start = task.start_date ? new Date(Number(task.start_date)) : null;
    const end = task.due_date
      ? new Date(Number(task.due_date))
      : (start && !Number.isNaN(start.getTime())
          ? new Date(start.getTime() + this.defaultDurationMinutes * 60 * 1000)
          : null);
    const district = customFieldValue(task, 'DISTRITO')
      || extractDistrictFromText(task.description || task.text_content || '');
    const content = [
      task.description || task.text_content || '',
      district ? `Distrito: ${district}` : '',
    ].filter(Boolean).join('\n').trim();
    return {
      id: String(task.id || '').trim(),
      subject: task.name || '',
      isCancelled: false,
      bodyPreview: content,
      body: { content },
      start: start ? { dateTime: toIsoLocal(start, this.defaultTimeZone), timeZone: this.defaultTimeZone } : null,
      end: end ? { dateTime: toIsoLocal(end, this.defaultTimeZone), timeZone: this.defaultTimeZone } : null,
      location: { displayName: '' },
      attendees: [],
      categories: ['EVINKA'],
      raw: task,
    };
  }

  async listEvents({ top = 100, startDateTime = null, endDateTime = null } = {}) {
    const rangeStart = parseDateTime(startDateTime, this.defaultTimeZone);
    const rangeEnd = parseDateTime(endDateTime, this.defaultTimeZone);
    const tasks = await this.getAllTasks();

    return tasks
      .filter((task) => this.pendingStatusKeys.includes(normalizeStatusKey(task?.status?.status || '')))
      .filter((task) => {
        const start = task.start_date ? new Date(Number(task.start_date)) : null;
        const end = task.due_date
          ? new Date(Number(task.due_date))
          : (start && !Number.isNaN(start.getTime())
              ? new Date(start.getTime() + this.defaultDurationMinutes * 60 * 1000)
              : null);
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
    const tasks = await this.getAllTasks();
    return tasks.find((task) => {
      const haystack = [
        String(task?.name || ''),
        String(task?.description || ''),
        String(task?.text_content || ''),
      ].join('\n').toLowerCase();
      return haystack.includes(needle);
    }) || null;
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
      status: this.pendingStatus,
      start_date: start ? String(start.getTime()) : undefined,
      start_date_time: Boolean(start),
      due_date: due ? String(due.getTime()) : undefined,
      due_date_time: Boolean(due),
      priority: 3,
    };
  }

  async createEvent({ subject, startDateTime, endDateTime, timeZone = this.defaultTimeZone, body = '' }) {
    const payload = this.buildBasePayload({ subject, startDateTime, endDateTime, timeZone, body });
    payload.status = this.pendingStatus;
    if (this.defaultAssigneeId > 0) payload.assignees = [this.defaultAssigneeId];
    const task = await this.request(`/list/${encodeURIComponent(this.listId)}/task`, {
      method: 'POST',
      body: payload,
    });
    this.invalidateTasksCache();
    await this.syncDistrictField(task?.id, body);
    return task;
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
    if (!Object.keys(payload).length && patch.body?.content == null) return { ok: true, skipped: true };
    const task = Object.keys(payload).length ? await this.request(`/task/${encodeURIComponent(eventId)}`, {
      method: 'PUT',
      body: payload,
    }) : { ok: true, skipped: true, id: eventId };
    if (patch.body?.content != null) {
      await this.syncDistrictField(eventId, patch.body.content);
    }
    if (Object.keys(payload).length) this.invalidateTasksCache();
    return task;
  }

  async cancelEvent(eventId, comment = 'Cancelada desde EVINKABOT.') {
    await this.request(`/task/${encodeURIComponent(eventId)}`, {
      method: 'PUT',
      body: {
        status: this.closedStatus,
        description: String(comment || '').trim() || 'Cancelada desde EVINKABOT.',
      },
    });
    this.invalidateTasksCache();
    return { ok: true };
  }

  async deleteEvent(eventId) {
    await this.request(`/task/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
    });
    return { ok: true };
  }
}
