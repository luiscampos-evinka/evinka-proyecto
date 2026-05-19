import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import ExcelJS from 'exceljs';
import { loadEnv, requiredEnv } from './config.mjs';
import { appendAccessAuditLog, readAccessAuditLogs } from './accessAudit.mjs';
import { SupabaseRest } from './supabase.mjs';
import { MicrosoftGraphClient } from './microsoftGraph.mjs';

loadEnv();

const sb = new SupabaseRest({
  url: requiredEnv('SUPABASE_URL'),
  key: requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
});

const PORT = Number(process.env.STATUS_AUTH_PORT || 8790);
const DB_PATH = process.env.STATUS_AUTH_DB_PATH || '/root/.openclaw/workspace/data/status-auth-db.json';
const STATUS_PREFS_PATH = process.env.STATUS_PREFS_PATH || '/root/.openclaw/workspace/data/status-notification-prefs.json';
const STATUS_NOTIFICATION_CONFIG_PATH = process.env.STATUS_NOTIFICATION_CONFIG_PATH || '/root/.openclaw/workspace/data/status-notification-config.json';
const STATUS_EXPORTS_CACHE_PATH = process.env.STATUS_EXPORTS_CACHE_PATH || '/root/.openclaw/workspace/data/status-exports-cache.json';
const STATUS_CONNECT_USERS_CACHE_PATH = process.env.STATUS_CONNECT_USERS_CACHE_PATH || '/root/.openclaw/workspace/data/status-connect-users-cache.json';
const STATUS_COTIZADOR_CLIENTS_PATH = process.env.STATUS_COTIZADOR_CLIENTS_PATH || '/root/.openclaw/workspace/apps/cotizador-web/data/clients.json';
const STATUS_AUDIT_QUOTES_PATH = process.env.STATUS_AUDIT_QUOTES_PATH || '/root/.openclaw/workspace/apps/cotizador-web/data/quotes.json';
const STATUS_AUDIT_INSTALLATION_ORDERS_PATH = process.env.STATUS_AUDIT_INSTALLATION_ORDERS_PATH || '/root/.openclaw/workspace/apps/cotizador-web/data/installation-orders.json';
const STATUS_AUDIT_TECH_VISITS_PATH = process.env.STATUS_AUDIT_TECH_VISITS_PATH || '/root/.openclaw/workspace/apps/cotizador-web/data/tech-visits.json';
const STATUS_AUDIT_CONFORMITIES_PATH = process.env.STATUS_AUDIT_CONFORMITIES_PATH || '/root/.openclaw/workspace/apps/cotizador-web/data/conformities.json';
const STATUS_AUDIT_COTIZADOR_SESSIONS_PATH = process.env.STATUS_AUDIT_COTIZADOR_SESSIONS_PATH || '/root/.openclaw/workspace/apps/cotizador-web/data/sessions.json';
const STATUS_AUDIT_ADVISOR_SESSIONS_PATH = process.env.STATUS_AUDIT_ADVISOR_SESSIONS_PATH || '/root/.openclaw/workspace/apps/advisor-inbox/data/sessions.json';
const STATUS_AUDIT_OPERATIONAL_USERS_PATH = process.env.STATUS_AUDIT_OPERATIONAL_USERS_PATH || '/root/.openclaw/workspace/apps/cotizador-web/data/users.json';
const STATUS_PERSONAL_DATA_OWNER_EMAIL = String(process.env.STATUS_PERSONAL_DATA_OWNER_EMAIL || 'lorena.vargas@evinka.tech').trim().toLowerCase();
const AUDIT_LOG_LIMIT = Number(process.env.STATUS_AUDIT_LOG_LIMIT || 5000);
const DEFAULT_TARGET_PHONE = '51904432138';
const ALLOWED_DOMAIN = 'evinka.tech';
const ALLOWED_ADMIN_DOMAIN = 'evinkatech.onmicrosoft.com';
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const TRUSTED_DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CONNECT_USERS_CACHE_TTL_MS = 15 * 60 * 1000;
const CONNECT_USERS_EXPORT_START = '2020-01-01T00:00:00.000Z';
const SESSION_COOKIE = 'evinka_status_session';
const DEVICE_COOKIE = 'evinka_status_device';
const MAX_CODE_ATTEMPTS = 5;
const EMAIL_FROM_NAME = process.env.MICROSOFT_SENDER_NAME || 'EVINKA';
const PASSWORD_POLICY_HINT = 'La contraseña debe tener al menos 12 caracteres e incluir mayúscula, minúscula, número y símbolo.';
const EVINKA_BASE_URL = 'https://connect.evinka.net';
const EVINKA_EXPORT_KINDS = [
  { value: 'transaction', label: 'Transacción', enabled: true },
  { value: 'recharge', label: 'Recargar', enabled: true },
  { value: 'appuser', label: 'Usuaria', enabled: true },
  { value: 'invoice', label: 'Invoice', enabled: false },
];
const EXPORT_COLUMN_DEFS = {
  transaction: {
    label: 'Transacción',
    columns: ['StartTime', 'EndTime', 'CalibrationTime', 'Time Duration', 'User', 'Energy', 'Initial SoC', 'Final SoC', 'SoC Increment', 'Fee', 'EnergyFee', 'ServiceFee', 'Plaza', 'Station', 'StopReason', 'Coupon', 'Discount', 'NetFee'],
    presets: {
      basic: ['StartTime', 'User', 'Energy', 'Fee', 'Plaza', 'Station', 'StopReason'],
      financial: ['StartTime', 'User', 'Energy', 'Fee', 'EnergyFee', 'ServiceFee', 'Coupon', 'Discount', 'NetFee'],
      operational: ['StartTime', 'EndTime', 'Time Duration', 'Plaza', 'Station', 'Energy', 'StopReason'],
    },
  },
  recharge: {
    label: 'Recargar',
    columns: ['DateTime', 'User', 'Amount', 'Balance', 'Status'],
    presets: {
      basic: ['DateTime', 'User', 'Amount', 'Status'],
      financial: ['DateTime', 'User', 'Amount', 'Balance', 'Status'],
      operational: ['DateTime', 'User', 'Amount', 'Status'],
    },
  },
  appuser: {
    label: 'Usuaria',
    columns: ['Email', 'FirstName', 'LastName', 'Birthday', 'PhoneNumber', 'Identity', 'CreatedAt'],
    presets: {
      basic: ['Email', 'FirstName', 'LastName', 'PhoneNumber', 'CreatedAt'],
      customer: ['Email', 'FirstName', 'LastName', 'PhoneNumber', 'Identity'],
      registration: ['Email', 'CreatedAt', 'PhoneNumber'],
    },
  },
};

const mailer = process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
  ? new MicrosoftGraphClient()
  : null;

function openAiMailConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    model: process.env.OPENAI_MAIL_MODEL || process.env.OPENAI_RECEIPT_MODEL || 'gpt-5-nano',
  };
}

const rateLimits = new Map();

function defaultDb() {
  return {
    meta: { createdAt: new Date().toISOString() },
    users: [],
    challenges: [],
    passwordResetGrants: [],
    sessions: [],
    trustedDevices: [],
    auditLogs: [],
  };
}

function ensureDbFile() {
  const dir = path.dirname(DB_PATH);
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultDb(), null, 2));
    fs.chmodSync(DB_PATH, 0o600);
  }
}

function ensureJsonFile(filePath, fallback) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
  }
}

function readJsonFile(filePath, fallback) {
  ensureJsonFile(filePath, fallback);
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw ? JSON.parse(raw) : fallback;
}

function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function readJsonArraySafe(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadDb() {
  ensureDbFile();
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  const parsed = raw ? JSON.parse(raw) : defaultDb();
  return cleanupDb(parsed);
}

function saveDb(db) {
  const temp = `${DB_PATH}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(db, null, 2));
  fs.chmodSync(temp, 0o600);
  fs.renameSync(temp, DB_PATH);
}

function cleanupDb(db) {
  const now = Date.now();
  db.users ||= [];
  db.challenges ||= [];
  db.passwordResetGrants ||= [];
  db.sessions ||= [];
  db.trustedDevices ||= [];
  db.auditLogs ||= [];
  db.challenges = db.challenges.filter((challenge) => new Date(challenge.expiresAt).getTime() > now && !challenge.usedAt);
  db.passwordResetGrants = db.passwordResetGrants.filter((grant) => new Date(grant.expiresAt).getTime() > now && !grant.usedAt);
  db.sessions = db.sessions.filter((session) => new Date(session.expiresAt).getTime() > now);
  db.trustedDevices = db.trustedDevices.filter((device) => new Date(device.expiresAt).getTime() > now);
  if (db.auditLogs.length > AUDIT_LOG_LIMIT) db.auditLogs = db.auditLogs.slice(-AUDIT_LOG_LIMIT);
  return db;
}

function sendJson(res, code, payload, extraHeaders = {}) {
  res.writeHead(code, { 'Content-Type': 'application/json', ...extraHeaders });
  res.end(JSON.stringify(payload));
}

function sendBytes(res, code, buffer, extraHeaders = {}) {
  res.writeHead(code, extraHeaders);
  res.end(buffer);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error('JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

function decodeHtmlEntities(value = '') {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function parseSetCookie(setCookieValue = '') {
  const parts = String(setCookieValue || '').split(';').map((part) => part.trim()).filter(Boolean);
  const [nameValue, ...attrs] = parts;
  if (!nameValue || !nameValue.includes('=')) return null;
  const idx = nameValue.indexOf('=');
  const name = nameValue.slice(0, idx).trim();
  const value = nameValue.slice(idx + 1).trim();
  const domainAttr = attrs.find((attr) => attr.toLowerCase().startsWith('domain='));
  const domain = domainAttr ? domainAttr.slice(7).trim().toLowerCase() : null;
  return { name, value, domain };
}

class SimpleCookieJar {
  constructor() {
    this.cookies = [];
  }

  setFromCookieHeader(cookieHeader = '', url = null) {
    const host = url ? new URL(url).hostname.toLowerCase() : null;
    for (const part of String(cookieHeader || '').split(';').map((x) => x.trim()).filter(Boolean)) {
      const idx = part.indexOf('=');
      if (idx === -1) continue;
      this.set({ name: part.slice(0, idx), value: part.slice(idx + 1), domain: host });
    }
  }

  set(cookie) {
    if (!cookie?.name) return;
    const domain = String(cookie.domain || '').toLowerCase() || null;
    this.cookies = this.cookies.filter((item) => !(item.name === cookie.name && (item.domain || null) === domain));
    this.cookies.push({ name: cookie.name, value: cookie.value, domain });
  }

  absorb(url, response) {
    const raw = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')] : []);
    const host = new URL(url).hostname.toLowerCase();
    for (const item of raw) {
      const parsed = parseSetCookie(item);
      if (!parsed) continue;
      this.set({ ...parsed, domain: parsed.domain || host });
    }
  }

  header(url) {
    const host = new URL(url).hostname.toLowerCase();
    return this.cookies
      .filter((cookie) => !cookie.domain || host === cookie.domain || host.endsWith(cookie.domain.replace(/^\./, '')))
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join('; ');
  }
}

async function fetchWithCookies(url, { jar, method = 'GET', headers = {}, body = undefined, redirect = 'manual' } = {}) {
  const cookie = jar?.header(url);
  const res = await fetch(url, {
    method,
    headers: {
      'user-agent': 'EVINKA Status Center/1.0',
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body,
    redirect,
  });
  jar?.absorb(url, res);
  return res;
}

function extractLoginForm(html = '') {
  const actionMatch = html.match(/<form[^>]+id="kc-form-login"[^>]+action="([^"]+)"/i) || html.match(/<form[^>]+action="([^"]+)"/i);
  const action = actionMatch ? decodeHtmlEntities(actionMatch[1]) : null;
  const fields = {};
  for (const match of html.matchAll(/<input[^>]+name="([^"]+)"[^>]*value="([^"]*)"[^>]*>/gi)) {
    fields[match[1]] = decodeHtmlEntities(match[2]);
  }
  return { action, fields };
}

let connectSessionCache = null;

async function loginToEvinka({ username, password }) {
  const jar = new SimpleCookieJar();
  const seedUrl = `${EVINKA_BASE_URL}/api/v1/admin/merchants/-/plazas/-/stationoverview`;
  const initial = await fetchWithCookies(seedUrl, { jar, redirect: 'manual' });
  const location = initial.headers.get('location');
  if (!location) throw new Error('No pude obtener la redirección de login de EVINKA Connect.');

  const loginPage = await fetchWithCookies(location, { jar, redirect: 'manual' });
  const html = await loginPage.text();
  const { action, fields } = extractLoginForm(html);
  if (!action) throw new Error('No pude encontrar el formulario de login de EVINKA Connect.');

  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  form.set('username', username);
  form.set('password', password);
  if (!form.has('credentialId')) form.set('credentialId', '');
  if (!form.has('login')) form.set('login', 'Sign In');

  let res = await fetchWithCookies(action, {
    jar,
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
    redirect: 'manual',
  });

  for (let i = 0; i < 10 && [301, 302, 303, 307, 308].includes(res.status); i += 1) {
    const next = res.headers.get('location');
    if (!next) break;
    res = await fetchWithCookies(new URL(next, res.url).toString(), { jar, redirect: 'manual' });
  }

  const userInfo = await fetchWithCookies(`${EVINKA_BASE_URL}/oauth2/userinfo`, { jar, redirect: 'manual' });
  if (userInfo.status !== 200) throw new Error('Las credenciales de EVINKA Connect no autenticaron correctamente.');
  return { jar, userinfo: await userInfo.json() };
}

async function getConnectJar({ forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && connectSessionCache?.jar && now - connectSessionCache.createdAt < 15 * 60 * 1000) {
    return connectSessionCache.jar;
  }

  const cookie = process.env.EVINKA_CONNECT_COOKIE || '';
  const username = process.env.EVINKA_CONNECT_USERNAME || '';
  const password = process.env.EVINKA_CONNECT_PASSWORD || '';
  let lastError = null;

  if (cookie) {
    try {
      const jar = new SimpleCookieJar();
      jar.setFromCookieHeader(cookie, EVINKA_BASE_URL);
      const info = await fetchWithCookies(`${EVINKA_BASE_URL}/oauth2/userinfo`, { jar, redirect: 'manual' });
      if (info.status === 200) {
        connectSessionCache = { jar, createdAt: now };
        return jar;
      }
      lastError = new Error(`Cookie de EVINKA inválida (${info.status})`);
    } catch (error) {
      lastError = error;
    }
  }

  if (username && password) {
    const session = await loginToEvinka({ username, password });
    connectSessionCache = { jar: session.jar, createdAt: now };
    return session.jar;
  }

  throw lastError || new Error('No hay acceso configurado a EVINKA Connect.');
}

async function connectJson(pathname, { method = 'GET', body = null, forceRefresh = false } = {}) {
  const jar = await getConnectJar({ forceRefresh });
  const res = await fetchWithCookies(`${EVINKA_BASE_URL}${pathname}`, {
    jar,
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  if ([301, 302, 303, 307, 308].includes(res.status)) {
    if (!forceRefresh) return connectJson(pathname, { method, body, forceRefresh: true });
    throw new Error('EVINKA Connect pidió relogin.');
  }
  const text = await res.text();
  let data = {};
  if (text) {
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
  }
  if (!res.ok) throw new Error(data.message || data.title || `EVINKA Connect devolvió ${res.status}`);
  return data;
}

async function connectBytes(pathname, { forceRefresh = false } = {}) {
  const jar = await getConnectJar({ forceRefresh });
  const res = await fetchWithCookies(`${EVINKA_BASE_URL}${pathname}`, { jar, redirect: 'manual' });
  if ([301, 302, 303, 307, 308].includes(res.status)) {
    if (!forceRefresh) return connectBytes(pathname, { forceRefresh: true });
    throw new Error('EVINKA Connect pidió relogin.');
  }
  if (!res.ok) throw new Error(`EVINKA Connect devolvió ${res.status}`);
  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    contentType: res.headers.get('content-type') || 'application/octet-stream',
    disposition: res.headers.get('content-disposition') || '',
  };
}

async function probeExportReady(row, { forceRefresh = false } = {}) {
  const fileName = row?.fileNames?.[0];
  const exportId = row?.id;
  if (!exportId || !fileName) return false;
  const jar = await getConnectJar({ forceRefresh });
  const pathname = `/api/v1/admin/files/xlsxexport?xlsxExportId=${encodeURIComponent(exportId)}&fileName=${encodeURIComponent(fileName)}`;
  const res = await fetchWithCookies(`${EVINKA_BASE_URL}${pathname}`, {
    jar,
    headers: { Range: 'bytes=0-0' },
    redirect: 'manual',
  });
  if ([301, 302, 303, 307, 308].includes(res.status)) {
    if (!forceRefresh) return probeExportReady(row, { forceRefresh: true });
    return false;
  }
  if (res.status === 200 || res.status === 206) {
    try { await res.arrayBuffer(); } catch {}
    return true;
  }
  return false;
}

function normalizeExportKind(value = '') {
  const kind = String(value || '').trim().toLowerCase();
  return EVINKA_EXPORT_KINDS.find((item) => item.value === kind)?.value || kind;
}

function cleanDownloadFilename(fileName = '', kind = 'export') {
  const safe = String(fileName || '').replace(/\.xlsx$/i, '');
  return `${safe || kind}_clean.xlsx`.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function safeAttachmentFilename(value = '', fallback = 'EVINKA.xlsx') {
  const clean = String(value || fallback)
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clean || fallback;
}

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function humanDateForFilename(value) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Sin fecha';
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${String(date.getUTCDate()).padStart(2, '0')} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function buildExportDisplayFilename(row, { clean = false } = {}) {
  if (!row) return clean ? 'EVINKA - Export - Limpio.xlsx' : 'EVINKA - Export - Original.xlsx';
  const kind = ({ transaction: 'Transacción', recharge: 'Recargar', appuser: 'Usuaria', invoice: 'Invoice' }[String(row.kind || '').toLowerCase()] || row.kind || 'Export');
  const merchant = row.merchant || 'Toda la red';
  const range = `${humanDateForFilename(row.startTime)} al ${humanDateForFilename(row.endTime)}`;
  const suffix = clean ? 'Limpio' : 'Original';
  return safeAttachmentFilename(`EVINKA - ${kind} - ${merchant} - ${range} - ${suffix}.xlsx`, 'EVINKA.xlsx');
}

function exportKindLabel(kind = '') {
  return ({ transaction: 'Transacción', recharge: 'Recargar', appuser: 'Usuaria', invoice: 'Invoice' }[String(kind || '').toLowerCase()] || kind || 'Export');
}

function buildExportMailContent(row, { clean = false } = {}) {
  const kind = exportKindLabel(row?.kind || 'export');
  const merchant = row?.merchant || 'Toda la red';
  const range = `${humanDateForFilename(row?.startTime)} al ${humanDateForFilename(row?.endTime)}`;
  const variant = clean ? 'archivo limpio' : 'archivo original';
  const subject = `EVINKA | ${kind} | ${merchant} | ${range}`;
  const text = [
    'Hola,',
    '',
    `Te comparto el ${variant} del export ${kind.toLowerCase()} de EVINKA.`,
    `Comerciante: ${merchant}`,
    `Rango: ${range}`,
    '',
    'Adjunto encontrarás el archivo correspondiente.',
    '',
    'Saludos,',
    'EVINKA',
  ].join('\n');
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#1f2937;line-height:1.6;">
      <p>Hola,</p>
      <p>Te comparto el <strong>${escapeHtml(variant)}</strong> del export <strong>${escapeHtml(kind.toLowerCase())}</strong> de EVINKA.</p>
      <p><strong>Comerciante:</strong> ${escapeHtml(merchant)}<br /><strong>Rango:</strong> ${escapeHtml(range)}</p>
      <p>Adjunto encontrarás el archivo correspondiente.</p>
      <p>Saludos,<br />EVINKA</p>
    </div>
  `;
  return { subject, text, html };
}

function mailTextToHtml(text = '') {
  const paragraphs = String(text || '').trim().split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  if (!paragraphs.length) return '';
  return `
    <div style="font-family:Inter,Arial,sans-serif;color:#1f2937;line-height:1.6;">
      ${paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`).join('')}
    </div>
  `;
}

function normalizeRequestedExports(body = {}) {
  if (Array.isArray(body.exports) && body.exports.length) return body.exports;
  if (body.xlsxExportId || body.fileName) {
    return [{
      xlsxExportId: body.xlsxExportId,
      fileName: body.fileName,
      kind: body.kind,
      variant: body.variant,
      columns: body.columns,
    }];
  }
  return [];
}

async function buildExportMailDraftWithAi({ exports = [], recipients = [], context = '', variant = 'original' }) {
  const cfg = openAiMailConfig();
  if (!cfg) throw new Error('No hay OpenAI configurado para redactar correos.');
  const cleanedExports = exports.map((item, index) => ({
    orden: index + 1,
    tipo: exportKindLabel(item.kind || 'export'),
    comerciante: item.merchant || 'Toda la red',
    rango: `${humanDateForFilename(item.startTime)} al ${humanDateForFilename(item.endTime)}`,
    archivo: item.downloadName || buildExportDisplayFilename(item, { clean: String(variant || 'original').toLowerCase() === 'clean' }),
  }));

  const res = await fetch(`${cfg.baseUrl}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      input: [{
        role: 'user',
        content: [{
          type: 'input_text',
          text: [
            'Redacta un correo formal y empresarial en español para enviar reportes y múltiples archivos exportados adjuntos.',
            'No menciones IA, GPT ni automatización.',
            'Debe sonar natural y corporativo.',
            'Devuelve JSON estricto con las claves: subject, text.',
            'El cuerpo debe estar en texto plano, bien estructurado, sin markdown.',
            'Dentro del cuerpo, incluye una sección llamada "Detalle de exports enviados:" y enumera cada export con su tipo, comerciante y rango de fechas correspondiente.',
            '',
            `Variante de archivo: ${String(variant || 'original').toLowerCase() === 'clean' ? 'limpio' : 'original'}`,
            `Destinatarios: ${recipients.length ? recipients.join(', ') : 'No especificados'}`,
            `Contexto adicional: ${String(context || '').trim() || 'Sin contexto adicional'}`,
            '',
            `Exports: ${JSON.stringify(cleanedExports, null, 2)}`,
          ].join('\n'),
        }],
      }],
      text: { format: { type: 'json_object' } },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI mail draft -> ${res.status} ${res.statusText}\n${body}`);
  }

  const data = await res.json();
  const rawJson = data?.output_text
    || data?.output?.map((item) => (item?.content || []).map((part) => part?.text || '').join('\n')).join('\n')
    || '{}';
  let parsed = null;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    const match = String(rawJson).match(/\{[\s\S]*\}/);
    parsed = match ? JSON.parse(match[0]) : null;
  }
  const subject = String(parsed?.subject || parsed?.asunto || '').trim();
  const text = String(parsed?.text || parsed?.body || parsed?.correo || '').trim();
  if (!subject || !text) throw new Error('La IA no devolvió un asunto y cuerpo válidos.');
  return { subject, text, html: mailTextToHtml(text) };
}

async function getExportFileBytes({ exportId, fileName, kind = 'transaction', columns = [], clean = false }) {
  const file = await connectBytes(`/api/v1/admin/files/xlsxexport?xlsxExportId=${encodeURIComponent(exportId)}&fileName=${encodeURIComponent(fileName)}`);
  if (!clean) {
    return {
      buffer: file.buffer,
      contentType: file.contentType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evinka-clean-export-'));
  const inputPath = path.join(tempDir, 'input.xlsx');
  const outputPath = path.join(tempDir, 'output.xlsx');
  try {
    fs.writeFileSync(inputPath, file.buffer);
    execFileSync('python3', [
      path.join('/root/.openclaw/workspace', 'scripts/filter_xlsx_columns.py'),
      inputPath,
      outputPath,
      '--columns',
      columns.join(','),
    ], { stdio: 'pipe' });
    return {
      buffer: fs.readFileSync(outputPath),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  } finally {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
}

function exportColumnsPayload() {
  return Object.fromEntries(Object.entries(EXPORT_COLUMN_DEFS).map(([kind, def]) => [kind, {
    label: def.label,
    columns: def.columns,
    presets: def.presets,
  }]));
}

function isRestrictedPersonalExportKind(kind = '') {
  return normalizeExportKind(kind) === 'appuser';
}

async function loadExportMeta({ user = null } = {}) {
  const merchantsData = await connectJson('/api/v1/admin/merchants?page_size=200&page=1');
  const merchants = (merchantsData.merchants || []).map((item) => ({
    id: item.id,
    label: item.displayName || item.id,
  }));
  const plazasByMerchant = {};
  await Promise.all(merchants.map(async (merchant) => {
    try {
      const data = await connectJson(`/api/v1/admin/merchants/${encodeURIComponent(merchant.id)}/plazadigests`);
      plazasByMerchant[merchant.id] = (data || []).map((plaza) => ({
        id: plaza.id,
        label: plaza.displayName || plaza.id,
        address: plaza.address || '',
      }));
    } catch {
      plazasByMerchant[merchant.id] = [];
    }
  }));
  const allowAppUser = canAccessPersonalData(user);
  return {
    kinds: EVINKA_EXPORT_KINDS.filter((item) => allowAppUser || item.value !== 'appuser'),
    columnDefs: Object.fromEntries(Object.entries(exportColumnsPayload()).filter(([kind]) => allowAppUser || kind !== 'appuser')),
    merchants,
    plazasByMerchant,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickUserValue(row = {}, keys = []) {
  for (const key of keys) {
    const value = row?.[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function mergeUniqueStrings(...lists) {
  return [...new Set(lists.flat().map((item) => String(item || '').trim()).filter(Boolean))];
}

function mergeUserRecords(prev = {}, next = {}) {
  const keys = ['email', 'firstName', 'lastName', 'fullName', 'phone', 'identity', 'birthday', 'createdAt', 'countryCode', 'sourceNote'];
  const merged = { ...prev };
  for (const key of keys) {
    const prevValue = String(prev?.[key] || '').trim();
    const nextValue = String(next?.[key] || '').trim();
    merged[key] = nextValue || prevValue || '';
  }
  merged.sources = mergeUniqueStrings(prev?.sources || [], next?.sources || []);
  merged.sourceLabels = mergeUniqueStrings(prev?.sourceLabels || [], next?.sourceLabels || []);
  return merged;
}

function normalizeConnectUserRow(row = {}, index = 0) {
  const email = pickUserValue(row, ['Email', 'email']);
  const firstName = pickUserValue(row, ['FirstName', 'First Name', 'Nombre']);
  const lastName = pickUserValue(row, ['LastName', 'Last Name', 'Apellido']);
  const phone = pickUserValue(row, ['PhoneNumber', 'Phone', 'CellPhone', 'Cellphone', 'Telefono', 'Teléfono']);
  const identity = pickUserValue(row, ['Identity', 'Document', 'Documento']);
  const birthday = pickUserValue(row, ['Birthday', 'BirthDate', 'FechaNacimiento']);
  const createdAt = pickUserValue(row, ['CreatedAt', 'Created At', 'RegisterDate', 'RegistrationDate']);
  const fullName = `${firstName} ${lastName}`.replace(/\s+/g, ' ').trim() || pickUserValue(row, ['FullName', 'Name', 'NombreCompleto']);
  return {
    id: email || identity || phone || `row-${index + 1}`,
    email,
    firstName,
    lastName,
    fullName,
    phone,
    identity,
    birthday,
    createdAt,
    sources: ['connect'],
    sourceLabels: ['Connect'],
    sourceNote: 'EVINKA Connect',
    countryCode: '',
  };
}

function normalizeSupplementUserRecord(record = {}, { source = 'extra', label = 'Extra', index = 0 } = {}) {
  const email = normalizeEmail(
    record.email
    || record.correo_electronico
    || record.correo
    || record.correo_receptor
    || record.email_cliente
    || ''
  );
  const phone = String(
    record.phone
    || record.telefono
    || record.telefono_principal
    || record.telefono_cliente
    || record.telefono_receptor
    || record.celular
    || ''
  ).trim();
  const fullName = normalizePersonName(
    record.fullName
    || record.full_name
    || record.nombre_visible
    || record.nombre_usuario
    || record.nombre_cliente
    || record.nombre_receptor
    || record.firstName
    || record.fullName
    || ''
  );
  const firstName = normalizePersonName(record.firstName || record.first_name || '').split(' ')[0] || '';
  const lastName = normalizePersonName(record.lastName || record.last_name || '').replace(/^\S+\s*/, '');
  const identity = String(
    record.identity
    || record.documentNumber
    || record.document_number
    || record.documento
    || record.documento_numero
    || record.documentNumber
    || ''
  ).trim();
  const createdAt = String(record.createdAt || record.created_at || record.updatedAt || '').trim();
  const countryCode = String(record.countryCode || record.country_code || '').trim().toUpperCase();
  return {
    id: email || identity || phone || `${source}-${index + 1}`,
    email,
    firstName,
    lastName,
    fullName,
    phone,
    identity,
    birthday: '',
    createdAt,
    sources: [source],
    sourceLabels: [label],
    sourceNote: label,
    countryCode,
  };
}

async function fetchChatbotUsersSnapshot() {
  const [userRows, profileRows] = await Promise.all([
    sb.select('usuarios', 'select=*').catch(() => []),
    sb.select('perfiles_cliente', 'select=*').catch(() => []),
  ]);
  const mapped = [];
  for (const row of Array.isArray(userRows) ? userRows : []) {
    mapped.push(normalizeSupplementUserRecord(row, { source: 'chatbot', label: 'Chatbot', index: mapped.length }));
  }
  for (const row of Array.isArray(profileRows) ? profileRows : []) {
    mapped.push(normalizeSupplementUserRecord(row, { source: 'chatbot', label: 'Chatbot', index: mapped.length }));
  }
  return mapped.filter((row) => row.email || row.phone || row.fullName || row.identity);
}

function fetchCotizadorClientSnapshot() {
  const rows = readJsonFile(STATUS_COTIZADOR_CLIENTS_PATH, []);
  return (Array.isArray(rows) ? rows : [])
    .map((row, index) => normalizeSupplementUserRecord({
      ...row,
      identity: row.documentNumber,
      createdAt: row.createdAt || row.updatedAt || '',
      countryCode: row.countryCode || '',
    }, { source: 'cotizador', label: 'Cotizador', index }))
    .filter((row) => row.email || row.phone || row.fullName || row.identity);
}

function buildUsersSourceSummary(users = []) {
  const summary = { connect: 0, cotizador: 0, chatbot: 0 };
  for (const user of users) {
    for (const source of user.sources || []) {
      if (source in summary) summary[source] += 1;
    }
  }
  return summary;
}

function parseWorkbookRows(buffer, prefix = 'evinka-export-') {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const inputPath = path.join(tempDir, 'rows.xlsx');
  try {
    fs.writeFileSync(inputPath, buffer);
    const output = execFileSync('python3', [
      path.join('/root/.openclaw/workspace', 'scripts/read_xlsx_rows.py'),
      inputPath,
    ], { stdio: 'pipe' }).toString('utf8');
    return JSON.parse(output || '[]');
  } finally {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
}

function parseMaybeNumber(value) {
  if (value == null) return 0;
  let text = String(value).trim();
  if (!text) return 0;
  text = text.replace(/[^\d,.-]/g, '');
  if (!text) return 0;
  if (text.includes(',') && text.includes('.')) {
    if (text.lastIndexOf(',') > text.lastIndexOf('.')) text = text.replace(/\./g, '').replace(',', '.');
    else text = text.replace(/,/g, '');
  } else if (text.includes(',')) {
    text = text.replace(',', '.');
  }
  const num = Number(text);
  return Number.isFinite(num) ? num : 0;
}

function parseMaybeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function usageKey(value) {
  const email = normalizeEmail(value);
  return email || String(value || '').trim().toLowerCase();
}

function emptyUsage() {
  return {
    transactions: 0,
    totalEnergy: 0,
    totalSpent: 0,
    rechargeCount: 0,
    totalRecharge: 0,
    lastTransactionAt: null,
    lastRechargeAt: null,
    lastActivityAt: null,
    lastPlaza: '',
    lastStation: '',
    plazasUsed: 0,
    currentBalance: null,
  };
}

function touchLastActivity(usage, isoDate = null) {
  if (!isoDate) return;
  if (!usage.lastActivityAt || new Date(isoDate).getTime() > new Date(usage.lastActivityAt).getTime()) {
    usage.lastActivityAt = isoDate;
  }
}

function findLatestDownloadableExport(kind) {
  const cache = loadExportsCache();
  return (cache.exports || [])
    .filter((row) => String(row?.kind || '').toLowerCase() === String(kind || '').toLowerCase() && String(row?.status || '').toLowerCase() === 'downloadable' && row?.fileNames?.[0])
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime())[0] || null;
}

async function loadRowsFromCachedExport(kind) {
  const exportRow = findLatestDownloadableExport(kind);
  if (!exportRow?.id || !exportRow?.fileNames?.[0]) return { rows: [], exportRow: null };
  const file = await connectBytes(`/api/v1/admin/files/xlsxexport?xlsxExportId=${encodeURIComponent(exportRow.id)}&fileName=${encodeURIComponent(exportRow.fileNames[0])}`);
  return {
    rows: parseWorkbookRows(file.buffer, `evinka-${kind}-export-`),
    exportRow,
  };
}

async function buildUsersUsageSnapshot(users = []) {
  const usageByKey = new Map();
  const plazasByKey = new Map();
  const byEmail = new Set(users.map((item) => usageKey(item.email)).filter(Boolean));
  const [transactionData, rechargeData] = await Promise.all([
    loadRowsFromCachedExport('transaction').catch(() => ({ rows: [], exportRow: null })),
    loadRowsFromCachedExport('recharge').catch(() => ({ rows: [], exportRow: null })),
  ]);

  const ensureUsage = (key) => {
    if (!key) return null;
    if (!usageByKey.has(key)) usageByKey.set(key, emptyUsage());
    if (!plazasByKey.has(key)) plazasByKey.set(key, new Set());
    return usageByKey.get(key);
  };

  for (const row of transactionData.rows || []) {
    const key = usageKey(pickUserValue(row, ['User', 'Email', 'email']));
    if (!key || (byEmail.size && !byEmail.has(key))) continue;
    const usage = ensureUsage(key);
    if (!usage) continue;
    usage.transactions += 1;
    usage.totalEnergy += parseMaybeNumber(row.Energy);
    usage.totalSpent += parseMaybeNumber(row.NetFee || row.Fee);
    const isoDate = parseMaybeDate(row.StartTime || row.EndTime);
    if (isoDate && (!usage.lastTransactionAt || new Date(isoDate).getTime() > new Date(usage.lastTransactionAt).getTime())) {
      usage.lastTransactionAt = isoDate;
      usage.lastPlaza = pickUserValue(row, ['Plaza']) || usage.lastPlaza;
      usage.lastStation = pickUserValue(row, ['Station']) || usage.lastStation;
    }
    const plaza = pickUserValue(row, ['Plaza']);
    if (plaza) plazasByKey.get(key).add(plaza);
    touchLastActivity(usage, isoDate);
  }

  for (const row of rechargeData.rows || []) {
    const key = usageKey(pickUserValue(row, ['User', 'Email', 'email']));
    if (!key || (byEmail.size && !byEmail.has(key))) continue;
    const usage = ensureUsage(key);
    if (!usage) continue;
    usage.rechargeCount += 1;
    usage.totalRecharge += parseMaybeNumber(row.Amount);
    const balance = row.Balance == null || row.Balance === '' ? null : parseMaybeNumber(row.Balance);
    const isoDate = parseMaybeDate(row.DateTime);
    if (isoDate && (!usage.lastRechargeAt || new Date(isoDate).getTime() > new Date(usage.lastRechargeAt).getTime())) {
      usage.lastRechargeAt = isoDate;
      usage.currentBalance = balance;
    }
    touchLastActivity(usage, isoDate);
  }

  for (const [key, usage] of usageByKey.entries()) {
    usage.totalEnergy = Number(usage.totalEnergy.toFixed(2));
    usage.totalSpent = Number(usage.totalSpent.toFixed(2));
    usage.totalRecharge = Number(usage.totalRecharge.toFixed(2));
    usage.plazasUsed = plazasByKey.get(key)?.size || 0;
  }

  return {
    usageByKey,
    sources: {
      transaction: transactionData.exportRow ? {
        id: transactionData.exportRow.id,
        startTime: transactionData.exportRow.startTime || null,
        endTime: transactionData.exportRow.endTime || null,
        recordCount: transactionData.exportRow.recordCount ?? transactionData.rows.length,
      } : null,
      recharge: rechargeData.exportRow ? {
        id: rechargeData.exportRow.id,
        startTime: rechargeData.exportRow.startTime || null,
        endTime: rechargeData.exportRow.endTime || null,
        recordCount: rechargeData.exportRow.recordCount ?? rechargeData.rows.length,
      } : null,
    },
  };
}

async function waitForExportDownloadable(exportId, { initialRow = null, timeoutMs = 90 * 1000, intervalMs = 3 * 1000 } = {}) {
  let row = initialRow || findCachedExport(exportId) || null;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const data = await connectJson('/api/v1/admin/xlsxexports?page_size=100&page=1');
      const remote = (data.xlsxExports || []).find((item) => item?.id === exportId) || null;
      if (remote) {
        upsertCachedExport(remote);
        row = { ...(row || {}), ...remote };
      }
    } catch {
      // seguimos con cache/probe si la lista falla momentáneamente
    }

    if (String(row?.status || '').toLowerCase() === 'downloadable' && row?.fileNames?.[0]) {
      return row;
    }

    if (row?.fileNames?.[0]) {
      try {
        const ready = await probeExportReady(row);
        if (ready) {
          row = { ...row, ready: true, status: 'Downloadable', updatedAt: new Date().toISOString() };
          upsertCachedExport(row);
          return row;
        }
      } catch {
        // se reintenta en el siguiente poll
      }
    }

    await sleep(intervalMs);
    row = row || findCachedExport(exportId) || null;
  }
  return row;
}

function summarizeConnectUsers(users = []) {
  const withUsage = users.filter((item) => (item.usage?.transactions || 0) > 0 || (item.usage?.rechargeCount || 0) > 0).length;
  return {
    total: users.length,
    withEmail: users.filter((item) => item.email).length,
    withPhone: users.filter((item) => item.phone).length,
    withName: users.filter((item) => item.fullName).length,
    withUsage,
  };
}

function marketingActivityScore(user = {}) {
  return Number(user?.usage?.transactions || 0) + Number(user?.usage?.rechargeCount || 0);
}

function marketingDaysSince(value) {
  if (!value) return Infinity;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return Infinity;
  return Math.floor((Date.now() - time) / (24 * 60 * 60 * 1000));
}

function marketingSegment(user = {}) {
  const score = marketingActivityScore(user);
  const lastDays = marketingDaysSince(user?.usage?.lastActivityAt);
  if (!score) return 'lead';
  if (lastDays <= 45) return 'active';
  return 'dormant';
}

function matchesMarketingSegment(user = {}, segment = 'all') {
  const current = String(segment || 'all').trim().toLowerCase();
  if (!current || current === 'all') return true;
  if (current === 'with-email') return Boolean(user?.email);
  if (current === 'with-phone') return Boolean(user?.phone);
  return marketingSegment(user) === current;
}

function normalizeSearchText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function matchesUserQuery(user = {}, query = '') {
  const q = normalizeSearchText(query);
  if (!q) return true;
  return [user.fullName, user.email, user.phone, user.identity]
    .some((value) => normalizeSearchText(value).includes(q));
}

function userActivityScore(user = {}) {
  return Number(user?.usage?.transactions || 0) + Number(user?.usage?.rechargeCount || 0);
}

function sortUsersForMarketing(users = []) {
  return [...users].sort((a, b) => {
    const diff = marketingActivityScore(b) - marketingActivityScore(a);
    if (diff) return diff;
    const nameA = (a.fullName || a.email || a.phone || '').toLowerCase();
    const nameB = (b.fullName || b.email || b.phone || '').toLowerCase();
    return nameA.localeCompare(nameB, 'es');
  });
}

function excelAutoWidth(worksheet, min = 14, max = 30) {
  worksheet.columns = worksheet.columns.map((column) => {
    let width = min;
    for (const cell of column.values || []) {
      const length = String(cell ?? '').length;
      width = Math.max(width, Math.min(max, length + 2));
    }
    return { ...column, width };
  });
}

async function buildMarketingUsersWorkbook(users = [], { generatedAt = new Date().toISOString(), query = '' } = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Evi';
  workbook.company = 'EVINKA';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.subject = 'Usuarios EVINKA para Marketing';
  workbook.title = 'EVINKA Usuarios Marketing';

  const summary = workbook.addWorksheet('Resumen');
  summary.columns = [
    { header: 'Métrica', key: 'metric', width: 28 },
    { header: 'Valor', key: 'value', width: 24 },
  ];
  summary.getCell('A1').value = 'Export marketing · Usuarios EVINKA';
  summary.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFF6EA' } };
  summary.mergeCells('A1:B1');
  summary.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E1A16' } };
  summary.addRows([
    ['Generado', generatedAt],
    ['Filtro aplicado', query || 'Todos'],
    ['Usuarios exportados', users.length],
    ['Con correo', users.filter((item) => item.email).length],
    ['Con teléfono', users.filter((item) => item.phone).length],
    ['Con uso detectado', users.filter((item) => userActivityScore(item) > 0).length],
  ]);
  summary.getRow(2).font = { bold: true };
  summary.eachRow((row, rowNumber) => {
    if (rowNumber <= 1) return;
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: '33FFFFFF' } },
        left: { style: 'thin', color: { argb: '33FFFFFF' } },
        bottom: { style: 'thin', color: { argb: '33FFFFFF' } },
        right: { style: 'thin', color: { argb: '33FFFFFF' } },
      };
    });
  });

  const sheet = workbook.addWorksheet('Usuarios');
  sheet.columns = [
    { header: 'Nombre', key: 'fullName' },
    { header: 'Correo', key: 'email' },
    { header: 'Teléfono', key: 'phone' },
    { header: 'Registro', key: 'createdAt' },
    { header: 'Estado marketing', key: 'marketingState' },
    { header: 'Última actividad', key: 'lastActivityAt' },
  ];
  sheet.addRow(sheet.columns.map((col) => col.header));
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFF9F1E7' } };
  header.alignment = { vertical: 'middle', horizontal: 'center' };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC7A06A' } };
  header.height = 22;

  for (const user of users) {
    const usage = user.usage || {};
    sheet.addRow({
      fullName: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Sin nombre',
      email: user.email || '',
      phone: user.phone || '',
      createdAt: user.createdAt || '',
      marketingState: ({ lead: 'Lead', active: 'Cliente activo', dormant: 'Cliente dormido' }[marketingSegment(user)] || 'Lead'),
      lastActivityAt: usage.lastActivityAt || '',
    });
  }

  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columns.length },
  };
  sheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: '22FFFFFF' } },
        left: { style: 'thin', color: { argb: '22FFFFFF' } },
        bottom: { style: 'thin', color: { argb: '22FFFFFF' } },
        right: { style: 'thin', color: { argb: '22FFFFFF' } },
      };
      if (rowNumber > 1) cell.alignment = { vertical: 'middle', wrapText: true };
    });
    if (rowNumber > 1 && rowNumber % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F3ED' } };
      });
    }
  });

  ['D', 'F'].forEach((col) => {
    sheet.getColumn(col).numFmt = 'dd/mm/yyyy hh:mm';
  });
  excelAutoWidth(sheet, 14, 34);

  return workbook.xlsx.writeBuffer();
}

async function fetchConnectUsersSnapshot({ forceRefresh = false } = {}) {
  const cache = loadConnectUsersCache();
  const lastSyncTime = new Date(cache.lastSyncAt || 0).getTime();
  const cacheHasUsage = Array.isArray(cache.users) && cache.users.some((item) => item?.usage) && cache.usageSources;
  if (!forceRefresh && cache.users?.length && cacheHasUsage && Number.isFinite(lastSyncTime) && (Date.now() - lastSyncTime) < CONNECT_USERS_CACHE_TTL_MS) {
    return cache;
  }

  const exportPayload = {
    kind: 'appuser',
    startTime: CONNECT_USERS_EXPORT_START,
    endTime: new Date().toISOString(),
  };

  const created = await connectJson('/api/v1/admin/xlsxexports', { method: 'POST', body: exportPayload });
  upsertCachedExport(created);
  const readyRow = await waitForExportDownloadable(created.id, { initialRow: created });
  if (!readyRow?.fileNames?.[0]) {
    throw new Error('EVINKA Connect todavía no dejó listo el export de usuarios. Intenta refrescar en unos segundos.');
  }

  const file = await connectBytes(`/api/v1/admin/files/xlsxexport?xlsxExportId=${encodeURIComponent(readyRow.id)}&fileName=${encodeURIComponent(readyRow.fileNames[0])}`);
  const rawRows = parseWorkbookRows(file.buffer, 'evinka-users-export-');
  const mapped = rawRows
    .map((row, index) => normalizeConnectUserRow(row, index))
    .filter((row) => row.email || row.phone || row.fullName || row.identity);

  const extraSources = await Promise.allSettled([
    Promise.resolve(fetchCotizadorClientSnapshot()),
    fetchChatbotUsersSnapshot(),
  ]);
  const allRows = [
    ...mapped,
    ...extraSources.flatMap((result) => result.status === 'fulfilled' && Array.isArray(result.value) ? result.value : []),
  ];

  const byKey = new Map();
  for (const row of allRows) {
    const key = row.email?.toLowerCase() || row.identity || row.phone || `${row.fullName}-${row.createdAt}`;
    if (!byKey.has(key)) {
      byKey.set(key, row);
      continue;
    }
    const merged = mergeUserRecords(byKey.get(key), row);
    byKey.set(key, merged);
  }

  const users = [...byKey.values()].sort((a, b) => {
    const nameA = (a.fullName || a.email || a.phone || '').toLowerCase();
    const nameB = (b.fullName || b.email || b.phone || '').toLowerCase();
    return nameA.localeCompare(nameB, 'es');
  });

  const usageSnapshot = await buildUsersUsageSnapshot(users);
  const usersWithUsage = users.map((user) => ({
    ...user,
    usage: usageSnapshot.usageByKey.get(usageKey(user.email)) || emptyUsage(),
  }));

  const snapshot = {
    users: usersWithUsage,
    ...summarizeConnectUsers(usersWithUsage),
    sourceSummary: buildUsersSourceSummary(usersWithUsage),
    lastSyncAt: new Date().toISOString(),
    sourceExport: {
      id: readyRow.id,
      kind: readyRow.kind,
      fileName: readyRow.fileNames?.[0] || '',
      createdAt: readyRow.createdAt || null,
      updatedAt: readyRow.updatedAt || null,
      recordCount: readyRow.recordCount ?? usersWithUsage.length,
      startTime: exportPayload.startTime,
      endTime: exportPayload.endTime,
    },
    usageSources: usageSnapshot.sources,
  };
  saveConnectUsersCache(snapshot);
  return snapshot;
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(header.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return [part, ''];
    return [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))];
  }));
}

function cookieString(name, value, { maxAge = null, httpOnly = true } = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'Secure',
    'SameSite=Strict',
  ];
  if (httpOnly) parts.push('HttpOnly');
  if (maxAge != null) parts.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
  return parts.join('; ');
}

function setCookies(res, cookies) {
  res.setHeader('Set-Cookie', cookies);
}

function clearCookie(name) {
  return cookieString(name, '', { maxAge: 0 });
}

function randomId(size = 18) {
  return crypto.randomBytes(size).toString('hex');
}

function randomToken(size = 32) {
  return crypto.randomBytes(size).toString('base64url');
}

function randomOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function derivePassword(password, salt = randomToken(16)) {
  const hash = crypto.scryptSync(password, salt, 64).toString('base64');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, expected] = stored.split(':');
  const actual = crypto.scryptSync(password, salt, 64).toString('base64');
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePersonName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isValidPublicMapEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function publicMapLeadUserId() {
  return `wm${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`.slice(0, 20);
}

async function capturePublicMapLead({ name, email, acceptMarketing, acceptCookies, source = 'solo-mapa.html' }, meta = {}) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = normalizePersonName(name);
  const now = new Date().toISOString();

  const existingRows = await sb.select('usuarios', `correo_electronico=eq.${encodeURIComponent(normalizedEmail)}&select=id_usuario,nombre_visible,nombre_usuario,correo_electronico&limit=1`);
  let user = Array.isArray(existingRows) ? existingRows[0] : null;

  if (!user) {
    const created = await sb.insert('usuarios', {
      id_usuario: publicMapLeadUserId(),
      nombre_visible: normalizedName,
      nombre_usuario: normalizedName,
      correo_electronico: normalizedEmail,
    });
    user = Array.isArray(created) ? created[0] : null;
  } else {
    const patch = {};
    if (normalizedName && user.nombre_visible !== normalizedName) patch.nombre_visible = normalizedName;
    if (normalizedName && user.nombre_usuario !== normalizedName) patch.nombre_usuario = normalizedName;
    if (Object.keys(patch).length) {
      const updated = await sb.update('usuarios', `id_usuario=eq.${encodeURIComponent(user.id_usuario)}`, patch);
      user = Array.isArray(updated) && updated[0] ? updated[0] : { ...user, ...patch };
    }
  }

  const summary = JSON.stringify({
    source,
    acceptMarketing: !!acceptMarketing,
    acceptCookies: !!acceptCookies,
    page: String(meta.page || '/solo-mapa.html').slice(0, 160),
    ip: String(meta.ip || 'unknown').slice(0, 120),
    userAgent: String(meta.userAgent || 'unknown').slice(0, 240),
    capturedAt: now,
  });

  await sb.insert('conversaciones', {
    id_usuario: user?.id_usuario || publicMapLeadUserId(),
    canal: 'whatsapp',
    intencion_principal: 'otro',
    estado_conversacion: 'open',
    paso_actual: 'lead_captado',
    subestado_flujo: 'marketing_optin',
    dio_consentimiento: true,
    consentimiento_fecha: now,
    consentimiento_version: 'mapa_lead_v1',
    resumen: summary,
  });

  return { ok: true, idUsuario: user?.id_usuario || null };
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function maskPhone(value) {
  const phone = normalizePhone(value);
  if (phone.length <= 4) return phone || 'sin destino';
  return `${phone.slice(0, 3)}•••${phone.slice(-3)}`;
}

function isAllowedEmail(email) {
  return /^[^\s@]+@evinka\.tech$/i.test(email || '');
}

function isAllowedManagedEmail(email) {
  return /^[^\s@]+@(evinka\.tech|evinkatech\.onmicrosoft\.com)$/i.test(email || '');
}

function isStrongPassword(password) {
  return typeof password === 'string'
    && password.length >= 12
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password);
}

function isCrossSiteRequest(req) {
  const site = String(req.headers['sec-fetch-site'] || '').toLowerCase();
  return site === 'cross-site';
}

function parseBooleanish(value, fallback = false) {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'si', 'sí', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function maskEmail(email) {
  const [local, domain] = normalizeEmail(email).split('@');
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0] || '*'}*@${domain}`;
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
}

function clientIp(req) {
  const forwarded = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket.remoteAddress || 'unknown';
}

function appendAuditLog(db, {
  scope = 'personal-data',
  action = 'event',
  actor = null,
  status = 'success',
  route = '',
  method = '',
  target = '',
  meta = {},
  ip = '',
  userAgent = '',
} = {}) {
  db.auditLogs ||= [];
  db.auditLogs.push({
    id: randomId(12),
    at: new Date().toISOString(),
    scope,
    action,
    status,
    actorEmail: normalizeEmail(actor?.email || ''),
    actorRole: normalizeUserRole(actor?.role || ''),
    route,
    method,
    target,
    ip,
    userAgent: String(userAgent || '').slice(0, 300),
    meta,
  });
  if (db.auditLogs.length > AUDIT_LOG_LIMIT) db.auditLogs = db.auditLogs.slice(-AUDIT_LOG_LIMIT);
}

function auditPrototypeCatalog() {
  return [
    { key: 'status', label: 'Status' },
    { key: 'accesos', label: 'Accesos' },
    { key: 'chatbot', label: 'Chatbot' },
    { key: 'cotizador', label: 'Cotizador' },
    { key: 'conformidad', label: 'Conformidad' },
    { key: 'mapa-publico', label: 'Mapa público' },
  ];
}

function readJsonObjectSafe(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readOperationalUsers() {
  return readJsonArraySafe(STATUS_AUDIT_OPERATIONAL_USERS_PATH).map((user) => ({
    id: String(user.id || '').trim(),
    name: normalizePersonName(user.name || ''),
    email: normalizeEmail(user.email || ''),
    role: normalizeUserRole(user.role || ''),
    employeeCode: String(user.employeeCode || '').trim().toUpperCase(),
    allowedCountries: Array.isArray(user.allowedCountries)
      ? [...new Set(user.allowedCountries.map((item) => String(item || '').trim().toUpperCase()).filter(Boolean))]
      : [],
  }));
}

function buildAccessAuditEvents(logs = []) {
  return logs.map((log) => {
    const moduleName = String(log.module || 'operacion').trim().toLowerCase();
    const moduleLabel = moduleName === 'asesor' ? 'Asesor' : moduleName === 'cotizador' ? 'Cotizador' : 'Operación';
    const actorName = normalizePersonName(log.name || '') || prettifyEmailName(log.email || '') || log.employeeCode || 'Usuario operativo';
    const action = String(log.action || '').trim().toLowerCase();
    const status = String(log.status || 'success').trim().toLowerCase();
    let verb = 'registró actividad';
    if (action === 'login' && status === 'success') verb = 'inició sesión';
    else if (action === 'login' && status === 'failed') verb = 'falló al iniciar sesión';
    else if (action === 'login' && status === 'denied') verb = 'tuvo el acceso bloqueado';
    else if (action === 'logout') verb = 'cerró sesión';
    return {
      id: `accesos:${log.id || randomId(8)}`,
      prototype: 'accesos',
      prototypeLabel: 'Accesos',
      at: pickFirstDate(log.at),
      message: `${actorName} ${verb} en ${moduleLabel}`,
      status,
      actorName,
      targetName: moduleLabel,
      detail: {
        module: moduleName,
        action,
        status,
        userId: String(log.userId || ''),
        employeeCode: String(log.employeeCode || ''),
        email: String(log.email || ''),
        role: String(log.role || ''),
        allowedCountries: Array.isArray(log.allowedCountries) ? log.allowedCountries : [],
        ip: String(log.ip || ''),
        userAgent: truncateAuditText(log.userAgent || '', 180),
        reason: String(log.reason || ''),
        meta: log.meta || {},
      },
    };
  });
}

function buildOperationalSessionsSummary() {
  const users = readOperationalUsers();
  const userById = new Map(users.map((user) => [user.id, user]));
  const definitions = [
    { module: 'cotizador', path: STATUS_AUDIT_COTIZADOR_SESSIONS_PATH, label: 'Cotizador' },
    { module: 'asesor', path: STATUS_AUDIT_ADVISOR_SESSIONS_PATH, label: 'Asesor' },
  ];
  return definitions.flatMap((definition) => {
    const sessions = readJsonObjectSafe(definition.path);
    return Object.entries(sessions).map(([token, session]) => {
      const user = userById.get(String(session?.userId || '').trim()) || {};
      return {
        module: definition.module,
        moduleLabel: definition.label,
        tokenPreview: String(token || '').slice(0, 10),
        userId: String(session?.userId || ''),
        employeeCode: String(user.employeeCode || ''),
        name: String(user.name || ''),
        email: String(user.email || ''),
        role: String(user.role || ''),
        allowedCountries: Array.isArray(user.allowedCountries) ? user.allowedCountries : [],
        createdAt: pickFirstDate(session?.createdAt),
        expiresAt: pickFirstDate(session?.expiresAt),
      };
    });
  }).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

function revokeOperationalSessions({ module = '', userId = '' } = {}) {
  const normalizedModule = String(module || '').trim().toLowerCase();
  const targetPath = normalizedModule === 'asesor'
    ? STATUS_AUDIT_ADVISOR_SESSIONS_PATH
    : normalizedModule === 'cotizador'
      ? STATUS_AUDIT_COTIZADOR_SESSIONS_PATH
      : '';
  if (!targetPath) return { ok: false, removed: 0 };
  const sessions = readJsonObjectSafe(targetPath);
  let removed = 0;
  for (const [token, session] of Object.entries(sessions)) {
    if (String(session?.userId || '') === String(userId || '')) {
      delete sessions[token];
      removed += 1;
    }
  }
  writeJsonFile(targetPath, sessions);
  return { ok: true, removed };
}

function capitalizeWord(value = '') {
  const text = String(value || '').trim();
  return text ? `${text[0].toUpperCase()}${text.slice(1).toLowerCase()}` : '';
}

function prettifyEmailName(email = '') {
  const local = normalizeEmail(email).split('@')[0] || '';
  const parts = local.split(/[._-]+/).map(capitalizeWord).filter(Boolean);
  return parts.join(' ');
}

function auditActorName(actor = {}) {
  return normalizePersonName(actor?.name || '')
    || prettifyEmailName(actor?.email || actor?.actorEmail || '')
    || normalizePersonName(actor?.fullName || '')
    || 'Sistema EVINKA';
}

function auditClientName(value = '') {
  return normalizePersonName(value) || 'cliente sin nombre';
}

function safeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function pickFirstDate(...values) {
  for (const value of values) {
    const time = new Date(value || '').getTime();
    if (Number.isFinite(time) && time > 0) return new Date(time).toISOString();
  }
  return null;
}

function auditTicketFromText(value = '') {
  const match = String(value || '').match(/WA-[A-Z0-9-]+/i);
  return match ? match[0].toUpperCase() : '';
}

function truncateAuditText(value = '', max = 240) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, Math.max(0, max - 1)).trim()}…` : text;
}

function statusAuditMessage(log = {}) {
  const actor = auditActorName({ email: log.actorEmail });
  const target = String(log.target || '').trim();
  switch (String(log.action || '').trim().toLowerCase()) {
    case 'personal_data_login': return `${actor} inició sesión en Status EVINKA`;
    case 'personal_data_logout': return `${actor} cerró sesión en Status EVINKA`;
    case 'managed_user_created': return `${actor} creó la cuenta ${target || 'nueva cuenta'}`;
    case 'managed_user_updated': return `${actor} actualizó la cuenta ${target || 'gestionada'}`;
    case 'managed_user_password_reset': return `${actor} reseteó la contraseña de ${target || 'una cuenta'}`;
    case 'connect_users_viewed': return `${actor} abrió el módulo Usuarios`;
    case 'marketing_export_downloaded': return `${actor} exportó usuarios para marketing`;
    case 'exports_list_viewed': return `${actor} revisó la bandeja de exportes`;
    case 'personal_export_requested': return `${actor} solicitó un export sensible`;
    case 'personal_export_downloaded': return `${actor} descargó un export sensible`;
    case 'personal_clean_export_downloaded': return `${actor} descargó un export limpio`;
    case 'personal_export_emailed': return `${actor} envió un export por correo`;
    case 'audit_log_viewed': return `${actor} revisó la auditoría de datos personales`;
    case 'audit_feed_viewed': return `${actor} abrió el módulo Auditoría`;
    case 'personal_data_access_denied': return `Se bloqueó un acceso no autorizado a datos personales`;
    case 'personal_export_request_denied': return `Se bloqueó una solicitud de export sensible`;
    case 'personal_export_download_denied': return `Se bloqueó la descarga de un export sensible`;
    case 'personal_export_email_denied': return `Se bloqueó el envío de un export sensible por correo`;
    default: return `${actor} registró actividad en Status EVINKA`;
  }
}

function buildStatusAuditEvents(db = defaultDb()) {
  return (db.auditLogs || []).map((log) => ({
    id: `status:${log.id || randomId(8)}`,
    prototype: 'status',
    prototypeLabel: 'Status',
    at: pickFirstDate(log.at),
    message: statusAuditMessage(log),
    status: String(log.status || 'success'),
    actorName: auditActorName({ email: log.actorEmail }),
    targetName: String(log.target || '').trim(),
    detail: {
      action: String(log.action || ''),
      scope: String(log.scope || ''),
      route: String(log.route || ''),
      method: String(log.method || ''),
      target: String(log.target || ''),
      actorEmail: String(log.actorEmail || ''),
      actorRole: String(log.actorRole || ''),
      ip: String(log.ip || ''),
      userAgent: truncateAuditText(log.userAgent || '', 180),
      meta: log.meta || {},
    },
  }));
}

function buildChatbotAuditEvents(techVisits = []) {
  return techVisits
    .filter((visit) => {
      const notes = String(visit?.notes || '').toLowerCase();
      const ticket = auditTicketFromText(`${visit?.reference || ''} ${visit?.notes || ''}`);
      return notes.includes('chatbot') || notes.includes('agenda evinka') || Boolean(ticket);
    })
    .map((visit) => {
      const ticket = auditTicketFromText(`${visit?.reference || ''} ${visit?.notes || ''}`);
      return {
        id: `chatbot:${visit.id || randomId(8)}`,
        prototype: 'chatbot',
        prototypeLabel: 'Chatbot',
        at: pickFirstDate(visit.createdAt, visit.updatedAt, visit.scheduledAt),
        message: `El chatbot creó una visita para ${auditClientName(visit.clientName)}`,
        status: String(visit.status || 'open'),
        actorName: 'Chatbot EVINKA',
        targetName: auditClientName(visit.clientName),
        detail: {
          visitId: String(visit.id || ''),
          ticket,
          clientName: auditClientName(visit.clientName),
          clientPhone: String(visit.clientPhone || ''),
          clientDocument: String(visit.clientDocument || ''),
          clientEmail: String(visit.clientEmail || ''),
          address: String(visit.clientAddress || ''),
          scheduledAt: visit.scheduledAt || null,
          timeWindow: String(visit.timeWindow || ''),
          status: String(visit.status || ''),
          type: String(visit.type || ''),
          reference: String(visit.reference || ''),
          resolution: String(visit.resolution || ''),
          assignedTechName: String(visit.assignedTechName || ''),
          assignedTechEmail: String(visit.assignedTechEmail || ''),
          notes: truncateAuditText(visit.notes || '', 320),
        },
      };
    });
}

function quoteTotalValue(quote = {}, installationOrder = null) {
  const items = Array.isArray(quote.itemRows) ? quote.itemRows : [];
  const fallback = items.reduce((sum, item) => sum + safeNumber(item?.total), 0);
  return safeNumber(installationOrder?.quoteTotal, safeNumber(quote?.quoteTotal, safeNumber(quote?.finalTotal, fallback)));
}

function buildCotizadorAuditEvents(quotes = [], installationOrders = []) {
  const orderByQuoteId = new Map(installationOrders.map((row) => [String(row.quoteId || ''), row]));
  return quotes.map((quote) => {
    const order = orderByQuoteId.get(String(quote.id || '')) || null;
    const actorName = auditActorName(quote.createdBy || {});
    const items = Array.isArray(quote.itemRows) ? quote.itemRows : [];
    return {
      id: `cotizador:${quote.id || randomId(8)}`,
      prototype: 'cotizador',
      prototypeLabel: 'Cotizador',
      at: pickFirstDate(quote.createdAt, order?.createdAt),
      message: `${actorName} generó una cotización para ${auditClientName(quote.clientName)}`,
      status: String(order?.status || quote?.status || 'draft'),
      actorName,
      targetName: auditClientName(quote.clientName),
      detail: {
        quoteId: String(quote.id || ''),
        installationOrderId: String(order?.id || ''),
        clientName: auditClientName(quote.clientName),
        clientEmail: String(quote.email || ''),
        clientDocument: String(quote.clientDocument || ''),
        city: String(quote.city || ''),
        visitDate: String(quote.visitDate || ''),
        installationType: String(quote.installationType || ''),
        propertyType: String(quote.propertyType || ''),
        chargerBrand: String(order?.chargerBrand || quote?.chargerBrand || ''),
        total: quoteTotalValue(quote, order),
        itemCount: items.length,
        items: items.slice(0, 8).map((item) => ({
          label: String(item?.label || ''),
          qty: safeNumber(item?.qty, 0),
          total: safeNumber(item?.total, 0),
        })),
        quotePdfUrl: String(order?.quotePdfUrl || ''),
        status: String(order?.status || quote?.status || ''),
        technicianNotes: truncateAuditText(quote.technicianNotes || '', 320),
      },
    };
  });
}

function buildConformityAuditEvents(conformities = [], installationOrders = []) {
  const orderById = new Map(installationOrders.map((row) => [String(row.id || ''), row]));
  return conformities.map((item) => {
    const order = orderById.get(String(item.installationOrderId || '')) || null;
    const actorName = auditActorName(item.createdBy || {});
    const deliveredItems = Array.isArray(item.deliveredItems) ? item.deliveredItems : [];
    return {
      id: `conformidad:${item.id || randomId(8)}`,
      prototype: 'conformidad',
      prototypeLabel: 'Conformidad',
      at: pickFirstDate(item.createdAt, order?.updatedAt),
      message: `${actorName} generó una conformidad para ${auditClientName(item.clientName)}`,
      status: String(item.status || order?.conformityStatus || 'pending'),
      actorName,
      targetName: auditClientName(item.clientName),
      detail: {
        conformityId: String(item.id || ''),
        installationOrderId: String(item.installationOrderId || ''),
        quoteId: String(item.quoteId || ''),
        clientName: auditClientName(item.clientName),
        clientEmail: String(item.clientEmail || ''),
        document: String(item.ruc || ''),
        address: String(item.address || ''),
        chargerBrand: String(item.chargerBrand || ''),
        serialNumber: String(item.serialNumber || ''),
        voltage: String(item.voltage || ''),
        amperage: String(item.amperage || ''),
        powerKw: String(item.powerKw || ''),
        deliveredItems,
        deliveredCount: deliveredItems.length,
        pdfUrl: String(item.pdfUrl || order?.conformityPdfUrl || ''),
        emailDelivery: item.emailDelivery || null,
        observations: truncateAuditText(item.observations || '', 320),
      },
    };
  });
}

function buildAuditFeed({ db, limit = 120, prototype = 'all' } = {}) {
  const quotes = readJsonArraySafe(STATUS_AUDIT_QUOTES_PATH);
  const installationOrders = readJsonArraySafe(STATUS_AUDIT_INSTALLATION_ORDERS_PATH);
  const techVisits = readJsonArraySafe(STATUS_AUDIT_TECH_VISITS_PATH);
  const conformities = readJsonArraySafe(STATUS_AUDIT_CONFORMITIES_PATH);

  const allEvents = [
    ...buildStatusAuditEvents(db),
    ...buildAccessAuditEvents(readAccessAuditLogs()),
    ...buildChatbotAuditEvents(techVisits),
    ...buildCotizadorAuditEvents(quotes),
    ...buildConformityAuditEvents(conformities, installationOrders),
  ]
    .filter((item) => item?.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const currentPrototype = String(prototype || 'all').trim().toLowerCase();
  const filteredEvents = currentPrototype && currentPrototype !== 'all'
    ? allEvents.filter((item) => item.prototype === currentPrototype)
    : allEvents;

  const counts = new Map();
  auditPrototypeCatalog().forEach((item) => counts.set(item.key, 0));
  allEvents.forEach((item) => counts.set(item.prototype, (counts.get(item.prototype) || 0) + 1));

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      total: allEvents.length,
      filteredTotal: filteredEvents.length,
      lastEventAt: allEvents[0]?.at || null,
      prototypes: auditPrototypeCatalog().map((item) => ({
        key: item.key,
        label: item.label,
        count: counts.get(item.key) || 0,
      })),
    },
    events: filteredEvents.slice(0, Math.max(1, Math.min(300, Number(limit) || 120))),
  };
}

function logAuditRequest(db, req, ctx, action, {
  scope = 'personal-data',
  status = 'success',
  route = '',
  method = '',
  target = '',
  meta = {},
} = {}) {
  appendAuditLog(db, {
    scope,
    action,
    actor: ctx?.user || null,
    status,
    route: route || (() => {
      try {
        return new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;
      } catch {
        return req.url || '';
      }
    })(),
    method: method || req.method || '',
    target,
    meta,
    ip: clientIp(req),
    userAgent: req.headers['user-agent'] || '',
  });
}

function rateLimit(key, { limit = 8, windowMs = 15 * 60 * 1000 } = {}) {
  const now = Date.now();
  const bucket = rateLimits.get(key) || [];
  const recent = bucket.filter((ts) => now - ts < windowMs);
  if (recent.length >= limit) {
    const oldest = recent[0] || now;
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    return { ok: false, retryAfterSec };
  }
  recent.push(now);
  rateLimits.set(key, recent);
  return { ok: true, retryAfterSec: 0 };
}

function tooManyRequests(res, baseHeaders, retryAfterSec, message = 'Demasiados intentos. Espera unos minutos y vuelve a probar.') {
  return sendJson(res, 429, {
    error: 'too_many_requests',
    message,
    retryAfterSec,
  }, {
    ...baseHeaders,
    'Retry-After': String(retryAfterSec || 60),
  });
}

function findUserByEmail(db, email) {
  return db.users.find((user) => user.email === normalizeEmail(email)) || null;
}

function findChallenge(db, challengeId, type = null) {
  return db.challenges.find((challenge) => challenge.id === challengeId && (!type || challenge.type === type)) || null;
}

function findRecentActiveChallenge(db, userId, type, withinMs = OTP_RESEND_COOLDOWN_MS) {
  const now = Date.now();
  return db.challenges.find((challenge) => (
    challenge.userId === userId
    && challenge.type === type
    && !challenge.usedAt
    && new Date(challenge.expiresAt).getTime() > now
    && now - new Date(challenge.createdAt).getTime() < withinMs
  )) || null;
}

function findTrustedDevice(db, req, userId = null) {
  const cookies = parseCookies(req);
  const rawToken = cookies[DEVICE_COOKIE];
  if (!rawToken) return null;
  const hashed = sha256(rawToken);
  const device = db.trustedDevices.find((item) => item.tokenHash === hashed && (!userId || item.userId === userId));
  return device ? { record: device, rawToken } : null;
}

function getDeviceCookieToken(req) {
  const cookies = parseCookies(req);
  return String(cookies[DEVICE_COOKIE] || '').trim();
}

function rememberTrustedDevice(db, req, user, userAgent = 'unknown-device') {
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_TTL_MS).toISOString();
  const rawToken = getDeviceCookieToken(req) || randomToken();
  const tokenHash = sha256(rawToken);
  let device = db.trustedDevices.find((item) => item.userId === user.id && item.tokenHash === tokenHash);
  if (!device) {
    device = {
      id: randomId(12),
      userId: user.id,
      tokenHash,
      label: userAgent,
      userAgent,
      createdAt: nowIso,
      lastSeenAt: nowIso,
      expiresAt,
    };
    db.trustedDevices.push(device);
  } else {
    device.label = userAgent;
    device.userAgent = userAgent;
    device.lastSeenAt = nowIso;
    device.expiresAt = expiresAt;
  }
  return { device, rawToken };
}

function findSession(db, req) {
  const cookies = parseCookies(req);
  const rawToken = cookies[SESSION_COOKIE];
  if (!rawToken) return null;
  const hashed = sha256(rawToken);
  const session = db.sessions.find((item) => item.tokenHash === hashed);
  return session ? { record: session, rawToken } : null;
}

function normalizeUserRole(value = '') {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'admin') return 'admin';
  if (role === 'marketing') return 'marketing';
  if (role === 'operations' || role === 'operational') return 'operations';
  if (role === 'finance' || role === 'financial' || role === 'finanzas') return 'finance';
  return 'user';
}

function userRole(user) {
  return normalizeUserRole(user?.role || 'user');
}

function userOtpEmails(user, fallbackEmail = '') {
  const emails = Array.isArray(user?.otpEmails) ? user.otpEmails : [];
  const normalized = emails.map((item) => normalizeEmail(item)).filter(Boolean);
  if (normalized.length) return [...new Set(normalized)];
  const fallback = normalizeEmail(fallbackEmail || user?.email || '');
  return fallback ? [fallback] : [];
}

function maskRecipients(emails = []) {
  const normalized = [...new Set((emails || []).map((item) => normalizeEmail(item)).filter(Boolean))];
  if (!normalized.length) return 'sin destinatario';
  return normalized.map((item) => maskEmail(item)).join(' y ');
}

function sessionPayload(user, trustedDevice) {
  return {
    authenticated: true,
    user: {
      email: user.email,
      role: userRole(user),
      verifiedAt: user.verifiedAt,
    },
    trustedDevice: Boolean(trustedDevice),
  };
}

function requireAdmin(ctx, res, baseHeaders) {
  if (!ctx) {
    sendJson(res, 401, { error: 'unauthorized', message: 'Sesión requerida' }, baseHeaders);
    return false;
  }
  if (userRole(ctx.user) !== 'admin') {
    sendJson(res, 403, { error: 'forbidden', message: 'Permisos de administrador requeridos' }, baseHeaders);
    return false;
  }
  return true;
}

function requireRoles(ctx, roles, res, baseHeaders, message = 'No tienes permisos para esta acción.') {
  if (!ctx) {
    sendJson(res, 401, { error: 'unauthorized', message: 'Sesión requerida' }, baseHeaders);
    return false;
  }
  const allowed = new Set((Array.isArray(roles) ? roles : [roles]).map((item) => normalizeUserRole(item)));
  if (!allowed.has(userRole(ctx.user))) {
    sendJson(res, 403, { error: 'forbidden', message }, baseHeaders);
    return false;
  }
  return true;
}

function canAccessPersonalData(user) {
  return normalizeUserRole(user?.role || '') === 'admin' || normalizeEmail(user?.email || '') === STATUS_PERSONAL_DATA_OWNER_EMAIL;
}

function requirePersonalDataOwner(ctx, req, res, baseHeaders, db = null, message = 'Este módulo de datos personales está restringido a la persona autorizada.') {
  if (!ctx) {
    sendJson(res, 401, { error: 'unauthorized', message: 'Sesión requerida' }, baseHeaders);
    return false;
  }
  if (!canAccessPersonalData(ctx.user)) {
    if (db && req) {
      logAuditRequest(db, req, ctx, 'personal_data_access_denied', { status: 'denied' });
      saveDb(db);
    }
    sendJson(res, 403, { error: 'forbidden', message }, baseHeaders);
    return false;
  }
  return true;
}

function attachAuth(db, res, user, { userAgent = 'unknown', issueDevice = false, existingDevice = null } = {}) {
  const now = Date.now();
  const sessionToken = randomToken();
  const sessionRecord = {
    id: randomId(12),
    userId: user.id,
    tokenHash: sha256(sessionToken),
    userAgent,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
  };
  db.sessions = db.sessions.filter((item) => item.userId !== user.id || item.userAgent !== userAgent);
  db.sessions.push(sessionRecord);

  const cookies = [
    cookieString(SESSION_COOKIE, sessionToken, { maxAge: SESSION_TTL_MS / 1000 }),
  ];

  let trustedDevice = existingDevice;
  if (issueDevice) {
    const rawDeviceToken = randomToken();
    trustedDevice = {
      id: randomId(12),
      userId: user.id,
      tokenHash: sha256(rawDeviceToken),
      userAgent,
      label: userAgent,
      createdAt: new Date(now).toISOString(),
      lastSeenAt: new Date(now).toISOString(),
      expiresAt: new Date(now + TRUSTED_DEVICE_TTL_MS).toISOString(),
    };
    db.trustedDevices.push(trustedDevice);
    cookies.push(cookieString(DEVICE_COOKIE, rawDeviceToken, { maxAge: TRUSTED_DEVICE_TTL_MS / 1000 }));
  } else if (existingDevice) {
    existingDevice.lastSeenAt = new Date(now).toISOString();
    existingDevice.expiresAt = new Date(now + TRUSTED_DEVICE_TTL_MS).toISOString();
    cookies.push(cookieString(DEVICE_COOKIE, findTrustedDeviceToken(reqPlaceholder, existingDevice), { maxAge: TRUSTED_DEVICE_TTL_MS / 1000 }));
  }

  setCookies(res, cookies);
  return trustedDevice;
}

const reqPlaceholder = {};
function findTrustedDeviceToken(_req, _device) {
  return '';
}

async function sendOtpEmail({ emails, code, purpose }) {
  if (!mailer) throw new Error('El servicio de correo corporativo no está configurado todavía.');
  const recipients = [...new Set((Array.isArray(emails) ? emails : [emails]).map((item) => normalizeEmail(item)).filter(Boolean))];
  if (!recipients.length) throw new Error('No hay destinatarios válidos para enviar el código.');
  const subject = purpose === 'register'
    ? 'EVINKA Status · Confirma tu cuenta'
    : purpose === 'reset'
      ? 'EVINKA Status · Recupera tu contraseña'
      : 'EVINKA Status · Código para nuevo dispositivo';
  const text = [
    `Hola,`,
    '',
    `Tu código de verificación para EVINKA Status es: ${code}`,
    '',
    'Este código vence en 10 minutos.',
    '',
    `Si no reconoces este intento, ignora este correo.`,
    '',
    `— ${EMAIL_FROM_NAME}`,
  ].join('\n');
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;background:#0d0d0d;padding:32px;color:#f4efe7;">
      <div style="max-width:560px;margin:0 auto;background:#141414;border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:28px;">
        <div style="font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#e8cfaa;">EVINKA Status</div>
        <h1 style="margin:14px 0 8px;font-size:28px;line-height:1.1;">${purpose === 'register' ? 'Confirma tu cuenta' : purpose === 'reset' ? 'Recupera tu contraseña' : 'Verifica tu dispositivo'}</h1>
        <p style="color:#cdbfa8;line-height:1.7;">${purpose === 'reset' ? 'Usa este código para habilitar el cambio de contraseña en el panel interno.' : 'Usa este código para continuar en el panel interno de status.'}</p>
        <div style="margin:24px 0;padding:18px 20px;border-radius:16px;background:#0f0f0f;border:1px solid rgba(199,160,106,0.18);font-size:36px;font-weight:800;letter-spacing:.18em;text-align:center;color:#fff3df;">${code}</div>
        <p style="color:#cdbfa8;line-height:1.7;">Vence en 10 minutos. Si no reconoces este intento, ignora este correo.</p>
      </div>
    </div>
  `;
  try {
    await mailer.sendMail({ to: recipients, subject, text, html });
  } catch (error) {
    const textError = String(error?.message || error);
    if (textError.includes('ErrorAccessDenied') || textError.includes('403 Forbidden')) {
      throw new Error('El correo corporativo aún no tiene permiso para enviar códigos desde Microsoft 365.');
    }
    throw new Error('No pude enviar el código al correo corporativo.');
  }
}

function issueChallenge({ db, user, type, userAgent }) {
  const code = randomOtp();
  const challenge = {
    id: randomId(12),
    userId: user.id,
    type,
    codeHash: sha256(code),
    attempts: 0,
    maxAttempts: MAX_CODE_ATTEMPTS,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    userAgent,
  };
  db.challenges = db.challenges.filter((item) => !(item.userId === user.id && item.type === type));
  db.challenges.push(challenge);
  return { challenge, code };
}

async function createAndSendChallenge({ db, user, type, userAgent, purpose, email }) {
  const recipients = userOtpEmails(user, email);
  const recent = findRecentActiveChallenge(db, user.id, type);
  if (recent) {
    return {
      reused: true,
      challenge: recent,
      maskedEmail: maskRecipients(recipients),
    };
  }

  const { challenge, code } = issueChallenge({ db, user, type, userAgent });
  saveDb(db);
  try {
    await sendOtpEmail({ emails: recipients, code, purpose });
  } catch (error) {
    const rollbackDb = loadDb();
    rollbackDb.challenges = rollbackDb.challenges.filter((item) => item.id !== challenge.id);
    saveDb(rollbackDb);
    throw error;
  }

  return {
    reused: false,
    challenge,
    maskedEmail: maskRecipients(recipients),
  };
}

function verifyChallenge({ db, challengeId, code, type }) {
  const challenge = findChallenge(db, challengeId, type);
  if (!challenge) throw new Error('Código inválido o vencido');
  if (challenge.attempts >= challenge.maxAttempts) throw new Error('Superaste el máximo de intentos');
  challenge.attempts += 1;
  if (sha256(String(code || '').trim()) !== challenge.codeHash) {
    saveDb(db);
    throw new Error('Código incorrecto');
  }
  challenge.usedAt = new Date().toISOString();
  return challenge;
}

function issuePasswordResetGrant(db, userId, challengeId) {
  const rawToken = randomToken();
  const grant = {
    id: randomId(12),
    userId,
    challengeId,
    tokenHash: sha256(rawToken),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(),
  };
  db.passwordResetGrants = db.passwordResetGrants.filter((item) => item.userId !== userId);
  db.passwordResetGrants.push(grant);
  return { grant, rawToken };
}

function findPasswordResetGrant(db, rawToken) {
  if (!rawToken) return null;
  const tokenHash = sha256(String(rawToken));
  return db.passwordResetGrants.find((item) => item.tokenHash === tokenHash) || null;
}

function userAccessEnabled(user) {
  return user?.accessEnabled !== false;
}

function buildManagedUserPayload(db, user) {
  return {
    email: user.email,
    role: userRole(user),
    accessEnabled: userAccessEnabled(user),
    verifiedAt: user.verifiedAt || null,
    createdAt: user.createdAt || null,
    updatedAt: user.updatedAt || null,
    otpEmails: userOtpEmails(user),
    activeSessions: db.sessions.filter((item) => item.userId === user.id).length,
    trustedDevices: db.trustedDevices.filter((item) => item.userId === user.id).length,
  };
}

function generateStrongPassword() {
  return `Evk!${randomToken(10)}9aA`;
}

function getUserFromSession(db, req) {
  const session = findSession(db, req);
  if (!session) return null;
  const user = db.users.find((item) => item.id === session.record.userId && item.verifiedAt);
  if (user && !userAccessEnabled(user)) {
    db.sessions = db.sessions.filter((item) => item.id !== session.record.id);
    saveDb(db);
    return null;
  }
  if (!user) return null;
  const trusted = findTrustedDevice(db, req, user.id);
  return { user, session: session.record, trustedDevice: trusted?.record || null };
}

function loadStatusPrefs() {
  return readJsonFile(STATUS_PREFS_PATH, { users: {} });
}

function saveStatusPrefs(data) {
  writeJsonFile(STATUS_PREFS_PATH, data);
}

function loadStatusNotificationConfig() {
  return readJsonFile(STATUS_NOTIFICATION_CONFIG_PATH, {
    targetPhone: DEFAULT_TARGET_PHONE,
    summaryHours: [8, 18],
  });
}

function loadExportsCache() {
  return readJsonFile(STATUS_EXPORTS_CACHE_PATH, { exports: [] });
}

function saveExportsCache(data) {
  writeJsonFile(STATUS_EXPORTS_CACHE_PATH, data);
}

function loadConnectUsersCache() {
  return readJsonFile(STATUS_CONNECT_USERS_CACHE_PATH, {
    users: [],
    total: 0,
    lastSyncAt: null,
    sourceExport: null,
  });
}

function saveConnectUsersCache(data) {
  writeJsonFile(STATUS_CONNECT_USERS_CACHE_PATH, data);
}

function mergeExportRows(remoteRows = [], cachedRows = []) {
  const byId = new Map();
  for (const row of cachedRows || []) {
    if (row?.id) byId.set(row.id, row);
  }
  for (const row of remoteRows || []) {
    if (row?.id) byId.set(row.id, { ...(byId.get(row.id) || {}), ...row });
  }
  return [...byId.values()].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

function upsertCachedExport(row) {
  if (!row?.id) return;
  const cache = loadExportsCache();
  const rows = cache.exports || [];
  const idx = rows.findIndex((item) => item.id === row.id);
  if (idx >= 0) rows[idx] = { ...rows[idx], ...row };
  else rows.unshift(row);
  cache.exports = rows
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 500);
  saveExportsCache(cache);
}

function findCachedExport(exportId) {
  const cache = loadExportsCache();
  return (cache.exports || []).find((row) => row?.id === exportId) || null;
}

async function refreshCachedExportsReadiness(remoteRows = []) {
  const cache = loadExportsCache();
  const remoteById = new Map((remoteRows || []).filter((row) => row?.id).map((row) => [row.id, row]));
  let changed = false;
  const candidates = (cache.exports || [])
    .filter((row) => row?.id && row?.fileNames?.[0] && String(row.status || '').toLowerCase() !== 'downloadable')
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 12);

  for (const row of candidates) {
    const remote = remoteById.get(row.id);
    if (remote && String(remote.status || '').toLowerCase() === 'downloadable') {
      Object.assign(row, remote, { ready: true, status: 'Downloadable' });
      changed = true;
      continue;
    }
    try {
      const ready = await probeExportReady(row);
      if (ready) {
        row.ready = true;
        row.status = 'Downloadable';
        row.updatedAt = new Date().toISOString();
        changed = true;
      }
    } catch {
      // Ignorar fallos de probe; se volverá a intentar luego.
    }
  }

  if (changed) saveExportsCache(cache);
  return cache.exports || [];
}

function resolveStatusTargetPhone() {
  const config = loadStatusNotificationConfig();
  return normalizePhone(config.targetPhone || DEFAULT_TARGET_PHONE) || DEFAULT_TARGET_PHONE;
}

function getStatusPref(phone) {
  const data = loadStatusPrefs();
  return data.users?.[phone] || {};
}

function updateStatusPref(phone, updater) {
  const data = loadStatusPrefs();
  data.users ||= {};
  const current = data.users[phone] || {};
  data.users[phone] = updater({ ...current }) || current;
  saveStatusPrefs(data);
  return data.users[phone];
}

function statusNotificationPayload(pref = {}) {
  const targetPhone = resolveStatusTargetPhone();
  return {
    ok: true,
    targetPhone,
    targetLabel: maskPhone(targetPhone),
    muteAlertsUntil: pref.muteAlertsUntil || null,
    muteStatusUntil: pref.muteStatusUntil || null,
    updatedAt: pref.updatedAt || null,
  };
}

function securityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=() ',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Cache-Control': 'no-store',
  };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const baseHeaders = securityHeaders();

    if (req.method === 'GET' && url.pathname === '/health') {
      return sendJson(res, 200, { ok: true, service: 'status-auth' }, baseHeaders);
    }

    if (!url.pathname.startsWith('/api/auth')) {
      return sendJson(res, 404, { error: 'not_found' }, baseHeaders);
    }

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && isCrossSiteRequest(req)) {
      return sendJson(res, 403, { error: 'forbidden', message: 'Solicitud bloqueada por política de origen.' }, baseHeaders);
    }

    const ip = clientIp(req);

    if (req.method === 'POST' && url.pathname === '/api/auth/public-map-lead') {
      const limit = rateLimit(`public-map-lead:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 });
      if (!limit.ok) return tooManyRequests(res, baseHeaders, limit.retryAfterSec, 'Demasiados intentos desde esta red. Inténtalo más tarde.');

      const body = await readJsonBody(req);
      const name = normalizePersonName(body.name);
      const email = normalizeEmail(body.email);
      const acceptMarketing = parseBooleanish(body.acceptMarketing, false);
      const acceptCookies = parseBooleanish(body.acceptCookies, false);

      if (name.length < 2 || name.length > 120) {
        return sendJson(res, 400, { error: 'invalid_name', message: 'Ingresa tu nombre completo para continuar.' }, baseHeaders);
      }
      if (!isValidPublicMapEmail(email)) {
        return sendJson(res, 400, { error: 'invalid_email', message: 'Ingresa un correo válido para continuar.' }, baseHeaders);
      }
      if (!acceptMarketing || !acceptCookies) {
        return sendJson(res, 400, { error: 'consent_required', message: 'Debes aceptar promociones y cookies para continuar.' }, baseHeaders);
      }

      try {
        const saved = await capturePublicMapLead({
          name,
          email,
          acceptMarketing,
          acceptCookies,
          source: 'solo-mapa.html',
        }, {
          ip,
          userAgent: req.headers['user-agent'] || 'unknown',
          page: url.searchParams.get('page') || '/solo-mapa.html',
        });
        return sendJson(res, 200, { ok: true, saved }, baseHeaders);
      } catch (error) {
        console.error('public-map-lead failed:', error);
        return sendJson(res, 502, { error: 'save_failed', message: 'No pude habilitar el mapa en este momento.' }, baseHeaders);
      }
    }

    if (req.method === 'GET' && url.pathname === '/api/auth/session') {
      const db = loadDb();
      saveDb(db);
      const ctx = getUserFromSession(db, req);
      return sendJson(res, 200, ctx ? sessionPayload(ctx.user, ctx.trustedDevice) : { authenticated: false }, baseHeaders);
    }

    if (req.method === 'GET' && url.pathname === '/api/auth/personal-data-audit') {
      const db = loadDb();
      saveDb(db);
      const ctx = getUserFromSession(db, req);
      if (!requireAdmin(ctx, res, baseHeaders)) return;
      const limit = Math.min(300, Math.max(1, Number(url.searchParams.get('limit') || '100') || 100));
      const scope = String(url.searchParams.get('scope') || '').trim().toLowerCase();
      const action = String(url.searchParams.get('action') || '').trim().toLowerCase();
      const logs = (db.auditLogs || [])
        .filter((item) => (!scope || String(item.scope || '').toLowerCase() === scope) && (!action || String(item.action || '').toLowerCase() === action))
        .slice(-limit)
        .reverse();
      logAuditRequest(db, req, ctx, 'audit_log_viewed', { scope: 'admin-access', target: `rows:${logs.length}` });
      saveDb(db);
      return sendJson(res, 200, { logs }, baseHeaders);
    }

    if (req.method === 'GET' && url.pathname === '/api/auth/audit-feed') {
      const db = loadDb();
      const ctx = getUserFromSession(db, req);
      if (!requireAdmin(ctx, res, baseHeaders)) return;
      const limit = Math.min(300, Math.max(1, Number(url.searchParams.get('limit') || '120') || 120));
      const prototype = String(url.searchParams.get('prototype') || 'all').trim().toLowerCase();
      const payload = buildAuditFeed({ db, limit, prototype });
      logAuditRequest(db, req, ctx, 'audit_feed_viewed', {
        scope: 'admin-access',
        target: `events:${payload.events.length}`,
        meta: { prototype, limit },
      });
      saveDb(db);
      return sendJson(res, 200, payload, baseHeaders);
    }

    if (req.method === 'GET' && url.pathname === '/api/auth/admin/users') {
      const db = loadDb();
      saveDb(db);
      const ctx = getUserFromSession(db, req);
      if (!requireAdmin(ctx, res, baseHeaders)) return;
      const users = db.users.map((user) => buildManagedUserPayload(db, user)).sort((a, b) => a.email.localeCompare(b.email));
      return sendJson(res, 200, { users }, baseHeaders);
    }

    if (req.method === 'GET' && url.pathname === '/api/auth/operational-sessions') {
      const db = loadDb();
      const ctx = getUserFromSession(db, req);
      if (!requireAdmin(ctx, res, baseHeaders)) return;
      const sessions = buildOperationalSessionsSummary();
      return sendJson(res, 200, { sessions }, baseHeaders);
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/operational-sessions/revoke') {
      const db = loadDb();
      const ctx = getUserFromSession(db, req);
      if (!requireAdmin(ctx, res, baseHeaders)) return;
      const body = await readJsonBody(req);
      const module = String(body.module || '').trim().toLowerCase();
      const userId = String(body.userId || '').trim();
      if (!module || !userId) {
        return sendJson(res, 400, { error: 'module y userId son obligatorios.' }, baseHeaders);
      }
      const result = revokeOperationalSessions({ module, userId });
      if (!result.ok) {
        return sendJson(res, 400, { error: 'Módulo inválido.' }, baseHeaders);
      }
      appendAccessAuditLog({
        module,
        action: 'revoke_sessions',
        status: 'success',
        userId,
        email: ctx?.user?.email || '',
        name: ctx?.user?.email || 'admin',
        role: 'admin',
        ip: clientIp(req),
        userAgent: req.headers['user-agent'] || '',
        reason: `revoked:${result.removed}`,
        meta: { actorEmail: ctx?.user?.email || '' },
      });
      logAuditRequest(db, req, ctx, 'managed_user_updated', {
        scope: 'admin-access',
        target: `${module}:${userId}`,
        meta: { action: 'revoke_operational_sessions', removed: result.removed },
      });
      saveDb(db);
      return sendJson(res, 200, result, baseHeaders);
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/admin/users') {
      const db = loadDb();
      const ctx = getUserFromSession(db, req);
      if (!requireAdmin(ctx, res, baseHeaders)) return;
      const body = await readJsonBody(req);

      const email = normalizeEmail(body.email);
      const role = normalizeUserRole(body.role || 'user');
      const otpEmails = [...new Set((Array.isArray(body.otpEmails) ? body.otpEmails : String(body.otpEmails || '').split(/[\s,;]+/)).map((item) => normalizeEmail(item)).filter(Boolean))];
      const requestedPassword = String(body.password || '');

      if (!isAllowedManagedEmail(email)) {
        return sendJson(res, 400, { error: 'invalid_email', message: `Solo se permiten correos @${ALLOWED_DOMAIN} o @${ALLOWED_ADMIN_DOMAIN}` }, baseHeaders);
      }
      if (findUserByEmail(db, email)) {
        return sendJson(res, 409, { error: 'already_exists', message: 'Ese correo ya tiene una cuenta registrada.' }, baseHeaders);
      }
      if (requestedPassword && !isStrongPassword(requestedPassword)) {
        return sendJson(res, 400, { error: 'weak_password', message: PASSWORD_POLICY_HINT }, baseHeaders);
      }

      const now = new Date().toISOString();
      const password = requestedPassword || generateStrongPassword();
      const user = {
        id: randomId(12),
        email,
        role,
        accessEnabled: true,
        otpEmails: otpEmails.length ? otpEmails : [email],
        passwordHash: derivePassword(password),
        createdAt: now,
        updatedAt: now,
        verifiedAt: now,
      };
      db.users.push(user);
      logAuditRequest(db, req, ctx, 'managed_user_created', {
        scope: 'admin-access',
        target: email,
        meta: { role, accessEnabled: true },
      });
      saveDb(db);
      return sendJson(res, 200, {
        ok: true,
        user: buildManagedUserPayload(db, user),
        temporaryPassword: password,
      }, baseHeaders);
    }

    if (req.method === 'PATCH' && url.pathname === '/api/auth/admin/users') {
      const db = loadDb();
      const ctx = getUserFromSession(db, req);
      if (!requireAdmin(ctx, res, baseHeaders)) return;
      const body = await readJsonBody(req);

      const email = normalizeEmail(body.email);
      const user = findUserByEmail(db, email);
      if (!user) return sendJson(res, 404, { error: 'not_found', message: 'No encontré esa cuenta.' }, baseHeaders);

      const nextRole = body.role == null ? userRole(user) : normalizeUserRole(body.role);
      const nextAccessEnabled = body.accessEnabled == null ? userAccessEnabled(user) : parseBooleanish(body.accessEnabled, userAccessEnabled(user));
      const nextOtpEmails = body.otpEmails == null
        ? userOtpEmails(user)
        : [...new Set((Array.isArray(body.otpEmails) ? body.otpEmails : String(body.otpEmails || '').split(/[\s,;]+/)).map((item) => normalizeEmail(item)).filter(Boolean))];
      const revokeSessions = parseBooleanish(body.revokeSessions, false);

      if (ctx.user.email === user.email && (!nextAccessEnabled || nextRole !== 'admin')) {
        return sendJson(res, 400, { error: 'invalid_self_update', message: 'No puedes quitarte tu propio acceso de administrador.' }, baseHeaders);
      }

      user.role = nextRole;
      user.accessEnabled = nextAccessEnabled;
      user.otpEmails = nextOtpEmails.length ? nextOtpEmails : [user.email];
      user.updatedAt = new Date().toISOString();

      if (revokeSessions || !nextAccessEnabled) {
        db.sessions = db.sessions.filter((item) => item.userId !== user.id);
        db.trustedDevices = db.trustedDevices.filter((item) => item.userId !== user.id);
      }

      logAuditRequest(db, req, ctx, 'managed_user_updated', {
        scope: 'admin-access',
        target: email,
        meta: { role: nextRole, accessEnabled: nextAccessEnabled, revokeSessions, otpEmails: nextOtpEmails },
      });
      saveDb(db);
      return sendJson(res, 200, { ok: true, user: buildManagedUserPayload(db, user) }, baseHeaders);
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/admin/users/reset-password') {
      const db = loadDb();
      const ctx = getUserFromSession(db, req);
      if (!requireAdmin(ctx, res, baseHeaders)) return;
      const body = await readJsonBody(req);

      const email = normalizeEmail(body.email);
      const user = findUserByEmail(db, email);
      if (!user) return sendJson(res, 404, { error: 'not_found', message: 'No encontré esa cuenta.' }, baseHeaders);

      const temporaryPassword = generateStrongPassword();
      user.passwordHash = derivePassword(temporaryPassword);
      user.updatedAt = new Date().toISOString();
      db.sessions = db.sessions.filter((item) => item.userId !== user.id);
      db.trustedDevices = db.trustedDevices.filter((item) => item.userId !== user.id);
      logAuditRequest(db, req, ctx, 'managed_user_password_reset', {
        scope: 'admin-access',
        target: email,
      });
      saveDb(db);

      return sendJson(res, 200, {
        ok: true,
        user: buildManagedUserPayload(db, user),
        temporaryPassword,
      }, baseHeaders);
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
      const db = loadDb();
      const session = findSession(db, req);
      if (session) {
        db.sessions = db.sessions.filter((item) => item.id !== session.record.id);
        if (canAccessPersonalData(session.user)) {
          logAuditRequest(db, req, { user: session.user }, 'personal_data_logout', { scope: 'admin-access' });
        }
        saveDb(db);
      }
      setCookies(res, [clearCookie(SESSION_COOKIE)]);
      return sendJson(res, 200, { ok: true }, baseHeaders);
    }

    if (url.pathname === '/api/auth/status-notifications') {
      const db = loadDb();
      saveDb(db);
      const ctx = getUserFromSession(db, req);
      if (!ctx) return sendJson(res, 401, { error: 'unauthorized', message: 'Sesión requerida' }, baseHeaders);
      if (!requireRoles(ctx, ['admin', 'user', 'operations'], res, baseHeaders, 'Este panel no está disponible para este rol.')) return;

      if (req.method === 'GET') {
        return sendJson(res, 200, statusNotificationPayload(getStatusPref(resolveStatusTargetPhone())), baseHeaders);
      }

      if (req.method === 'POST') {
        const body = await readJsonBody(req);
        const action = String(body.action || '');
        const phone = resolveStatusTargetPhone();
        const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const pref = updateStatusPref(phone, (current) => {
          if (action === 'mute_alerts_24h') {
            return { ...current, muteAlertsUntil: until, updatedAt: new Date().toISOString() };
          }
          if (action === 'mute_status_24h') {
            return { ...current, muteStatusUntil: until, updatedAt: new Date().toISOString() };
          }
          if (action === 'resume_all') {
            return { ...current, muteAlertsUntil: null, muteStatusUntil: null, updatedAt: new Date().toISOString() };
          }
          throw new Error('Acción de notificación inválida');
        });

        return sendJson(res, 200, statusNotificationPayload(pref), baseHeaders);
      }

      return sendJson(res, 405, { error: 'method_not_allowed' }, baseHeaders);
    }

    if (url.pathname === '/api/auth/exports/meta') {
      const db = loadDb();
      saveDb(db);
      const ctx = getUserFromSession(db, req);
      if (!ctx) return sendJson(res, 401, { error: 'unauthorized', message: 'Sesión requerida' }, baseHeaders);
      if (!requireRoles(ctx, ['admin', 'user', 'finance'], res, baseHeaders, 'Este módulo no está disponible para este rol.')) return;
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' }, baseHeaders);
      try {
        return sendJson(res, 200, await loadExportMeta({ user: ctx.user }), baseHeaders);
      } catch (error) {
        return sendJson(res, 502, { error: 'connect_unavailable', message: error.message }, baseHeaders);
      }
    }

    if (url.pathname === '/api/auth/connect-users') {
      const db = loadDb();
      saveDb(db);
      const ctx = getUserFromSession(db, req);
      if (!ctx) return sendJson(res, 401, { error: 'unauthorized', message: 'Sesión requerida' }, baseHeaders);
      if (!requirePersonalDataOwner(ctx, req, res, baseHeaders, db)) return;

      if (req.method === 'GET' || req.method === 'POST') {
        try {
          const forceRefresh = req.method === 'POST' || url.searchParams.get('refresh') === '1';
          const snapshot = await fetchConnectUsersSnapshot({ forceRefresh });
          logAuditRequest(db, req, ctx, 'connect_users_viewed', {
            target: `users:${Array.isArray(snapshot?.users) ? snapshot.users.length : 0}`,
            meta: { forceRefresh },
          });
          saveDb(db);
          return sendJson(res, 200, snapshot, baseHeaders);
        } catch (error) {
          return sendJson(res, 502, { error: 'connect_unavailable', message: error.message }, baseHeaders);
        }
      }

      return sendJson(res, 405, { error: 'method_not_allowed' }, baseHeaders);
    }

    if (url.pathname === '/api/auth/connect-users/export-marketing') {
      const db = loadDb();
      saveDb(db);
      const ctx = getUserFromSession(db, req);
      if (!ctx) return sendJson(res, 401, { error: 'unauthorized', message: 'Sesión requerida' }, baseHeaders);
      if (!requirePersonalDataOwner(ctx, req, res, baseHeaders, db)) return;
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' }, baseHeaders);
      try {
        const body = await readJsonBody(req);
        const query = String(body.query || '').trim();
        const segment = String(body.segment || 'all').trim().toLowerCase();
        const snapshot = await fetchConnectUsersSnapshot({ forceRefresh: Boolean(body.forceRefresh) });
        const users = sortUsersForMarketing((snapshot.users || []).filter((item) => matchesUserQuery(item, query) && matchesMarketingSegment(item, segment)));
        const buffer = await buildMarketingUsersWorkbook(users, { generatedAt: snapshot.lastSyncAt || new Date().toISOString(), query: `${query || 'Todos'}${segment && segment !== 'all' ? ` · segmento ${segment}` : ''}` });
        const filename = safeAttachmentFilename(`EVINKA_usuarios_marketing_${new Date().toISOString().slice(0, 10)}.xlsx`, 'EVINKA_usuarios_marketing.xlsx');
        logAuditRequest(db, req, ctx, 'marketing_export_downloaded', {
          target: filename,
          meta: { query, segment, totalRows: users.length },
        });
        saveDb(db);
        return sendBytes(res, 200, buffer, {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '')}"`,
          ...baseHeaders,
        });
      } catch (error) {
        return sendJson(res, 500, { error: 'marketing_export_failed', message: error.message }, baseHeaders);
      }
    }

    if (url.pathname === '/api/auth/exports') {
      const db = loadDb();
      saveDb(db);
      const ctx = getUserFromSession(db, req);
      if (!ctx) return sendJson(res, 401, { error: 'unauthorized', message: 'Sesión requerida' }, baseHeaders);
      if (!requireRoles(ctx, ['admin', 'user', 'finance'], res, baseHeaders, 'Este módulo no está disponible para este rol.')) return;

      if (req.method === 'GET') {
        try {
          const page = Math.max(1, Number(url.searchParams.get('page') || '1') || 1);
          const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') || '50') || 50));
          const data = await connectJson(`/api/v1/admin/xlsxexports?page_size=${pageSize}&page=${page}`);
          const cacheRows = await refreshCachedExportsReadiness(data.xlsxExports || []);
          const merged = mergeExportRows(data.xlsxExports || [], cacheRows || []).filter((row) => canAccessPersonalData(ctx.user) || !isRestrictedPersonalExportKind(row?.kind));
          if (canAccessPersonalData(ctx.user)) {
            logAuditRequest(db, req, ctx, 'exports_list_viewed', { target: `rows:${merged.length}` });
            saveDb(db);
          }
          return sendJson(res, 200, { exports: merged }, baseHeaders);
        } catch (error) {
          return sendJson(res, 502, { error: 'connect_unavailable', message: error.message }, baseHeaders);
        }
      }

      if (req.method === 'POST') {
        const body = await readJsonBody(req);
        const payload = {
          kind: normalizeExportKind(body.kind || 'transaction'),
          ...(body.startTime ? { startTime: String(body.startTime) } : {}),
          ...(body.endTime ? { endTime: String(body.endTime) } : {}),
          ...(body.merchant ? { merchant: String(body.merchant) } : {}),
        };
        if (isRestrictedPersonalExportKind(payload.kind) && !canAccessPersonalData(ctx.user)) {
          logAuditRequest(db, req, ctx, 'personal_export_request_denied', { status: 'denied', target: payload.kind });
          saveDb(db);
          return sendJson(res, 403, { error: 'forbidden', message: 'El export de datos personales está restringido a la persona autorizada.' }, baseHeaders);
        }
        if (payload.kind === 'invoice') {
          return sendJson(res, 400, { error: 'unsupported_kind', message: 'Invoice todavía no responde en la API detectada de EVINKA Connect.' }, baseHeaders);
        }
        try {
          const created = await connectJson('/api/v1/admin/xlsxexports', { method: 'POST', body: payload });
          upsertCachedExport(created);
          if (isRestrictedPersonalExportKind(payload.kind)) {
            logAuditRequest(db, req, ctx, 'personal_export_requested', { target: created?.id || payload.kind, meta: { kind: payload.kind } });
            saveDb(db);
          }
          return sendJson(res, 200, { ok: true, export: created }, baseHeaders);
        } catch (error) {
          return sendJson(res, 400, { error: 'export_failed', message: error.message }, baseHeaders);
        }
      }

      return sendJson(res, 405, { error: 'method_not_allowed' }, baseHeaders);
    }

    if (url.pathname === '/api/auth/exports/download') {
      const db = loadDb();
      saveDb(db);
      const ctx = getUserFromSession(db, req);
      if (!ctx) return sendJson(res, 401, { error: 'unauthorized', message: 'Sesión requerida' }, baseHeaders);
      if (!requireRoles(ctx, ['admin', 'user', 'finance'], res, baseHeaders, 'Este módulo no está disponible para este rol.')) return;
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' }, baseHeaders);

      const exportId = String(url.searchParams.get('xlsxExportId') || '').trim();
      const fileName = String(url.searchParams.get('fileName') || '').trim();
      const cachedRow = findCachedExport(exportId);
      if (isRestrictedPersonalExportKind(cachedRow?.kind) && !canAccessPersonalData(ctx.user)) {
        logAuditRequest(db, req, ctx, 'personal_export_download_denied', { status: 'denied', target: exportId || fileName });
        saveDb(db);
        return sendJson(res, 403, { error: 'forbidden', message: 'El export de datos personales está restringido a la persona autorizada.' }, baseHeaders);
      }
      if (!exportId || !fileName) {
        return sendJson(res, 400, { error: 'invalid_download', message: 'Falta el identificador del export o el nombre del archivo.' }, baseHeaders);
      }

      try {
        const file = await connectBytes(`/api/v1/admin/files/xlsxexport?xlsxExportId=${encodeURIComponent(exportId)}&fileName=${encodeURIComponent(fileName)}`);
        const downloadName = safeAttachmentFilename(url.searchParams.get('downloadName') || buildExportDisplayFilename(cachedRow, { clean: false }), fileName);
        const disposition = `attachment; filename="${downloadName.replace(/"/g, '')}"`;
        if (isRestrictedPersonalExportKind(cachedRow?.kind)) {
          logAuditRequest(db, req, ctx, 'personal_export_downloaded', { target: exportId, meta: { fileName: downloadName } });
          saveDb(db);
        }
        return sendBytes(res, 200, file.buffer, {
          'Content-Type': file.contentType,
          'Content-Disposition': disposition,
          ...baseHeaders,
        });
      } catch (error) {
        return sendJson(res, 502, { error: 'download_failed', message: error.message }, baseHeaders);
      }
    }

    if (url.pathname === '/api/auth/exports/download-clean') {
      const db = loadDb();
      saveDb(db);
      const ctx = getUserFromSession(db, req);
      if (!ctx) return sendJson(res, 401, { error: 'unauthorized', message: 'Sesión requerida' }, baseHeaders);
      if (!requireRoles(ctx, ['admin', 'user', 'finance'], res, baseHeaders, 'Este módulo no está disponible para este rol.')) return;
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' }, baseHeaders);

      const body = await readJsonBody(req);
      const exportId = String(body.xlsxExportId || '').trim();
      const fileName = String(body.fileName || '').trim();
      const kind = normalizeExportKind(body.kind || 'transaction');
      if (isRestrictedPersonalExportKind(kind) && !canAccessPersonalData(ctx.user)) {
        logAuditRequest(db, req, ctx, 'personal_clean_export_denied', { status: 'denied', target: exportId || kind });
        saveDb(db);
        return sendJson(res, 403, { error: 'forbidden', message: 'El export de datos personales está restringido a la persona autorizada.' }, baseHeaders);
      }
      const cachedRow = findCachedExport(exportId);
      const downloadName = safeAttachmentFilename(body.downloadName || buildExportDisplayFilename(cachedRow, { clean: true }), cleanDownloadFilename(fileName, kind));
      const selected = Array.isArray(body.columns) ? body.columns.map((item) => String(item || '').trim()).filter(Boolean) : [];
      const allowed = new Set((EXPORT_COLUMN_DEFS[kind]?.columns || []).map((item) => String(item)));
      const columns = selected.filter((item) => allowed.has(item));
      if (!exportId || !fileName) {
        return sendJson(res, 400, { error: 'invalid_download', message: 'Falta el identificador del export o el nombre del archivo.' }, baseHeaders);
      }
      if (!columns.length) {
        return sendJson(res, 400, { error: 'invalid_columns', message: 'Selecciona al menos una columna válida.' }, baseHeaders);
      }

      try {
        const file = await getExportFileBytes({ exportId, fileName, kind, columns, clean: true });
        if (isRestrictedPersonalExportKind(kind)) {
          logAuditRequest(db, req, ctx, 'personal_clean_export_downloaded', { target: exportId, meta: { columns, downloadName } });
          saveDb(db);
        }
        return sendBytes(res, 200, file.buffer, {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${downloadName.replace(/"/g, '')}"`,
          ...baseHeaders,
        });
      } catch (error) {
        return sendJson(res, 500, { error: 'clean_export_failed', message: error.message }, baseHeaders);
      }
    }

    if (url.pathname === '/api/auth/exports/email') {
      const db = loadDb();
      saveDb(db);
      const ctx = getUserFromSession(db, req);
      if (!ctx) return sendJson(res, 401, { error: 'unauthorized', message: 'Sesión requerida' }, baseHeaders);
      if (!requireRoles(ctx, ['admin', 'user', 'finance'], res, baseHeaders, 'Este módulo no está disponible para este rol.')) return;
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' }, baseHeaders);
      if (!mailer) return sendJson(res, 500, { error: 'mail_unavailable', message: 'No hay correo configurado.' }, baseHeaders);

      const body = await readJsonBody(req);
      const recipients = Array.isArray(body.recipients)
        ? body.recipients.map((item) => normalizeEmail(item)).filter(Boolean)
        : [];
      const invalidRecipients = recipients.filter((email) => !isAllowedEmail(email));
      const requestedExports = normalizeRequestedExports(body).map((item) => {
        const exportId = String(item.xlsxExportId || '').trim();
        const fileName = String(item.fileName || '').trim();
        const kind = normalizeExportKind(item.kind || 'transaction');
        const variant = String(item.variant || body.variant || 'original').toLowerCase() === 'clean' ? 'clean' : 'original';
        const selected = Array.isArray(item.columns) ? item.columns.map((col) => String(col || '').trim()).filter(Boolean) : [];
        const allowed = new Set((EXPORT_COLUMN_DEFS[kind]?.columns || []).map((col) => String(col)));
        const columns = selected.filter((col) => allowed.has(col));
        const cachedRow = findCachedExport(exportId);
        return {
          exportId,
          fileName,
          kind,
          variant,
          clean: variant === 'clean',
          columns,
          cachedRow,
        };
      });

      const firstExport = requestedExports[0] || null;
      const mailContent = buildExportMailContent(firstExport?.cachedRow || { kind: firstExport?.kind || 'transaction' }, { clean: firstExport?.clean });
      const subject = String(body.subject || '').trim() || mailContent.subject;
      const text = String(body.text || '').trim() || mailContent.text;
      const html = String(body.html || '').trim() || mailTextToHtml(text) || mailContent.html;

      if (!requestedExports.length) {
        return sendJson(res, 400, { error: 'invalid_export', message: 'Falta al menos un export a enviar.' }, baseHeaders);
      }
      if (!recipients.length) {
        return sendJson(res, 400, { error: 'invalid_recipients', message: 'Agrega al menos un correo.' }, baseHeaders);
      }
      if (invalidRecipients.length) {
        return sendJson(res, 400, { error: 'invalid_domain', message: 'Solo se permiten correos @evinka.tech.' }, baseHeaders);
      }
      if (requestedExports.some((item) => isRestrictedPersonalExportKind(item.kind) && !canAccessPersonalData(ctx.user))) {
        logAuditRequest(db, req, ctx, 'personal_export_email_denied', { status: 'denied', target: 'email' });
        saveDb(db);
        return sendJson(res, 403, { error: 'forbidden', message: 'El envío de exports con datos personales está restringido a la persona autorizada.' }, baseHeaders);
      }
      if (requestedExports.some((item) => !item.exportId || !item.fileName)) {
        return sendJson(res, 400, { error: 'invalid_export', message: 'Uno o más exports no son válidos.' }, baseHeaders);
      }
      if (requestedExports.some((item) => item.clean && !item.columns.length)) {
        return sendJson(res, 400, { error: 'invalid_columns', message: 'Selecciona al menos una columna para cada export limpio.' }, baseHeaders);
      }

      try {
        const attachments = await Promise.all(requestedExports.map(async (item) => {
          const file = await getExportFileBytes({
            exportId: item.exportId,
            fileName: item.fileName,
            kind: item.kind,
            columns: item.columns,
            clean: item.clean,
          });
          return {
            name: buildExportDisplayFilename(item.cachedRow || { kind: item.kind }, { clean: item.clean }),
            contentType: file.contentType,
            contentBytes: Buffer.from(file.buffer).toString('base64'),
          };
        }));
        await mailer.sendMail({
          to: recipients,
          subject,
          text,
          html,
          attachments,
        });
        if (requestedExports.some((item) => isRestrictedPersonalExportKind(item.kind))) {
          logAuditRequest(db, req, ctx, 'personal_export_emailed', {
            target: recipients.join(','),
            meta: { exports: requestedExports.map((item) => ({ exportId: item.exportId, kind: item.kind, variant: item.variant })) },
          });
          saveDb(db);
        }
        return sendJson(res, 200, {
          ok: true,
          sentTo: recipients,
          attachmentNames: attachments.map((item) => item.name),
        }, baseHeaders);
      } catch (error) {
        return sendJson(res, 500, { error: 'mail_send_failed', message: error.message }, baseHeaders);
      }
    }

    if (url.pathname === '/api/auth/exports/email-draft') {
      const db = loadDb();
      saveDb(db);
      const ctx = getUserFromSession(db, req);
      if (!ctx) return sendJson(res, 401, { error: 'unauthorized', message: 'Sesión requerida' }, baseHeaders);
      if (!requireRoles(ctx, ['admin', 'user', 'finance'], res, baseHeaders, 'Este módulo no está disponible para este rol.')) return;
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' }, baseHeaders);

      const body = await readJsonBody(req);
      const requestedExports = normalizeRequestedExports(body).map((item) => {
        const exportId = String(item.xlsxExportId || '').trim();
        const cachedRow = exportId ? findCachedExport(exportId) : null;
        return {
          xlsxExportId: exportId,
          fileName: String(item.fileName || '').trim(),
          kind: normalizeExportKind(item.kind || cachedRow?.kind || 'transaction'),
          merchant: item.merchant || cachedRow?.merchant || 'Toda la red',
          startTime: item.startTime || cachedRow?.startTime || null,
          endTime: item.endTime || cachedRow?.endTime || null,
          downloadName: buildExportDisplayFilename(cachedRow || item, {
            clean: String(item.variant || body.variant || 'original').toLowerCase() === 'clean',
          }),
        };
      });
      if (!requestedExports.length) {
        return sendJson(res, 400, { error: 'invalid_export', message: 'Selecciona al menos un export para redactar el correo.' }, baseHeaders);
      }
      if (requestedExports.some((item) => isRestrictedPersonalExportKind(item.kind) && !canAccessPersonalData(ctx.user))) {
        logAuditRequest(db, req, ctx, 'personal_export_email_draft_denied', { scope: 'admin-access', status: 'denied', target: 'email-draft' });
        saveDb(db);
        return sendJson(res, 403, { error: 'forbidden', message: 'La redacción de correo para exports con datos personales está restringida a la persona autorizada.' }, baseHeaders);
      }

      try {
        const draft = await buildExportMailDraftWithAi({
          exports: requestedExports,
          recipients: Array.isArray(body.recipients) ? body.recipients.map((item) => normalizeEmail(item)).filter(Boolean) : [],
          context: String(body.context || '').trim(),
          variant: String(body.variant || 'original').toLowerCase() === 'clean' ? 'clean' : 'original',
        });
        return sendJson(res, 200, draft, baseHeaders);
      } catch (error) {
        return sendJson(res, 500, { error: 'mail_draft_failed', message: error.message }, baseHeaders);
      }
    }

    const body = await readJsonBody(req);
    const userAgent = req.headers['user-agent'] || 'unknown-device';

    if (req.method === 'POST' && url.pathname === '/api/auth/register/start') {
      const email = normalizeEmail(body.email);
      const password = String(body.password || '');
      const registerLimit = rateLimit(`register:${ip}:${email}`, { limit: 6, windowMs: 10 * 60 * 1000 });
      if (!registerLimit.ok) return tooManyRequests(res, baseHeaders, registerLimit.retryAfterSec, 'Hiciste demasiados intentos de registro. Espera un momento y vuelve a probar.');
      if (!isAllowedEmail(email)) return sendJson(res, 400, { error: 'invalid_domain', message: `Solo se permiten correos @${ALLOWED_DOMAIN}` }, baseHeaders);
      if (!isStrongPassword(password)) return sendJson(res, 400, { error: 'weak_password', message: PASSWORD_POLICY_HINT }, baseHeaders);
      if (!mailer) return sendJson(res, 500, { error: 'mail_unavailable', message: 'No hay correo configurado' }, baseHeaders);

      const db = loadDb();
      let user = findUserByEmail(db, email);
      if (user?.verifiedAt) return sendJson(res, 409, { error: 'already_exists', message: 'Ese correo ya tiene cuenta. Inicia sesión.' }, baseHeaders);
      if (!user) {
        user = {
          id: randomId(12),
          email,
          role: 'user',
          accessEnabled: false,
          passwordHash: derivePassword(password),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          verifiedAt: null,
        };
        db.users.push(user);
      } else {
        user.passwordHash = derivePassword(password);
        user.updatedAt = new Date().toISOString();
      }

      try {
        const result = await createAndSendChallenge({ db, user, type: 'register', userAgent, purpose: 'register', email });
        return sendJson(res, 200, {
          ok: true,
          requiresCode: true,
          challengeId: result.challenge.id,
          maskedEmail: result.maskedEmail,
          mode: 'register',
          reused: result.reused,
        }, baseHeaders);
      } catch (error) {
        return sendJson(res, 503, { error: 'mail_unavailable', message: error.message }, baseHeaders);
      }
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/register/verify') {
      const challengeId = String(body.challengeId || '');
      const code = String(body.code || '');
      const db = loadDb();
      let challenge;
      try {
        challenge = verifyChallenge({ db, challengeId, code, type: 'register' });
      } catch (error) {
        return sendJson(res, 400, { error: 'invalid_code', message: error.message }, baseHeaders);
      }
      const user = db.users.find((item) => item.id === challenge.userId);
      if (!user) return sendJson(res, 404, { error: 'user_not_found' }, baseHeaders);
      user.verifiedAt = new Date().toISOString();
      user.updatedAt = new Date().toISOString();
      db.challenges = db.challenges.filter((item) => item.id !== challenge.id);

      const trustedDevice = rememberTrustedDevice(db, req, user, userAgent);

      if (!userAccessEnabled(user)) {
        saveDb(db);
        setCookies(res, [
          cookieString(DEVICE_COOKIE, trustedDevice.rawToken, { maxAge: TRUSTED_DEVICE_TTL_MS / 1000 }),
        ]);
        return sendJson(res, 200, {
          ok: true,
          requiresApproval: true,
          message: 'Tu cuenta fue verificada y quedó pendiente de aprobación por un administrador.',
        }, baseHeaders);
      }

      const sessionToken = randomToken();
      db.sessions.push({
        id: randomId(12),
        userId: user.id,
        tokenHash: sha256(sessionToken),
        userAgent,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      });
      saveDb(db);
      setCookies(res, [
        cookieString(SESSION_COOKIE, sessionToken, { maxAge: SESSION_TTL_MS / 1000 }),
        cookieString(DEVICE_COOKIE, trustedDevice.rawToken, { maxAge: TRUSTED_DEVICE_TTL_MS / 1000 }),
      ]);
      return sendJson(res, 200, { ok: true, ...sessionPayload(user, true) }, baseHeaders);
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      const email = normalizeEmail(body.email);
      const password = String(body.password || '');
      const loginLimit = rateLimit(`login:${ip}:${email}`, { limit: 8, windowMs: 10 * 60 * 1000 });
      if (!loginLimit.ok) return tooManyRequests(res, baseHeaders, loginLimit.retryAfterSec, 'Hiciste demasiados intentos de ingreso. Espera un momento y vuelve a probar.');
      const db = loadDb();
      const user = findUserByEmail(db, email);
      if (!user?.verifiedAt || !verifyPassword(password, user.passwordHash)) {
        return sendJson(res, 401, { error: 'invalid_credentials', message: 'Correo o contraseña incorrectos' }, baseHeaders);
      }
      if (!userAccessEnabled(user)) {
        return sendJson(res, 403, { error: 'access_disabled', message: 'Tu acceso está deshabilitado. Contacta a un administrador.' }, baseHeaders);
      }

      const trusted = findTrustedDevice(db, req, user.id);
      if (trusted?.record) {
        trusted.record.lastSeenAt = new Date().toISOString();
        trusted.record.expiresAt = new Date(Date.now() + TRUSTED_DEVICE_TTL_MS).toISOString();
        const sessionToken = randomToken();
        db.sessions.push({
          id: randomId(12),
          userId: user.id,
          tokenHash: sha256(sessionToken),
          userAgent,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
        });
        if (canAccessPersonalData(user)) {
          logAuditRequest(db, req, { user }, 'personal_data_login', { scope: 'admin-access', target: 'trusted-device' });
        }
        saveDb(db);
        setCookies(res, [
          cookieString(SESSION_COOKIE, sessionToken, { maxAge: SESSION_TTL_MS / 1000 }),
          cookieString(DEVICE_COOKIE, trusted.rawToken, { maxAge: TRUSTED_DEVICE_TTL_MS / 1000 }),
        ]);
        return sendJson(res, 200, { ok: true, requiresCode: false, ...sessionPayload(user, true) }, baseHeaders);
      }

      try {
        const result = await createAndSendChallenge({ db, user, type: 'login', userAgent, purpose: 'login', email });
        return sendJson(res, 200, {
          ok: true,
          requiresCode: true,
          challengeId: result.challenge.id,
          maskedEmail: result.maskedEmail,
          mode: 'login',
          reused: result.reused,
        }, baseHeaders);
      } catch (error) {
        return sendJson(res, 503, { error: 'mail_unavailable', message: error.message }, baseHeaders);
      }
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/login/verify') {
      const challengeId = String(body.challengeId || '');
      const code = String(body.code || '');
      const db = loadDb();
      let challenge;
      try {
        challenge = verifyChallenge({ db, challengeId, code, type: 'login' });
      } catch (error) {
        return sendJson(res, 400, { error: 'invalid_code', message: error.message }, baseHeaders);
      }
      const user = db.users.find((item) => item.id === challenge.userId && item.verifiedAt);
      if (!user) return sendJson(res, 404, { error: 'user_not_found' }, baseHeaders);
      db.challenges = db.challenges.filter((item) => item.id !== challenge.id);

      const trustedDevice = rememberTrustedDevice(db, req, user, userAgent);

      const sessionToken = randomToken();
      db.sessions.push({
        id: randomId(12),
        userId: user.id,
        tokenHash: sha256(sessionToken),
        userAgent,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      });
      if (canAccessPersonalData(user)) {
        logAuditRequest(db, req, { user }, 'personal_data_login', { scope: 'admin-access', target: 'otp-verified' });
      }
      saveDb(db);
      setCookies(res, [
        cookieString(SESSION_COOKIE, sessionToken, { maxAge: SESSION_TTL_MS / 1000 }),
        cookieString(DEVICE_COOKIE, trustedDevice.rawToken, { maxAge: TRUSTED_DEVICE_TTL_MS / 1000 }),
      ]);
      return sendJson(res, 200, { ok: true, ...sessionPayload(user, true) }, baseHeaders);
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/password/reset/start') {
      const email = normalizeEmail(body.email);
      const resetLimit = rateLimit(`password-reset:${ip}:${email}`, { limit: 6, windowMs: 10 * 60 * 1000 });
      if (!resetLimit.ok) return tooManyRequests(res, baseHeaders, resetLimit.retryAfterSec, 'Hiciste demasiadas pruebas seguidas. Espera un momento y vuelve a pedir el código.');
      if (!isAllowedEmail(email)) return sendJson(res, 400, { error: 'invalid_domain', message: `Solo se permiten correos @${ALLOWED_DOMAIN}` }, baseHeaders);
      if (!mailer) return sendJson(res, 500, { error: 'mail_unavailable', message: 'No hay correo configurado' }, baseHeaders);

      const db = loadDb();
      const user = findUserByEmail(db, email);
      if (!user?.verifiedAt) {
        return sendJson(res, 200, {
          ok: true,
          generic: true,
          message: 'Si el correo existe, enviaremos un código de recuperación.',
        }, baseHeaders);
      }

      try {
        const result = await createAndSendChallenge({ db, user, type: 'reset', userAgent, purpose: 'reset', email });
        return sendJson(res, 200, {
          ok: true,
          requiresCode: true,
          challengeId: result.challenge.id,
          maskedEmail: result.maskedEmail,
          mode: 'reset',
          reused: result.reused,
        }, baseHeaders);
      } catch (error) {
        return sendJson(res, 503, { error: 'mail_unavailable', message: error.message }, baseHeaders);
      }
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/password/reset/verify') {
      const challengeId = String(body.challengeId || '');
      const code = String(body.code || '');
      const db = loadDb();
      let challenge;
      try {
        challenge = verifyChallenge({ db, challengeId, code, type: 'reset' });
      } catch (error) {
        return sendJson(res, 400, { error: 'invalid_code', message: error.message }, baseHeaders);
      }

      const user = db.users.find((item) => item.id === challenge.userId && item.verifiedAt);
      if (!user) return sendJson(res, 404, { error: 'user_not_found' }, baseHeaders);

      db.challenges = db.challenges.filter((item) => item.id !== challenge.id);
      const { rawToken } = issuePasswordResetGrant(db, user.id, challenge.id);
      saveDb(db);
      return sendJson(res, 200, {
        ok: true,
        resetToken: rawToken,
        email: user.email,
      }, baseHeaders);
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/password/reset/complete') {
      const resetToken = String(body.resetToken || '');
      const password = String(body.password || '');
      if (!isStrongPassword(password)) {
        return sendJson(res, 400, { error: 'weak_password', message: PASSWORD_POLICY_HINT }, baseHeaders);
      }

      const db = loadDb();
      const grant = findPasswordResetGrant(db, resetToken);
      if (!grant) {
        return sendJson(res, 400, { error: 'invalid_reset', message: 'La sesión de recuperación venció o no es válida.' }, baseHeaders);
      }

      const user = db.users.find((item) => item.id === grant.userId && item.verifiedAt);
      if (!user) return sendJson(res, 404, { error: 'user_not_found' }, baseHeaders);

      user.passwordHash = derivePassword(password);
      user.updatedAt = new Date().toISOString();
      grant.usedAt = new Date().toISOString();
      db.passwordResetGrants = db.passwordResetGrants.filter((item) => item.id !== grant.id);
      db.sessions = db.sessions.filter((item) => item.userId !== user.id);
      db.trustedDevices = db.trustedDevices.filter((item) => item.userId !== user.id);
      saveDb(db);

      setCookies(res, [clearCookie(SESSION_COOKIE), clearCookie(DEVICE_COOKIE)]);
      return sendJson(res, 200, {
        ok: true,
        message: 'Contraseña actualizada. Inicia sesión con la nueva contraseña.',
      }, baseHeaders);
    }

    return sendJson(res, 404, { error: 'not_found' }, baseHeaders);
  } catch (error) {
    console.error('[status-auth]', error);
    return sendJson(res, 500, { error: 'internal_error', message: error.message }, securityHeaders());
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`EVINKA status auth escuchando en http://127.0.0.1:${PORT}`);
});
