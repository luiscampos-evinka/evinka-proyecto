import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadEnv, requiredEnv } from './config.mjs';
import { appendAccessAuditLog } from './accessAudit.mjs';
import { SupabaseRest } from './supabase.mjs';
import { SupabaseStorage } from './supabaseStorage.mjs';
import { WhatsAppMetaClient } from './whatsappMeta.mjs';
import { patchAdvisorConversation, loadAdvisorState, getAdvisorConversationState } from './advisorInboxState.mjs';
import { resolveConversationMedia, saveConversationMedia } from './advisorMediaStore.mjs';

loadEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceDir = path.resolve(__dirname, '..');
const publicDir = path.join(workspaceDir, 'apps', 'advisor-inbox', 'public');
const dataDir = path.join(workspaceDir, 'apps', 'advisor-inbox', 'data');
const cotizadorDataDir = path.join(workspaceDir, 'apps', 'cotizador-web', 'data');
const usersFile = path.join(cotizadorDataDir, 'users.json');
const techVisitsFile = path.join(cotizadorDataDir, 'tech-visits.json');
const quotesFile = path.join(cotizadorDataDir, 'quotes.json');
const cotizadorSessionsFile = path.join(cotizadorDataDir, 'sessions.json');
const sessionsFile = path.join(dataDir, 'sessions.json');
const COOKIE_NAME = 'evinka_advisor_session';
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 12;
const PORT = Number(process.env.ADVISOR_INBOX_PORT || 14400);
const PHONE_DISPLAY_COUNTRY = process.env.ADVISOR_INBOX_PHONE_COUNTRY || '51';
const MEDIA_MAX_BYTES = 14 * 1024 * 1024;
const META_WEBHOOK_INTERNAL_URL = process.env.META_WEBHOOK_INTERNAL_URL || 'http://127.0.0.1:8787';
const COTIZADOR_WEB_URL = process.env.COTIZADOR_WEB_URL || 'https://cotizador.evinka.net';
const ADVISOR_FORWARD_JENY_PHONE = normalizePhone(process.env.ADVISOR_FORWARD_JENY_PHONE || '+51 939 882 508');
const ADVISOR_FORWARD_JENY_LABEL = process.env.ADVISOR_FORWARD_JENY_LABEL || 'Jeny';
const CUSTOMER_IDLE_CLOSE_AFTER_MINUTES = Number(process.env.ADVISOR_CUSTOMER_IDLE_CLOSE_MINUTES || 30);
const CUSTOMER_IDLE_CLOSE_AFTER_MS = Math.max(1, (Number.isFinite(CUSTOMER_IDLE_CLOSE_AFTER_MINUTES) && CUSTOMER_IDLE_CLOSE_AFTER_MINUTES > 0 ? CUSTOMER_IDLE_CLOSE_AFTER_MINUTES : 10) * 60 * 1000);
const customerIdleCloseTimers = new Map();
const storage = new SupabaseStorage({
  url: requiredEnv('SUPABASE_URL'),
  key: requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
});

function isMissingSupportTicketsTable(error) {
  const message = String(error?.message || error || '');
  return message.includes('public.support_tickets')
    || message.includes("table 'public.support_tickets'")
    || message.includes('relation "public.support_tickets" does not exist')
    || message.includes('PGRST205');
}

async function upsertSupportTicket({ conversation = null, phone = '', patch = {} } = {}) {
  const normalizedPhone = normalizePhone(phone).replace(/^\+/, '');
  const conversationId = conversation?.id_conversacion || null;
  if (!normalizedPhone && !conversationId) return null;
  try {
    const clauses = [];
    if (conversationId) clauses.push(`conversation_id.eq.${conversationId}`);
    if (normalizedPhone) clauses.push(`phone.eq.${normalizedPhone}`);
    const query = clauses.length > 1 ? `or=(${clauses.join(',')})&select=*` : `${clauses[0]}&select=*`;
    const rows = await sb.select('support_tickets', query);
    const existing = Array.isArray(rows) ? rows[0] : null;
    const payload = {
      conversation_id: conversationId,
      client_id: conversation?.id_usuario || existing?.client_id || null,
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
const BOT_VISITS_API_KEY = process.env.EVINKA_BOT_VISITS_API_KEY || 'EvinkaBotVisits#2026';

const sb = new SupabaseRest({
  url: requiredEnv('SUPABASE_URL'),
  key: requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
});

fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(sessionsFile)) fs.writeFileSync(sessionsFile, '{}\n');

const app = express();
app.use(express.json({ limit: '25mb' }));
app.use(express.static(publicDir));

function readJSON(file, fallback) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function advisorLeadContext(summary = '') {
  try {
    const parsed = JSON.parse(String(summary || '{}'));
    if (parsed?.kind === 'advisor_lead') return String(parsed.comentario || '').trim();
  } catch {}
  return '';
}

function readUsers() {
  return readJSON(usersFile, []).map((user) => ({
    ...user,
    role: String(user.role || 'tech').toLowerCase(),
    status: String(user.status || 'active').toLowerCase(),
    allowedCountries: Array.isArray(user.allowedCountries)
      ? user.allowedCountries.map((item) => String(item || '').trim().toUpperCase()).filter(Boolean)
      : [],
  }));
}

function parseCookie(header = '') {
  return Object.fromEntries(
    String(header || '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf('=');
        return idx === -1 ? [part, ''] : [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))];
      }),
  );
}

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    employeeCode: user.employeeCode || '',
    role: user.role,
    status: user.status,
    allowedCountries: Array.isArray(user.allowedCountries) ? user.allowedCountries : [],
  };
}

function normalizeEmployeeCode(value = '') {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

function isAdminRole(user = {}) {
  return String(user?.role || '').trim().toLowerCase() === 'admin';
}

function hashPasswordVerify(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

function readSessions() {
  const sessions = readJSON(sessionsFile, {});
  const now = Date.now();
  let changed = false;
  for (const [token, session] of Object.entries(sessions)) {
    if (!session?.expiresAt || new Date(session.expiresAt).getTime() <= now) {
      delete sessions[token];
      changed = true;
    }
  }
  if (changed) writeJSON(sessionsFile, sessions);
  return sessions;
}

function writeSessions(sessions) {
  writeJSON(sessionsFile, sessions);
}

function readExternalSessions(file) {
  const sessions = readJSON(file, {});
  const now = Date.now();
  return Object.fromEntries(
    Object.entries(sessions).filter(([, session]) => session?.expiresAt && new Date(session.expiresAt).getTime() > now),
  );
}

function userFromCotizadorSessionToken(token) {
  const normalizedToken = String(token || '').trim();
  if (!normalizedToken) return null;
  const sessions = readExternalSessions(cotizadorSessionsFile);
  const session = sessions[normalizedToken];
  if (!session?.userId) return null;
  return readUsers().find((item) => item.id === session.userId && item.status === 'active') || null;
}

function createAdvisorSessionForUser(user) {
  const sessions = readSessions();
  const token = crypto.randomBytes(24).toString('hex');
  sessions[token] = {
    userId: user.id,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString(),
    source: 'cotizador_bootstrap',
  };
  writeSessions(sessions);
  return token;
}

function sessionCookie(token) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_MAX_AGE_MS / 1000)}`;
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',').map((item) => item.trim()).filter(Boolean)[0];
  return forwarded || req.ip || req.socket?.remoteAddress || '';
}

function authOptional(req, _res, next) {
  const token = parseCookie(req.headers.cookie || '')[COOKIE_NAME];
  if (!token) return next();
  const sessions = readSessions();
  const session = sessions[token];
  if (!session) return next();
  const user = readUsers().find((item) => item.id === session.userId && item.status === 'active');
  if (!user) {
    delete sessions[token];
    writeSessions(sessions);
    return next();
  }
  req.user = safeUser(user);
  req.sessionToken = token;
  next();
}

function authRequired(req, res, next) {
  authOptional(req, res, () => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    next();
  });
}

function conversationStatus(conv, state) {
  if (conv.estado_conversacion === 'handoff' || conv.paso_actual === 'handoff_asesor' || conv.requiere_handoff === true) {
    return state?.internalStatus === 'open' ? 'open' : 'new';
  }
  if (state?.internalStatus) return state.internalStatus;
  if (conv.estado_conversacion === 'handoff') return 'new';
  if (conv.estado_conversacion === 'closed') return 'resolved';
  return 'open';
}

function normalizePhone(value = '') {
  return String(value || '').replace(/[^\d+]/g, '');
}

function phonePretty(value = '') {
  const raw = normalizePhone(value);
  if (!raw) return '-';
  const digits = raw.replace(/^\+/, '');
  if (digits.startsWith(PHONE_DISPLAY_COUNTRY) && digits.length >= 11) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return raw.startsWith('+') ? raw : `+${digits}`;
}

function userPhoneFromConversation(conversation) {
  const rawUserId = String(conversation?.id_usuario || '').trim();
  const normalized = rawUserId.replace(/^wco_/, '').replace(/^whatsapp_/, '');
  const digits = normalizePhone(normalized).replace(/^\+/, '');
  if (/^\d{8,15}$/.test(digits)) {
    return `+${digits}`;
  }
  return '';
}

function inferCountryFromPhone(phone = '') {
  const digits = normalizePhone(phone).replace(/^\+/, '');
  if (digits.startsWith('57') || /^3\d{9}$/.test(digits)) return 'CO';
  if (digits.startsWith('51') || /^9\d{8}$/.test(digits)) return 'PE';
  return null;
}

function inferConversationCountry({ conversation = null, user = null, profile = null } = {}) {
  const userId = String(conversation?.id_usuario || user?.id_usuario || '').trim();
  if (userId.startsWith('wco_')) return 'CO';
  const province = String(profile?.provincia_instalacion || profile?.provincia_recibo || '').trim().toUpperCase();
  const district = String(profile?.distrito_instalacion || profile?.distrito_recibo || '').trim().toUpperCase();
  if (province.includes('COLOMBIA')) return 'CO';
  if (province.includes('PERU') || province.includes('PERÚ')) return 'PE';
  const combined = `${province} ${district}`;
  if (/(BOGOT|MEDELL|CALI|USAQU|SUBA|CHAPINERO|ENGATIV|FONTIBON|KENNEDY|MOSQUERA|CHIA|SABANETA|ENVIGADO|JAMUNDI|SOACHA)/.test(combined)) return 'CO';
  return inferCountryFromPhone(userPhoneFromConversation(conversation) || user?.telefono_principal || '');
}

function normalizeCountryScope(value = '') {
  const normalized = String(value || '').trim().toUpperCase();
  return ['PE', 'CO', 'ALL'].includes(normalized) ? normalized : '';
}

function userAllowsCountry(user, countryCode) {
  const allowed = Array.isArray(user?.allowedCountries) ? user.allowedCountries : [];
  if (!allowed.length || allowed.includes('ALL')) return true;
  return allowed.includes(String(countryCode || '').toUpperCase());
}

function ensureConversationAccess(user, conversationLike) {
  if (userAllowsCountry(user, conversationLike?.countryCode)) return true;
  const error = new Error('Sin acceso a este caso.');
  error.statusCode = 403;
  throw error;
}

function buildWhatsAppChannels() {
  const channels = [];
  channels.push({
    key: 'default',
    accessToken: requiredEnv('WHATSAPP_ACCESS_TOKEN'),
    phoneNumberId: requiredEnv('WHATSAPP_PHONE_NUMBER_ID'),
  });
  if (process.env.WHATSAPP_ACCESS_TOKEN_CO && process.env.WHATSAPP_PHONE_NUMBER_ID_CO) {
    channels.push({
      key: 'co',
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN_CO,
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID_CO,
    });
  }
  return channels;
}

const whatsappChannels = buildWhatsAppChannels();
const defaultWhatsAppChannel = whatsappChannels[0];
const metaByChannelKey = new Map(
  whatsappChannels.map((channel) => [
    channel.key,
    new WhatsAppMetaClient({
      accessToken: channel.accessToken,
      phoneNumberId: channel.phoneNumberId,
      appSecret: process.env.META_APP_SECRET,
    }),
  ]),
);

function resolveConversationChannel(conversation = null, detailConversation = null) {
  const countryCode = detailConversation?.countryCode || inferConversationCountry({ conversation });
  if (countryCode === 'CO' && metaByChannelKey.has('co')) return 'co';
  return defaultWhatsAppChannel.key;
}

function metaForConversation(conversation = null, detailConversation = null) {
  return metaByChannelKey.get(resolveConversationChannel(conversation, detailConversation)) || metaByChannelKey.get(defaultWhatsAppChannel.key);
}

function normalizeDisplayName(value = '') {
  const cleaned = String(value || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  if (/^\+?\d[\d\s()-]{6,}$/.test(cleaned)) return '';
  if (cleaned.includes('@')) return '';
  if (/^cliente\s+evinka$/i.test(cleaned)) return '';
  return cleaned.slice(0, 80);
}

function profileNameFromThread(messages = []) {
  const thread = Array.isArray(messages) ? [...messages].reverse() : [];
  for (const message of thread) {
    const payload = message?.payload_crudo || null;
    const sharedContact = Array.isArray(payload?.contacts) ? payload.contacts[0] : null;
    const profileName = normalizeDisplayName(
      payload?.profileName
      || payload?.contactName
      || sharedContact?.name?.formatted_name
      || [sharedContact?.name?.first_name, sharedContact?.name?.last_name].filter(Boolean).join(' ')
      || ''
    );
    if (profileName) return profileName;
  }
  return '';
}

function userNameFromData(user = null, profile = null, messages = [], phone = '') {
  const candidates = [
    profile?.nombre_receptor,
    user?.nombre_visible,
    user?.nombre_usuario,
    profileNameFromThread(messages),
  ];
  for (const candidate of candidates) {
    const normalized = normalizeDisplayName(candidate);
    if (normalized) return normalized;
  }
  const prettyPhone = phonePretty(phone || user?.telefono_principal || '');
  return prettyPhone !== '-' ? `Cliente ${prettyPhone}` : 'Cliente EVINKA';
}

function interactiveSummaryFromPayload(payload = null) {
  if (!payload || typeof payload !== 'object') return { title: null, id: null };
  const button = payload.interactive?.button_reply || null;
  const list = payload.interactive?.list_reply || null;
  const title = String(
    payload.interactiveTitle
    || button?.title
    || list?.title
    || ''
  ).trim();
  const id = String(
    payload.interactiveId
    || button?.id
    || list?.id
    || ''
  ).trim();
  return {
    title: title || null,
    id: id || null,
  };
}

function fallbackMessageText(message = null) {
  const payload = message?.payload_crudo || null;
  const type = String(payload?.type || message?.tipo_mensaje || '').trim().toLowerCase();
  if (String(message?.contenido || '').trim() && String(message?.contenido || '').trim() !== '[mensaje interactivo]') {
    return String(message.contenido || '').trim();
  }
  if (type === 'interactive') {
    const interactive = interactiveSummaryFromPayload(payload);
    return interactive.title || '[opción interactiva]';
  }
  if (type === 'contacts') {
    const first = Array.isArray(payload?.contacts) ? payload.contacts[0] : null;
    const name = String(first?.name?.formatted_name || [first?.name?.first_name, first?.name?.last_name].filter(Boolean).join(' ') || '').trim();
    const phone = String(first?.phones?.[0]?.phone || first?.phones?.[0]?.wa_id || '').trim();
    return ['Contacto compartido', name, phone].filter(Boolean).join('\n') || '[contacto compartido]';
  }
  if (type === 'location') {
    const location = payload?.location || {};
    const name = String(location?.name || payload?.locationName || '').trim();
    const address = String(location?.address || payload?.locationAddress || '').trim();
    const coords = payload?.latitude != null && payload?.longitude != null ? `${payload.latitude}, ${payload.longitude}` : '';
    return ['Ubicación compartida', name, address, coords].filter(Boolean).join('\n') || '[ubicación compartida]';
  }
  if (type === 'audio') return '[audio]';
  if (type === 'video') return '[video]';
  if (type === 'sticker') return '[sticker]';
  return String(message?.contenido || '').trim();
}

function isoTimeValue(value = null) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function sortByNewestConversations(conversations = []) {
  return [...conversations].sort((a, b) => (
    isoTimeValue(b?.ultimo_mensaje_en || b?.actualizado_en || b?.creado_en)
    - isoTimeValue(a?.ultimo_mensaje_en || a?.actualizado_en || a?.creado_en)
  ));
}

function sortByNewestRecords(items = [], dateFields = ['actualizado_en', 'updated_at', 'creado_en', 'created_at']) {
  return [...items].sort((a, b) => {
    const left = dateFields.map((field) => b?.[field]).find(Boolean) || 0;
    const right = dateFields.map((field) => a?.[field]).find(Boolean) || 0;
    return isoTimeValue(left) - isoTimeValue(right);
  });
}

function mergeProfiles(profiles = []) {
  const sorted = sortByNewestRecords(profiles, ['actualizado_en', 'created_at', 'creado_en']);
  if (!sorted.length) return null;
  const merged = {};
  for (const profile of sorted) {
    for (const [key, value] of Object.entries(profile || {})) {
      if (merged[key] == null || merged[key] === '') {
        if (value != null && value !== '') merged[key] = value;
      }
    }
  }
  return { ...sorted[0], ...merged };
}

function conversationGroupKey(conversation = null, user = null) {
  return String(conversation?.id_usuario || user?.id_usuario || userPhoneFromConversation(conversation) || user?.telefono_principal || '').trim();
}

function latestMessageFromThread(thread = [], fallbackConversation = null) {
  return thread[thread.length - 1] || null || fallbackConversation;
}

function mergedUpdatedAt(conversations = [], localStates = []) {
  const values = [
    ...conversations.map((item) => item?.ultimo_mensaje_en || item?.actualizado_en || item?.creado_en),
    ...localStates.map((item) => item?.updatedAt),
  ].filter(Boolean);
  return values.sort((a, b) => isoTimeValue(b) - isoTimeValue(a))[0] || null;
}

function advisorLabel(user) {
  return user?.name || user?.email || 'Asesor EVINKA';
}

function customerIdleCloseText() {
  return 'Cerramos esta atención por ahora para no dejar el caso abierto. Si deseas continuar, escribe ASESOR y retomamos tu caso.';
}

function clearCustomerIdleCloseTimer(conversationId = '') {
  const key = String(conversationId || '').trim();
  if (!key) return;
  const timer = customerIdleCloseTimers.get(key);
  if (timer) clearTimeout(timer);
  customerIdleCloseTimers.delete(key);
}

function scheduleCustomerIdleClose({ conversationId = '', conversation = null, detailConversation = null, phone = '', advisor = null } = {}) {
  const key = String(conversationId || '').trim();
  if (!key || !phone) return null;
  clearCustomerIdleCloseTimer(key);
  const timer = setTimeout(async () => {
    try {
      const rows = await sb.select('conversaciones', `id_conversacion=eq.${encodeURIComponent(key)}&select=*`);
      const currentConversation = rows[0] || conversation || null;
      const state = getAdvisorConversationState(key) || {};
      if (!currentConversation) return;
      const stillOpen = currentConversation.estado_conversacion === 'handoff' || currentConversation.requiere_handoff === true || currentConversation.paso_actual === 'handoff_asesor' || currentConversation.paso_actual === 'esperando_timeout_asesor';
      if (!stillOpen) return;

      const lastAgentAtMs = new Date(state.lastAgentMessageAt || 0).getTime();
      const lastCustomerAtMs = new Date(state.lastCustomerMessageAt || currentConversation.ultimo_mensaje_en || currentConversation.actualizado_en || currentConversation.creado_en || 0).getTime();
      if (!Number.isFinite(lastAgentAtMs) || lastAgentAtMs <= 0) return;
      if (Number.isFinite(lastCustomerAtMs) && lastCustomerAtMs >= lastAgentAtMs) return;

      const idleMs = Date.now() - lastAgentAtMs;
      if (idleMs < CUSTOMER_IDLE_CLOSE_AFTER_MS) {
        scheduleCustomerIdleClose({
          conversationId: key,
          conversation: currentConversation,
          detailConversation,
          phone,
          advisor,
        });
        return;
      }

      const metaClient = metaForConversation(currentConversation, detailConversation || currentConversation);
      const text = customerIdleCloseText();
      await metaClient.sendText(phone, text);
      await logAdvisorMessage(currentConversation, text, advisor || { id: 'system', name: 'EVINKA', email: 'system@evinka.local' });
      const closedAt = new Date().toISOString();
      const patchedConversation = await patchConversation(key, {
        estado_conversacion: 'closed',
        requiere_handoff: false,
        paso_actual: 'menu_principal',
        subestado_flujo: 'cerrado_por_silencio_cliente_post_asesor',
        motivo_handoff: null,
        cerrada_en: closedAt,
        ultimo_mensaje_en: closedAt,
      });
      patchAdvisorConversation(key, (current) => ({
        ...current,
        internalStatus: 'resolved',
        handoffActive: false,
        supportStatus: 'cerrado',
        resolvedBy: current.resolvedBy || 'system_idle_close',
        resolvedByLabel: current.resolvedByLabel || 'Cierre automático',
        resolvedAt: closedAt,
        autoClosedAt: closedAt,
        autoCloseReason: 'customer_idle_after_advisor_reply',
        unreadCount: 0,
      }));
      await upsertSupportTicket({ conversation: patchedConversation || currentConversation, phone, patch: {
        status: 'cerrado',
        handoff_active: false,
        closed_at: closedAt,
        close_reason: 'customer_idle_after_advisor_reply',
        last_agent_message_at: new Date(lastAgentAtMs).toISOString(),
      } });
      await logSystemMessage(currentConversation, 'Caso cerrado automáticamente por falta de respuesta del cliente tras atención humana.', {
        systemAction: 'auto_close_customer_idle_after_advisor_reply',
        timeoutMinutes: CUSTOMER_IDLE_CLOSE_AFTER_MINUTES,
        advisorId: advisor?.id || null,
        advisorName: advisorLabel(advisor || {}),
      });
    } catch (error) {
      console.error('customer idle auto-close failed:', error);
    } finally {
      customerIdleCloseTimers.delete(key);
    }
  }, CUSTOMER_IDLE_CLOSE_AFTER_MS);
  customerIdleCloseTimers.set(key, timer);
  return { ok: true, delayMs: CUSTOMER_IDLE_CLOSE_AFTER_MS };
}

function trimForwardText(value = '', max = 900) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function buildForwardIntro(conversation = {}) {
  const parts = [
    `Reenviado a ${ADVISOR_FORWARD_JENY_LABEL} desde EVINKA`,
    conversation?.customerName || '',
    conversation?.phonePretty || conversation?.phone || '',
  ].filter(Boolean);
  return parts.join(' · ');
}

async function ensureInternalWhatsAppConversation({ phone, label, advisor = null } = {}) {
  const normalizedPhone = normalizePhone(phone).replace(/^\+/, '');
  if (!normalizedPhone) throw new Error('Falta el teléfono del chat interno.');
  const userId = `whatsapp_${normalizedPhone}`;
  const visibleName = String(label || normalizedPhone).trim() || normalizedPhone;

  const existingUsers = await sb.select('usuarios', `id_usuario=eq.${encodeURIComponent(userId)}&select=*`);
  let user = Array.isArray(existingUsers) ? existingUsers[0] : null;
  if (!user) {
    const createdUsers = await sb.insert('usuarios', {
      id_usuario: userId,
      nombre_visible: visibleName,
      nombre_usuario: visibleName,
      correo_electronico: '',
    });
    user = Array.isArray(createdUsers) ? createdUsers[0] : { id_usuario: userId, nombre_visible: visibleName, nombre_usuario: visibleName };
  } else if (normalizeDisplayName(user.nombre_visible || '') !== normalizeDisplayName(visibleName)) {
    const updatedUsers = await sb.update('usuarios', `id_usuario=eq.${encodeURIComponent(userId)}`, {
      nombre_visible: visibleName,
      nombre_usuario: visibleName,
    });
    user = Array.isArray(updatedUsers) && updatedUsers[0]
      ? updatedUsers[0]
      : { ...user, nombre_visible: visibleName, nombre_usuario: visibleName };
  }

  const rows = await sb.select('conversaciones', `id_usuario=eq.${encodeURIComponent(userId)}&canal=eq.whatsapp&order=creado_en.desc&limit=1`);
  let conversation = Array.isArray(rows) ? rows[0] : null;
  if (!conversation) {
    const now = new Date().toISOString();
    const created = await sb.insert('conversaciones', {
      id_usuario: userId,
      canal: 'whatsapp',
      estado_conversacion: 'handoff',
      requiere_handoff: true,
      paso_actual: 'chat_caja',
      subestado_flujo: 'interno_jeny',
      motivo_handoff: 'Caja / recepción de boletas',
      intencion_principal: 'otro',
      ultimo_mensaje_en: now,
      resumen: JSON.stringify({ kind: 'internal_advisor_chat', internalContact: 'jeny', phone: normalizedPhone }),
    });
    conversation = Array.isArray(created) ? created[0] : null;
  }

  patchAdvisorConversation(conversation?.id_conversacion || userId, (current) => ({
    ...current,
    internalStatus: 'open',
    handoffActive: true,
    supportStatus: 'tomado',
    assignedTo: current.assignedTo || advisor?.id || null,
    assignedToLabel: current.assignedToLabel || (advisor ? advisorLabel(advisor) : null),
    assignedAt: current.assignedAt || new Date().toISOString(),
    unreadCount: 0,
    tags: [...new Set([...(Array.isArray(current.tags) ? current.tags : []), 'interno', 'caja'])],
  }));

  return conversation;
}

function parseStoredMediaRef(mediaUrl = '') {
  const value = String(mediaUrl || '').trim();
  if (!value) return null;
  const storagePrefix = '/api/inbox/storage-media/';
  if (value.startsWith(storagePrefix)) {
    const relative = value.slice(storagePrefix.length);
    const slash = relative.indexOf('/');
    if (slash === -1) return null;
    const bucket = decodeURIComponent(relative.slice(0, slash));
    const objectPath = relative
      .slice(slash + 1)
      .split('/')
      .filter(Boolean)
      .map((part) => decodeURIComponent(part))
      .join('/');
    return bucket && objectPath ? { kind: 'storage', bucket, objectPath } : null;
  }
  const localPrefix = '/api/inbox/media/';
  if (value.startsWith(localPrefix)) {
    return { kind: 'local', relativePath: decodeURIComponent(value.slice(localPrefix.length)) };
  }
  return null;
}

async function loadBufferFromPayload(payload = {}, fallbackMimeType = 'application/octet-stream') {
  if (payload?.storageBucket && payload?.storagePath) {
    const downloaded = await storage.downloadObject(payload.storageBucket, payload.storagePath);
    return {
      buffer: downloaded.buffer,
      mimeType: downloaded.mimeType || payload.mimeType || fallbackMimeType,
      fileSize: downloaded.fileSize || Buffer.byteLength(downloaded.buffer),
    };
  }

  if (payload?.localMediaPath) {
    const absPath = resolveConversationMedia(payload.localMediaPath);
    if (absPath) {
      const buffer = fs.readFileSync(absPath);
      return {
        buffer,
        mimeType: payload.mimeType || fallbackMimeType,
        fileSize: Buffer.byteLength(buffer),
      };
    }
  }

  const parsed = parseStoredMediaRef(payload?.mediaUrl || '');
  if (parsed?.kind === 'storage') {
    const downloaded = await storage.downloadObject(parsed.bucket, parsed.objectPath);
    return {
      buffer: downloaded.buffer,
      mimeType: downloaded.mimeType || payload.mimeType || fallbackMimeType,
      fileSize: downloaded.fileSize || Buffer.byteLength(downloaded.buffer),
    };
  }

  if (parsed?.kind === 'local') {
    const absPath = resolveConversationMedia(parsed.relativePath);
    if (absPath) {
      const buffer = fs.readFileSync(absPath);
      return {
        buffer,
        mimeType: payload.mimeType || fallbackMimeType,
        fileSize: Buffer.byteLength(buffer),
      };
    }
  }

  return null;
}

async function forwardMessageToJeny({ dbMessage, detailConversation, advisor }) {
  const metaClient = metaForConversation({ id_usuario: detailConversation?.phone || '' }, detailConversation);
  const payload = dbMessage?.payload_crudo || {};
  const intro = buildForwardIntro(detailConversation);
  const rawText = trimForwardText(fallbackMessageText(dbMessage) || '');
  const isMedia = Boolean(payload?.mediaUrl || payload?.storageBucket || payload?.storagePath || payload?.localMediaPath);

  await metaClient.sendText(ADVISOR_FORWARD_JENY_PHONE, intro);

  if (isMedia) {
    const loaded = await loadBufferFromPayload(payload, payload?.mimeType || 'application/octet-stream');
    if (!loaded?.buffer?.length) {
      throw new Error('No encontré el archivo original para reenviarlo.');
    }
    const fileName = String(payload?.fileName || dbMessage?.contenido || 'archivo').trim() || 'archivo';
    const uploaded = await metaClient.uploadMedia({
      buffer: loaded.buffer,
      mimeType: loaded.mimeType || payload?.mimeType || 'application/octet-stream',
      fileName,
    });
    const mediaId = uploaded?.id;
    if (!mediaId) {
      throw new Error('No pude subir el archivo a WhatsApp para reenviarlo.');
    }
    const kind = mediaKindFromMime(loaded.mimeType || payload?.mimeType || 'application/octet-stream');
    const caption = rawText ? trimForwardText(rawText, 900) : '';
    if (kind === 'image') {
      await metaClient.sendImage(ADVISOR_FORWARD_JENY_PHONE, { mediaId, caption });
    } else {
      await metaClient.sendDocument(ADVISOR_FORWARD_JENY_PHONE, { mediaId, caption, fileName });
    }
  } else {
    const text = rawText || '[mensaje sin texto visible]';
    await metaClient.sendText(ADVISOR_FORWARD_JENY_PHONE, text);
  }

  return {
    forwardedTo: ADVISOR_FORWARD_JENY_PHONE,
    forwardedLabel: ADVISOR_FORWARD_JENY_LABEL,
    forwardedBy: advisorLabel(advisor),
    messageId: dbMessage?.id_mensaje || null,
    isMedia,
  };
}

function findRelatedVisit(conversation) {
  const visits = readJSON(techVisitsFile, []);
  const ref = String(conversation?.id || '').trim();
  if (!ref) return null;
  return visits.find((item) => String(item.reference || '').trim() === ref) || null;
}

function findRelatedQuote(conversation) {
  const quotes = readJSON(quotesFile, []);
  const visit = findRelatedVisit(conversation);
  if (visit?.quoteId) {
    const byVisit = quotes.find((item) => String(item.id || '').trim() === String(visit.quoteId || '').trim());
    if (byVisit) return byVisit;
  }
  const email = String(conversation?.email || '').trim().toLowerCase();
  if (email) {
    const byEmail = quotes.find((item) => String(item.email || '').trim().toLowerCase() === email);
    if (byEmail) return byEmail;
  }
  return null;
}

async function createAdvisorVisit(dbConversation, conversation, req, body = {}) {
  const clientName = String(body.receiverName || body.clientName || conversation.customerName || '').trim();
  const clientAddress = String(body.clientAddress || conversation.installationAddress || conversation.receiptAddress || '').trim();
  const receiptAddress = String(body.receiptAddress || '').trim();
  const receiptDistrict = String(body.receiptDistrict || '').trim();
  const receiptProvince = String(body.receiptProvince || '').trim();
  const receiptPower = String(body.receiptPower || '').trim();
  const receiverDocument = String(body.receiverDocument || '').trim();
  const receiverPhone = String(body.receiverPhone || conversation.phone || '').trim();
  const receiverEmail = String(body.receiverEmail || conversation.email || '').trim();
  const vehicleBrand = String(body.vehicleBrand || '').trim();
  const vehicleModel = String(body.vehicleModel || '').trim();
  const vehicleType = String(body.vehicleType || '').trim();
  if (!clientName || !clientAddress) {
    throw new Error('Faltan nombre o dirección exacta de instalación para crear la visita.');
  }
  if (!receiptAddress || !receiptDistrict || !receiptProvince || !receiptPower) {
    throw new Error('Completa los datos manuales del recibo como lo hace el bot de Perú.');
  }
  if (!receiverDocument || !receiverPhone || !receiverEmail) {
    throw new Error('Completa los datos de la persona que recibirá la visita.');
  }
  if (!vehicleBrand || !vehicleModel || !vehicleType) {
    throw new Error('Completa los datos del vehículo antes de crear la visita.');
  }

  const availabilityResponse = await fetch(`${META_WEBHOOK_INTERNAL_URL.replace(/\/$/, '')}/api/internal/visit-availability`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-evinka-bot-key': BOT_VISITS_API_KEY,
    },
    body: JSON.stringify({
      countryCode: String(conversation.countryCode || 'PE').trim().toUpperCase(),
      clientPhone: String(conversation.phone || '').trim(),
      clientAddress,
      district: receiptDistrict || String(conversation.district || '').trim(),
      province: receiptProvince || String(conversation.province || '').trim(),
      scheduledAt: String(body.scheduledAt || '').trim(),
      scheduledDate: String(body.scheduledDate || '').trim(),
      exactTime: String(body.exactTime || '').trim(),
    }),
  });
  const availability = await availabilityResponse.json().catch(() => ({}));
  if (!availabilityResponse.ok) {
    throw new Error('No pude validar la disponibilidad de agenda con la lógica del bot.');
  }
  if (!availability?.available) {
    throw new Error(availability?.message || 'Ese horario no está disponible según la lógica de bloqueos del bot.');
  }

  const payload = {
    conversationId: String(conversation.id || '').trim(),
    countryCode: String(conversation.countryCode || 'PE').trim().toUpperCase(),
    source: 'advisor_inbox',
    type: 'visita_tecnica',
    status: 'agendada',
    clientName,
    clientPhone: receiverPhone,
    clientDocument: receiverDocument,
    clientEmail: receiverEmail,
    clientAddress,
    scheduledAt: String(body.scheduledAt || '').trim(),
    scheduledDate: String(body.scheduledDate || '').trim(),
    exactTime: String(body.exactTime || '').trim(),
    timeWindow: String(body.timeWindow || '').trim(),
    receiptAddress,
    receiptDistrict,
    receiptProvince,
    receiptPower,
    receiverRole: String(body.receiverRole || '').trim() || 'self',
    receiverName: clientName,
    receiverDocument,
    receiverPhone,
    receiverEmail,
    vehicleBrand,
    vehicleModel,
    vehicleType,
    notes: [
      'Captura manual alineada al flujo del chatbot PE:',
      '',
      'Datos del recibo',
      `- Dirección del suministro: ${receiptAddress}`,
      `- Distrito: ${receiptDistrict}`,
      `- Provincia: ${receiptProvince}`,
      `- Potencia contratada: ${receiptPower}`,
      '',
      'Persona que recibirá la visita',
      `- Modalidad: ${String(body.receiverRole || '').trim() === 'other' ? 'Otra persona' : 'Cliente / titular del chat'}`,
      `- Nombre completo: ${clientName}`,
      `- Documento: ${receiverDocument}`,
      `- Teléfono: ${receiverPhone}`,
      `- Correo: ${receiverEmail}`,
      '',
      'Instalación',
      `- Dirección exacta: ${clientAddress}`,
      '',
      'Vehículo',
      `- Marca: ${vehicleBrand}`,
      `- Modelo: ${vehicleModel}`,
      `- Tipo: ${vehicleType}`,
      ...(String(body.notes || conversation.internalNote || conversation.handoffReason || '').trim()
        ? ['', 'Notas adicionales', String(body.notes || conversation.internalNote || conversation.handoffReason || '').trim()]
        : []),
    ].join('\n').trim(),
    reference: String(conversation.id || '').trim(),
    assignedTechEmail: String(body.assignedTechEmail || '').trim(),
    assignedTechName: String(body.assignedTechName || '').trim(),
  };

  const response = await fetch(`${META_WEBHOOK_INTERNAL_URL.replace(/\/$/, '')}/api/internal/advisor-book-visit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-evinka-bot-key': BOT_VISITS_API_KEY,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'No pude crear la visita técnica.');
  }

  const state = patchAdvisorConversation(conversation.id, (current) => ({
    ...current,
    nextAction: current.nextAction || 'agendar_visita',
    lastVisitId: data.visit?.id || current.lastVisitId || '',
    lastVisitCreatedAt: new Date().toISOString(),
  }));

  await logSystemMessage(dbConversation, `${advisorLabel(req.user)} ${data.created ? 'creó' : 'actualizó'} una visita técnica.`, {
    systemAction: 'create_visit',
    advisorId: req.user.id,
    advisorName: advisorLabel(req.user),
    visitId: data.visit?.id || null,
    created: Boolean(data.created),
  });

  return { ...data, state };
}

async function fetchAdvisorVisitAvailability(conversation, body = {}) {
  const clientAddress = String(body.clientAddress || conversation.installationAddress || conversation.receiptAddress || '').trim();
  const response = await fetch(`${META_WEBHOOK_INTERNAL_URL.replace(/\/$/, '')}/api/internal/visit-availability`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-evinka-bot-key': BOT_VISITS_API_KEY,
    },
    body: JSON.stringify({
      countryCode: String(conversation.countryCode || 'PE').trim().toUpperCase(),
      clientPhone: String(conversation.phone || '').trim(),
      clientAddress,
      district: String(conversation.district || '').trim(),
      province: String(conversation.province || '').trim(),
      scheduledAt: String(body.scheduledAt || '').trim(),
      scheduledDate: String(body.scheduledDate || '').trim(),
      exactTime: String(body.exactTime || '').trim(),
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || 'No pude consultar la disponibilidad del bot.');
  }
  return data;
}

async function fetchAdvisorVisitOptions(conversation, body = {}) {
  const clientAddress = String(body.clientAddress || conversation.installationAddress || conversation.receiptAddress || '').trim();
  const response = await fetch(`${META_WEBHOOK_INTERNAL_URL.replace(/\/$/, '')}/api/internal/visit-options`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-evinka-bot-key': BOT_VISITS_API_KEY,
    },
    body: JSON.stringify({
      countryCode: String(conversation.countryCode || 'PE').trim().toUpperCase(),
      clientPhone: String(conversation.phone || '').trim(),
      clientAddress,
      district: String(body.district || conversation.district || '').trim(),
      province: String(body.province || conversation.province || '').trim(),
      scheduledDate: String(body.scheduledDate || '').trim(),
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || 'No pude consultar los días y horarios del bot.');
  }
  return data;
}

function mediaKindFromMime(mimeType = '') {
  return String(mimeType || '').startsWith('image/') ? 'image' : 'document';
}

function humanizeSendError(error, { kind = 'message' } = {}) {
  const message = String(error?.message || '');
  const lower = message.toLowerCase();
  if (message.includes('131030') || lower.includes('recipient phone number not in allowed list')) {
    return 'Meta bloqueó el envío porque este número no está en la lista autorizada del WhatsApp de prueba. Hay que agregarlo en Meta o usar un número/producto ya aprobado.';
  }
  if (message.includes('190') || lower.includes('authentication error') || lower.includes('unauthorized')) {
    return 'No pude enviar el mensaje porque el canal de WhatsApp de Meta rechazó la autenticación. Hay que revisar o renovar el token de ese número.';
  }
  if (message.includes('413') || lower.includes('too large')) {
    return kind === 'media'
      ? 'El archivo es demasiado pesado para enviarlo por este canal.'
      : 'No pude enviar el mensaje porque el canal rechazó la solicitud.';
  }
  return kind === 'media' ? 'No pude enviar el archivo.' : 'No pude enviar el mensaje.';
}

async function listInboxConversations({ mode = 'active' } = {}) {
  const conversations = await sb.select('conversaciones', 'select=*&order=ultimo_mensaje_en.desc&limit=200');
  const state = loadAdvisorState();
  const normalizedMode = String(mode || 'active').toLowerCase();
  const includeFullWhatsappHistory = normalizedMode === 'bot' || normalizedMode === 'all' || normalizedMode === 'resolved';
  const isVisibleForActiveInbox = (item) => {
    if (item.canal !== 'whatsapp' || item.paso_actual === 'lead_captado') return false;
    if (item.estado_conversacion === 'closed') return false;
    if (item.estado_conversacion === 'handoff' || item.requiere_handoff) return true;
    if (state.conversations?.[item.id_conversacion]) return true;
    return true;
  };
  const relevant = includeFullWhatsappHistory
    ? conversations.filter((item) => item.canal === 'whatsapp' && item.paso_actual !== 'lead_captado')
    : conversations.filter(isVisibleForActiveInbox);
  if (!relevant.length) return [];

  const userIds = [...new Set(relevant.map((item) => item.id_usuario).filter(Boolean))];
  const conversationIds = relevant.map((item) => item.id_conversacion);

  const users = userIds.length
    ? await sb.select('usuarios', `id_usuario=in.(${userIds.map((value) => encodeURIComponent(value)).join(',')})&select=*`)
    : [];
  const profiles = conversationIds.length
    ? await sb.select('perfiles_cliente', `id_conversacion=in.(${conversationIds.join(',')})&select=*`)
    : [];
  const messages = conversationIds.length
    ? await sb.select('mensajes', `id_conversacion=in.(${conversationIds.join(',')})&select=*&order=creado_en.asc`)
    : [];

  const usersById = Object.fromEntries(users.map((item) => [item.id_usuario, item]));
  const profilesByConversation = Object.fromEntries(profiles.map((item) => [item.id_conversacion, item]));
  const messagesByConversation = new Map();
  const groupedConversations = new Map();
  const storedVisits = readJSON(techVisitsFile, []);
  const storedQuotes = readJSON(quotesFile, []);

  for (const message of messages) {
    const list = messagesByConversation.get(message.id_conversacion) || [];
    list.push(message);
    messagesByConversation.set(message.id_conversacion, list);
  }

  for (const conversation of relevant) {
    const user = usersById[conversation.id_usuario] || null;
    const key = conversationGroupKey(conversation, user);
    const list = groupedConversations.get(key) || [];
    list.push(conversation);
    groupedConversations.set(key, list);
  }

  return [...groupedConversations.values()].map((group) => {
    const orderedConversations = sortByNewestConversations(group);
    const primaryConversation = orderedConversations[0];
    const user = usersById[primaryConversation.id_usuario] || null;
    const relatedProfiles = orderedConversations
      .map((item) => profilesByConversation[item.id_conversacion])
      .filter(Boolean);
    const mergedProfile = mergeProfiles(relatedProfiles);
    const thread = orderedConversations
      .flatMap((item) => messagesByConversation.get(item.id_conversacion) || [])
      .sort((a, b) => isoTimeValue(a?.creado_en) - isoTimeValue(b?.creado_en));
    const lastMessage = thread[thread.length - 1] || null;
    const localStates = orderedConversations.map((item) => state.conversations?.[item.id_conversacion] || {});
    const primaryLocal = state.conversations?.[primaryConversation.id_conversacion] || {};
    const relatedVisit = storedVisits.find((item) => String(item.reference || '').trim() === String(primaryConversation.id_conversacion || '').trim()) || null;
    const relatedQuote = relatedVisit?.quoteId
      ? storedQuotes.find((item) => String(item.id || '').trim() === String(relatedVisit.quoteId || '').trim()) || null
      : null;
    const countryCode = inferConversationCountry({ conversation: primaryConversation, user, profile: mergedProfile }) || 'PE';
    return {
      id: primaryConversation.id_conversacion,
      countryCode,
      phone: userPhoneFromConversation(primaryConversation) || user?.telefono_principal || '',
      phonePretty: phonePretty(userPhoneFromConversation(primaryConversation) || user?.telefono_principal || ''),
      customerName: userNameFromData(user, mergedProfile, thread, userPhoneFromConversation(primaryConversation) || user?.telefono_principal || ''),
      email: mergedProfile?.correo_receptor || user?.correo_electronico || '',
      district: mergedProfile?.distrito_instalacion || mergedProfile?.distrito_recibo || '',
      province: mergedProfile?.provincia_instalacion || mergedProfile?.provincia_recibo || '',
      currentStep: primaryConversation.paso_actual || '',
      handoffReason: primaryConversation.motivo_handoff || '',
      requestContext: advisorLeadContext(primaryConversation.resumen),
      whatsappState: primaryConversation.estado_conversacion,
      status: conversationStatus(primaryConversation, primaryLocal),
      assignedTo: primaryLocal.assignedTo || null,
      assignedToLabel: primaryLocal.assignedToLabel || null,
      assignedAt: primaryLocal.assignedAt || null,
      unreadCount: localStates.reduce((sum, item) => sum + Number(item.unreadCount || 0), 0),
      tags: [...new Set(localStates.flatMap((item) => Array.isArray(item.tags) ? item.tags : []))],
      internalNote: String(primaryLocal.internalNote || ''),
      nextAction: String(primaryLocal.nextAction || ''),
      manualPriority: String(primaryLocal.manualPriority || ''),
      relatedVisitId: relatedVisit?.id || '',
      relatedQuoteId: relatedQuote?.id || '',
      lastMessageText: String(fallbackMessageText(lastMessage) || '').slice(0, 220),
      lastMessageAt: lastMessage?.creado_en || primaryConversation.ultimo_mensaje_en || primaryConversation.actualizado_en,
      lastIncomingAt: primaryLocal.lastIncomingAt || null,
      createdAt: orderedConversations[orderedConversations.length - 1]?.creado_en || primaryConversation.creado_en,
      updatedAt: mergedUpdatedAt(orderedConversations, localStates) || primaryConversation.actualizado_en,
      conversationIds: orderedConversations.map((item) => item.id_conversacion),
    };
  }).sort((a, b) => isoTimeValue(b.lastMessageAt || b.updatedAt) - isoTimeValue(a.lastMessageAt || a.updatedAt));
}

async function getConversationDetail(conversationId) {
  const rows = await sb.select('conversaciones', `id_conversacion=eq.${conversationId}&select=*`);
  const requestedConversation = rows[0];
  if (!requestedConversation) return null;

  const allConversations = await sb.select(
    'conversaciones',
    `id_usuario=eq.${encodeURIComponent(requestedConversation.id_usuario)}&canal=eq.whatsapp&order=creado_en.asc&limit=50`,
  );
  const groupedConversations = Array.isArray(allConversations) && allConversations.length
    ? allConversations
    : [requestedConversation];
  const orderedConversations = sortByNewestConversations(groupedConversations);
  const primaryConversation = orderedConversations[0] || requestedConversation;
  const conversationIds = groupedConversations.map((item) => item.id_conversacion);
  const fullState = loadAdvisorState().conversations || {};
  const primaryState = fullState[primaryConversation.id_conversacion] || {};
  const groupStates = groupedConversations.map((item) => fullState[item.id_conversacion] || {});

  const [users, profiles, messages] = await Promise.all([
    sb.select('usuarios', `id_usuario=eq.${encodeURIComponent(primaryConversation.id_usuario)}&select=*`),
    conversationIds.length
      ? sb.select('perfiles_cliente', `id_conversacion=in.(${conversationIds.join(',')})&select=*`)
      : [],
    conversationIds.length
      ? sb.select('mensajes', `id_conversacion=in.(${conversationIds.join(',')})&select=*&order=creado_en.asc&limit=5000`)
      : [],
  ]);
  const user = users[0] || null;
  const profile = mergeProfiles(profiles);
  const messagesSorted = [...messages].sort((a, b) => isoTimeValue(a?.creado_en) - isoTimeValue(b?.creado_en));
  let files = [];
  let artifacts = [];
  try {
    const phone = userPhoneFromConversation(primaryConversation) || user?.telefono_principal || '';
    const query = phone
      ? `or=(phone.eq.${normalizePhone(phone).replace(/^\+/, '')},conversation_id.in.(${conversationIds.join(',')}))&select=*&order=created_at.desc&limit=100`
      : `conversation_id=in.(${conversationIds.join(',')})&select=*&order=created_at.desc&limit=100`;
    files = await sb.select('client_files', query);
  } catch (error) {
    if (!String(error?.message || '').includes('client_files')) throw error;
  }
  try {
    const phone = userPhoneFromConversation(primaryConversation) || user?.telefono_principal || '';
    const query = phone
      ? `or=(phone.eq.${normalizePhone(phone).replace(/^\+/, '')},conversation_id.in.(${conversationIds.join(',')}))&select=*&order=created_at.desc&limit=100`
      : `conversation_id=in.(${conversationIds.join(',')})&select=*&order=created_at.desc&limit=100`;
    artifacts = await sb.select('client_artifacts', query);
  } catch (error) {
    if (!String(error?.message || '').includes('client_artifacts')) throw error;
  }
  const relatedVisit = findRelatedVisit({ id: primaryConversation.id_conversacion, email: profile?.correo_receptor || user?.correo_electronico || '' });
  const relatedQuote = findRelatedQuote({ id: primaryConversation.id_conversacion, email: profile?.correo_receptor || user?.correo_electronico || '' });
  const countryCode = inferConversationCountry({ conversation: primaryConversation, user, profile }) || 'PE';
  const vehicleType = String(profile?.notas_recibo || '').startsWith('tipo_vehiculo=')
    ? String(profile.notas_recibo || '').replace(/^tipo_vehiculo=/, '').trim()
    : '';
  return {
    conversation: {
      id: primaryConversation.id_conversacion,
      requestedId: requestedConversation.id_conversacion,
      conversationIds,
      countryCode,
      phone: userPhoneFromConversation(primaryConversation) || user?.telefono_principal || '',
      phonePretty: phonePretty(userPhoneFromConversation(primaryConversation) || user?.telefono_principal || ''),
      customerName: userNameFromData(user, profile, messagesSorted, userPhoneFromConversation(primaryConversation) || user?.telefono_principal || ''),
      email: profile?.correo_receptor || user?.correo_electronico || '',
      step: primaryConversation.paso_actual || '',
      handoffReason: primaryConversation.motivo_handoff || '',
      requestContext: advisorLeadContext(primaryConversation.resumen),
      whatsappState: primaryConversation.estado_conversacion,
      status: conversationStatus(primaryConversation, primaryState),
      assignedTo: primaryState.assignedTo || null,
      assignedToLabel: primaryState.assignedToLabel || null,
      assignedAt: primaryState.assignedAt || null,
      district: profile?.distrito_instalacion || profile?.distrito_recibo || '',
      province: profile?.provincia_instalacion || profile?.provincia_recibo || '',
      installationAddress: profile?.direccion_instalacion || '',
      receiptAddress: profile?.direccion_recibo || '',
      ticketContext: primaryConversation.codigo_ticket_solicitado || '',
      tags: [...new Set(groupStates.flatMap((item) => Array.isArray(item.tags) ? item.tags : []))],
      internalNote: String(primaryState.internalNote || ''),
      nextAction: String(primaryState.nextAction || ''),
      manualPriority: String(primaryState.manualPriority || ''),
      relatedVisitId: String(relatedVisit?.id || '').trim(),
      relatedQuoteId: String(relatedQuote?.id || '').trim(),
      unreadCount: groupStates.reduce((sum, item) => sum + Number(item.unreadCount || 0), 0),
      historyConversationCount: conversationIds.length,
      historyMessageCount: messagesSorted.length,
      createdAt: groupedConversations[0]?.creado_en || primaryConversation.creado_en,
      updatedAt: mergedUpdatedAt(groupedConversations, groupStates) || primaryConversation.actualizado_en,
    },
    profile: {
      receiptAddress: profile?.direccion_recibo || '',
      receiptDistrict: profile?.distrito_recibo || '',
      receiptProvince: profile?.provincia_recibo || '',
      receiptPower: profile?.potencia_kw != null ? String(profile.potencia_kw) : '',
      installationAddress: profile?.direccion_instalacion || '',
      receiverName: profile?.nombre_receptor || '',
      receiverDocument: profile?.ruc_receptor || profile?.dni_receptor || '',
      receiverPhone: profile?.telefono_receptor || userPhoneFromConversation(primaryConversation) || user?.telefono_principal || '',
      receiverEmail: profile?.correo_receptor || user?.correo_electronico || '',
      vehicleBrand: profile?.marca_vehiculo || '',
      vehicleModel: profile?.modelo_vehiculo || '',
      vehicleType,
    },
    messages: messagesSorted.map((message) => ({
      ...(interactiveSummaryFromPayload(message.payload_crudo || null)),
      id: message.id_mensaje,
      conversationId: message.id_conversacion,
      role: message.rol,
      text: fallbackMessageText(message),
      type: message.payload_crudo?.type || message.tipo_mensaje,
      createdAt: message.creado_en,
      source: message.payload_crudo?.source || null,
      advisorName: message.payload_crudo?.advisorName || null,
      advisorEmail: message.payload_crudo?.advisorEmail || null,
      systemAction: message.payload_crudo?.systemAction || null,
      forwardedTo: message.payload_crudo?.forwardedTo || null,
      forwardedToLabel: message.payload_crudo?.forwardedToLabel || null,
      mediaUrl: message.payload_crudo?.mediaUrl || null,
      mimeType: message.payload_crudo?.mimeType || null,
      fileName: message.payload_crudo?.fileName || null,
      fileSize: message.payload_crudo?.fileSize || null,
      sharedContacts: message.payload_crudo?.sharedContacts || message.payload_crudo?.contacts || null,
      contactName: message.payload_crudo?.contactName || null,
      contactPhone: message.payload_crudo?.contactPhone || null,
      locationName: message.payload_crudo?.locationName || null,
      locationAddress: message.payload_crudo?.locationAddress || null,
      latitude: message.payload_crudo?.latitude ?? null,
      longitude: message.payload_crudo?.longitude ?? null,
    })),
    files: files.map((file) => ({
      id: file.id,
      fileName: file.file_name || '',
      fileType: file.file_type || '',
      mimeType: file.mime_type || '',
      fileSize: file.file_size || 0,
      clientName: file.client_name || '',
      phone: file.phone || '',
      ticketId: file.ticket_id || '',
      createdAt: file.created_at,
      url: file.storage_bucket && file.storage_path
        ? `/api/inbox/storage-media/${encodeURIComponent(file.storage_bucket)}/${String(file.storage_path || '').split('/').filter(Boolean).map((part) => encodeURIComponent(part)).join('/')}`
        : null,
    })),
    artifacts: artifacts.map((artifact) => ({
      id: artifact.id,
      artifactType: artifact.artifact_type || '',
      title: artifact.title || '',
      summary: artifact.summary || '',
      phone: artifact.phone || '',
      ticketId: artifact.ticket_id || '',
      createdAt: artifact.created_at,
      payload: artifact.payload || null,
    })),
  };
}

async function logSystemMessage(conversation, text, payload = {}) {
  await sb.insert('mensajes', {
    id_conversacion: conversation.id_conversacion,
    id_usuario: conversation.id_usuario,
    rol: 'system',
    contenido: text,
    tipo_mensaje: 'system_event',
    payload_crudo: payload,
  });
}

async function logAdvisorMessage(conversation, text, advisor) {
  const basePayload = {
    id_conversacion: conversation.id_conversacion,
    id_usuario: conversation.id_usuario,
    contenido: text,
    tipo_mensaje: 'text',
    payload_crudo: {
      advisorId: advisor.id,
      advisorName: advisorLabel(advisor),
      advisorEmail: advisor.email,
      source: 'advisor_inbox',
    },
  };
  try {
    await sb.insert('mensajes', {
      ...basePayload,
      rol: 'advisor',
    });
  } catch (error) {
    console.warn('logAdvisorMessage fallback to assistant:', error?.message || error);
    await sb.insert('mensajes', {
      ...basePayload,
      rol: 'assistant',
    });
  }
}

async function logForwardMirrorMessage({ conversation, originalMessage, advisor, forwardedTo, forwardedToLabel, customerContext = null, introText = '' }) {
  const payload = originalMessage?.payload_crudo || {};
  const text = trimForwardText(fallbackMessageText(originalMessage) || '');
  const isMedia = Boolean(payload?.mediaUrl || payload?.storageBucket || payload?.storagePath || payload?.localMediaPath);
  const content = isMedia
    ? (text || payload?.fileName || originalMessage?.contenido || 'Archivo reenviado a caja')
    : (text || '[mensaje reenviado a caja]');
  const sharedPayload = {
    advisorId: advisor?.id || 'system',
    advisorName: advisorLabel(advisor),
    advisorEmail: advisor?.email || 'system@evinka.local',
    source: 'advisor_forward_jeny',
    forwardedTo: forwardedTo || ADVISOR_FORWARD_JENY_PHONE,
    forwardedToLabel: forwardedToLabel || ADVISOR_FORWARD_JENY_LABEL,
    originalMessageId: originalMessage?.id_mensaje || null,
    customerName: customerContext?.customerName || null,
    customerPhone: customerContext?.phonePretty || customerContext?.phone || null,
  };

  if (introText) {
    await sb.insert('mensajes', {
      id_conversacion: conversation.id_conversacion,
      id_usuario: conversation.id_usuario,
      rol: 'advisor',
      contenido: introText,
      tipo_mensaje: 'text',
      payload_crudo: {
        ...sharedPayload,
        source: 'advisor_forward_jeny_intro',
        type: 'text',
      },
    });
  }

  const mirrorPayload = {
    ...sharedPayload,
    mediaUrl: payload?.mediaUrl || null,
    mimeType: payload?.mimeType || null,
    fileName: payload?.fileName || null,
    fileSize: payload?.fileSize || null,
    type: isMedia ? (payload?.type || originalMessage?.tipo_mensaje || 'document') : 'text',
  };

  try {
    await sb.insert('mensajes', {
      id_conversacion: conversation.id_conversacion,
      id_usuario: conversation.id_usuario,
      rol: 'advisor',
      contenido: content,
      tipo_mensaje: mirrorPayload.type,
      payload_crudo: mirrorPayload,
    });
  } catch (error) {
    console.warn('logForwardMirrorMessage fallback to assistant:', error?.message || error);
    await sb.insert('mensajes', {
      id_conversacion: conversation.id_conversacion,
      id_usuario: conversation.id_usuario,
      rol: 'assistant',
      contenido: content,
      tipo_mensaje: mirrorPayload.type,
      payload_crudo: mirrorPayload,
    });
  }

  await patchConversation(conversation.id_conversacion, {
    estado_conversacion: 'handoff',
    requiere_handoff: true,
    paso_actual: 'chat_caja',
    subestado_flujo: 'interno_jeny',
    motivo_handoff: 'Caja / recepción de boletas',
    ultimo_mensaje_en: new Date().toISOString(),
  });
}

async function patchConversation(conversationId, patch) {
  const rows = await sb.update('conversaciones', `id_conversacion=eq.${conversationId}`, patch);
  return rows[0] || null;
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'advisor-inbox' });
});

app.get('/api/me', authRequired, (req, res) => {
  res.json({ user: req.user });
});

app.get(/^\/api\/inbox\/media\/(.+)$/, authRequired, (req, res) => {
  const relPath = req.params[0] || '';
  const absolute = resolveConversationMedia(relPath);
  if (!absolute) return res.status(404).json({ error: 'Archivo no encontrado.' });
  res.sendFile(absolute);
});

app.get(/^\/api\/inbox\/storage-media\/([^/]+)\/(.+)$/, authRequired, async (req, res) => {
  try {
    const bucket = decodeURIComponent(req.params[0] || '').trim();
    const objectPath = decodeURIComponent(req.params[1] || '').trim();
    if (!bucket || !objectPath) return res.status(400).json({ error: 'Archivo inválido.' });
    const file = await storage.downloadObject(bucket, objectPath);
    if (file.mimeType) res.setHeader('Content-Type', file.mimeType);
    if (file.fileSize) res.setHeader('Content-Length', String(file.fileSize));
    res.send(file.buffer);
  } catch (error) {
    console.error('storage media proxy failed:', error);
    res.status(404).json({ error: 'Archivo no disponible.' });
  }
});

app.post('/api/login', (req, res) => {
  const { username, identifier, email, password } = req.body || {};
  const users = readUsers();
  const rawIdentifier = String(username || identifier || email || '').trim();
  const normalizedCode = normalizeEmployeeCode(rawIdentifier);
  const normalizedEmail = rawIdentifier.toLowerCase();
  const user = users.find((item) => (
    normalizeEmployeeCode(item.employeeCode || '') === normalizedCode
      || String(item.email || '').trim().toLowerCase() === normalizedEmail
  ));
  if (!user || user.status !== 'active') {
    appendAccessAuditLog({
      module: 'asesor',
      action: 'login',
      status: 'failed',
      employeeCode: normalizedCode,
      email: normalizedEmail,
      ip: clientIp(req),
      userAgent: req.headers['user-agent'] || '',
      reason: 'invalid_credentials_or_inactive',
    });
    return res.status(401).json({ error: 'Credenciales inválidas o cuenta sin acceso.' });
  }

  const secret = String(password || '').trim();
  if (isAdminRole(user)) {
    const passwordOk = user.passwordHash ? hashPasswordVerify(secret, user.passwordHash) : false;
    const pinOk = user.pinHash && normalizedCode === normalizeEmployeeCode(user.employeeCode || '')
      ? hashPasswordVerify(secret, user.pinHash)
      : false;
    if (!passwordOk && !pinOk) {
      appendAccessAuditLog({
        module: 'asesor',
        action: 'login',
        status: 'failed',
        userId: user.id,
        employeeCode: user.employeeCode,
        email: user.email,
        name: user.name,
        role: user.role,
        allowedCountries: user.allowedCountries,
        ip: clientIp(req),
        userAgent: req.headers['user-agent'] || '',
        reason: 'invalid_admin_credentials',
      });
      return res.status(401).json({ error: 'Credenciales inválidas o cuenta sin acceso.' });
    }
  } else {
    if (!normalizedCode || normalizedCode !== normalizeEmployeeCode(user.employeeCode || '')) {
      appendAccessAuditLog({
        module: 'asesor',
        action: 'login',
        status: 'failed',
        userId: user.id,
        employeeCode: user.employeeCode,
        email: user.email,
        name: user.name,
        role: user.role,
        allowedCountries: user.allowedCountries,
        ip: clientIp(req),
        userAgent: req.headers['user-agent'] || '',
        reason: 'username_pin_required',
      });
      return res.status(401).json({ error: 'Para tu cuenta debes ingresar con usuario y PIN.' });
    }
    if (!user.pinHash) {
      appendAccessAuditLog({
        module: 'asesor',
        action: 'login',
        status: 'denied',
        userId: user.id,
        employeeCode: user.employeeCode,
        email: user.email,
        name: user.name,
        role: user.role,
        allowedCountries: user.allowedCountries,
        ip: clientIp(req),
        userAgent: req.headers['user-agent'] || '',
        reason: 'pending_pin',
      });
      return res.status(403).json({ error: 'Tu cuenta aún no tiene PIN configurado. Pide al admin que lo active.' });
    }
    if (!hashPasswordVerify(secret, user.pinHash)) {
      appendAccessAuditLog({
        module: 'asesor',
        action: 'login',
        status: 'failed',
        userId: user.id,
        employeeCode: user.employeeCode,
        email: user.email,
        name: user.name,
        role: user.role,
        allowedCountries: user.allowedCountries,
        ip: clientIp(req),
        userAgent: req.headers['user-agent'] || '',
        reason: 'invalid_pin',
      });
      return res.status(401).json({ error: 'Usuario o PIN inválido.' });
    }
  }
  const sessions = readSessions();
  const token = crypto.randomBytes(24).toString('hex');
  sessions[token] = {
    userId: user.id,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString(),
  };
  writeSessions(sessions);
  res.setHeader('Set-Cookie', sessionCookie(token));
  appendAccessAuditLog({
    module: 'asesor',
    action: 'login',
    status: 'success',
    userId: user.id,
    employeeCode: user.employeeCode,
    email: user.email,
    name: user.name,
    role: user.role,
    allowedCountries: user.allowedCountries,
    ip: clientIp(req),
    userAgent: req.headers['user-agent'] || '',
  });
  res.json({ ok: true, user: safeUser(user) });
});

app.post('/api/mobile/bootstrap', (req, res) => {
  const cotizadorSessionToken = String(req.body?.cotizadorSessionToken || '').trim();
  const user = userFromCotizadorSessionToken(cotizadorSessionToken);
  if (!user) {
    return res.status(401).json({ error: 'No pude validar tu sesión actual de EVINKA Suite.' });
  }
  const token = createAdvisorSessionForUser(user);
  res.setHeader('Set-Cookie', sessionCookie(token));
  res.json({ ok: true, user: safeUser(user) });
});

app.post('/api/logout', authOptional, (req, res) => {
  const sessions = readSessions();
  if (req.sessionToken) delete sessions[req.sessionToken];
  writeSessions(sessions);
  if (req.user) {
    appendAccessAuditLog({
      module: 'asesor',
      action: 'logout',
      status: 'success',
      userId: req.user.id,
      employeeCode: req.user.employeeCode,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      allowedCountries: req.user.allowedCountries,
      ip: clientIp(req),
      userAgent: req.headers['user-agent'] || '',
    });
  }
  res.setHeader('Set-Cookie', clearSessionCookie());
  res.json({ ok: true });
});

app.get('/api/inbox/conversations', authRequired, async (req, res) => {
  try {
    const items = await listInboxConversations({ mode: String(req.query.status || 'active').toLowerCase() });
    const requestedCountry = normalizeCountryScope(req.query.country || '');
    const allowedItems = items.filter((item) => userAllowsCountry(req.user, item.countryCode));
    const scopedItems = requestedCountry && requestedCountry !== 'ALL'
      ? allowedItems.filter((item) => String(item.countryCode || '').toUpperCase() === requestedCountry)
      : allowedItems;
    const status = String(req.query.status || 'active').toLowerCase();
    const filtered = status === 'all'
      ? scopedItems
      : status === 'resolved'
        ? scopedItems.filter((item) => item.status === 'resolved')
        : status === 'bot'
          ? scopedItems
        : scopedItems.filter((item) => item.status !== 'resolved');
    res.json(filtered);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No pude cargar la bandeja.' });
  }
});

app.get('/api/inbox/conversations/:id', authRequired, async (req, res) => {
  try {
    const detail = await getConversationDetail(req.params.id);
    if (!detail) return res.status(404).json({ error: 'Conversación no encontrada.' });
    ensureConversationAccess(req.user, detail.conversation);
    patchAdvisorConversation(req.params.id, (current) => ({ ...current, unreadCount: 0, lastOpenedAt: new Date().toISOString() }));
    res.json(detail);
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || 500).json({ error: error.statusCode === 403 ? 'Sin acceso a este caso.' : 'No pude cargar la conversación.' });
  }
});

app.patch('/api/inbox/conversations/:id/meta', authRequired, async (req, res) => {
  try {
    const detail = await getConversationDetail(req.params.id);
    if (!detail) return res.status(404).json({ error: 'Conversación no encontrada.' });
    ensureConversationAccess(req.user, detail.conversation);

    const body = req.body || {};
    const state = patchAdvisorConversation(req.params.id, (current) => ({
      ...current,
      internalNote: String(body.internalNote || '').trim().slice(0, 2000),
      nextAction: String(body.nextAction || '').trim().slice(0, 120),
      manualPriority: String(body.manualPriority || '').trim().toLowerCase().slice(0, 20),
      tags: Array.isArray(body.tags) ? body.tags.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 10) : current.tags,
      lastMetaUpdatedBy: advisorLabel(req.user),
      lastMetaUpdatedAt: new Date().toISOString(),
    }));

    res.json({
      ok: true,
      state: {
        internalNote: state.internalNote || '',
        nextAction: state.nextAction || '',
        manualPriority: state.manualPriority || '',
        tags: Array.isArray(state.tags) ? state.tags : [],
        lastMetaUpdatedBy: state.lastMetaUpdatedBy || advisorLabel(req.user),
        lastMetaUpdatedAt: state.lastMetaUpdatedAt || state.updatedAt || new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || 500).json({ error: error.statusCode === 403 ? 'Sin acceso a este caso.' : 'No pude guardar la ficha interna.' });
  }
});

app.post('/api/inbox/conversations/:id/actions/create-visit', authRequired, async (req, res) => {
  try {
    const rows = await sb.select('conversaciones', `id_conversacion=eq.${req.params.id}&select=*`);
    const dbConversation = rows[0];
    if (!dbConversation) return res.status(404).json({ error: 'Conversación no encontrada.' });
    const detail = await getConversationDetail(req.params.id);
    if (!detail) return res.status(404).json({ error: 'No pude cargar el detalle del caso.' });
    ensureConversationAccess(req.user, detail.conversation);

    const result = await createAdvisorVisit(dbConversation, detail.conversation, req, req.body || {});
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || 500).json({ error: error.statusCode === 403 ? 'Sin acceso a este caso.' : (error?.message || 'No pude crear la visita técnica.') });
  }
});

app.post('/api/inbox/conversations/:id/visit-availability', authRequired, async (req, res) => {
  try {
    const rows = await sb.select('conversaciones', `id_conversacion=eq.${req.params.id}&select=*`);
    const dbConversation = rows[0];
    if (!dbConversation) return res.status(404).json({ error: 'Conversación no encontrada.' });
    const detail = await getConversationDetail(req.params.id);
    if (!detail) return res.status(404).json({ error: 'No pude cargar el detalle del caso.' });
    ensureConversationAccess(req.user, detail.conversation);
    const availability = await fetchAdvisorVisitAvailability(detail.conversation, req.body || {});
    res.json(availability);
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || 500).json({ error: error.statusCode === 403 ? 'Sin acceso a este caso.' : (error?.message || 'No pude consultar la disponibilidad de la visita.') });
  }
});

app.post('/api/inbox/conversations/:id/visit-options', authRequired, async (req, res) => {
  try {
    const rows = await sb.select('conversaciones', `id_conversacion=eq.${req.params.id}&select=*`);
    const dbConversation = rows[0];
    if (!dbConversation) return res.status(404).json({ error: 'Conversación no encontrada.' });
    const detail = await getConversationDetail(req.params.id);
    if (!detail) return res.status(404).json({ error: 'No pude cargar el detalle del caso.' });
    ensureConversationAccess(req.user, detail.conversation);
    const options = await fetchAdvisorVisitOptions(detail.conversation, req.body || {});
    res.json(options);
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || 500).json({ error: error.statusCode === 403 ? 'Sin acceso a este caso.' : (error?.message || 'No pude consultar los días y horarios de la visita.') });
  }
});

app.post('/api/inbox/conversations/:id/actions/ready-close', authRequired, async (req, res) => {
  try {
    const rows = await sb.select('conversaciones', `id_conversacion=eq.${req.params.id}&select=*`);
    const conversation = rows[0];
    if (!conversation) return res.status(404).json({ error: 'Conversación no encontrada.' });
    const detail = await getConversationDetail(req.params.id);
    if (!detail) return res.status(404).json({ error: 'No pude cargar el detalle del caso.' });
    ensureConversationAccess(req.user, detail.conversation);

    const state = patchAdvisorConversation(req.params.id, (current) => ({
      ...current,
      nextAction: 'cerrar',
      dealStage: 'ready_to_close',
      manualPriority: current.manualPriority || 'high',
      readyToCloseAt: new Date().toISOString(),
      readyToCloseBy: advisorLabel(req.user),
    }));

    await logSystemMessage(conversation, `${advisorLabel(req.user)} marcó el caso como listo para cierre.`, {
      systemAction: 'ready_close',
      advisorId: req.user.id,
      advisorName: advisorLabel(req.user),
    });

    res.json({ ok: true, state });
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || 500).json({ error: error.statusCode === 403 ? 'Sin acceso a este caso.' : 'No pude marcar el caso como listo para cierre.' });
  }
});

app.patch('/api/inbox/conversations/:id', authRequired, async (req, res) => {
  try {
    const body = req.body || {};
    const action = String(body.action || '').trim().toLowerCase();
    const rows = await sb.select('conversaciones', `id_conversacion=eq.${req.params.id}&select=*`);
    const conversation = rows[0];
    if (!conversation) return res.status(404).json({ error: 'Conversación no encontrada.' });
    const detail = await getConversationDetail(req.params.id);
    if (!detail) return res.status(404).json({ error: 'No pude cargar el detalle del caso.' });
    ensureConversationAccess(req.user, detail.conversation);

    if (action === 'claim') {
      const wasHandoff = conversation.estado_conversacion === 'handoff' || conversation.requiere_handoff === true || conversation.paso_actual === 'handoff_asesor';
      const patched = wasHandoff
        ? conversation
        : await patchConversation(req.params.id, {
          estado_conversacion: 'handoff',
          requiere_handoff: true,
          paso_actual: 'handoff_asesor',
          motivo_handoff: conversation.motivo_handoff || 'Tomado por asesor desde la bandeja',
        });
      const state = patchAdvisorConversation(req.params.id, (current) => ({
        ...current,
        internalStatus: 'open',
        handoffActive: true,
        supportStatus: 'tomado',
        assignedTo: req.user.id,
        assignedToLabel: advisorLabel(req.user),
        assignedAt: current.assignedAt || new Date().toISOString(),
        unreadCount: 0,
      }));
      await upsertSupportTicket({ conversation: patched, phone: userPhoneFromConversation(conversation), patch: {
        status: 'tomado',
        assigned_to: req.user.id,
        handoff_active: true,
        last_agent_message_at: new Date().toISOString(),
      } });
      await logSystemMessage(conversation, `${advisorLabel(req.user)} tomó este caso.`, { systemAction: 'claim', advisorId: req.user.id, advisorName: advisorLabel(req.user) });
      return res.json({ ok: true, conversation: patched, state });
    }

    if (action === 'retake') {
      clearCustomerIdleCloseTimer(req.params.id);
      const patched = await patchConversation(req.params.id, {
        estado_conversacion: 'handoff',
        requiere_handoff: true,
        paso_actual: 'handoff_asesor',
        subestado_flujo: 'retomado_por_asesor',
        motivo_handoff: conversation.motivo_handoff || 'Retomado por asesor desde la bandeja',
        cerrada_en: null,
        ultimo_mensaje_en: new Date().toISOString(),
      });
      const state = patchAdvisorConversation(req.params.id, (current) => ({
        ...current,
        internalStatus: 'open',
        handoffActive: true,
        supportStatus: 'tomado',
        assignedTo: req.user.id,
        assignedToLabel: advisorLabel(req.user),
        assignedAt: current.assignedAt || new Date().toISOString(),
        resolvedBy: null,
        resolvedByLabel: null,
        resolvedAt: null,
        unreadCount: 0,
      }));
      await upsertSupportTicket({ conversation: patched, phone: userPhoneFromConversation(conversation), patch: {
        status: 'tomado',
        assigned_to: req.user.id,
        handoff_active: true,
        closed_at: null,
        close_reason: null,
        last_agent_message_at: new Date().toISOString(),
      } });
      await logSystemMessage(conversation, `${advisorLabel(req.user)} retomó este caso.`, { systemAction: 'retake', advisorId: req.user.id, advisorName: advisorLabel(req.user) });
      return res.json({ ok: true, conversation: patched, state });
    }

    if (action === 'resolve') {
      clearCustomerIdleCloseTimer(req.params.id);
      const patched = await patchConversation(req.params.id, {
        estado_conversacion: 'closed',
        requiere_handoff: false,
        cerrada_en: new Date().toISOString(),
      });
      const state = patchAdvisorConversation(req.params.id, (current) => ({
        ...current,
        internalStatus: 'resolved',
        handoffActive: false,
        supportStatus: 'cerrado',
        resolvedBy: req.user.id,
        resolvedByLabel: advisorLabel(req.user),
        resolvedAt: new Date().toISOString(),
        unreadCount: 0,
      }));
      await upsertSupportTicket({ conversation: patched, phone: userPhoneFromConversation(conversation), patch: {
        status: 'cerrado',
        handoff_active: false,
        closed_at: new Date().toISOString(),
        close_reason: 'resuelto',
      } });
      await logSystemMessage(conversation, `${advisorLabel(req.user)} marcó el caso como resuelto.`, { systemAction: 'resolve', advisorId: req.user.id, advisorName: advisorLabel(req.user) });
      return res.json({ ok: true, conversation: patched, state });
    }

    if (action === 'return_to_bot') {
      clearCustomerIdleCloseTimer(req.params.id);
      const advisorState = loadAdvisorState().conversations?.[req.params.id] || {};
      const nextStepLabel = advisorState.nextAction
        ? ({
          contactar_cliente: 'contactarte',
          pedir_datos: 'pedirte unos datos',
          agendar_visita: 'coordinar tu visita técnica',
          enviar_cotizacion: 'continuar con tu cotización',
          seguimiento: 'dar seguimiento a tu caso',
          cerrar: 'cerrar tu solicitud',
        }[advisorState.nextAction] || 'continuar con tu caso')
        : 'continuar con tu caso';
      const summaryText = String(advisorState.internalNote || '').trim();
      const patched = await patchConversation(req.params.id, {
        estado_conversacion: 'open',
        requiere_handoff: false,
        motivo_handoff: null,
        paso_actual: 'menu_principal',
        subestado_flujo: 'retorno_desde_asesor',
        ultimo_mensaje_en: new Date().toISOString(),
      });
      const text = `Listo 👍\n\nCerré la atención humana y te devolví con el asistente de EVINKA para ${nextStepLabel}.\n\nSi deseas continuar, escribe MENU.`;
      await metaForConversation(conversation, detail.conversation).sendText(userPhoneFromConversation(conversation), text);
      await logAdvisorMessage(conversation, text, req.user);
      const state = patchAdvisorConversation(req.params.id, (current) => ({
        ...current,
        internalStatus: 'resolved',
        handoffActive: false,
        supportStatus: 'vuelto_menu',
        resolvedBy: req.user.id,
        resolvedByLabel: advisorLabel(req.user),
        resolvedAt: new Date().toISOString(),
        unreadCount: 0,
      }));
      await upsertSupportTicket({ conversation: patched, phone: userPhoneFromConversation(conversation), patch: {
        status: 'vuelto_menu',
        handoff_active: false,
        closed_at: new Date().toISOString(),
        close_reason: 'volver_menu',
      } });
      await logSystemMessage(conversation, `${advisorLabel(req.user)} devolvió el caso al bot.`, {
        systemAction: 'return_to_bot',
        advisorId: req.user.id,
        advisorName: advisorLabel(req.user),
        advisorSummary: summaryText,
        nextAction: advisorState.nextAction || '',
      });
      return res.json({ ok: true, conversation: patched, state });
    }

    return res.status(400).json({ error: 'Acción inválida.' });
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || 500).json({ error: error.statusCode === 403 ? 'Sin acceso a este caso.' : 'No pude actualizar el caso.' });
  }
});

app.post('/api/inbox/conversations/:id/messages', authRequired, async (req, res) => {
  try {
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Falta el mensaje.' });
    const rows = await sb.select('conversaciones', `id_conversacion=eq.${req.params.id}&select=*`);
    const conversation = rows[0];
    if (!conversation) return res.status(404).json({ error: 'Conversación no encontrada.' });
    const detail = await getConversationDetail(req.params.id);
    if (!detail) return res.status(404).json({ error: 'No pude cargar el detalle del caso.' });
    ensureConversationAccess(req.user, detail.conversation);
    const phone = userPhoneFromConversation(conversation);
    if (!phone) return res.status(400).json({ error: 'No encontré el teléfono del cliente.' });

    await metaForConversation(conversation, detail.conversation).sendText(phone, text);
    await logAdvisorMessage(conversation, text, req.user);
    await patchConversation(req.params.id, {
      estado_conversacion: 'handoff',
      requiere_handoff: true,
      paso_actual: 'handoff_asesor',
      ultimo_mensaje_en: new Date().toISOString(),
    });
    const state = patchAdvisorConversation(req.params.id, (current) => ({
      ...current,
      internalStatus: 'open',
      handoffActive: true,
      supportStatus: 'tomado',
      assignedTo: current.assignedTo || req.user.id,
      assignedToLabel: current.assignedToLabel || advisorLabel(req.user),
      assignedAt: current.assignedAt || new Date().toISOString(),
      lastAgentMessageAt: new Date().toISOString(),
      lastOutboundAt: new Date().toISOString(),
      unreadCount: 0,
    }));
    await upsertSupportTicket({ conversation, phone, patch: {
      status: 'tomado',
      assigned_to: req.user.id,
      handoff_active: true,
      last_agent_message_at: new Date().toISOString(),
    } });
    scheduleCustomerIdleClose({
      conversationId: req.params.id,
      conversation,
      detailConversation: detail.conversation,
      phone,
      advisor: req.user,
    });
    res.json({ ok: true, state });
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || 500).json({ error: error.statusCode === 403 ? 'Sin acceso a este caso.' : humanizeSendError(error, { kind: 'message' }) });
  }
});

app.post('/api/inbox/conversations/:id/media', authRequired, async (req, res) => {
  try {
    const body = req.body || {};
    const fileName = String(body.fileName || 'archivo').trim();
    const mimeType = String(body.mimeType || 'application/octet-stream').trim() || 'application/octet-stream';
    const caption = String(body.caption || '').trim();
    const base64 = String(body.base64 || '').trim();
    if (!base64) return res.status(400).json({ error: 'Falta el archivo.' });
    const buffer = Buffer.from(base64, 'base64');
    if (!buffer.length) return res.status(400).json({ error: 'Archivo inválido.' });
    if (buffer.length > MEDIA_MAX_BYTES) return res.status(400).json({ error: 'El archivo excede el máximo permitido de 14 MB.' });

    const rows = await sb.select('conversaciones', `id_conversacion=eq.${req.params.id}&select=*`);
    const conversation = rows[0];
    if (!conversation) return res.status(404).json({ error: 'Conversación no encontrada.' });
    const detail = await getConversationDetail(req.params.id);
    if (!detail) return res.status(404).json({ error: 'No pude cargar el detalle del caso.' });
    ensureConversationAccess(req.user, detail.conversation);
    const phone = userPhoneFromConversation(conversation);
    if (!phone) return res.status(400).json({ error: 'No encontré el teléfono del cliente.' });

    const metaClient = metaForConversation(conversation, detail.conversation);
    const uploaded = await metaClient.uploadMedia({ buffer, mimeType, fileName });
    const mediaId = uploaded?.id;
    if (!mediaId) return res.status(500).json({ error: 'No pude subir el archivo a WhatsApp.' });

    const kind = mediaKindFromMime(mimeType);
    if (kind === 'image') {
      await metaClient.sendImage(phone, { mediaId, caption });
    } else {
      await metaClient.sendDocument(phone, { mediaId, caption, fileName });
    }

    const saved = saveConversationMedia({
      conversationId: conversation.id_conversacion,
      direction: 'outbound',
      fileName,
      mimeType,
      buffer,
    });

    await sb.insert('mensajes', {
      id_conversacion: conversation.id_conversacion,
      id_usuario: conversation.id_usuario,
      rol: 'assistant',
      contenido: caption || fileName,
      tipo_mensaje: kind,
      payload_crudo: {
        advisorId: req.user.id,
        advisorName: advisorLabel(req.user),
        advisorEmail: req.user.email,
        source: 'advisor_inbox',
        mediaUrl: saved.urlPath,
        mimeType,
        fileName,
        fileSize: buffer.length,
      },
    });

    await patchConversation(req.params.id, {
      estado_conversacion: 'handoff',
      requiere_handoff: true,
      paso_actual: 'handoff_asesor',
      ultimo_mensaje_en: new Date().toISOString(),
    });

    const state = patchAdvisorConversation(req.params.id, (current) => ({
      ...current,
      internalStatus: 'open',
      handoffActive: true,
      supportStatus: 'tomado',
      assignedTo: current.assignedTo || req.user.id,
      assignedToLabel: current.assignedToLabel || advisorLabel(req.user),
      assignedAt: current.assignedAt || new Date().toISOString(),
      lastAgentMessageAt: new Date().toISOString(),
      lastOutboundAt: new Date().toISOString(),
      unreadCount: 0,
    }));

    await upsertSupportTicket({ conversation, phone, patch: {
      status: 'tomado',
      assigned_to: req.user.id,
      handoff_active: true,
      last_agent_message_at: new Date().toISOString(),
    } });

    scheduleCustomerIdleClose({
      conversationId: req.params.id,
      conversation,
      detailConversation: detail.conversation,
      phone,
      advisor: req.user,
    });

    res.json({ ok: true, state, media: { kind, fileName, mimeType, url: saved.urlPath } });
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || 500).json({ error: error.statusCode === 403 ? 'Sin acceso a este caso.' : humanizeSendError(error, { kind: 'media' }) });
  }
});

app.post('/api/inbox/conversations/:id/messages/:messageId/forward-jeny', authRequired, async (req, res) => {
  try {
    const messageId = String(req.params.messageId || '').trim();
    if (!messageId) return res.status(400).json({ error: 'Falta el mensaje.' });
    const detail = await getConversationDetail(req.params.id);
    if (!detail) return res.status(404).json({ error: 'Conversación no encontrada.' });
    ensureConversationAccess(req.user, detail.conversation);

    const scopedIds = Array.isArray(detail.conversation?.conversationIds) && detail.conversation.conversationIds.length
      ? detail.conversation.conversationIds
      : [req.params.id];
    const rows = await sb.select(
      'mensajes',
      `id_mensaje=eq.${messageId}&id_conversacion=in.(${scopedIds.join(',')})&select=*`,
    );
    const message = Array.isArray(rows) ? rows[0] : null;
    if (!message) return res.status(404).json({ error: 'Mensaje no encontrado en el historial de este cliente.' });

    const forward = await forwardMessageToJeny({
      dbMessage: message,
      detailConversation: detail.conversation,
      advisor: req.user,
    });

    const jenyConversation = await ensureInternalWhatsAppConversation({
      phone: ADVISOR_FORWARD_JENY_PHONE,
      label: ADVISOR_FORWARD_JENY_LABEL,
      advisor: req.user,
    });

    await logForwardMirrorMessage({
      conversation: jenyConversation,
      originalMessage: message,
      advisor: req.user,
      forwardedTo: ADVISOR_FORWARD_JENY_PHONE,
      forwardedToLabel: ADVISOR_FORWARD_JENY_LABEL,
      customerContext: detail.conversation,
      introText: buildForwardIntro(detail.conversation),
    });

    await logSystemMessage(
      { id_conversacion: message.id_conversacion, id_usuario: message.id_usuario },
      `${advisorLabel(req.user)} reenvió un mensaje a ${ADVISOR_FORWARD_JENY_LABEL}.`,
      {
        systemAction: 'forward_jeny',
        advisorId: req.user.id,
        advisorName: advisorLabel(req.user),
        forwardedTo: ADVISOR_FORWARD_JENY_PHONE,
        forwardedToLabel: ADVISOR_FORWARD_JENY_LABEL,
        messageId: message.id_mensaje,
        sourceConversationId: message.id_conversacion,
      },
    );

    res.json({ ok: true, forward });
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || 500).json({
      error: error.statusCode === 403 ? 'Sin acceso a este caso.' : (error.message || `No pude reenviar a ${ADVISOR_FORWARD_JENY_LABEL}.`),
    });
  }
});

app.use((_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`EVINKA Advisor Inbox escuchando en http://127.0.0.1:${PORT}`);
});
