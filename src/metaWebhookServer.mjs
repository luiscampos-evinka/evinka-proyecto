import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { loadEnv, requiredEnv } from './config.mjs';
import { SupabaseRest } from './supabase.mjs';
import { ChatbotEngine } from './chatbotEngine.mjs';
import { WhatsAppMetaClient } from './whatsappMeta.mjs';
import { extractReceiptDataFromBuffer } from './receiptOcr.mjs';
import { MicrosoftGraphClient } from './microsoftGraph.mjs';
import { patchAdvisorConversation } from './advisorInboxState.mjs';
import { saveConversationMedia } from './advisorMediaStore.mjs';

loadEnv();

const PORT = Number(process.env.PORT || 8787);
const WEBHOOK_PATH = process.env.WHATSAPP_WEBHOOK_PATH || '/meta-webhook';
const VERIFY_TOKEN = requiredEnv('WHATSAPP_VERIFY_TOKEN');

const sb = new SupabaseRest({
  url: requiredEnv('SUPABASE_URL'),
  key: requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
});

const calendar = process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
  ? new MicrosoftGraphClient()
  : null;

const reminderTimers = new Map();
const STATUS_PREFS_PATH = path.resolve(process.cwd(), 'data/status-notification-prefs.json');
const WHATSAPP_ROLE_MAP_PATH = path.resolve(process.cwd(), 'data/whatsapp-role-map.json');

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

function detectSenderRole(phone = '') {
  const normalized = String(phone || '').replace(/[^+\d]/g, '');
  const roleMap = loadWhatsAppRoleMap();
  return roleMap.technicians.includes(normalized) ? 'tecnico' : 'cliente';
}

function roleSourceFor(role) {
  if (role === 'tecnico') return 'whatsapp_role_map';
  if (role === 'asesor') return 'advisor_inbox';
  return 'auto';
}

async function resolveInboundRole(phone) {
  const user = await engine.ensureUser(phone);
  const persistedRole = engine.normalizeUserRole(user?.rol_usuario);
  const inferredRole = persistedRole || detectSenderRole(phone);
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

function bookingReminderText({ ticket, dateLabel, hourLabel, address }) {
  return `Recordatorio de cita EVINKA ⏰\n\nTicket: ${ticket}\nFecha: ${dateLabel}\nHora: ${hourLabel}\nDirección: ${address}\n\n¿Qué deseas hacer con esta cita?`;
}

function scheduleReminder({ to, ticket, dateLabel, hourLabel, address }) {
  const enabled = String(process.env.BOOKING_REMINDER_ENABLED || 'true').toLowerCase();
  if (enabled === 'false' || enabled === '0' || enabled === 'off') return null;
  const afterMinutes = Number(process.env.BOOKING_REMINDER_AFTER_MINUTES || 10);
  const delayMs = Math.max(1, (Number.isFinite(afterMinutes) && afterMinutes > 0 ? afterMinutes : 10) * 60 * 1000);
  if (reminderTimers.has(ticket)) clearTimeout(reminderTimers.get(ticket));
  const timer = setTimeout(async () => {
    try {
      const text = bookingReminderText({ ticket, dateLabel, hourLabel, address });
      await meta.sendButtons(to, {
        body: text,
        footer: 'EVINKA',
        buttons: [
          { id: 'reminder_confirm', title: 'Confirmar' },
          { id: 'reminder_reschedule', title: 'Reprogramar' },
          { id: 'reminder_cancel', title: 'Cancelar' },
        ],
      });
      await engine.activateBookingReminder({ phone: to, ticket, dateLabel, hourLabel, address });
    } catch (error) {
      console.error('booking reminder failed:', error);
    } finally {
      reminderTimers.delete(ticket);
    }
  }, delayMs);
  reminderTimers.set(ticket, timer);
  return { ok: true, delayMs };
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

const engine = new ChatbotEngine({ sb, calendar, reminderScheduler: scheduleReminder, visitPublisher: publishTechVisit });
const meta = new WhatsAppMetaClient({
  accessToken: requiredEnv('WHATSAPP_ACCESS_TOKEN'),
  phoneNumberId: requiredEnv('WHATSAPP_PHONE_NUMBER_ID'),
  appSecret: process.env.META_APP_SECRET,
});

async function sendReply(to, reply) {
  if (!reply) return;
  if (typeof reply === 'string') {
    await meta.sendText(to, reply);
    return;
  }
  if (reply.kind === 'buttons') {
    await meta.sendButtons(to, {
      body: reply.text,
      footer: reply.footer || '',
      buttons: reply.buttons || [],
    });
    return;
  }
  if (reply.kind === 'list') {
    await meta.sendList(to, {
      body: reply.text,
      footer: reply.footer || '',
      buttonText: reply.buttonText || 'Ver opciones',
      sections: reply.sections || [],
    });
    return;
  }
  await meta.sendText(to, reply.text || String(reply));
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

function isResumeBotCommand(text = '') {
  const normalized = String(text || '').trim().toLowerCase();
  return ['menu', 'bot', 'reiniciar', 'volver al bot'].includes(normalized);
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

    if (req.method === 'POST' && url.pathname === WEBHOOK_PATH) {
      const raw = await readRawBody(req);
      const signature = req.headers['x-hub-signature-256'];
      if (!meta.verifySignature(raw, signature)) {
        res.writeHead(401, { 'Content-Type': 'text/plain' });
        res.end('invalid signature');
        return;
      }

      const payload = JSON.parse(raw.toString('utf8') || '{}');
      const messages = meta.extractMessages(payload);
      for (const message of messages) {
        if (rememberMessage(message.id)) continue;
        const { user, role } = await resolveInboundRole(message.from);
        if (role === 'tecnico') {
          await meta.sendText(message.from, 'Tu número está registrado como técnico EVINKA. Para no mezclar clientes con alertas técnicas, el flujo comercial ya no se ejecuta en este chat.');
          continue;
        }
        let reply = null;

        if (message.type === 'interactive' && message.interactive?.id) {
          reply = statusPrefsReply(message.interactive.id, message.from);
        }

        const latestConversation = await engine.getLatestConversation(user);
        const handoffActive = false;
        const inboundText = message.type === 'interactive' && message.interactive?.id
          ? (message.interactive.id || message.text || '')
          : (message.text || '');
        const inboundTitle = message.type === 'interactive'
          ? (message.interactive?.title || message.text || '')
          : (message.text || '');
        const wantsResumeBot = isResumeBotCommand(inboundText) || isResumeBotCommand(inboundTitle);

        if (!reply && handoffActive && !wantsResumeBot) {
          let mediaPayload = null;
          let messageText = message.text || '[mensaje interactivo]';
          let messageType = message.type === 'interactive' ? 'interactive' : 'text';
          if (message.media?.id) {
            try {
              const downloaded = await meta.downloadMedia(message.media.id);
              const stored = saveConversationMedia({
                conversationId: latestConversation.id_conversacion,
                direction: 'inbound',
                fileName: message.media.fileName || 'archivo',
                mimeType: message.media.mimeType || downloaded.mimeType || 'application/octet-stream',
                buffer: downloaded.buffer,
              });
              mediaPayload = {
                mediaUrl: stored.urlPath,
                mimeType: stored.mimeType,
                fileName: stored.fileName,
                fileSize: stored.size,
              };
              messageText = `[${mediaPayload.fileName}] ${message.text || ''}`.trim();
              messageType = (mediaPayload.mimeType || '').startsWith('image/') ? 'image' : 'document';
            } catch (error) {
              console.error('handoff media download failed:', error);
              messageText = `[${message.media.mimeType || message.media.fileName || 'archivo'}] ${message.text || ''}`.trim();
              messageType = (message.media.mimeType || '').startsWith('image/') ? 'image' : 'document';
            }
          }
          await engine.logMessage(
            latestConversation.id_conversacion,
            latestConversation.id_usuario,
            'user',
            messageText,
            {
              tipo_mensaje: messageType,
              payload_crudo: { ...message.raw, ...(mediaPayload || {}) },
            },
          );
          patchAdvisorConversation(latestConversation.id_conversacion, (current) => ({
            ...current,
            internalStatus: current.internalStatus === 'resolved' ? 'open' : (current.internalStatus || 'open'),
            unreadCount: Number(current.unreadCount || 0) + 1,
            lastIncomingAt: new Date().toISOString(),
          }));
          continue;
        }

        if (!reply && message.type === 'interactive' && message.interactive?.id) {
          reply = await engine.handleIncoming({
            phone: message.from,
            text: message.interactive.id,
            payloadCrudo: message.raw,
          });
        }

        if (!reply && message.type === 'text' && message.text) {
          reply = await engine.handleIncoming({
            phone: message.from,
            text: message.text,
            payloadCrudo: message.raw,
          });
        }

        if (!reply && (message.type === 'image' || message.type === 'document') && message.media?.id) {
          let mediaResult = null;
          try {
            const downloaded = await meta.downloadMedia(message.media.id);
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
              payloadCrudo: message.raw,
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
              payloadCrudo: message.raw,
            });
          }
        }

        if (!reply) continue;

        const latestAfterReply = await engine.getLatestConversation(user);
        if (latestAfterReply && (latestAfterReply.estado_conversacion === 'handoff' || latestAfterReply.requiere_handoff)) {
          patchAdvisorConversation(latestAfterReply.id_conversacion, (current) => ({
            ...current,
            internalStatus: current.internalStatus === 'resolved' ? 'new' : (current.internalStatus || 'new'),
            lastIncomingAt: new Date().toISOString(),
          }));
        }
        await sendReply(message.from, reply);
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
