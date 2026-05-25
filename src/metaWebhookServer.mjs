import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { loadEnv, requiredEnv } from './config.mjs';
import { SupabaseRest } from './supabase.mjs';
import { ChatbotEngine, resolveProfileZone, inferCountryFromZone } from './chatbotEngine.mjs';
import { WhatsAppMetaClient } from './whatsappMeta.mjs';
import { extractReceiptDataFromBuffer } from './receiptOcr.mjs';
import { MicrosoftGraphClient } from './microsoftGraph.mjs';
import { BookingsClient } from './bookingsClient.mjs';
import { ClickUpCalendarClient } from './clickupCalendar.mjs';
import { getAdvisorConversationState, patchAdvisorConversation } from './advisorInboxState.mjs';
import { saveConversationMedia } from './advisorMediaStore.mjs';
import { SupabaseStorage } from './supabaseStorage.mjs';
import {
  advisorQueueLabel as advisorQueueLabelRule,
  resolveAdvisorAlertRecipients as resolveAdvisorAlertRecipientsRule,
  resolveAdvisorQueue as resolveAdvisorQueueRule,
} from './advisorAlertRouting.mjs';

loadEnv();

const PORT = Number(process.env.PORT || 8787);
const WEBHOOK_PATH = process.env.WHATSAPP_WEBHOOK_PATH || '/meta-webhook';
const VERIFY_TOKEN = requiredEnv('WHATSAPP_VERIFY_TOKEN');

const sb = new SupabaseRest({
  url: requiredEnv('SUPABASE_URL'),
  key: requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
});

const AGENDA_TIME_ZONE = 'America/Lima';
const META_DELIVERY_LOG_PATH = path.join(process.cwd(), 'data/meta-delivery-status-log.json');

function appendMetaDeliveryStatuses(items = []) {
  if (!Array.isArray(items) || !items.length) return;
  try {
    fs.mkdirSync(path.dirname(META_DELIVERY_LOG_PATH), { recursive: true });
    const current = fs.existsSync(META_DELIVERY_LOG_PATH)
      ? JSON.parse(fs.readFileSync(META_DELIVERY_LOG_PATH, 'utf8') || '[]')
      : [];
    const next = [
      ...current,
      ...items.map((item) => ({ ...item, loggedAt: new Date().toISOString() })),
    ].slice(-500);
    fs.writeFileSync(META_DELIVERY_LOG_PATH, JSON.stringify(next, null, 2));
  } catch (error) {
    console.error('appendMetaDeliveryStatuses failed:', error);
  }
}

function agendaDate(value) {
  if (!value) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: AGENDA_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(value));
    const pick = (type) => parts.find((item) => item.type === type)?.value || '';
    return `${pick('year')}-${pick('month')}-${pick('day')}`;
  } catch {
    return '';
  }
}

function agendaTime(value) {
  if (!value) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: AGENDA_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(value));
    const pick = (type) => parts.find((item) => item.type === type)?.value || '';
    return `${pick('hour')}:${pick('minute')}`;
  } catch {
    return '';
  }
}

function normalizeAgendaClock(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{2}:\d{2})(?::\d{2})?$/);
  return match ? match[1] : raw;
}

function extractTicketFromCalendarBody(body = '') {
  const text = String(body || '');
  const match = text.match(/(?:Código|Codigo|Referencia)\s*:\s*([^\n\r]+)/i);
  return String(match?.[1] || '').trim();
}

function inferCalendarCountryHint(value = '') {
  const text = String(value || '').toUpperCase();
  if (!text) return null;
  if (text.includes('COLOMBIA') || text.includes('ÁREA ') || text.includes('MEDELLÍN') || text.includes('CALI') || text.includes('BOGOTÁ') || text.includes('BOGOTA')) return 'CO';
  if (text.includes('PERÚ') || text.includes('PERU') || text.includes('LIMA') || text.includes('CAÑETE') || text.includes('CANETE') || text.includes('CALLAO')) return 'PE';
  return null;
}

function resolveCalendarCountry(payload = {}) {
  return inferCalendarCountryHint(payload?.countryCode)
    || inferCalendarCountryHint(payload?.clientZone)
    || inferCalendarCountryHint(payload?.body?.content)
    || inferCalendarCountryHint(payload?.body)
    || inferCalendarCountryHint(payload?.location?.displayName)
    || inferCalendarCountryHint(payload?.location)
    || null;
}

class HybridCalendarClient {
  constructor({ clickup = null, microsoft = null } = {}) {
    this.clickup = clickup;
    this.microsoft = microsoft;
    this.provider = 'hybrid';
  }

  async listEvents(options = {}) {
    const country = resolveCalendarCountry(options);
    if (country === 'PE' && this.clickup) return this.clickup.listEvents(options);
    if (country === 'CO' && this.microsoft) return this.microsoft.listEvents(options);
    if (this.clickup) return this.clickup.listEvents(options);
    if (this.microsoft) return this.microsoft.listEvents(options);
    return [];
  }

  async createEvent(payload = {}) {
    const country = resolveCalendarCountry(payload);
    if (country === 'PE' && this.clickup) {
      const clickupResult = await this.clickup.createEvent(payload);
      return {
        ...(clickupResult || {}),
        id: clickupResult?.id || null,
        clickupTaskId: clickupResult?.id || null,
      };
    }
    if (country === 'CO' && this.microsoft) {
      const microsoftEvent = await this.microsoft.createEvent(payload);
      return {
        ...(microsoftEvent || {}),
        id: microsoftEvent?.id || null,
        clickupTaskId: null,
      };
    }

    let microsoftEvent = null;
    let clickupResult = null;
    if (this.microsoft) microsoftEvent = await this.microsoft.createEvent(payload);
    if (this.clickup) {
      try {
        clickupResult = await this.clickup.createEvent(payload);
      } catch (error) {
        console.error('HybridCalendarClient clickup.createEvent failed:', error);
      }
    }
    return {
      ...(microsoftEvent || clickupResult || {}),
      id: microsoftEvent?.id || clickupResult?.id || null,
      clickupTaskId: clickupResult?.id || null,
    };
  }

  async updateEvent(eventId, patch = {}) {
    const country = resolveCalendarCountry(patch);
    let ticket = extractTicketFromCalendarBody(patch?.body?.content || '');

    if (country === 'PE' && this.clickup && eventId) {
      await this.clickup.updateEvent(eventId, patch);
      return { ok: true, ticket };
    }
    if (country === 'CO' && this.microsoft && eventId) {
      await this.microsoft.updateEvent(eventId, patch);
      return { ok: true, ticket };
    }

    if (this.microsoft && eventId) {
      try {
        const current = await this.microsoft.getEvent(eventId);
        ticket = ticket || extractTicketFromCalendarBody(current?.body?.content || '');
        await this.microsoft.updateEvent(eventId, patch);
        if (this.clickup && ticket) {
          const task = await this.clickup.findTaskByTicket(ticket);
          if (task?.id) await this.clickup.updateEvent(task.id, patch);
        }
        return { ok: true, ticket };
      } catch (error) {
        console.error('HybridCalendarClient microsoft.getEvent failed before update:', error);
      }
    }

    if (this.clickup && eventId) {
      await this.clickup.updateEvent(eventId, patch);
      return { ok: true, ticket };
    }
    return { ok: true, ticket };
  }

  async cancelEvent(eventId, comment = 'Cancelada desde EVINKABOT.') {
    const patch = typeof comment === 'object' && comment !== null ? comment : { comment };
    const country = resolveCalendarCountry(patch);
    const note = String(patch.comment || 'Cancelada desde EVINKABOT.').trim() || 'Cancelada desde EVINKABOT.';
    let ticket = extractTicketFromCalendarBody(patch?.body?.content || '');

    if (country === 'PE' && this.clickup && eventId) {
      await this.clickup.cancelEvent(eventId, note);
      return { ok: true, ticket };
    }
    if (country === 'CO' && this.microsoft && eventId) {
      await this.microsoft.cancelEvent(eventId, note);
      return { ok: true, ticket };
    }

    if (this.microsoft && eventId) {
      try {
        const current = await this.microsoft.getEvent(eventId);
        ticket = ticket || extractTicketFromCalendarBody(current?.body?.content || '');
        await this.microsoft.cancelEvent(eventId, note);
        if (this.clickup && ticket) {
          const task = await this.clickup.findTaskByTicket(ticket);
          if (task?.id) await this.clickup.cancelEvent(task.id, note);
        }
        return { ok: true, ticket };
      } catch (error) {
        console.error('HybridCalendarClient microsoft.getEvent failed before cancel:', error);
      }
    }
    if (this.clickup && eventId) {
      await this.clickup.cancelEvent(eventId, note);
    }
    return { ok: true, ticket };
  }

  async deleteEvent(eventId, info = {}) {
    const payload = typeof info === 'object' && info !== null ? info : {};
    const country = resolveCalendarCountry(payload);
    let ticket = String(payload.ticket || '').trim();

    if (country === 'PE' && this.clickup && eventId) {
      await this.clickup.deleteEvent(eventId);
      return { ok: true, ticket };
    }
    if (country === 'CO' && this.microsoft && eventId) {
      await this.microsoft.deleteEvent(eventId);
      return { ok: true, ticket };
    }

    if (this.microsoft && eventId) {
      try {
        const current = await this.microsoft.getEvent(eventId);
        ticket = ticket || extractTicketFromCalendarBody(current?.body?.content || '');
        await this.microsoft.deleteEvent(eventId);
        if (this.clickup && ticket) {
          const task = await this.clickup.findTaskByTicket(ticket);
          if (task?.id) await this.clickup.deleteEvent(task.id);
        }
        return { ok: true, ticket };
      } catch (error) {
        console.error('HybridCalendarClient microsoft.getEvent failed before delete:', error);
      }
    }

    if (this.clickup && eventId) {
      await this.clickup.deleteEvent(eventId);
    }
    return { ok: true, ticket };
  }
}

const calendarProvider = String(process.env.CHATBOT_CALENDAR_PROVIDER || '').trim().toLowerCase();
const clickupCalendar = process.env.CLICKUP_API_TOKEN && process.env.CLICKUP_B2C_LIST_ID
  ? new ClickUpCalendarClient()
  : null;
const microsoftCalendar = process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
  ? new MicrosoftGraphClient()
  : null;
const calendar = ['hybrid', 'dual', 'clickup+microsoft', 'clickup+ms'].includes(calendarProvider)
  ? new HybridCalendarClient({ clickup: clickupCalendar, microsoft: microsoftCalendar })
  : calendarProvider === 'clickup'
    ? clickupCalendar
    : microsoftCalendar;
const bookings = microsoftCalendar && (process.env.BOOKINGS_ENABLED || 'true') !== 'false'
  ? new BookingsClient({ graph: microsoftCalendar })
  : null;
const storage = new SupabaseStorage({
  url: requiredEnv('SUPABASE_URL'),
  key: requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
});

const reminderTimers = new Map();
const handoffTimers = new Map();
const handoffAdvisorReminderTimers = new Map();
const STATUS_PREFS_PATH = path.resolve(process.cwd(), 'data/status-notification-prefs.json');
const STATUS_OVERVIEW_DATA_PATH = process.env.STATUS_OVERVIEW_DATA_PATH || '/var/www/status.evinka.net/data/overview-data.json';
const WHATSAPP_ROLE_MAP_PATH = path.resolve(process.cwd(), 'data/whatsapp-role-map.json');
const USERS_PATH = path.resolve(process.cwd(), 'apps/cotizador-web/data/users.json');
const ADVISOR_INBOX_URL = process.env.ADVISOR_INBOX_URL || 'https://asesor.evinka.net/';
const CLIENT_FILES_BUCKET = process.env.CLIENT_FILES_BUCKET || 'evinka-client-files';
const BOT_EXCLUDED_PHONES = new Set(
  String(process.env.BOT_EXCLUDED_PHONES || '+51 939 882 508')
    .split(',')
    .map((item) => String(item || '').replace(/\D+/g, ''))
    .filter(Boolean),
);
const HANDOFF_TIMEOUT_MINUTES = Number(process.env.HANDOFF_TIMEOUT_MINUTES || 30);
const HANDOFF_TIMEOUT_MS = Math.max(1, (Number.isFinite(HANDOFF_TIMEOUT_MINUTES) ? HANDOFF_TIMEOUT_MINUTES : 30) * 60 * 1000);
const HANDOFF_ADVISOR_REMINDER_MINUTES = Number(process.env.HANDOFF_ADVISOR_REMINDER_MINUTES || 60);
const HANDOFF_ADVISOR_REMINDER_MS = Math.max(1, (Number.isFinite(HANDOFF_ADVISOR_REMINDER_MINUTES) ? HANDOFF_ADVISOR_REMINDER_MINUTES : 60) * 60 * 1000);

function buildAdvisorCaseUrl(conversationId = '', countryCode = null) {
  const url = new URL(ADVISOR_INBOX_URL);
  if (conversationId) url.searchParams.set('conversation', String(conversationId || '').trim());
  if (countryCode) url.searchParams.set('country', String(countryCode || '').trim().toUpperCase());
  return url.toString();
}

function safeStorageFileName(value = 'archivo') {
  const clean = String(value || 'archivo')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return clean || 'archivo';
}

function normalizeStoragePhone(value = '') {
  const digits = String(value || '').replace(/\D+/g, '');
  return digits || 'desconocido';
}

function isBotExcludedPhone(value = '') {
  const digits = String(value || '').replace(/\D+/g, '');
  return digits ? BOT_EXCLUDED_PHONES.has(digits) : false;
}

function extensionFromMimeType(mimeType = '') {
  const lower = String(mimeType || '').toLowerCase();
  return {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'audio/ogg': '.ogg',
    'audio/mpeg': '.mp3',
    'video/mp4': '.mp4',
  }[lower] || '';
}

function classifyClientFileFolder({ fileName = '', mimeType = '', caption = '' } = {}) {
  const source = `${fileName} ${caption}`.toLowerCase();
  if (String(mimeType || '').startsWith('image/')) return 'fotos';
  if (/comprobante|voucher|pago|deposito|depósito|transferencia/.test(source)) return 'comprobantes';
  if (/cotizacion|cotización|quote|propuesta/.test(source)) return 'cotizaciones';
  return 'documentos';
}

function buildClientStoragePath({ phone = '', fileName = 'archivo', mimeType = '', caption = '', createdAt = new Date() } = {}) {
  const folder = classifyClientFileFolder({ fileName, mimeType, caption });
  const safePhone = normalizeStoragePhone(phone);
  const ext = path.extname(fileName || '') || extensionFromMimeType(mimeType);
  const base = safeStorageFileName(path.basename(fileName || 'archivo', path.extname(fileName || '')) || 'archivo');
  const stamp = new Date(createdAt).toISOString().replace(/[:.]/g, '-');
  return `clientes/${safePhone}/${folder}/${stamp}-${base}${ext}`;
}

function buildStoredMediaUrl(bucket = '', objectPath = '') {
  const encodedPath = String(objectPath || '')
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `/api/inbox/storage-media/${encodeURIComponent(String(bucket || '').trim())}/${encodedPath}`;
}

function isMissingClientFilesTable(error) {
  const message = String(error?.message || error || '');
  return message.includes("public.client_files")
    || message.includes("table 'public.client_files'")
    || message.includes('relation "public.client_files" does not exist')
    || message.includes('PGRST205');
}

async function insertClientFileRecord(record = {}) {
  try {
    return await sb.insert('client_files', record);
  } catch (error) {
    if (isMissingClientFilesTable(error)) {
      console.warn('client_files table missing, skipping insert');
      return null;
    }
    throw error;
  }
}

function isMissingClientArtifactsTable(error) {
  const message = String(error?.message || error || '');
  return message.includes('public.client_artifacts')
    || message.includes("table 'public.client_artifacts'")
    || message.includes('relation "public.client_artifacts" does not exist')
    || message.includes('PGRST205');
}

async function insertClientArtifactRecord(record = {}) {
  try {
    return await sb.insert('client_artifacts', record);
  } catch (error) {
    if (isMissingClientArtifactsTable(error)) {
      console.warn('client_artifacts table missing, skipping insert');
      return null;
    }
    throw error;
  }
}

async function persistInboundClientArtifact({ message, conversation = null, user = null, customerPhone = '', customerName = '', countryCode = null }) {
  const type = String(message?.type || '').trim().toLowerCase();
  if (!['contacts', 'location'].includes(type)) return null;
  const raw = message?.raw || {};
  let title = null;
  let summary = null;
  let payload = null;

  if (type === 'contacts') {
    const contacts = Array.isArray(raw.contacts) ? raw.contacts : [];
    const first = contacts[0] || {};
    const name = String(first?.name?.formatted_name || [first?.name?.first_name, first?.name?.last_name].filter(Boolean).join(' ') || '').trim();
    const phone = String(first?.phones?.[0]?.phone || first?.phones?.[0]?.wa_id || '').trim();
    title = name || 'Contacto compartido';
    summary = ['Contacto compartido', name, phone].filter(Boolean).join(' · ');
    payload = { contacts };
  }

  if (type === 'location') {
    const location = raw.location || {};
    const name = String(location.name || '').trim();
    const address = String(location.address || '').trim();
    title = name || 'Ubicación compartida';
    summary = ['Ubicación compartida', name, address].filter(Boolean).join(' · ');
    payload = { location };
  }

  const normalizedPhone = normalizeStoragePhone(customerPhone || message?.from || user?.telefono_principal || '');
  await insertClientArtifactRecord({
    client_id: user?.id_usuario || null,
    client_name: customerName || null,
    phone: normalizedPhone,
    ticket_id: conversation?.codigo_ticket_solicitado || null,
    message_id: message?.id || null,
    conversation_id: conversation?.id_conversacion || null,
    country_code: String(countryCode || '').trim().toUpperCase() || null,
    artifact_type: type,
    title,
    summary,
    payload,
    source_platform: 'whatsapp',
  }).catch((error) => {
    console.error('client_artifacts insert failed:', error);
  });

  return { artifactType: type, artifactTitle: title, artifactSummary: summary };
}

function isMissingSupportTicketsTable(error) {
  const message = String(error?.message || error || '');
  return message.includes('public.support_tickets')
    || message.includes("table 'public.support_tickets'")
    || message.includes('relation "public.support_tickets" does not exist')
    || message.includes('PGRST205');
}

async function upsertSupportTicket({ conversation = null, user = null, phone = '', patch = {} } = {}) {
  const normalizedPhone = normalizeStoragePhone(phone || user?.telefono_principal || '');
  const conversationId = conversation?.id_conversacion || null;
  if (!normalizedPhone && !conversationId) return null;
  try {
    const clauses = [];
    if (conversationId) clauses.push(`conversation_id.eq.${conversationId}`);
    if (normalizedPhone) clauses.push(`phone.eq.${normalizedPhone}`);
    const query = clauses.length > 1
      ? `or=(${clauses.join(',')})&select=*` : `${clauses[0]}&select=*`;
    const rows = await sb.select('support_tickets', query);
    const existing = Array.isArray(rows) ? rows[0] : null;
    const payload = {
      conversation_id: conversationId,
      client_id: user?.id_usuario || existing?.client_id || null,
      phone: normalizedPhone || existing?.phone || '',
      ...patch,
    };
    if (existing?.id) {
      const updated = await sb.update('support_tickets', `id=eq.${existing.id}`, payload);
      return updated?.[0] || existing;
    }
    const inserted = await sb.insert('support_tickets', payload);
    return inserted?.[0] || null;
  } catch (error) {
    if (isMissingSupportTicketsTable(error)) {
      console.warn('support_tickets table missing, skipping upsert');
      return null;
    }
    throw error;
  }
}

async function persistInboundClientMedia({ message, conversation = null, user = null, profile = null, customerPhone = '', customerName = '', downloaded = null, countryCode = null }) {
  if (!message?.media?.id || !downloaded?.buffer?.length) return null;
  const fileName = safeStorageFileName(message.media.fileName || `archivo${extensionFromMimeType(downloaded.mimeType || message.media.mimeType)}`);
  const mimeType = downloaded.mimeType || message.media.mimeType || 'application/octet-stream';
  const objectPath = buildClientStoragePath({
    phone: customerPhone,
    fileName,
    mimeType,
    caption: message.text || message.media.caption || '',
    createdAt: new Date(),
  });

  let payload = null;
  try {
    await storage.uploadObject(CLIENT_FILES_BUCKET, objectPath, downloaded.buffer, { contentType: mimeType, upsert: true });
    payload = {
      mediaUrl: buildStoredMediaUrl(CLIENT_FILES_BUCKET, objectPath),
      storageBucket: CLIENT_FILES_BUCKET,
      storagePath: objectPath,
      mimeType,
      fileName,
      fileSize: downloaded.fileSize || downloaded.buffer.length,
      whatsappMediaId: message.media.id,
      sourcePlatform: 'whatsapp',
    };
  } catch (error) {
    console.error('supabase media upload failed:', error);
    const local = saveConversationMedia({
      conversationId: conversation?.id_conversacion || 'orphan',
      direction: 'inbound',
      fileName,
      mimeType,
      buffer: downloaded.buffer,
    });
    payload = {
      mediaUrl: local.urlPath,
      localMediaPath: local.relativePath,
      mimeType,
      fileName,
      fileSize: downloaded.fileSize || downloaded.buffer.length,
      whatsappMediaId: message.media.id,
      sourcePlatform: 'whatsapp',
    };
  }

  await insertClientFileRecord({
    client_id: user?.id_usuario || null,
    client_name: customerName || profile?.nombre_receptor || profile?.nombre_cliente || null,
    phone: normalizeStoragePhone(customerPhone),
    ticket_id: conversation?.codigo_ticket_solicitado || null,
    message_id: message.id || null,
    file_name: fileName,
    file_type: classifyClientFileFolder({ fileName, mimeType, caption: message.text || '' }),
    mime_type: mimeType,
    file_size: downloaded.fileSize || downloaded.buffer.length,
    storage_bucket: payload.storageBucket || null,
    storage_path: payload.storagePath || null,
    public_url: null,
    signed_url: null,
    source_platform: 'whatsapp',
    conversation_id: conversation?.id_conversacion || null,
    country_code: String(countryCode || '').trim().toUpperCase() || null,
  }).catch((error) => {
    console.error('client_files insert failed:', error);
  });

  return payload;
}

function ensureStatusPrefsFile() {
  fs.mkdirSync(path.dirname(STATUS_PREFS_PATH), { recursive: true });
  if (!fs.existsSync(STATUS_PREFS_PATH)) {
    fs.writeFileSync(STATUS_PREFS_PATH, JSON.stringify({ users: {} }, null, 2));
  }
}

function loadStatusPrefs() {
  ensureStatusPrefsFile();
  return JSON.parse(fs.readFileSync(STATUS_PREFS_PATH, 'utf8') || '{"users":{}}');
}

function saveStatusPrefs(data) {
  ensureStatusPrefsFile();
  fs.writeFileSync(STATUS_PREFS_PATH, JSON.stringify(data, null, 2));
}

function loadWhatsAppRoleMap() {
  try {
    if (!fs.existsSync(WHATSAPP_ROLE_MAP_PATH)) return { technicians: [] };
    const parsed = JSON.parse(fs.readFileSync(WHATSAPP_ROLE_MAP_PATH, 'utf8') || '{}');
    const technicians = Array.isArray(parsed.technicians) ? parsed.technicians : [];
    return {
      technicians: technicians.map((value) => String(value || '').replace(/[^+\d]/g, '')).filter(Boolean),
    };
  } catch (error) {
    console.error('loadWhatsAppRoleMap failed:', error);
    return { technicians: [] };
  }
}

function findOperationalUserByPhone(phone = '') {
  const normalized = String(phone || '').replace(/[^+\d]/g, '');
  if (!normalized) return null;
  return loadOperationalUsers().find((user) => String(user.notificationPhone || '').replace(/[^+\d]/g, '') === normalized) || null;
}

function readJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.error(`readJsonFile failed (${filePath}):`, error);
    return fallback;
  }
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function normalizeNotificationPhone(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const cleaned = raw.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  const digits = cleaned.replace(/^\+/, '').replace(/\D/g, '');
  if (/^9\d{8}$/.test(digits)) return `51${digits}`;
  if (/^3\d{9}$/.test(digits)) return `57${digits}`;
  if (/^(51\d{9}|57\d{10})$/.test(digits)) return digits;
  if (/^\d{8,15}$/.test(digits)) return digits;
  return '';
}

function normalizeCountryList(value) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => String(item || '').trim().toUpperCase()).filter(Boolean))]
    : [];
}

function normalizeQueueList(value) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean))]
    : [];
}

function normalizeLooseText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function loadOperationalUsers() {
  const users = readJsonFile(USERS_PATH, []);
  return Array.isArray(users)
    ? users.map((user) => ({
        ...user,
        email: normalizeEmail(user.email || ''),
        role: String(user.role || '').trim().toLowerCase(),
        status: String(user.status || 'active').trim().toLowerCase(),
        notificationPhone: normalizeNotificationPhone(user.notificationPhone || user.phone || ''),
        allowedCountries: normalizeCountryList(user.allowedCountries),
        allowedQueues: normalizeQueueList(user.allowedQueues),
      }))
    : [];
}

function isAdvisorAlertRole(user = {}) {
  const role = String(user.role || '').trim().toLowerCase();
  return role === 'admin'
    || role === 'supervisor'
    || role.startsWith('asesor')
    || role.startsWith('kam');
}

function advisorNameSignals() {
  const users = loadOperationalUsers().filter((user) => user.status === 'active' && isAdvisorAlertRole(user));
  const names = new Set();
  for (const user of users) {
    const full = normalizeLooseText(user.name || '');
    if (!full) continue;
    names.add(full);
    const parts = full.split(' ').filter(Boolean);
    if (parts[0] && parts[0].length >= 4) names.add(parts[0]);
  }
  return names;
}

function detectPreviousAdvisorSignal(text = '') {
  const normalized = normalizeLooseText(text);
  if (!normalized) return false;
  const greetings = ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches'];
  for (const name of advisorNameSignals()) {
    if (normalized === name) return true;
    for (const greeting of greetings) {
      if (normalized === `${greeting} ${name}`) return true;
      if (normalized.startsWith(`${greeting} ${name} `)) return true;
    }
  }
  return false;
}

function userAllowsCountry(user = {}, countryCode = null) {
  const allowed = normalizeCountryList(user.allowedCountries);
  if (!countryCode || !allowed.length || allowed.includes('ALL')) return true;
  return allowed.includes(String(countryCode || '').trim().toUpperCase());
}

function userAllowsQueue(user = {}, queueKey = '') {
  const normalizedQueue = String(queueKey || '').trim().toLowerCase();
  if (!normalizedQueue) return true;
  const allowed = normalizeQueueList(user.allowedQueues);
  return allowed.includes(normalizedQueue);
}

function advisorQueueLabel(queueKey = '') {
  switch (String(queueKey || '').trim().toLowerCase()) {
    case 'b2b': return 'B2B / Corporativo';
    case 'agenda': return 'Agenda';
    case 'postventa': return 'Postventa';
    case 'pagos': return 'Pagos';
    default: return 'Comercial';
  }
}

function isCorporateConversation(conversation = {}) {
  const haystack = normalizeLooseText([
    conversation?.motivo_handoff,
    conversation?.subestado_flujo,
    conversation?.paso_actual,
    conversation?.resumen,
    conversation?.intencion_principal,
  ].filter(Boolean).join(' '));
  if (!haystack) return false;
  return haystack.includes('corporativo')
    || haystack.includes('empresa')
    || haystack.includes('b2b')
    || haystack.includes('asesor_corporativo')
    || haystack.includes('contacto corporativo');
}

function resolveAdvisorQueue({ conversation } = {}) {
  const haystack = normalizeLooseText([
    conversation?.motivo_handoff,
    conversation?.subestado_flujo,
    conversation?.paso_actual,
    conversation?.resumen,
    conversation?.intencion_principal,
  ].filter(Boolean).join(' '));
  if (!haystack) return 'comercial';

  if (isCorporateConversation(conversation)) return 'b2b';

  const hasKeyword = (keywords = []) => keywords.some((keyword) => haystack.includes(keyword));
  if (hasKeyword(['boleta', 'boletas', 'pago', 'pagos', 'abono', 'deposito', 'factura', 'facturacion', 'caja', 'comprobante'])) return 'pagos';
  if (hasKeyword(['agenda', 'agendar', 'agendamiento', 'reprogram', 'calendario', 'cita', 'horario'])) return 'agenda';
  if (hasKeyword(['postventa', 'garantia', 'garantias', 'soporte tecnico', 'falla', 'mantenimiento', 'incidencia'])) return 'postventa';
  return 'comercial';
}

function isPreferredB2BAdvisor(user = {}, countryCode = null) {
  const normalizedCountry = String(countryCode || '').trim().toUpperCase() || 'PE';
  const email = normalizeEmail(user.email || '');
  const code = String(user.employeeCode || '').trim().toUpperCase();
  const name = normalizeLooseText(user.name || '');
  if (normalizedCountry === 'PE') {
    return email === 'antonio.milla@evinka.tech' || code === 'ANTONIO' || name === 'antonio';
  }
  return false;
}

function prioritizeAdvisorRecipients(recipients = [], { queueKey = '', countryCode = null } = {}) {
  const normalizedQueue = String(queueKey || '').trim().toLowerCase();
  const list = [...recipients];
  if (normalizedQueue === 'b2b') {
    list.sort((a, b) => {
      const aPreferred = isPreferredB2BAdvisor(a, countryCode) ? 1 : 0;
      const bPreferred = isPreferredB2BAdvisor(b, countryCode) ? 1 : 0;
      if (aPreferred !== bPreferred) return bPreferred - aPreferred;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  }
  return list;
}

function resolveAdvisorAlertRecipients({ countryCode = null, queueKey = '' } = {}) {
  const normalizedQueue = String(queueKey || '').trim().toLowerCase();
  const baseRecipients = loadOperationalUsers().filter((user) => (
    user.status === 'active'
    && isAdvisorAlertRole(user)
    && userAllowsCountry(user, countryCode)
    && user.notificationPhone
  ));
  if (!normalizedQueue) return baseRecipients;
  let queueRecipients = baseRecipients.filter((user) => userAllowsQueue(user, normalizedQueue));
  if (!queueRecipients.length && normalizedQueue === 'b2b') {
    queueRecipients = baseRecipients.filter((user) => userAllowsQueue(user, 'comercial'));
  }
  return prioritizeAdvisorRecipients(queueRecipients.length ? queueRecipients : baseRecipients, { queueKey: normalizedQueue, countryCode });
}

function advisorChannelForCountry(countryCode = null) {
  if (String(countryCode || '').trim().toUpperCase() === 'CO') {
    return whatsappChannels.find((channel) => channel.key === 'co') || defaultWhatsAppChannel;
  }
  return defaultWhatsAppChannel;
}

function advisorLeadContext(summary = '') {
  try {
    const parsed = JSON.parse(String(summary || '{}'));
    if (parsed?.kind === 'advisor_lead') return String(parsed.comentario || '').trim();
  } catch {}
  return '';
}

function buildAdvisorAlertText({ conversation, profile = null, customerPhone = '', customerName = '', countryCode = null, queueKey = 'comercial' }) {
  const countryLabel = String(countryCode || '').trim().toUpperCase() === 'CO' ? 'Colombia' : 'Perú';
  const clientName = String(
    customerName
    || profile?.nombre_receptor
    || profile?.nombre_cliente
    || profile?.nombre_visible
    || 'Cliente'
  ).trim();
  const reason = String(conversation?.motivo_handoff || 'Solicitud de asesor').trim();
  const requestContext = advisorLeadContext(conversation?.resumen);
  const inboxUrl = buildAdvisorCaseUrl(conversation?.id_conversacion, countryCode);
  const priorityLine = String(queueKey || '').trim().toLowerCase() === 'b2b'
    ? 'Prioridad: Antonio (B2B)'
    : null;
  return [
    'Nuevo cliente solicitando asesor EVINKA ⚡',
    '',
    `País: ${countryLabel}`,
    `Cola: ${advisorQueueLabelRule(queueKey)}`,
    ...(priorityLine ? [priorityLine] : []),
    `Cliente: ${clientName}`,
    `Teléfono: ${customerPhone || '-'}`,
    ...(requestContext ? [`Contexto: ${requestContext}`] : []),
    `Motivo: ${reason}`,
    `Caso: ${conversation?.id_conversacion || '-'}`,
    '',
    'Ingresa y responde aquí:',
    inboxUrl,
  ].join('\n');
}

async function notifyAdvisorRecipients({ conversation, customerPhone, customerName = '', countryCode = null }) {
  const queueKey = resolveAdvisorQueueRule({ conversation });
  const recipients = resolveAdvisorAlertRecipientsRule(loadOperationalUsers(), { countryCode, queueKey });
  if (!recipients.length) return { ok: false, skipped: true, reason: 'no_recipients' };

  const profileRows = await sb.select('perfiles_cliente', `id_conversacion=eq.${conversation.id_conversacion}&select=*`);
  const profile = profileRows[0] || null;
  const text = buildAdvisorAlertText({
    conversation,
    profile,
    customerPhone,
    customerName,
    countryCode,
    queueKey,
  });
  const channel = advisorChannelForCountry(countryCode);
  const metaClient = resolveMetaClient(channel.phoneNumberId);

  const results = await Promise.allSettled(recipients.map(async (user) => {
    const delivered = { userId: user.id, name: user.name, whatsapp: null };
    if (user.notificationPhone) {
      try {
        await metaClient.sendText(user.notificationPhone, text);
        delivered.whatsapp = { ok: true, to: user.notificationPhone };
      } catch (error) {
        delivered.whatsapp = { ok: false, to: user.notificationPhone, error: error.message };
      }
    }
    return delivered;
  }));

  return {
    ok: true,
    recipients: results.map((item) => item.status === 'fulfilled' ? item.value : { ok: false, error: item.reason?.message || String(item.reason || 'unknown') }),
  };
}

function buildAdvisorReminderText({ conversation, profile = null, customerPhone = '', customerName = '', countryCode = null, queueKey = 'comercial', waitingMinutes = 60, reminderCount = 1 }) {
  const countryLabel = String(countryCode || '').trim().toUpperCase() === 'CO' ? 'Colombia' : 'Perú';
  const clientName = String(
    customerName
    || profile?.nombre_receptor
    || profile?.nombre_cliente
    || profile?.nombre_visible
    || 'Cliente'
  ).trim();
  const reason = String(conversation?.motivo_handoff || 'Solicitud de asesor').trim();
  const requestContext = advisorLeadContext(conversation?.resumen);
  const inboxUrl = buildAdvisorCaseUrl(conversation?.id_conversacion, countryCode);
  const priorityLine = String(queueKey || '').trim().toLowerCase() === 'b2b'
    ? 'Prioridad: Antonio (B2B)'
    : null;
  return [
    `Recordatorio EVINKA ${reminderCount > 1 ? `#${reminderCount}` : ''} ⏰`,
    '',
    `Cliente esperando asesor hace ${waitingMinutes} min.`,
    `País: ${countryLabel}`,
    `Cola: ${advisorQueueLabelRule(queueKey)}`,
    ...(priorityLine ? [priorityLine] : []),
    `Cliente: ${clientName}`,
    `Teléfono: ${customerPhone || '-'}`,
    ...(requestContext ? [`Contexto: ${requestContext}`] : []),
    `Motivo: ${reason}`,
    `Caso: ${conversation?.id_conversacion || '-'}`,
    '',
    'Responder desde el inbox:',
    inboxUrl,
  ].join('\n');
}

async function notifyAdvisorReminder({ conversation, customerPhone, customerName = '', countryCode = null, waitingMinutes = 60, reminderCount = 1 }) {
  const queueKey = resolveAdvisorQueueRule({ conversation });
  const recipients = resolveAdvisorAlertRecipientsRule(loadOperationalUsers(), { countryCode, queueKey });
  if (!recipients.length) return { ok: false, skipped: true, reason: 'no_recipients' };

  const profileRows = await sb.select('perfiles_cliente', `id_conversacion=eq.${conversation.id_conversacion}&select=*`);
  const profile = profileRows[0] || null;
  const text = buildAdvisorReminderText({
    conversation,
    profile,
    customerPhone,
    customerName,
    countryCode,
    queueKey,
    waitingMinutes,
    reminderCount,
  });
  const channel = advisorChannelForCountry(countryCode);
  const metaClient = resolveMetaClient(channel.phoneNumberId);

  const results = await Promise.allSettled(recipients.map(async (user) => {
    const delivered = { userId: user.id, name: user.name, whatsapp: null };
    try {
      await metaClient.sendText(user.notificationPhone, text);
      delivered.whatsapp = { ok: true, to: user.notificationPhone };
    } catch (error) {
      delivered.whatsapp = { ok: false, to: user.notificationPhone, error: error.message };
    }
    return delivered;
  }));

  return {
    ok: true,
    recipients: results.map((item) => item.status === 'fulfilled' ? item.value : { ok: false, error: item.reason?.message || String(item.reason || 'unknown') }),
  };
}

function detectSenderRole(phone = '') {
  const normalized = String(phone || '').replace(/[^+\d]/g, '');
  const digits = normalized.replace(/\D/g, '');
  if (digits === '573028564794') return 'cliente';
  const roleMap = loadWhatsAppRoleMap();
  if (roleMap.technicians.includes(normalized)) return 'tecnico';
  const operationalUser = findOperationalUserByPhone(phone);
  if (operationalUser && isAdvisorAlertRole(operationalUser)) return 'asesor';
  return 'cliente';
}

function roleSourceFor(role) {
  if (role === 'tecnico') return 'whatsapp_role_map';
  if (role === 'asesor') return 'advisor_inbox';
  return 'auto';
}

async function resolveInboundRole(phone, userScope = 'default') {
  const user = await engine.ensureUser(phone, userScope);
  const persistedRole = engine.normalizeUserRole(user?.rol_usuario);
  const mappedRole = detectSenderRole(phone);
  const forcedTestFlowPhone = String(phone || '').replace(/\D/g, '') === '573028564794';
  const inferredRole = forcedTestFlowPhone
    ? 'cliente'
    : (['tecnico', 'asesor'].includes(mappedRole)
      ? mappedRole
      : (persistedRole || mappedRole));
  if (inferredRole && persistedRole !== inferredRole) {
    const updated = await engine.syncUserRole(user.id_usuario, inferredRole, roleSourceFor(inferredRole));
    return { user: updated || user, role: inferredRole };
  }
  return { user, role: inferredRole || 'cliente' };
}

function updateStatusPrefs(phone, updater) {
  const data = loadStatusPrefs();
  data.users ||= {};
  const current = data.users[phone] || {};
  data.users[phone] = updater({ ...current }) || current;
  saveStatusPrefs(data);
  return data.users[phone];
}

function statusPrefsReply(action, phone) {
  const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  if (action === 'status_alerts_24h') {
    updateStatusPrefs(phone, (current) => ({
      ...current,
      muteAlertsUntil: until,
      updatedAt: new Date().toISOString(),
    }));
    return 'Listo. Las alertas críticas quedaron silenciadas por 24 horas. Los cambios de estado seguirán llegando.';
  }
  if (action === 'status_states_24h') {
    updateStatusPrefs(phone, (current) => ({
      ...current,
      muteStatusUntil: until,
      updatedAt: new Date().toISOString(),
    }));
    return 'Hecho. Los cambios de estado quedaron silenciados por 24 horas. Las alertas críticas seguirán llegando.';
  }
  if (action === 'status_resume_on') {
    updateStatusPrefs(phone, (current) => ({
      ...current,
      muteAlertsUntil: null,
      muteStatusUntil: null,
      updatedAt: new Date().toISOString(),
    }));
    return 'Perfecto. Reactivé todas las notificaciones de status.';
  }
  return null;
}

function formatStatusSnapshotTime(value) {
  if (!value) return 'Sin dato';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

const EXCLUDED_STATUS_PATTERN = /\b(?:test|prueba|demo|qa|sandbox|lab)\b/i;

function matchesExcludedStatusPattern(...values) {
  const haystack = values.filter((value) => value != null).map((value) => String(value)).join(' ').trim();
  return haystack ? EXCLUDED_STATUS_PATTERN.test(haystack) : false;
}

function isExcludedStatusStation(station = {}) {
  return matchesExcludedStatusPattern(
    station?.name,
    station?.merchantName,
    station?.merchantId,
    station?.plazaName,
    station?.address,
    station?.locationText,
    station?.summaryStatus,
  );
}

function sanitizeStatusSnapshot(data = {}) {
  const stations = Array.isArray(data?.stations) ? data.stations.filter((station) => !isExcludedStatusStation(station)) : [];
  const stationIds = new Set(stations.map((station) => String(station?.id || '')).filter(Boolean));
  const totals = {
    stations: stations.length,
    connectors: stations.reduce((sum, station) => sum + (Array.isArray(station?.connectors) ? station.connectors.length : 0), 0),
    available: stations.filter((station) => station?.tone === 'available').length,
    offline: stations.filter((station) => station?.tone === 'offline').length,
    charging: stations.filter((station) => station?.tone === 'charging').length,
    preparing: stations.filter((station) => station?.tone === 'preparing').length,
    faulted: stations.filter((station) => station?.tone === 'faulted').length,
  };
  const alerts = Array.isArray(data?.alerts)
    ? data.alerts.filter((alert) => {
      const stationId = String(alert?.stationId || '');
      if (stationId && !stationIds.has(stationId)) return false;
      return !matchesExcludedStatusPattern(alert?.title, alert?.detail, alert?.stationName);
    })
    : [];
  return { ...data, stations, alerts, totals };
}

function loadStatusOverviewSnapshot() {
  return sanitizeStatusSnapshot(readJsonFile(STATUS_OVERVIEW_DATA_PATH, {}));
}

function statusStationLine(station) {
  const place = station?.plazaName || station?.address || station?.locationText || 'Ubicación por confirmar';
  const heartbeat = station?.heartbeatLabel || formatStatusSnapshotTime(station?.lastHeartbeatTime);
  return `• ${station?.name || 'Estación'} — ${place} · ${heartbeat}`;
}

function buildTechnicianSummaryMessage(data = {}) {
  const totals = data?.totals || {};
  const stations = Array.isArray(data?.stations) ? data.stations : [];
  const offline = stations.filter((station) => station?.tone === 'offline');
  const faulted = stations.filter((station) => station?.tone === 'faulted');
  const available = stations.filter((station) => station?.tone === 'available');
  const highlight = offline.slice(0, 4).map((station) => station?.name).filter(Boolean);
  return [
    '📊 EVINKA RESUMEN',
    `Actualizado: ${formatStatusSnapshotTime(data?.generatedAt)}`,
    `Red: ${totals.stations || stations.length || 0} estaciones · ${totals.connectors || 0} conectores`,
    `Operativas: ${totals.available || available.length || 0}`,
    `Offline: ${totals.offline || offline.length || 0}`,
    `Falla activa: ${totals.faulted || faulted.length || 0}`,
    highlight.length ? `Offline clave: ${highlight.join(', ')}` : 'Offline clave: ninguna estación caída en este snapshot.',
  ].join('\n');
}

function buildTechnicianOfflineMessage(data = {}) {
  const stations = Array.isArray(data?.stations) ? data.stations : [];
  const offline = stations.filter((station) => station?.tone === 'offline');
  if (!offline.length) {
    return [
      '✅ EVINKA OFFLINE',
      `Actualizado: ${formatStatusSnapshotTime(data?.generatedAt)}`,
      'No hay estaciones offline en este momento.',
    ].join('\n');
  }
  return [
    '🚨 EVINKA OFFLINE',
    `Actualizado: ${formatStatusSnapshotTime(data?.generatedAt)}`,
    ...offline.slice(0, 8).map(statusStationLine),
    offline.length > 8 ? `Y ${offline.length - 8} más...` : '',
  ].filter(Boolean).join('\n');
}

function buildTechnicianAvailableMessage(data = {}) {
  const stations = Array.isArray(data?.stations) ? data.stations : [];
  const available = stations.filter((station) => station?.tone === 'available');
  if (!available.length) {
    return [
      '⚠️ EVINKA OPERATIVAS',
      `Actualizado: ${formatStatusSnapshotTime(data?.generatedAt)}`,
      'No encuentro estaciones marcadas como operativas en este snapshot.',
    ].join('\n');
  }
  return [
    '✅ EVINKA OPERATIVAS',
    `Actualizado: ${formatStatusSnapshotTime(data?.generatedAt)}`,
    ...available.slice(0, 8).map(statusStationLine),
    available.length > 8 ? `Y ${available.length - 8} más...` : '',
  ].filter(Boolean).join('\n');
}

function buildTechnicianHelpMessage() {
  return [
    '🛠️ EVINKA ALERTAS',
    'Puedes usar los botones o escribir:',
    '• RESUMEN',
    '• OFFLINE',
    '• OPERATIVAS',
    '• AYUDA',
  ].join('\n');
}

function resolveTechnicianStatusCommand(message) {
  const action = message?.type === 'interactive' ? message?.interactive?.id || '' : '';
  if (action === 'tech_status_summary') return 'summary';
  if (action === 'tech_status_offline') return 'offline';
  if (action === 'tech_status_available') return 'available';
  const text = String(message?.text || '').trim().toLowerCase();
  if (!text) return 'menu';
  if (/(^|\b)(resumen|estado|status)(\b|$)/.test(text)) return 'summary';
  if (/(^|\b)(offline|caidos|caídos|desconectados)(\b|$)/.test(text)) return 'offline';
  if (/(^|\b)(operativas|funcionales|disponibles)(\b|$)/.test(text)) return 'available';
  if (/(^|\b)(ayuda|menu|menú|opciones)(\b|$)/.test(text)) return 'menu';
  return 'menu';
}

async function sendTechnicianStatusMenu(metaClient, to, body = null) {
  const text = body || 'EVINKA Alertas ⚡\n¿Qué deseas revisar?';
  await metaClient.sendButtons(to, {
    body: text,
    footer: 'Bot técnico EVINKA',
    buttons: [
      { id: 'tech_status_summary', title: 'Resumen' },
      { id: 'tech_status_offline', title: 'Ver offline' },
      { id: 'tech_status_available', title: 'Operativas' },
    ],
  });
}

async function handleTechnicianInbound(metaClient, message) {
  const action = message?.type === 'interactive' ? message?.interactive?.id || '' : '';
  const prefReply = action ? statusPrefsReply(action, message.from) : null;
  if (prefReply) {
    await sendTechnicianStatusMenu(metaClient, message.from, `${prefReply}\n\n¿Qué deseas revisar ahora?`);
    return true;
  }
  const snapshot = loadStatusOverviewSnapshot();
  const command = resolveTechnicianStatusCommand(message);
  if (command === 'summary') {
    await sendTechnicianStatusMenu(metaClient, message.from, buildTechnicianSummaryMessage(snapshot));
    return true;
  }
  if (command === 'offline') {
    await sendTechnicianStatusMenu(metaClient, message.from, buildTechnicianOfflineMessage(snapshot));
    return true;
  }
  if (command === 'available') {
    await sendTechnicianStatusMenu(metaClient, message.from, buildTechnicianAvailableMessage(snapshot));
    return true;
  }
  await sendTechnicianStatusMenu(metaClient, message.from, buildTechnicianHelpMessage());
  return true;
}

function bookingReminderText({ ticket, dateLabel, hourLabel, address }) {
  return `Recordatorio de cita EVINKA ⏰\n\nTicket: ${ticket}\nFecha: ${dateLabel}\nHora: ${hourLabel}\nDirección: ${address}\n\n¿Qué deseas hacer con esta cita?`;
}

function scheduleReminder({ to, ticket, dateLabel, hourLabel, address, userScope = 'default' }) {
  const enabled = String(process.env.BOOKING_REMINDER_ENABLED || 'true').toLowerCase();
  if (enabled === 'false' || enabled === '0' || enabled === 'off') return null;
  const afterMinutes = Number(process.env.BOOKING_REMINDER_AFTER_MINUTES || 10);
  const delayMs = Math.max(1, (Number.isFinite(afterMinutes) && afterMinutes > 0 ? afterMinutes : 10) * 60 * 1000);
  if (reminderTimers.has(ticket)) clearTimeout(reminderTimers.get(ticket));
  const timer = setTimeout(async () => {
    try {
      const text = bookingReminderText({ ticket, dateLabel, hourLabel, address });
      const channel = whatsappChannels.find((item) => item.key === userScope) || defaultWhatsAppChannel;
      const metaClient = metaByPhoneNumberId.get(channel.phoneNumberId) || meta;
      await metaClient.sendButtons(to, {
        body: text,
        footer: 'EVINKA',
        buttons: [
          { id: 'reminder_confirm', title: 'Confirmar' },
          { id: 'reminder_reschedule', title: 'Reprogramar' },
          { id: 'reminder_cancel', title: 'Cancelar' },
        ],
      });
      await engine.activateBookingReminder({ phone: to, ticket, dateLabel, hourLabel, address, userScope });
    } catch (error) {
      console.error('booking reminder failed:', error);
    } finally {
      reminderTimers.delete(ticket);
    }
  }, delayMs);
  reminderTimers.set(ticket, timer);
  return { ok: true, delayMs };
}

function clearBookingReminder(ticket = '') {
  const key = String(ticket || '').trim();
  if (!key) return false;
  const timer = reminderTimers.get(key);
  if (!timer) return false;
  clearTimeout(timer);
  reminderTimers.delete(key);
  return true;
}

function handoffTimeoutText() {
  return `Parece que nuestros asesores se encuentran ocupados en este momento.\n\nPuedes elegir una opción:\nA. Seguir esperando atención humana\nB. Volver al menú principal\n\nResponde A o B.`;
}

function clearHandoffTimer(conversationId = '') {
  const key = String(conversationId || '').trim();
  if (!key) return;
  const timer = handoffTimers.get(key);
  if (timer) clearTimeout(timer);
  handoffTimers.delete(key);
}

function clearHandoffAdvisorReminder(conversationId = '') {
  const key = String(conversationId || '').trim();
  if (!key) return;
  const timer = handoffAdvisorReminderTimers.get(key);
  if (timer) clearTimeout(timer);
  handoffAdvisorReminderTimers.delete(key);
}

function scheduleHandoffAdvisorReminder({ conversationId = '', phone = '', userScope = 'default', countryCode = null, customerName = '' } = {}) {
  const key = String(conversationId || '').trim();
  if (!key || !phone) return null;
  clearHandoffAdvisorReminder(key);
  const timer = setTimeout(async () => {
    try {
      const rows = await sb.select('conversaciones', `id_conversacion=eq.${encodeURIComponent(key)}&select=*`);
      const conversation = rows[0] || null;
      const state = getAdvisorConversationState(key) || {};
      if (!conversation || !(conversation.estado_conversacion === 'handoff' || conversation.requiere_handoff === true || conversation.paso_actual === 'handoff_asesor' || conversation.paso_actual === 'esperando_timeout_asesor')) return;
      const lastCustomerAtMs = new Date(state.lastCustomerMessageAt || conversation.ultimo_mensaje_en || conversation.actualizado_en || conversation.creado_en || Date.now()).getTime();
      const lastAgentAtMs = new Date(state.lastAgentMessageAt || 0).getTime();
      if (!Number.isFinite(lastCustomerAtMs) || lastAgentAtMs >= lastCustomerAtMs) return;

      const waitedMs = Date.now() - lastCustomerAtMs;
      if (waitedMs < HANDOFF_ADVISOR_REMINDER_MS) {
        scheduleHandoffAdvisorReminder({ conversationId: key, phone, userScope, countryCode, customerName });
        return;
      }
      const reminderCount = Number(state.advisorReminderCount || 0) + 1;
      const waitingMinutes = Math.max(HANDOFF_ADVISOR_REMINDER_MINUTES, Math.round(waitedMs / 60000));
      const alertResult = await notifyAdvisorReminder({
        conversation,
        customerPhone: phone,
        customerName,
        countryCode,
        waitingMinutes,
        reminderCount,
      });

      patchAdvisorConversation(key, (current) => ({
        ...current,
        handoffActive: true,
        supportStatus: current.assignedTo ? 'tomado' : (current.supportStatus || 'esperando_asesor'),
        advisorReminderCount: reminderCount,
        lastAdvisorReminderAt: new Date().toISOString(),
        advisorReminderSummary: alertResult,
      }));
      await upsertSupportTicket({
        conversation,
        phone,
        patch: {
          status: state.assignedTo ? 'tomado' : (state.supportStatus || 'esperando_asesor'),
          handoff_active: true,
          timeout_checked_at: new Date().toISOString(),
          last_customer_message_at: new Date(lastCustomerAtMs).toISOString(),
        },
      });
    } catch (error) {
      console.error('handoff advisor reminder failed:', error);
    } finally {
      handoffAdvisorReminderTimers.delete(key);
      const state = getAdvisorConversationState(key) || {};
      const lastCustomerAtMs = new Date(state.lastCustomerMessageAt || 0).getTime();
      const lastAgentAtMs = new Date(state.lastAgentMessageAt || 0).getTime();
      if (lastCustomerAtMs && lastCustomerAtMs > lastAgentAtMs) {
        scheduleHandoffAdvisorReminder({ conversationId: key, phone, userScope, countryCode, customerName });
      }
    }
  }, HANDOFF_ADVISOR_REMINDER_MS);
  handoffAdvisorReminderTimers.set(key, timer);
  return { ok: true, delayMs: HANDOFF_ADVISOR_REMINDER_MS };
}

function scheduleHandoffTimeout({ conversationId = '', phone = '', userScope = 'default', countryCode = null } = {}) {
  const key = String(conversationId || '').trim();
  if (!key || !phone) return null;
  clearHandoffTimer(key);
  const timer = setTimeout(async () => {
    try {
      const rows = await sb.select('conversaciones', `id_conversacion=eq.${encodeURIComponent(key)}&select=*`);
      const conversation = rows[0] || null;
      const state = getAdvisorConversationState(key) || {};
      if (!conversation || !(conversation.estado_conversacion === 'handoff' || conversation.requiere_handoff === true || conversation.paso_actual === 'handoff_asesor')) return;
      const lastCustomerAt = new Date(state.lastCustomerMessageAt || conversation.ultimo_mensaje_en || conversation.actualizado_en || conversation.creado_en || Date.now()).getTime();
      const lastAgentAt = new Date(state.lastAgentMessageAt || 0).getTime();
      const timeoutPromptedAt = new Date(state.timeoutPromptedAt || 0).getTime();
      if (!Number.isFinite(lastCustomerAt) || lastAgentAt >= lastCustomerAt || timeoutPromptedAt >= lastCustomerAt) return;

      const channel = whatsappChannels.find((item) => item.key === userScope) || advisorChannelForCountry(countryCode) || defaultWhatsAppChannel;
      const metaClient = metaByPhoneNumberId.get(channel.phoneNumberId) || meta;
      await metaClient.sendButtons(phone, {
        body: handoffTimeoutText(),
        footer: 'EVINKA',
        buttons: [
          { id: 'timeout_wait', title: 'Seguir esperando' },
          { id: 'timeout_menu', title: 'Menú principal' },
        ],
      });

      await sb.update('conversaciones', `id_conversacion=eq.${encodeURIComponent(key)}`, {
        estado_conversacion: 'handoff',
        requiere_handoff: true,
        paso_actual: 'esperando_timeout_asesor',
        subestado_flujo: 'timeout_asesor_30m',
        ultimo_mensaje_en: new Date().toISOString(),
      });
      await upsertSupportTicket({
        conversation,
        phone,
        patch: {
          status: 'cliente_esperando',
          handoff_active: true,
          timeout_checked_at: new Date().toISOString(),
          last_customer_message_at: new Date(lastCustomerAt).toISOString(),
        },
      });

      patchAdvisorConversation(key, (current) => ({
        ...current,
        handoffActive: true,
        supportStatus: 'cliente_esperando',
        timeoutPromptedAt: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('handoff timeout failed:', error);
    } finally {
      clearHandoffTimer(key);
    }
  }, HANDOFF_TIMEOUT_MS);
  handoffTimers.set(key, timer);
  return { ok: true, delayMs: HANDOFF_TIMEOUT_MS };
}

async function publishTechVisit(payload) {
  const baseUrl = (process.env.TECH_VISITS_BASE_URL || 'http://127.0.0.1:3008').replace(/\/$/, '');
  const apiKey = process.env.EVINKA_BOT_VISITS_API_KEY || 'EvinkaBotVisits#2026';
  const res = await fetch(`${baseUrl}/api/internal/tech-visits`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-evinka-bot-key': apiKey,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`tech visit publish -> ${res.status} ${res.statusText} ${JSON.stringify(data)}`);
  }
  return data;
}

function buildSupportCaseCode({ ticketId = '', conversationId = '' } = {}) {
  const raw = String(ticketId || conversationId || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  return `ST-${(raw || Date.now().toString(36).toUpperCase()).slice(0, 8)}`;
}

async function publishSupportCase({ conversation, profile = null, caseData = {}, countryCode = null, customerPhone = '', userScope = 'default' }) {
  const now = new Date().toISOString();
  const priority = caseData?.mode === 'emergency' ? 'urgente' : 'normal';
  const ticket = await upsertSupportTicket({
    conversation,
    phone: customerPhone,
    patch: {
      status: 'nuevo',
      priority,
      handoff_active: false,
      last_customer_message_at: now,
      closed_at: null,
      close_reason: null,
    },
  }).catch((error) => {
    console.error('support ticket upsert failed:', error);
    return null;
  });

  let alertResult = null;
  if (caseData?.mode === 'emergency' && conversation?.id_conversacion) {
    try {
      alertResult = await notifyAdvisorRecipients({
        conversation: {
          ...conversation,
          motivo_handoff: 'Emergencia técnica reportada por cliente',
        },
        customerPhone,
        customerName: caseData?.name || profile?.nombre_receptor || '',
        countryCode,
      });
    } catch (error) {
      console.error('support emergency alert failed:', error);
    }
  }

  return {
    ok: true,
    ticketId: ticket?.id || null,
    caseCode: buildSupportCaseCode({ ticketId: ticket?.id, conversationId: conversation?.id_conversacion }),
    priority,
    alerted: alertResult,
    userScope,
  };
}

const engine = new ChatbotEngine({ sb, calendar, bookings, reminderScheduler: scheduleReminder, visitPublisher: publishTechVisit, supportCasePublisher: publishSupportCase });

function conversationUserScope(conversation = {}) {
  return String(conversation?.id_usuario || '').startsWith('wco_') ? 'co' : 'default';
}

function conversationChannel(conversation = {}, countryCode = null) {
  return whatsappChannels.find((item) => item.key === conversationUserScope(conversation))
    || advisorChannelForCountry(countryCode)
    || defaultWhatsAppChannel;
}

function cleanDoc(value = '') {
  return String(value || '').replace(/[^\d]/g, '');
}

function compactScheduleLabel(startTime = '', endTime = '') {
  const start = String(startTime || '').slice(0, 5);
  const end = String(endTime || '').slice(0, 5);
  if (!start) return '';
  return end ? `${start}-${end}` : start;
}

function finalConfirmation({ ticket, dateLabel, hourLabel, address, country = null, kind = 'confirmed' }) {
  if (country === 'CO') {
    if (kind === 'rescheduled') {
      return `¡Listo! ✨ Tu visita quedó actualizada.\n\nTicket: ${ticket}\nFecha: ${dateLabel}\nHora: ${hourLabel}\nDirección: ${address}\n\nSi quieres moverla otra vez o cancelarla, escríbenos por aquí.`;
    }
    return `✅ Tu visita técnica fue agendada exitosamente.\n\nTicket de reserva: ${ticket}\nFecha: ${dateLabel}\nHora: ${hourLabel}\nDirección: ${address}\n\nSi deseas continuar, puedes volver al menú principal o reprogramar la visita desde aquí.`;
  }
  return `Listo ✅\nTu visita técnica quedó confirmada.\n\nTicket: ${ticket}\nFecha: ${dateLabel}\nHora: ${hourLabel}\nDirección: ${address}\n\nSi más adelante necesitas reprogramar o cancelar, escríbenos por este mismo medio.\n\n¡Gracias por elegir EVINKA! ⚡`;
}

function calendarSyncNote(provider = '') {
  const normalized = String(provider || '').trim().toLowerCase();
  if (normalized === 'clickup') return 'Sincronizada con ClickUp.';
  if (normalized === 'hybrid') return 'Sincronizada con ClickUp y Microsoft Calendar.';
  return 'Sincronizada con Microsoft Calendar.';
}

function splitReceiverDocument(value = '') {
  const clean = cleanDoc(String(value || ''));
  if (!clean) return { dni: null, ruc: null };
  return /^\d{11}$/.test(clean)
    ? { dni: null, ruc: clean }
    : { dni: clean, ruc: null };
}

async function finalizeAdvisorManualVisit(payload = {}) {
  const conversationId = String(payload.conversationId || '').trim();
  if (!conversationId) throw new Error('Falta conversationId para finalizar la visita manual.');

  const rows = await sb.select('conversaciones', `id_conversacion=eq.${encodeURIComponent(conversationId)}&select=*`);
  const conversation = rows[0] || null;
  if (!conversation) throw new Error('No encontré la conversación para finalizar la visita.');

  const date = String(payload.scheduledDate || '').trim() || agendaDate(payload.scheduledAt);
  const time = normalizeAgendaClock(String(payload.exactTime || '').trim() || agendaTime(payload.scheduledAt));
  const clientAddress = String(payload.clientAddress || '').trim();
  const receiptAddress = String(payload.receiptAddress || '').trim();
  const receiptDistrict = String(payload.receiptDistrict || '').trim();
  const receiptProvince = String(payload.receiptProvince || '').trim();
  const receiptPower = String(payload.receiptPower || '').trim();
  const receiverName = String(payload.receiverName || payload.clientName || '').trim();
  const receiverPhone = String(payload.receiverPhone || '').trim();
  const receiverEmail = normalizeEmail(payload.receiverEmail || '');
  const vehicleBrand = String(payload.vehicleBrand || '').trim();
  const vehicleModel = String(payload.vehicleModel || '').trim();
  const vehicleType = String(payload.vehicleType || '').trim();
  const receiverRole = String(payload.receiverRole || 'self').trim();
  const countryCode = String(payload.countryCode || '').trim().toUpperCase() || 'PE';

  if (!date || !time || !clientAddress) {
    throw new Error('Faltan fecha, hora o dirección exacta para confirmar la visita.');
  }
  if (!receiptAddress || !receiptDistrict || !receiptProvince || !receiptPower) {
    throw new Error('Faltan datos manuales del recibo para confirmar la visita.');
  }
  if (!receiverName || !receiverPhone || !receiverEmail) {
    throw new Error('Faltan datos de la persona que recibirá la visita.');
  }
  if (!vehicleBrand || !vehicleModel || !vehicleType) {
    throw new Error('Faltan datos del vehículo para confirmar la visita.');
  }

  const phone = engine.phoneForUserId(conversation.id_usuario);
  const profile = await engine.getOrCreateProfile(conversation);
  const profileLike = {
    ...profile,
    pais_cliente: countryCode,
    direccion_instalacion: clientAddress,
    distrito_instalacion: receiptDistrict,
    provincia_instalacion: receiptProvince,
    zona_cliente: String(payload.clientZone || profile?.zona_cliente || '').trim(),
  };
  const zone = String(payload.clientZone || '').trim()
    || resolveProfileZone(profileLike, { phone, country: countryCode })
    || null;
  if (!zone) {
    throw new Error('No pude identificar la zona para confirmar la visita con la lógica del bot.');
  }

  const dayOptions = await engine.availableDaysForZone(zone);
  const day = dayOptions.find((item) => String(item.date || '').trim() === date) || null;
  if (!day) {
    throw new Error('Ese día ya no está disponible según la lógica del bot.');
  }
  const availableSlots = await engine.availableHoursForDate(date, { clientZone: zone });
  const chosen = availableSlots.find((slot) => normalizeAgendaClock(slot.time) === time) || null;
  if (!chosen) {
    throw new Error('Ese horario ya no está disponible según la lógica del bot.');
  }

  const { dni, ruc } = splitReceiverDocument(payload.receiverDocument || '');
  const profilePatch = {
    direccion_recibo: receiptAddress,
    distrito_recibo: receiptDistrict,
    provincia_recibo: receiptProvince,
    potencia_kw: receiptPower,
    nombre_receptor: receiverName,
    dni_receptor: dni,
    ruc_receptor: ruc,
    telefono_receptor: receiverPhone,
    correo_receptor: receiverEmail,
    direccion_instalacion: clientAddress,
    distrito_instalacion: receiptDistrict,
    provincia_instalacion: receiptProvince,
    zona_cliente: zone,
    marca_vehiculo: vehicleBrand,
    modelo_vehiculo: vehicleModel,
    notas_recibo: `tipo_vehiculo=${vehicleType}`,
    estado_perfil: 'ready_for_schedule',
  };
  await engine.patchProfile(conversation.id_conversacion, profilePatch);
  try {
    await sb.update('usuarios', `id_usuario=eq.${encodeURIComponent(conversation.id_usuario)}`, {
      nombre_visible: receiverName,
      nombre_usuario: receiverName,
      correo_electronico: receiverEmail || null,
      telefono_principal: receiverPhone,
    });
  } catch (error) {
    const message = String(error?.message || '');
    if (!message.includes('usuarios_correo_key')) throw error;
    await sb.update('usuarios', `id_usuario=eq.${encodeURIComponent(conversation.id_usuario)}`, {
      nombre_visible: receiverName,
      nombre_usuario: receiverName,
      telefono_principal: receiverPhone,
    });
  }

  const currentProfile = { ...profile, ...profilePatch, id_perfil: profile.id_perfil };
  const appointment = await engine.createOrUpdateAppointment(conversation, currentProfile, {
    codigo_cita: engine.ticketFor(date, conversation.id_conversacion),
    fecha_cita: date,
    hora_inicio: chosen.time,
    hora_fin: chosen.endTime,
    fecha_hora_inicio: `${date}T${chosen.time}-05:00`,
    fecha_hora_fin: `${date}T${chosen.endTime}-05:00`,
    nombre_cliente: receiverName,
    telefono_cliente: receiverPhone,
    dni_cliente: dni || ruc,
    correo_cliente: receiverEmail,
    direccion_cita: clientAddress,
    distrito_cita: receiptDistrict,
    provincia_cita: receiptProvince,
    zona_cliente: zone,
    zona_dia: zone,
    control_zona: zone,
    etiqueta_horario: compactScheduleLabel(chosen.time, chosen.endTime),
    marca_vehiculo: vehicleBrand,
    modelo_vehiculo: vehicleModel,
    potencia_kw: receiptPower,
    fase_electrica: currentProfile.fase_electrica || 'no_definido',
    validacion_recibo: true,
    estado_cita: 'confirmada',
    aprobacion: 'aprobada',
    confirmada_por_cliente: true,
    confirmada_en: new Date().toISOString(),
  });

  try {
    const microsoftEventId = await engine.ensureCalendarEvent({
      appointment,
      profile: currentProfile,
      dateLabel: day.label,
      hourLabel: chosen.label,
      ticket: appointment.codigo_cita,
    });
    if (microsoftEventId) {
      appointment.microsoft_event_id = microsoftEventId;
      await sb.update('citas', `id_cita=eq.${appointment.id_cita}`, {
        microsoft_event_id: microsoftEventId,
        observaciones: calendarSyncNote(calendar?.provider),
      });
    }
  } catch (error) {
    console.error('advisor manual ensureCalendarEvent failed:', error);
  }

  const finalAddress = `${clientAddress} ${receiptDistrict} ${receiptProvince}`.trim();
  try {
    await engine.scheduleBookingReminder({
      userId: conversation.id_usuario,
      ticket: appointment.codigo_cita,
      dateLabel: day.label,
      hourLabel: chosen.label,
      address: finalAddress,
    });
  } catch (error) {
    console.error('advisor manual scheduleBookingReminder failed:', error);
  }

  let visitPublishResult = null;
  try {
    visitPublishResult = await engine.publishTechVisit({
      conversation,
      profile: currentProfile,
      appointment,
      dateLabel: day.label,
      hourLabel: chosen.label,
    });
  } catch (error) {
    console.error('advisor manual publishTechVisit failed:', error);
  }

  await engine.patchProfile(conversation.id_conversacion, { estado_perfil: 'scheduled' });
  const reply = await engine.reply(
    conversation,
    finalConfirmation({ ticket: appointment.codigo_cita, dateLabel: day.label, hourLabel: chosen.label, address: finalAddress, country: countryCode, kind: 'confirmed' }),
    {
      paso_actual: 'cita_confirmada',
      subestado_flujo: 'agenda_confirmada',
      estado_conversacion: 'closed',
      accion_ticket_actual: 'confirm',
      codigo_ticket_solicitado: appointment.codigo_cita,
      cerrada_en: new Date().toISOString(),
    },
  );

  if (phone) {
    const channel = conversationChannel(conversation, countryCode);
    await sendReply(phone, reply, channel.phoneNumberId);
  }

  return {
    ok: true,
    created: Boolean(visitPublishResult?.created),
    visit: visitPublishResult?.visit || null,
    clickupSync: visitPublishResult?.clickupSync || null,
    appointment: {
      ticket: appointment.codigo_cita,
      dateLabel: day.label,
      hourLabel: chosen.label,
      address: finalAddress,
    },
    reply,
    receiverRole,
  };
}

function buildWhatsAppChannels() {
  const channels = [];
  channels.push({
    key: 'default',
    accessToken: requiredEnv('WHATSAPP_ACCESS_TOKEN'),
    phoneNumberId: requiredEnv('WHATSAPP_PHONE_NUMBER_ID'),
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || null,
    defaultCountry: process.env.WHATSAPP_DEFAULT_COUNTRY || null,
    appSecret: process.env.META_APP_SECRET,
  });
  if (process.env.WHATSAPP_ACCESS_TOKEN_CO && process.env.WHATSAPP_PHONE_NUMBER_ID_CO) {
    channels.push({
      key: 'co',
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN_CO,
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID_CO,
      businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID_CO || null,
      defaultCountry: process.env.WHATSAPP_DEFAULT_COUNTRY_CO || 'CO',
      appSecret: process.env.META_APP_SECRET,
    });
  }
  return channels;
}

const whatsappChannels = buildWhatsAppChannels();
const defaultWhatsAppChannel = whatsappChannels[0];
const metaByPhoneNumberId = new Map(
  whatsappChannels.map((channel) => [
    channel.phoneNumberId,
    new WhatsAppMetaClient({
      accessToken: channel.accessToken,
      phoneNumberId: channel.phoneNumberId,
      appSecret: channel.appSecret,
    }),
  ]),
);
const meta = metaByPhoneNumberId.get(defaultWhatsAppChannel.phoneNumberId);

function resolveWhatsAppChannel(phoneNumberId = null) {
  return whatsappChannels.find((channel) => String(channel.phoneNumberId) === String(phoneNumberId || '')) || defaultWhatsAppChannel;
}

function resolveMetaClient(phoneNumberId = null) {
  const channel = resolveWhatsAppChannel(phoneNumberId);
  return metaByPhoneNumberId.get(channel.phoneNumberId) || meta;
}

async function sendReply(to, reply, phoneNumberId = null) {
  if (!reply) return;
  const client = resolveMetaClient(phoneNumberId);
  if (Array.isArray(reply)) {
    for (const item of reply) await sendReply(to, item, phoneNumberId);
    return;
  }
  if (typeof reply === 'string') {
    await client.sendText(to, reply);
    return;
  }
  if (reply.kind === 'sequence') {
    for (const item of reply.messages || []) await sendReply(to, item, phoneNumberId);
    return;
  }
  if (reply.kind === 'buttons') {
    await client.sendButtons(to, {
      body: reply.text,
      footer: reply.footer || '',
      buttons: reply.buttons || [],
    });
    return;
  }
  if (reply.kind === 'list') {
    await client.sendList(to, {
      body: reply.text,
      footer: reply.footer || '',
      buttonText: reply.buttonText || 'Ver opciones',
      sections: reply.sections || [],
    });
    return;
  }
  await client.sendText(to, reply.text || String(reply));
}

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const recentMessageIds = new Map();

function rememberMessage(id) {
  if (!id) return false;
  const now = Date.now();
  for (const [key, ts] of recentMessageIds.entries()) {
    if (now - ts > 15 * 60 * 1000) recentMessageIds.delete(key);
  }
  if (recentMessageIds.has(id)) return true;
  recentMessageIds.set(id, now);
  return false;
}

function normalizeInboundCommand(text = '') {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function isResumeBotCommand(text = '') {
  const normalized = normalizeInboundCommand(text);
  return [
    'menu',
    'menu principal',
    'menu_main',
    'bot',
    'resume_bot',
    'retomar con bot',
    'volver al bot',
    'reiniciar',
    'volver',
    'salir',
  ].includes(normalized);
}

function isMissingSchemaError(error) {
  const message = String(error?.message || error || '');
  return message.includes("Could not find the table 'public.usuarios'")
    || message.includes("Could not find the table 'public.conversaciones'")
    || message.includes("Could not find the table 'public.perfiles_cliente'")
    || message.includes('PGRST205')
    || message.includes('schema cache');
}

function fallbackBotReply(message = {}) {
  const raw = message.type === 'interactive'
    ? String(message.interactive?.id || message.interactive?.title || message.text || '')
    : String(message.text || '');
  const text = raw.trim().toLowerCase();

  if (!text || ['hola', 'buenas', 'buenos dias', 'buenos días', 'menu', 'bot', 'reiniciar'].includes(text)) {
    return '¡Hola! 👋\n\nActualmente en EVINKA estamos probando una nueva automatización para atenderte más rápido.\n\nSi ya habías conversado antes con un asesor de EVINKA, o tienes una cotización / caso pendiente de seguimiento, solo escribe *ASESOR* y te derivaremos para revisar tu caso directamente.\n\nTe puedo ayudar con una de estas opciones:\n\nA. Instalar un cargador\nB. Reprogramar visita\nC. Cancelar visita\nD. Asistencia técnica\nE. Soporte humano\n\nPor favor responde con la letra de la opción que deseas.';
  }

  if (/\b(soy|somos|hablo|te escribo)\b.*\bde\b.*\b(telemundo|grupo pana|astara|geely|ipesa|empresa|corporativo|grifo)\b/i.test(text)) {
    return 'Gracias por escribirnos 👍\n\nVeo que tu consulta parece corresponder a una empresa o cuenta corporativa.\n\nEste canal está orientado a atención B2C, así que te derivaremos con un asesor de EVINKA para una atención personalizada.';
  }

  if (text === 'a' || text.includes('instalar')) {
    return 'Perfecto 👍\n\nPara instalar un cargador, necesito validar tu caso. Envíame tu nombre, distrito, dirección y número de contacto, y seguimos.';
  }

  if (text === 'b' || text.includes('reprogramar')) {
    return 'Perfecto 👍\n\nPara reprogramar tu visita, envíame el código de la cita y te ayudo con eso.';
  }

  if (text === 'c' || text.includes('cancelar')) {
    return 'Perfecto 👍\n\nPara cancelar tu visita, envíame el código de la cita y te ayudo con eso.';
  }

  if (text === 'd' || text.includes('asistencia') || text.includes('falla') || text.includes('emergencia')) {
    return 'Perfecto 👍\n\nPuedo ayudarte a registrar un caso de soporte técnico o una emergencia. Responde D desde el menú principal para empezar.';
  }

  if (text === 'e' || text.includes('asesor') || text.includes('humano')) {
    return 'Listo 👍\n\nSi ya tenías una cotización o un caso pendiente, te derivo con un asesor para revisar tu seguimiento.';
  }

  return 'Gracias. Escríbeme *hola* para ver el menú principal, responde con A, B, C, D o E, o escribe *ASESOR* si ya tenías un seguimiento previo.';
}

function summarizeInboundMessage(message = {}) {
  const type = String(message.type || '').trim().toLowerCase();
  const raw = message.raw || {};

  if (type === 'text') {
    return {
      text: String(message.text || '').trim(),
      messageType: 'text',
      extraPayload: {},
    };
  }

  if (type === 'interactive') {
    const title = String(message.interactive?.title || message.text || '').trim();
    const id = String(message.interactive?.id || '').trim();
    return {
      text: title || '[opción interactiva]',
      messageType: 'interactive',
      extraPayload: {
        interactiveTitle: title || null,
        interactiveId: id || null,
      },
    };
  }

  if (type === 'contacts') {
    const contacts = Array.isArray(raw.contacts) ? raw.contacts : [];
    const first = contacts[0] || {};
    const formattedName = String(first?.name?.formatted_name || [first?.name?.first_name, first?.name?.last_name].filter(Boolean).join(' ') || '').trim();
    const phone = String(first?.phones?.[0]?.phone || first?.phones?.[0]?.wa_id || '').trim();
    return {
      text: ['Contacto compartido', formattedName, phone].filter(Boolean).join('\n'),
      messageType: 'contacts',
      extraPayload: {
        sharedContacts: contacts,
        contactName: formattedName || null,
        contactPhone: phone || null,
      },
    };
  }

  if (type === 'location') {
    const location = raw.location || {};
    const name = String(location.name || '').trim();
    const address = String(location.address || '').trim();
    const latitude = location.latitude ?? null;
    const longitude = location.longitude ?? null;
    return {
      text: ['Ubicación compartida', name, address, latitude != null && longitude != null ? `${latitude}, ${longitude}` : ''].filter(Boolean).join('\n'),
      messageType: 'location',
      extraPayload: {
        locationName: name || null,
        locationAddress: address || null,
        latitude,
        longitude,
      },
    };
  }

  if (type === 'audio') {
    return {
      text: '[audio]',
      messageType: 'audio',
      extraPayload: {},
    };
  }

  if (type === 'video') {
    const caption = String(raw.video?.caption || message.text || '').trim();
    return {
      text: caption ? `[video]\n${caption}` : '[video]',
      messageType: 'video',
      extraPayload: {},
    };
  }

  if (type === 'sticker') {
    return {
      text: '[sticker]',
      messageType: 'sticker',
      extraPayload: {},
    };
  }

  return {
    text: String(message.text || `[${type || 'mensaje'}]`).trim(),
    messageType: type || 'text',
    extraPayload: {},
  };
}

function trackAdvisorConversationVisibility(conversation, {
  customerName = '',
  phone = '',
  handoffActive = false,
} = {}) {
  if (!conversation?.id_conversacion) return null;
  return patchAdvisorConversation(conversation.id_conversacion, (current) => ({
    ...current,
    internalStatus: current.internalStatus === 'resolved' ? 'open' : (current.internalStatus || 'new'),
    supportStatus: handoffActive
      ? (current.assignedTo ? 'tomado' : (current.supportStatus || 'esperando_asesor'))
      : (current.supportStatus || 'bot'),
    handoffActive: Boolean(handoffActive),
    unreadCount: Number(current.unreadCount || 0) + 1,
    lastIncomingAt: new Date().toISOString(),
    lastCustomerMessageAt: new Date().toISOString(),
    customerName: String(customerName || current.customerName || '').trim(),
    phone: String(phone || current.phone || '').trim(),
  }));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'GET' && url.pathname === WEBHOOK_PATH) {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');
      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(challenge || 'ok');
        return;
      }
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('forbidden');
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/internal/global-visit-delete') {
      const apiKey = process.env.EVINKA_BOT_VISITS_API_KEY || 'EvinkaBotVisits#2026';
      const provided = String(req.headers['x-evinka-bot-key'] || '').trim();
      if (!provided || provided !== apiKey) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bot no autorizado' }));
        return;
      }
      const raw = await readRawBody(req);
      const payload = JSON.parse(raw.toString('utf8') || '{}');
      const ticket = String(payload.ticket || '').trim();
      const eventId = String(payload.eventId || '').trim();
      const countryCode = String(payload.countryCode || '').trim().toUpperCase();
      const reminderCleared = clearBookingReminder(ticket);
      let calendarDeleted = false;
      if (eventId && calendar?.deleteEvent) {
        await calendar.deleteEvent(eventId, { ticket, countryCode });
        calendarDeleted = true;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, ticket, eventId, reminderCleared, calendarDeleted }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/internal/visit-options') {
      const apiKey = process.env.EVINKA_BOT_VISITS_API_KEY || 'EvinkaBotVisits#2026';
      const provided = String(req.headers['x-evinka-bot-key'] || '').trim();
      if (!provided || provided !== apiKey) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bot no autorizado' }));
        return;
      }

      const raw = await readRawBody(req);
      const payload = JSON.parse(raw.toString('utf8') || '{}');
      const profileLike = {
        pais_cliente: String(payload.countryCode || '').trim().toUpperCase(),
        zona_cliente: String(payload.clientZone || '').trim(),
        direccion_instalacion: String(payload.clientAddress || '').trim(),
        distrito_instalacion: String(payload.district || '').trim(),
        provincia_instalacion: String(payload.province || '').trim(),
      };
      const phone = String(payload.clientPhone || '').trim();
      const zone = String(payload.clientZone || '').trim()
        || resolveProfileZone(profileLike, { phone, country: profileLike.pais_cliente || null })
        || null;
      const countryCode = String(payload.countryCode || '').trim().toUpperCase()
        || inferCountryFromZone(zone || '')
        || null;
      const date = String(payload.scheduledDate || '').trim() || agendaDate(payload.scheduledAt);

      if (!zone) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: false,
          available: false,
          reason: 'zone_unresolved',
          message: 'No pude identificar la zona para validar disponibilidad con la lógica del bot.',
          countryCode,
          days: [],
          slots: [],
        }));
        return;
      }

      const days = await engine.availableDaysForZone(zone);
      const slots = date
        ? await engine.availableHoursForDate(date, { clientZone: zone })
        : [];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        available: null,
        reason: null,
        message: 'Disponibilidad obtenida según la lógica del bot.',
        zone,
        countryCode,
        date: date || '',
        days: days.map((day) => ({
          code: day.code,
          label: day.label,
          date: day.date,
          weekday: day.weekday,
        })),
        slots: slots.map((slot) => ({
          code: slot.code,
          time: slot.time,
          endTime: slot.endTime,
          label: slot.label,
        })),
      }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/internal/visit-availability') {
      const apiKey = process.env.EVINKA_BOT_VISITS_API_KEY || 'EvinkaBotVisits#2026';
      const provided = String(req.headers['x-evinka-bot-key'] || '').trim();
      if (!provided || provided !== apiKey) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bot no autorizado' }));
        return;
      }

      const raw = await readRawBody(req);
      const payload = JSON.parse(raw.toString('utf8') || '{}');
      const profileLike = {
        pais_cliente: String(payload.countryCode || '').trim().toUpperCase(),
        zona_cliente: String(payload.clientZone || '').trim(),
        direccion_instalacion: String(payload.clientAddress || '').trim(),
        distrito_instalacion: String(payload.district || '').trim(),
        provincia_instalacion: String(payload.province || '').trim(),
      };
      const phone = String(payload.clientPhone || '').trim();
      const zone = String(payload.clientZone || '').trim()
        || resolveProfileZone(profileLike, { phone, country: profileLike.pais_cliente || null })
        || null;
      const countryCode = String(payload.countryCode || '').trim().toUpperCase()
        || inferCountryFromZone(zone || '')
        || null;
      const date = String(payload.scheduledDate || '').trim() || agendaDate(payload.scheduledAt);
      const time = String(payload.exactTime || '').trim() || agendaTime(payload.scheduledAt);

      if (!zone) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: false,
          available: false,
          reason: 'zone_unresolved',
          message: 'No pude identificar la zona para validar disponibilidad con la lógica del bot.',
          countryCode,
        }));
        return;
      }

      if (!date) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: false,
          available: false,
          reason: 'missing_schedule',
          message: 'Falta la fecha para validar disponibilidad.',
          zone,
          countryCode,
        }));
        return;
      }

      const slots = await engine.availableHoursForDate(date, { clientZone: zone });
      const normalizedRequestedTime = normalizeAgendaClock(time);
      if (!normalizedRequestedTime) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          available: null,
          reason: null,
          message: 'Horarios obtenidos según la lógica del bot.',
          zone,
          countryCode,
          date,
          time: '',
          slot: null,
          slots: slots.map((slot) => ({
            time: slot.time,
            endTime: slot.endTime,
            label: slot.label,
          })),
        }));
        return;
      }
      const matched = slots.find((slot) => normalizeAgendaClock(slot.time) === normalizedRequestedTime) || null;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: Boolean(matched),
        available: Boolean(matched),
        reason: matched ? null : 'slot_unavailable',
        message: matched
          ? 'Horario disponible según la lógica del bot.'
          : 'Ese horario no está disponible según la lógica de bloqueos del bot.',
        zone,
        countryCode,
        date,
        time: normalizedRequestedTime,
        slot: matched,
        slots: slots.map((slot) => ({
          time: slot.time,
          endTime: slot.endTime,
          label: slot.label,
        })),
      }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/internal/advisor-book-visit') {
      const apiKey = process.env.EVINKA_BOT_VISITS_API_KEY || 'EvinkaBotVisits#2026';
      const provided = String(req.headers['x-evinka-bot-key'] || '').trim();
      if (!provided || provided !== apiKey) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bot no autorizado' }));
        return;
      }

      const raw = await readRawBody(req);
      const payload = JSON.parse(raw.toString('utf8') || '{}');
      try {
        const result = await finalizeAdvisorManualVisit(payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (error) {
        console.error('advisor manual booking failed:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error?.message || 'No pude finalizar la visita manual.' }));
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === WEBHOOK_PATH) {
      const raw = await readRawBody(req);
      const signature = req.headers['x-hub-signature-256'];
      if (!meta.verifySignature(raw, signature)) {
        res.writeHead(401, { 'Content-Type': 'text/plain' });
        res.end('invalid signature');
        return;
      }

      const payload = JSON.parse(raw.toString('utf8') || '{}');
      const statuses = meta.extractStatuses(payload);
      if (statuses.length) {
        appendMetaDeliveryStatuses(statuses);
        for (const status of statuses) {
          console.log('meta delivery status:', JSON.stringify({
            id: status.id,
            status: status.status,
            recipientId: status.recipientId,
            channelDisplayPhoneNumber: status.channelDisplayPhoneNumber,
            errorData: status.errorData,
          }));
        }
      }
      const messages = meta.extractMessages(payload);
      for (const message of messages) {
        const channel = resolveWhatsAppChannel(message.channelPhoneNumberId);
        const metaClient = resolveMetaClient(message.channelPhoneNumberId);
        if (rememberMessage(message.id)) continue;
        if (isBotExcludedPhone(message.from)) {
          console.log(`Bot ignorado para número excluido ${message.from}`);
          continue;
        }
        let user = null;
        let role = 'cliente';
        try {
          ({ user, role } = await resolveInboundRole(message.from, channel.key));
        } catch (error) {
          if (isMissingSchemaError(error)) {
            role = detectSenderRole(message.from);
            if (role === 'tecnico') {
              await metaClient.sendText(message.from, 'Tu número está registrado como técnico EVINKA. Para no mezclar clientes con alertas técnicas, el flujo comercial ya no se ejecuta en este chat.');
            } else if (role === 'asesor') {
              await metaClient.sendText(message.from, 'Tu número está registrado como asesor EVINKA. Este chat queda reservado para alertas operativas, así que el chatbot comercial no se ejecuta aquí.');
            } else {
              await metaClient.sendText(message.from, fallbackBotReply(message));
            }
            continue;
          }
          throw error;
        }
        if (role === 'tecnico') {
          await handleTechnicianInbound(metaClient, message);
          continue;
        }
        if (role === 'asesor') {
          await metaClient.sendText(message.from, 'Tu número está registrado como asesor EVINKA. Este chat queda reservado para alertas operativas, así que el chatbot comercial no se ejecuta aquí.');
          continue;
        }
        let reply = null;

        if (message.type === 'interactive' && message.interactive?.id) {
          reply = statusPrefsReply(message.interactive.id, message.from);
        }

        const latestConversation = await engine.getLatestConversation(user);
        const handoffActive = latestConversation && (
          latestConversation.estado_conversacion === 'handoff'
          || latestConversation.paso_actual === 'handoff_asesor'
          || latestConversation.requiere_handoff === true
        );
        const inboundText = message.type === 'interactive' && message.interactive?.id
          ? (message.interactive.id || message.text || '')
          : (message.text || '');
        const previousAdvisorSignal = message.type === 'text' && detectPreviousAdvisorSignal(inboundText);
        const inboundTitle = message.type === 'interactive'
          ? (message.interactive?.title || message.text || '')
          : (message.text || '');
        const wantsResumeBot = isResumeBotCommand(inboundText) || isResumeBotCommand(inboundTitle);
        const handoffDecisionPending = latestConversation?.paso_actual === 'esperando_timeout_asesor';

        if (!reply && handoffActive && !wantsResumeBot && !handoffDecisionPending) {
          let mediaPayload = null;
          let artifactPayload = null;
          const summary = summarizeInboundMessage(message);
          let messageText = summary.text || '';
          let messageType = summary.messageType || 'text';
          if (message.media?.id) {
            try {
              const downloaded = await metaClient.downloadMedia(message.media.id);
              mediaPayload = await persistInboundClientMedia({
                message,
                conversation: latestConversation,
                user,
                customerPhone: message.from,
                customerName: message.profileName || '',
                downloaded,
                countryCode: channel.defaultCountry || (channel.key === 'co' ? 'CO' : 'PE'),
              });
              messageText = `[${mediaPayload.fileName}] ${message.text || ''}`.trim();
              messageType = (mediaPayload.mimeType || '').startsWith('image/') ? 'image' : 'document';
            } catch (error) {
              console.error('handoff media download failed:', error);
              messageText = `[${message.media.mimeType || message.media.fileName || 'archivo'}] ${message.text || ''}`.trim();
              messageType = (message.media.mimeType || '').startsWith('image/') ? 'image' : 'document';
            }
          }
          artifactPayload = await persistInboundClientArtifact({
            message,
            conversation: latestConversation,
            user,
            customerPhone: message.from,
            customerName: message.profileName || user?.nombre_visible || user?.nombre_usuario || '',
            countryCode: channel.defaultCountry || (channel.key === 'co' ? 'CO' : 'PE'),
          });
          await engine.logMessage(
            latestConversation.id_conversacion,
            latestConversation.id_usuario,
            'user',
            messageText,
            {
              tipo_mensaje: messageType,
              payload_crudo: {
                ...message.raw,
                ...(mediaPayload || {}),
                ...(artifactPayload || {}),
                ...(summary.extraPayload || {}),
              },
            },
          );
          trackAdvisorConversationVisibility(latestConversation, {
            customerName: message.profileName || user?.nombre_visible || user?.nombre_usuario || '',
            phone: message.from,
            handoffActive: true,
          });
          patchAdvisorConversation(latestConversation.id_conversacion, (current) => ({
            ...current,
            supportStatus: current.assignedTo ? 'tomado' : 'esperando_asesor',
          }));
          await upsertSupportTicket({
            conversation: latestConversation,
            user,
            phone: message.from,
            patch: {
              status: getAdvisorConversationState(latestConversation.id_conversacion)?.assignedTo ? 'tomado' : 'esperando_asesor',
              priority: 'normal',
              handoff_active: true,
              last_customer_message_at: new Date().toISOString(),
            },
          });
          scheduleHandoffTimeout({
            conversationId: latestConversation.id_conversacion,
            phone: message.from,
            userScope: channel.key,
            countryCode: channel.defaultCountry || (channel.key === 'co' ? 'CO' : 'PE'),
          });
          scheduleHandoffAdvisorReminder({
            conversationId: latestConversation.id_conversacion,
            phone: message.from,
            userScope: channel.key,
            countryCode: channel.defaultCountry || (channel.key === 'co' ? 'CO' : 'PE'),
            customerName: message.profileName || '',
          });
          continue;
        }

        try {
          if (!reply && message.type === 'interactive' && message.interactive?.id) {
            reply = await engine.handleIncoming({
              phone: message.from,
              text: message.interactive.id,
              payloadCrudo: { ...message.raw, profileName: message.profileName || null },
              defaultCountry: channel.defaultCountry,
              userScope: channel.key,
              profileName: message.profileName || '',
            });
          }

          if (!reply && message.type === 'text' && message.text) {
            reply = await engine.handleIncoming({
              phone: message.from,
              text: previousAdvisorSignal ? 'ASESOR' : message.text,
              payloadCrudo: { ...message.raw, profileName: message.profileName || null, previousAdvisorSignal: previousAdvisorSignal || null },
              defaultCountry: channel.defaultCountry,
              userScope: channel.key,
              profileName: message.profileName || '',
            });
          }

          if (!reply && (message.type === 'image' || message.type === 'document') && message.media?.id) {
            let mediaResult = null;
            try {
              const downloaded = await metaClient.downloadMedia(message.media.id);
              const mediaPayload = await persistInboundClientMedia({
                message,
                conversation: latestConversation,
                user,
                customerPhone: message.from,
                customerName: message.profileName || '',
                downloaded,
                countryCode: channel.defaultCountry || (channel.key === 'co' ? 'CO' : 'PE'),
              });
              mediaResult = await extractReceiptDataFromBuffer({
                buffer: downloaded.buffer,
                mimeType: message.media.mimeType || downloaded.mimeType,
                fileName: message.media.fileName,
              });
              reply = await engine.handleIncoming({
                phone: message.from,
                text: message.text || '',
                media: {
                  ...message.media,
                  ...downloaded,
                  ocr: mediaResult,
                },
                payloadCrudo: { ...message.raw, profileName: message.profileName || null, ...(mediaPayload || {}) },
                defaultCountry: channel.defaultCountry,
                userScope: channel.key,
                profileName: message.profileName || '',
              });
            } catch (error) {
              console.error(error);
              reply = await engine.handleIncoming({
                phone: message.from,
                text: message.text || '',
                media: {
                  ...message.media,
                  error: error.message,
                },
                payloadCrudo: { ...message.raw, profileName: message.profileName || null },
                defaultCountry: channel.defaultCountry,
                userScope: channel.key,
                profileName: message.profileName || '',
              });
            }
          }
        } catch (error) {
          if (isMissingSchemaError(error)) {
            reply = fallbackBotReply(message);
          } else {
            throw error;
          }
        }

        if (!reply) continue;

        const latestAfterReply = await engine.getLatestConversation(user);
        if (latestAfterReply) {
          trackAdvisorConversationVisibility(latestAfterReply, {
            customerName: message.profileName || user?.nombre_visible || user?.nombre_usuario || '',
            phone: message.from,
            handoffActive: latestAfterReply.estado_conversacion === 'handoff' || latestAfterReply.requiere_handoff === true,
          });
          await persistInboundClientArtifact({
            message,
            conversation: latestAfterReply,
            user,
            customerPhone: message.from,
            customerName: message.profileName || user?.nombre_visible || user?.nombre_usuario || '',
            countryCode: channel.defaultCountry || (channel.key === 'co' ? 'CO' : 'PE'),
          });
        }
        if (latestAfterReply && (latestAfterReply.estado_conversacion === 'handoff' || latestAfterReply.requiere_handoff)) {
          patchAdvisorConversation(latestAfterReply.id_conversacion, (current) => ({
            ...current,
            internalStatus: current.internalStatus === 'resolved' ? 'new' : (current.internalStatus || 'new'),
            handoffActive: true,
            supportStatus: current.assignedTo
              ? 'tomado'
              : (latestAfterReply.subestado_flujo === 'cliente_esperando' ? 'cliente_esperando' : 'esperando_asesor'),
            ticketOpenedAt: current.ticketOpenedAt || new Date().toISOString(),
            lastCustomerMessageAt: current.lastCustomerMessageAt || new Date().toISOString(),
            lastIncomingAt: new Date().toISOString(),
          }));
          await upsertSupportTicket({
            conversation: latestAfterReply,
            user,
            phone: message.from,
            patch: {
              status: 'esperando_asesor',
              priority: 'normal',
              handoff_active: true,
              last_customer_message_at: new Date().toISOString(),
            },
          });
          scheduleHandoffTimeout({
            conversationId: latestAfterReply.id_conversacion,
            phone: message.from,
            userScope: channel.key,
            countryCode: channel.defaultCountry || (channel.key === 'co' ? 'CO' : 'PE'),
          });
          scheduleHandoffAdvisorReminder({
            conversationId: latestAfterReply.id_conversacion,
            phone: message.from,
            userScope: channel.key,
            countryCode: channel.defaultCountry || (channel.key === 'co' ? 'CO' : 'PE'),
            customerName: message.profileName || '',
          });
          if (!handoffActive) {
            try {
              const countryCode = channel.defaultCountry || (channel.key === 'co' ? 'CO' : 'PE');
              const alertResult = await notifyAdvisorRecipients({
                conversation: latestAfterReply,
                customerPhone: message.from,
                customerName: message.profileName || '',
                countryCode,
              });
              patchAdvisorConversation(latestAfterReply.id_conversacion, (current) => ({
                ...current,
                advisorAlertedAt: new Date().toISOString(),
                advisorAlertSummary: alertResult,
              }));
            } catch (error) {
              console.error('advisor notifications failed:', error);
            }
          }
        } else if (latestConversation?.id_conversacion) {
          clearHandoffTimer(latestConversation.id_conversacion);
          clearHandoffAdvisorReminder(latestConversation.id_conversacion);
          patchAdvisorConversation(latestConversation.id_conversacion, (current) => ({
            ...current,
            handoffActive: false,
            supportStatus: current.internalStatus === 'resolved' ? 'cerrado' : 'vuelto_menu',
          }));
          await upsertSupportTicket({
            conversation: latestConversation,
            user,
            phone: message.from,
            patch: {
              status: 'vuelto_menu',
              handoff_active: false,
              closed_at: new Date().toISOString(),
              close_reason: 'volver_menu',
            },
          });
        }
        await sendReply(message.from, reply, channel.phoneNumberId);
      }
      sendJson(res, 200, { ok: true, processed: messages.length });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 404, { error: 'not_found' });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: 'internal_error', message: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`EVINKA Meta webhook escuchando en http://localhost:${PORT}${WEBHOOK_PATH}`);
});
