import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadEnv, requiredEnv } from './config.mjs';
import { SupabaseRest } from './supabase.mjs';
import { WhatsAppMetaClient } from './whatsappMeta.mjs';
import { patchAdvisorConversation, loadAdvisorState } from './advisorInboxState.mjs';
import { resolveConversationMedia, saveConversationMedia } from './advisorMediaStore.mjs';

loadEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceDir = path.resolve(__dirname, '..');
const publicDir = path.join(workspaceDir, 'advisor-inbox', 'public');
const dataDir = path.join(workspaceDir, 'advisor-inbox', 'data');
const usersFile = path.join(workspaceDir, 'cotizador-web', 'data', 'users.json');
const sessionsFile = path.join(dataDir, 'sessions.json');
const COOKIE_NAME = 'evinka_advisor_session';
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 12;
const PORT = Number(process.env.ADVISOR_INBOX_PORT || 14400);
const PHONE_DISPLAY_COUNTRY = process.env.ADVISOR_INBOX_PHONE_COUNTRY || '51';
const MEDIA_MAX_BYTES = 14 * 1024 * 1024;

const sb = new SupabaseRest({
  url: requiredEnv('SUPABASE_URL'),
  key: requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
});

const meta = new WhatsAppMetaClient({
  accessToken: requiredEnv('WHATSAPP_ACCESS_TOKEN'),
  phoneNumberId: requiredEnv('WHATSAPP_PHONE_NUMBER_ID'),
  appSecret: process.env.META_APP_SECRET,
});

fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(sessionsFile)) fs.writeFileSync(sessionsFile, '{}\n');

const app = express();
app.use(express.json({ limit: '1mb' }));
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

function readUsers() {
  return readJSON(usersFile, []).map((user) => ({ ...user, role: String(user.role || 'tech').toLowerCase(), status: String(user.status || 'active').toLowerCase() }));
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
    role: user.role,
    status: user.status,
  };
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

function sessionCookie(token) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_MAX_AGE_MS / 1000)}`;
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
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
  return String(conversation?.id_usuario || '').replace(/^whatsapp_/, '');
}

function userNameFromData(user = null, profile = null) {
  return profile?.nombre_receptor || user?.nombre_visible || user?.nombre_usuario || user?.correo_electronico || user?.telefono_principal || 'Cliente EVINKA';
}

function advisorLabel(user) {
  return user?.name || user?.email || 'Asesor EVINKA';
}

function mediaKindFromMime(mimeType = '') {
  return String(mimeType || '').startsWith('image/') ? 'image' : 'document';
}

function humanizeSendError(error) {
  const message = String(error?.message || '');
  if (message.includes('131030') || message.toLowerCase().includes('recipient phone number not in allowed list')) {
    return 'Meta bloqueó el envío porque este número no está en la lista autorizada del WhatsApp de prueba. Hay que agregarlo en Meta o usar un número/producto ya aprobado.';
  }
  if (message.includes('413') || message.toLowerCase().includes('too large')) {
    return 'El archivo es demasiado pesado para enviarlo por este canal.';
  }
  return 'No pude enviar el archivo.';
}

async function listInboxConversations() {
  const conversations = await sb.select('conversaciones', 'select=*&order=ultimo_mensaje_en.desc&limit=120');
  const state = loadAdvisorState();
  const relevant = conversations.filter((item) => item.estado_conversacion === 'handoff' || item.requiere_handoff || state.conversations?.[item.id_conversacion]);
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
  for (const message of messages) {
    const list = messagesByConversation.get(message.id_conversacion) || [];
    list.push(message);
    messagesByConversation.set(message.id_conversacion, list);
  }

  return relevant.map((conversation) => {
    const user = usersById[conversation.id_usuario] || null;
    const profile = profilesByConversation[conversation.id_conversacion] || null;
    const thread = messagesByConversation.get(conversation.id_conversacion) || [];
    const lastMessage = thread[thread.length - 1] || null;
    const local = state.conversations?.[conversation.id_conversacion] || {};
    return {
      id: conversation.id_conversacion,
      phone: userPhoneFromConversation(conversation) || user?.telefono_principal || '',
      phonePretty: phonePretty(userPhoneFromConversation(conversation) || user?.telefono_principal || ''),
      customerName: userNameFromData(user, profile),
      email: profile?.correo_receptor || user?.correo_electronico || '',
      district: profile?.distrito_instalacion || profile?.distrito_recibo || '',
      province: profile?.provincia_instalacion || profile?.provincia_recibo || '',
      currentStep: conversation.paso_actual || '',
      handoffReason: conversation.motivo_handoff || '',
      whatsappState: conversation.estado_conversacion,
      status: conversationStatus(conversation, local),
      assignedTo: local.assignedTo || null,
      assignedToLabel: local.assignedToLabel || null,
      assignedAt: local.assignedAt || null,
      unreadCount: Number(local.unreadCount || 0),
      tags: Array.isArray(local.tags) ? local.tags : [],
      lastMessageText: String(lastMessage?.contenido || '').slice(0, 220),
      lastMessageAt: lastMessage?.creado_en || conversation.ultimo_mensaje_en || conversation.actualizado_en,
      lastIncomingAt: local.lastIncomingAt || null,
      createdAt: conversation.creado_en,
      updatedAt: local.updatedAt || conversation.actualizado_en,
    };
  });
}

async function getConversationDetail(conversationId) {
  const rows = await sb.select('conversaciones', `id_conversacion=eq.${conversationId}&select=*`);
  const conversation = rows[0];
  if (!conversation) return null;
  const state = loadAdvisorState().conversations?.[conversationId] || {};
  const [users, profiles, messages] = await Promise.all([
    sb.select('usuarios', `id_usuario=eq.${encodeURIComponent(conversation.id_usuario)}&select=*`),
    sb.select('perfiles_cliente', `id_conversacion=eq.${conversationId}&select=*`),
    sb.select('mensajes', `id_conversacion=eq.${conversationId}&select=*&order=creado_en.asc&limit=400`),
  ]);
  const user = users[0] || null;
  const profile = profiles[0] || null;
  return {
    conversation: {
      id: conversation.id_conversacion,
      phone: userPhoneFromConversation(conversation) || user?.telefono_principal || '',
      phonePretty: phonePretty(userPhoneFromConversation(conversation) || user?.telefono_principal || ''),
      customerName: userNameFromData(user, profile),
      email: profile?.correo_receptor || user?.correo_electronico || '',
      step: conversation.paso_actual || '',
      handoffReason: conversation.motivo_handoff || '',
      whatsappState: conversation.estado_conversacion,
      status: conversationStatus(conversation, state),
      assignedTo: state.assignedTo || null,
      assignedToLabel: state.assignedToLabel || null,
      assignedAt: state.assignedAt || null,
      district: profile?.distrito_instalacion || profile?.distrito_recibo || '',
      province: profile?.provincia_instalacion || profile?.provincia_recibo || '',
      installationAddress: profile?.direccion_instalacion || '',
      receiptAddress: profile?.direccion_recibo || '',
      ticketContext: conversation.codigo_ticket_solicitado || '',
      tags: Array.isArray(state.tags) ? state.tags : [],
      unreadCount: Number(state.unreadCount || 0),
      createdAt: conversation.creado_en,
      updatedAt: state.updatedAt || conversation.actualizado_en,
    },
    messages: messages.map((message) => ({
      id: message.id_mensaje,
      role: message.rol,
      text: message.contenido,
      type: message.tipo_mensaje,
      createdAt: message.creado_en,
      advisorName: message.payload_crudo?.advisorName || null,
      advisorEmail: message.payload_crudo?.advisorEmail || null,
      systemAction: message.payload_crudo?.systemAction || null,
      mediaUrl: message.payload_crudo?.mediaUrl || null,
      mimeType: message.payload_crudo?.mimeType || null,
      fileName: message.payload_crudo?.fileName || null,
      fileSize: message.payload_crudo?.fileSize || null,
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

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  const users = readUsers();
  const user = users.find((item) => String(item.email || '').toLowerCase() === String(email || '').trim().toLowerCase());
  if (!user || user.status !== 'active' || !hashPasswordVerify(String(password || ''), user.passwordHash)) {
    return res.status(401).json({ error: 'Credenciales inválidas o cuenta sin acceso.' });
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
  res.json({ ok: true, user: safeUser(user) });
});

app.post('/api/logout', authOptional, (req, res) => {
  const sessions = readSessions();
  if (req.sessionToken) delete sessions[req.sessionToken];
  writeSessions(sessions);
  res.setHeader('Set-Cookie', clearSessionCookie());
  res.json({ ok: true });
});

app.get('/api/inbox/conversations', authRequired, async (req, res) => {
  try {
    const items = await listInboxConversations();
    const status = String(req.query.status || 'active').toLowerCase();
    const filtered = status === 'all'
      ? items
      : status === 'resolved'
        ? items.filter((item) => item.status === 'resolved')
        : items.filter((item) => item.status !== 'resolved');
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
    patchAdvisorConversation(req.params.id, (current) => ({ ...current, unreadCount: 0, lastOpenedAt: new Date().toISOString() }));
    res.json(detail);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No pude cargar la conversación.' });
  }
});

app.patch('/api/inbox/conversations/:id', authRequired, async (req, res) => {
  try {
    const body = req.body || {};
    const action = String(body.action || '').trim().toLowerCase();
    const rows = await sb.select('conversaciones', `id_conversacion=eq.${req.params.id}&select=*`);
    const conversation = rows[0];
    if (!conversation) return res.status(404).json({ error: 'Conversación no encontrada.' });

    if (action === 'claim') {
      const state = patchAdvisorConversation(req.params.id, (current) => ({
        ...current,
        internalStatus: 'open',
        assignedTo: req.user.id,
        assignedToLabel: advisorLabel(req.user),
        assignedAt: current.assignedAt || new Date().toISOString(),
        unreadCount: 0,
      }));
      await logSystemMessage(conversation, `${advisorLabel(req.user)} tomó este caso.`, { systemAction: 'claim', advisorId: req.user.id, advisorName: advisorLabel(req.user) });
      return res.json({ ok: true, state });
    }

    if (action === 'resolve') {
      const patched = await patchConversation(req.params.id, {
        estado_conversacion: 'closed',
        requiere_handoff: false,
        cerrada_en: new Date().toISOString(),
      });
      const state = patchAdvisorConversation(req.params.id, (current) => ({
        ...current,
        internalStatus: 'resolved',
        resolvedBy: req.user.id,
        resolvedByLabel: advisorLabel(req.user),
        resolvedAt: new Date().toISOString(),
        unreadCount: 0,
      }));
      await logSystemMessage(conversation, `${advisorLabel(req.user)} marcó el caso como resuelto.`, { systemAction: 'resolve', advisorId: req.user.id, advisorName: advisorLabel(req.user) });
      return res.json({ ok: true, conversation: patched, state });
    }

    if (action === 'return_to_bot') {
      const patched = await patchConversation(req.params.id, {
        estado_conversacion: 'open',
        requiere_handoff: false,
        motivo_handoff: null,
        paso_actual: 'menu_principal',
        subestado_flujo: 'retorno_desde_asesor',
        ultimo_mensaje_en: new Date().toISOString(),
      });
      const text = 'Listo 👍\n\nCerré la atención humana y te devolví con el asistente de EVINKA. Si deseas continuar, escribe MENU.';
      await meta.sendText(userPhoneFromConversation(conversation), text);
      await logAdvisorMessage(conversation, text, req.user);
      const state = patchAdvisorConversation(req.params.id, (current) => ({
        ...current,
        internalStatus: 'resolved',
        resolvedBy: req.user.id,
        resolvedByLabel: advisorLabel(req.user),
        resolvedAt: new Date().toISOString(),
        unreadCount: 0,
      }));
      await logSystemMessage(conversation, `${advisorLabel(req.user)} devolvió el caso al bot.`, { systemAction: 'return_to_bot', advisorId: req.user.id, advisorName: advisorLabel(req.user) });
      return res.json({ ok: true, conversation: patched, state });
    }

    return res.status(400).json({ error: 'Acción inválida.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No pude actualizar el caso.' });
  }
});

app.post('/api/inbox/conversations/:id/messages', authRequired, async (req, res) => {
  try {
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Falta el mensaje.' });
    const rows = await sb.select('conversaciones', `id_conversacion=eq.${req.params.id}&select=*`);
    const conversation = rows[0];
    if (!conversation) return res.status(404).json({ error: 'Conversación no encontrada.' });
    const phone = userPhoneFromConversation(conversation);
    if (!phone) return res.status(400).json({ error: 'No encontré el teléfono del cliente.' });

    await meta.sendText(phone, text);
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
      assignedTo: current.assignedTo || req.user.id,
      assignedToLabel: current.assignedToLabel || advisorLabel(req.user),
      assignedAt: current.assignedAt || new Date().toISOString(),
      lastOutboundAt: new Date().toISOString(),
      unreadCount: 0,
    }));
    res.json({ ok: true, state });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: humanizeSendError(error) });
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
    const phone = userPhoneFromConversation(conversation);
    if (!phone) return res.status(400).json({ error: 'No encontré el teléfono del cliente.' });

    const uploaded = await meta.uploadMedia({ buffer, mimeType, fileName });
    const mediaId = uploaded?.id;
    if (!mediaId) return res.status(500).json({ error: 'No pude subir el archivo a WhatsApp.' });

    const kind = mediaKindFromMime(mimeType);
    if (kind === 'image') {
      await meta.sendImage(phone, { mediaId, caption });
    } else {
      await meta.sendDocument(phone, { mediaId, caption, fileName });
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
      assignedTo: current.assignedTo || req.user.id,
      assignedToLabel: current.assignedToLabel || advisorLabel(req.user),
      assignedAt: current.assignedAt || new Date().toISOString(),
      lastOutboundAt: new Date().toISOString(),
      unreadCount: 0,
    }));

    res.json({ ok: true, state, media: { kind, fileName, mimeType, url: saved.urlPath } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: humanizeSendError(error) });
  }
});

app.use((_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`EVINKA Advisor Inbox escuchando en http://127.0.0.1:${PORT}`);
});
