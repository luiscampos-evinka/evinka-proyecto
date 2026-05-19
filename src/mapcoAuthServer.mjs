import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadEnv } from './config.mjs';
import { MicrosoftGraphClient } from './microsoftGraph.mjs';

loadEnv();

const PORT = Number(process.env.MAPCO_AUTH_PORT || process.env.STATUS_AUTH_PORT || 8791);
const DB_PATH = process.env.MAPCO_AUTH_DB_PATH || process.env.STATUS_AUTH_DB_PATH || '/root/.openclaw/workspace/data/mapco-auth-db.json';
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const TRUSTED_DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const SESSION_COOKIE = 'evinka_mapco_session';
const DEVICE_COOKIE = 'evinka_mapco_device';
const ALLOWED_DOMAINS = ['evinka.tech', 'evinkatech.onmicrosoft.com'];
const PASSWORD_POLICY_HINT = 'La contraseña debe tener al menos 12 caracteres e incluir mayúscula, minúscula, número y símbolo.';
const EMAIL_FROM_NAME = process.env.MICROSOFT_SENDER_NAME || 'EVINKA';

const mailer = process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
  ? new MicrosoftGraphClient()
  : null;

const rateLimits = new Map();

function defaultDb() {
  return {
    meta: { createdAt: new Date().toISOString() },
    users: [],
    challenges: [],
    passwordResetGrants: [],
    sessions: [],
    trustedDevices: [],
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

function cleanupDb(db) {
  const now = Date.now();
  db.users ||= [];
  db.challenges ||= [];
  db.passwordResetGrants ||= [];
  db.sessions ||= [];
  db.trustedDevices ||= [];
  db.challenges = db.challenges.filter((item) => new Date(item.expiresAt).getTime() > now && !item.usedAt);
  db.passwordResetGrants = db.passwordResetGrants.filter((item) => new Date(item.expiresAt).getTime() > now && !item.usedAt);
  db.sessions = db.sessions.filter((item) => new Date(item.expiresAt).getTime() > now);
  db.trustedDevices = db.trustedDevices.filter((item) => new Date(item.expiresAt).getTime() > now);
  return db;
}

function loadDb() {
  ensureDbFile();
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  return cleanupDb(raw ? JSON.parse(raw) : defaultDb());
}

function saveDb(db) {
  const temp = `${DB_PATH}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(db, null, 2));
  fs.chmodSync(temp, 0o600);
  fs.renameSync(temp, DB_PATH);
}

function sendJson(res, code, payload, extraHeaders = {}) {
  res.writeHead(code, { 'Content-Type': 'application/json', ...extraHeaders });
  res.end(JSON.stringify(payload));
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
      } catch {
        reject(new Error('JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

function parseCookies(req) {
  const raw = String(req.headers.cookie || '');
  return Object.fromEntries(raw.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
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

function clearCookie(name) {
  return cookieString(name, '', { maxAge: 0 });
}

function setCookies(res, cookies) {
  res.setHeader('Set-Cookie', cookies);
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

function normalizeRole(value = '') {
  return String(value || '').trim().toLowerCase() === 'admin' ? 'admin' : 'user';
}

function isAdmin(user = null) {
  return normalizeRole(user?.role || 'user') === 'admin';
}

function userAccessEnabled(user) {
  return user?.accessEnabled !== false;
}

function isAllowedManagedEmail(email) {
  return /^[^\s@]+@(evinka\.tech|evinkatech\.onmicrosoft\.com)$/i.test(String(email || ''));
}

function isStrongPassword(password) {
  return typeof password === 'string'
    && password.length >= 12
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password);
}

function maskEmail(email) {
  const [local, domain] = normalizeEmail(email).split('@');
  if (!local || !domain) return 'correo oculto';
  if (local.length <= 2) return `${local[0] || '*'}*@${domain}`;
  return `${local.slice(0, 2)}•••${local.slice(-1)}@${domain}`;
}

function maskRecipients(emails = []) {
  const normalized = [...new Set((emails || []).map((item) => normalizeEmail(item)).filter(Boolean))];
  if (!normalized.length) return 'sin destinatario';
  return normalized.map((item) => maskEmail(item)).join(' y ');
}

function userOtpEmails(user, fallbackEmail = '') {
  const emails = Array.isArray(user?.otpEmails) ? user.otpEmails : [];
  const normalized = emails.map((item) => normalizeEmail(item)).filter(Boolean);
  if (normalized.length) return [...new Set(normalized)];
  const fallback = normalizeEmail(fallbackEmail || user?.email || '');
  return fallback ? [fallback] : [];
}

function findUserByEmail(db, email) {
  return db.users.find((user) => user.email === normalizeEmail(email)) || null;
}

function findChallenge(db, challengeId, type = null) {
  return db.challenges.find((item) => item.id === challengeId && (!type || item.type === type)) || null;
}

function findRecentActiveChallenge(db, userId, type, withinMs = OTP_RESEND_COOLDOWN_MS) {
  const now = Date.now();
  return db.challenges.find((item) => (
    item.userId === userId
    && item.type === type
    && !item.usedAt
    && new Date(item.expiresAt).getTime() > now
    && now - new Date(item.createdAt).getTime() < withinMs
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

function rememberTrustedDevice(db, req, user, userAgent = 'unknown-device') {
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_TTL_MS).toISOString();
  const cookies = parseCookies(req);
  const rawToken = String(cookies[DEVICE_COOKIE] || '').trim() || randomToken();
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

function sessionPayload(user, trustedDevice) {
  return {
    authenticated: true,
    user: {
      email: user.email,
      role: normalizeRole(user.role || 'user'),
      verifiedAt: user.verifiedAt,
    },
    trustedDevice: Boolean(trustedDevice),
  };
}

function buildManagedUserPayload(user) {
  return {
    id: user.id,
    email: user.email,
    role: normalizeRole(user.role || 'user'),
    accessEnabled: userAccessEnabled(user),
    verifiedAt: user.verifiedAt || null,
    createdAt: user.createdAt || null,
    updatedAt: user.updatedAt || null,
    otpEmails: Array.isArray(user.otpEmails) ? user.otpEmails : [],
  };
}

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket.remoteAddress || '0.0.0.0';
}

function isCrossSiteRequest(req) {
  const site = String(req.headers['sec-fetch-site'] || '').toLowerCase();
  return site === 'cross-site';
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

function securityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Cache-Control': 'no-store',
  };
}

async function sendOtpEmail({ emails, code, purpose }) {
  if (!mailer) throw new Error('El servicio de correo corporativo no está configurado todavía.');
  const recipients = [...new Set((Array.isArray(emails) ? emails : [emails]).map((item) => normalizeEmail(item)).filter(Boolean))];
  if (!recipients.length) throw new Error('No hay destinatarios válidos para enviar el código.');
  const subject = purpose === 'register'
    ? 'MapCo · Confirma tu cuenta'
    : purpose === 'reset'
      ? 'MapCo · Recupera tu contraseña'
      : 'MapCo · Código para nuevo dispositivo';
  const text = [
    'Hola,',
    '',
    `Tu código de verificación para MapCo es: ${code}`,
    '',
    'Este código vence en 10 minutos.',
    '',
    'Si no reconoces este intento, ignora este correo.',
    '',
    `— ${EMAIL_FROM_NAME}`,
  ].join('\n');
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;background:#0d0d0d;padding:32px;color:#f4efe7;">
      <div style="max-width:560px;margin:0 auto;background:#141414;border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:28px;">
        <div style="font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#e8cfaa;">MapCo · EVINKA</div>
        <h1 style="margin:14px 0 8px;font-size:28px;line-height:1.1;">${purpose === 'register' ? 'Confirma tu cuenta' : purpose === 'reset' ? 'Recupera tu contraseña' : 'Verifica tu dispositivo'}</h1>
        <p style="color:#cdbfa8;line-height:1.7;">${purpose === 'register' ? 'Usa este código para confirmar tu cuenta corporativa en MapCo.' : purpose === 'reset' ? 'Usa este código para habilitar el cambio de contraseña.' : 'Usa este código para continuar en MapCo.'}</p>
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
    return { reused: true, challenge: recent, maskedEmail: maskRecipients(recipients) };
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
  return { reused: false, challenge, maskedEmail: maskRecipients(recipients) };
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
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };
  db.passwordResetGrants.push(grant);
  return { rawToken, grant };
}

function findPasswordResetGrant(db, rawToken) {
  const hashed = sha256(String(rawToken || '').trim());
  return db.passwordResetGrants.find((item) => item.tokenHash === hashed && !item.usedAt) || null;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const baseHeaders = securityHeaders();

    if (req.method === 'GET' && url.pathname === '/health') {
      return sendJson(res, 200, { ok: true, service: 'mapco-auth' }, baseHeaders);
    }

    if (!url.pathname.startsWith('/api/auth')) {
      return sendJson(res, 404, { error: 'not_found' }, baseHeaders);
    }

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && isCrossSiteRequest(req)) {
      return sendJson(res, 403, { error: 'forbidden', message: 'Solicitud bloqueada por política de origen.' }, baseHeaders);
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204, baseHeaders);
      return res.end();
    }

    const ip = clientIp(req);

    if (req.method === 'GET' && url.pathname === '/api/auth/check') {
      const db = loadDb();
      saveDb(db);
      const ctx = getUserFromSession(db, req);
      if (!ctx) return sendJson(res, 401, { error: 'unauthorized' }, baseHeaders);
      res.writeHead(204, baseHeaders);
      return res.end();
    }

    if (req.method === 'GET' && url.pathname === '/api/auth/session') {
      const db = loadDb();
      saveDb(db);
      const ctx = getUserFromSession(db, req);
      return sendJson(res, 200, ctx ? sessionPayload(ctx.user, ctx.trustedDevice) : { authenticated: false }, baseHeaders);
    }

    if (req.method === 'GET' && url.pathname === '/api/auth/admin/users') {
      const db = loadDb();
      const ctx = getUserFromSession(db, req);
      if (!ctx?.user) return sendJson(res, 401, { error: 'not_authenticated', message: 'Debes iniciar sesión.' }, baseHeaders);
      if (!isAdmin(ctx.user)) return sendJson(res, 403, { error: 'forbidden', message: 'Solo administradores de MapCo pueden ver usuarios.' }, baseHeaders);
      const users = db.users.map(buildManagedUserPayload).sort((a, b) => String(a.email || '').localeCompare(String(b.email || '')));
      return sendJson(res, 200, { users }, baseHeaders);
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
      const db = loadDb();
      const session = findSession(db, req);
      if (session) {
        db.sessions = db.sessions.filter((item) => item.id !== session.record.id);
        saveDb(db);
      }
      setCookies(res, [clearCookie(SESSION_COOKIE), clearCookie(DEVICE_COOKIE)]);
      return sendJson(res, 200, { ok: true }, baseHeaders);
    }

    const body = await readJsonBody(req);
    const userAgent = req.headers['user-agent'] || 'unknown-device';

    if (req.method === 'PATCH' && url.pathname === '/api/auth/admin/users') {
      const db = loadDb();
      const ctx = getUserFromSession(db, req);
      if (!ctx?.user) return sendJson(res, 401, { error: 'not_authenticated', message: 'Debes iniciar sesión.' }, baseHeaders);
      if (!isAdmin(ctx.user)) return sendJson(res, 403, { error: 'forbidden', message: 'Solo administradores de MapCo pueden actualizar usuarios.' }, baseHeaders);

      const email = normalizeEmail(body.email);
      if (!email) return sendJson(res, 400, { error: 'missing_email', message: 'Falta el correo del usuario.' }, baseHeaders);
      const user = findUserByEmail(db, email);
      if (!user) return sendJson(res, 404, { error: 'user_not_found', message: 'No encontré ese usuario en MapCo.' }, baseHeaders);

      const nextRole = body.role == null ? normalizeRole(user.role || 'user') : normalizeRole(body.role);
      const nextAccessEnabled = body.accessEnabled == null ? userAccessEnabled(user) : Boolean(body.accessEnabled);
      user.role = nextRole;
      user.accessEnabled = nextAccessEnabled;
      user.updatedAt = new Date().toISOString();

      if (!nextAccessEnabled) {
        db.sessions = db.sessions.filter((item) => item.userId !== user.id);
      }

      saveDb(db);
      return sendJson(res, 200, { ok: true, user: buildManagedUserPayload(user) }, baseHeaders);
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/register/start') {
      const email = normalizeEmail(body.email);
      const password = String(body.password || '');
      const registerLimit = rateLimit(`register:${ip}:${email}`, { limit: 6, windowMs: 10 * 60 * 1000 });
      if (!registerLimit.ok) return tooManyRequests(res, baseHeaders, registerLimit.retryAfterSec, 'Hiciste demasiados intentos de registro. Espera un momento y vuelve a probar.');
      if (!isAllowedManagedEmail(email)) {
        return sendJson(res, 400, { error: 'invalid_domain', message: `Solo se permiten correos @${ALLOWED_DOMAINS[0]} o @${ALLOWED_DOMAINS[1]}` }, baseHeaders);
      }
      if (!isStrongPassword(password)) {
        return sendJson(res, 400, { error: 'weak_password', message: PASSWORD_POLICY_HINT }, baseHeaders);
      }
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
          otpEmails: [email],
          passwordHash: derivePassword(password),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          verifiedAt: null,
        };
        db.users.push(user);
      } else {
        user.passwordHash = derivePassword(password);
        user.otpEmails = [email];
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
        setCookies(res, [cookieString(DEVICE_COOKIE, trustedDevice.rawToken, { maxAge: TRUSTED_DEVICE_TTL_MS / 1000 })]);
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
      if (!isAllowedManagedEmail(email)) {
        return sendJson(res, 400, { error: 'invalid_domain', message: `Solo se permiten correos @${ALLOWED_DOMAINS[0]} o @${ALLOWED_DOMAINS[1]}` }, baseHeaders);
      }
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
      return sendJson(res, 200, { ok: true, resetToken: rawToken, email: user.email }, baseHeaders);
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
      return sendJson(res, 200, { ok: true, message: 'Contraseña actualizada. Inicia sesión con la nueva contraseña.' }, baseHeaders);
    }

    return sendJson(res, 404, { error: 'not_found' }, baseHeaders);
  } catch (error) {
    console.error('[mapco-auth]', error);
    return sendJson(res, 500, { error: 'internal_error', message: error.message }, securityHeaders());
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`MapCo auth escuchando en http://127.0.0.1:${PORT}`);
});
