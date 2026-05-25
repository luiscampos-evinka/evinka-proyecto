import { createHash } from 'node:crypto';
import { MicrosoftGraphClient } from './microsoftGraph.mjs';

const DEFAULT_BOOKING_BUSINESS_ID = process.env.BOOKINGS_BUSINESS_ID || 'VisitaTecnicaCotizarInstalacion@evinka.tech';
const DEFAULT_BOOKING_TIMEZONE = process.env.BOOKINGS_TIMEZONE || 'SA Pacific Standard Time';
const DEFAULT_LOCAL_TIMEZONE = process.env.BOOKINGS_LOCAL_TIMEZONE || 'America/Bogota';
const DEFAULT_ALLOWED_STAFF_IDS = [
  'd6d1f1c1-aeaa-43ab-8619-fac082f9beaa',
  'cd2460f9-0eae-4d42-954f-3f445bc963d6',
  'cfd37644-7133-40c0-8c8c-8ff47ece13a4',
];
const DEFAULT_CUSTOM_QUESTION_LABELS = {
  documento: ['documento', 'tipo de documento', 'document type'],
  barrio: ['barrio'],
  direccion: ['direccion', 'dirección'],
  numero_documento: ['numero de documento', 'número de documento', 'document number'],
  marca_vehiculo: ['marca del vehiculo', 'marca del vehículo', 'vehicle brand'],
  ya_tiene_vehiculo: ['ya cuenta con vehiculo', 'ya cuenta con vehículo', 'cuenta con vehiculo', 'cuenta con vehículo'],
  ya_tiene_cargador: ['ya cuenta con cargador', 'cuenta con cargador'],
};
const AVAILABLE_STATUSES = new Set(['available', 'slotsavailable']);
const ACTIVE_APPOINTMENT_STATUSES = new Set(['booked', 'confirmed', 'pending', 'accepted']);
const EXCLUDED_SERVICE_NAME_HINTS = ['otras ciudades', 'espacio-tiempo libre-desplazamiento', 'espacio tiempo libre desplazamiento'];
const ZONE_NAME_HINTS = {
  'ÁREA 1 — SUBA–USAQUÉN': ['area 1', 'suba', 'usaquen'],
  'ÁREA 2 — CHAPINERO–BARRIOS UNIDOS–TEUSAQUILLO': ['area 2', 'chapinero', 'barrios unidos', 'teusaquillo'],
  'ÁREA 3 — ENGATIVÁ–FONTIBÓN': ['area 3', 'engativa', 'fontibon'],
  'ÁREA 4 — KENNEDY–PUENTE ARANDA–BOSA': ['area 4', 'kennedy', 'puente aranda', 'bosa', 'soacha', 'sibate'],
  'ÁREA 5 — LA CANDELARIA–SANTA FE–LOS MÁRTIRES–ANTONIO NARIÑO–RAFAEL URIBE URIBE': ['area 5', 'candelaria', 'santa fe', 'martires', 'antonio nariño', 'antonio narino', 'rafael uribe'],
  'ÁREA 6 — MOSQUERA–FUNZA–TENJO–COTA': ['area 6', 'mosquera', 'funza', 'tenjo', 'cota'],
  'ÁREA 7 — CHÍA–CAJICÁ–SOPÓ': ['area 7', 'chia', 'cajica', 'sopo'],
  'ÁREA 8 — LA CALERA–USME–SAN CRISTÓBAL–TUNJUELITO–CIUDAD BOLÍVAR': ['area 8', 'la calera', 'usme', 'san cristobal', 'tunjuelito', 'ciudad bolivar'],
};

function normalizeText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseJsonEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function parseListEnv(name, fallback = []) {
  const raw = process.env[name];
  if (!raw) return fallback;
  if (raw.trim().startsWith('[')) {
    const parsed = parseJsonEnv(name, fallback);
    return Array.isArray(parsed) ? parsed.map((item) => String(item || '').trim()).filter(Boolean) : fallback;
  }
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

function parseDurationMinutes(value, fallback = 60) {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const hours = Number(raw.match(/(\d+)H/i)?.[1] || 0);
  const minutes = Number(raw.match(/(\d+)M/i)?.[1] || 0);
  const seconds = Number(raw.match(/(\d+)S/i)?.[1] || 0);
  const total = (hours * 60) + minutes + Math.ceil(seconds / 60);
  return total || fallback;
}

function parseDurationDays(value, fallback = 90) {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const days = Number(raw.match(/P(\d+)D/i)?.[1] || 0);
  if (days) return days;
  const weeks = Number(raw.match(/P(\d+)W/i)?.[1] || 0);
  if (weeks) return weeks * 7;
  const months = Number(raw.match(/P(\d+)M/i)?.[1] || 0);
  if (months) return months * 30;
  const years = Number(raw.match(/P(\d+)Y/i)?.[1] || 0);
  if (years) return years * 365;
  return fallback;
}

function parseLeadDays(value, fallback = 1) {
  return Math.max(0, parseDurationDays(value, fallback));
}

function currentDateInTimeZone(timeZone = DEFAULT_LOCAL_TIMEZONE) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function addDays(date, amount) {
  const [year, month, day] = String(date || '').split('-').map(Number);
  const value = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  value.setUTCDate(value.getUTCDate() + Number(amount || 0));
  return value.toISOString().slice(0, 10);
}

function minDate(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

function maxDate(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

function asDateTimeTimeZone(date, time = '00:00:00', timeZone = DEFAULT_BOOKING_TIMEZONE) {
  return { dateTime: `${date}T${time}`, timeZone };
}

function digitsOnly(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function normalizeWhatsappPhone(value = '') {
  const digits = digitsOnly(value);
  if (!digits) return '';
  if (digits.startsWith('57') && digits.length === 12) return digits;
  if (digits.length === 10) return `57${digits}`;
  return digits;
}

function sha256(value = '') {
  return createHash('sha256').update(String(value || '')).digest('hex');
}

function friendlyDateLabel(date, timeZone = DEFAULT_LOCAL_TIMEZONE) {
  const base = new Date(`${date}T12:00:00-05:00`);
  return new Intl.DateTimeFormat('es-CO', {
    timeZone,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(base).replace(',', '');
}

function friendlyHourLabel(startTime, endTime, timeZone = DEFAULT_LOCAL_TIMEZONE) {
  const start = new Date(`2026-01-01T${startTime}-05:00`);
  const end = new Date(`2026-01-01T${endTime}-05:00`);
  const fmt = new Intl.DateTimeFormat('es-CO', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${fmt.format(start)} a ${fmt.format(end)}`;
}

function normalizeStatus(value = '') {
  return normalizeText(String(value || '').replace(/\s+/g, ''));
}

function cleanGraphPhone(value = '') {
  return normalizeWhatsappPhone(value) || digitsOnly(value);
}

function classifyGraphError({ status = 500, data = null, method = 'GET', path = '' } = {}) {
  const message = typeof data?.error?.message === 'string'
    ? data.error.message
    : typeof data?.message === 'string'
      ? data.message
      : '';
  const code = String(data?.error?.code || '').trim();
  const normalized = normalizeText(`${code} ${message}`);
  let reason = 'graph_error';
  if (status === 401 || status === 403) reason = 'auth_error';
  else if (status === 404) reason = 'not_found';
  else if (status === 409) reason = 'slot_unavailable';
  else if (status === 429) reason = 'rate_limited';
  else if (normalized.includes('slot') && normalized.includes('available')) reason = 'slot_unavailable';
  else if (normalized.includes('conflict')) reason = 'slot_unavailable';
  const error = new Error(`Bookings Graph ${method} ${path} -> ${status}${message ? ` ${message}` : ''}`);
  error.status = status;
  error.reason = reason;
  error.graphCode = code || null;
  error.graphMessage = message || null;
  error.graphData = data;
  return error;
}

function matchAnyHint(text, hints = []) {
  const normalized = normalizeText(text);
  return hints.some((hint) => normalized.includes(normalizeText(hint)));
}

function normalizeAppointmentsList(data) {
  if (Array.isArray(data?.value)) return data.value;
  if (Array.isArray(data)) return data;
  return [];
}

export class BookingsClient {
  constructor({
    graph = new MicrosoftGraphClient({ defaultTimeZone: DEFAULT_LOCAL_TIMEZONE }),
    businessId = DEFAULT_BOOKING_BUSINESS_ID,
    businessTimeZone = DEFAULT_BOOKING_TIMEZONE,
    localTimeZone = DEFAULT_LOCAL_TIMEZONE,
    allowedStaffIds = parseListEnv('BOOKINGS_ALLOWED_STAFF_IDS', DEFAULT_ALLOWED_STAFF_IDS),
    zoneServiceMap = parseJsonEnv('BOOKINGS_ZONE_SERVICE_MAP_JSON', {}),
    customQuestionIds = parseJsonEnv('BOOKINGS_CUSTOM_QUESTION_IDS_JSON', {}),
  } = {}) {
    this.graph = graph;
    this.businessId = businessId;
    this.businessTimeZone = businessTimeZone;
    this.localTimeZone = localTimeZone;
    this.allowedStaffIds = Array.isArray(allowedStaffIds) ? allowedStaffIds.filter(Boolean) : DEFAULT_ALLOWED_STAFF_IDS;
    this.zoneServiceMap = zoneServiceMap && typeof zoneServiceMap === 'object' ? zoneServiceMap : {};
    this.customQuestionIds = customQuestionIds && typeof customQuestionIds === 'object' ? customQuestionIds : {};
    this.cache = new Map();
  }

  isEnabled() {
    return Boolean(this.graph && this.businessId);
  }

  businessPath(suffix = '') {
    return `/solutions/bookingBusinesses/${encodeURIComponent(this.businessId)}${suffix}`;
  }

  async graphRequest(path, { method = 'GET', headers = {}, body } = {}) {
    const accessToken = await this.graph.getAccessToken();
    const res = await fetch(`${this.graph.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: `outlook.timezone="${this.localTimeZone}"`,
        ...headers,
      },
      body: body == null ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) throw classifyGraphError({ status: res.status, data, method, path });
    return data;
  }

  async getToken() {
    return this.graph.getAccessToken();
  }

  async getBusinessMetadata(force = false) {
    const key = 'business-metadata';
    const cached = this.cache.get(key);
    if (!force && cached && cached.expiresAt > Date.now()) return cached.value;
    const [business, services, staff, customQuestions] = await Promise.all([
      this.graphRequest(this.businessPath()),
      this.graphRequest(this.businessPath('/services')).catch(() => ({ value: [] })),
      this.graphRequest(this.businessPath('/staffMembers')).catch(() => ({ value: [] })),
      this.graphRequest(this.businessPath('/customQuestions')).catch(() => ({ value: [] })),
    ]);
    const value = {
      business,
      services: Array.isArray(services?.value) ? services.value : [],
      staff: Array.isArray(staff?.value) ? staff.value : [],
      customQuestions: Array.isArray(customQuestions?.value) ? customQuestions.value : [],
    };
    this.cache.set(key, { value, expiresAt: Date.now() + 5 * 60_000 });
    return value;
  }

  async resolveService(zone, explicitServiceId = null) {
    const { services } = await this.getBusinessMetadata();
    if (explicitServiceId) {
      const found = services.find((item) => item.id === explicitServiceId);
      if (found) return found;
    }
    const configuredId = this.zoneServiceMap?.[zone] || null;
    if (configuredId) {
      const found = services.find((item) => item.id === configuredId);
      if (found) return found;
    }
    const hints = ZONE_NAME_HINTS[zone] || [zone];
    const candidates = services.filter((service) => !EXCLUDED_SERVICE_NAME_HINTS.some((hint) => normalizeText(service.displayName || '').includes(normalizeText(hint))));
    const byExact = candidates.find((service) => normalizeText(service.displayName || '') === normalizeText(zone));
    if (byExact) return byExact;
    const byHint = candidates.find((service) => matchAnyHint(service.displayName || '', hints));
    if (byHint) return byHint;
    const fallback = candidates.find((service) => matchAnyHint(zone, [service.displayName || '']));
    if (fallback) return fallback;
    throw new Error(`No pude resolver el servicio de Bookings para la zona ${zone}.`);
  }

  pickAllowedStaffIds(service = null) {
    const serviceStaffIds = Array.isArray(service?.staffMemberIds) ? service.staffMemberIds.filter(Boolean) : [];
    const allowed = serviceStaffIds.length
      ? serviceStaffIds.filter((id) => this.allowedStaffIds.includes(id))
      : [...this.allowedStaffIds];
    return allowed.length ? allowed : [...this.allowedStaffIds];
  }

  async resolveCustomQuestionIds() {
    const { customQuestions } = await this.getBusinessMetadata();
    if (!customQuestions.length) return this.customQuestionIds;
    const resolved = { ...this.customQuestionIds };
    for (const [key, labels] of Object.entries(DEFAULT_CUSTOM_QUESTION_LABELS)) {
      if (resolved[key]) continue;
      const question = customQuestions.find((item) => matchAnyHint(item.displayName || item.question || '', labels));
      if (question?.id) resolved[key] = question.id;
    }
    return resolved;
  }

  async getAvailability({ zone, serviceId = null, startDate = null, endDate = null, limit = 40 } = {}) {
    const service = await this.resolveService(zone, serviceId);
    const schedulingPolicy = service?.schedulingPolicy || {};
    const slotMinutes = parseDurationMinutes(service?.defaultDuration || schedulingPolicy.timeSlotInterval || 'PT60M', 60);
    const intervalMinutes = parseDurationMinutes(schedulingPolicy.timeSlotInterval || service?.defaultDuration || 'PT60M', slotMinutes);
    const minimumLeadDays = parseLeadDays(schedulingPolicy.minimumLeadTime || 'P1D', 1);
    const maximumAdvanceDays = parseDurationDays(schedulingPolicy.maximumAdvance || (normalizeText(zone).includes('mosquera') ? 'P365D' : 'P90D'), normalizeText(zone).includes('mosquera') ? 365 : 90);
    const today = currentDateInTimeZone(this.localTimeZone);
    const firstAllowedDate = addDays(today, Math.max(1, minimumLeadDays));
    const start = maxDate(startDate || firstAllowedDate, firstAllowedDate);
    const end = minDate(endDate || addDays(start, maximumAdvanceDays), addDays(today, maximumAdvanceDays));
    const staffIds = this.pickAllowedStaffIds(service);
    const payload = {
      staffIds,
      startDateTime: asDateTimeTimeZone(start, '00:00:00', this.businessTimeZone),
      endDateTime: asDateTimeTimeZone(end, '23:59:59', this.businessTimeZone),
      availabilityViewInterval: intervalMinutes,
    };
    const data = await this.graphRequest(this.businessPath('/getStaffAvailability'), { method: 'POST', body: payload });
    const slotMap = new Map();
    for (const staffItem of Array.isArray(data?.value) ? data.value : []) {
      const staffId = staffItem?.staffId || null;
      for (const item of Array.isArray(staffItem?.availabilityItems) ? staffItem.availabilityItems : []) {
        const status = normalizeStatus(item?.status);
        if (!AVAILABLE_STATUSES.has(status)) continue;
        const startValue = String(item?.startDateTime?.dateTime || item?.startDateTime || '');
        const endValue = String(item?.endDateTime?.dateTime || item?.endDateTime || '');
        if (!startValue || !endValue) continue;
        const date = startValue.slice(0, 10);
        const time = startValue.slice(11, 19) || '00:00:00';
        const endTime = endValue.slice(11, 19) || time;
        if (date < firstAllowedDate) continue;
        const key = `${date}|${time}|${endTime}`;
        const current = slotMap.get(key) || {
          date,
          time,
          endTime,
          serviceId: service.id,
          serviceName: service.displayName || null,
          staffIds: [],
        };
        if (staffId && !current.staffIds.includes(staffId)) current.staffIds.push(staffId);
        slotMap.set(key, current);
      }
    }
    const slots = [...slotMap.values()]
      .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
      .slice(0, limit)
      .map((slot, index) => ({
        code: String.fromCharCode(65 + index),
        date: slot.date,
        weekday: friendlyDateLabel(slot.date, this.localTimeZone).split(' ')[0],
        dateLabel: friendlyDateLabel(slot.date, this.localTimeZone),
        hourLabel: friendlyHourLabel(slot.time, slot.endTime, this.localTimeZone),
        time: slot.time,
        endTime: slot.endTime,
        serviceId: slot.serviceId,
        serviceName: slot.serviceName,
        staffIds: slot.staffIds,
        defaultStaffId: slot.staffIds[0] || staffIds[0] || null,
        slotMinutes,
      }));
    return {
      zone,
      service,
      slots,
      rules: {
        minimumLeadDays,
        maximumAdvanceDays,
        slotMinutes,
        intervalMinutes,
      },
    };
  }

  async createAppointment({
    zone,
    slot,
    customer,
    answers = {},
    whatsappPhone = '',
    serviceId = null,
    serviceName = null,
    notes = '',
  } = {}) {
    const service = await this.resolveService(zone, serviceId || slot?.serviceId || null);
    const questionIds = await this.resolveCustomQuestionIds();
    const staffIds = (Array.isArray(slot?.staffIds) && slot.staffIds.length ? slot.staffIds : this.pickAllowedStaffIds(service)).slice(0, 1);
    const normalizedWhatsappPhone = normalizeWhatsappPhone(whatsappPhone || customer?.phone || '');
    const normalizedCustomerPhone = normalizeWhatsappPhone(customer?.phone || normalizedWhatsappPhone);
    const customQuestionAnswers = Object.entries(answers || {})
      .filter(([, answer]) => answer != null && String(answer).trim() !== '')
      .map(([key, answer]) => {
        const questionId = questionIds[key] || null;
        if (!questionId) return null;
        return { questionId, answer: String(answer) };
      })
      .filter(Boolean);
    const idempotencyKey = sha256(`${normalizedWhatsappPhone}|${service.id}|${slot.date}|${slot.time}|${slot.endTime}`);
    const payload = {
      serviceId: service.id,
      duration: service.defaultDuration || 'PT1H',
      priceType: 'notSet',
      preBuffer: service?.preBuffer || service?.schedulingPolicy?.preBuffer || 'PT0S',
      postBuffer: service?.postBuffer || service?.schedulingPolicy?.postBuffer || 'PT0S',
      startDateTime: asDateTimeTimeZone(slot.date, slot.time, this.businessTimeZone),
      endDateTime: asDateTimeTimeZone(slot.date, slot.endTime, this.businessTimeZone),
      staffMemberIds: staffIds,
      smsNotificationsEnabled: false,
      optOutOfCustomerEmail: false,
      serviceName: serviceName || service.displayName || undefined,
      notes: compactNote(`${notes || ''}\nwhatsapp_phone:${normalizedWhatsappPhone}\nidempotency_key:${idempotencyKey}`),
      customers: [{
        name: customer?.name || 'Cliente EVINKA',
        phone: normalizedCustomerPhone,
        emailAddress: customer?.email || '',
        timeZone: this.businessTimeZone,
        customQuestionAnswers,
      }],
    };
    const appointment = await this.graphRequest(this.businessPath('/appointments'), { method: 'POST', body: payload });
    return {
      appointment,
      idempotencyKey,
      whatsappPhone: normalizedWhatsappPhone,
      customerPhone: normalizedCustomerPhone,
      staffId: staffIds[0] || null,
      service,
      payload,
    };
  }

  async updateAppointment({ appointmentId, startDate, startTime, endTime } = {}) {
    if (!appointmentId) throw new Error('Falta appointmentId para actualizar la cita en Bookings.');
    const payload = {
      startDateTime: asDateTimeTimeZone(startDate, startTime, this.businessTimeZone),
      endDateTime: asDateTimeTimeZone(startDate, endTime, this.businessTimeZone),
    };
    const appointment = await this.graphRequest(this.businessPath(`/appointments/${encodeURIComponent(appointmentId)}`), { method: 'PATCH', body: payload });
    return { appointment, payload };
  }

  async cancelAppointment({ appointmentId, reason = 'Cancelada por cliente desde WhatsApp.' } = {}) {
    if (!appointmentId) throw new Error('Falta appointmentId para cancelar la cita en Bookings.');
    const result = await this.graphRequest(this.businessPath(`/appointments/${encodeURIComponent(appointmentId)}/cancel`), {
      method: 'POST',
      body: { cancellationMessage: reason },
    });
    return { ok: true, result };
  }

  async getAppointment({ appointmentId = null, whatsappPhone = '', statuses = [] } = {}) {
    if (appointmentId) {
      const appointment = await this.graphRequest(this.businessPath(`/appointments/${encodeURIComponent(appointmentId)}`));
      return { appointment, matchedBy: 'appointmentId' };
    }
    const normalizedPhone = normalizeWhatsappPhone(whatsappPhone);
    if (!normalizedPhone) return { appointment: null, matchedBy: null };
    const wantedStatuses = (Array.isArray(statuses) && statuses.length ? statuses : [...ACTIVE_APPOINTMENT_STATUSES]).map((item) => normalizeText(item));
    let nextPath = `${this.businessPath('/appointments')}?$top=100`;
    const matches = [];
    while (nextPath) {
      const data = await this.graphRequest(nextPath.replace(this.graph.baseUrl, ''));
      const items = normalizeAppointmentsList(data);
      for (const item of items) {
        const appointmentStatus = normalizeText(item?.bookingStatus || item?.status || '');
        if (wantedStatuses.length && appointmentStatus && !wantedStatuses.includes(appointmentStatus)) continue;
        const customerPhones = Array.isArray(item?.customers)
          ? item.customers.map((customer) => cleanGraphPhone(customer?.phone || '')).filter(Boolean)
          : [];
        const notes = `${item?.notes || ''} ${item?.additionalInformation || ''}`;
        if (customerPhones.includes(normalizedPhone) || normalizeText(notes).includes(normalizeText(`whatsapp_phone:${normalizedPhone}`))) {
          matches.push(item);
        }
      }
      nextPath = data?.['@odata.nextLink'] || null;
      if (matches.length) break;
    }
    matches.sort((a, b) => String(b?.startDateTime?.dateTime || '').localeCompare(String(a?.startDateTime?.dateTime || '')));
    return { appointment: matches[0] || null, matchedBy: matches[0] ? 'whatsappPhone' : null };
  }
}

function compactNote(value = '') {
  return String(value || '').trim().replace(/\n{3,}/g, '\n\n').slice(0, 1500);
}

export { normalizeWhatsappPhone, friendlyDateLabel, friendlyHourLabel };
