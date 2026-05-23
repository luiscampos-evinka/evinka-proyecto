import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'url';
import { loadEnv } from '../../src/config.mjs';
import { appendAccessAuditLog } from '../../src/accessAudit.mjs';
import { MicrosoftGraphClient } from '../../src/microsoftGraph.mjs';
import { SupabaseRest } from '../../src/supabase.mjs';
import { SupabaseStorage } from '../../src/supabaseStorage.mjs';
import { WhatsAppMetaClient } from '../../src/whatsappMeta.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadEnv();
const rootDir = path.join(__dirname);
const publicDir = path.join(rootDir, 'public');
const assetsDir = path.join(publicDir, 'assets');
const dataDir = path.join(rootDir, 'data');
const storageDir = path.join(rootDir, 'storage');
const quotesDir = path.join(storageDir, 'quotes');
const quoteAssetsDir = path.join(storageDir, 'quote-assets');
const files = {
  users: path.join(dataDir, 'users.json'),
  config: path.join(dataDir, 'config.json'),
  roleMatrix: path.join(dataDir, 'role-matrix.json'),
  clients: path.join(dataDir, 'clients.json'),
  quotes: path.join(dataDir, 'quotes.json'),
  installationOrders: path.join(dataDir, 'installation-orders.json'),
  conformities: path.join(dataDir, 'conformities.json'),
  warranties: path.join(dataDir, 'warranties.json'),
  techVisits: path.join(dataDir, 'tech-visits.json'),
  sessions: path.join(dataDir, 'sessions.json'),
  auditLog: path.join(dataDir, 'audit-log.json'),
};

const COOKIE_NAME = 'cotizador_session';
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;
const DISPLAY_TIME_ZONE = 'America/Lima';
const PORT = Number(process.env.PORT || 3008);
const COUNTRY_DEFINITIONS = [
  { code: 'PE', label: 'Perú', currency: 'PEN' },
  { code: 'CO', label: 'Colombia', currency: 'COP' },
];
const MOBILE_APP_API_KEY = process.env.CONFORMITY_APP_API_KEY || 'EvinkaConformidad#2026';
const BOT_VISITS_API_KEY = process.env.EVINKA_BOT_VISITS_API_KEY || 'EvinkaBotVisits#2026';
const ALLOWED_CORPORATE_DOMAINS = ['evinka.tech', 'nevperu.com'];
const EXCEL_SOURCE_PATH = path.join('/root/.openclaw/workspace', 'Cotizador_EVINKA_validacion_v10.xlsx');
const EMAIL_FROM_NAME = process.env.MICROSOFT_SENDER_NAME || 'EVINKA';
const mailer = process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET && process.env.MICROSOFT_SENDER_EMAIL
  ? new MicrosoftGraphClient({ senderName: EMAIL_FROM_NAME })
  : null;
const meta = process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID
  ? new WhatsAppMetaClient({
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
      appSecret: process.env.META_APP_SECRET,
    })
  : null;
const liveBookingsSb = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? new SupabaseRest({
      url: process.env.SUPABASE_URL,
      key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    })
  : null;
const liveStorageSb = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? new SupabaseStorage({
      url: process.env.SUPABASE_URL,
      key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    })
  : null;
const TECH_VISITS_DEFAULT_EMAIL = String(process.env.TECH_VISITS_DEFAULT_EMAIL || 'luis.campos@evinka.tech').trim().toLowerCase();
const TECH_VISITS_DEFAULT_NAME = String(process.env.TECH_VISITS_DEFAULT_NAME || 'Luis Campos').trim();
const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';
const CLICKUP_API_TOKEN = String(process.env.CLICKUP_API_TOKEN || process.env.CLICKUP_TOKEN || '').trim();
const CLICKUP_B2C_LIST_ID = String(process.env.CLICKUP_B2C_LIST_ID || '').trim();
const CLICKUP_B2C_STATUS = String(process.env.CLICKUP_B2C_STATUS || 'Open').trim().toLowerCase() === 'open'
  ? 'pendiente visita técnica'
  : String(process.env.CLICKUP_B2C_STATUS || 'pendiente visita técnica').trim();
const CLICKUP_B2C_QUOTE_PENDING_STATUS = String(process.env.CLICKUP_B2C_QUOTE_PENDING_STATUS || 'pendiente enviar cotizació').trim();
const CLICKUP_B2C_DEFAULT_ASSIGNEE_ID = Number(process.env.CLICKUP_B2C_DEFAULT_ASSIGNEE_ID || 0);
const CLICKUP_DEFAULT_DURATION_MINUTES = Number(process.env.CLICKUP_DEFAULT_DURATION_MINUTES || 45);
const META_WEBHOOK_INTERNAL_URL = String(process.env.META_WEBHOOK_INTERNAL_URL || 'http://127.0.0.1:8787').trim().replace(/\/$/, '');
const AUDIT_LOG_LIMIT = Number(process.env.EVINKA_AUDIT_LOG_LIMIT || 5000);
const RAUL_DEFAULT_EMAIL = 'raul.flores@evinka.tech';
const RAUL_DEFAULT_PHONE = '+51923587116';

ensureDir(dataDir);
ensureDir(storageDir);
ensureDir(quotesDir);
ensureDir(quoteAssetsDir);
ensureSeedData();

const EXCEL_SOURCE = await loadExcelSource();

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use('/assets', express.static(assetsDir, {
  setHeaders(res) {
    res.setHeader('Cache-Control', 'public, max-age=86400');
  },
}));
app.use(express.static(publicDir, {
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-store');
  },
}));
app.use('/pdf', express.static(quotesDir, {
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-store');
  },
}));

app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(assetsDir, 'favicon.png'));
});

function serveAppShell(req, res) {
  res.type('html').send(fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8'));
}

app.get('/', serveAppShell);
app.get('/chat', serveAppShell);
app.get('/health', (req, res) => res.json({ ok: true }));

app.post('/api/login', (req, res) => {
  const body = req.body || {};
  const users = readUsers();
  const rawIdentifier = String(
    body.identifier || body.employeeCode || body.code || body.email || '',
  ).trim();
  const secret = String(body.secret || body.pin || body.password || '').trim();

  let user = null;
  const normalizedCode = normalizeEmployeeCode(rawIdentifier);
  const looksLikeEmail = rawIdentifier.includes('@');

  if (normalizedCode && !looksLikeEmail) {
    const candidate = users.find(
      (item) => normalizeEmployeeCode(item.employeeCode) === normalizedCode,
    );
    if (candidate) {
      if (!candidate.pinHash) {
        appendAccessAuditLog({
          module: 'cotizador',
          action: 'login',
          status: 'denied',
          userId: candidate.id,
          employeeCode: candidate.employeeCode,
          email: candidate.email,
          name: candidate.name,
          role: candidate.role,
          allowedCountries: candidate.allowedCountries,
          ip: req.ip,
          userAgent: req.get('user-agent') || '',
          reason: 'pending_pin',
        });
        return res.status(403).json({
          error: 'Tu cuenta todavía no tiene PIN configurado. Pide al admin que lo active.',
          status: 'pending_pin',
        });
      }
      if (!verifyPassword(secret, candidate.pinHash)) {
        appendAccessAuditLog({
          module: 'cotizador',
          action: 'login',
          status: 'failed',
          userId: candidate.id,
          employeeCode: candidate.employeeCode,
          email: candidate.email,
          name: candidate.name,
          role: candidate.role,
          allowedCountries: candidate.allowedCountries,
          ip: req.ip,
          userAgent: req.get('user-agent') || '',
          reason: 'invalid_pin',
        });
        return res.status(401).json({ error: 'Código o PIN inválido.' });
      }
      user = candidate;
    }
  }

  if (!user && rawIdentifier) {
    const email = normalizeEmail(rawIdentifier);
    const candidate = users.find((item) => item.email.toLowerCase() === email);
    if (candidate?.passwordHash && verifyPassword(secret, candidate.passwordHash)) {
      user = candidate;
    }
  }

  if (!user) {
    appendAccessAuditLog({
      module: 'cotizador',
      action: 'login',
      status: 'failed',
      employeeCode: normalizedCode,
      email: looksLikeEmail ? normalizeEmail(rawIdentifier) : '',
      ip: req.ip,
      userAgent: req.get('user-agent') || '',
      reason: 'invalid_credentials',
    });
    return res.status(401).json({ error: 'Credenciales inválidas.' });
  }
  if (user.status !== 'active') {
    appendAccessAuditLog({
      module: 'cotizador',
      action: 'login',
      status: 'denied',
      userId: user.id,
      employeeCode: user.employeeCode,
      email: user.email,
      name: user.name,
      role: user.role,
      allowedCountries: user.allowedCountries,
      ip: req.ip,
      userAgent: req.get('user-agent') || '',
      reason: user.status,
    });
    return res.status(403).json({
      error: user.status === 'pending'
        ? 'Tu cuenta está pendiente de aprobación del administrador.'
        : 'Tu cuenta no tiene acceso habilitado.',
      status: user.status,
    });
  }
  const sessions = readJSON(files.sessions, {});
  const token = crypto.randomBytes(24).toString('hex');
  sessions[token] = {
    userId: user.id,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString(),
  };
  writeJSON(files.sessions, sessions);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: SESSION_MAX_AGE_MS,
  });
  appendAccessAuditLog({
    module: 'cotizador',
    action: 'login',
    status: 'success',
    userId: user.id,
    employeeCode: user.employeeCode,
    email: user.email,
    name: user.name,
    role: user.role,
    allowedCountries: user.allowedCountries,
    ip: req.ip,
    userAgent: req.get('user-agent') || '',
  });
  res.json({ user: safeUser(user), config: publicConfig() });
});

app.post('/api/register-request', (req, res) => {
  const body = req.body || {};
  const name = String(body.name || '').trim();
  const email = normalizeEmail(body.email || '');
  const password = String(body.password || '');
  if (!name) return res.status(400).json({ error: 'Falta el nombre.' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Correo inválido.' });
  if (!isAllowedCorporateEmail(email)) {
    return res.status(400).json({ error: `Solo se permiten correos ${allowedCorporateDomainsLabel()}.` });
  }
  if (!isStrongPassword(password)) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 10 caracteres e incluir mayúscula, minúscula y número.' });
  }
  const users = readUsers();
  const existing = users.find((user) => user.email === email);
  if (existing) {
    if (existing.status === 'pending') {
      return res.status(409).json({ error: 'Ya existe una solicitud pendiente para este correo.' });
    }
    return res.status(409).json({ error: 'Ese correo ya tiene una cuenta registrada.' });
  }
  users.push(normalizeUserRecord({
    id: `usr-${Date.now()}`,
    name,
    email,
    role: 'tech',
    status: 'pending',
    passwordHash: hashPassword(password),
    requestedAt: new Date().toISOString(),
    accessGrantedAt: '',
    approvedBy: null,
  }));
  writeUsers(users);
  res.json({ ok: true, message: 'Solicitud creada. Un administrador debe aprobar tu acceso.' });
});

app.post('/api/logout', (req, res) => {
  const token = parseCookie(req.headers.cookie || '')[COOKIE_NAME];
  let logoutUser = null;
  if (token) {
    const sessions = readJSON(files.sessions, {});
    const session = resolveActiveSession(sessions, token);
    if (session) {
      logoutUser = readUsers().find((user) => user.id === session.userId) || null;
    }
    delete sessions[token];
    writeJSON(files.sessions, sessions);
  }
  if (logoutUser) {
    appendAccessAuditLog({
      module: 'cotizador',
      action: 'logout',
      status: 'success',
      userId: logoutUser.id,
      employeeCode: logoutUser.employeeCode,
      email: logoutUser.email,
      name: logoutUser.name,
      role: logoutUser.role,
      allowedCountries: logoutUser.allowedCountries,
      ip: req.ip,
      userAgent: req.get('user-agent') || '',
    });
  }
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get('/api/me', authOptional, (req, res) => {
  const activeCountry = resolveRequestCountryContext(req, req.user);
  if (!req.user) return res.json({ user: null, config: publicConfig(activeCountry) });
  res.json({ user: safeUser(req.user), config: publicConfig(activeCountry) });
});

app.get('/api/catalog', authRequired, (req, res) => {
  res.json(buildAppConfig(resolveRequestCountryContext(req, req.user)));
});

app.get('/api/clients', authRequired, (req, res) => {
  const countryScope = resolveRequestCountryContext(req, req.user);
  const query = String(req.query.q || '').trim().toLowerCase();
  const clients = readClients()
    .filter((client) => userCanAccessCountry(req.user, client.countryCode))
    .filter((client) => matchesCountryScope(client.countryCode, countryScope))
    .filter((client) => {
      if (!query) return true;
      const haystack = [
        client.fullName,
        client.email,
        client.phone,
        client.documentNumber,
        client.city,
        client.address,
        client.vehicleModel,
        client.vin,
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => String(b.lastQuoteAt || b.updatedAt || '').localeCompare(String(a.lastQuoteAt || a.updatedAt || '')));
  res.json(clients.slice(0, 80));
});

app.get('/api/admin/users', authRequired, adminOnly, (req, res) => {
  const users = readUsers()
    .slice()
    .sort((a, b) => {
      const statusOrder = { pending: 0, active: 1, blocked: 2 };
      const byStatus = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
      if (byStatus !== 0) return byStatus;
      return String(b.requestedAt || b.accessGrantedAt || '').localeCompare(String(a.requestedAt || a.accessGrantedAt || ''));
    })
    .map(safeUser);
  res.json(users);
});

app.post('/api/admin/users', authRequired, adminOnly, (req, res) => {
  const body = req.body || {};
  const name = String(body.name || '').trim();
  const email = normalizeEmail(body.email || '');
  const role = normalizeManagedUserRole(body.role || 'tech');
  const status = normalizeUserStatus(body.status || 'active');
  const requestedCode = normalizeEmployeeCode(body.employeeCode || '');
  const notificationPhone = normalizeNotificationPhone(body.notificationPhone || body.phone || '');
  const allowedCountries = normalizeStringList(Array.isArray(body.allowedCountries) ? body.allowedCountries : String(body.allowedCountries || '').split(/[\s,;|]+/)).map((item) => item.toUpperCase());
  const allowedQueues = normalizeStringList(Array.isArray(body.allowedQueues) ? body.allowedQueues : String(body.allowedQueues || '').split(/[\s,;|]+/)).map((item) => item.toLowerCase());
  const pin = String(body.pin || '').trim();

  if (!name) return res.status(400).json({ error: 'Falta el nombre.' });
  if (email && !isValidEmail(email)) {
    return res.status(400).json({ error: 'Correo inválido.' });
  }
  if (String(body.notificationPhone || body.phone || '').trim() && !notificationPhone) {
    return res.status(400).json({ error: 'Teléfono inválido. Usa un número de Perú o Colombia, por ejemplo +51999999999 o +573001234567.' });
  }
  if (!isStrongPin(pin)) {
    return res.status(400).json({ error: 'El PIN debe tener entre 4 y 8 dígitos.' });
  }

  const users = readUsers();
  if (email && users.some((user) => normalizeEmail(user.email) === email)) {
    return res.status(409).json({ error: 'Ese correo ya está registrado.' });
  }

  const employeeCode = requestedCode || nextEmployeeCode(users, role);
  if (!isValidEmployeeCode(employeeCode)) {
    return res.status(400).json({ error: 'Código inválido. Usa 3 a 20 caracteres A-Z, 0-9 o guion.' });
  }
  if (users.some((user) => normalizeEmployeeCode(user.employeeCode) === employeeCode)) {
    return res.status(409).json({ error: 'Ese código ya está en uso.' });
  }

  const now = new Date().toISOString();
  const user = normalizeUserRecord({
    id: `usr-${Date.now()}`,
    name,
    email,
    role,
    status,
    employeeCode,
    notificationPhone,
    allowedCountries,
    allowedQueues,
    pinHash: hashPassword(pin),
    pinUpdatedAt: now,
    passwordHash: '',
    requestedAt: now,
    accessGrantedAt: status === 'active' ? now : '',
    approvedBy: safeUser(req.user),
  });
  users.push(user);
  writeUsers(users);
  res.status(201).json({ ok: true, user: safeUser(user) });
});

app.patch('/api/admin/users/:id/credentials', authRequired, adminOnly, (req, res) => {
  const users = readUsers();
  const index = users.findIndex((user) => user.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Usuario no encontrado' });

  const body = req.body || {};
  const nextCode = body.employeeCode === undefined
    ? normalizeEmployeeCode(users[index].employeeCode)
    : normalizeEmployeeCode(body.employeeCode);
  const nextNotificationPhone = body.notificationPhone === undefined
    ? normalizeNotificationPhone(users[index].notificationPhone)
    : normalizeNotificationPhone(body.notificationPhone);
  const nextPin = body.pin === undefined ? '' : String(body.pin || '').trim();

  if (!isValidEmployeeCode(nextCode)) {
    return res.status(400).json({ error: 'Código inválido. Usa 3 a 20 caracteres A-Z, 0-9 o guion.' });
  }
  if (users.some((user, userIndex) => userIndex !== index && normalizeEmployeeCode(user.employeeCode) === nextCode)) {
    return res.status(409).json({ error: 'Ese código ya está en uso.' });
  }
  if (body.notificationPhone !== undefined && String(body.notificationPhone || '').trim() && !nextNotificationPhone) {
    return res.status(400).json({ error: 'Teléfono inválido. Usa un número de Perú o Colombia, por ejemplo +51999999999 o +573001234567.' });
  }
  if (body.pin !== undefined && !isStrongPin(nextPin)) {
    return res.status(400).json({ error: 'El PIN debe tener entre 4 y 8 dígitos.' });
  }

  users[index] = normalizeUserRecord({
    ...users[index],
    employeeCode: nextCode,
    notificationPhone: nextNotificationPhone,
    pinHash: body.pin === undefined ? users[index].pinHash : hashPassword(nextPin),
    pinUpdatedAt: body.pin === undefined ? users[index].pinUpdatedAt : new Date().toISOString(),
    approvedBy: safeUser(req.user),
  });
  writeUsers(users);
  if (body.pin !== undefined) {
    invalidateUserSessions(users[index].id);
  }
  res.json({ ok: true, user: safeUser(users[index]) });
});

app.patch('/api/admin/users/:id', authRequired, adminOnly, (req, res) => {
  const users = readUsers();
  const index = users.findIndex((user) => user.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Usuario no encontrado' });

  const current = users[index];
  const body = req.body || {};
  const name = body.name === undefined ? String(current.name || '').trim() : String(body.name || '').trim();
  const email = body.email === undefined ? normalizeEmail(current.email || '') : normalizeEmail(body.email || '');
  const role = body.role === undefined ? normalizeManagedUserRole(current.role || 'tech') : normalizeManagedUserRole(body.role || 'tech');
  const status = body.status === undefined ? normalizeUserStatus(current.status || 'active') : normalizeUserStatus(body.status || 'active');
  const employeeCode = body.employeeCode === undefined ? normalizeEmployeeCode(current.employeeCode || '') : normalizeEmployeeCode(body.employeeCode || '');
  const notificationPhone = body.notificationPhone === undefined
    ? normalizeNotificationPhone(current.notificationPhone || current.phone || '')
    : normalizeNotificationPhone(body.notificationPhone || body.phone || '');
  const allowedCountries = body.allowedCountries === undefined
    ? normalizeStringList(current.allowedCountries).map((item) => item.toUpperCase())
    : normalizeStringList(Array.isArray(body.allowedCountries) ? body.allowedCountries : String(body.allowedCountries || '').split(/[\s,;|]+/)).map((item) => item.toUpperCase());
  const allowedQueues = body.allowedQueues === undefined
    ? normalizeStringList(current.allowedQueues).map((item) => item.toLowerCase())
    : normalizeStringList(Array.isArray(body.allowedQueues) ? body.allowedQueues : String(body.allowedQueues || '').split(/[\s,;|]+/)).map((item) => item.toLowerCase());
  const pin = body.pin === undefined ? null : String(body.pin || '').trim();

  if (!name) return res.status(400).json({ error: 'Falta el nombre.' });
  if (email && !isValidEmail(email)) {
    return res.status(400).json({ error: 'Correo inválido.' });
  }
  if (email && users.some((user, userIndex) => userIndex !== index && normalizeEmail(user.email) === email)) {
    return res.status(409).json({ error: 'Ese correo ya está registrado.' });
  }
  if (!isValidEmployeeCode(employeeCode)) {
    return res.status(400).json({ error: 'Código inválido. Usa 3 a 20 caracteres A-Z, 0-9 o guion.' });
  }
  if (users.some((user, userIndex) => userIndex !== index && normalizeEmployeeCode(user.employeeCode) === employeeCode)) {
    return res.status(409).json({ error: 'Ese código ya está en uso.' });
  }
  if ((body.notificationPhone !== undefined || body.phone !== undefined) && String(body.notificationPhone || body.phone || '').trim() && !notificationPhone) {
    return res.status(400).json({ error: 'Teléfono inválido. Usa un número de Perú o Colombia, por ejemplo +51999999999 o +573001234567.' });
  }
  if (pin !== null && pin && !isStrongPin(pin)) {
    return res.status(400).json({ error: 'El PIN debe tener entre 4 y 8 dígitos.' });
  }

  users[index] = normalizeUserRecord({
    ...current,
    name,
    email,
    role,
    status,
    employeeCode,
    notificationPhone,
    allowedCountries,
    allowedQueues,
    pinHash: pin ? hashPassword(pin) : current.pinHash,
    pinUpdatedAt: pin ? new Date().toISOString() : current.pinUpdatedAt,
    approvedBy: safeUser(req.user),
    accessGrantedAt: status === 'active'
      ? (current.accessGrantedAt || new Date().toISOString())
      : '',
  });
  writeUsers(users);
  const shouldInvalidateSessions = Boolean(pin) || status === 'blocked';
  if (shouldInvalidateSessions) {
    invalidateUserSessions(users[index].id);
  }
  res.json({ ok: true, user: safeUser(users[index]) });
});

app.patch('/api/admin/users/:id/access', authRequired, adminOnly, (req, res) => {
  const users = readUsers();
  const index = users.findIndex((user) => user.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Usuario no encontrado' });
  const body = req.body || {};
  const action = String(body.action || '').trim().toLowerCase();
  const role = String(body.role || users[index].role || 'tech').trim().toLowerCase();
  if (!['approve', 'block'].includes(action)) {
    return res.status(400).json({ error: 'Acción inválida' });
  }
  users[index] = normalizeUserRecord({
    ...users[index],
    role: normalizeManagedUserRole(role),
    status: action === 'approve' ? 'active' : 'blocked',
    accessGrantedAt: action === 'approve' ? new Date().toISOString() : '',
    approvedBy: safeUser(req.user),
  });
  writeUsers(users);
  if (action === 'block') {
    invalidateUserSessions(users[index].id);
  }
  res.json({ ok: true, user: safeUser(users[index]) });
});

app.put('/api/catalog', authRequired, adminOnly, (req, res) => {
  const incoming = req.body || {};
  const current = readJSON(files.config, defaultConfig());
  const activeCountry = resolveRequestCountryContext(req, req.user);
  if (!activeCountry || activeCountry === 'ALL') {
    return res.status(400).json({ error: 'Selecciona Perú o Colombia antes de guardar configuración.' });
  }
  const next = mergeConfig(current, incoming, activeCountry);
  writeJSON(files.config, next);
  res.json(buildAppConfig(activeCountry));
});

app.get('/api/catalog/export.xlsx', authRequired, adminOnly, async (req, res) => {
  const activeCountry = resolveRequestCountryContext(req, req.user);
  if (!activeCountry || activeCountry === 'ALL') {
    return res.status(400).json({ error: 'Selecciona Perú o Colombia antes de exportar el catálogo.' });
  }
  const config = buildAppConfig(activeCountry);
  const buffer = await buildCatalogExportWorkbook(config, {
    countryCode: activeCountry,
    generatedBy: req.user?.name || req.user?.email || req.user?.employeeCode || 'EVINKA',
  });
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="EVINKA-catalogo-${activeCountry}-${stamp}.xlsx"`);
  res.send(buffer);
});

app.get('/api/quotes', authRequired, (req, res) => {
  const countryScope = resolveRequestCountryContext(req, req.user);
  const quotes = readJSON(files.quotes, [])
    .map(normalizeStoredQuote)
    .filter((quote) => userCanAccessCountry(req.user, quote.countryCode))
    .filter((quote) => matchesCountryScope(quote.countryCode, countryScope));
  res.json(quotes.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

app.post('/api/quotes', authRequired, async (req, res) => {
  if (!canUserCreateQuote(req.user)) {
    return res.status(403).json({ error: 'Tu usuario no puede generar cotizaciones.' });
  }
  const activeCountry = resolveRequestCountryContext(req, req.user);
  const quotes = readJSON(files.quotes, []);
  const visits = readJSON(files.techVisits, []);
  const payload = req.body || {};
  const requestedCountry = normalizeCountryCode(payload.countryCode || activeCountry || resolveUserPrimaryCountry(req.user) || '');
  if (!requestedCountry || requestedCountry === 'ALL') {
    return res.status(400).json({ error: 'Selecciona Perú o Colombia antes de generar una cotización.' });
  }
  const config = buildAppConfig(requestedCountry);
  const email = normalizeEmail(payload.email);
  if (email && !isValidEmail(email)) {
    return res.status(400).json({ error: 'Correo inválido' });
  }
  payload.email = email;
  payload.countryCode = resolveRecordCountryCode(
    payload.countryCode,
    requestedCountry,
    payload.city,
    payload.clientAddress,
    payload.address,
    resolveUserPrimaryCountry(req.user),
  );
  if (!userCanAccessCountry(req.user, payload.countryCode)) {
    return res.status(403).json({ error: 'No tienes permiso para crear cotizaciones para ese país.' });
  }
  const visitIndex = findTechVisitIndex(visits, {
    visitId: payload.visitId,
    reference: payload.reference,
  });
  const linkedVisit = visitIndex >= 0 ? normalizeTechVisit(visits[visitIndex]) : null;
  if (linkedVisit) {
    payload.phone = String(payload.phone || linkedVisit.clientPhone || '').trim();
    payload.clientAddress = String(payload.clientAddress || linkedVisit.clientAddress || '').trim();
    payload.address = String(payload.address || linkedVisit.clientAddress || '').trim();
    payload.clientDocument = String(payload.clientDocument || linkedVisit.clientDocument || '').trim();
    payload.email = normalizeEmail(payload.email || linkedVisit.clientEmail || '');
    payload.clientName = String(payload.clientName || linkedVisit.clientName || '').trim();
  }
  const quote = buildQuote(payload, config, req.user);
  const clientRecord = upsertOperationalClientFromQuote(quote, req.user);
  quote.clientId = clientRecord.id;
  quote.photos = saveQuotePhotos(quote.id, quote.photos);
  const pdfFilename = buildPdfFilename(quote);
  const pdfPath = path.join(quotesDir, pdfFilename);
  await createPdf(quote, config, pdfPath);
  quote.pdfPath = `/pdf/${pdfFilename}`;
  quote.pdfFile = pdfPath;
  quote.pdfFilename = pdfFilename;
  quote.pdfCreatedAt = new Date().toISOString();
  quote.emailDelivery = { ok: false, skipped: true, message: 'Cotización creada. Pendiente de validación para envío al cliente.' };
  quotes.push(quote);
  writeJSON(files.quotes, quotes);
  if (visitIndex >= 0) {
    const currentVisit = normalizeTechVisit(visits[visitIndex]);
    const syncedVisit = normalizeTechVisit({
      ...currentVisit,
      status: 'pendiente_cotizacion',
      quoteId: quote.id,
      clientPhone: String(currentVisit.clientPhone || quote.phone || '').trim(),
      clientEmail: normalizeEmail(currentVisit.clientEmail || quote.email || ''),
      clientAddress: String(currentVisit.clientAddress || quote.address || '').trim(),
      clientDocument: String(currentVisit.clientDocument || quote.clientDocument || '').trim(),
      installationOrderId: currentVisit.installationOrderId || '',
      notes: String(payload.technicianNotes ?? currentVisit.notes ?? '').trim(),
      updatedAt: new Date().toISOString(),
      updatedBy: safeUser(req.user),
    });
    const clickupSync = await syncTechVisitToClickUp(syncedVisit, { quote });
    visits[visitIndex] = normalizeTechVisit({
      ...syncedVisit,
      clickupTaskId: clickupSync.taskId || syncedVisit.clickupTaskId,
      clickupTaskUrl: clickupSync.taskUrl || syncedVisit.clickupTaskUrl,
      clickupSyncedAt: clickupSync.syncedAt || syncedVisit.clickupSyncedAt,
      clickupSyncError: clickupSync.ok ? '' : String(clickupSync.error || syncedVisit.clickupSyncError || '').trim(),
    });
    saveTechVisits(visits);
    quote.clickupTaskId = clickupSync.taskId || syncedVisit.clickupTaskId || '';
  }
  quotes[quotes.length - 1] = normalizeStoredQuote({ ...quotes[quotes.length - 1], clickupTaskId: quote.clickupTaskId || quotes[quotes.length - 1]?.clickupTaskId || '' });
  writeJSON(files.quotes, quotes);

  appendOperationalAuditLog({
    actor: req.user,
    action: 'quote_created',
    entityType: 'quote',
    entityId: quote.id,
    countryCode: quote.countryCode,
    summary: `${req.user?.name || 'Usuario'} generó la cotización ${quote.id}`,
    detail: {
      clientName: quote.clientName,
      visitId: quote.visitId || payload.visitId || linkedVisit?.id || '',
      clickupTaskId: quote.clickupTaskId || '',
      total: safeNumber(quote.total, 0),
      status: quote.status,
    },
  });

  res.json(quote);
});

app.patch('/api/quotes/:id/status', authRequired, async (req, res) => {
  const config = buildAppConfig();
  const quotes = readJSON(files.quotes, []);
  const visits = readJSON(files.techVisits, []);
  const installationOrders = readJSON(files.installationOrders, []);
  const index = quotes.findIndex((item) => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Cotización no encontrada' });

  const body = req.body || {};
  const currentQuote = normalizeStoredQuote(quotes[index]);
  if (!userCanAccessCountry(req.user, currentQuote.countryCode)) {
    return res.status(403).json({ error: 'No tienes permiso para actualizar esta cotización.' });
  }
  const nextStatus = normalizeQuoteStatus(body.status || currentQuote.status);
  if (nextStatus !== currentQuote.status && !canUserMoveQuoteStatus(req.user, nextStatus, currentQuote.status)) {
    return res.status(403).json({ error: 'Tu usuario no puede mover el flujo comercial de cotizaciones.' });
  }
  if (nextStatus === 'abono_100_confirmado' && !canUserConfirmFullPayment(req.user)) {
    return res.status(403).json({ error: 'Tu usuario no puede confirmar el abono 100%.' });
  }
  let order = currentQuote.installationOrderId
    ? installationOrders.find((item) => item.id === currentQuote.installationOrderId)
    : installationOrders.find((item) => item.quoteId === currentQuote.id);
  if (!order && ['aceptada_cliente', 'instalada', 'abono_100_confirmado'].includes(nextStatus)) {
    order = buildInstallationOrderFromQuote(currentQuote, req.user);
    installationOrders.push(order);
    writeJSON(files.installationOrders, installationOrders);
  }

  const nowIso = new Date().toISOString();
  const initialPayment = nextStatus === 'aceptada_cliente'
    ? {
        confirmedAt: String(body.paymentDate || currentQuote.initialPayment?.confirmedAt || nowIso).trim() || nowIso,
        amount: safeNumber(body.paymentAmount, currentQuote.initialPayment?.amount, safeNumber(currentQuote.total, 0) * 0.5),
        observation: String(body.paymentObservation || currentQuote.initialPayment?.observation || 'Abono 50% confirmado desde EVINKA.').trim(),
        confirmedBy: safeUser(req.user),
      }
    : currentQuote.initialPayment;
  const finalPayment = nextStatus === 'abono_100_confirmado'
    ? {
        confirmedAt: String(body.paymentDate || currentQuote.finalPayment?.confirmedAt || nowIso).trim() || nowIso,
        amount: safeNumber(body.paymentAmount, currentQuote.finalPayment?.amount, safeNumber(currentQuote.total, 0)),
        observation: String(body.paymentObservation || currentQuote.finalPayment?.observation || 'Abono 100% confirmado desde EVINKA.').trim(),
        confirmedBy: safeUser(req.user),
      }
    : currentQuote.finalPayment;

  const nextQuote = normalizeStoredQuote({
    ...currentQuote,
    status: nextStatus,
    installationOrderId: order?.id || currentQuote.installationOrderId || '',
    readyForSendAt: nextStatus === 'lista_envio' ? nowIso : currentQuote.readyForSendAt || '',
    readyForSendBy: nextStatus === 'lista_envio' ? safeUser(req.user) : currentQuote.readyForSendBy || null,
    clientAcceptedAt: nextStatus === 'aceptada_cliente' ? initialPayment.confirmedAt || nowIso : currentQuote.clientAcceptedAt || '',
    clientAcceptedBy: nextStatus === 'aceptada_cliente' ? safeUser(req.user) : currentQuote.clientAcceptedBy || null,
    cancelledAt: nextStatus === 'cancelada' ? nowIso : currentQuote.cancelledAt || '',
    recotizarAt: nextStatus === 'recotizar' ? nowIso : currentQuote.recotizarAt || '',
    fullyPaidAt: nextStatus === 'abono_100_confirmado' ? finalPayment.confirmedAt || nowIso : currentQuote.fullyPaidAt || '',
    fullyPaidBy: nextStatus === 'abono_100_confirmado' ? safeUser(req.user) : currentQuote.fullyPaidBy || null,
    initialPayment,
    finalPayment,
  });
  if (nextStatus === 'lista_envio' && nextQuote.pdfFile && nextQuote.pdfFilename) {
    nextQuote.emailDelivery = await deliverQuoteEmail({
      quote: nextQuote,
      config,
      req,
      pdfPath: nextQuote.pdfFile,
      pdfFilename: nextQuote.pdfFilename,
    });
    nextQuote.whatsappDelivery = await deliverQuoteWhatsApp({ quote: nextQuote });
  }
  if (order && nextStatus === 'abono_100_confirmado') {
    const orderIndex = installationOrders.findIndex((item) => item.id === order.id);
    const nextOrder = normalizeInstallationOrder({
      ...order,
      status: 'cerrada',
      updatedAt: nowIso,
      closedAt: nowIso,
    });
    if (orderIndex >= 0) installationOrders[orderIndex] = nextOrder;
    else installationOrders.push(nextOrder);
    writeJSON(files.installationOrders, installationOrders);
    order = nextOrder;
  }
  quotes[index] = nextQuote;
  writeJSON(files.quotes, quotes);

  const visitIndex = findTechVisitIndex(visits, { visitId: body.visitId, quoteId: currentQuote.id, reference: body.reference });
  let persistedVisit = null;
  if (visitIndex >= 0) {
    const currentVisit = normalizeTechVisit(visits[visitIndex]);
    const nextVisitStatus = nextStatus === 'cotizada'
      ? 'pendiente_cotizacion'
      : nextStatus === 'lista_envio'
        ? 'lista_envio'
        : nextStatus === 'aceptada_cliente'
          ? 'aceptada_cliente'
          : nextStatus === 'abono_100_confirmado'
            ? 'cerrada'
          : nextStatus === 'recotizar'
            ? 'recotizar'
            : nextStatus === 'cancelada'
              ? 'cancelada'
              : currentVisit.status;
    const syncedVisit = normalizeTechVisit({
      ...currentVisit,
      status: nextVisitStatus,
      quoteId: currentQuote.id,
      clientPhone: String(currentVisit.clientPhone || nextQuote.phone || '').trim(),
      clientEmail: normalizeEmail(currentVisit.clientEmail || nextQuote.email || ''),
      clientAddress: String(currentVisit.clientAddress || nextQuote.address || '').trim(),
      installationOrderId: nextQuote.installationOrderId || currentVisit.installationOrderId,
      updatedAt: new Date().toISOString(),
      updatedBy: safeUser(req.user),
    });
    const clickupSync = await syncTechVisitToClickUp(syncedVisit, { quote: nextQuote });
    visits[visitIndex] = normalizeTechVisit({
      ...syncedVisit,
      clickupTaskId: clickupSync.taskId || syncedVisit.clickupTaskId,
      clickupTaskUrl: clickupSync.taskUrl || syncedVisit.clickupTaskUrl,
      clickupSyncedAt: clickupSync.syncedAt || syncedVisit.clickupSyncedAt,
      clickupSyncError: clickupSync.ok ? '' : String(clickupSync.error || syncedVisit.clickupSyncError || '').trim(),
    });
    persistedVisit = visits[visitIndex];
    saveTechVisits(visits);
  }

  const auditSummary = nextStatus === 'lista_envio'
    ? `Cotización ${nextQuote.id} enviada al cliente`
    : nextStatus === 'aceptada_cliente'
      ? `Abono 50% registrado para ${nextQuote.id}`
      : nextStatus === 'abono_100_confirmado'
        ? `Abono 100% registrado para ${nextQuote.id}`
        : `Cotización ${nextQuote.id} actualizada a ${nextStatus}`;
  appendOperationalAuditLog({
    actor: req.user,
    action: 'quote_status_updated',
    entityType: nextStatus.includes('abono') ? 'payment' : 'quote',
    entityId: nextQuote.id,
    countryCode: nextQuote.countryCode,
    summary: auditSummary,
    detail: {
      previousStatus: currentQuote.status,
      nextStatus,
      clickupTaskId: persistedVisit?.clickupTaskId || nextQuote.clickupTaskId || '',
      initialPayment: nextQuote.initialPayment,
      finalPayment: nextQuote.finalPayment,
    },
  });

  if (nextStatus === 'aceptada_cliente') {
    nextQuote.clickupTaskId = persistedVisit?.clickupTaskId || nextQuote.clickupTaskId || '';
    nextQuote.abono50Notifications = await notifyAbono50Milestone({ quote: nextQuote, actor: req.user });
    quotes[index] = nextQuote;
    writeJSON(files.quotes, quotes);
  }

  res.json({ ok: true, quote: nextQuote, installationOrder: order || null });
});

app.post('/api/quotes/:id/schedule-installation', authRequired, async (req, res) => {
  if (!canUserScheduleInstallation(req.user)) {
    return res.status(403).json({ error: 'Tu usuario no puede agendar instalaciones desde una cotización.' });
  }
  const quotes = readJSON(files.quotes, []);
  const visits = readJSON(files.techVisits, []);
  const installationOrders = readJSON(files.installationOrders, []);
  const users = readUsers();
  const index = quotes.findIndex((item) => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Cotización no encontrada' });

  const body = req.body || {};
  const scheduledAt = String(body.scheduledAt || '').trim();
  const requestedTimeWindow = String(body.timeWindow || '').trim();
  if (!scheduledAt) {
    return res.status(400).json({ error: 'Falta la fecha/hora para agendar la cita.' });
  }
  const timeWindow = requestedTimeWindow || formatTimeOnly(scheduledAt);

  const currentQuote = normalizeStoredQuote(quotes[index]);
  if (!userCanAccessCountry(req.user, currentQuote.countryCode)) {
    return res.status(403).json({ error: 'No tienes permiso para programar instalaciones para esta cotización.' });
  }
  let order = currentQuote.installationOrderId
    ? installationOrders.find((item) => item.id === currentQuote.installationOrderId)
    : installationOrders.find((item) => item.quoteId === currentQuote.id);
  if (!order) {
    order = buildInstallationOrderFromQuote(currentQuote, req.user);
    installationOrders.push(order);
    writeJSON(files.installationOrders, installationOrders);
  }

  const assignedEmail = normalizeEmail(body.assignedTechEmail || TECH_VISITS_DEFAULT_EMAIL || req.user?.email);
  const assignedTech = users.find((user) => normalizeEmail(user.email) === assignedEmail) || req.user;
  const requestedVisitIndex = findTechVisitIndex(visits, { visitId: body.visitId });
  const requestedVisit = requestedVisitIndex >= 0
    ? normalizeTechVisit(visits[requestedVisitIndex])
    : null;
  const visitIndex = requestedVisit?.type === 'instalacion'
    ? requestedVisitIndex
    : visits.findIndex((item) => {
        const normalized = normalizeTechVisit(item);
        if (normalized.type !== 'instalacion') return false;
        return normalized.installationOrderId === order.id
          || normalized.quoteId === currentQuote.id
          || normalized.reference === `INST-${order.id}`;
      });
  const currentVisit = visitIndex >= 0
    ? normalizeTechVisit(visits[visitIndex])
    : normalizeTechVisit({
        id: `VIS-INST-${Date.now().toString(36).toUpperCase()}`,
      source: 'app',
      type: 'instalacion',
      reference: `INST-${currentQuote.id}`,
      clientName: currentQuote.clientName,
      clientPhone: body.clientPhone || '',
      clientDocument: String(currentQuote.clientDocument || '').trim(),
      clientEmail: currentQuote.email,
      clientAddress: body.clientAddress || currentQuote.city || '',
      quoteId: currentQuote.id,
        installationOrderId: order.id,
        createdAt: new Date().toISOString(),
      });
  const liveReference = String(body.reference || currentVisit.reference || '').trim();
  const installationReference = currentVisit.type === 'instalacion' && currentVisit.reference
    ? currentVisit.reference
    : `INST-${order.id}`;
  const installNotes = [
    String(body.notes || '').trim(),
    liveReference && liveReference !== installationReference
      ? `Referencia comercial origen: ${liveReference}`
      : '',
  ].filter(Boolean).join('\n');

  const nextVisit = normalizeTechVisit({
    ...currentVisit,
    source: 'app',
    type: 'instalacion',
    countryCode: currentQuote.countryCode || order.countryCode || currentVisit.countryCode || '',
    status: 'agendada',
    reference: installationReference,
    scheduledAt,
    timeWindow,
    notes: [currentVisit.notes, installNotes].filter(Boolean).join('\n').trim(),
    clientPhone: String(body.clientPhone || currentVisit.clientPhone || '').trim(),
    clientDocument: String(currentVisit.clientDocument || currentQuote.clientDocument || '').trim(),
    clientAddress: String(body.clientAddress || currentVisit.clientAddress || currentQuote.city || '').trim(),
    quoteId: currentQuote.id,
    installationOrderId: order.id,
    assignedTechEmail: assignedTech?.email || assignedEmail,
    assignedTechName: assignedTech?.name || TECH_VISITS_DEFAULT_NAME,
    updatedAt: new Date().toISOString(),
    updatedBy: safeUser(req.user),
  });
  order = {
    ...order,
    clientName: currentQuote.clientName || order.clientName || '',
    clientEmail: currentQuote.email || order.clientEmail || '',
    clientDocument: String(currentQuote.clientDocument || order.clientDocument || '').trim(),
    city: currentQuote.city || order.city || '',
    address: String(body.clientAddress || currentVisit.clientAddress || order.address || currentQuote.city || '').trim(),
    installationType: currentQuote.installationType || order.installationType || '',
    propertyType: currentQuote.propertyType || order.propertyType || '',
    commercialProfileId: currentQuote.commercialProfile?.id || order.commercialProfileId || 'general',
    commercialProfileName: currentQuote.commercialProfile?.name || order.commercialProfileName || 'GENERAL',
    advisorName: order.advisorName || displayAdvisorName(req.user?.name || currentQuote.createdBy?.name),
    assignedTechnician: displayAdvisorName(assignedTech?.name || req.user?.name || order.assignedTechnician),
    assignedTechEmail: normalizeEmail(assignedTech?.email || assignedEmail || order.assignedTechEmail || ''),
    quotePdfUrl: currentQuote.pdfPath || order.quotePdfUrl || '',
    quoteTotal: currentQuote.total || order.quoteTotal || 0,
    voltage: String(currentQuote.voltage || order.voltage || ''),
    amperage: String(currentQuote.current || order.amperage || ''),
    status: 'agendada',
    scheduledAt,
    scheduledWindow: timeWindow,
    updatedAt: new Date().toISOString(),
  };
  const orderIndex = installationOrders.findIndex((item) => item.id === order.id);
  if (orderIndex >= 0) installationOrders[orderIndex] = order;
  else installationOrders.push(order);
  writeJSON(files.installationOrders, installationOrders);
  if (requestedVisitIndex >= 0 && requestedVisit?.type !== 'instalacion') {
    visits[requestedVisitIndex] = normalizeTechVisit({
      ...requestedVisit,
      status: 'cerrada',
      installationOrderId: order.id,
      updatedAt: new Date().toISOString(),
      updatedBy: safeUser(req.user),
      closedAt: requestedVisit.closedAt || new Date().toISOString(),
      resolution: requestedVisit.resolution || `Evaluación concluida. Derivada a instalación ${order.id}.`,
    });
  }
  const installSync = await syncTechVisitToClickUp(nextVisit, { quote: currentQuote });
  const persistedInstallVisit = normalizeTechVisit({
    ...nextVisit,
    clickupTaskId: installSync.taskId || nextVisit.clickupTaskId,
    clickupTaskUrl: installSync.taskUrl || nextVisit.clickupTaskUrl,
    clickupSyncedAt: installSync.syncedAt || nextVisit.clickupSyncedAt,
    clickupSyncError: installSync.ok ? '' : String(installSync.error || nextVisit.clickupSyncError || '').trim(),
  });
  if (visitIndex >= 0) visits[visitIndex] = persistedInstallVisit;
  else visits.push(persistedInstallVisit);
  saveTechVisits(visits);

  const nextQuote = normalizeStoredQuote({
    ...currentQuote,
    status: currentQuote.status === 'aceptada_cliente' ? 'aceptada_cliente' : 'aceptada_cliente',
    installationOrderId: order.id,
    scheduledInstallationAt: scheduledAt,
    scheduledInstallationWindow: timeWindow,
    scheduledInstallationBy: safeUser(req.user),
    clientAcceptedAt: currentQuote.clientAcceptedAt || new Date().toISOString(),
  });
  nextQuote.installationScheduleDelivery = await deliverInstallationScheduleEmail({
    quote: nextQuote,
    visit: nextVisit,
    order,
    req,
  });
  nextQuote.installationScheduleWhatsApp = await deliverInstallationScheduleWhatsApp({
    quote: nextQuote,
    visit: nextVisit,
    order,
  });
  quotes[index] = nextQuote;
  writeJSON(files.quotes, quotes);

  appendOperationalAuditLog({
    actor: req.user,
    action: 'installation_scheduled',
    entityType: 'installation',
    entityId: order.id,
    countryCode: nextQuote.countryCode,
    summary: `Instalación agendada para ${nextQuote.clientName || nextQuote.id}`,
    detail: {
      quoteId: nextQuote.id,
      scheduledAt,
      timeWindow,
      assignedTechEmail,
      clickupTaskId: persistedInstallVisit.clickupTaskId || '',
    },
  });

  res.json({ ok: true, quote: nextQuote, installationOrder: order, visit: persistedInstallVisit });
});

app.post('/api/quotes/:id/accept', authRequired, (req, res) => {
  if (!canUserManageCommercialQuoteFlow(req.user)) {
    return res.status(403).json({ error: 'Tu usuario no puede aceptar cotizaciones.' });
  }
  const quotes = readJSON(files.quotes, []);
  const installationOrders = readJSON(files.installationOrders, []);
  const index = quotes.findIndex((item) => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Cotización no encontrada' });
  const currentQuote = normalizeStoredQuote(quotes[index]);
  if (!userCanAccessCountry(req.user, currentQuote.countryCode)) {
    return res.status(403).json({ error: 'No tienes permiso para aceptar esta cotización.' });
  }
  let order = currentQuote.installationOrderId
    ? installationOrders.find((item) => item.id === currentQuote.installationOrderId)
    : installationOrders.find((item) => item.quoteId === currentQuote.id);
  if (!order) {
    order = buildInstallationOrderFromQuote(currentQuote, req.user);
    installationOrders.push(order);
    writeJSON(files.installationOrders, installationOrders);
  }
  const nextQuote = normalizeStoredQuote({
    ...currentQuote,
    status: 'aceptada_cliente',
    installationOrderId: order.id,
    clientAcceptedAt: currentQuote.clientAcceptedAt || new Date().toISOString(),
    clientAcceptedBy: safeUser(req.user),
  });
  quotes[index] = nextQuote;
  writeJSON(files.quotes, quotes);
  res.json({ ok: true, quote: nextQuote, installationOrder: order });
});

app.get('/api/quotes/:id', authRequired, (req, res) => {
  const countryScope = resolveRequestCountryContext(req, req.user);
  const quote = readJSON(files.quotes, []).map(normalizeStoredQuote).find((q) => q.id === req.params.id);
  if (!quote) return res.status(404).json({ error: 'No encontrado' });
  if (!userCanAccessCountry(req.user, quote.countryCode)) {
    return res.status(403).json({ error: 'No tienes permiso para ver esta cotización.' });
  }
  if (!matchesCountryScope(quote.countryCode, countryScope)) {
    return res.status(404).json({ error: 'No encontrado' });
  }
  res.json(quote);
});

app.get('/api/audit-feed', authRequired, (req, res) => {
  if (!canUserReadAudit(req.user)) {
    return res.status(403).json({ error: 'Tu usuario no puede ver la auditoría.' });
  }
  const countryScope = resolveRequestCountryContext(req, req.user);
  const limit = Math.min(300, Math.max(1, Number(req.query.limit || 120) || 120));
  const entityType = String(req.query.entityType || 'all').trim().toLowerCase();
  const feed = buildOperationalAuditFeed({
    limit,
    countryCode: countryScope,
    entityType,
  });
  res.json(feed);
});

app.get('/api/installation-orders', authRequired, (req, res) => {
  const user = req.user;
  const countryScope = resolveRequestCountryContext(req, req.user);
  const orders = readJSON(files.installationOrders, [])
    .map(normalizeInstallationOrder)
    .filter((order) => userCanAccessCountry(user, order.countryCode))
    .filter((order) => matchesCountryScope(order.countryCode, countryScope))
    .filter((order) => canUserSeeInstallationBoard(user)
      || normalizeEmail(order.assignedTechEmail) === normalizeEmail(user?.email))
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
  res.json(orders);
});

app.get('/api/installation-orders/:id', authRequired, (req, res) => {
  const countryScope = resolveRequestCountryContext(req, req.user);
  const targetId = String(req.params.id || '').trim();
  const order = readJSON(files.installationOrders, []).map(normalizeInstallationOrder).find((item) => item.id === targetId || item.quoteId === targetId);
  if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
  if (!userCanAccessCountry(req.user, order.countryCode)) {
    return res.status(403).json({ error: 'No tienes permiso para ver esta orden.' });
  }
  if (!matchesCountryScope(order.countryCode, countryScope)) {
    return res.status(404).json({ error: 'Orden no encontrada' });
  }
  if (!canUserSeeInstallationBoard(req.user)
    && normalizeEmail(order.assignedTechEmail) !== normalizeEmail(req.user?.email)) {
    return res.status(403).json({ error: 'No tienes permiso para ver esta orden' });
  }
  res.json(order);
});

app.get('/api/tech/visits', authRequired, async (req, res) => {
  const countryScope = resolveRequestCountryContext(req, req.user);
  const visits = (await syncTechVisitsFromCalendar())
    .filter((visit) => userCanAccessCountry(req.user, visit.countryCode))
    .filter((visit) => matchesCountryScope(visit.countryCode, countryScope))
    .filter((visit) => canUserAccessVisitSegment(req.user, visit))
    .filter((visit) => canUserSeeVisitsBoard(req.user)
      || normalizeEmail(visit.assignedTechEmail) === normalizeEmail(req.user?.email))
    .sort((a, b) => {
      const dateA = String(a.scheduledAt || a.createdAt || '');
      const dateB = String(b.scheduledAt || b.createdAt || '');
      return dateA.localeCompare(dateB);
    });
  res.json(visits);
});

app.delete('/api/tech/visits/:id/global', authRequired, async (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Solo admin puede eliminar una visita globalmente.' });
  }

  const rawVisits = readJSON(files.techVisits, []);
  const visits = rawVisits.map(normalizeTechVisit);
  const index = visits.findIndex((item) => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Visita no encontrada' });

  const current = normalizeTechVisit(visits[index]);
  if (!userCanAccessCountry(req.user, current.countryCode)) {
    return res.status(403).json({ error: 'No tienes permiso para eliminar esta visita.' });
  }

  const rawQuotes = readJSON(files.quotes, []);
  const quotes = rawQuotes.map(normalizeStoredQuote);
  const rawOrders = readJSON(files.installationOrders, []);
  const orders = rawOrders.map(normalizeInstallationOrder);
  const rawConformities = readJSON(files.conformities, []);
  const conformities = rawConformities.map(normalizeConformityRecord);
  const rawWarranties = readJSON(files.warranties, []);
  const warranties = rawWarranties.map(normalizeWarrantyRecord);
  const rawClients = readJSON(files.clients, []);
  const rawAuditLog = readJSON(files.auditLog, []);

  const quote = current.quoteId
    ? quotes.find((item) => String(item.id || '').trim() === String(current.quoteId || '').trim()) || null
    : null;
  const order = current.installationOrderId
    ? orders.find((item) => String(item.id || '').trim() === String(current.installationOrderId || '').trim()) || null
    : (quote
      ? orders.find((item) => String(item.quoteId || '').trim() === String(quote.id || '').trim()) || null
      : null);
  const effectiveQuoteId = String(current.quoteId || quote?.id || order?.quoteId || '').trim();
  const effectiveOrderId = String(current.installationOrderId || order?.id || '').trim();
  const relatedVisits = visits.filter((item) => (
    String(item.id || '').trim() === current.id
    || (effectiveQuoteId && String(item.quoteId || '').trim() === effectiveQuoteId)
    || (effectiveOrderId && String(item.installationOrderId || '').trim() === effectiveOrderId)
    || (current.reference && String(item.reference || '').trim() === String(current.reference || '').trim())
  ));
  const relatedConformities = conformities.filter((item) => (
    (effectiveOrderId && String(item.installationOrderId || '').trim() === effectiveOrderId)
    || (effectiveQuoteId && String(item.quoteId || '').trim() === effectiveQuoteId)
  ));
  const relatedWarranties = warranties.filter((item) => (
    (effectiveOrderId && String(item.installationOrderId || '').trim() === effectiveOrderId)
    || (effectiveQuoteId && String(item.quoteId || '').trim() === effectiveQuoteId)
  ));

  let booking = null;
  if (liveBookingsSb && current.reference) {
    const rows = await liveBookingsSb.select(
      'citas',
      `codigo_cita=eq.${encodeURIComponent(current.reference)}&select=id_cita,codigo_cita,microsoft_event_id`,
    ).catch(() => []);
    booking = Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  const externalEventId = String(booking?.microsoft_event_id || current.clickupTaskId || '').trim();
  const syncResult = await requestGlobalVisitDeleteSync({
    eventId: externalEventId,
    ticket: current.reference,
    countryCode: current.countryCode,
  });

  let supabaseDeleted = false;
  if (liveBookingsSb && current.reference) {
    await liveBookingsSb.delete('citas', `codigo_cita=eq.${encodeURIComponent(current.reference)}`);
    supabaseDeleted = true;
  }

  const backupStamp = `${Date.now()}`;
  const backupDir = path.join(rootDir, 'backups', `global-delete-${current.id}-${backupStamp}`);
  ensureDir(backupDir);

  const fileRefs = [
    String(quote?.pdfFile || '').trim(),
    resolveStorageFilePath(quote?.pdfPath || ''),
    ...relatedConformities.flatMap((item) => [item.pdfPath, item.pdfUrl]),
    ...relatedWarranties.flatMap((item) => [item.pdfPath, item.pdfUrl]),
  ]
    .map((item) => resolveStorageFilePath(item))
    .filter(Boolean);

  writeJSON(path.join(backupDir, 'payload.json'), {
    deletedAt: new Date().toISOString(),
    actor: safeUser(req.user),
    visit: current,
    relatedVisits,
    quote,
    order,
    conformities: relatedConformities,
    warranties: relatedWarranties,
    booking,
    syncResult,
    fileRefs,
  });

  for (const filePath of fileRefs) {
    archiveDeletedFile(filePath, backupDir);
  }

  const relatedVisitIds = new Set(relatedVisits.map((item) => String(item.id || '').trim()).filter(Boolean));
  saveTechVisits(rawVisits.filter((item) => !relatedVisitIds.has(String(item.id || '').trim())));
  writeJSON(
    files.quotes,
    rawQuotes.filter((item) => String(item.id || '').trim() !== effectiveQuoteId),
  );
  writeJSON(
    files.installationOrders,
    rawOrders.filter((item) => String(item.id || '').trim() !== effectiveOrderId && String(item.quoteId || '').trim() !== effectiveQuoteId),
  );
  writeJSON(
    files.conformities,
    rawConformities.filter((item) => {
      const conformityId = String(item.id || '').trim();
      const orderId = String(item.installationOrderId || '').trim();
      const quoteId = String(item.quoteId || '').trim();
      return !relatedConformities.some((record) => String(record.id || '').trim() === conformityId)
        && (!effectiveOrderId || orderId !== effectiveOrderId)
        && (!effectiveQuoteId || quoteId !== effectiveQuoteId);
    }),
  );
  writeJSON(
    files.warranties,
    rawWarranties.filter((item) => {
      const warrantyId = String(item.id || '').trim();
      const orderId = String(item.installationOrderId || '').trim();
      const quoteId = String(item.quoteId || '').trim();
      return !relatedWarranties.some((record) => String(record.id || '').trim() === warrantyId)
        && (!effectiveOrderId || orderId !== effectiveOrderId)
        && (!effectiveQuoteId || quoteId !== effectiveQuoteId);
    }),
  );
  writeJSON(
    files.clients,
    rawClients.map((item) => {
      const next = { ...item };
      if (String(next.lastQuoteId || '').trim() === effectiveQuoteId) {
        next.lastQuoteId = '';
        next.lastQuoteAt = '';
      }
      return next;
    }),
  );
  writeJSON(
    files.auditLog,
    rawAuditLog.filter((entry) => !matchesDeletedCaseAuditEntry(entry, {
      visitId: current.id,
      relatedVisitIds: [...relatedVisitIds],
      quoteId: effectiveQuoteId,
      orderId: effectiveOrderId,
      reference: current.reference,
      conformityIds: relatedConformities.map((item) => item.id),
      warrantyIds: relatedWarranties.map((item) => item.id),
    })),
  );

  await resetConversationAfterGlobalDelete({
    visit: current,
    booking,
    quote,
    order,
  });

  res.json({
    ok: true,
    deleted: {
      visit: true,
      relatedVisits: relatedVisitIds.size,
      quote: Boolean(effectiveQuoteId),
      installationOrder: Boolean(effectiveOrderId),
      conformities: relatedConformities.length,
      warranties: relatedWarranties.length,
      external: Boolean(externalEventId),
      supabase: supabaseDeleted,
    },
    syncResult,
    visitId: current.id,
    reference: current.reference,
    backupDir,
  });
});

app.get('/api/conformities', authRequired, (req, res) => {
  const user = req.user;
  const countryScope = resolveRequestCountryContext(req, req.user);
  const canSeeAll = canUserSeeConformitiesBoard(user);
  const userEmail = normalizeEmail(user?.email);
  const orders = readJSON(files.installationOrders, []).map(normalizeInstallationOrder);
  const visits = readJSON(files.techVisits, []).map(normalizeTechVisit);
  const allowedOrderIds = new Set(
    orders
      .filter((order) => userCanAccessCountry(user, order.countryCode))
      .filter((order) => matchesCountryScope(order.countryCode, countryScope))
      .filter((order) => canSeeAll || normalizeEmail(order.assignedTechEmail) === userEmail)
      .map((order) => String(order.id || '').trim())
      .filter(Boolean),
  );
  const allowedQuoteIds = new Set(
    visits
      .filter((visit) => userCanAccessCountry(user, visit.countryCode))
      .filter((visit) => matchesCountryScope(visit.countryCode, countryScope))
      .filter((visit) => canSeeAll || normalizeEmail(visit.assignedTechEmail) === userEmail)
      .map((visit) => String(visit.quoteId || '').trim())
      .filter(Boolean),
  );
  const conformities = readJSON(files.conformities, [])
    .map(normalizeConformityRecord)
    .filter((item) => userCanAccessCountry(user, item.countryCode))
    .filter((item) => matchesCountryScope(item.countryCode, countryScope))
    .filter((item) => canSeeAll
      || allowedOrderIds.has(String(item.installationOrderId || '').trim())
      || allowedQuoteIds.has(String(item.quoteId || '').trim()))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  res.json(conformities);
});

app.post('/api/conformities', authRequired, async (req, res) => {
  const user = req.user;
  if (!canUserGenerateConformity(user)) {
    return res.status(403).json({ error: 'No tienes permiso para generar conformidades desde la web.' });
  }

  const body = req.body || {};
  const orderId = String(body.installationOrderId || '').trim();
  const orders = readJSON(files.installationOrders, []).map(normalizeInstallationOrder);
  const order = orderId ? orders.find((item) => String(item.id || '').trim() === orderId) : null;
  if (orderId && !order) return res.status(404).json({ error: 'Orden no encontrada.' });

  const countryScope = resolveRequestCountryContext(req, user);
  if (order) {
    if (!userCanAccessCountry(user, order.countryCode)) {
      return res.status(403).json({ error: 'No tienes permiso para generar esta conformidad.' });
    }
    if (!matchesCountryScope(order.countryCode, countryScope)) {
      return res.status(404).json({ error: 'Orden no encontrada.' });
    }
    if (!isInstallationOrderReadyForConformity(order)) {
      return res.status(400).json({ error: 'La orden todavía no está lista para generar conformidad desde web.' });
    }
  }

  const quotes = readJSON(files.quotes, []).map(normalizeStoredQuote);
  const requestedQuoteId = String(body.quoteId || '').trim();
  const resolvedQuoteId = requestedQuoteId || String(order?.quoteId || '').trim();
  const quote = resolvedQuoteId
    ? quotes.find((item) => String(item.id || '').trim() === resolvedQuoteId) || null
    : null;
  const warranties = readJSON(files.warranties, []).map(normalizeWarrantyRecord);
  const matchedWarranty = warranties.find((item) => String(item.installationOrderId || '').trim() === orderId
    || (resolvedQuoteId && String(item.quoteId || '').trim() === resolvedQuoteId));

  if (!order && !quote && !String(body.clientName || '').trim()) {
    return res.status(400).json({ error: 'Completa al menos los datos básicos del cliente para una conformidad manual.' });
  }

  if (quote) {
    if (!userCanAccessCountry(user, quote.countryCode)) {
      return res.status(403).json({ error: 'No tienes permiso para usar esta cotización.' });
    }
    if (!matchesCountryScope(quote.countryCode, countryScope)) {
      return res.status(404).json({ error: 'Cotización no encontrada.' });
    }
  }

  if (orderId) {
    const existing = readJSON(files.conformities, [])
      .map(normalizeConformityRecord)
      .find((item) => String(item.installationOrderId || '').trim() === orderId);
    if (existing) {
      return res.status(409).json({ error: 'Esta orden ya tiene una conformidad generada.', conformity: existing });
    }
  }

  const clientEmail = normalizeEmail(body.clientEmail || order?.clientEmail || quote?.email || '');
  if (clientEmail && !isValidEmail(clientEmail)) return res.status(400).json({ error: 'Correo inválido.' });

  const conformity = normalizeConformityRecord({
    id: body.id || `CONF-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
    installationOrderId: orderId,
    quoteId: String(resolvedQuoteId || quote?.id || '').trim(),
    warrantyId: matchedWarranty?.id || '',
    warrantyCode: matchedWarranty?.warrantyCode || '',
    warrantyValidUntil: matchedWarranty?.validUntil || '',
    date: String(body.date || '').trim(),
    countryCode: resolveRecordCountryCode(body.countryCode, order?.countryCode, quote?.countryCode, body.address, clientEmail),
    clientName: String(body.clientName || order?.clientName || quote?.clientName || '').trim(),
    clientEmail,
    ruc: String(body.ruc || order?.ruc || quote?.ruc || '').trim(),
    address: String(body.address || order?.address || quote?.clientAddress || '').trim(),
    chargerBrand: String(body.chargerBrand || order?.chargerBrand || quote?.charger?.brand || quote?.charger?.label || 'GENERAL').trim(),
    serialNumber: String(body.serialNumber || order?.serialNumber || quote?.serialNumber || '').trim(),
    voltage: String(body.voltage || order?.voltage || quote?.voltage || '').trim(),
    amperage: String(body.amperage || order?.amperage || quote?.current || '').trim(),
    other: String(body.other || '').trim(),
    powerKw: String(body.powerKw || order?.powerKw || quote?.powerKw || '').trim(),
    observations: String(body.observations || '').trim(),
    deliveredItems: normalizeConformityDeliveredItems(body.deliveredItems),
    cajaCargador: body.cajaCargador === true,
    cargadorEvinka: body.cargadorEvinka === true,
    manualCargador: body.manualCargador === true,
    tarjetasCargador: body.tarjetasCargador === true,
    adicional: body.adicional === true,
    adicionalDesc: String(body.adicionalDesc || '').trim(),
    photoUrls: Array.isArray(body.photoUrls) ? body.photoUrls : [],
    installerSignatureUrl: String(body.installerSignatureUrl || '').trim(),
    clientSignatureUrl: String(body.clientSignatureUrl || '').trim(),
    status: 'pdf_generated',
    createdAt: new Date().toISOString(),
    createdBy: normalizeEmail(user?.email || '') || String(user?.employeeCode || user?.id || 'web').trim(),
  });

  const pdfBuffer = await createConformityPdfBuffer({ conformity, order, quote });
  conformity.pdfBase64 = pdfBuffer.toString('base64');
  conformity.emailDelivery = await deliverConformityEmail({ conformity, req });
  conformity.whatsappDelivery = await deliverConformityWhatsApp({ conformity, quote });

  const conformities = readJSON(files.conformities, []);
  conformities.push(conformity);
  writeJSON(files.conformities, conformities);

  if (orderId) {
    const rawOrders = readJSON(files.installationOrders, []);
    const orderIndex = rawOrders.findIndex((item) => String(item.id || '').trim() === orderId);
    if (orderIndex >= 0) {
      rawOrders[orderIndex] = {
        ...rawOrders[orderIndex],
        status: 'conformidad_generada',
        conformityStatus: 'pdf_generated',
        conformityId: conformity.id,
        conformityPdfUrl: rawOrders[orderIndex]?.conformityPdfUrl || '',
        updatedAt: new Date().toISOString(),
      };
      writeJSON(files.installationOrders, rawOrders);
    }
  }

  const rawQuotes = readJSON(files.quotes, []);
  const quoteIndex = rawQuotes.findIndex((item) => String(item.id || '').trim() === conformity.quoteId);
  if (quoteIndex >= 0) {
    rawQuotes[quoteIndex] = {
      ...normalizeStoredQuote(rawQuotes[quoteIndex]),
      status: 'instalada',
      conformityStatus: 'pdf_generated',
      conformityId: conformity.id,
      conformityPdfUrl: rawQuotes[quoteIndex]?.conformityPdfUrl || '',
    };
    writeJSON(files.quotes, rawQuotes);
  }

  if (orderId || conformity.quoteId) {
    const visits = readJSON(files.techVisits, []);
    let visitsChanged = false;
    let syncedInstallationVisit = null;
    let clickupAttachmentResult = null;
    for (let i = 0; i < visits.length; i += 1) {
      const currentVisit = normalizeTechVisit(visits[i]);
      const isTarget = currentVisit.type === 'instalacion'
        && ((orderId && currentVisit.installationOrderId === orderId) || (conformity.quoteId && currentVisit.quoteId === conformity.quoteId));
      if (!isTarget) continue;
      const nextVisit = normalizeTechVisit({
        ...currentVisit,
        status: 'pendiente_cierre',
        installationOrderId: orderId || currentVisit.installationOrderId,
        quoteId: conformity.quoteId || currentVisit.quoteId,
        updatedAt: new Date().toISOString(),
        closedAt: '',
        resolution: currentVisit.resolution || 'Instalación concluida con conformidad generada desde web.',
        checklist: buildAutoChecklistForVisit({
          ...currentVisit,
          status: 'pendiente_cierre',
          installationOrderId: orderId || currentVisit.installationOrderId,
          quoteId: conformity.quoteId || currentVisit.quoteId,
        }),
      });
      const linkedQuote = quote || normalizeStoredQuote(rawQuotes[quoteIndex] || {});
      const clickupSync = await syncTechVisitToClickUp(nextVisit, { quote: linkedQuote });
      visits[i] = normalizeTechVisit({
        ...nextVisit,
        clickupTaskId: clickupSync.taskId || nextVisit.clickupTaskId,
        clickupTaskUrl: clickupSync.taskUrl || nextVisit.clickupTaskUrl,
        clickupSyncedAt: clickupSync.syncedAt || nextVisit.clickupSyncedAt,
        clickupSyncError: clickupSync.ok ? '' : String(clickupSync.error || nextVisit.clickupSyncError || '').trim(),
      });
      syncedInstallationVisit = visits[i];
      visitsChanged = true;
    }
    if (visitsChanged) saveTechVisits(visits);
    const clickupTaskId = String(syncedInstallationVisit?.clickupTaskId || quote?.clickupTaskId || '').trim();
    if (clickupTaskId) {
      clickupAttachmentResult = await attachOperationalCaseFilesToClickUpTask(
        clickupTaskId,
        {
          visit: syncedInstallationVisit,
          quote: normalizeStoredQuote(rawQuotes[quoteIndex] || quote || {}),
          conformity,
        },
      );
    }
    await notifyConformityMilestone({
      conformity,
      quote: normalizeStoredQuote(rawQuotes[quoteIndex] || quote || {}),
      actor: req.user,
    });
    appendOperationalAuditLog({
      actor: req.user,
      action: 'conformity_generated',
      entityType: 'conformity',
      entityId: conformity.id,
      countryCode: conformity.countryCode,
      summary: `Conformidad generada para ${conformity.clientName || conformity.quoteId}`,
      detail: {
        quoteId: conformity.quoteId,
        installationOrderId: orderId || '',
        clickupTaskId: syncedInstallationVisit?.clickupTaskId || '',
        clickupAttachmentError: clickupAttachmentResult?.ok === false ? clickupAttachmentResult.error || '' : '',
      },
    });
  }

  res.json({ ok: true, conformity, emailDelivery: conformity.emailDelivery });
});

app.get('/api/conformities/:id/pdf', authRequired, async (req, res) => {
  const user = req.user;
  const countryScope = resolveRequestCountryContext(req, req.user);
  const canSeeAll = canUserSeeConformitiesBoard(user);
  const orders = readJSON(files.installationOrders, []).map(normalizeInstallationOrder);
  const visits = readJSON(files.techVisits, []).map(normalizeTechVisit);
  const conformity = readJSON(files.conformities, []).map(normalizeConformityRecord).find((item) => String(item.id || '').trim() === req.params.id);
  if (!conformity) return res.status(404).json({ error: 'Conformidad no encontrada' });
  if (!userCanAccessCountry(user, conformity.countryCode)) {
    return res.status(403).json({ error: 'No tienes permiso para ver esta conformidad.' });
  }
  if (!matchesCountryScope(conformity.countryCode, countryScope)) {
    return res.status(404).json({ error: 'Conformidad no encontrada' });
  }

  const order = orders.find((item) => String(item.id || '').trim() === String(conformity.installationOrderId || '').trim());
  const sameTechByOrder = normalizeEmail(order?.assignedTechEmail) === normalizeEmail(user?.email);
  const sameTechByVisit = visits.some((visit) => String(visit.installationOrderId || '').trim() === String(conformity.installationOrderId || '').trim()
    && normalizeEmail(visit.assignedTechEmail) === normalizeEmail(user?.email));
  if (!canSeeAll && !sameTechByOrder && !sameTechByVisit) {
    return res.status(403).json({ error: 'No tienes permiso para ver esta conformidad' });
  }

  const pdfBase64 = String(conformity.pdfBase64 || '').trim();
  if (pdfBase64) {
    try {
      const buffer = Buffer.from(pdfBase64, 'base64');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Conformidad_${String(conformity.installationOrderId || conformity.id || 'EVINKA')}.pdf"`);
      return res.end(buffer);
    } catch (error) {
      return res.status(500).json({ error: `No pude decodificar el PDF: ${error?.message || error}` });
    }
  }

  const pdfUrl = String(conformity.pdfUrl || '').trim();
  if (!pdfUrl) {
    return res.status(404).json({ error: 'Esta conformidad no tiene PDF disponible.' });
  }
  if (pdfUrl.startsWith('/')) {
    return res.redirect(pdfUrl);
  }
  return res.redirect(pdfUrl);
});

app.post('/api/warranties', authRequired, async (req, res) => {
  const user = req.user;
  if (!canUserGenerateConformity(user)) {
    return res.status(403).json({ error: 'No tienes permiso para generar garantías desde la web.' });
  }

  const body = req.body || {};
  const orderId = String(body.installationOrderId || '').trim();
  const quoteId = String(body.quoteId || '').trim();
  const clientEmail = normalizeEmail(body.clientEmail || '');
  if (clientEmail && !isValidEmail(clientEmail)) return res.status(400).json({ error: 'Correo inválido.' });

  const orders = readJSON(files.installationOrders, []).map(normalizeInstallationOrder);
  const order = orderId ? orders.find((item) => item.id === orderId || item.quoteId === orderId) : null;
  const quotes = readJSON(files.quotes, []).map(normalizeStoredQuote);
  const quote = quoteId ? quotes.find((item) => item.id === quoteId) || null : null;
  const warrantyId = body.id || `GAR-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const warrantyCode = buildWarrantyCode(orderId || quoteId || String(body.clientName || 'EVINKA'));
  const validUntil = warrantyValidUntil(body.date);
  const pdfBuffer = await createWarrantyPdfBuffer({
    warranty: {
      id: warrantyId,
      warrantyCode,
      validUntil,
      installationOrderId: orderId,
      quoteId,
      clientName: String(body.clientName || order?.clientName || quote?.clientName || '').trim(),
      clientEmail,
      clientDocument: String(body.clientDocument || body.ruc || order?.ruc || quote?.ruc || '').trim(),
      address: String(body.address || order?.address || quote?.clientAddress || '').trim(),
      chargerBrand: String(body.chargerBrand || order?.chargerBrand || quote?.charger?.label || 'GENERAL').trim(),
      serialNumber: String(body.serialNumber || order?.serialNumber || '').trim(),
      voltage: String(body.voltage || order?.voltage || quote?.voltage || '').trim(),
      amperage: String(body.amperage || order?.amperage || quote?.current || '').trim(),
      powerKw: String(body.powerKw || order?.powerKw || quote?.powerKw || '').trim(),
      installerSignatureUrl: String(body.installerSignatureUrl || '').trim(),
      clientSignatureUrl: String(body.clientSignatureUrl || '').trim(),
      createdAt: new Date().toISOString(),
      createdBy: normalizeEmail(user?.email || '') || String(user?.employeeCode || user?.id || 'web').trim(),
    },
    order,
    quote,
  });

  const warranty = normalizeWarrantyRecord({
    id: warrantyId,
    warrantyCode,
    validUntil,
    installationOrderId: orderId,
    quoteId,
    countryCode: resolveRecordCountryCode(body.countryCode, order?.countryCode, quote?.countryCode, body.address, clientEmail),
    clientName: String(body.clientName || order?.clientName || quote?.clientName || '').trim(),
    clientEmail,
    clientDocument: String(body.clientDocument || body.ruc || order?.ruc || quote?.ruc || '').trim(),
    address: String(body.address || order?.address || quote?.clientAddress || '').trim(),
    chargerBrand: String(body.chargerBrand || order?.chargerBrand || quote?.charger?.label || 'GENERAL').trim(),
    serialNumber: String(body.serialNumber || order?.serialNumber || '').trim(),
    voltage: String(body.voltage || order?.voltage || quote?.voltage || '').trim(),
    amperage: String(body.amperage || order?.amperage || quote?.current || '').trim(),
    powerKw: String(body.powerKw || order?.powerKw || quote?.powerKw || '').trim(),
    installerSignatureUrl: String(body.installerSignatureUrl || '').trim(),
    clientSignatureUrl: String(body.clientSignatureUrl || '').trim(),
    pdfBase64: pdfBuffer.toString('base64'),
    pdfUrl: `/pdf/${warrantyId}-DEMO-GARANTIA-LEGAL.pdf`,
    pdfPath: `/pdf/${warrantyId}-DEMO-GARANTIA-LEGAL.pdf`,
    pdfFilename: `${warrantyId}-DEMO-GARANTIA-LEGAL.pdf`,
    status: 'warranty_generated',
    createdAt: new Date().toISOString(),
    createdBy: normalizeEmail(user?.email || '') || String(user?.employeeCode || user?.id || 'web').trim(),
  });
  warranty.whatsappDelivery = await deliverWarrantyWhatsApp({ warranty, quote });

  const warranties = readJSON(files.warranties, []);
  warranties.push(warranty);
  writeJSON(files.warranties, warranties);

  const conformities = readJSON(files.conformities, []);
  const conformityIndex = conformities.findIndex((item) => String(item.installationOrderId || '').trim() === orderId || String(item.quoteId || '').trim() === quoteId);
  if (conformityIndex >= 0) {
    const linkedConformity = normalizeConformityRecord(conformities[conformityIndex]);
    const linkedPdfBuffer = await createConformityPdfBuffer({
      conformity: {
        ...linkedConformity,
        warrantyCode,
        warrantyValidUntil: validUntil,
      },
      order,
      quote,
    });
    conformities[conformityIndex] = {
      ...linkedConformity,
      warrantyId: warranty.id,
      warrantyCode,
      warrantyValidUntil: validUntil,
      warrantyPdfUrl: `/pdf/${warranty.id}-DEMO-GARANTIA-LEGAL.pdf`,
      pdfBase64: linkedPdfBuffer.toString('base64'),
      pdfUrl: linkedConformity.pdfUrl || '',
    };
    writeJSON(files.conformities, conformities);
  }

  if (quoteId) {
    const rawQuotes = readJSON(files.quotes, []);
    const quoteIndex = rawQuotes.findIndex((item) => String(item.id || '').trim() === quoteId);
    if (quoteIndex >= 0) {
      rawQuotes[quoteIndex] = {
        ...normalizeStoredQuote(rawQuotes[quoteIndex]),
        warrantyId: warranty.id,
        warrantyCode,
        warrantyValidUntil: validUntil,
        warrantyPdfUrl: `/pdf/${warranty.id}-DEMO-GARANTIA-LEGAL.pdf`,
      };
      writeJSON(files.quotes, rawQuotes);
    }
  }

  const installationVisits = readJSON(files.techVisits, []).map(normalizeTechVisit);
  const linkedVisit = installationVisits.find((item) => item.type === 'instalacion'
    && ((orderId && String(item.installationOrderId || '').trim() === orderId)
      || (quoteId && String(item.quoteId || '').trim() === quoteId))) || null;
  const warrantyClickUpTaskId = String(linkedVisit?.clickupTaskId || quote?.clickupTaskId || '').trim();
  if (warrantyClickUpTaskId) {
    await attachOperationalCaseFilesToClickUpTask(warrantyClickUpTaskId, {
      visit: linkedVisit,
      quote,
      warranty,
    });
  }

  res.json({ ok: true, warranty });
});

app.get('/api/warranties/:id/pdf', authRequired, (req, res) => {
  const warranty = readJSON(files.warranties, []).map(normalizeWarrantyRecord).find((item) => String(item.id || '').trim() === req.params.id);
  if (!warranty) return res.status(404).json({ error: 'Garantía no encontrada.' });
  const pdfBase64 = String(warranty.pdfBase64 || '').trim();
  if (pdfBase64) {
    const buffer = Buffer.from(pdfBase64, 'base64');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Garantia_${String(warranty.installationOrderId || warranty.id || 'EVINKA')}.pdf"`);
    return res.end(buffer);
  }
  const pdfUrl = String(warranty.pdfUrl || '').trim();
  if (!pdfUrl) return res.status(404).json({ error: 'Esta garantía no tiene PDF disponible.' });
  return res.redirect(pdfUrl);
});

app.patch('/api/tech/visits/:id', authRequired, async (req, res) => {
  const visits = readJSON(files.techVisits, []);
  const index = visits.findIndex((item) => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Visita no encontrada' });

  const current = normalizeTechVisit(visits[index]);
  if (!canUserUpdateVisit(req.user, current)) {
    return res.status(403).json({ error: 'No tienes permiso para actualizar esta visita' });
  }
  if (!canUserAccessVisitSegment(req.user, current)) {
    return res.status(403).json({ error: 'No tienes permiso para actualizar esta visita' });
  }

  const body = req.body || {};
  const next = normalizeTechVisit({
    ...current,
    status: normalizeTechVisitStatus(body.status || current.status),
    notes: String(body.notes ?? current.notes ?? '').trim(),
    resolution: String(body.resolution ?? current.resolution ?? '').trim(),
    quoteId: String(body.quoteId ?? current.quoteId ?? '').trim(),
    installationOrderId: String(body.installationOrderId ?? current.installationOrderId ?? '').trim(),
    checklist: Array.isArray(body.checklist) ? body.checklist.map((item) => String(item || '').trim()).filter(Boolean) : buildAutoChecklistForVisit({
      ...current,
      status: normalizeTechVisitStatus(body.status || current.status),
      quoteId: String(body.quoteId ?? current.quoteId ?? '').trim(),
      installationOrderId: String(body.installationOrderId ?? current.installationOrderId ?? '').trim(),
    }),
    updatedAt: new Date().toISOString(),
    updatedBy: safeUser(req.user),
  });
  if (!next.startedAt && ['en_ruta', 'en_visita'].includes(next.status)) {
    next.startedAt = new Date().toISOString();
  }
  if (next.status === 'cerrada') {
    next.closedAt = new Date().toISOString();
  }
  const relatedQuote = next.quoteId
    ? readJSON(files.quotes, []).map(normalizeStoredQuote).find((item) => item.id === next.quoteId) || null
    : null;
  const clickupSync = await syncTechVisitToClickUp(next, { quote: relatedQuote });
  visits[index] = normalizeTechVisit({
    ...next,
    clickupTaskId: clickupSync.taskId || next.clickupTaskId,
    clickupTaskUrl: clickupSync.taskUrl || next.clickupTaskUrl,
    clickupSyncedAt: clickupSync.syncedAt || next.clickupSyncedAt,
    clickupSyncError: clickupSync.ok ? '' : String(clickupSync.error || next.clickupSyncError || '').trim(),
  });
  saveTechVisits(visits);
  const notifications = [];
  if (current.status !== 'en_ruta' && visits[index].status === 'en_ruta') {
    notifications.push(...await notifyVisitOnTheWay(visits[index]));
  }
  appendOperationalAuditLog({
    actor: req.user,
    action: 'visit_updated',
    entityType: current.type === 'instalacion' ? 'installation_visit' : 'visit',
    entityId: current.id,
    countryCode: current.countryCode,
    summary: `Visita ${current.id} actualizada a ${visits[index].status}`,
    detail: {
      previousStatus: current.status,
      nextStatus: visits[index].status,
      quoteId: visits[index].quoteId,
      installationOrderId: visits[index].installationOrderId,
      clickupTaskId: visits[index].clickupTaskId || '',
    },
  });
  res.json({ ...normalizeTechVisit(visits[index]), notifications });
});

app.post('/api/internal/tech-visits', internalBotAuth, async (req, res) => {
  const body = req.body || {};
  const clientName = String(body.clientName || '').trim();
  const clientAddress = String(body.clientAddress || '').trim();
  if (!clientName || !clientAddress) {
    return res.status(400).json({ error: 'Faltan clientName y clientAddress' });
  }

  const visits = readJSON(files.techVisits, []);
  const techs = readUsers().filter((user) => isTechAssignableUser(user) && user.status === 'active');
  const assignedEmail = normalizeEmail(body.assignedTechEmail || techs[0]?.email || '');
  const assignedTech = techs.find((user) => normalizeEmail(user.email) === assignedEmail);
  const createdAt = new Date().toISOString();
  const reference = String(body.reference || '').trim();
  const existingIndex = reference
    ? visits.findIndex((item) => String(item.reference || '').trim() === reference)
    : -1;
  const base = existingIndex >= 0 ? normalizeTechVisit(visits[existingIndex]) : null;
  const visit = normalizeTechVisit({
    id: base?.id || body.id || `VIS-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
    source: String(body.source || 'chatbot').trim() || 'chatbot',
    type: String(body.type || 'visita_tecnica').trim() || 'visita_tecnica',
    status: body.status || base?.status || 'pendiente',
    clientName,
    clientPhone: String(body.clientPhone || '').trim(),
    clientDocument: String(body.clientDocument || body.ruc || '').trim(),
    clientEmail: normalizeEmail(body.clientEmail || ''),
    clientAddress,
    customerSegment: body.customerSegment || base?.customerSegment || inferCustomerSegment(body),
    scheduledAt: String(body.scheduledAt || '').trim(),
    timeWindow: String(body.timeWindow || '').trim(),
    notes: String(body.notes || '').trim(),
    resolution: base?.resolution || '',
    reference,
    quoteId: String(body.quoteId || '').trim(),
    installationOrderId: String(body.installationOrderId || '').trim(),
    assignedTechEmail: assignedTech?.email || assignedEmail,
    assignedTechName: assignedTech?.name || String(body.assignedTechName || '').trim(),
    countryCode: resolveRecordCountryCode(body.countryCode, body.clientPhone, clientAddress, body.clientEmail, base?.countryCode || ''),
    checklist: Array.isArray(body.checklist) ? body.checklist.map((item) => String(item || '').trim()).filter(Boolean) : [],
    clickupTaskId: String(body.clickupTaskId || base?.clickupTaskId || '').trim(),
    clickupTaskUrl: String(body.clickupTaskUrl || base?.clickupTaskUrl || '').trim(),
    clickupSyncedAt: String(base?.clickupSyncedAt || '').trim(),
    clickupSyncError: '',
    createdAt: base?.createdAt || createdAt,
    updatedAt: createdAt,
    startedAt: base?.startedAt || '',
    closedAt: base?.closedAt || '',
  });
  const clickupSync = await syncTechVisitToClickUp(visit);
  const syncedVisit = normalizeTechVisit({
    ...visit,
    clickupTaskId: clickupSync.taskId || visit.clickupTaskId,
    clickupTaskUrl: clickupSync.taskUrl || visit.clickupTaskUrl,
    clickupSyncedAt: clickupSync.syncedAt || visit.clickupSyncedAt,
    clickupSyncError: clickupSync.ok ? '' : String(clickupSync.error || visit.clickupSyncError || '').trim(),
  });
  if (existingIndex >= 0) {
    visits[existingIndex] = syncedVisit;
  } else {
    visits.push(syncedVisit);
  }
  writeJSON(files.techVisits, visits);
  appendOperationalAuditLog({
    actor: { id: 'chatbot', name: 'Chatbot EVINKA', email: 'chatbot@evinka.local', role: 'bot', status: 'active', employeeCode: 'BOT', notificationPhone: '', allowedCountries: [syncedVisit.countryCode || ''], allowedQueues: [] },
    action: existingIndex >= 0 ? 'visit_upserted_from_chatbot' : 'visit_created_from_chatbot',
    entityType: 'visit',
    entityId: syncedVisit.id,
    countryCode: syncedVisit.countryCode,
    summary: `Chatbot registró la visita ${syncedVisit.reference || syncedVisit.id}`,
    detail: {
      reference: syncedVisit.reference,
      clientName: syncedVisit.clientName,
      clickupTaskId: syncedVisit.clickupTaskId || '',
      created: existingIndex < 0,
    },
  });
  res.json({ ok: true, created: existingIndex < 0, visit: syncedVisit, clickupSync });
});

app.get('/api/mobile/orders/:id', mobileAppAuth, (req, res) => {
  const orders = readJSON(files.installationOrders, []);
  const order = orders.find((item) => item.id === req.params.id || item.quoteId === req.params.id);
  if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
  res.json(order);
});

app.post('/api/mobile/conformities', mobileAppAuth, async (req, res) => {
  const body = req.body || {};
  const orderId = String(body.installationOrderId || '').trim();
  const quoteId = String(body.quoteId || '').trim();
  const clientEmail = normalizeEmail(body.clientEmail || '');
  const pdfBase64 = String(body.pdfBase64 || '').trim();
  if (clientEmail && !isValidEmail(clientEmail)) return res.status(400).json({ error: 'Correo inválido' });

  const orders = readJSON(files.installationOrders, []);
  const orderIndex = orderId
    ? orders.findIndex((item) => item.id === orderId && (!quoteId || item.quoteId === quoteId))
    : -1;
  if (orderId && orderIndex < 0) return res.status(404).json({ error: 'Orden no encontrada' });
  if (!orderId && !quoteId && !String(body.clientName || '').trim()) {
    return res.status(400).json({ error: 'Completa al menos los datos básicos del cliente.' });
  }

  const warranties = readJSON(files.warranties, []).map(normalizeWarrantyRecord);
  const matchedWarranty = warranties.find((item) => (
    (orderId && String(item.installationOrderId || '').trim() === orderId)
    || (quoteId && String(item.quoteId || '').trim() === quoteId)
  )) || null;

  const conformityId = body.id || `CONF-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const persistedPdf = persistPdfToQuotesDir({ id: conformityId, label: 'APP-CONFORMIDAD', pdfBase64 });
  const fallbackPdfUrl = String(body.pdfUrl || '').trim();
  const conformity = normalizeConformityRecord({
    id: conformityId,
    installationOrderId: orderId,
    quoteId,
    warrantyId: matchedWarranty?.id || '',
    warrantyCode: matchedWarranty?.warrantyCode || '',
    warrantyValidUntil: matchedWarranty?.validUntil || '',
    warrantyPdfUrl: matchedWarranty?.pdfUrl || '',
    date: String(body.date || '').trim(),
    countryCode: resolveRecordCountryCode(body.countryCode, orders[orderIndex]?.countryCode, body.address, clientEmail),
    clientName: String(body.clientName || '').trim(),
    clientEmail,
    ruc: String(body.ruc || '').trim(),
    address: String(body.address || '').trim(),
    chargerBrand: String(body.chargerBrand || '').trim(),
    serialNumber: String(body.serialNumber || '').trim(),
    voltage: String(body.voltage || '').trim(),
    amperage: String(body.amperage || '').trim(),
    other: String(body.other || '').trim(),
    powerKw: String(body.powerKw || '').trim(),
    observations: String(body.observations || '').trim(),
    deliveredItems: Array.isArray(body.deliveredItems) ? body.deliveredItems : [],
    cajaCargador: body.cajaCargador === true,
    cargadorEvinka: body.cargadorEvinka === true,
    manualCargador: body.manualCargador === true,
    tarjetasCargador: body.tarjetasCargador === true,
    adicional: body.adicional === true,
    adicionalDesc: String(body.adicionalDesc || '').trim(),
    photoUrls: Array.isArray(body.photoUrls) ? body.photoUrls : [],
    installerSignatureUrl: String(body.installerSignatureUrl || '').trim(),
    clientSignatureUrl: String(body.clientSignatureUrl || '').trim(),
    pdfUrl: persistedPdf.pdfUrl || fallbackPdfUrl,
    pdfPath: persistedPdf.pdfPath || fallbackPdfUrl,
    pdfFilename: persistedPdf.pdfFilename,
    pdfBase64,
    status: String(body.status || 'pdf_generated').trim(),
    createdAt: new Date().toISOString(),
    createdBy: 'mobile_app',
  });
  conformity.emailDelivery = await deliverConformityEmail({ conformity, req });
  conformity.whatsappDelivery = await deliverConformityWhatsApp({ conformity, quote });

  const conformities = readJSON(files.conformities, []);
  const conformityIndex = conformities.findIndex((item) => String(item.id || '').trim() === conformity.id);
  if (conformityIndex >= 0) {
    conformities[conformityIndex] = conformity;
  } else {
    conformities.push(conformity);
  }
  writeJSON(files.conformities, conformities);

  const conformityPdfUrl = conformity.pdfUrl || `/api/conformities/${encodeURIComponent(conformity.id)}/pdf`;
  if (orderIndex >= 0) {
    orders[orderIndex] = {
      ...orders[orderIndex],
      status: 'conformidad_generada',
      conformityStatus: 'pdf_generated',
      conformityId: conformity.id,
      conformityPdfUrl,
      warrantyId: matchedWarranty?.id || orders[orderIndex]?.warrantyId || '',
      warrantyCode: matchedWarranty?.warrantyCode || orders[orderIndex]?.warrantyCode || '',
      warrantyValidUntil: matchedWarranty?.validUntil || orders[orderIndex]?.warrantyValidUntil || '',
      warrantyPdfUrl: matchedWarranty?.pdfUrl || orders[orderIndex]?.warrantyPdfUrl || '',
      updatedAt: new Date().toISOString(),
    };
    writeJSON(files.installationOrders, orders);
  }

  const quotes = readJSON(files.quotes, []);
  const quoteIndex = quotes.findIndex((item) => item.id === quoteId);
  if (quoteIndex >= 0) {
    quotes[quoteIndex] = {
      ...normalizeStoredQuote(quotes[quoteIndex]),
      status: 'instalada',
      conformityStatus: 'pdf_generated',
      conformityId: conformity.id,
      conformityPdfUrl,
      warrantyId: matchedWarranty?.id || quotes[quoteIndex]?.warrantyId || '',
      warrantyCode: matchedWarranty?.warrantyCode || quotes[quoteIndex]?.warrantyCode || '',
      warrantyValidUntil: matchedWarranty?.validUntil || quotes[quoteIndex]?.warrantyValidUntil || '',
      warrantyPdfUrl: matchedWarranty?.pdfUrl || quotes[quoteIndex]?.warrantyPdfUrl || '',
    };
    writeJSON(files.quotes, quotes);
  }

  if (orderId || quoteId) {
    const visits = readJSON(files.techVisits, []);
    let visitsChanged = false;
    let syncedInstallationVisit = null;
    let clickupSync = null;
    for (let i = 0; i < visits.length; i += 1) {
      const currentVisit = normalizeTechVisit(visits[i]);
      const isTarget = currentVisit.type === 'instalacion'
        && ((orderId && currentVisit.installationOrderId === orderId) || (quoteId && currentVisit.quoteId === quoteId));
      if (!isTarget) continue;
      visits[i] = normalizeTechVisit({
        ...currentVisit,
        status: 'pendiente_cierre',
        installationOrderId: orderId || currentVisit.installationOrderId,
        quoteId: quoteId || currentVisit.quoteId,
        updatedAt: new Date().toISOString(),
        closedAt: '',
        resolution: currentVisit.resolution || 'Instalación concluida con conformidad generada.',
        checklist: buildAutoChecklistForVisit({
          ...currentVisit,
          status: 'pendiente_cierre',
          installationOrderId: orderId || currentVisit.installationOrderId,
          quoteId: quoteId || currentVisit.quoteId,
        }),
      });
      syncedInstallationVisit = visits[i];
      visitsChanged = true;
    }
    const linkedQuote = quoteIndex >= 0 ? normalizeStoredQuote(quotes[quoteIndex]) : null;
    if (syncedInstallationVisit) {
      clickupSync = await syncTechVisitToClickUp(syncedInstallationVisit, { quote: linkedQuote });
      syncedInstallationVisit = normalizeTechVisit({
        ...syncedInstallationVisit,
        clickupTaskId: clickupSync.taskId || syncedInstallationVisit.clickupTaskId || linkedQuote?.clickupTaskId || '',
        clickupTaskUrl: clickupSync.taskUrl || syncedInstallationVisit.clickupTaskUrl || '',
        clickupSyncedAt: clickupSync.syncedAt || syncedInstallationVisit.clickupSyncedAt || '',
        clickupSyncError: clickupSync.ok ? '' : String(clickupSync.error || syncedInstallationVisit.clickupSyncError || '').trim(),
      });
      if (linkedQuote && clickupSync.taskId && linkedQuote.clickupTaskId !== clickupSync.taskId && quoteIndex >= 0) {
        quotes[quoteIndex] = normalizeStoredQuote({
          ...quotes[quoteIndex],
          clickupTaskId: clickupSync.taskId,
        });
        writeJSON(files.quotes, quotes);
      }
      const targetIndex = visits.findIndex((item) => String(item.id || '').trim() === syncedInstallationVisit.id);
      if (targetIndex >= 0) visits[targetIndex] = syncedInstallationVisit;
      visitsChanged = true;
    }
    if (visitsChanged) saveTechVisits(visits);
    const clickupTaskId = String(syncedInstallationVisit?.clickupTaskId || linkedQuote?.clickupTaskId || '').trim();
    if (clickupTaskId) {
      await attachOperationalCaseFilesToClickUpTask(clickupTaskId, {
        visit: syncedInstallationVisit,
        quote: linkedQuote,
        conformity,
      });
    }
  }

  res.json({ ok: true, conformity, emailDelivery: conformity.emailDelivery });
});

app.post('/api/mobile/warranties', mobileAppAuth, async (req, res) => {
  const body = req.body || {};
  const orderId = String(body.installationOrderId || '').trim();
  const quoteId = String(body.quoteId || '').trim();
  const clientEmail = normalizeEmail(body.clientEmail || '');
  const pdfBase64 = String(body.pdfBase64 || '').trim();
  if (clientEmail && !isValidEmail(clientEmail)) return res.status(400).json({ error: 'Correo inválido' });

  const orders = readJSON(files.installationOrders, []);
  const orderIndex = orderId
    ? orders.findIndex((item) => item.id === orderId && (!quoteId || item.quoteId === quoteId))
    : -1;
  if (orderId && orderIndex < 0) return res.status(404).json({ error: 'Orden no encontrada' });
  if (!orderId && !quoteId && !String(body.clientName || '').trim()) {
    return res.status(400).json({ error: 'Completa al menos los datos básicos del cliente.' });
  }

  const quotes = readJSON(files.quotes, []);
  const quoteIndex = quoteId ? quotes.findIndex((item) => String(item.id || '').trim() === quoteId) : -1;
  const quote = quoteIndex >= 0 ? normalizeStoredQuote(quotes[quoteIndex]) : null;
  const warrantyId = body.id || `GAR-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const persistedPdf = persistPdfToQuotesDir({ id: warrantyId, label: 'APP-GARANTIA', pdfBase64 });
  const fallbackPdfUrl = String(body.pdfUrl || '').trim();
  const warranty = normalizeWarrantyRecord({
    id: warrantyId,
    warrantyCode: String(body.warrantyCode || buildWarrantyCode(orderId || quoteId || String(body.clientName || 'EVINKA'))).trim(),
    validUntil: String(body.validUntil || warrantyValidUntil(body.date || new Date().toISOString())).trim(),
    installationOrderId: orderId,
    quoteId,
    countryCode: resolveRecordCountryCode(body.countryCode, orders[orderIndex]?.countryCode, quote?.countryCode, body.address, clientEmail),
    clientName: String(body.clientName || orders[orderIndex]?.clientName || quote?.clientName || '').trim(),
    clientEmail,
    clientDocument: String(body.clientDocument || body.ruc || orders[orderIndex]?.ruc || quote?.ruc || '').trim(),
    address: String(body.address || orders[orderIndex]?.address || quote?.clientAddress || '').trim(),
    chargerBrand: String(body.chargerBrand || orders[orderIndex]?.chargerBrand || quote?.charger?.label || 'GENERAL').trim(),
    serialNumber: String(body.serialNumber || orders[orderIndex]?.serialNumber || quote?.serialNumber || '').trim(),
    voltage: String(body.voltage || orders[orderIndex]?.voltage || quote?.voltage || '').trim(),
    amperage: String(body.amperage || orders[orderIndex]?.amperage || quote?.current || '').trim(),
    powerKw: String(body.powerKw || orders[orderIndex]?.powerKw || quote?.powerKw || '').trim(),
    installerSignatureUrl: String(body.installerSignatureUrl || '').trim(),
    clientSignatureUrl: String(body.clientSignatureUrl || '').trim(),
    pdfUrl: persistedPdf.pdfUrl || fallbackPdfUrl,
    pdfPath: persistedPdf.pdfPath || fallbackPdfUrl,
    pdfFilename: persistedPdf.pdfFilename,
    pdfBase64,
    status: String(body.status || 'warranty_generated').trim(),
    createdAt: new Date().toISOString(),
    createdBy: 'mobile_app',
  });
  warranty.whatsappDelivery = await deliverWarrantyWhatsApp({ warranty, quote });

  const warranties = readJSON(files.warranties, []);
  const warrantyIndex = warranties.findIndex((item) => String(item.id || '').trim() === warranty.id);
  if (warrantyIndex >= 0) {
    warranties[warrantyIndex] = warranty;
  } else {
    warranties.push(warranty);
  }
  writeJSON(files.warranties, warranties);

  const warrantyPdfUrl = warranty.pdfUrl || `/api/warranties/${encodeURIComponent(warranty.id)}/pdf`;
  const conformities = readJSON(files.conformities, []);
  const conformityIndex = conformities.findIndex((item) => (
    (orderId && String(item.installationOrderId || '').trim() === orderId)
    || (quoteId && String(item.quoteId || '').trim() === quoteId)
  ));
  if (conformityIndex >= 0) {
    const currentConformity = normalizeConformityRecord(conformities[conformityIndex]);
    conformities[conformityIndex] = {
      ...currentConformity,
      warrantyId: warranty.id,
      warrantyCode: warranty.warrantyCode,
      warrantyValidUntil: warranty.validUntil,
      warrantyPdfUrl,
    };
    writeJSON(files.conformities, conformities);
  }

  if (orderIndex >= 0) {
    orders[orderIndex] = {
      ...orders[orderIndex],
      warrantyId: warranty.id,
      warrantyCode: warranty.warrantyCode,
      warrantyValidUntil: warranty.validUntil,
      warrantyPdfUrl,
      updatedAt: new Date().toISOString(),
    };
    writeJSON(files.installationOrders, orders);
  }

  if (quoteIndex >= 0) {
    quotes[quoteIndex] = {
      ...quote,
      warrantyId: warranty.id,
      warrantyCode: warranty.warrantyCode,
      warrantyValidUntil: warranty.validUntil,
      warrantyPdfUrl,
    };
    writeJSON(files.quotes, quotes);
  }

  const installationVisits = readJSON(files.techVisits, []).map(normalizeTechVisit);
  let linkedVisit = installationVisits.find((item) => item.type === 'instalacion'
    && ((orderId && String(item.installationOrderId || '').trim() === orderId)
      || (quoteId && String(item.quoteId || '').trim() === quoteId))) || null;
  let clickupSync = null;
  if (linkedVisit) {
    clickupSync = await syncTechVisitToClickUp(linkedVisit, { quote });
    linkedVisit = normalizeTechVisit({
      ...linkedVisit,
      clickupTaskId: clickupSync.taskId || linkedVisit.clickupTaskId || quote?.clickupTaskId || '',
      clickupTaskUrl: clickupSync.taskUrl || linkedVisit.clickupTaskUrl || '',
      clickupSyncedAt: clickupSync.syncedAt || linkedVisit.clickupSyncedAt || '',
      clickupSyncError: clickupSync.ok ? '' : String(clickupSync.error || linkedVisit.clickupSyncError || '').trim(),
    });
    const allVisits = readJSON(files.techVisits, []);
    const visitIndex = allVisits.findIndex((item) => String(item.id || '').trim() === linkedVisit.id);
    if (visitIndex >= 0) {
      allVisits[visitIndex] = linkedVisit;
      saveTechVisits(allVisits);
    }
    if (quoteIndex >= 0 && clickupSync.taskId && quote?.clickupTaskId !== clickupSync.taskId) {
      quotes[quoteIndex] = {
        ...quote,
        clickupTaskId: clickupSync.taskId,
      };
      writeJSON(files.quotes, quotes);
    }
  }
  const mobileWarrantyClickUpTaskId = String(linkedVisit?.clickupTaskId || clickupSync?.taskId || quote?.clickupTaskId || '').trim();
  if (mobileWarrantyClickUpTaskId) {
    await attachOperationalCaseFilesToClickUpTask(mobileWarrantyClickUpTaskId, {
      visit: linkedVisit,
      quote,
      warranty,
    });
  }

  res.json({ ok: true, warranty });
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'No encontrado' });
  res.type('html').send(fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8'));
});

globalThis.__EVINKA_PDF_GENERATORS = {
  createPdf,
  createConformityPdfBuffer,
  createWarrantyPdfBuffer,
};

if (!process.env.EVINKA_SKIP_LISTEN) {
  app.listen(PORT, () => {
    console.log(`Cotizador EVINKA listo en http://localhost:${PORT}`);
  });
}

function authOptional(req, res, next) {
  const token = parseCookie(req.headers.cookie || '')[COOKIE_NAME];
  if (token) {
    const sessions = readJSON(files.sessions, {});
    const session = resolveActiveSession(sessions, token);
    if (!session && sessions[token]) {
      delete sessions[token];
      writeJSON(files.sessions, sessions);
      res.clearCookie(COOKIE_NAME);
    }
    if (session) {
      const user = readUsers().find((u) => u.id === session.userId && u.status === 'active');
      if (user) req.user = user;
    }
  }
  next();
}

function resolveActiveSession(sessions = {}, token = '') {
  const session = sessions?.[token];
  if (!session) return null;
  const expiresAt = Date.parse(String(session.expiresAt || ''));
  if (Number.isFinite(expiresAt)) {
    return expiresAt > Date.now() ? session : null;
  }
  const createdAt = Date.parse(String(session.createdAt || ''));
  if (!Number.isFinite(createdAt)) return null;
  return (createdAt + SESSION_MAX_AGE_MS) > Date.now() ? session : null;
}

function authRequired(req, res, next) {
  authOptional(req, res, () => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    next();
  });
}

function mobileAppAuth(req, res, next) {
  const provided = String(req.headers['x-evinka-app-key'] || '').trim();
  if (!provided || provided !== MOBILE_APP_API_KEY) {
    return res.status(401).json({ error: 'App no autorizada' });
  }
  next();
}

function internalBotAuth(req, res, next) {
  const provided = String(req.headers['x-evinka-bot-key'] || '').trim();
  if (!provided || provided !== BOT_VISITS_API_KEY) {
    return res.status(401).json({ error: 'Bot no autorizado' });
  }
  next();
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Solo admin' });
  next();
}

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    employeeCode: user.employeeCode || '',
    notificationPhone: user.notificationPhone || '',
    hasPin: Boolean(user.pinHash),
    pinUpdatedAt: user.pinUpdatedAt || '',
    role: user.role,
    status: user.status || 'active',
    requestedAt: user.requestedAt || '',
    accessGrantedAt: user.accessGrantedAt || '',
    allowedCountries: Array.isArray(user.allowedCountries) ? user.allowedCountries : [],
    allowedQueues: Array.isArray(user.allowedQueues) ? user.allowedQueues : [],
    approvedBy: user.approvedBy ? {
      id: user.approvedBy.id,
      name: user.approvedBy.name,
      email: user.approvedBy.email,
      role: user.approvedBy.role,
    } : null,
  };
}

function safeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function splitCsv(value = '') {
  return String(value || '')
    .split(',')
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function findOperationalRecipient({ email = '', name = '' } = {}) {
  const users = readUsers();
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = String(name || '').trim().toLowerCase();
  if (normalizedEmail) {
    const byEmail = users.find((item) => normalizeEmail(item.email) === normalizedEmail);
    if (byEmail) return byEmail;
  }
  if (normalizedName) {
    const byName = users.find((item) => String(item.name || '').trim().toLowerCase() === normalizedName);
    if (byName) return byName;
  }
  return null;
}

function buildRecipientEntry({ name = '', email = '', phone = '', role = '', clickupUserId = '', source = '' } = {}) {
  return {
    name: String(name || '').trim(),
    email: normalizeEmail(email || ''),
    phone: String(phone || '').trim(),
    role: String(role || '').trim(),
    clickupUserId: String(clickupUserId || '').trim(),
    source: String(source || '').trim(),
  };
}

function dedupeRecipients(entries = []) {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = [normalizeEmail(entry.email), String(entry.phone || '').trim(), String(entry.name || '').trim().toLowerCase()].join('|');
    if (!key.replace(/\|/g, '')) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolveMilestoneRecipients(kind = '') {
  const users = readUsers();
  const raul = findOperationalRecipient({ email: RAUL_DEFAULT_EMAIL, name: 'Raul Flores' });
  const antonio = findOperationalRecipient({ email: 'antonio.milla@evinka.tech', name: 'ANTONIO' });
  const sebastianName = process.env.EVINKA_NOTIFY_SEBASTIAN_NAME || 'Sebastián';
  const mirkoName = process.env.EVINKA_NOTIFY_MIRKO_NAME || 'Mirko';
  const sebastian = findOperationalRecipient({ email: process.env.EVINKA_NOTIFY_SEBASTIAN_EMAIL || '', name: sebastianName });
  const mirko = findOperationalRecipient({ email: process.env.EVINKA_NOTIFY_MIRKO_EMAIL || '', name: mirkoName });
  if (kind === 'abono_50') {
    return dedupeRecipients([
      buildRecipientEntry({
        name: sebastian?.name || sebastianName,
        email: sebastian?.email || process.env.EVINKA_NOTIFY_SEBASTIAN_EMAIL || '',
        phone: sebastian?.notificationPhone || process.env.EVINKA_NOTIFY_SEBASTIAN_PHONE || '',
        role: sebastian?.role || 'finanzas',
        clickupUserId: process.env.EVINKA_NOTIFY_SEBASTIAN_CLICKUP_USER_ID || '',
        source: sebastian ? 'users.json' : 'env',
      }),
      buildRecipientEntry({
        name: mirko?.name || mirkoName,
        email: mirko?.email || process.env.EVINKA_NOTIFY_MIRKO_EMAIL || '',
        phone: mirko?.notificationPhone || process.env.EVINKA_NOTIFY_MIRKO_PHONE || '',
        role: mirko?.role || 'finanzas',
        clickupUserId: process.env.EVINKA_NOTIFY_MIRKO_CLICKUP_USER_ID || '',
        source: mirko ? 'users.json' : 'env',
      }),
    ]);
  }
  if (kind === 'conformity_done') {
    return dedupeRecipients([
      buildRecipientEntry({
        name: raul?.name || 'Raul Flores',
        email: raul?.email || RAUL_DEFAULT_EMAIL,
        phone: raul?.notificationPhone || RAUL_DEFAULT_PHONE,
        role: raul?.role || 'kam_b2c',
        clickupUserId: process.env.EVINKA_NOTIFY_RAUL_CLICKUP_USER_ID || '',
        source: raul ? 'users.json' : 'default',
      }),
      buildRecipientEntry({
        name: antonio?.name || 'Antonio',
        email: antonio?.email || '',
        phone: antonio?.notificationPhone || '',
        role: antonio?.role || 'kam_b2c',
        source: antonio ? 'users.json' : '',
      }),
    ]);
  }
  if (kind === 'b2b_priority') {
    return dedupeRecipients([
      buildRecipientEntry({
        name: antonio?.name || 'Antonio',
        email: antonio?.email || '',
        phone: antonio?.notificationPhone || '',
        role: antonio?.role || 'kam_b2c',
        source: antonio ? 'users.json' : '',
      }),
      buildRecipientEntry({
        name: raul?.name || 'Raul Flores',
        email: raul?.email || RAUL_DEFAULT_EMAIL,
        phone: raul?.notificationPhone || RAUL_DEFAULT_PHONE,
        role: raul?.role || 'kam_b2c',
        source: raul ? 'users.json' : 'default',
      }),
    ]);
  }
  return dedupeRecipients([]);
}

function appendOperationalAuditLog({
  actor = null,
  action = '',
  entityType = '',
  entityId = '',
  countryCode = '',
  status = 'success',
  summary = '',
  detail = {},
} = {}) {
  const logs = readJSON(files.auditLog, []);
  logs.push({
    id: `${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
    at: new Date().toISOString(),
    actor: actor ? safeUser(actor) : null,
    action: String(action || '').trim(),
    entityType: String(entityType || '').trim(),
    entityId: String(entityId || '').trim(),
    countryCode: normalizeCountryCode(countryCode || '') || '',
    status: String(status || 'success').trim(),
    summary: String(summary || '').trim(),
    detail: detail || {},
  });
  if (logs.length > AUDIT_LOG_LIMIT) {
    logs.splice(0, logs.length - AUDIT_LOG_LIMIT);
  }
  writeJSON(files.auditLog, logs);
}

function buildOperationalAuditFeed({ limit = 120, countryCode = '', entityType = '' } = {}) {
  const requestedCountry = normalizeCountryCode(countryCode || '');
  const requestedType = String(entityType || '').trim().toLowerCase();
  const events = readJSON(files.auditLog, [])
    .filter((item) => {
      if (requestedCountry && requestedCountry !== 'ALL' && normalizeCountryCode(item.countryCode || '') !== requestedCountry) return false;
      if (requestedType && requestedType !== 'all' && String(item.entityType || '').trim().toLowerCase() !== requestedType) return false;
      return true;
    })
    .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
    .slice(0, Math.max(1, Math.min(300, Number(limit) || 120)));
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      total: events.length,
      lastEventAt: events[0]?.at || null,
    },
    events,
  };
}

async function postClickUpTaskComment(taskId, text = '') {
  const commentText = String(text || '').trim();
  if (!CLICKUP_API_TOKEN || !taskId || !commentText) return { ok: false, skipped: true };
  try {
    await clickUpRequest('POST', `/task/${encodeURIComponent(taskId)}/comment`, {
      comment_text: commentText,
      notify_all: false,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function notifyOperationalRecipients({ recipients = [], subject = '', text = '', html = '', whatsappText = '', clickupTaskId = '', auditMeta = {} } = {}) {
  const normalizedRecipients = dedupeRecipients(recipients);
  const result = {
    email: [],
    whatsapp: [],
    clickup: [],
    skipped: [],
  };
  for (const recipient of normalizedRecipients) {
    if (mailer && recipient.email) {
      try {
        await mailer.sendMail({ to: [recipient.email], subject, text, html: html || `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;white-space:pre-wrap;">${escapeHtml(text)}</div>` });
        result.email.push(recipient.email);
      } catch (error) {
        result.skipped.push(`email:${recipient.email}:${error.message}`);
      }
    }
    const phone = normalizePhoneForWhatsApp(recipient.phone || '');
    if (meta && phone) {
      try {
        await meta.sendText(phone, whatsappText || text);
        result.whatsapp.push(`+${phone}`);
      } catch (error) {
        result.skipped.push(`whatsapp:${phone}:${error.message}`);
      }
    }
  }
  if (clickupTaskId) {
    const comment = await postClickUpTaskComment(clickupTaskId, text);
    if (comment.ok) result.clickup.push(clickupTaskId);
    else if (!comment.skipped) result.skipped.push(`clickup:${clickupTaskId}:${comment.error || 'unknown'}`);
  }
  appendOperationalAuditLog({
    actor: auditMeta.actor || null,
    action: auditMeta.action || 'notification_sent',
    entityType: auditMeta.entityType || 'notification',
    entityId: auditMeta.entityId || clickupTaskId || '',
    countryCode: auditMeta.countryCode || '',
    summary: auditMeta.summary || subject,
    detail: {
      recipients: normalizedRecipients,
      result,
      clickupTaskId,
      ...auditMeta.detail,
    },
  });
  return result;
}

async function notifyAbono50Milestone({ quote, actor = null } = {}) {
  const recipients = resolveMilestoneRecipients('abono_50');
  if (!recipients.length) return { ok: false, skipped: true, reason: 'no_recipients' };
  const amount = safeNumber(quote?.initialPayment?.amount, safeNumber(quote?.total, 0) * 0.5);
  const observation = String(quote?.initialPayment?.observation || '').trim() || 'Abono 50% confirmado desde EVINKA.';
  return notifyOperationalRecipients({
    recipients,
    subject: `EVINKA · Abono 50% confirmado · ${quote?.clientName || 'Cliente'}`,
    text: [
      `Cliente: ${quote?.clientName || '-'}`,
      `Cotización: ${quote?.id || '-'}`,
      `Monto: ${amount || 0}`,
      `Observación: ${observation}`,
      `Contacto: ${quote?.phone || '-'}`,
    ].join('\n'),
    whatsappText: `EVINKA ⚡\nAbono 50% confirmado\nCliente: ${quote?.clientName || '-'}\nCotización: ${quote?.id || '-'}\nMonto: ${amount || 0}\nTeléfono: ${quote?.phone || '-'}`,
    clickupTaskId: String(quote?.clickupTaskId || '').trim(),
    auditMeta: {
      actor,
      action: 'abono_50_notified',
      entityType: 'payment',
      entityId: quote?.id || '',
      countryCode: quote?.countryCode || '',
      summary: `Abono 50% notificado para ${quote?.clientName || quote?.id || 'cliente'}`,
    },
  });
}

async function notifyConformityMilestone({ conformity, quote = null, actor = null } = {}) {
  const recipients = resolveMilestoneRecipients('conformity_done');
  if (!recipients.length) return { ok: false, skipped: true, reason: 'no_recipients' };
  return notifyOperationalRecipients({
    recipients,
    subject: `EVINKA · Instalación / conformidad finalizada · ${conformity?.clientName || quote?.clientName || 'Cliente'}`,
    text: [
      'La conformidad quedó generada y enviada.',
      `Cliente: ${conformity?.clientName || quote?.clientName || '-'}`,
      `Orden: ${conformity?.installationOrderId || quote?.installationOrderId || '-'}`,
      `Cotización: ${conformity?.quoteId || quote?.id || '-'}`,
      `Contacto: ${conformity?.clientEmail || quote?.email || '-'} / ${quote?.phone || '-'}`,
    ].join('\n'),
    whatsappText: `EVINKA ⚡\nConformidad finalizada\nCliente: ${conformity?.clientName || quote?.clientName || '-'}\nOrden: ${conformity?.installationOrderId || quote?.installationOrderId || '-'}\nCotización: ${conformity?.quoteId || quote?.id || '-'}`,
    clickupTaskId: String(quote?.clickupTaskId || '').trim(),
    auditMeta: {
      actor,
      action: 'conformity_notified',
      entityType: 'conformity',
      entityId: conformity?.id || conformity?.installationOrderId || '',
      countryCode: conformity?.countryCode || quote?.countryCode || '',
      summary: `Conformidad notificada para ${conformity?.clientName || quote?.clientName || 'cliente'}`,
    },
  });
}

function publicConfig(countryCode = 'PE') {
  const activeCountry = normalizeCountryCode(countryCode) || 'ALL';
  const config = buildAppConfig(activeCountry);
  return {
    company: config.company,
    currency: config.currency,
    defaults: config.defaults,
    commercialProfiles: config.commercialProfiles,
    harCatalogs: config.harCatalogs,
    roles: config.roles,
    roleDefinitions: config.roleDefinitions,
    activeCountry,
    countries: COUNTRY_DEFINITIONS,
  };
}

function normalizeQuoteStatus(value) {
  const status = String(value || 'cotizada').trim().toLowerCase();
  const aliases = {
    emitida: 'cotizada',
    aceptada: 'aceptada_cliente',
  };
  const normalized = aliases[status] || status;
  const allowed = new Set(['cotizada', 'lista_envio', 'recotizar', 'cancelada', 'aceptada_cliente', 'instalada', 'abono_100_confirmado']);
  return allowed.has(normalized) ? normalized : 'cotizada';
}

function normalizeStoredQuote(quote = {}) {
  const commercialProfileId = slugProfileId(quote?.commercialProfile?.id || quote?.commercialProfileId || quote?.commercialProfile?.name || 'general');
  const commercialProfileName = String(quote?.commercialProfile?.name || quote?.commercialProfileName || 'GENERAL').trim() || 'GENERAL';
  return {
    ...quote,
    clientDocument: String(quote?.clientDocument || quote?.ruc || '').trim(),
    countryCode: quoteCountryCode(quote),
    customerSegment: inferCustomerSegment(quote),
    commercialProfileId,
    commercialProfileName,
    commercialProfile: {
      ...(quote?.commercialProfile || {}),
      id: commercialProfileId,
      name: commercialProfileName,
    },
    pdfTemplate: resolveQuotePdfTemplate({
      ...quote,
      commercialProfileId,
      commercialProfileName,
      commercialProfile: {
        ...(quote?.commercialProfile || {}),
        id: commercialProfileId,
        name: commercialProfileName,
      },
    }),
    status: normalizeQuoteStatus(quote?.status || 'cotizada'),
    conformityStatus: String(quote?.conformityStatus || 'not_started').trim(),
    initialPayment: quote?.initialPayment && typeof quote.initialPayment === 'object'
      ? {
          confirmedAt: String(quote.initialPayment.confirmedAt || quote.clientAcceptedAt || '').trim(),
          amount: safeNumber(quote.initialPayment.amount, safeNumber(quote.total, 0) * 0.5),
          observation: String(quote.initialPayment.observation || '').trim(),
          confirmedBy: quote.initialPayment.confirmedBy ? safeUser(quote.initialPayment.confirmedBy) : (quote.clientAcceptedBy ? safeUser(quote.clientAcceptedBy) : null),
        }
      : {
          confirmedAt: String(quote.clientAcceptedAt || '').trim(),
          amount: safeNumber(quote.total, 0) * 0.5,
          observation: '',
          confirmedBy: quote.clientAcceptedBy ? safeUser(quote.clientAcceptedBy) : null,
        },
    finalPayment: quote?.finalPayment && typeof quote.finalPayment === 'object'
      ? {
          confirmedAt: String(quote.finalPayment.confirmedAt || '').trim(),
          amount: safeNumber(quote.finalPayment.amount, safeNumber(quote.total, 0)),
          observation: String(quote.finalPayment.observation || '').trim(),
          confirmedBy: quote.finalPayment.confirmedBy ? safeUser(quote.finalPayment.confirmedBy) : null,
        }
      : {
          confirmedAt: '',
          amount: safeNumber(quote.total, 0),
          observation: '',
          confirmedBy: null,
        },
  };
}

function normalizeCustomerSegment(value = '') {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['b2b', 'empresa', 'empresas', 'corporativo', 'corporativa', 'corporate', 'business'].includes(normalized)) return 'b2b';
  if (['b2c', 'cliente', 'clientes', 'residencial', 'consumer', 'particular'].includes(normalized)) return 'b2c';
  return '';
}

function inferCustomerSegment(record = {}) {
  const explicit = normalizeCustomerSegment(
    record?.customerSegment
    || record?.customerType
    || record?.segment
    || record?.clientSegment
    || record?.tipo_cliente
    || record?.tipoCliente,
  );
  if (explicit) return explicit;

  const companyName = String(record?.companyName || record?.nombre_empresa || '').trim();
  if (companyName) return 'b2b';

  const haystack = [
    record?.clientType,
    record?.notes,
    record?.summary,
    record?.resumen,
    record?.motivoHandoff,
    record?.motivo_handoff,
    record?.intencion_principal,
    record?.subestado_flujo,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/\b(b2b|empresa|empresas|corporativ|corporate|dealer|flota|cuenta corporativa|contacto corporativo)\b/.test(haystack)) {
    return 'b2b';
  }

  return 'b2c';
}

function userRequiresB2BVisitScope(user = {}) {
  return normalizeManagedUserRole(user?.role || '') === 'kam_b2b';
}

function canUserAccessVisitSegment(user = {}, visit = {}) {
  if (!userRequiresB2BVisitScope(user)) return true;
  return inferCustomerSegment(visit) === 'b2b';
}

function normalizeTechVisitStatus(value) {
  const status = String(value || 'pendiente').trim().toLowerCase();
  const allowed = new Set(['pendiente', 'agendada', 'en_ruta', 'en_visita', 'visitada', 'cotizada', 'lista_envio', 'aceptada_cliente', 'cancelada', 'pendiente_cotizacion', 'pendiente_conformidad', 'pendiente_cierre', 'reprogramada', 'cerrada', 'recotizar']);
  return allowed.has(status) ? status : 'pendiente';
}

async function syncTechVisitsFromCalendar() {
  const stored = readJSON(files.techVisits, []).map(normalizeTechVisit);
  if (!liveBookingsSb) return stored;

  const now = new Date();
  const start = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000));
  const end = new Date(now.getTime() + (45 * 24 * 60 * 60 * 1000));
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);

  let rows = [];
  try {
    rows = await liveBookingsSb.select(
      'citas',
      [
        'select=codigo_cita,fecha_cita,fecha_hora_inicio,hora_inicio,etiqueta_horario,nombre_cliente,telefono_cliente,dni_cliente,correo_cliente,direccion_cita,distrito_cita,provincia_cita,estado_cita,observaciones,microsoft_event_id,confirmada_en,actualizado_en',
        `fecha_cita=gte.${startDate}`,
        `fecha_cita=lte.${endDate}`,
        'estado_cita=in.(confirmada,reprogramada)',
        'order=fecha_hora_inicio.asc',
        'limit=400',
      ].join('&'),
    );
  } catch (error) {
    console.error('syncTechVisitsFromCalendar failed:', error);
    return stored;
  }

  const techs = readUsers().filter((user) => isTechAssignableUser(user) && user.status === 'active');
  const defaultTech = techs.find((user) => normalizeEmail(user.email) === TECH_VISITS_DEFAULT_EMAIL)
    || techs.find((user) => normalizeEmail(user.email) === 'luis.campos@evinka.tech')
    || techs[0]
    || { email: TECH_VISITS_DEFAULT_EMAIL, name: TECH_VISITS_DEFAULT_NAME };

  const persistentVisits = stored.filter(shouldPersistVisitOutsideLiveSync);
  const liveStoredVisits = stored.filter((visit) => isLiveSyncedVisit(visit));
  const existingLiveByReference = new Map(
    liveStoredVisits
      .filter((visit) => visit.reference)
      .map((visit) => [visit.reference, visit]),
  );
  const next = [...persistentVisits];
  const indexByReference = new Map(
    next.filter((visit) => visit.reference).map((visit, index) => [visit.reference, index]),
  );
  const seenReferences = new Set();
  let changed = stored.length !== persistentVisits.length;

  for (const row of rows) {
    const reference = String(row.codigo_cita || '').trim();
    const synced = buildTechVisitFromCalendarBooking(
      row,
      existingLiveByReference.get(reference),
      defaultTech,
    );
    if (!synced) continue;
    seenReferences.add(synced.reference);
    const existingIndex = indexByReference.get(synced.reference);
    if (existingIndex == null) {
      next.push(synced);
      indexByReference.set(synced.reference, next.length - 1);
      changed = true;
      continue;
    }
    const previous = normalizeTechVisit(next[existingIndex]);
    if (JSON.stringify(previous) != JSON.stringify(synced)) {
      next[existingIndex] = synced;
      changed = true;
    }
  }

  for (const visit of liveStoredVisits) {
    if (!visit.reference || seenReferences.has(visit.reference)) continue;
    changed = true;
  }

  if (changed) {
    saveTechVisits(next);
  }
  return next.map(normalizeTechVisit);
}

function isLiveSyncedVisit(visit = {}) {
  return ['calendar', 'chatbot'].includes(String(visit.source || '').trim().toLowerCase());
}

function shouldPersistVisitOutsideLiveSync(visit = {}) {
  const normalized = normalizeTechVisit(visit);
  if (!isLiveSyncedVisit(normalized)) return true;
  return false;
}

function buildTechVisitFromCalendarBooking(row = {}, existing, defaultTech = {}) {
  const reference = String(row.codigo_cita || '').trim();
  if (!reference) return null;
  const current = existing ? normalizeTechVisit(existing) : null;
  const address = [row.direccion_cita, row.distrito_cita, row.provincia_cita]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
  const generatedNotes = [
    `Visita sincronizada automáticamente desde agenda EVINKA. Ticket ${reference}.`,
    row.observaciones ? `Agenda: ${String(row.observaciones).trim()}` : '',
  ].filter(Boolean).join('\n');
  const preserveProgress = current && (
    current.quoteId || current.installationOrderId || ['cotizada', 'lista_envio', 'aceptada_cliente', 'pendiente_conformidad', 'pendiente_cierre', 'en_ruta', 'en_visita', 'visitada', 'cerrada', 'cancelada', 'recotizar'].includes(current.status)
  );
  const scheduledAt = String(row.fecha_hora_inicio || '').trim()
    || buildIsoFromBooking(row.fecha_cita, row.hora_inicio);
  const assignedEmail = normalizeEmail(current?.assignedTechEmail || defaultTech.email || TECH_VISITS_DEFAULT_EMAIL);
  const assignedName = String(current?.assignedTechName || defaultTech.name || TECH_VISITS_DEFAULT_NAME).trim();

  return normalizeTechVisit({
    id: current?.id || `VIS-CAL-${crypto.createHash('md5').update(reference).digest('hex').slice(0, 10).toUpperCase()}`,
    source: current?.source || 'calendar',
    type: current?.type || 'visita_tecnica',
    status: preserveProgress ? current.status : mapBookingStatusToVisitStatus(row.estado_cita),
    clientName: String(row.nombre_cliente || current?.clientName || '').trim(),
    clientPhone: String(row.telefono_cliente || current?.clientPhone || '').trim(),
    clientDocument: String(row.dni_cliente || current?.clientDocument || '').trim(),
    clientEmail: normalizeEmail(row.correo_cliente || current?.clientEmail || ''),
    clientAddress: address || current?.clientAddress || '',
    customerSegment: current?.customerSegment || inferCustomerSegment(current || {}),
    scheduledAt,
    timeWindow: String(row.etiqueta_horario || current?.timeWindow || '').trim(),
    notes: current?.notes || generatedNotes,
    resolution: current?.resolution || '',
    reference,
    quoteId: String(current?.quoteId || '').trim(),
    installationOrderId: String(current?.installationOrderId || '').trim(),
    assignedTechEmail: assignedEmail,
    assignedTechName: assignedName,
    checklist: current?.checklist?.length ? current.checklist : buildAutoChecklistForVisit({
      ...current,
      reference,
      status: preserveProgress ? current?.status : mapBookingStatusToVisitStatus(row.estado_cita),
      quoteId: String(current?.quoteId || '').trim(),
      installationOrderId: String(current?.installationOrderId || '').trim(),
    }),
    createdAt: current?.createdAt || String(row.confirmada_en || row.actualizado_en || new Date().toISOString()).trim(),
    updatedAt: String(row.actualizado_en || row.confirmada_en || current?.updatedAt || new Date().toISOString()).trim(),
    startedAt: current?.startedAt || '',
    closedAt: current?.closedAt || '',
    clickupTaskId: current?.clickupTaskId || '',
    clickupTaskUrl: current?.clickupTaskUrl || '',
    clickupSyncedAt: current?.clickupSyncedAt || '',
    clickupSyncError: current?.clickupSyncError || '',
    updatedBy: current?.updatedBy || null,
  });
}

function buildIsoFromBooking(dateValue, timeValue) {
  const date = String(dateValue || '').trim();
  const time = String(timeValue || '').trim();
  if (!date || !time) return '';
  return `${date}T${time}-05:00`;
}

function mapBookingStatusToVisitStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  if (status === 'reprogramada') return 'reprogramada';
  return 'agendada';
}

function buildAutoChecklistForVisit(visit = {}) {
  const normalized = normalizeTechVisitStatus(visit.status);
  const list = [];
  if (String(visit.reference || '').trim()) list.push('Visita creada');
  if (String(visit.quoteId || '').trim()) list.push('Cotización creada');
  if (['lista_envio', 'aceptada_cliente', 'agendada', 'en_ruta', 'en_visita', 'visitada', 'pendiente_conformidad', 'pendiente_cierre', 'cerrada'].includes(normalized)) {
    list.push('Cotización confirmada');
  }
  if (['aceptada_cliente', 'agendada', 'en_ruta', 'en_visita', 'visitada', 'pendiente_conformidad', 'pendiente_cierre', 'cerrada'].includes(normalized)) {
    list.push('Cliente acepta');
  }
  if (['agendada', 'en_ruta', 'en_visita', 'visitada', 'pendiente_conformidad', 'pendiente_cierre', 'cerrada'].includes(normalized)) {
    list.push('Cita agendada');
  }
  if (['en_ruta', 'en_visita', 'visitada', 'pendiente_conformidad', 'pendiente_cierre', 'cerrada'].includes(normalized)) {
    list.push('Técnico en ruta');
  }
  if (['en_visita', 'visitada', 'pendiente_conformidad', 'pendiente_cierre', 'cerrada'].includes(normalized)) {
    list.push('Técnico en visita');
  }
  if (String(visit.installationOrderId || '').trim() && ['pendiente_conformidad', 'pendiente_cierre', 'visitada', 'cerrada'].includes(normalized)) {
    list.push('Conformidad lista');
  }
  if (normalized === 'pendiente_cierre') list.push('Conformidad generada');
  if (normalized === 'cerrada') list.push('Visita cerrada');
  return list;
}

function saveTechVisits(visits) {
  writeJSON(files.techVisits, visits.map((visit) => normalizeTechVisit(visit)));
}

function findTechVisitIndexByQuoteId(visits, quoteId) {
  return visits.findIndex((item) => String(item.quoteId || '').trim() === String(quoteId || '').trim());
}

function findTechVisitIndex(visits, { visitId, quoteId, reference } = {}) {
  if (visitId) {
    const byId = visits.findIndex((item) => item.id === visitId);
    if (byId >= 0) return byId;
  }
  if (quoteId) {
    const byQuote = findTechVisitIndexByQuoteId(visits, quoteId);
    if (byQuote >= 0) return byQuote;
  }
  if (reference) {
    const byReference = visits.findIndex((item) => String(item.reference || '').trim() === String(reference || '').trim());
    if (byReference >= 0) return byReference;
  }
  return -1;
}

function normalizePhoneForWhatsApp(value) {
  const digits = String(value || '').replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.startsWith('51')) return digits;
  if (digits.length === 9) return `51${digits}`;
  return digits;
}

async function notifyVisitOnTheWay(visit = {}) {
  const messages = [];
  const clientName = formatDisplayName(visit.clientName) || 'cliente';
  const when = buildVisitTimeLabel(visit);
  const address = visit.clientAddress || 'tu dirección registrada';
  const isInstallation = String(visit.type || '').trim() === 'instalacion';
  const serviceLabel = isInstallation
    ? 'la instalación programada'
    : 'la visita de evaluación programada';
  const text = `Hola ${clientName}, tu técnico EVINKA ya va en camino para ${serviceLabel} (${when}). Dirección: ${address}.`;
  if (meta) {
    const phone = normalizePhoneForWhatsApp(visit.clientPhone);
    if (phone) {
      try {
        await meta.sendText(phone, `${text}\n\nEVINKA ⚡`);
        messages.push(`WhatsApp enviado a ${phone}`);
      } catch (error) {
        messages.push(`WhatsApp falló: ${error.message}`);
      }
    }
  }
  if (mailer && visit.clientEmail) {
    try {
      await mailer.sendMail({
        to: [visit.clientEmail],
        subject: isInstallation
          ? 'EVINKA · Tu técnico ya va en camino para la instalación'
          : 'EVINKA · Tu técnico ya va en camino para la evaluación',
        text: `${text}\n\nGracias por confiar en EVINKA.`,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;"><p>${escapeHtml(text)}</p><p>Gracias por confiar en <strong>EVINKA</strong>.</p></div>`,
      });
      messages.push(`Correo enviado a ${visit.clientEmail}`);
    } catch (error) {
      messages.push(`Correo falló: ${error.message}`);
    }
  }
  return messages;
}

function normalizeTechVisit(visit = {}) {
  return {
    id: String(visit.id || '').trim(),
    source: String(visit.source || 'chatbot').trim() || 'chatbot',
    type: String(visit.type || 'visita_tecnica').trim() || 'visita_tecnica',
    countryCode: visitCountryCode(visit),
    status: normalizeTechVisitStatus(visit.status),
    clientName: String(visit.clientName || '').trim(),
    clientPhone: String(visit.clientPhone || '').trim(),
    clientDocument: String(visit.clientDocument || visit.ruc || '').trim(),
    clientEmail: normalizeEmail(visit.clientEmail || ''),
    clientAddress: String(visit.clientAddress || '').trim(),
    customerSegment: inferCustomerSegment(visit),
    scheduledAt: String(visit.scheduledAt || '').trim(),
    timeWindow: String(visit.timeWindow || '').trim(),
    notes: String(visit.notes || '').trim(),
    resolution: String(visit.resolution || '').trim(),
    reference: String(visit.reference || '').trim(),
    quoteId: String(visit.quoteId || '').trim(),
    installationOrderId: String(visit.installationOrderId || '').trim(),
    assignedTechEmail: normalizeEmail(visit.assignedTechEmail || ''),
    assignedTechName: String(visit.assignedTechName || '').trim(),
    checklist: (() => {
      const provided = Array.isArray(visit.checklist)
        ? visit.checklist.map((item) => String(item || '').trim()).filter(Boolean)
        : [];
      return provided.length ? provided : buildAutoChecklistForVisit(visit);
    })(),
    createdAt: String(visit.createdAt || new Date().toISOString()).trim(),
    updatedAt: String(visit.updatedAt || visit.createdAt || new Date().toISOString()).trim(),
    startedAt: String(visit.startedAt || '').trim(),
    closedAt: String(visit.closedAt || '').trim(),
    clickupTaskId: String(visit.clickupTaskId || '').trim(),
    clickupTaskUrl: String(visit.clickupTaskUrl || '').trim(),
    clickupSyncedAt: String(visit.clickupSyncedAt || '').trim(),
    clickupSyncError: String(visit.clickupSyncError || '').trim(),
    updatedBy: visit.updatedBy ? safeUser(visit.updatedBy) : null,
  };
}

function buildInstallationOrderFromQuote(quote, user, options = {}) {
  const date = new Date();
  const orderId = `ORD-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${displayQuoteNumber(quote.id)}`;
  const assignedTechnicianName = displayAdvisorName(options.assignedTechnician || user?.name);
  const assignedTechEmail = normalizeEmail(options.assignedTechEmail || user?.email || '');
  const address = String(options.address || quote.address || quote.clientAddress || quote.city || '').trim();
  return {
    id: orderId,
    quoteId: quote.id,
    countryCode: resolveRecordCountryCode(options.countryCode, quote.countryCode, quote.city, address, quote.email),
    quoteNumber: displayQuoteNumber(quote.id),
    clientName: quote.clientName || '',
    clientEmail: quote.email || '',
    clientDocument: String(quote.clientDocument || quote.ruc || '').trim(),
    city: quote.city || '',
    address,
    installationType: quote.installationType || '',
    propertyType: quote.propertyType || '',
    commercialProfileId: quote.commercialProfile?.id || 'general',
    commercialProfileName: quote.commercialProfile?.name || 'GENERAL',
    advisorName: displayAdvisorName(user?.name || quote.createdBy?.name),
    assignedTechnician: assignedTechnicianName,
    assignedTechEmail,
    quotePdfUrl: quote.pdfPath || '',
    quoteTotal: quote.total || 0,
    chargerBrand: quote.commercialProfile?.name || '',
    voltage: String(quote.voltage || ''),
    amperage: String(quote.current || ''),
    powerKw: '',
    status: 'pendiente_instalacion',
    conformityStatus: 'not_started',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildAppConfig(countryCode = 'PE') {
  const activeCountry = normalizeCountryCode(countryCode) || 'ALL';
  const stored = readJSON(files.config, defaultConfig());
  if (activeCountry === 'ALL') {
    const roleMatrix = getRoleMatrix();
    return {
      company: {
        name: 'EVINKA Admin Center',
        tagline: 'Panel global de operación y configuración para Perú y Colombia',
      },
      currency: 'PEN',
      activeCountry,
      defaults: {
        ...(stored.defaults || {}),
        factorGeneralCosts: Number(stored.defaults?.factorGeneralCosts || EXCEL_SOURCE?.defaults?.factorGeneralCosts || 1),
        divisorMargin: Number(stored.defaults?.divisorMargin || EXCEL_SOURCE?.defaults?.divisorMargin || 0.75),
        chargerExchangeRate: Number(stored.defaults?.chargerExchangeRate || EXCEL_SOURCE?.defaults?.chargerExchangeRate || 3.75),
        miniboxPriceUsd: Number(stored.defaults?.miniboxPriceUsd || EXCEL_SOURCE?.defaults?.miniboxPriceUsd || 700),
        alienPriceUsd: Number(stored.defaults?.alienPriceUsd || EXCEL_SOURCE?.defaults?.alienPriceUsd || 900),
      },
      commercialProfiles: normalizeCommercialProfiles(stored.commercialProfiles, Number(stored.defaults?.divisorMargin || EXCEL_SOURCE?.defaults?.divisorMargin || 0.75)),
      harCatalogs: normalizeHarCatalogs('ALL', stored.harCatalogs),
      roles: roleMatrix.roles.map((role) => role.id),
      roleDefinitions: roleMatrix.roles,
      catalog: buildCatalogFromItems((stored.catalog?.items || EXCEL_SOURCE?.catalog?.items || []), {
        ...(EXCEL_SOURCE?.defaults || {}),
        ...(stored.defaults || {}),
      }),
    };
  }
  const scoped = getStoredCountryConfig(stored, activeCountry);
  const roleMatrix = getRoleMatrix();
  const roleIds = roleMatrix.roles.map((role) => role.id);
  if (!EXCEL_SOURCE) {
    const defaults = {
      ...scoped.defaults,
      factorGeneralCosts: Number(scoped.defaults?.factorGeneralCosts || 1),
      divisorMargin: Number(scoped.defaults?.divisorMargin || 0.75),
      chargerExchangeRate: Number(scoped.defaults?.chargerExchangeRate || 3.75),
      miniboxPriceUsd: Number(scoped.defaults?.miniboxPriceUsd || 700),
      alienPriceUsd: Number(scoped.defaults?.alienPriceUsd || 900),
    };
    return {
      ...scoped,
      activeCountry,
      defaults,
      roles: roleIds,
      roleDefinitions: roleMatrix.roles,
      commercialProfiles: normalizeCommercialProfiles(scoped.commercialProfiles, defaults.divisorMargin),
      harCatalogs: normalizeHarCatalogs(activeCountry, scoped.harCatalogs),
      catalog: buildCatalogFromItems(scoped.catalog?.items || [], defaults),
    };
  }
  const defaults = {
    ...EXCEL_SOURCE.defaults,
    ...scoped.defaults,
    factorGeneralCosts: Number(scoped.defaults?.factorGeneralCosts ?? EXCEL_SOURCE.defaults.factorGeneralCosts ?? 1),
    divisorMargin: Number(scoped.defaults?.divisorMargin ?? EXCEL_SOURCE.defaults.divisorMargin ?? 0.75),
    chargerExchangeRate: Number(scoped.defaults?.chargerExchangeRate ?? EXCEL_SOURCE.defaults?.chargerExchangeRate ?? 3.75),
    miniboxPriceUsd: Number(scoped.defaults?.miniboxPriceUsd ?? EXCEL_SOURCE.defaults?.miniboxPriceUsd ?? 700),
    alienPriceUsd: Number(scoped.defaults?.alienPriceUsd ?? EXCEL_SOURCE.defaults?.alienPriceUsd ?? 900),
  };
  const items = Array.isArray(scoped.catalog?.items) && scoped.catalog.items.length
    ? scoped.catalog.items
    : EXCEL_SOURCE.catalog.items;
  const roles = roleIds;
  return {
    company: { ...EXCEL_SOURCE.company, ...scoped.company },
    currency: scoped.currency || countryCurrency(activeCountry),
    activeCountry,
    defaults,
    commercialProfiles: normalizeCommercialProfiles(scoped.commercialProfiles, defaults.divisorMargin),
    harCatalogs: normalizeHarCatalogs(activeCountry, scoped.harCatalogs),
    roles,
    roleDefinitions: roleMatrix.roles,
    catalog: buildCatalogFromItems(items, defaults),
  };
}

function normalizeHarCatalogs(countryCode = 'PE', catalogs = {}) {
  const fallback = defaultHarCatalogs(countryCode);
  const normalized = { ...fallback };
  Object.entries(catalogs || {}).forEach(([key, value]) => {
    if (!Array.isArray(value)) return;
    normalized[key] = value
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  });
  return normalized;
}

function defaultHarCatalogs(countryCode = 'PE') {
  const rawCountry = String(countryCode || '').trim().toUpperCase();
  const activeCountry = rawCountry === 'ALL' ? 'ALL' : (normalizeCountryCode(rawCountry) || 'PE');
  if (activeCountry !== 'CO') {
    return {
      chargerReferences: [],
      cities: [],
      acometidaTypes: [],
      acometidaCalibers: [],
      primaryBreakers: [],
      appointmentWindows: [],
      installationRubrics: [],
      technicalStatuses: [],
    };
  }
  return {
    chargerReferences: [
      'Autel Maxicharger 7 kW',
      'Autel Maxicharger 22 kW',
      'Wallbox Pulsar Plus',
      'ABB Terra AC',
      'EVINKA Home Charger',
    ],
    cities: [
      'Bogotá',
      'Chía',
      'Cajicá',
      'Medellín',
      'Envigado',
      'Itagüí',
      'Cali',
      'Barranquilla',
      'Cartagena',
      'Bucaramanga',
    ],
    acometidaTypes: [
      'Monofásica 220V',
      'Trifásica 208V',
      'Trifásica 220V',
      'Trifásica 440V',
    ],
    acometidaCalibers: ['8 AWG', '6 AWG', '4 AWG', '2 AWG', '1/0 AWG'],
    primaryBreakers: ['2x40A', '2x50A', '2x63A', '3x40A', '3x50A', '3x63A'],
    appointmentWindows: ['07:00 - 10:00', '10:00 - 13:00', '13:00 - 16:00', '16:00 - 18:00'],
    installationRubrics: [
      'Visita técnica',
      'Mano de obra técnico electricista',
      'Transportes y herramientas',
      'Tablero y protecciones',
      'Cableado y canalización',
      'Pedestal / base',
      'Obra civil menor',
      'Accesorios y terminales',
      'Validación técnica previa',
    ],
    technicalStatuses: ['cotizada', 'lista_envio', 'aceptada_cliente', 'agendada', 'instalada', 'cerrada', 'recotizar', 'cancelada'],
  };
}

function normalizeCommercialProfiles(profiles = [], fallbackDivisor = 0.75) {
  const seeded = Array.isArray(profiles) && profiles.length ? profiles : defaultCommercialProfiles(fallbackDivisor);
  return seeded
    .map((profile, index) => normalizeCommercialProfile(profile, index, fallbackDivisor))
    .filter(Boolean);
}

function normalizeCommercialProfile(profile, index = 0, fallbackDivisor = 0.75) {
  const rawMargin = Number(profile?.marginPercent);
  const normalizedMargin = Number.isFinite(rawMargin)
    ? Math.max(0, Math.min(95, rawMargin))
    : Math.max(0, Math.min(95, roundMoney((1 - Number(fallbackDivisor || 0.75)) * 100)));
  const divisorMargin = roundMarginDivisor(1 - (normalizedMargin / 100));
  return {
    id: slugProfileId(profile?.id || profile?.name || `perfil-${index + 1}`),
    name: String(profile?.name || `Perfil ${index + 1}`).trim() || `Perfil ${index + 1}`,
    marginPercent: normalizedMargin,
    divisorMargin,
    isDefault: Boolean(profile?.isDefault) || index === 0,
  };
}

function defaultCommercialProfiles(baseDivisor = 0.75) {
  const baseMargin = roundMoney((1 - Number(baseDivisor || 0.75)) * 100);
  return [
    { id: 'general', name: 'GENERAL', marginPercent: baseMargin, isDefault: true },
    { id: 'byd', name: 'BYD', marginPercent: 30 },
    { id: 'inchcape', name: 'INCHCAPE', marginPercent: 35 },
    { id: 'motorysa', name: 'MOTORYSA', marginPercent: baseMargin },
  ];
}

function slugProfileId(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'perfil';
}

function roundMarginDivisor(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0.75;
  return Math.max(0.05, Math.min(1, Math.round(numeric * 10000) / 10000));
}

function buildCatalogFromItems(items = [], defaults = {}) {
  const normalizedItems = (items || []).map((item) => normalizeCatalogItem(item, defaults));
  const byCode = Object.fromEntries(normalizedItems.map((item) => [item.code, item]));
  return {
    items: normalizedItems,
    services: ['0060001', '0060002', '0060003'].map((code) => ({ id: code, ...byCode[code] })).filter((item) => item.code),
    cables: [
      { id: 'cable-6', ...byCode['0060102'], label: '6 mm2', pricePerMeter: byCode['0060102']?.priceWithMargin || 0 },
      { id: 'cable-10', ...byCode['0060110'], label: '10 mm2', pricePerMeter: byCode['0060110']?.priceWithMargin || 0 },
      { id: 'cable-16', ...byCode['0060111'], label: '16 mm2', pricePerMeter: byCode['0060111']?.priceWithMargin || 0 },
    ].filter((item) => item.code),
    conditionals: normalizedItems.filter((item) => item.code.startsWith('007')).map((item) => ({
      id: item.code,
      code: item.code,
      section: item.section,
      unit: normalizeUnit(item.unit),
      description: item.description,
      price: item.priceWithMargin,
    })),
  };
}

async function buildCatalogExportWorkbook(config = {}, { countryCode = 'PE', generatedBy = 'EVINKA' } = {}) {
  const workbook = new ExcelJS.Workbook();
  const generatedAt = new Date().toISOString();
  workbook.creator = 'EVINKA Cotizador';
  workbook.company = 'EVINKA';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.subject = `Catálogo actual ${countryCode}`;
  workbook.title = `EVINKA catálogo ${countryCode}`;

  const items = Array.isArray(config.catalog?.items) ? config.catalog.items : [];
  const conditionals = items.filter((item) => String(item.code || '').startsWith('007'));
  const laborRows = items.filter((item) => String(item.section || '').trim().toUpperCase() === 'MANO_OBRA');
  const materialRows = items.filter((item) => String(item.section || '').trim().toUpperCase() === 'MATERIAL');

  const summarySheet = workbook.addWorksheet('Resumen');
  addKeyValueSheet(summarySheet, [
    ['País activo', countryCode === 'CO' ? 'Colombia' : 'Perú'],
    ['Moneda', config.currency || countryCurrency(countryCode)],
    ['Empresa', config.company?.name || 'EVINKA Cotizador'],
    ['Tagline', config.company?.tagline || ''],
    ['Generado en', generatedAt],
    ['Generado por', generatedBy],
    ['Items catálogo', items.length],
    ['Filas mano de obra', laborRows.length],
    ['Filas materiales', materialRows.length],
    ['Filas extras/condicionales', conditionals.length],
  ]);

  const parametersSheet = workbook.addWorksheet('Parametros');
  const distanceFactors = Array.isArray(config.defaults?.distanceFactors) ? config.defaults.distanceFactors : [];
  addKeyValueSheet(parametersSheet, [
    ['IGV / IVA', Number(config.defaults?.igv || 0)],
    ['Factor general costos', Number(config.defaults?.factorGeneralCosts || 1)],
    ['Divisor margen', Number(config.defaults?.divisorMargin || 0.75)],
    ['Máx cable 6mm', Number(config.defaults?.max6mm || 0)],
    ['Máx cable 10mm', Number(config.defaults?.max10mm || 0)],
    ['Metros incluidos Casa', Number(config.defaults?.includedMetersCasa || 0)],
    ['Mínimo Casa', Number(config.defaults?.minimumCasa || 0)],
    ['Metros incluidos Edificio', Number(config.defaults?.includedMetersEdificio || 0)],
    ['Mínimo Edificio', Number(config.defaults?.minimumEdificio || 0)],
    ['Tipo cambio cargadores', Number(config.defaults?.chargerExchangeRate || 0)],
    ['Minibox USD', Number(config.defaults?.miniboxPriceUsd || 0)],
    ['Alien X USD', Number(config.defaults?.alienPriceUsd || 0)],
  ]);
  if (distanceFactors.length) {
    parametersSheet.addRow([]);
    parametersSheet.addRow(['Tramo distancia', 'Factor']);
    parametersSheet.getRow(parametersSheet.rowCount).font = { bold: true };
    distanceFactors.forEach((item) => {
      parametersSheet.addRow([
        item?.upto === Infinity || item?.upto === 0 ? '> tramo final' : Number(item?.upto || 0),
        Number(item?.factor || 0),
      ]);
    });
  }
  autoFitWorksheet(parametersSheet);

  const profilesSheet = workbook.addWorksheet('Perfiles comerciales');
  addTableSheet(profilesSheet, ['ID', 'Nombre', 'Margen %', 'Default'], (config.commercialProfiles || []).map((item, index) => ([
    item.id || `perfil-${index + 1}`,
    item.name || '',
    Number(item.marginPercent || 0),
    index === 0 || item.isDefault ? 'Sí' : 'No',
  ])));

  const masterHeaders = ['Código', 'Sección', 'Naturaleza', 'Etiqueta', 'Unidad', 'Descripción', 'Costo base', 'Costo ajustado', 'Margen', 'Precio con margen', 'Regla'];
  addTableSheet(workbook.addWorksheet('Catalogo maestro'), masterHeaders, items.map((item) => catalogRowToArray(item)));
  addTableSheet(workbook.addWorksheet('Mano de obra'), masterHeaders, laborRows.map((item) => catalogRowToArray(item)));
  addTableSheet(workbook.addWorksheet('Materiales'), masterHeaders, materialRows.map((item) => catalogRowToArray(item)));
  addTableSheet(workbook.addWorksheet('Extras'), masterHeaders, conditionals.map((item) => catalogRowToArray(item)));

  return workbook.xlsx.writeBuffer();
}

function addKeyValueSheet(worksheet, rows = []) {
  worksheet.columns = [
    { header: 'Campo', key: 'field', width: 34 },
    { header: 'Valor', key: 'value', width: 24 },
  ];
  worksheet.getRow(1).font = { bold: true };
  rows.forEach(([field, value]) => worksheet.addRow([field, value]));
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  autoFitWorksheet(worksheet);
}

function addTableSheet(worksheet, headers = [], rows = []) {
  worksheet.columns = headers.map((header, index) => ({ header, key: `col_${index + 1}`, width: Math.max(String(header || '').length + 2, 12) }));
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  if (!rows.length) {
    worksheet.addRow(['Sin datos']);
    autoFitWorksheet(worksheet);
    return;
  }
  rows.forEach((row) => worksheet.addRow(row));
  autoFitWorksheet(worksheet);
}

function autoFitWorksheet(worksheet) {
  worksheet.columns.forEach((column) => {
    let maxLength = 12;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const raw = cell.value == null ? '' : String(cell.value);
      maxLength = Math.max(maxLength, Math.min(raw.length + 2, 60));
    });
    column.width = maxLength;
  });
}

function catalogRowToArray(item = {}) {
  return [
    item.code || '',
    item.section || '',
    item.nature || '',
    item.label || '',
    item.unit || '',
    item.description || '',
    Number(item.costBase || 0),
    Number(item.costAdjusted || 0),
    Number(item.margin || 0),
    Number(item.priceWithMargin || 0),
    item.rule || '',
  ];
}

function normalizeCatalogItem(item, defaults = {}) {
  const factorGeneralCosts = Number(defaults.factorGeneralCosts || 1);
  const divisorMargin = Number(defaults.divisorMargin || 0.75);
  const costBase = roundMoney(Number(item?.costBase || 0));
  const costAdjusted = roundMoney(costBase * factorGeneralCosts);
  const priceWithMargin = divisorMargin ? roundMoney(costAdjusted / divisorMargin) : 0;
  const margin = roundMoney(priceWithMargin - costAdjusted);
  return {
    code: String(item?.code || '').trim(),
    section: String(item?.section || '').trim(),
    nature: String(item?.nature || '').trim(),
    label: String(item?.label || '').trim(),
    unit: String(item?.unit || '').trim(),
    description: String(item?.description || '').trim(),
    costBase,
    costAdjusted,
    margin,
    priceWithMargin,
    price: priceWithMargin,
    rule: String(item?.rule || '').trim(),
  };
}

function sanitizeQuotePhotos(photos = []) {
  if (!Array.isArray(photos)) return [];
  return photos
    .slice(0, 6)
    .map((photo, index) => ({
      name: String(photo?.name || `foto-${index + 1}.jpg`).trim(),
      contentType: String(photo?.contentType || photo?.type || '').trim().toLowerCase(),
      dataUrl: String(photo?.dataUrl || '').trim(),
      title: String(photo?.title || '').trim(),
      comment: String(photo?.comment || '').trim(),
      frame: sanitizePhotoFrame(photo?.frame),
    }))
    .filter((photo) => photo.dataUrl.startsWith('data:image/'));
}

function sanitizePhotoFrame(frame = {}) {
  const clamp = (value, min, max, fallback) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
  };
  return {
    zoom: clamp(frame?.zoom, 1, 2.6, 1),
    focusX: clamp(frame?.focusX, 0, 1, 0.5),
    focusY: clamp(frame?.focusY, 0, 1, 0.5),
  };
}

function saveQuotePhotos(quoteId, photos = []) {
  if (!Array.isArray(photos) || !photos.length) return [];
  const dir = path.join(quoteAssetsDir, quoteId);
  ensureDir(dir);
  const saved = [];
  photos.forEach((photo, index) => {
    try {
      const parsed = parseImageDataUrl(photo.dataUrl);
      if (!parsed) return;
      const ext = extensionFromMime(parsed.mimeType);
      const baseName = slugPdfPart(photo.name.replace(/\.[^.]+$/, ''), `FOTO-${index + 1}`).toLowerCase();
      const fileName = `${String(index + 1).padStart(2, '0')}-${baseName}.${ext}`;
      const filePath = path.join(dir, fileName);
      fs.writeFileSync(filePath, parsed.buffer);
      saved.push({
        name: photo.name || fileName,
        title: photo.title || '',
        comment: photo.comment || '',
        frame: sanitizePhotoFrame(photo.frame),
        contentType: parsed.mimeType,
        filePath,
      });
    } catch {
      // Ignorar foto inválida y continuar con las demás.
    }
  });
  return saved;
}

function parseImageDataUrl(dataUrl = '') {
  const match = String(dataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1].toLowerCase(),
    buffer: Buffer.from(match[2], 'base64'),
  };
}

function extensionFromMime(mimeType = '') {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  return 'jpg';
}

function resolveCommercialProfile(config, profileId) {
  const profiles = Array.isArray(config?.commercialProfiles) ? config.commercialProfiles : [];
  const normalizedId = slugProfileId(profileId || '');
  const selected = profiles.find((item) => item.id === normalizedId)
    || profiles.find((item) => slugProfileId(item.name) === normalizedId)
    || profiles.find((item) => item.isDefault)
    || profiles[0]
    || normalizeCommercialProfile({ id: 'general', name: 'GENERAL', marginPercent: roundMoney((1 - Number(config?.defaults?.divisorMargin || 0.75)) * 100), isDefault: true }, 0, config?.defaults?.divisorMargin || 0.75);
  return normalizeCommercialProfile(selected, 0, config?.defaults?.divisorMargin || 0.75);
}

function buildQuoteConfigForProfile(config, profile) {
  const fallbackDivisor = Number(config?.defaults?.divisorMargin || 0.75);
  const divisorMargin = roundMarginDivisor(profile?.divisorMargin || (1 - (Number(profile?.marginPercent || 0) / 100)) || fallbackDivisor);
  const defaults = {
    ...config.defaults,
    divisorMargin,
    minimumCasa: convertMarginPrice(config.defaults.minimumCasa, fallbackDivisor, divisorMargin),
    minimumEdificio: convertMarginPrice(config.defaults.minimumEdificio, fallbackDivisor, divisorMargin),
  };
  return {
    ...config,
    defaults,
    catalog: buildCatalogFromItems(config.catalog.items, defaults),
  };
}

function convertMarginPrice(value, fromDivisor, toDivisor) {
  const price = Number(value || 0);
  const from = Number(fromDivisor || 0.75);
  const to = Number(toDivisor || 0.75);
  if (!price || !from || !to) return roundMoney(price);
  return roundMoney((price * from) / to);
}

function computeCountrySpecificAdjustments({ payload = {}, config, subtotalBase = 0, distance = 0 }) {
  const countryCode = normalizeCountryCode(payload.countryCode || config?.activeCountry || '') || 'PE';
  const outOfCity = String(payload.outOfCity || '').trim().toUpperCase() === 'SI';
  const groundingMissing = String(payload.grounding || '').trim().toUpperCase() === 'NO';
  const reviewRequested = payload.requiresReview === true || String(payload.requiresReview || '').trim().toUpperCase() === 'SI';
  const reviewDistance = Number(config?.defaults?.coReviewDistanceMeters || 25);
  const logisticsRate = Number(config?.defaults?.coOutOfCityRate || 0.08);
  const logisticsMinimum = Number(config?.defaults?.coOutOfCityMinimum || 180000);
  const reviewFee = Number(config?.defaults?.coTechnicalReviewFee || 0);

  const requiresReview = countryCode === 'CO'
    ? (groundingMissing || reviewRequested || distance > reviewDistance)
    : (groundingMissing || reviewRequested);

  const adjustments = [];
  if (countryCode === 'CO' && outOfCity) {
    const surcharge = roundMoney(Math.max(subtotalBase * logisticsRate, logisticsMinimum));
    if (surcharge > 0) {
      adjustments.push({
        code: 'CO-LOGISTICA',
        label: 'Recargo logístico fuera de ciudad',
        qty: 1,
        unitPrice: surcharge,
        total: surcharge,
        unit: 'UND',
      });
    }
  }
  if (countryCode === 'CO' && reviewFee > 0 && requiresReview) {
    adjustments.push({
      code: 'CO-REVISION',
      label: 'Validación técnica previa / revisión especializada',
      qty: 1,
      unitPrice: roundMoney(reviewFee),
      total: roundMoney(reviewFee),
      unit: 'UND',
    });
  }

  const reviewReasons = [];
  if (groundingMissing) reviewReasons.push('No cuenta con puesta a tierra real');
  if (countryCode === 'CO' && distance > reviewDistance) reviewReasons.push(`Distancia de acometida mayor a ${reviewDistance} m`);
  if (reviewRequested) reviewReasons.push('Marcada manualmente para revisión');
  if (countryCode === 'CO' && outOfCity) reviewReasons.push('Instalación fuera de ciudad');

  return {
    requiresReview,
    reviewReasons,
    adjustments,
    adjustmentsTotal: roundMoney(sumTotals(adjustments)),
  };
}

function buildQuote(payload, config, user) {
  const commercialProfile = resolveCommercialProfile(config, payload.commercialProfileId);
  const effectiveConfig = buildQuoteConfigForProfile(config, commercialProfile);
  const distance = Math.max(0, Number(payload.distance || 0));
  const tubeType = String(payload.tubeType || 'EMT').toUpperCase();
  const propertyType = String(payload.propertyType || 'Casa').trim();
  const cable = effectiveConfig.catalog.cables.find((item) => item.id === payload.cableId) || pickCableByDistance(distance, effectiveConfig.catalog.cables, effectiveConfig.defaults);
  const charger = resolveChargerSelection(payload, config);

  const mandatoryRows = computeMandatoryRows(distance, tubeType, cable, effectiveConfig);
  const conditionalRows = computeConditionalRows(payload.conditionals, effectiveConfig);
  const civilMaterialsRow = computeCivilMaterialsRow(conditionalRows, effectiveConfig);
  if (civilMaterialsRow) conditionalRows.push(civilMaterialsRow);

  const baseObligatoryNormal = roundMoney(sumTotals(mandatoryRows));
  const totalConditionals = roundMoney(sumTotals(conditionalRows));
  const minimumBase = propertyType.toUpperCase() === 'EDIFICIO' ? effectiveConfig.defaults.minimumEdificio : effectiveConfig.defaults.minimumCasa;
  const includedMeters = propertyType.toUpperCase() === 'EDIFICIO' ? effectiveConfig.defaults.includedMetersEdificio : effectiveConfig.defaults.includedMetersCasa;
  const includedRows = computeMandatoryRows(includedMeters, tubeType, cable, effectiveConfig);
  const includedScope = buildBaseIncludedScope({ propertyType, includedMeters, tubeType, cable, charger });
  const additionalMeterage = roundMoney(Math.max(baseObligatoryNormal - sumTotals(includedRows), 0));
  const subtotalBeforeCountryAdjustments = roundMoney(minimumBase + additionalMeterage + totalConditionals + charger.pricePen);
  const countryAdjustments = computeCountrySpecificAdjustments({
    payload,
    config: effectiveConfig,
    subtotalBase: subtotalBeforeCountryAdjustments,
    distance,
  });
  const subtotal = roundMoney(subtotalBeforeCountryAdjustments + countryAdjustments.adjustmentsTotal);
  const igv = roundMoney(subtotal * Number(effectiveConfig.defaults.igv || 0));
  const total = roundMoney(subtotal + igv);
  const commercialRows = buildCommercialRows({
    propertyType,
    minimumBase,
    additionalMeterage,
    conditionalRows,
    charger,
    countryCode: payload.countryCode,
    countryAdjustments: countryAdjustments.adjustments,
  });
  const photos = sanitizeQuotePhotos(payload.photos);

  const pdfTemplate = resolveQuotePdfTemplate({
    countryCode: payload.countryCode,
    companyName: payload.companyName,
    clientName: payload.clientName,
    email: payload.email,
    commercialProfile,
    commercialProfileId: commercialProfile.id,
    commercialProfileName: commercialProfile.name,
  });

  return {
    id: `COT-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
    createdAt: new Date().toISOString(),
    createdBy: safeUser(user),
    countryCode: resolveRecordCountryCode(payload.countryCode, payload.city, payload.clientAddress, payload.address, resolveUserPrimaryCountry(user)),
    currency: config.currency || countryCurrency(payload.countryCode),
    clientName: String(payload.clientName || '').trim(),
    clientFirstName: String(payload.clientFirstName || '').trim(),
    clientLastName: String(payload.clientLastName || '').trim(),
    email: normalizeEmail(payload.email),
    phone: String(payload.phone || '').trim(),
    documentType: String(payload.documentType || '').trim(),
    clientDocument: String(payload.clientDocument || payload.ruc || '').trim(),
    department: String(payload.department || '').trim(),
    locality: String(payload.locality || '').trim(),
    neighborhood: String(payload.neighborhood || '').trim(),
    address: String(payload.address || payload.clientAddress || '').trim(),
    residenceType: String(payload.residenceType || '').trim(),
    companyName: String(payload.companyName || '').trim(),
    vehicleModel: String(payload.vehicleModel || '').trim(),
    vin: String(payload.vin || '').trim(),
    city: String(payload.city || '').trim(),
    visitDate: String(payload.visitDate || '').trim(),
    installationType: String(payload.installationType || '').trim(),
    clientType: String(payload.clientType || '').trim(),
    customerSegment: inferCustomerSegment(payload),
    commercialProfile,
    commercialProfileId: commercialProfile.id,
    commercialProfileName: commercialProfile.name,
    pdfTemplate,
    propertyType,
    tubeType,
    chargerReference: String(payload.chargerReference || '').trim(),
    otherReference: String(payload.otherReference || '').trim(),
    acometidaType: String(payload.acometidaType || '').trim(),
    acometidaCaliber: String(payload.acometidaCaliber || '').trim(),
    primaryBreaker: String(payload.primaryBreaker || '').trim(),
    voltage: Number(payload.voltage || 0),
    current: Number(payload.current || 0),
    grounding: String(payload.grounding || '').trim(),
    outOfCity: String(payload.outOfCity || '').trim(),
    installationDescription: String(payload.installationDescription || '').trim(),
    requiresReview: countryAdjustments.requiresReview,
    marginPercent: Number(commercialProfile.marginPercent || 0),
    charger,
    technicianNotes: String(payload.technicianNotes || '').trim(),
    photos,
    cable,
    distance,
    itemRows: [...mandatoryRows, ...conditionalRows],
    commercialRows,
    includedRows,
    includedScope,
    baseObligatoryNormal,
    totalConditionals,
    subtotalBeforeCountryAdjustments,
    countryAdjustments: countryAdjustments.adjustments,
    countryAdjustmentsTotal: countryAdjustments.adjustmentsTotal,
    reviewReasons: countryAdjustments.reviewReasons,
    minimumBase,
    includedMeters,
    additionalMeterage,
    subtotal,
    igv,
    total,
    status: 'cotizada',
    pdfPath: '',
  };
}

async function deliverQuoteEmail({ quote, config, req, pdfPath, pdfFilename }) {
  if (!quote.email) return { ok: false, skipped: true, message: 'Cotización generada sin envío por correo porque no se indicó un email.' };
  if (!mailer) return { ok: false, message: 'El correo corporativo no está configurado todavía.' };
  try {
    const attachment = fs.readFileSync(pdfPath).toString('base64');
    const baseUrl = publicBaseUrl(req);
    const { subject, text, html } = buildQuoteEmailContent({ quote, config, pdfUrl: `${baseUrl}${quote.pdfPath}` });
    await mailer.sendMail({
      to: [quote.email],
      subject,
      text,
      html,
      attachments: [{
        name: pdfFilename,
        contentType: 'application/pdf',
        contentBytes: attachment,
      }],
    });
    return { ok: true, sentAt: new Date().toISOString(), message: `Cotización enviada a ${quote.email}.` };
  } catch (error) {
    return { ok: false, failedAt: new Date().toISOString(), message: error.message };
  }
}

async function deliverPdfByWhatsApp({
  phone = '',
  fileName = 'documento.pdf',
  mimeType = 'application/pdf',
  buffer = null,
  caption = '',
} = {}) {
  if (!meta) {
    return { ok: false, skipped: true, message: 'WhatsApp no está configurado todavía.' };
  }
  const normalizedPhone = normalizePhoneForWhatsApp(phone);
  if (!normalizedPhone) {
    return { ok: false, skipped: true, message: 'No se indicó teléfono del cliente para WhatsApp.' };
  }
  if (!buffer || !Buffer.isBuffer(buffer) || !buffer.length) {
    return { ok: false, skipped: true, message: 'No encontré el archivo PDF para enviar por WhatsApp.' };
  }
  try {
    const uploaded = await meta.uploadMedia({ buffer, mimeType, fileName });
    await meta.sendDocument(normalizedPhone, {
      mediaId: String(uploaded?.id || '').trim(),
      caption,
      fileName,
    });
    return { ok: true, sentAt: new Date().toISOString(), message: `Documento enviado por WhatsApp a ${normalizedPhone}.` };
  } catch (error) {
    return { ok: false, failedAt: new Date().toISOString(), message: error instanceof Error ? error.message : String(error || 'No pude enviar el documento por WhatsApp.') };
  }
}

async function deliverQuoteWhatsApp({ quote }) {
  const pdfPath = String(quote?.pdfFile || '').trim();
  const fileName = String(quote?.pdfFilename || path.basename(pdfPath || '')).trim() || `Cotizacion_${quote?.id || 'EVINKA'}.pdf`;
  if (!pdfPath || !fs.existsSync(pdfPath)) {
    return { ok: false, skipped: true, message: 'Cotización generada sin PDF local disponible para WhatsApp.' };
  }
  const client = formatDisplayName(quote?.clientName) || 'cliente';
  const caption = [
    `Hola ${client}, aquí tienes tu cotización EVINKA ⚡`,
    `Cotización: ${quote?.id || '-'}`,
    `Total: ${money(quote?.total || 0)}`,
  ].join('\n');
  return deliverPdfByWhatsApp({
    phone: String(quote?.phone || '').trim(),
    fileName,
    mimeType: 'application/pdf',
    buffer: await fs.promises.readFile(pdfPath),
    caption,
  });
}

async function deliverConformityWhatsApp({ conformity, quote = null, visit = null }) {
  const fileName = String(conformity?.pdfFilename || `Conformidad_${conformity?.installationOrderId || conformity?.id || 'EVINKA'}.pdf`).trim();
  const pdfBase64 = String(conformity?.pdfBase64 || '').trim();
  if (!pdfBase64) {
    return { ok: false, skipped: true, message: 'Conformidad sin PDF embebido para enviar por WhatsApp.' };
  }
  const client = formatDisplayName(conformity?.clientName || quote?.clientName || visit?.clientName) || 'cliente';
  const caption = [
    `Hola ${client}, te compartimos tu conformidad EVINKA ⚡`,
    `Orden: ${conformity?.installationOrderId || quote?.installationOrderId || '-'}`,
    `Cotización: ${conformity?.quoteId || quote?.id || '-'}`,
  ].join('\n');
  return deliverPdfByWhatsApp({
    phone: String(visit?.clientPhone || quote?.phone || '').trim(),
    fileName,
    mimeType: 'application/pdf',
    buffer: Buffer.from(pdfBase64, 'base64'),
    caption,
  });
}

async function deliverWarrantyWhatsApp({ warranty, quote = null, visit = null }) {
  const fileName = String(warranty?.pdfFilename || `Garantia_${warranty?.installationOrderId || warranty?.id || 'EVINKA'}.pdf`).trim();
  const pdfBase64 = String(warranty?.pdfBase64 || '').trim();
  if (!pdfBase64) {
    return { ok: false, skipped: true, message: 'Garantía sin PDF embebido para enviar por WhatsApp.' };
  }
  const client = formatDisplayName(warranty?.clientName || quote?.clientName || visit?.clientName) || 'cliente';
  const caption = [
    `Hola ${client}, te compartimos tu garantía EVINKA ⚡`,
    `Orden: ${warranty?.installationOrderId || quote?.installationOrderId || '-'}`,
    `Código: ${warranty?.warrantyCode || '-'}`,
  ].join('\n');
  return deliverPdfByWhatsApp({
    phone: String(visit?.clientPhone || quote?.phone || '').trim(),
    fileName,
    mimeType: 'application/pdf',
    buffer: Buffer.from(pdfBase64, 'base64'),
    caption,
  });
}

function buildQuoteEmailContent({ quote, config, pdfUrl }) {
  const client = formatDisplayName(quote.clientName) || 'cliente';
  const quoteNumber = displayQuoteNumber(quote.id);
  const subject = `EVINKA · Cotización ${quoteNumber} para ${client}`;
  const total = money(quote.total);
  const subtitle = quote.installationType || 'Instalación de cargador';
  const text = [
    `Estimado/a ${client},`,
    '',
    'Gracias por su interés en EVINKA.',
    `Adjuntamos la cotización N° ${quoteNumber} correspondiente al servicio de ${subtitle.toLowerCase()}.`,
    '',
    `Resumen:`,
    `- Cliente: ${client}`,
    `- Ciudad: ${quote.city || 'Lima'}`,
    `- Tipo de instalación: ${quote.installationType || '-'}`,
    `- Tipo de inmueble: ${quote.propertyType || '-'}`,
    `- Total cotizado: ${total}`,
    '',
    `También puede descargar el PDF aquí: ${pdfUrl}`,
    '',
    'Si desea continuar, responder este correo y con gusto coordinaremos los siguientes pasos.',
    '',
    `Saludos cordiales,`,
    `${config.company?.name || 'EVINKA'}`,
    'contacto@evinka.tech',
  ].join('\n');
  const html = `
    <div style="font-family:Inter,Segoe UI,Arial,sans-serif;color:#1f2937;line-height:1.6;max-width:720px;margin:0 auto;">
      <div style="padding:24px 0 12px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#9ca3af;">EVINKA</div>
        <h1 style="margin:8px 0 0;font-size:26px;color:#111827;">Cotización ${quoteNumber}</h1>
      </div>
      <p style="margin:24px 0 0;">Estimado/a <strong>${escapeHtml(client)}</strong>,</p>
      <p>Gracias por su interés en <strong>${escapeHtml(config.company?.name || 'EVINKA')}</strong>. Adjuntamos su cotización correspondiente al servicio de <strong>${escapeHtml(subtitle)}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#fafaf9;border:1px solid #e5e7eb;">
        <tbody>
          ${[
            ['Cliente', client],
            ['Perfil comercial', quote.commercialProfile?.name || 'GENERAL'],
            ['Correo', quote.email],
            ['Ciudad', quote.city || 'Lima'],
            ['Tipo de instalación', quote.installationType || '-'],
            ['Tipo de inmueble', quote.propertyType || '-'],
            ['Total cotizado', total],
          ].map(([label, value]) => `<tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;width:220px;color:#6b7280;">${escapeHtml(label)}</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#111827;">${escapeHtml(value)}</td></tr>`).join('')}
        </tbody>
      </table>
      <p>Hemos adjuntado el PDF de la propuesta para su revisión. Si prefiere abrirlo en línea, puede hacerlo aquí: <a href="${escapeHtml(pdfUrl)}">Descargar cotización</a>.</p>
      <p>Quedamos atentos a cualquier consulta, ajuste o coordinación para la siguiente etapa.</p>
      <div style="margin-top:28px;padding-top:18px;border-top:1px solid #e5e7eb;">
        <strong style="display:block;color:#111827;">${escapeHtml(config.company?.name || 'EVINKA')}</strong>
        <span style="display:block;color:#6b7280;">Correo: contacto@evinka.tech</span>
        <span style="display:block;color:#6b7280;">Este correo fue generado automáticamente por el cotizador EVINKA.</span>
      </div>
    </div>
  `;
  return { subject, text, html };
}

async function deliverInstallationScheduleEmail({ quote, visit, order, req }) {
  const to = normalizeEmail(visit?.clientEmail || quote?.email || '');
  if (!to) {
    return { ok: false, skipped: true, message: 'Cita agendada sin envío por correo porque no se indicó un email del cliente.' };
  }
  if (!mailer) {
    return { ok: false, message: 'El correo corporativo no está configurado todavía.' };
  }
  try {
    const baseUrl = publicBaseUrl(req);
    const { subject, text, html } = buildInstallationScheduleEmailContent({
      quote,
      visit,
      order,
      manageUrl: `${baseUrl}/`,
    });
    await mailer.sendMail({
      to: [to],
      subject,
      text,
      html,
    });
    return { ok: true, sentAt: new Date().toISOString(), message: `Agenda enviada a ${to}.` };
  } catch (error) {
    return { ok: false, failedAt: new Date().toISOString(), message: error.message };
  }
}

async function deliverInstallationScheduleWhatsApp({ quote, visit, order }) {
  if (!meta) {
    return { ok: false, skipped: true, message: 'WhatsApp no está configurado todavía.' };
  }
  const phone = normalizePhoneForWhatsApp(visit?.clientPhone || quote?.clientPhone || '');
  if (!phone) {
    return { ok: false, skipped: true, message: 'Cita agendada sin WhatsApp porque no se indicó teléfono del cliente.' };
  }
  try {
    const client = formatDisplayName(visit?.clientName || quote?.clientName) || 'cliente';
    const dateLabel = visit?.scheduledAt ? formatDateOnly(visit.scheduledAt) : '-';
    const timeLabel = buildVisitTimeLabel(visit);
    const address = visit?.clientAddress || quote?.city || '-';
    const orderId = order?.id || quote?.installationOrderId || '-';
    const text = [
      `Hola ${client}, tu instalación EVINKA quedó agendada.`,
      `Orden: ${orderId}`,
      `Fecha: ${dateLabel}`,
      `Hora: ${timeLabel}`,
      `Dirección: ${address}`,
      '',
      'Si necesitas reprogramar, responde a este mensaje.',
      '',
      'EVINKA ⚡',
    ].join('\n');
    await meta.sendText(phone, text);
    return { ok: true, sentAt: new Date().toISOString(), message: `Agenda enviada por WhatsApp a ${phone}.` };
  } catch (error) {
    return { ok: false, failedAt: new Date().toISOString(), message: error.message };
  }
}

function buildInstallationScheduleEmailContent({ quote, visit, order, manageUrl }) {
  const client = formatDisplayName(visit?.clientName || quote?.clientName) || 'cliente';
  const installationType = quote?.installationType || 'instalación EVINKA';
  const subject = `EVINKA · Cita agendada para su instalación ${order?.id || ''}`.trim();
  const scheduledAt = visit?.scheduledAt ? formatDateOnly(visit.scheduledAt) : '-';
  const timeWindow = buildVisitTimeLabel(visit);
  const techName = formatDisplayName(visit?.assignedTechName || '') || 'técnico EVINKA';
  const address = visit?.clientAddress || quote?.city || '-';
  const reference = visit?.reference || '-';
  const quoteId = quote?.id || '-';
  const notes = String(visit?.notes || '').trim();
  const text = [
    `Estimado/a ${client},`,
    '',
    'Su visita de instalación con EVINKA ha sido agendada correctamente.',
    '',
    'Detalle de la cita:',
    `- Orden: ${order?.id || '-'}`,
    `- Cotización: ${quoteId}`,
    `- Referencia de visita: ${reference}`,
    `- Servicio: ${installationType}`,
    `- Fecha programada: ${scheduledAt}`,
    `- Rango horario: ${timeWindow}`,
    `- Dirección: ${address}`,
    `- Técnico asignado: ${techName}`,
    ...(notes ? ['', `Observaciones: ${notes}`] : []),
    '',
    `Si necesita reprogramar o resolver dudas, puede responder este correo o contactarnos por EVINKA. ${manageUrl}`,
    '',
    'Saludos cordiales,',
    'EVINKA',
    'contacto@evinka.tech',
  ].join('\n');
  const html = `
    <div style="font-family:Inter,Segoe UI,Arial,sans-serif;color:#1f2937;line-height:1.6;max-width:720px;margin:0 auto;">
      <div style="padding:24px 0 12px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#9ca3af;">EVINKA</div>
        <h1 style="margin:8px 0 0;font-size:26px;color:#111827;">Cita de instalación agendada</h1>
      </div>
      <p style="margin:24px 0 0;">Estimado/a <strong>${escapeHtml(client)}</strong>,</p>
      <p>Su visita de <strong>${escapeHtml(installationType)}</strong> ha sido agendada correctamente.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#fafaf9;border:1px solid #e5e7eb;">
        <tbody>
          ${[
            ['Orden', order?.id || '-'],
            ['Cotización', quoteId],
            ['Referencia de visita', reference],
            ['Fecha programada', scheduledAt],
            ['Rango horario', timeWindow],
            ['Dirección', address],
            ['Técnico asignado', techName],
          ].map(([label, value]) => `<tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;width:220px;color:#6b7280;">${escapeHtml(label)}</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#111827;">${escapeHtml(value)}</td></tr>`).join('')}
        </tbody>
      </table>
      ${notes ? `<p><strong>Observaciones:</strong> ${escapeHtml(notes)}</p>` : ''}
      <p>Si necesita reprogramar o resolver dudas, puede responder este correo o ingresar aquí: <a href="${escapeHtml(manageUrl)}">EVINKA</a>.</p>
      <div style="margin-top:28px;padding-top:18px;border-top:1px solid #e5e7eb;">
        <strong style="display:block;color:#111827;">EVINKA</strong>
        <span style="display:block;color:#6b7280;">Correo: contacto@evinka.tech</span>
        <span style="display:block;color:#6b7280;">Este correo fue generado automáticamente por EVINKA Suite.</span>
      </div>
    </div>
  `;
  return { subject, text, html };
}

async function deliverConformityEmail({ conformity, req }) {
  if (!conformity.clientEmail) return { ok: false, skipped: true, message: 'Conformidad generada sin envío por correo porque no se indicó un email.' };
  if (!mailer) return { ok: false, message: 'El correo corporativo no está configurado todavía.' };
  try {
    let attachment = conformity.pdfBase64 || null;
    let attachmentName = `Conformidad_${conformity.installationOrderId || conformity.id}.pdf`;
    if (!attachment && conformity.pdfUrl) {
      const response = await fetch(conformity.pdfUrl);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        attachment = Buffer.from(arrayBuffer).toString('base64');
      }
    }
    const { subject, text, html } = buildConformityEmailContent({ conformity });
    await mailer.sendMail({
      to: [conformity.clientEmail],
      subject,
      text,
      html,
      attachments: attachment
        ? [{
            name: attachmentName,
            contentType: 'application/pdf',
            contentBytes: attachment,
          }]
        : [],
    });
    return { ok: true, sentAt: new Date().toISOString(), message: `Conformidad enviada a ${conformity.clientEmail}.` };
  } catch (error) {
    return { ok: false, failedAt: new Date().toISOString(), message: error.message };
  }
}

function buildConformityEmailContent({ conformity }) {
  const client = formatDisplayName(conformity.clientName) || 'cliente';
  const subject = `EVINKA · Conformidad de instalación ${conformity.installationOrderId || ''}`.trim();
  const text = [
    `Estimado/a ${client},`,
    '',
    'Adjuntamos su conformidad de instalación EVINKA.',
    '',
    `Resumen:`,
    `- Orden: ${conformity.installationOrderId || '-'}`,
    `- Cotización: ${conformity.quoteId || '-'}`,
    `- Cliente: ${client}`,
    `- Correo: ${conformity.clientEmail || '-'}`,
    `- Dirección: ${conformity.address || '-'}`,
    '',
    conformity.pdfUrl ? `También puede descargar el PDF aquí: ${conformity.pdfUrl}` : 'El PDF va adjunto en este correo.',
    '',
    'Gracias por confiar en EVINKA.',
    '',
    'Saludos cordiales,',
    'EVINKA',
    'contacto@evinka.tech',
  ].join('\n');
  const html = `
    <div style="font-family:Inter,Segoe UI,Arial,sans-serif;color:#1f2937;line-height:1.6;max-width:720px;margin:0 auto;">
      <div style="padding:24px 0 12px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#9ca3af;">EVINKA</div>
        <h1 style="margin:8px 0 0;font-size:26px;color:#111827;">Conformidad de instalación</h1>
      </div>
      <p style="margin:24px 0 0;">Estimado/a <strong>${escapeHtml(client)}</strong>,</p>
      <p>Adjuntamos su conformidad de instalación EVINKA.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#fafaf9;border:1px solid #e5e7eb;">
        <tbody>
          ${[
            ['Orden', conformity.installationOrderId || '-'],
            ['Cotización', conformity.quoteId || '-'],
            ['Cliente', client],
            ['Correo', conformity.clientEmail || '-'],
            ['Dirección', conformity.address || '-'],
          ].map(([label, value]) => `<tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;width:220px;color:#6b7280;">${escapeHtml(label)}</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#111827;">${escapeHtml(value)}</td></tr>`).join('')}
        </tbody>
      </table>
      <p>${conformity.pdfUrl ? `También puede abrir el documento aquí: <a href="${escapeHtml(conformity.pdfUrl)}">Descargar conformidad</a>.` : 'El PDF de conformidad va adjunto en este correo.'}</p>
      <div style="margin-top:28px;padding-top:18px;border-top:1px solid #e5e7eb;">
        <strong style="display:block;color:#111827;">EVINKA</strong>
        <span style="display:block;color:#6b7280;">Correo: contacto@evinka.tech</span>
        <span style="display:block;color:#6b7280;">Este correo fue generado automáticamente por EVINKA Suite.</span>
      </div>
    </div>
  `;
  return { subject, text, html };
}

function publicBaseUrl(req) {
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim() || 'https';
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return host ? `${proto}://${host}` : 'https://cotizador.evinka.net';
}

const CHARGER_CATALOG = {
  minibox: { code: 'EVK-CHG-MINIBOX', label: 'Cargador EVINKA MiniBox' },
  alien: { code: 'EVK-CHG-ALIEN', label: 'Cargador EVINKA Alien X' },
};

function resolveChargerSelection(payload = {}, config = buildAppConfig()) {
  const included = payload.chargerIncluded === true
    || String(payload.chargerIncluded || '').trim().toLowerCase() === 'si'
    || String(payload.chargerIncluded || '').trim().toLowerCase() === 'yes'
    || String(payload.chargerIncluded || '').trim().toLowerCase() === 'true';
  const requestedModel = String(payload.chargerModel || '').trim().toLowerCase();
  const selected = CHARGER_CATALOG[requestedModel] || null;
  const customLabel = String(payload.chargerLabel || '').trim();
  const rawUsd = Number(payload.chargerPriceUsd);
  const rawFx = Number(payload.exchangeRate);
  const defaultModelUsd = requestedModel === 'alien'
    ? Number(config?.defaults?.alienPriceUsd ?? 900)
    : Number(config?.defaults?.miniboxPriceUsd ?? 700);
  const priceUsd = Number.isFinite(rawUsd) && rawUsd > 0
    ? rawUsd
    : (Number.isFinite(defaultModelUsd) ? defaultModelUsd : 0);
  const defaultFx = Number(config?.defaults?.chargerExchangeRate ?? 3.75);
  const exchangeRate = Number.isFinite(rawFx) && rawFx > 0
    ? rawFx
    : (Number.isFinite(defaultFx) ? defaultFx : 3.75);
  if (!included) {
    return {
      included: false,
      id: 'no-incluido',
      code: 'EVK-CHG-NOINC',
      label: 'Cargador no incluido',
      priceUsd: 0,
      exchangeRate: roundMoney(exchangeRate),
      pricePen: 0,
    };
  }
  return {
    included: true,
    id: requestedModel || 'incluido',
    code: selected?.code || 'EVK-CHG-INCL',
    label: customLabel || selected?.label || 'Cargador incluido',
    priceUsd: roundMoney(priceUsd),
    exchangeRate: roundMoney(exchangeRate),
    pricePen: roundMoney(priceUsd * exchangeRate),
  };
}

function buildCommercialRows({ propertyType, minimumBase, additionalMeterage, conditionalRows, charger, countryAdjustments = [], countryCode = 'PE' }) {
  const rows = [
    {
      code: '0060001',
      label: countryCode === 'CO' ? 'Servicio estándar de instalación EVINKA Colombia' : 'Servicio de instalación estándar de cargador',
      qty: 1,
      unitPrice: roundMoney(minimumBase),
      total: roundMoney(minimumBase),
      unit: 'UND',
    },
  ];
  if (charger?.included && Number(charger?.pricePen || 0) > 0) {
    rows.push({
      code: charger.code,
      label: `${charger.label} · ref. US$ ${amount(charger.priceUsd)} · TC ${amount(charger.exchangeRate)}`,
      qty: 1,
      unitPrice: roundMoney(charger.pricePen),
      total: roundMoney(charger.pricePen),
      unit: 'UND',
    });
  }
  if (additionalMeterage > 0) {
    rows.push({
      code: '0060001A',
      label: countryCode === 'CO' ? 'Adecuaciones adicionales de canalización y cableado' : 'Adecuaciones adicionales a la instalación',
      qty: 1,
      unitPrice: roundMoney(additionalMeterage),
      total: roundMoney(additionalMeterage),
      unit: 'UND',
    });
  }
  conditionalRows.forEach((row) => {
    rows.push({
      ...row,
      label: `Servicios Adicionales: ${row.label}`,
      qty: 1,
      unitPrice: roundMoney(row.total),
      total: roundMoney(row.total),
      unit: 'UND',
    });
  });
  countryAdjustments.forEach((row) => {
    rows.push({
      ...row,
      qty: 1,
      unitPrice: roundMoney(row.total),
      total: roundMoney(row.total),
      unit: 'UND',
    });
  });
  return rows;
}

function normalizeUnit(unit) {
  const raw = String(unit || '').trim();
  if (raw.toUpperCase() === 'ZZ') return 'UND';
  if (raw.toUpperCase() === 'M') return 'm';
  return raw;
}

function computeMandatoryRows(distance, tubeType, cable, config) {
  const factor = getDistanceFactor(distance, config.defaults.distanceFactors);
  const byCode = Object.fromEntries(config.catalog.items.map((item) => [item.code, item]));
  const tubeQty = Math.ceil(distance / 3);
  const rows = [
    makeRow(byCode['0060001'], 1, factor),
    makeRow(byCode['0060002'], 1, 1),
    makeRow(byCode['0060003'], 1, factor),
    makeRow(byCode['0060101'], 1, 1),
    makeRow(byCode[cable.code], roundQty(distance * 1.1 * 2), 1, `Cable ${cable.label}`),
    makeRow(byCode['0060103'], roundQty(distance * 1.1), 1),
    makeRow(byCode['0060106'], 1, 1),
    makeRow(byCode['0060107'], 1, 1),
  ];
  if (tubeType === 'PVC') rows.push(makeRow(byCode['0060104'], tubeQty, 1));
  if (tubeType === 'EMT') {
    rows.push(makeRow(byCode['0060105'], tubeQty, 1));
    rows.push(makeRow(byCode['0060108'], tubeQty, 1));
  }
  return rows;
}

function computeConditionalRows(conditionals = [], config) {
  const byCode = Object.fromEntries((config.catalog.conditionals || []).map((item) => [item.code, item]));
  return (conditionals || [])
    .filter((item) => item.active && Number(item.quantity || 0) > 0 && byCode[item.code])
    .map((item) => makeRow(byCode[item.code], Number(item.quantity || 0), 1));
}

function computeCivilMaterialsRow(conditionalRows, config) {
  const civilCodes = new Set(['0070007', '0070008', '0070009', '0070010']);
  const civilTotal = roundMoney(conditionalRows.filter((row) => civilCodes.has(row.code)).reduce((sum, row) => sum + row.total, 0));
  if (civilTotal <= 0) return null;
  const item = config.catalog.items.find((row) => row.code === '0060109');
  return {
    code: item.code,
    label: item.description,
    qty: 1,
    unitPrice: roundMoney(civilTotal * 0.4),
    total: roundMoney(civilTotal * 0.4),
    unit: normalizeUnit(item.unit),
  };
}

function makeRow(item, qty, factor = 1, customLabel = null) {
  const unitPrice = roundMoney(Number(item.price || 0) * Number(factor || 1));
  const quantity = roundQty(qty);
  return {
    code: item.code,
    label: customLabel || item.description,
    qty: quantity,
    unitPrice,
    total: roundMoney(quantity * unitPrice),
    unit: normalizeUnit(item.unit),
  };
}

function sumTotals(rows) {
  return rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
}

function pickCableByDistance(distance, cables, defaults) {
  if (distance <= defaults.max6mm) return cables.find((item) => item.code === '0060102') || cables[0];
  if (distance <= defaults.max10mm) return cables.find((item) => item.code === '0060110') || cables[0];
  return cables.find((item) => item.code === '0060111') || cables[0];
}

function getDistanceFactor(distance, factors) {
  return factors.find((item) => distance <= item.upto)?.factor || factors.at(-1)?.factor || 1;
}

function normalizeConformityDeliveredItems(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  return String(value || '')
    .split(/\r?\n|,/)
    .map((item) => item.replace(/^[-•\s]+/, '').trim())
    .filter(Boolean);
}

function imageBufferFromDataUrl(value = '') {
  const raw = String(value || '').trim();
  const match = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  try {
    return { mime: match[1], buffer: Buffer.from(match[2], 'base64') };
  } catch {
    return null;
  }
}

function warrantyValidUntil(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return formatDateOnly(new Date());
  const valid = new Date(date.getFullYear() + 2, date.getMonth(), date.getDate());
  return formatDateOnly(valid);
}

function buildWarrantyCode(seed = '') {
  const raw = String(seed || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const tail = (raw || crypto.randomBytes(4).toString('hex').toUpperCase()).slice(-8);
  return `EVK-GAR-${new Date().getFullYear()}-${tail}`;
}

async function createConformityPdfBuffer({ conformity, order, quote }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const logoPath = '/root/.openclaw/workspace/.tmp/evinka_technology_logo.jpg';
    const deliveredItems = normalizeConformityDeliveredItems(conformity.deliveredItems);
    const installerSignature = imageBufferFromDataUrl(conformity.installerSignatureUrl);
    const clientSignature = imageBufferFromDataUrl(conformity.clientSignatureUrl);
    const photoBuffers = (Array.isArray(conformity.photoUrls) ? conformity.photoUrls : []).map(imageBufferFromDataUrl).filter(Boolean);
    const implementRows = [
      ['Caja del cargador', conformity.cajaCargador === true],
      ['Cargador Evinka', conformity.cargadorEvinka === true],
      ['Manual del cargador', conformity.manualCargador === true],
      ['Tarjetas del cargador', conformity.tarjetasCargador === true],
      [`Adicional: ${conformity.adicionalDesc || '-'}`, conformity.adicional === true],
    ];

    const palette = {
      navy: '#17324a',
      ink: '#101828',
      slate: '#667085',
      line: '#d5dbe5',
      section: '#eef3f8',
      soft: '#f8fafc',
    };

    if (fs.existsSync(logoPath)) doc.image(logoPath, 40, 26, { width: 54 });
    doc.font('Helvetica-Bold').fontSize(11.2).fillColor(palette.slate).text('EVINKA TECHNOLOGY S.A.S.', 102, 28, { width: 280, align: 'left' });
    doc.font('Helvetica-Bold').fontSize(15.5).fillColor(palette.navy).text('CONFORMIDAD DE INSTALACIÓN', 102, 42, { width: 320, align: 'left' });
    doc.font('Helvetica').fontSize(8.8).fillColor(palette.slate).text(`Fecha: ${formatDateOnly(conformity.date || conformity.createdAt || new Date().toISOString())}`, 420, 28, { width: 120, align: 'right' });
    let y = 30;
    if (conformity.quoteId) doc.font('Helvetica').fontSize(8.7).fillColor(palette.ink).text(`Cotización: ${conformity.quoteId}`, 375, y + 16, { width: 165, align: 'right' });
    if (conformity.installationOrderId) doc.text(`Orden: ${conformity.installationOrderId}`, 375, y + 29, { width: 165, align: 'right' });
    doc.moveTo(40, 90).lineTo(555, 90).strokeColor(palette.line).lineWidth(1).stroke();
    y = 104;

    const drawMetaCard = (x, width, title, value) => {
      const boxH = 28;
      doc.roundedRect(x, y, width, boxH, 8).fillAndStroke(palette.soft, palette.line);
      doc.font('Helvetica-Bold').fontSize(8.4).fillColor(palette.slate).text(title.toUpperCase(), x + 10, y + 6, { width: width - 20, align: 'left' });
      doc.font('Helvetica-Bold').fontSize(10.2).fillColor(palette.navy).text(String(value || '-'), x + 10, y + 15, { width: width - 20, align: 'left' });
    };
    drawMetaCard(40, 252, 'Conformidad', conformity.id || '-');
    drawMetaCard(303, 252, 'Garantía', conformity.warrantyCode || 'Pendiente de emisión');
    y += 40;

    const section = (title) => {
      y += 14;
      doc.rect(40, y, 515, 18).fill(palette.section);
      doc.fillColor(palette.navy).font('Helvetica-Bold').fontSize(9.6).text(title, 46, y + 5);
      y += 26;
    };
    const textH = (text, width, size = 10, align = 'left') => {
      doc.font('Helvetica').fontSize(size);
      return doc.heightOfString(String(text || '-'), { width, align });
    };
    const drawField = (x, width, label, value) => {
      const labelText = `${label}:`;
      const valueText = String(value || '-');
      doc.font('Helvetica-Bold').fontSize(8.6).fillColor(palette.slate).text(labelText.toUpperCase(), x, y, { width, height: 11, ellipsis: true });
      const labelHeight = textH(labelText.toUpperCase(), width, 8.6);
      doc.font('Helvetica').fontSize(10.2).fillColor(palette.ink).text(valueText, x, y + labelHeight + 2, { width, align: 'left' });
      const valueHeight = textH(valueText, width, 10.2);
      return labelHeight + 2 + valueHeight;
    };
    const drawTwoFields = (left, right, gap = 20) => {
      const leftH = drawField(left.x, left.width, left.label, left.value);
      const rightH = drawField(right.x, right.width, right.label, right.value);
      y += Math.max(leftH, rightH) + gap;
    };
    const drawBoxParagraph = (title, text) => {
      section(title);
      const content = String(text || 'Sin observaciones adicionales registradas.');
      const boxH = Math.max(40, textH(content, 500, 10, 'justify') + 14);
      doc.rect(40, y, 515, boxH).fill(palette.soft).strokeColor(palette.line).lineWidth(0.6).stroke();
      doc.font('Helvetica').fontSize(10).fillColor(palette.ink).text(content, 46, y + 6, { width: 502, align: 'justify' });
      y += boxH + 10;
    };
    const drawCheckboxRow = (label, checked) => {
      const boxX = 46;
      const boxY = y + 2;
      doc.rect(boxX, boxY, 10, 10).strokeColor(palette.navy).lineWidth(0.8).stroke();
      if (checked) {
        doc.save();
        doc.lineWidth(1.2).strokeColor(palette.navy)
          .moveTo(boxX + 2, boxY + 5)
          .lineTo(boxX + 4, boxY + 8)
          .lineTo(boxX + 8, boxY + 2)
          .stroke();
        doc.restore();
      }
      const rowText = String(label || '-');
      const rowHeight = Math.max(14, textH(rowText, 460, 10));
      doc.font('Helvetica').fontSize(10).fillColor(palette.ink).text(rowText, 64, y, { width: 460, align: 'left' });
      y += rowHeight + 4;
    };

    section('DATOS DEL CLIENTE / REPRESENTANTE');
    y += drawField(40, 515, 'Cliente', formatDisplayName(conformity.clientName) || '-') + 6;
    drawTwoFields(
      { x: 40, width: 245, label: 'RUC o DNI', value: conformity.ruc || '-' },
      { x: 310, width: 245, label: 'Correo', value: conformity.clientEmail || '-' },
      8,
    );
    y += drawField(40, 515, 'Dirección', conformity.address || '-') + 6;

    drawBoxParagraph('OBSERVACIONES / RECOMENDACIONES', conformity.observations || 'Sin observaciones adicionales registradas.');

    section('PARÁMETROS DE INSTALACIÓN');
    drawTwoFields(
      { x: 40, width: 245, label: 'Marca', value: conformity.chargerBrand || '-' },
      { x: 310, width: 245, label: 'N/S', value: conformity.serialNumber || '-' },
      8,
    );
    drawTwoFields(
      { x: 40, width: 245, label: 'Volt.', value: conformity.voltage || '-' },
      { x: 310, width: 245, label: 'Amp.', value: conformity.amperage || '-' },
      8,
    );
    drawTwoFields(
      { x: 40, width: 245, label: 'Otro', value: conformity.other || '-' },
      { x: 310, width: 245, label: 'Potencia kW', value: conformity.powerKw || '-' },
      8,
    );

    section('IMPLEMENTOS ENTREGADOS AL CLIENTE/REPRESENTANTE');
    implementRows.forEach(([label, checked]) => drawCheckboxRow(label, checked));

    section('TRAZABILIDAD DOCUMENTAL');
    const conformityTrace = buildTraceabilityLines({
      orderCode: conformity.installationOrderId || conformity.quoteId || '-',
      warrantyCode: conformity.warrantyCode || 'Pendiente de emisión',
      serialNumber: conformity.serialNumber || '-',
      record: conformity.id || conformity.installationOrderId || conformity.quoteId || '-',
    });
    conformityTrace.forEach((traceLine) => {
      const lineText = String(traceLine || '-');
      const lineHeight = textH(lineText, 515, 9.3, 'justify');
      doc.font('Helvetica').fontSize(9.3).fillColor(palette.ink).text(lineText, 40, y, { width: 515, align: 'justify' });
      y += lineHeight + 5;
    });
    y += 2;

    doc.addPage({ size: 'A4', margin: 40 });
    y = 40;

    section('DECLARACIÓN Y FIRMAS');
    const declarationText = 'EL CLIENTE/REPRESENTANTE declara recibir conforme la instalación e implementos detallados en el presente documento, salvo observaciones indicadas. Asimismo, autoriza a EVINKA el registro y uso de fotografías de la instalación y equipos con fines de soporte técnico, garantía, trazabilidad, capacitación, estudio interno y material comercial o publicitario, evitando divulgar información sensible del cliente. Los registros digitales, validaciones electrónicas, fotografías y reportes generados por los sistemas EVINKA constituyen medios válidos de conformidad y trazabilidad del servicio.';
    const declarationHeight = textH(declarationText, 515, 9);
    doc.font('Helvetica').fontSize(9).fillColor(palette.ink).text(declarationText, 40, y, { width: 515, align: 'justify' });
    y += declarationHeight + 22;
    const signatureY = y;
    const drawSignature = (x, width, label, img, fallback) => {
      if (img?.buffer) {
        try {
          doc.image(img.buffer, x + 10, signatureY - 18, { fit: [width - 20, 56] });
        } catch {
          doc.moveTo(x, signatureY + 34).lineTo(x + width, signatureY + 34).strokeColor(palette.line).lineWidth(1).stroke();
        }
      } else {
        doc.moveTo(x, signatureY + 34).lineTo(x + width, signatureY + 34).strokeColor(palette.line).lineWidth(1).stroke();
      }
      doc.font('Helvetica-Bold').fontSize(8.8).fillColor(palette.navy).text(label, x, signatureY + 44, { width, align: 'center' });
      doc.font('Helvetica').fontSize(8.3).fillColor(palette.slate).text(fallback, x, signatureY + 58, { width, align: 'center' });
    };
    drawSignature(56, 220, 'RESPONSABLE DE LA INSTALACIÓN', installerSignature, order?.assignedTechnician || order?.assignedTechEmail || 'Equipo EVINKA');
    drawSignature(310, 220, 'CLIENTE / REPRESENTANTE', clientSignature, formatDisplayName(conformity.clientName) || 'Cliente');

    if (photoBuffers.length) {
      doc.addPage({ size: 'A4', margin: 40 });
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#111').text('REGISTRO FOTOGRÁFICO DE LA INSTALACIÓN', 0, 40, { align: 'center' });
      let photoY = 88;
      photoBuffers.slice(0, 2).forEach((photo, index) => {
        doc.font('Helvetica-Bold').fontSize(10).text(`Foto ${index + 1}`, 40, photoY);
        try {
          doc.image(photo.buffer, 40, photoY + 18, { fit: [500, 280], align: 'center', valign: 'center' });
        } catch {
          doc.rect(40, photoY + 18, 500, 220).strokeColor('#999').stroke();
          doc.font('Helvetica').fontSize(10).text('No se pudo renderizar la imagen.', 180, photoY + 120);
        }
        photoY += 310;
      });
    }
    doc.end();
  });
}

async function createWarrantyPdfBuffer({ warranty, order, quote }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const logoPath = '/root/.openclaw/workspace/.tmp/evinka_technology_logo.jpg';
    const installerSignature = imageBufferFromDataUrl(warranty.installerSignatureUrl);
    const clientSignature = imageBufferFromDataUrl(warranty.clientSignatureUrl);
    if (fs.existsSync(logoPath)) doc.image(logoPath, 40, 28, { width: 58 });
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#111').text('GARANTÍA EVINKA · 2 AÑOS', 0, 44, { align: 'center' });
    doc.font('Helvetica').fontSize(10).fillColor('#555').text(`Código ${warranty.warrantyCode}`, 0, 70, { align: 'center' });
    doc.moveTo(40, 96).lineTo(555, 96).strokeColor('#d0d0d0').lineWidth(1).stroke();
    let y = 118;
    const row = (label, value) => {
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#111').text(`${label}:`, 40, y, { width: 120 });
      doc.font('Helvetica').text(String(value || '-'), 150, y, { width: 390 });
      y += 18;
    };
    row('Titular', formatDisplayName(warranty.clientName) || '-');
    row('Correo', warranty.clientEmail || '-');
    row('Documento', warranty.clientDocument || '-');
    row('Dirección', warranty.address || '-');
    row('Orden EVINKA', warranty.installationOrderId || '-');
    row('Cotización', warranty.quoteId || '-');
    row('Producto', warranty.chargerBrand || '-');
    row('Serie', warranty.serialNumber || '-');
    row('Vigencia hasta', warranty.validUntil || '-');
    y += 8;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#111').text('TRAZABILIDAD DOCUMENTAL', 40, y);
    y += 18;
    buildTraceabilityLines({
      orderCode: warranty.installationOrderId || warranty.quoteId || '-',
      warrantyCode: warranty.warrantyCode || '-',
      serialNumber: warranty.serialNumber || '-',
      record: warranty.id || warranty.warrantyCode || '-',
    }).forEach((line) => {
      doc.font('Helvetica').fontSize(9.3).fillColor('#111').text(line, 40, y, { width: 515, align: 'justify' });
      y += 14;
    });
    y += 8;
    doc.roundedRect(40, y, 515, 122, 12).fillAndStroke('#fbfaf8', '#d8c7aa');
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#8b6a3e').text('ALCANCE Y SEGURIDAD', 56, y + 14);
    doc.font('Helvetica').fontSize(9.5).fillColor('#222').text(
      buildWarrantyNote(quote),
      56,
      y + 34,
      { width: 480, align: 'justify' },
    );
    y += 150;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#111').text('CONDICIONES ESPECÍFICAS DE GARANTÍA', 40, y);
    y += 18;
    buildWarrantyLegalLines().forEach((line) => {
      doc.font('Helvetica').fontSize(9.1).fillColor('#111').text(line, 40, y, { width: 515, align: 'justify' });
      y += 32;
    });
    y += 8;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#111').text('Validación documental', 40, y);
    y += 18;
    doc.font('Helvetica').fontSize(9.5).text('EVINKA valida antecedentes, evidencia fotográfica, condiciones de seguridad y consistencia entre equipo, dirección e instalación registrada.', 40, y, { width: 515, align: 'justify' });
    y += 60;
    const drawSignature = (x, label, img, fallback) => {
      if (img?.buffer) {
        try {
          doc.image(img.buffer, x, y, { fit: [160, 56] });
        } catch {
          doc.moveTo(x, y + 38).lineTo(x + 160, y + 38).strokeColor('#999').lineWidth(0.8).stroke();
        }
      } else {
        doc.moveTo(x, y + 38).lineTo(x + 160, y + 38).strokeColor('#999').lineWidth(0.8).stroke();
      }
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#111').text(label, x, y + 46, { width: 160, align: 'center' });
      doc.font('Helvetica').fontSize(8.5).fillColor('#666').text(fallback, x, y + 60, { width: 160, align: 'center' });
    };
    drawSignature(56, 'EVINKA / Responsable técnico', installerSignature, order?.assignedTechnician || order?.assignedTechEmail || 'Equipo EVINKA');
    drawSignature(336, 'Cliente / Titular', clientSignature, formatDisplayName(warranty.clientName) || 'Cliente');
    drawFooter(doc);
    doc.end();
  });
}

async function createPdf(quote, config, filePath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    const logoPath = '/root/.openclaw/workspace/.tmp/evinka_technology_logo.jpg';
    const templateKind = quotePdfTemplateKind(quote);
    const currencyLabel = pdfCurrencyLabel(quote);
    const motorysaHeaderPath = '/root/.openclaw/workspace/.tmp/motorysa-assets/motorysa-header-strip.png';
    const motorysaCarPath = '/root/.openclaw/workspace/.tmp/motorysa-assets/motorysa-car.jpg';
    const standardCoHeaderPath = '/root/.openclaw/workspace/.tmp/co-pdf-reference/encabezado.png';
    const standardCoCarPath = '/root/.openclaw/workspace/.tmp/co-pdf-reference/carro del centro.jpg';

    let cursorY = 204;
    if (templateKind === 'motorysa' && quote.countryCode === 'CO') {
      drawMotorysaCoverPage(doc, quote, { headerStripPath: motorysaHeaderPath, carImagePath: motorysaCarPath });
      doc.addPage();
      drawMotorysaPhotoPricingPage(doc, quote);
      doc.addPage();
      drawMotorysaPaymentsPage(doc, quote);
      doc.addPage();
      drawMotorysaTermsPage(doc, quote);
    } else if (templateKind === 'standard' && quote.countryCode === 'CO') {
      drawStandardColombiaCoverPage(doc, quote, { headerPath: standardCoHeaderPath, carImagePath: standardCoCarPath });
      doc.addPage();
      drawStandardColombiaPhotoPricingPage(doc, quote, logoPath);
      renderPhotoReport(doc, quote, logoPath);
    } else {
      drawQuoteHeader(doc, quote, logoPath);
      doc.fontSize(10).font('Helvetica').text(buildGreeting(quote.clientName), 36, 160);
      doc.text(buildQuoteIntro(quote), 36, 174, { width: 523 });
      const sections = buildQuoteSectionsForPdf(quote);
      sections.forEach((section, index) => {
        cursorY = writeSectionTitle(doc, cursorY + (index === 0 ? 0 : 2), `${index + 1}. ${section.title}`, quote, logoPath);
        section.lines.forEach((line) => {
          cursorY = writePlainParagraph(doc, cursorY, line, 36, 523, quote, logoPath);
        });
        if (section.bullets?.length) {
          section.bullets.forEach((line) => {
            cursorY = writeBulletParagraph(doc, cursorY, line, 72, quote, logoPath);
          });
        }
      });

      const tableTitle = templateKind === 'motorysa' ? 'CUADRO DE PRECIOS INSTALACIÓN (NO INCLUYE CARGADOR)' : 'CUADRO DE PRECIOS - INSTALACIÓN';
      cursorY = ensurePageSpace(doc, cursorY + 10, 210, quote, logoPath, true);
      doc.font('Helvetica-Bold').fontSize(10).text(tableTitle, 36, cursorY, { width: 523 });
      cursorY += 18;
      const commercialTableBottom = drawTable(doc, [28, 38, 42, 64, 215, 68, 68], ['It.', 'Cant.', 'Unid', 'Código', 'Descripción', `Precio Unit. ${currencyLabel}`, `Total ${currencyLabel}`], quote.commercialRows.map((row, index) => [String(index + 1), formatNumber(row.qty), normalizeUnit(row.unit), row.code, row.label, pdfAmount(quote, row.unitPrice), pdfAmount(quote, row.total)]), { x: 36, y: cursorY, rowHeight: 18, headerHeight: 20, fontSize: 8.3 });

      let tailY = commercialTableBottom + 10;
      const summaryLines = [
        `SUBTOTAL INSTALACIÓN ${currencyLabel} ${pdfAmount(quote, quote.subtotal)}`,
        `IVA ${quote.countryCode === 'CO' ? '19%' : '18%'} ${currencyLabel} ${pdfAmount(quote, quote.igv)}`,
        `TOTAL INSTALACIÓN IVA INCLUIDO ${currencyLabel} ${pdfAmount(quote, quote.total)}`,
        'Nota: Este valor NO incluye el cargador.',
        `Validez de la cotización: ${quote.countryCode === 'CO' ? '7 días' : '30 días'}`,
        ...(templateKind === 'motorysa' ? ['Forma de pago: Contado'] : []),
        'Duración estimada de la instalación: 1-2 días',
        'Garantía materiales y cargador por defectos de fabricación: 1 año',
        ...(quote.countryCode === 'CO'
          ? ['La propuesta incluye autodeclaración de cumplimiento RETIE por parte del constructor. No incluye dictamen de uso final; en caso de requerirse es un costo adicional.']
          : []),
      ];
      doc.fontSize(9.2).font('Helvetica');
      summaryLines.forEach((line) => {
        tailY = writePlainParagraph(doc, tailY, line, 36, 523, quote, logoPath);
      });

      tailY += 6;
      tailY = writeSectionTitle(doc, tailY, 'Observaciones', quote, logoPath);
      for (const line of buildObservationLines(quote)) {
        tailY = writeBulletParagraph(doc, tailY, line, 72, quote, logoPath);
      }
      if (String(quote.technicianNotes || '').trim()) {
        tailY = writePlainParagraph(doc, tailY + 4, `Observaciones técnicas adicionales: ${String(quote.technicianNotes || '').trim()}`, 36, 523, quote, logoPath);
      }
      tailY = writeSignatureBlock(doc, tailY + 10, quote, logoPath);

      drawFooter(doc, quote);
      renderPhotoReport(doc, quote, logoPath);
    }

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

function drawMotorysaPaymentsPage(doc, quote = {}) {
  const x = 36;
  const width = 523;
  doc.font('Helvetica-Bold').fontSize(24).fillColor('#222').text('Motorysa', x, 28, { width, align: 'right' });
  doc.rect(x, 64, width, 10).fill('#ff120a');
  let y = 92;
  doc.fillColor('#111').font('Helvetica-Bold').fontSize(12).text('Cuentas autorizadas para pagos', x, y, { width });
  y += 20;
  doc.font('Helvetica').fontSize(10).text('A continuación, nos permitimos informar los medios de pago establecidos por Motorysa:', x, y, { width, align: 'justify' });
  y += 18;
  doc.font('Helvetica').fontSize(9.8).text('✓ Efectivo    ✓ Tarjeta débito    ✓ Tarjeta crédito    ✓ Consignaciones o transferencias bancarias    ✓ Cheques al día', x, y, { width, align: 'left' });
  y += 28;
  doc.font('Helvetica-Bold').fontSize(10.2).fillColor('#d71920').text('TARJETAS DÉBITO Y CRÉDITO', x, y, { width });
  y += 16;
  doc.font('Helvetica').fontSize(9.6).fillColor('#111').text('Estos mecanismos de pago requieren presentación personal del titular en la caja.', x, y, { width });
  y += 24;
  doc.font('Helvetica-Bold').fontSize(10.2).fillColor('#d71920').text('CONSIGNACIONES O TRANSFERENCIAS BANCARIAS', x, y, { width });
  y += 16;
  doc.font('Helvetica').fontSize(9.6).fillColor('#111').text('Los pagos podrán ser realizados en los siguientes bancos:', x, y, { width });
  y += 18;
  y = drawMotorysaBankTable(doc, x, y, width);
  y += 14;
  doc.font('Helvetica-Bold').fontSize(9.8).text('Titular cuenta', x, y, { width });
  y += 15;
  doc.font('Helvetica-Bold').fontSize(9.6).text('Motores y Máquinas S.A. – Motorysa.', x, y, { width });
  y += 14;
  doc.font('Helvetica-Bold').fontSize(9.2).text('NIT. 860.019.063-8', x, y, { width });
  y += 18;
  doc.font('Helvetica').fontSize(9.4).text('Favor remitir soporte de pago a su asesor.', x, y, { width });
  y += 22;
  doc.font('Helvetica-Bold').fontSize(10.2).fillColor('#d71920').text('CHEQUES', x, y, { width });
  y += 16;
  doc.font('Helvetica').fontSize(9.2).fillColor('#111').text('Deben ser girados únicamente a nombre de Motorysa, utilizando las siguientes posibilidades de detalle en la casilla "páguese a:".', x, y, { width, align: 'justify' });
  y += 28;
  doc.font('Helvetica').fontSize(9.2).text('Motores y Máquinas S.A. - Motorysa    |    Motores y Máquinas S.A.    |    Motorysa', x, y, { width });
}

function drawMotorysaBankTable(doc, x, y, width) {
  const border = '#777';
  const red = '#e11';
  const cols = [66, 60, 52, 82, 98, 82, 83];
  const banks = [
    ['Banco Agrario', 'Corriente', '0850-\n012071-\n5', '4'],
    ['Banco Av\nVillas', 'Ahorros', '059-\n00352-5', '3'],
    ['Banco de\nBogotá', 'Corriente', '000-\n34439-0', '3'],
    ['Banco\nDavivienda', 'Corriente', '1080-\n29160-6', '4'],
    ['Banco de\nCrédito', 'Ahorros', '010-\n35137-9', '3'],
    ['Banco de\nOccidente', 'Corriente', '256-\n05628-4', '3'],
  ];
  const h1 = 24;
  const h2 = 22;
  const h3 = 22;
  const rowH = 38;
  const cell = (cx, cy, w, h, text, { bold = false, color = '#111', align = 'center', fontSize = 8.2, paddingY = 5 } = {}) => {
    doc.rect(cx, cy, w, h).lineWidth(0.6).strokeColor(border).stroke();
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize).fillColor(color).text(String(text || ''), cx + 4, cy + paddingY, { width: w - 8, align });
  };
  let cx = x;
  cell(cx, y, cols[0], h1 + h2 + h3, 'ENTIDAD', { bold: true, color: red, fontSize: 8.6, paddingY: 24 }); cx += cols[0];
  cell(cx, y, cols[1], h1 + h2 + h3, 'TIPO DE\nCUENTA', { bold: true, color: red, fontSize: 8.4, paddingY: 20 }); cx += cols[1];
  cell(cx, y, cols[2], h1 + h2 + h3, '# DE\nCUENTA', { bold: true, color: red, fontSize: 8.4, paddingY: 20 }); cx += cols[2];
  cell(cx, y, cols[3] + cols[4] + cols[5] + cols[6], h1, 'TIEMPO DE CONFIRMACIÓN', { bold: true, color: red, fontSize: 8.6 });
  cell(cx, y + h1, cols[3] + cols[4], h2, 'CONSIGNACIÓN', { bold: true, color: red, fontSize: 8.4 });
  cell(cx + cols[3] + cols[4], y + h1, cols[5] + cols[6], h2, 'TRANSFERENCIA ACH', { bold: true, color: red, fontSize: 8.4 });
  cell(cx, y + h1 + h2, cols[3], h3, 'CHEQUE (Días\nHábiles)', { bold: true, color: red, fontSize: 7.8 });
  cell(cx + cols[3], y + h1 + h2, cols[4], h3, 'EFECTIVO', { bold: true, color: red, fontSize: 8 });
  cell(cx + cols[3] + cols[4], y + h1 + h2, cols[5], h3, 'Antes de\nlas 11 am', { bold: true, color: red, fontSize: 7.8 });
  cell(cx + cols[3] + cols[4] + cols[5], y + h1 + h2, cols[6], h3, 'Después de\nlas 11 am', { bold: true, color: red, fontSize: 7.8 });

  const dataTop = y + h1 + h2 + h3;
  const dataHeight = rowH * 6;
  const confX = x + cols[0] + cols[1] + cols[2];
  const chequeX = confX;
  const efectivoX = confX + cols[3];
  const beforeX = efectivoX + cols[4];
  const afterX = beforeX + cols[5];

  // Primeras tres columnas sí van por fila.
  let rowY = dataTop;
  banks.forEach((row) => {
    let currentX = x;
    row.slice(0, 3).forEach((value, index) => {
      cell(currentX, rowY, cols[index], rowH, value, { align: index === 0 ? 'left' : 'center', fontSize: 8.4, paddingY: 10 });
      currentX += cols[index];
    });
    rowY += rowH;
  });

  // CONSIGNACIÓN
  let consY = dataTop;
  ['4', '3', '3', '4', '3', '3'].forEach((value) => {
    cell(chequeX, consY, cols[3], rowH, value, { fontSize: 8.6, paddingY: 10 });
    consY += rowH;
  });
  cell(efectivoX, dataTop, cols[4], dataHeight / 2, 'Después 3pm, día\nhábil siguiente', { fontSize: 8.4, paddingY: 46 });
  cell(efectivoX, dataTop + (dataHeight / 2), cols[4], dataHeight / 2, '1 Hora', { fontSize: 8.8, paddingY: 54 });

  // TRANSFERENCIA ACH: encabezados arriba y abajo un solo rectángulo grande por columna.
  cell(beforeX, dataTop, cols[5], dataHeight, '1 Hora', { fontSize: 8.8, paddingY: 96 });
  cell(afterX, dataTop, cols[6], dataHeight, '8 am Día Hábil\nsiguiente', { fontSize: 8.4, paddingY: 92 });

  return dataTop + dataHeight;
}

function drawMotorysaTermsPage(doc, quote = {}) {
  const x = 36;
  const width = 523;
  doc.font('Helvetica-Bold').fontSize(24).fillColor('#222').text('Motorysa', x, 28, { width, align: 'right' });
  doc.rect(x, 64, width, 10).fill('#ff120a');
  let y = 92;
  doc.fillColor('#111').font('Helvetica').fontSize(9.4).text('Para el diligenciamiento de sus cheques, favor tener en cuenta las siguientes recomendaciones:', x, y, { width, align: 'justify' });
  y += 22;
  const chequeTips = [
    'Los cheques deben venir perfectamente diligenciados, sin enmendaduras, tachones, borrones, rotos, pegados, cinta, perforaciones, etc.',
    'No pueden ser diligenciados en dos tintas; se debe usar un solo color.',
    'La fecha del cheque debe coincidir con la fecha de pago, excepto en el caso de cheques posfechados.',
    'Los cheques de persona natural deben ser diligenciados de puño y letra del cliente.',
    'Los únicos cheques que se reciben diligenciados a máquina son aquellos girados por una persona jurídica.',
  ];
  chequeTips.forEach((line, index) => {
    doc.font('Helvetica').fontSize(9.2).text(`${index + 1}.-`, x + 10, y, { width: 18 });
    doc.text(line, x + 30, y, { width: width - 30, align: 'justify' });
    y = doc.y + 4;
  });
  y += 8;
  doc.font('Helvetica').fontSize(9.2).text('Todos los pagos recibidos en cheque deben ser previamente autorizados por la compañía avaladora. Por tal motivo, es necesario que el girador firme el formato de autorización establecido por cada entidad. Para efectos de confirmación, la compañía avaladora podrá solicitar documentación adicional al cliente. En caso de cheque de persona jurídica, es necesario el sello de la compañía junto con la firma del representante legal.', x, y, { width, align: 'justify' });
  y = doc.y + 18;
  doc.font('Helvetica-Bold').fontSize(10).text('Departamento financiero', x, y, { width });
  y += 24;
  doc.font('Helvetica-Bold').fontSize(12).text('TÉRMINOS Y CONDICIONES', x, y, { width, align: 'center' });
  y += 28;
  const terms = [
    {
      title: '1. Al momento de realizar el pago se entienden como aceptadas y comprendidas las condiciones aquí definidas.',
      body: [
        'Se debe tener en cuenta y coordinar lo siguiente:',
        '• Gestión de permisos ante la administración (si aplica), ingreso a las instalaciones y garantizar espacios de trabajo libres.',
        '• Tener el cargador eléctrico del vehículo en el sitio donde será instalado.',
        '• Realizar el pago de la instalación y enviar el comprobante al WhatsApp 3102195110 para proceder con el agendamiento del servicio.',
      ],
    },
    {
      title: '2. La cancelación o reprogramación del servicio deberá ser solicitada como mínimo 24 horas antes de la fecha y hora programada.',
      body: [],
    },
    {
      title: '3. En caso de cancelación del servicio por motivos ajenos a Motorysa (ejemplo: no disponer de permisos de administración), se cobrará un valor correspondiente al stand by y transporte del personal de $300.000 (+ viáticos para zonas rurales o municipios fuera del casco urbano). La reprogramación del servicio quedará sujeta al pago de este valor y a la disponibilidad del personal.',
      body: [],
    },
    {
      title: '4. La conexión del cargador no interviene en ningún momento el medidor de energía ni requiere manipulación de sellos. La conexión se realiza después del medidor, tal como lo avala el RETIE (Libro 3, artículo 2), permitiendo estas intervenciones a profesionales del área eléctrica sin necesidad de aprobaciones directas o escritas por parte del Operador de Red (ej.: Codensa, Celsa, Aire, etc.).',
      body: [],
    },
    {
      title: '5. Los materiales utilizados son nuevos, de marcas reconocidas y cuentan con certificado de producto RETIE, lo que garantiza su calidad y cumplimiento normativo.',
      body: [],
    },
  ];
  terms.forEach((term) => {
    doc.font('Helvetica-Bold').fontSize(9.2).text(term.title, x, y, { width, align: 'justify' });
    y = doc.y + 6;
    term.body.forEach((line) => {
      const isLead = !line.startsWith('•');
      doc.font(isLead ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).text(line, isLead ? x : x + 12, y, { width: isLead ? width : width - 12, align: 'justify' });
      y = doc.y + 4;
    });
    y += 8;
  });
}

function renderPhotoReport(doc, quote, logoPath) {
  const photos = Array.isArray(quote?.photos) ? quote.photos.filter((photo) => fs.existsSync(photo.filePath)) : [];
  if (!photos.length) return;

  photos.forEach((photo, index) => {
    doc.addPage();
    drawPhotoReportHeader(doc, quote, logoPath);
    const frameX = 54;
    const frameY = 150;
    const frameW = 487;
    const imageInset = 16;
    const maxFrameBottom = 654;
    const maxFrameHeight = maxFrameBottom - frameY;
    const baseImageAreaH = 286;
    const minImageAreaH = 190;
    const title = String(photo.title || '').trim();
    const comment = String(photo.comment || '').trim();
    const titleText = `Ilustración ${index + 1}.${title ? ` ${title}` : ''}`;
    const titleWidth = frameW - 48;
    const commentWidth = frameW - 76;
    const titleHeight = Math.max(16, doc.font('Helvetica-Bold').fontSize(11).heightOfString(titleText, { width: titleWidth, align: 'center' }));
    const commentHeight = comment
      ? doc.font('Helvetica').fontSize(9.2).heightOfString(comment, { width: commentWidth, align: 'center', lineGap: 2 })
      : 0;
    const textBlockHeight = titleHeight + (comment ? 16 + commentHeight : 0);
    const imageAreaH = Math.max(minImageAreaH, Math.min(baseImageAreaH, maxFrameHeight - imageInset - textBlockHeight - 40));
    const frameH = imageInset + imageAreaH + 24 + textBlockHeight + 24;

    doc.roundedRect(frameX, frameY, frameW, frameH, 18).lineWidth(1).fillAndStroke('#fbfaf8', '#d8c7aa');
    doc.roundedRect(frameX + imageInset, frameY + imageInset, frameW - (imageInset * 2), imageAreaH, 14).lineWidth(0.8).strokeColor('#d8c7aa').stroke();
    try {
      drawCoverPhotoInFrame(doc, photo.filePath, frameX + imageInset + 8, frameY + imageInset + 8, frameW - (imageInset * 2) - 16, imageAreaH - 16, photo.frame);
    } catch {
      doc.font('Helvetica').fontSize(10).fillColor('#666').text('No se pudo cargar la imagen.', frameX + 24, frameY + 120, { width: frameW - 48, align: 'center' });
    }

    const titleY = frameY + imageInset + imageAreaH + 24;
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#8b6a3e').text(titleText, frameX + 24, titleY, { width: frameW - 48, align: 'center' });
    if (comment) {
      doc.font('Helvetica').fontSize(9.2).fillColor('#444').text(comment, frameX + 38, titleY + titleHeight + 16, { width: frameW - 76, align: 'center', lineGap: 2 });
    }
    drawFooter(doc);
  });
}

function drawPhotoReportHeader(doc, quote, logoPath) {
  if (fs.existsSync(logoPath)) doc.image(logoPath, 54, 34, { width: 44 });
  doc.moveTo(54, 84).lineTo(541, 84).strokeColor('#d8c7aa').lineWidth(1.2).stroke();
  doc.font('Helvetica-Bold').fontSize(19).fillColor('#111').text('Informe fotográfico', 54, 96);
  doc.font('Helvetica').fontSize(9.6).fillColor('#5b5b5b').text('Registro visual complementario de la propuesta comercial y validación técnica del sitio.', 54, 118, { width: 330 });

  doc.font('Helvetica-Bold').fontSize(9.2).fillColor('#8b6a3e').text('Documento asociado', 390, 98, { width: 150, align: 'right' });
  doc.font('Helvetica').fontSize(9.2).fillColor('#111').text(`Cotización ${displayQuoteNumber(quote.id)}`, 390, 114, { width: 150, align: 'right' });
  doc.text(`${formatDisplayName(quote.clientName) || 'Cliente EVINKA'}`, 390, 128, { width: 150, align: 'right' });
}

function drawQuoteHeader(doc, quote, logoPath) {
  if (fs.existsSync(logoPath)) doc.image(logoPath, 36, 20, { width: 52 });
  doc.fontSize(18).fillColor('#111').font('Helvetica-Bold').text(`COTIZACION N° : ${displayQuoteNumber(quote.id)}`, 0, 52, { align: 'center' });
  const leftX = 36;
  const rightX = 355;
  let y = 96;
  doc.fontSize(10).font('Helvetica');
  drawKeyValue(doc, leftX, y, 'Cliente', formatDisplayName(quote.clientName) || '-', { labelWidth: 76, valueWidth: 170 }); y += 18;
  drawKeyValue(doc, leftX, y, 'Ciudad', quote.city || '-', { labelWidth: 76, valueWidth: 170 }); y += 18;
  drawKeyValue(doc, leftX, y, 'Instalación', quote.installationType || '-', { labelWidth: 76, valueWidth: 170 }); y += 18;
  drawKeyValue(doc, leftX, y, 'Asesor', displayAdvisorName(quote.createdBy?.name), { labelWidth: 76, valueWidth: 170 });
  y = 96;
  drawKeyValue(doc, rightX, y, 'Fecha', formatDateOnly(quote.createdAt), { labelWidth: 74, valueWidth: 110 }); y += 18;
  drawKeyValue(doc, rightX, y, 'Cotización', displayQuoteNumber(quote.id), { labelWidth: 74, valueWidth: 110 }); y += 18;
  drawKeyValue(doc, rightX, y, 'Moneda', quote.countryCode === 'CO' ? 'PESOS' : 'SOLES', { labelWidth: 74, valueWidth: 110 }); y += 18;
  drawKeyValue(doc, rightX, y, 'Inmueble', quote.propertyType || '-', { labelWidth: 74, valueWidth: 110 });
}

function drawMotorysaCoverPage(doc, quote, { headerStripPath, carImagePath } = {}) {
  const contentX = 36;
  const contentW = 523;
  doc.font('Helvetica-Bold').fontSize(28).fillColor('#222').text('Motorysa', contentX, 42, { width: contentW - 12, align: 'right' });
  doc.rect(contentX, 92, contentW, 12).fill('#ff120a');
  let y = 128;
  y = drawMotorysaCoverInfoTable(doc, y, quote);
  doc.font('Helvetica').fontSize(11).fillColor('#111').text('Es un placer presentarle la siguiente propuesta, elaborada en respuesta a su solicitud: suministro y/o instalación de cargador para vehículo eléctrico.', contentX, y + 10, { width: contentW, align: 'justify' });
  y += 48;
  if (carImagePath && fs.existsSync(carImagePath)) {
    try {
      const carImage = doc.openImage(carImagePath);
      const targetWidth = contentW;
      const scaledHeight = (carImage.height / carImage.width) * targetWidth;
      doc.image(carImagePath, contentX, y, { width: targetWidth });
      y += scaledHeight + 8;
    } catch {
      doc.image(carImagePath, contentX, y, { width: contentW });
      y += 252;
    }
  }
  const sections = buildMotorysaCoverSections(quote);
  sections.forEach((section) => {
    doc.font('Helvetica-Bold').fontSize(12).text(`${section.index}. ${section.title}`, contentX, y, { width: contentW });
    y += 14;
    doc.font('Helvetica').fontSize(10.2).text(section.body, contentX, y, { width: contentW, align: 'justify' });
    y = doc.y + 9;
  });
  return y;
}

function drawStandardColombiaCoverPage(doc, quote = {}, { headerPath, carImagePath } = {}) {
  const contentX = 36;
  const contentW = 520;
  const brand = '#b7854a';
  const topY = drawStandardColombiaHeaderAsset(doc, headerPath);
  let y = drawStandardColombiaCoverInfoBlock(doc, topY + 14, quote, { contentX, contentW });

  const intro = 'Es un placer presentarle la siguiente propuesta, elaborada en respuesta a su solicitud: suministro y/o instalación de cargador para su vehículo eléctrico.';
  doc.font('Helvetica').fontSize(10.1).fillColor('#111').text(intro, contentX, y, { width: contentW, align: 'left', lineGap: 1 });
  y = doc.y + 10;

  y = drawStandardColombiaCoverImage(doc, y, carImagePath, { x: 0, width: doc.page.width, maxHeight: 228 }) + 12;

  const sections = buildStandardColombiaCoverSections(quote);
  sections.forEach((section) => {
    y = drawStandardColombiaCoverSection(doc, y, section, { contentX, contentW, brand });
  });

  return y;
}

function drawStandardColombiaHeaderAsset(doc, headerPath = '') {
  const defaultBottomY = 102;
  if (!headerPath || !fs.existsSync(headerPath)) return defaultBottomY;
  try {
    const headerImage = doc.openImage(headerPath);
    const targetWidth = doc.page.width;
    const scaledHeight = (headerImage.height / headerImage.width) * targetWidth;
    doc.image(headerPath, 0, 0, { width: targetWidth });
    return scaledHeight;
  } catch {
    doc.image(headerPath, 0, 0, { fit: [doc.page.width, 120], align: 'center' });
    return 108;
  }
}

function drawStandardColombiaCoverInfoBlock(doc, startY, quote = {}, { contentX = 36, contentW = 520 } = {}) {
  const leftWidth = 250;
  const rightX = contentX + 304;
  const rightWidth = Math.max(120, contentW - (rightX - contentX));
  const brand = '#b7854a';
  let y = startY;

  doc.font('Helvetica').fontSize(10.1).fillColor(brand).text('Señor (a):', contentX, y, { width: leftWidth, align: 'left' });
  y = doc.y + 4;

  const lines = [
    formatDisplayName(quote.clientName) || '-',
    `Celular:  ${quote.phone || '-'}`,
    `Dirección:  ${quote.address || '-'}`,
    `Ciudad:  ${quote.city || '-'}`,
    `Fecha:  ${formatDateLongCo(quote.visitDate || quote.createdAt)}`,
  ];
  doc.font('Helvetica').fontSize(10).fillColor('#111');
  lines.forEach((line, index) => {
    doc.text(line, contentX, y, { width: leftWidth, align: 'left' });
    y = doc.y + (index === 0 ? 4 : 3);
  });

  doc.font('Helvetica').fontSize(10).fillColor('#111').text(`Cotización:  ${displayQuoteNumber(quote.id)}`, rightX, startY + 30, { width: rightWidth, align: 'left' });
  return Math.max(y, startY + 80) + 4;
}

function drawStandardColombiaCoverImage(doc, startY, imagePath = '', { x = 0, width = 595.28, maxHeight = 228 } = {}) {
  if (!imagePath || !fs.existsSync(imagePath)) return startY;
  try {
    const image = doc.openImage(imagePath);
    const scaledHeight = (image.height / image.width) * width;
    const renderHeight = Math.min(maxHeight, scaledHeight);
    doc.image(imagePath, x, startY, { fit: [width, renderHeight], align: 'center', valign: 'center' });
    return startY + renderHeight;
  } catch {
    doc.image(imagePath, x, startY, { width });
    return doc.y || (startY + maxHeight);
  }
}

function drawStandardColombiaCoverSection(doc, startY, section = {}, { contentX = 36, contentW = 520, brand = '#b7854a' } = {}) {
  const title = `${section.index}. ${section.title}: `;
  const bodyLines = (Array.isArray(section.body) ? section.body : [section.body]).filter(Boolean);
  if (!bodyLines.length) return startY;
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(brand).text(title, contentX, startY, { width: contentW, continued: true, align: 'left' });
  doc.font('Helvetica').fontSize(9.5).fillColor('#111').text(bodyLines[0], { width: contentW, align: 'justify', lineGap: 1 });
  let y = doc.y + 6;
  for (const line of bodyLines.slice(1)) {
    doc.font('Helvetica').fontSize(9.5).fillColor('#111').text(line, contentX, y, { width: contentW, align: 'justify', lineGap: 1 });
    y = doc.y + 5;
  }
  return y + 6;
}

function buildStandardColombiaCoverSections(quote = {}) {
  const chargerPower = resolveQuoteChargerPowerLabel(quote);
  const chargerText = chargerPower ? `${chargerPower} kW` : '7 kW';
  return [
    {
      index: 1,
      title: 'Alcance',
      body: `Suministro y/o instalación de cargador eléctrico de ${chargerText} para su vehículo, incluyendo mano de obra especializada, materiales de primera calidad, pruebas de funcionamiento y puesta en marcha.`,
    },
    {
      index: 2,
      title: 'Condiciones de instalación',
      body: 'Los trabajos se ejecutarán bajo el cumplimiento estricto de la normativa vigente: IEC 61851-1, NTC 2050 (segunda actualización) y el Reglamento Técnico de Instalaciones Eléctricas – RETIE 2024, garantizando seguridad, calidad y confiabilidad en el servicio.',
    },
    {
      index: 3,
      title: 'Personal a cargo',
      body: 'La instalación estará a cargo de personal altamente calificado: un técnico electricista con matrícula profesional vigente, acompañado, de ser necesario, por personal de apoyo. Todo el equipo cuenta con elementos de protección personal y el cumplimiento actualizado de sus obligaciones parafiscales.',
    },
    {
      index: 4,
      title: 'Responsabilidad del cliente',
      body: 'Será responsabilidad del cliente gestionar los permisos y autorizaciones correspondientes ante la administración, tanto para el ingreso vehicular como para el personal encargado de la instalación.',
    },
    {
      index: 5,
      title: 'Observaciones de la instalación',
      body: buildStandardColombiaObservationLines(quote),
    },
  ];
}

function buildStandardColombiaObservationLines(quote = {}) {
  const lines = [];
  const distance = Number(quote.distance || 0);
  if (distance > 0) {
    lines.push(`La acometida saldrá desde el medidor hasta el punto de instalación del cargador a una distancia aproximada de ${formatNumber(distance)}m, el cableado saldrá por la parte superior del tablero del medidor en tubería ${String(quote.tubeType || 'EMT').toLowerCase()} 3/4 hasta llegar al punto de instalación.`);
  }
  if (String(quote.voltage || '').trim()) {
    lines.push(`El cargador quedará a una tensión de ${String(quote.voltage).trim()}V.`);
  }
  const technicianNotes = String(quote.technicianNotes || '').trim();
  const installationDescription = String(quote.installationDescription || '').trim();
  const source = technicianNotes || installationDescription;
  if (source) {
    source
      .split(/\r?\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => lines.push(line));
  }
  if (!lines.length) {
    lines.push('La propuesta económica podrá ajustarse luego de la validación final en sitio, recorrido definitivo, canalización disponible, protecciones requeridas y condiciones reales del punto de instalación.');
  }
  return lines;
}

function drawStandardColombiaPhotoPricingPage(doc, quote = {}, logoPath = '') {
  drawStandardColombiaPhotoReportHeader(doc, quote, logoPath);
  const photoBottom = drawStandardColombiaPhotoGrid(doc, 24, 90, 547, 210, quote);
  let y = photoBottom + 18;
  y = drawStandardColombiaPricingSummaryTable(doc, 24, y, 547, quote);
  y = drawStandardColombiaPricingNotes(doc, 24, y + 14, 547, quote);
  drawStandardColombiaCompanyFooter(doc, 24, Math.max(y + 8, 734), 547, quote);
}

function drawStandardColombiaPhotoReportHeader(doc, quote = {}, logoPath = '') {
  const lineY = 58;
  doc.moveTo(24, lineY).lineTo(571, lineY).strokeColor('#d8c7aa').lineWidth(1.2).stroke();
  doc.font('Helvetica-Bold').fontSize(10.8).fillColor('#b7854a').text('6. Registro fotográfico', 24, 74, { width: 180, align: 'left' });
}

function drawCoverPhotoInFrame(doc, imagePath, x, y, width, height, frame = {}) {
  const safeFrame = sanitizePhotoFrame(frame);
  const image = doc.openImage(imagePath);
  if (!image?.width || !image?.height) {
    doc.image(imagePath, x, y, { fit: [width, height], align: 'center', valign: 'center' });
    return;
  }
  const baseScale = Math.max(width / image.width, height / image.height);
  const scale = baseScale * safeFrame.zoom;
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const desiredX = x + (width / 2) - (drawWidth * safeFrame.focusX);
  const desiredY = y + (height / 2) - (drawHeight * safeFrame.focusY);
  const minX = x + width - drawWidth;
  const minY = y + height - drawHeight;
  const imageX = drawWidth <= width ? x + ((width - drawWidth) / 2) : Math.min(x, Math.max(minX, desiredX));
  const imageY = drawHeight <= height ? y + ((height - drawHeight) / 2) : Math.min(y, Math.max(minY, desiredY));
  doc.save();
  doc.rect(x, y, width, height).clip();
  doc.image(imagePath, imageX, imageY, { width: drawWidth, height: drawHeight });
  doc.restore();
}

function drawStandardColombiaPhotoGrid(doc, x, y, width, height, quote = {}) {
  const photos = Array.isArray(quote?.photos) ? quote.photos.filter((photo) => fs.existsSync(photo.filePath)).slice(0, 4) : [];
  const cols = 4;
  const cellW = width / cols;
  const border = '#111';
  doc.rect(x, y, width, height).lineWidth(1).strokeColor(border).stroke();
  for (let index = 0; index < cols; index += 1) {
    const cx = x + (index * cellW);
    if (index > 0) {
      doc.moveTo(cx, y).lineTo(cx, y + height).lineWidth(0.8).strokeColor(border).stroke();
    }
    const photo = photos[index];
    if (photo?.filePath) {
      try {
        drawCoverPhotoInFrame(doc, photo.filePath, cx + 2, y + 2, cellW - 4, height - 4, photo.frame);
      } catch {
        doc.font('Helvetica').fontSize(8.5).fillColor('#777').text(`Foto ${index + 1}`, cx, y + (height / 2) - 4, { width: cellW, align: 'center' });
      }
    } else {
      doc.font('Helvetica').fontSize(8.5).fillColor('#777').text(`Foto ${index + 1}`, cx, y + (height / 2) - 4, { width: cellW, align: 'center' });
    }
  }
  doc.fillColor('#111');
  return y + height;
}

function drawStandardColombiaPricingSummaryTable(doc, x, y, width, quote = {}) {
  const border = '#5a5a5a';
  const grey = '#d9d9d9';
  const gold = '#d2a15f';
  const leftW = 410;
  const rightW = width - leftW;
  const laborDescW = 258;
  const laborUnitW = 134;
  const laborQtyW = width - laborDescW - laborUnitW;
  const materialH = 82;

  const cell = (cx, cy, w, h, text, { fill = '#fff', bold = false, align = 'left', fontSize = 9.2, color = '#111', paddingX = 10, paddingY = 6, lineWidth = 0.8 } = {}) => {
    doc.rect(cx, cy, w, h).lineWidth(lineWidth).fillAndStroke(fill, border);
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize).fillColor(color).text(String(text ?? ''), cx + paddingX, cy + paddingY, { width: w - (paddingX * 2), align });
  };

  cell(x, y, width, 24, 'CUADRO DE PRECIOS - INSTALACIÓN', { fill: gold, bold: false, align: 'center', fontSize: 9.6, color: '#fff', paddingY: 5 });
  y += 24;

  cell(x, y, laborDescW, 28, 'MANO DE OBRA', { fill: grey, align: 'center', fontSize: 9.3, paddingY: 6 });
  cell(x + laborDescW, y, laborUnitW, 28, 'UNIDAD', { fill: grey, align: 'center', fontSize: 9.3, paddingY: 6 });
  cell(x + laborDescW + laborUnitW, y, laborQtyW, 28, 'CANTIDAD', { fill: grey, align: 'center', fontSize: 9.3, paddingY: 6 });
  y += 28;

  cell(x, y, laborDescW, 28, 'Técnico electricista certificado', { fontSize: 8.9, paddingY: 7 });
  cell(x + laborDescW, y, laborUnitW, 28, 'GL', { align: 'center', fontSize: 8.9, paddingY: 7 });
  cell(x + laborDescW + laborUnitW, y, laborQtyW, 28, '1', { align: 'center', fontSize: 8.9, paddingY: 7 });
  y += 28;

  cell(x, y, laborDescW, 28, 'Transporte y herramientas', { fontSize: 8.9, paddingY: 7 });
  cell(x + laborDescW, y, laborUnitW, 28, 'GL', { align: 'center', fontSize: 8.9, paddingY: 7 });
  cell(x + laborDescW + laborUnitW, y, laborQtyW, 28, '1', { align: 'center', fontSize: 8.9, paddingY: 7 });
  y += 28;

  cell(x, y, laborDescW, 28, 'MATERIAL', { fill: grey, align: 'center', fontSize: 9.3, paddingY: 6 });
  cell(x + laborDescW, y, laborUnitW, 28, 'UNIDAD', { fill: grey, align: 'center', fontSize: 9.3, paddingY: 6 });
  cell(x + laborDescW + laborUnitW, y, laborQtyW, 28, 'CANTIDAD', { fill: grey, align: 'center', fontSize: 9.3, paddingY: 6 });
  y += 28;

  const materialText = 'Cable, tubería, protecciones\neléctricas, accesorios y demás\nelementos necesarios para una\ninstalación segura y en correcto\nfuncionamiento.';
  cell(x, y, laborDescW, materialH, materialText, { fontSize: 8.7, paddingY: 10 });
  cell(x + laborDescW, y, laborUnitW, materialH, 'GL', { align: 'center', fontSize: 8.9, paddingY: 30 });
  cell(x + laborDescW + laborUnitW, y, laborQtyW, materialH, '1', { align: 'center', fontSize: 8.9, paddingY: 30 });
  y += materialH;

  cell(x, y, leftW, 30, 'SUBTOTAL INSTALACION', { fill: grey, align: 'center', fontSize: 9.3, paddingY: 7 });
  cell(x + leftW, y, rightW, 30, `$ ${pdfAmount(quote, quote.subtotal)}`, { fill: grey, align: 'right', fontSize: 9.3, paddingY: 7 });
  y += 30;

  cell(x, y, leftW, 30, `IVA ${quote.countryCode === 'CO' ? '19%' : '18%'}`, { align: 'center', fontSize: 9.3, paddingY: 7 });
  cell(x + leftW, y, rightW, 30, `$ ${pdfAmount(quote, quote.igv)}`, { align: 'right', fontSize: 9.3, paddingY: 7 });
  y += 30;

  cell(x, y, leftW, 32, 'TOTAL INSTALACIÓN IVA INCLUIDO', { fill: gold, align: 'center', fontSize: 9.5, paddingY: 8 });
  cell(x + leftW, y, rightW, 32, `$ ${pdfAmount(quote, quote.total)}`, { fill: gold, align: 'right', fontSize: 9.5, paddingY: 8 });
  return y + 32;
}

function drawStandardColombiaPricingNotes(doc, x, y, width, quote = {}) {
  doc.font('Helvetica').fontSize(8.9).fillColor('#111').text('Nota: Este valor NO incluye el cargador.', x, y, { width, align: 'center' });
  y = doc.y + 8;
  const notes = [
    'Validez de la cotización: 7 dias',
    'Duración estimada de la Instalación: 1-2 dias',
    'Garantia materiales y cargador por defectos de fabricación: 1 año',
  ];
  notes.forEach((line) => {
    doc.font('Helvetica').fontSize(8.3).fillColor('#111').text(line, x, y, { width, align: 'left' });
    y = doc.y + 1;
  });
  doc.font('Helvetica').fontSize(8.3).fillColor('#ff1c1c').text('La propuesta incluye autodeclaración de cumplimiento RETIE por parte del constructor. No incluye dictamen de uso final, en caso de requerirse es un adicional.', x, y + 2, { width, align: 'left', lineGap: 0.5 });
  return doc.y;
}

function drawStandardColombiaCompanyFooter(doc, x, y, width, quote = {}) {
  doc.font('Helvetica-Bold').fontSize(8.7).fillColor('#e31c23').text('EVINKA TECHNOLOGY S.A.S.', x + 16, y, { width, align: 'left' });
  doc.font('Helvetica').fontSize(7.9).fillColor('#e31c23').text('Soluciones de movilidad eléctrica, instalación, soporte técnico y operación comercial.', x + 16, y + 14, { width, align: 'left' });
  doc.fillColor('#111').fontSize(8.1).text(`Contacto: ${quote?.countryCode === 'CO' ? '302 436 1227' : '949076102'} · contacto@evinka.tech`, x + 16, y + 28, { width, align: 'left' });
  doc.text('Pag.Web: evinka.tech', x + 16, y + 40, { width, align: 'left' });
}

function resolveQuoteChargerPowerLabel(quote = {}) {
  const numeric = Number(quote.powerKw || 0);
  if (Number.isFinite(numeric) && numeric > 0) return formatNumber(numeric);
  const ref = String(quote.chargerReference || quote.charger?.label || '').trim();
  const match = ref.match(/(\d+(?:[\.,]\d+)?)\s*k\s*w/i);
  if (match) return match[1].replace(',', '.');
  const computed = Number(quote.voltage || 0) * Number(quote.current || 0) / 1000;
  if (Number.isFinite(computed) && computed > 0) {
    const rounded = Math.round(computed * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/\.0$/, '');
  }
  return '';
}

function formatDateLongCo(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const [, year, month, day] = match;
    return `${Number(day)} de ${months[Math.max(0, Number(month) - 1)] || month} de ${year}`;
  }
  try {
    return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: DISPLAY_TIME_ZONE }).format(new Date(value));
  } catch {
    return formatDateOnly(value);
  }
}

function drawMotorysaCoverInfoTable(doc, startY, quote) {
  const x = 36;
  const labelW = 104;
  const valueW = 419;
  const dateLabelW = 104;
  const dateValueW = 196;
  const quoteLabelW = 104;
  const quoteValueW = 119;
  const rowH = 28;
  const drawCell = (cx, cy, w, text, { bold = false } = {}) => {
    doc.rect(cx, cy, w, rowH).lineWidth(0.8).strokeColor('#111').stroke();
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(11).fillColor('#111').text(String(text || ''), cx + 6, cy + 8, { width: w - 12, align: 'left' });
  };
  let y = startY;
  [
    ['Señor (a):', formatDisplayName(quote.clientName) || '-'],
    ['Celular:', quote.phone || '-'],
    ['Dirección:', quote.address || '-'],
    ['Ciudad:', quote.city || '-'],
  ].forEach(([label, value]) => {
    drawCell(x, y, labelW, label, { bold: true });
    drawCell(x + labelW, y, valueW, value);
    y += rowH;
  });
  drawCell(x, y, dateLabelW, 'Fecha:', { bold: true });
  drawCell(x + dateLabelW, y, dateValueW, formatDateOnly(quote.createdAt));
  drawCell(x + dateLabelW + dateValueW, y, quoteLabelW, 'Cotización #:', { bold: true });
  drawCell(x + dateLabelW + dateValueW + quoteLabelW, y, quoteValueW, displayQuoteNumber(quote.id));
  return y + rowH;
}

function buildMotorysaCoverSections(quote = {}) {
  const distance = formatNumber(quote.distance || 0);
  const chargerPower = quote.voltage && quote.current ? roundMoney((Number(quote.voltage || 0) * Number(quote.current || 0)) / 1000) : null;
  return [
    {
      index: 1,
      title: 'Alcance',
      body: `Suministro y/o instalación de cargador vehicular eléctrico ${chargerPower ? `${chargerPower} kW` : ''}, incluye mano de obra, materiales, pruebas y puesta en marcha.`,
    },
    {
      index: 2,
      title: 'Condiciones de instalación',
      body: 'Las instalaciones se desarrollan bajo normatividad vigente IEC 61851-1, NTC 2050 segunda actualización y Reglamento Técnico de Instalaciones Eléctricas – RETIE 2024.',
    },
    {
      index: 3,
      title: 'Personal a cargo',
      body: 'La instalación es realizada por personal competente: técnico electricista con matrícula profesional vigente y, en caso que aplique, el personal cuenta con equipos de protección personal y parafiscales vigentes.',
    },
    {
      index: 4,
      title: 'Responsabilidad del cliente',
      body: 'El cliente se hará cargo de gestionar permisos y autorizaciones ante la administración para ingreso vehicular y personal a cargo.',
    },
    {
      index: 5,
      title: 'Observaciones de la instalación',
      body: `Se traza ruta para instalación de cargador eléctrico con una distancia aproximada de ${distance} m de tubería. La propuesta podrá requerir ajustes según validación final del sitio, canalización disponible, tablero existente, protecciones y espacio real para ejecución.`,
    },
  ];
}

function drawMotorysaPhotoPricingPage(doc, quote = {}) {
  const x = 36;
  const width = 523;
  doc.font('Helvetica-Bold').fontSize(24).fillColor('#222').text('Motorysa', x, 28, { width, align: 'right' });
  doc.rect(x, 64, width, 10).fill('#ff120a');
  doc.fillColor('#111').font('Helvetica-Bold').fontSize(12).text('6. Registro fotográfico', x, 92, { width });
  drawMotorysaPhotoGrid(doc, x, 110, width, 186, quote);
  let y = 316;
  y = drawMotorysaPricingSummaryTable(doc, x, y, width, quote);
  y += 14;
  doc.font('Helvetica-Bold').fontSize(11).text('Nota: Este valor NO incluye el cargador.', x, y, { width, align: 'center' });
  y += 26;
  const lines = [
    `Validez de la cotización: ${quote.countryCode === 'CO' ? '7 días' : '30 días'}`,
    'Forma de pago: Contado',
    'Duración estimada de la instalación: 1-2 días',
    'Garantía materiales y cargador por defectos de fabricación: 1 año',
  ];
  doc.font('Helvetica-Bold').fontSize(10.2);
  lines.forEach((line, index) => {
    doc.text(line, x, y + (index * 17), { width });
  });
  y += 78;
  doc.font('Helvetica').fontSize(9.2).fillColor('#d71920').text('Nota: La propuesta incluye autodeclaración de cumplimiento RETIE por parte del constructor. No incluye dictamen de uso final; en caso de requerirse, es un costo adicional.', x, y, { width, align: 'justify' });
  doc.fillColor('#111');
}

function drawMotorysaPhotoGrid(doc, x, y, width, height, quote = {}) {
  const photos = Array.isArray(quote?.photos) ? quote.photos.filter((photo) => fs.existsSync(photo.filePath)).slice(0, 4) : [];
  const cols = 4;
  const gap = 0;
  const cellW = width / cols;
  for (let index = 0; index < cols; index += 1) {
    const cx = x + (index * cellW);
    doc.rect(cx, y, cellW, height).lineWidth(0.8).strokeColor('#111').stroke();
    const photo = photos[index];
    if (photo?.filePath) {
      try {
        drawCoverPhotoInFrame(doc, photo.filePath, cx + 2, y + 2, cellW - 4, height - 4, photo.frame);
      } catch {
        doc.font('Helvetica').fontSize(8).fillColor('#777').text(`Foto ${index + 1}`, cx, y + (height / 2) - 4, { width: cellW, align: 'center' });
      }
    } else {
      doc.font('Helvetica').fontSize(8).fillColor('#777').text(`Foto ${index + 1}`, cx, y + (height / 2) - 4, { width: cellW, align: 'center' });
    }
  }
  doc.fillColor('#111');
}

function drawMotorysaPricingSummaryTable(doc, x, y, width, quote = {}) {
  const rows = buildMotorysaPricingSummaryRows(quote);
  const descW = 330;
  const unitW = 90;
  const qtyW = width - descW - unitW;
  const grey = '#d9d9d9';
  const yellow = '#fff200';
  const border = '#3a3a3a';
  const outerBorder = '#222';
  const valueW = 160;
  const labelW = width - valueW;

  const cell = (cx, cy, w, h, text, { fill = '#fff', bold = false, align = 'left', fontSize = 10.2, color = '#111', paddingX = 8, paddingY = 7, lineWidth = 0.7 } = {}) => {
    doc.rect(cx, cy, w, h).lineWidth(lineWidth).fillAndStroke(fill, border);
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize).fillColor(color).text(String(text ?? ''), cx + paddingX, cy + paddingY, { width: w - (paddingX * 2), align });
  };

  const row3 = (cells, rowY, { fill = '#fff', bold = false, height = 26, fontSize = 10.2 } = {}) => {
    let cx = x;
    const widths = [descW, unitW, qtyW];
    cells.forEach((value, idx) => {
      cell(cx, rowY, widths[idx], height, value, { fill, bold, align: idx === 0 ? 'left' : 'center', fontSize, paddingX: idx === 0 ? 8 : 6 });
      cx += widths[idx];
    });
    return rowY + height;
  };

  const totalRow = (label, value, rowY, { fill = '#fff', bold = false, height = 26, fontSize = 10.4 } = {}) => {
    cell(x, rowY, labelW, height, label, { fill, bold, align: 'left', fontSize, paddingX: 10 });
    cell(x + labelW, rowY, valueW, height, value, { fill, bold, align: 'center', fontSize, paddingX: 8 });
    return rowY + height;
  };

  const tableTop = y;
  y = row3(['TOTAL MANO DE OBRA', 'UNIDAD', 'CANTIDAD'], y, { fill: grey, bold: true, height: 30, fontSize: 10.6 });
  y = row3(['Mano de obra técnico electricista', 'GL', '1'], y, { height: 28, fontSize: 10.2 });
  y = row3(['Transportes y herramientas', 'GL', '1'], y, { height: 28, fontSize: 10.2 });
  y = row3(['MATERIAL', 'UNIDAD', 'CANTIDAD'], y, { fill: grey, bold: true, height: 30, fontSize: 10.6 });
  y = row3([rows.materialDescription, 'GL', '1'], y, { height: 122, fontSize: 10 });
  y = totalRow('SUBTOTAL INSTALACIÓN', `$ ${pdfAmount(quote, quote.subtotal)}`, y, { fill: grey, height: 28, fontSize: 10.4 });
  y = totalRow(`IVA ${quote.countryCode === 'CO' ? '19%' : '18%'}`, `$ ${pdfAmount(quote, quote.igv)}`, y, { fill: grey, height: 28, fontSize: 10.4 });
  y = totalRow('TOTAL INSTALACIÓN IVA INCLUIDO', `$ ${pdfAmount(quote, quote.total)}`, y, { fill: yellow, bold: true, height: 30, fontSize: 10.8 });
  doc.rect(x, tableTop, width, y - tableTop).lineWidth(1.0).strokeColor(outerBorder).stroke();
  doc.fillColor('#111');
  return y;
}

function buildMotorysaPricingSummaryRows(quote = {}) {
  return {
    materialDescription: 'Cable, tubería,caja para alojar\nprotecciones eléctricas, interruptor\nde protección, accesorios,\nterminales, cinta aislante,\ntornillería, chazos y todo lo\nnecesario para la correcta\ninstalación y funcionamiento.',
  };
}

function buildGreeting(clientName) {
  const displayName = formatDisplayName(clientName);
  return displayName ? `Cordial saludo ${displayName}` : 'Cordial saludo';
}

function formatDisplayName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function displayAdvisorName(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'Equipo EVINKA';
  if (/admin\s+evinka|tecnic[oa]\s+evinka/i.test(raw)) return 'Equipo EVINKA';
  return formatDisplayName(raw);
}

function buildServiceParagraph(quote) {
  const chargerLabel = quote?.chargerReference || quote?.charger?.label || 'cargador';
  if (quote.countryCode === 'CO') {
    return `Se proyecta la instalación eléctrica para el sistema de carga del vehículo en la ubicación definida por el cliente, considerando ${chargerLabel}, recorrido eléctrico, protecciones, canalización, cableado y puesta en operación, sujeto a validación técnica y condiciones reales del sitio.`;
  }
  const chargerIncluded = quote?.charger?.included === true;
  const chargerText = chargerIncluded
    ? `, incluyendo ${chargerLabel} según definición comercial del proyecto,`
    : ',';
  return `Se plantea realizar la instalación eléctrica desde el punto de alimentación hasta la ubicación definida para el proyecto${chargerText} dentro del alcance del servicio estándar de instalación. Esta propuesta contempla la visita técnica, la ingeniería básica, el transporte, las protecciones, el tablero, la canalización, el cableado y la conexión final del sistema, para una instalación ordenada, segura y conforme a las normativas eléctricas vigentes.`;
}

function buildAdditionalParagraph(row, quote) {
  return `Se considera el adicional ${row.label.replace(/^Servicios Adicionales:\s*/, '')}, incorporado según validación técnica en visita. Este concepto complementa la instalación principal y forma parte de los trabajos requeridos para la correcta implementación del sistema en ${quote.propertyType || 'el proyecto'}.`;
}

function buildWarrantyNote(quote) {
  return 'La garantía de la instalación tiene una vigencia de 12 meses contados desde la entrega del servicio. La atención de garantía está sujeta a evaluación técnica y disponibilidad operativa de EVINKA.';
}

function buildBaseIncludedScope({ propertyType, includedMeters, tubeType, cable, charger }) {
  const isEdificio = String(propertyType || '').toUpperCase() === 'EDIFICIO';
  return [
    `Servicio estándar de instalación del cargador con visita técnica, ingeniería, transporte, movilidad y herramientas.`,
    charger?.included ? `${charger?.label || 'Cargador incluido'} contemplado según definición comercial del proyecto.` : null,
    `Tablero eléctrico, interruptor termomagnético de protección e interruptor diferencial tipo A.`,
    isEdificio ? 'Medidor digital para el esquema base de edificio.' : null,
    `Cableado de potencia y puesta a tierra dentro del alcance base de ${formatNumber(includedMeters)} m, usando cable ${cable?.label || '-'} y tubería ${tubeType || '-'}.`,
    `Tubería, conduit y accesorios necesarios para el recorrido base incluido.`,
    `Mano de obra de instalación, conexión final y puesta en marcha básica del sistema.`,
  ].filter(Boolean);
}

function buildIncludedBulletLines(quote) {
  const businessLines = Array.isArray(quote.includedScope) ? quote.includedScope : [];
  const technicalLines = quote.includedRows
    .filter((row) => !['0060001', '0060002', '0060003'].includes(row.code))
    .map((row) => {
    const qty = Number(row.qty || 0);
    const printableUnit = normalizeUnit(row.unit);
    const qtyText = qty > 0 ? `${formatNumber(qty)} ${printableUnit}`.trim() : printableUnit;
    return `${formatRowLabel(row.label)}${qtyText ? ` (${qtyText})` : ''}.`;
  });
  return [...businessLines, ...technicalLines];
}

function formatRowLabel(label) {
  return String(label || '')
    .replace(/(\d+)mm2?/gi, '$1 mm2')
    .replace(/(\d+)m(?!m)/gi, '$1 m')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildObservationLines(quote) {
  if (quote?.countryCode === 'CO') {
    return [
      'La propuesta económica se basa en la información suministrada por el cliente y en la validación técnica disponible a la fecha.',
      'Cualquier adecuación adicional detectada en sitio que no esté incluida expresamente en esta cotización será informada y cotizada por separado.',
      'La instalación puede requerir una interrupción temporal del suministro eléctrico durante la ejecución de los trabajos.',
      'No se incluyen trabajos de obra civil mayor, resanes, pintura, enchapes, perforaciones especiales ni alquiler de equipos de elevación salvo que se indiquen de forma expresa.',
      'El cliente debe garantizar acceso al sitio, disponibilidad del vehículo cuando aplique y autorización de ingreso si la instalación se realiza en conjunto residencial o edificio.',
      'El cargador y los materiales instalados conservan únicamente las garantías otorgadas por el fabricante y por el alcance contratado.',
    ];
  }
  return [
    'Durante la instalación se realizará una interrupción breve del suministro eléctrico.',
    'Se solicita mantener despejada el área de trabajo y los estacionamientos involucrados el día de la instalación.',
    'La presente cotización no incluye trabajos de picado, demoliciones ni trabajos en altura.',
    'El servicio estándar contempla 1 día de trabajo y la participación de 2 electricistas.',
    'No se incluyen adecuaciones eléctricas adicionales al tablero ni infraestructura complementaria no detallada en esta propuesta.',
    'No se incluyen trabajos de pintura ni reposición de acabados.',
    'Todo trabajo o adecuación no detallada expresamente en esta propuesta será considerado adicional y cotizado por separado.',
    'El cliente autoriza el registro y uso de fotografías de la instalación y equipos con fines de soporte técnico, trazabilidad, capacitación y material comercial o publicitario, evitando divulgar información sensible.',
    'La responsabilidad de EVINKA se limita al alcance del servicio contratado y al valor efectivamente pagado por el cliente.',
    'Aplican las condiciones del Certificado de Garantía EVINKA entregado junto con la instalación.',
    'Código de orden, código de garantía, número de serie y registro deberán mantenerse identificados en el expediente del servicio.',
  ];
}

function ensurePageSpace(doc, y, needed, quote, logoPath, continuation = false) {
  if (y + needed <= 730) return y;
  doc.addPage();
  drawQuoteHeader(doc, quote, logoPath);
  if (continuation) {
    doc.font('Helvetica').fontSize(9).text('Continuación', 36, 166);
    return 186;
  }
  return 160;
}

function writeSectionTitle(doc, y, title, quote, logoPath) {
  y = ensurePageSpace(doc, y, 36, quote, logoPath, true);
  doc.font('Helvetica-Bold').fontSize(10).text(title, 72, y, { width: 470 });
  return y + 18;
}

function writeBulletParagraph(doc, y, text, x = 72, quote, logoPath) {
  const height = doc.heightOfString(text, { width: 455, align: 'justify' }) + 8;
  y = ensurePageSpace(doc, y, height, quote, logoPath, true);
  doc.font('Helvetica').fontSize(9.2).text('•', x - 14, y, { width: 10 });
  doc.text(text, x, y, { width: 455, align: 'justify' });
  return doc.y + 4;
}

function writePlainParagraph(doc, y, text, x = 36, width = 523, quote, logoPath) {
  const height = doc.heightOfString(text, { width, align: 'justify' }) + 6;
  y = ensurePageSpace(doc, y, height, quote, logoPath, true);
  doc.font('Helvetica').fontSize(9.2).text(text, x, y, { width, align: 'justify' });
  return doc.y + 2;
}

function writeSignatureBlock(doc, y, quote, logoPath) {
  const advisor = displayAdvisorName(quote.createdBy?.name);
  const isColombia = quote?.countryCode === 'CO';
  y = ensurePageSpace(doc, y, isColombia ? 70 : 38, quote, logoPath, true);
  doc.font('Helvetica').fontSize(9.2).text('Atentamente,', 36, y, { width: 523 });
  doc.font('Helvetica-Bold').text(isColombia ? 'EVINKA Colombia' : 'EVINKA', 36, y + 14, { width: 523 });
  if (isColombia) {
    doc.font('Helvetica').text(advisor === 'Equipo EVINKA' ? 'Área Comercial' : advisor, 36, y + 28, { width: 523 });
    doc.text('Equipo comercial y técnico de movilidad eléctrica', 36, y + 42, { width: 523 });
    return y + 58;
  }
  return y + 30;
}

function drawFooter(doc, quote = {}) {
  const footerY = 680;
  const contactPhone = quote?.countryCode === 'CO'
    ? '302 436 1227'
    : '949076102';
  doc.moveTo(36, footerY).lineTo(559, footerY).strokeColor('#111').lineWidth(1.5).stroke();
  doc.font('Helvetica-Bold').fontSize(9).text('EVINKA TECHNOLOGY S.A.S.', 36, footerY + 8);
  doc.font('Helvetica').fontSize(8.5).text('Soluciones de movilidad eléctrica, instalación, soporte técnico y operación comercial.', 36, footerY + 22, { width: 523 });
  doc.text(`Contacto : ${contactPhone} · contacto@evinka.tech`, 36, footerY + 37);
  doc.text('Pag.Web : evinka.tech', 36, footerY + 50);
}

function drawTable(doc, widths, headers, rows, options = {}) {
  const startX = options.x ?? doc.x;
  let y = options.y ?? doc.y;
  const rowHeight = options.rowHeight ?? 20;
  const headerHeight = options.headerHeight ?? rowHeight;
  const cellPaddingX = 4;
  const cellPaddingY = 5;
  let x = startX;
  doc.fontSize(options.fontSize ?? 9).fillColor('#111').font('Helvetica-Bold');
  headers.forEach((header, i) => {
    doc.rect(x, y, widths[i], headerHeight).lineWidth(1).stroke();
    doc.text(header, x + cellPaddingX, y + cellPaddingY, { width: widths[i] - (cellPaddingX * 2), align: i >= headers.length - 2 ? 'right' : 'left' });
    x += widths[i];
  });
  y += headerHeight;
  doc.font('Helvetica');
  rows.forEach((row) => {
    const calculatedHeight = row.reduce((max, cell, i) => {
      const textHeight = doc.heightOfString(String(cell ?? ''), { width: widths[i] - (cellPaddingX * 2), align: i >= row.length - 2 ? 'right' : i === 1 ? 'right' : 'left' });
      return Math.max(max, textHeight + (cellPaddingY * 2));
    }, rowHeight);
    const currentRowHeight = Math.max(rowHeight, Math.ceil(calculatedHeight));
    x = startX;
    row.forEach((cell, i) => {
      doc.rect(x, y, widths[i], currentRowHeight).lineWidth(0.8).stroke();
      doc.text(String(cell ?? ''), x + cellPaddingX, y + cellPaddingY, { width: widths[i] - (cellPaddingX * 2), align: i >= row.length - 2 ? 'right' : i === 1 ? 'right' : 'left' });
      x += widths[i];
    });
    y += currentRowHeight;
  });
  doc.y = y;
  return y;
}

function drawKeyValue(doc, x, y, label, value, { labelWidth = 70, valueWidth = 180 } = {}) {
  doc.font('Helvetica').fontSize(10).fillColor('#111').text(String(label || ''), x, y, { width: labelWidth, lineBreak: false });
  doc.text(':', x + labelWidth + 2, y, { width: 8, align: 'center', lineBreak: false });
  doc.font('Helvetica-Bold').text(String(value || '-'), x + labelWidth + 14, y, { width: valueWidth, lineBreak: false });
}

function drawSummaryBox(doc, x, y, rows) {
  const widths = [90, 36, 82];
  let cy = y;
  rows.forEach((row, idx) => {
    let cx = x;
    const h = idx === rows.length - 1 ? 24 : 20;
    [row[0], 'S/', row[1]].forEach((cell, i) => {
      doc.rect(cx, cy, widths[i], h).lineWidth(1).stroke();
      doc.font(idx === rows.length - 1 ? 'Helvetica-Bold' : 'Helvetica').fontSize(idx === rows.length - 1 ? 10 : 9).text(cell, cx + 4, cy + 5, { width: widths[i] - 8, align: i === 0 ? 'left' : 'right' });
      cx += widths[i];
    });
    cy += h;
  });
}

function drawBorderNote(doc, x, y, width, text) {
  const h = 16;
  doc.rect(x, y, width, h).lineWidth(1).stroke();
  doc.font('Helvetica-Bold').fontSize(8.3).text(text, x + 6, y + 4, { width: width - 12 });
  return y + h;
}

function mergeConfig(current, incoming, countryCode = 'PE') {
  const activeCountry = normalizeCountryCode(countryCode) || 'PE';
  const next = structuredClone(current);
  const currentCountryConfig = getStoredCountryConfig(next, activeCountry);
  const mergedCountryConfig = structuredClone(currentCountryConfig);
  if (incoming.company) mergedCountryConfig.company = { ...mergedCountryConfig.company, ...incoming.company };
  if (incoming.defaults) mergedCountryConfig.defaults = { ...mergedCountryConfig.defaults, ...incoming.defaults };
  if (incoming.commercialProfiles) mergedCountryConfig.commercialProfiles = incoming.commercialProfiles;
  if (incoming.harCatalogs) mergedCountryConfig.harCatalogs = normalizeHarCatalogs(activeCountry, incoming.harCatalogs);
  if (incoming.catalog?.items) mergedCountryConfig.catalog = { ...mergedCountryConfig.catalog, items: incoming.catalog.items };
  next.countryConfigs = {
    ...(next.countryConfigs || {}),
    [activeCountry]: mergedCountryConfig,
  };
  return next;
}

function defaultConfig() {
  return {
    company: {
      name: 'EVINKA Cotizador',
      tagline: 'Cotizador web para técnicos y administración',
    },
    currency: 'PEN',
    defaults: {
      chargerExchangeRate: 3.75,
      miniboxPriceUsd: 700,
      alienPriceUsd: 900,
    },
    commercialProfiles: defaultCommercialProfiles(0.75),
    roles: getRoleMatrix().roles.map((role) => role.id),
    roleDefinitions: getRoleMatrix().roles,
    catalog: { services: [], cables: [], conditionals: [], items: [] },
    countryConfigs: {
      PE: {
        company: {
          name: 'EVINKA Cotizador Perú',
          tagline: 'Cotizador web para técnicos y administración · Perú',
        },
        currency: 'PEN',
      },
      CO: {
        company: {
          name: 'EVINKA Cotizador Colombia',
          tagline: 'Cotizador web para técnicos y administración · Colombia',
        },
        currency: 'COP',
        defaults: {
          igv: 0.19,
          coOutOfCityRate: 0.08,
          coOutOfCityMinimum: 180000,
          coReviewDistanceMeters: 25,
          coTechnicalReviewFee: 0,
        },
        harCatalogs: defaultHarCatalogs('CO'),
      },
    },
  };
}

function defaultRoleMatrix() {
  return {
    version: 1,
    roles: [
      {
        id: 'admin',
        label: 'Administrador',
        aliases: ['admin'],
        tabs: ['quote', 'quotes', 'visits', 'ops', 'conformities', 'advisor', 'admin'],
        modules: ['inicio', 'asesor', 'visitas', 'cotizaciones', 'instalaciones', 'conformidades', 'auditoria', 'cuentas', 'configuracion'],
        permissions: ['quotes.create', 'users.manage', 'roles.manage', 'catalog.manage', 'pricing.manage', 'quotes.write', 'quotes.review', 'visits.assign', 'visits.execute', 'installations.assign', 'installations.execute', 'conformities.review', 'conformities.sign', 'audit.read', 'advisor.handle'],
      },
      {
        id: 'supervisor',
        label: 'Supervisor',
        aliases: ['supervisor', 'tecnico_supervisor', 'supervisor_tecnico', 'tech_supervisor', 'technical_supervisor'],
        tabs: ['quote', 'quotes', 'visits', 'ops', 'conformities', 'advisor'],
        modules: ['inicio', 'asesor', 'visitas', 'cotizaciones', 'instalaciones', 'conformidades', 'auditoria'],
        permissions: ['quotes.create', 'quotes.write', 'quotes.review', 'visits.assign', 'visits.execute', 'installations.assign', 'installations.execute', 'conformities.review', 'advisor.handle', 'audit.read'],
      },
      {
        id: 'asesor_comercial',
        label: 'Asesor comercial',
        aliases: ['advisor', 'asesor', 'asesor_comercial', 'asesor_humano', 'human_advisor', 'commercial', 'comercial', 'sales', 'ventas'],
        tabs: ['quote', 'quotes', 'visits', 'advisor'],
        modules: ['inicio', 'asesor', 'visitas_iniciales', 'cotizaciones', 'historial_cliente'],
        permissions: ['quotes.create', 'quotes.write', 'quotes.review', 'visits.assign', 'advisor.handle'],
      },
      {
        id: 'asesor_venta',
        label: 'Asesor de venta',
        aliases: ['asesor_venta', 'asesor_ventas', 'sales_advisor', 'venta', 'ventas'],
        tabs: ['quote', 'quotes', 'visits', 'conformities', 'advisor'],
        modules: ['inicio', 'asesor', 'visitas_iniciales', 'cotizaciones', 'historial_cliente', 'conformidades'],
        permissions: ['quotes.create', 'quotes.write', 'quotes.review', 'visits.assign', 'conformities.review', 'advisor.handle'],
      },
      {
        id: 'kam_b2c',
        label: 'KAM B2C',
        aliases: ['kam_b2c', 'kam', 'kam_b2c_pe', 'kam_b2c_co', 'comercial_kam'],
        tabs: ['quote', 'quotes', 'visits', 'ops', 'conformities', 'advisor', 'audit'],
        modules: ['inicio', 'asesor', 'visitas', 'cotizaciones', 'instalaciones', 'conformidades', 'auditoria', 'historial_cliente'],
        permissions: ['quotes.create', 'quotes.write', 'quotes.review', 'visits.assign', 'visits.execute', 'installations.assign', 'conformities.review', 'advisor.handle', 'audit.read'],
      },
      {
        id: 'kam_b2b',
        label: 'KAM B2B',
        aliases: ['kam_b2b', 'kam_b2b_pe', 'kam_b2b_co', 'corporativo_kam'],
        tabs: ['quote', 'quotes', 'visits', 'ops', 'conformities', 'advisor', 'audit'],
        modules: ['inicio', 'asesor', 'visitas', 'cotizaciones', 'instalaciones', 'conformidades', 'auditoria', 'historial_cliente'],
        permissions: ['quotes.create', 'quotes.write', 'quotes.review', 'visits.assign', 'visits.execute', 'installations.assign', 'conformities.review', 'advisor.handle', 'audit.read'],
      },
      {
        id: 'tecnico_visitas',
        label: 'Técnico de visitas',
        aliases: ['tech', 'tecnico', 'tecnico_visitas', 'visit_tech'],
        tabs: ['visits', 'quotes'],
        modules: ['inicio', 'visitas', 'detalle_tecnico', 'cotizaciones_consulta', 'evidencias'],
        permissions: ['quotes.create', 'visits.execute'],
      },
      {
        id: 'tecnico_instalador',
        label: 'Técnico instalador',
        aliases: ['tecnico_instalador', 'instalador', 'installation_tech'],
        tabs: ['ops', 'conformities'],
        modules: ['inicio', 'instalaciones', 'detalle_instalacion', 'conformidades', 'garantia', 'evidencias'],
        permissions: ['installations.execute', 'conformities.sign'],
      },
    ],
  };
}

function getRoleMatrix() {
  const stored = readJSON(files.roleMatrix, null);
  const roles = Array.isArray(stored?.roles) && stored.roles.length ? stored.roles : defaultRoleMatrix().roles;
  return {
    version: Number(stored?.version || 1),
    roles: roles.map((role) => ({
      ...role,
      aliases: Array.isArray(role.aliases) ? role.aliases : [],
      tabs: Array.isArray(role.tabs) ? role.tabs : [],
      modules: Array.isArray(role.modules) ? role.modules : [],
      permissions: Array.isArray(role.permissions) ? role.permissions : [],
    })),
  };
}

async function loadExcelSource() {
  if (!fs.existsSync(EXCEL_SOURCE_PATH)) return null;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_SOURCE_PATH);
  const wsParams = workbook.getWorksheet('00_PARAMETROS');
  const wsCatalog = workbook.getWorksheet('02_CATALOGO');
  if (!wsParams || !wsCatalog) return null;

  const factorGeneralCosts = Number(wsCatalog.getCell('H3').value || 1);
  const divisorMargin = Number(wsParams.getCell('B13').value || 0.75);
  const items = [];
  for (let r = 5; r <= 36; r += 1) {
    const code = String(wsCatalog.getCell(`A${r}`).value || '').trim();
    if (!code) continue;
    const costBase = Number(wsCatalog.getCell(`G${r}`).value || 0);
    const costAdjusted = roundMoney(costBase * factorGeneralCosts);
    const price = divisorMargin ? roundMoney(costAdjusted / divisorMargin) : 0;
    items.push({
      code,
      section: String(wsCatalog.getCell(`B${r}`).value || '').trim(),
      nature: String(wsCatalog.getCell(`C${r}`).value || '').trim(),
      label: String(wsCatalog.getCell(`D${r}`).value || '').trim(),
      unit: String(wsCatalog.getCell(`E${r}`).value || '').trim(),
      description: String(wsCatalog.getCell(`F${r}`).value || '').trim(),
      costBase,
      costAdjusted,
      margin: roundMoney(price - costAdjusted),
      priceWithMargin: price,
      price,
      rule: String(wsCatalog.getCell(`K${r}`).value || '').trim(),
    });
  }
  return {
    company: defaultConfig().company,
    defaults: {
      igv: 0.18,
      laborRate: 0,
      divisorMargin,
      factorGeneralCosts,
      max6mm: Number(wsParams.getCell('B17').value || 25),
      max10mm: Number(wsParams.getCell('B18').value || 40),
      includedMetersCasa: Number(wsParams.getCell('B23').value || 10),
      minimumCasa: Number(wsParams.getCell('B24').value || 1499),
      includedMetersEdificio: Number(wsParams.getCell('B25').value || 20),
      minimumEdificio: Number(wsParams.getCell('B26').value || 1799),
      distanceFactors: [6, 7, 8, 9, 10].map((r) => ({
        upto: String(wsParams.getCell(`A${r}`).value || '').includes('>') ? Infinity : Number(wsParams.getCell(`A${r}`).value || 0),
        factor: Number(wsParams.getCell(`B${r}`).value || 0),
      })),
    },
    catalog: buildCatalogFromItems(items, { factorGeneralCosts, divisorMargin }),
  };
}

function ensureSeedData() {
  if (!fs.existsSync(files.config)) writeJSON(files.config, defaultConfig());
  if (!fs.existsSync(files.clients)) writeJSON(files.clients, []);
  if (!fs.existsSync(files.quotes)) writeJSON(files.quotes, []);
  if (!fs.existsSync(files.installationOrders)) writeJSON(files.installationOrders, []);
  if (!fs.existsSync(files.conformities)) writeJSON(files.conformities, []);
  if (!fs.existsSync(files.warranties)) writeJSON(files.warranties, []);
  if (!fs.existsSync(files.sessions)) writeJSON(files.sessions, {});
  if (!fs.existsSync(files.users)) {
    writeJSON(files.users, [
      {
        id: 'admin',
        name: 'Admin EVINKA',
        email: process.env.COTIZADOR_ADMIN_EMAIL || 'admin@evinka.net',
        employeeCode: 'ADM001',
        role: 'admin',
        status: 'active',
        requestedAt: new Date().toISOString(),
        accessGrantedAt: new Date().toISOString(),
        pinHash: hashPassword(process.env.COTIZADOR_ADMIN_PIN || '1234'),
        pinUpdatedAt: new Date().toISOString(),
        passwordHash: hashPassword(process.env.COTIZADOR_ADMIN_PASSWORD || 'Admin12345!'),
      },
      {
        id: 'tech',
        name: 'Técnico EVINKA',
        email: process.env.COTIZADOR_TECH_EMAIL || 'tecnico@evinka.net',
        employeeCode: 'TEC001',
        role: 'tech',
        status: 'active',
        requestedAt: new Date().toISOString(),
        accessGrantedAt: new Date().toISOString(),
        pinHash: hashPassword(process.env.COTIZADOR_TECH_PIN || '1234'),
        pinUpdatedAt: new Date().toISOString(),
        passwordHash: hashPassword(process.env.COTIZADOR_TECH_PASSWORD || 'Tecnico12345!'),
      },
    ]);
  } else {
    writeUsers(readUsers());
  }
  if (!fs.existsSync(files.techVisits)) writeJSON(files.techVisits, defaultTechVisits());
}

function readUsers() {
  return assignEmployeeCodes(readJSON(files.users, []).map(normalizeUserRecord));
}

function readClients() {
  return readJSON(files.clients, []).map(normalizeClientRecord);
}

function writeClients(clients) {
  writeJSON(files.clients, clients.map(normalizeClientRecord));
}

function clientCountryCode(client = {}) {
  return resolveRecordCountryCode(client.countryCode, client.city, client.address, client.email, client.phone);
}

function normalizeClientRecord(client = {}) {
  const firstName = String(client.firstName || '').trim();
  const lastName = String(client.lastName || '').trim();
  const explicitFullName = String(client.fullName || '').trim();
  const fullName = explicitFullName || [firstName, lastName].filter(Boolean).join(' ').trim();
  return {
    id: String(client.id || `cli-${Date.now().toString(36)}`).trim(),
    countryCode: clientCountryCode(client),
    firstName,
    lastName,
    fullName,
    email: normalizeEmail(client.email || ''),
    phone: String(client.phone || '').trim(),
    documentType: String(client.documentType || '').trim(),
    documentNumber: String(client.documentNumber || client.clientDocument || '').trim(),
    city: String(client.city || '').trim(),
    department: String(client.department || '').trim(),
    locality: String(client.locality || '').trim(),
    neighborhood: String(client.neighborhood || '').trim(),
    address: String(client.address || '').trim(),
    residenceType: String(client.residenceType || '').trim(),
    companyName: String(client.companyName || '').trim(),
    customerSegment: inferCustomerSegment(client),
    vehicleModel: String(client.vehicleModel || '').trim(),
    vin: String(client.vin || '').trim(),
    outOfCity: String(client.outOfCity || '').trim(),
    source: String(client.source || 'cotizador').trim(),
    lastQuoteId: String(client.lastQuoteId || '').trim(),
    lastQuoteAt: String(client.lastQuoteAt || '').trim(),
    createdAt: String(client.createdAt || new Date().toISOString()).trim(),
    updatedAt: String(client.updatedAt || new Date().toISOString()).trim(),
  };
}

function upsertOperationalClientFromQuote(quote, user) {
  const clients = readClients();
  const normalizedEmail = normalizeEmail(quote.email || '');
  const normalizedDocument = String(quote.clientDocument || '').trim();
  const normalizedPhone = String(quote.phone || '').trim();
  const matchIndex = clients.findIndex((client) => {
    if (client.countryCode && quote.countryCode && client.countryCode !== quote.countryCode) return false;
    if (normalizedDocument && client.documentNumber && client.documentNumber === normalizedDocument) return true;
    if (normalizedPhone && client.phone && client.phone === normalizedPhone) return true;
    if (normalizedEmail && client.email && client.email === normalizedEmail) return true;
    return false;
  });

  const current = matchIndex >= 0 ? clients[matchIndex] : null;
  const next = normalizeClientRecord({
    ...current,
    id: current?.id || `cli-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
    countryCode: quote.countryCode,
    firstName: quote.clientFirstName,
    lastName: quote.clientLastName,
    fullName: quote.clientName,
    email: quote.email,
    phone: quote.phone,
    documentType: quote.documentType,
    documentNumber: quote.clientDocument,
    city: quote.city,
    department: quote.department,
    locality: quote.locality,
    neighborhood: quote.neighborhood,
    address: quote.address,
    residenceType: quote.residenceType || quote.propertyType,
    companyName: quote.companyName,
    customerSegment: quote.customerSegment,
    vehicleModel: quote.vehicleModel,
    vin: quote.vin,
    outOfCity: quote.outOfCity,
    source: 'cotizador',
    lastQuoteId: quote.id,
    lastQuoteAt: quote.createdAt,
    updatedAt: new Date().toISOString(),
    updatedBy: safeUser(user),
  });

  if (matchIndex >= 0) clients[matchIndex] = next;
  else clients.push(next);
  writeClients(clients);
  return next;
}

function writeUsers(users) {
  writeJSON(files.users, assignEmployeeCodes(users.map(normalizeUserRecord)));
}

function normalizeUserRecord(user = {}) {
  const role = normalizeManagedUserRole(user.role || 'tech');
  const email = normalizeEmail(user.email || '');
  return {
    id: String(user.id || `usr-${Date.now()}`).trim(),
    name: String(user.name || '').trim(),
    email,
    employeeCode: normalizeEmployeeCode(user.employeeCode || ''),
    notificationPhone: normalizeNotificationPhone(user.notificationPhone || user.phone || ''),
    role,
    status: normalizeUserStatus(user.status || 'active'),
    passwordHash: String(user.passwordHash || '').trim(),
    pinHash: String(user.pinHash || '').trim(),
    pinUpdatedAt: String(user.pinUpdatedAt || '').trim(),
    requestedAt: String(user.requestedAt || user.createdAt || '').trim(),
    accessGrantedAt: String(user.accessGrantedAt || '').trim(),
    allowedCountries: normalizeStringList(user.allowedCountries).map((item) => item.toUpperCase()),
    allowedQueues: normalizeStringList(user.allowedQueues).map((item) => item.toLowerCase()),
    approvedBy: user.approvedBy || null,
  };
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
}

function normalizeNotificationPhone(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const cleaned = raw.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  const digits = cleaned.replace(/^\+/, '').replace(/\D/g, '');
  if (/^9\d{8}$/.test(digits)) return `+51${digits}`;
  if (/^3\d{9}$/.test(digits)) return `+57${digits}`;
  if (/^(51\d{9}|57\d{10})$/.test(digits)) return `+${digits}`;
  if (/^\d{8,15}$/.test(digits)) return `+${digits}`;
  return '';
}

function assignEmployeeCodes(users = []) {
  const used = new Set();
  return users.map((user) => {
    let employeeCode = normalizeEmployeeCode(user.employeeCode || '');
    if (!isValidEmployeeCode(employeeCode) || used.has(employeeCode)) {
      employeeCode = nextEmployeeCode(users, user.role, used);
    }
    used.add(employeeCode);
    return {
      ...user,
      employeeCode,
    };
  });
}

function normalizeEmployeeCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9-]/g, '');
}

function isValidEmployeeCode(value) {
  return /^[A-Z0-9-]{3,20}$/.test(String(value || '').trim());
}

function nextEmployeeCode(users = [], role = 'tech', usedCodes = new Set()) {
  const normalizedRole = normalizeManagedUserRole(role);
  const prefix = normalizedRole === 'admin'
    ? 'ADM'
    : normalizedRole === 'supervisor'
      ? 'SUP'
      : normalizedRole.startsWith('asesor')
        ? 'ASE'
        : normalizedRole === 'tecnico_instalador'
          ? 'INS'
          : 'TEC';
  const normalizedUsed = new Set(
    [
      ...usedCodes,
      ...users.map((user) => normalizeEmployeeCode(user.employeeCode)),
    ].filter(Boolean),
  );
  let index = 1;
  while (index < 10000) {
    const candidate = `${prefix}${String(index).padStart(3, '0')}`;
    if (!normalizedUsed.has(candidate)) return candidate;
    index += 1;
  }
  return `${prefix}${Date.now().toString().slice(-6)}`;
}

function normalizeManagedUserRole(value) {
  const role = String(value || 'tech').trim().toLowerCase().replace(/[\s-]+/g, '_');
  for (const definition of getRoleMatrix().roles) {
    const aliases = [definition.id, ...(definition.aliases || [])]
      .map((item) => String(item || '').trim().toLowerCase().replace(/[\s-]+/g, '_'));
    if (aliases.includes(role)) return definition.id;
  }
  return 'tecnico_visitas';
}

function isTechAssignableUser(user = {}) {
  return ['tecnico_visitas', 'tecnico_instalador'].includes(normalizeManagedUserRole(user.role || 'tech'));
}

function canUserSeeAllOperations(user = {}) {
  const role = normalizeManagedUserRole(user.role || 'tech');
  const email = normalizeEmail(user.email || '');
  return role === 'admin'
    || role === 'supervisor'
    || role === 'asesor_venta'
    || email === 'luis.campos@evinka.tech';
}

function userRoleHasTab(user = {}, tabId = '') {
  const role = normalizeManagedUserRole(user.role || 'tech');
  const definition = getRoleMatrix().roles.find((item) => item.id === role);
  return Array.isArray(definition?.tabs) && definition.tabs.includes(String(tabId || '').trim());
}

function canUserSeeVisitsBoard(user = {}) {
  return canUserSeeAllOperations(user) || userRoleHasTab(user, 'visits');
}

function canUserSeeInstallationBoard(user = {}) {
  return canUserSeeAllOperations(user) || userRoleHasTab(user, 'ops');
}

function canUserSeeConformitiesBoard(user = {}) {
  return canUserSeeAllOperations(user) || userRoleHasTab(user, 'conformities');
}

function userRoleHasPermission(user = {}, permission = '') {
  const role = normalizeManagedUserRole(user.role || 'tech');
  const definition = getRoleMatrix().roles.find((item) => item.id === role);
  return Array.isArray(definition?.permissions)
    && definition.permissions.includes(String(permission || '').trim());
}

function canUserManageCommercialQuoteFlow(user = {}) {
  const email = normalizeEmail(user.email || '');
  return userRoleHasPermission(user, 'quotes.write') || email === 'luis.campos@evinka.tech';
}

function canUserConfirmQuoteForSend(user = {}) {
  return userRoleHasPermission(user, 'quotes.review') || canUserManageCommercialQuoteFlow(user);
}

function canUserMoveQuoteStatus(user = {}, nextStatus = '', currentStatus = '') {
  const target = normalizeQuoteStatus(nextStatus || currentStatus || 'cotizada');
  if (!target || target === currentStatus) return true;
  if (target === 'lista_envio') return canUserConfirmQuoteForSend(user);
  if (target === 'aceptada_cliente') return canUserManageCommercialQuoteFlow(user);
  if (target === 'abono_100_confirmado') return canUserConfirmFullPayment(user);
  if (['recotizar', 'cancelada', 'instalada', 'cotizada'].includes(target)) {
    return canUserManageCommercialQuoteFlow(user);
  }
  return canUserManageCommercialQuoteFlow(user);
}

function canUserCreateQuote(user = {}) {
  return userRoleHasPermission(user, 'quotes.create') || canUserManageCommercialQuoteFlow(user);
}

function canUserScheduleInstallation(user = {}) {
  return userRoleHasPermission(user, 'installations.execute')
    || userRoleHasPermission(user, 'installations.assign')
    || canUserManageCommercialQuoteFlow(user);
}

function canUserReadAudit(user = {}) {
  return user?.role === 'admin' || userRoleHasPermission(user, 'audit.read');
}

function canUserConfirmFullPayment(user = {}) {
  return canUserManageCommercialQuoteFlow(user);
}

function canUserGenerateConformity(user = {}) {
  const role = normalizeManagedUserRole(user.role || 'tech');
  const email = normalizeEmail(user.email || '');
  return role === 'admin'
    || role === 'supervisor'
    || role === 'tecnico_instalador'
    || email === 'luis.campos@evinka.tech';
}

function canUserUpdateVisit(user = {}, visit = {}) {
  const current = normalizeTechVisit(visit);
  if (!userCanAccessCountry(user, current.countryCode)) return false;
  if (normalizeManagedUserRole(user.role || '') === 'admin') return true;
  if (normalizeEmail(current.assignedTechEmail) === normalizeEmail(user?.email)) return true;
  if (current.type === 'instalacion') {
    return userRoleHasPermission(user, 'installations.execute')
      || userRoleHasPermission(user, 'installations.assign')
      || canUserManageCommercialQuoteFlow(user);
  }
  return userRoleHasPermission(user, 'visits.execute') || canUserManageCommercialQuoteFlow(user);
}

function isInstallationOrderReadyForConformity(order = {}) {
  const status = String(order?.status || '').trim().toLowerCase();
  return ['cerrada', 'instalada', 'pendiente_cierre'].includes(status);
}

function normalizeUserStatus(value) {
  const status = String(value || 'active').trim().toLowerCase();
  return ['pending', 'active', 'blocked'].includes(status) ? status : 'active';
}

function isStrongPin(value) {
  return /^\d{4,8}$/.test(String(value || '').trim());
}

function defaultTechVisits() {
  const users = readUsers();
  const orders = readJSON(files.installationOrders, []);
  const techs = users.filter((user) => isTechAssignableUser(user));
  const luis = techs.find((user) => normalizeEmail(user.email) === 'luis.campos@evinka.tech') || techs[0];
  const fallbackTech = techs[1] || techs[0] || {};
  const now = new Date();
  const futureA = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  const futureB = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString();
  const latestOrder = orders[orders.length - 1] || {};
  const previousOrder = orders[orders.length - 2] || latestOrder || {};
  return [
    normalizeTechVisit({
      id: 'VIS-CHATBOT-001',
      source: 'chatbot',
      type: 'visita_tecnica',
      status: 'agendada',
      clientName: latestOrder.clientName || 'Luis Angel',
      clientPhone: '999 000 111',
      clientEmail: latestOrder.clientEmail || 'frozenflamem4@gmail.com',
      clientAddress: latestOrder.address || 'Lima',
      scheduledAt: futureA,
      timeWindow: 'Próxima hora',
      notes: 'Visita creada desde el flujo del chatbot para validar instalación y confirmar alcance.',
      reference: 'Lead chatbot EVINKA',
      quoteId: latestOrder.quoteId || '',
      installationOrderId: latestOrder.id || '',
      assignedTechEmail: luis?.email || '',
      assignedTechName: luis?.name || 'Luis Campos',
      checklist: ['Confirmar acceso al sitio', 'Tomar fotos iniciales', 'Validar tablero y distancia'],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }),
    normalizeTechVisit({
      id: 'VIS-CHATBOT-002',
      source: 'chatbot',
      type: 'diagnostico',
      status: 'pendiente_cotizacion',
      clientName: previousOrder.clientName || 'Cliente EVINKA',
      clientPhone: '988 111 222',
      clientEmail: previousOrder.clientEmail || '',
      clientAddress: previousOrder.address || 'Pueblo Libre',
      scheduledAt: futureB,
      timeWindow: 'Hoy por la tarde',
      notes: 'Cliente consultó por cargador y requiere visita de levantamiento para cotización.',
      reference: 'Seguimiento chatbot',
      quoteId: previousOrder.quoteId || '',
      installationOrderId: previousOrder.id || '',
      assignedTechEmail: fallbackTech.email || luis?.email || '',
      assignedTechName: fallbackTech.name || luis?.name || 'Técnico EVINKA',
      checklist: ['Levantar fotos del sitio', 'Confirmar potencia requerida', 'Registrar observaciones del cliente'],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }),
  ];
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJSON(file, fallback) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (fallback && !Array.isArray(fallback) && typeof fallback === 'object') {
      return parsed && !Array.isArray(parsed) && typeof parsed === 'object'
        ? parsed
        : fallback;
    }
    if (Array.isArray(fallback)) {
      return Array.isArray(parsed) ? parsed : fallback;
    }
    return parsed;
  } catch {
    return fallback;
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function sanitizePdfFilenamePart(value, fallback = 'DOCUMENTO') {
  const normalized = String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized || fallback;
}

function persistPdfToQuotesDir({ id, label, pdfBase64 }) {
  const encoded = String(pdfBase64 || '').trim();
  if (!encoded) return { pdfUrl: '', pdfPath: '', pdfFilename: '' };
  const buffer = Buffer.from(encoded, 'base64');
  const safeId = sanitizePdfFilenamePart(id, 'DOC');
  const safeLabel = sanitizePdfFilenamePart(label, 'DOCUMENTO');
  const pdfFilename = `${safeId}-${safeLabel}.pdf`;
  fs.writeFileSync(path.join(quotesDir, pdfFilename), buffer);
  return {
    pdfUrl: `/pdf/${pdfFilename}`,
    pdfPath: `/pdf/${pdfFilename}`,
    pdfFilename,
  };
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeCountryCode(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return ['PE', 'CO', 'ALL'].includes(normalized) ? normalized : '';
}

function countryCurrency(countryCode = '') {
  return COUNTRY_DEFINITIONS.find((item) => item.code === normalizeCountryCode(countryCode))?.currency || 'PEN';
}

function getStoredCountryConfig(stored = {}, countryCode = 'PE') {
  const activeCountry = normalizeCountryCode(countryCode) || 'PE';
  const seeded = defaultConfig().countryConfigs?.[activeCountry] || {};
  const base = {
    company: { ...(stored.company || {}) },
    currency: stored.currency || countryCurrency(activeCountry),
    defaults: { ...(stored.defaults || {}) },
    commercialProfiles: Array.isArray(stored.commercialProfiles) ? stored.commercialProfiles : [],
    catalog: { ...(stored.catalog || {}), items: Array.isArray(stored.catalog?.items) ? stored.catalog.items : [] },
  };
  const scoped = {
    ...seeded,
    ...(stored.countryConfigs?.[activeCountry] || {}),
  };
  return {
    company: { ...base.company, ...(scoped.company || {}) },
    currency: scoped.currency || base.currency || countryCurrency(activeCountry),
    defaults: { ...base.defaults, ...(scoped.defaults || {}) },
    commercialProfiles: Array.isArray(scoped.commercialProfiles) && scoped.commercialProfiles.length
      ? scoped.commercialProfiles
      : base.commercialProfiles,
    catalog: {
      ...base.catalog,
      ...(scoped.catalog || {}),
      items: Array.isArray(scoped.catalog?.items) && scoped.catalog.items.length
        ? scoped.catalog.items
        : base.catalog.items,
    },
  };
}

function resolveRequestCountryContext(req, user = null) {
  const hostCountry = inferCountryFromHost(req);
  if (hostCountry && userCanAccessCountry(user, hostCountry)) return hostCountry;
  const requested = normalizeCountryCode(req?.query?.country || req?.body?.countryCode || '');
  if (requested === 'ALL' && userHasGlobalCountryAccess(user)) return 'ALL';
  if (requested && requested !== 'ALL' && userCanAccessCountry(user, requested)) return requested;
  if (userHasGlobalCountryAccess(user)) return 'ALL';
  return resolveUserPrimaryCountry(user) || '';
}

function inferCountryFromHost(req) {
  const host = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  if (!host) return '';
  if (['co.evinka.net', 'colombia.evinka.net', 'co.cotizador.evinka.net', 'co-cotizador.evinka.net', 'co-suite.evinka.net'].includes(host)) return 'CO';
  if (['pe.evinka.net', 'peru.evinka.net', 'pe.cotizador.evinka.net', 'pe-cotizador.evinka.net', 'pe-suite.evinka.net'].includes(host)) return 'PE';
  return '';
}

function matchesCountryScope(recordCountryCode = '', scopeCountryCode = '') {
  const scope = normalizeCountryCode(scopeCountryCode);
  if (!scope || scope === 'ALL') return true;
  return normalizeCountryCode(recordCountryCode) === scope;
}

function normalizeCountryText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function inferCountryFromPhone(value = '') {
  const digits = String(value || '').replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.startsWith('51') || /^9\d{8}$/.test(digits)) return 'PE';
  if (digits.startsWith('57') || /^3\d{9}$/.test(digits)) return 'CO';
  return '';
}

function inferCountryFromSources(...values) {
  for (const value of values) {
    const code = normalizeCountryCode(value);
    if (code && code !== 'ALL') return code;
  }
  for (const value of values) {
    const phoneCountry = inferCountryFromPhone(value);
    if (phoneCountry) return phoneCountry;
  }
  const text = values.map((item) => normalizeCountryText(item)).filter(Boolean).join(' | ');
  if (!text) return '';
  if (/(colombia|bogota|medellin|cali|suba|usaquen|chapinero|engativa|fontibon|kennedy|mosquera|chia|envigado|sabaneta|soacha|jamundi)/.test(text)) return 'CO';
  if (/(peru|lima|callao|miraflores|san isidro|san borja|surco|pueblo libre|la molina|san miguel|jesus maria|arequipa|cusco|trujillo|piura)/.test(text)) return 'PE';
  return '';
}

function normalizeUserAllowedCountries(user = {}) {
  return Array.isArray(user?.allowedCountries)
    ? [...new Set(user.allowedCountries.map((item) => normalizeCountryCode(item)).filter(Boolean))]
    : [];
}

function resolveUserPrimaryCountry(user = {}) {
  const allowed = normalizeUserAllowedCountries(user).filter((item) => item !== 'ALL');
  return allowed.length === 1 ? allowed[0] : '';
}

function userHasGlobalCountryAccess(user = {}) {
  if (!user) return true;
  const role = normalizeManagedUserRole(user.role || 'tech');
  const allowed = normalizeUserAllowedCountries(user);
  return role === 'admin' || !allowed.length || allowed.includes('ALL');
}

function userCanAccessCountry(user = {}, countryCode = '') {
  const normalized = normalizeCountryCode(countryCode);
  if (!normalized) return userHasGlobalCountryAccess(user);
  if (userHasGlobalCountryAccess(user)) return true;
  return normalizeUserAllowedCountries(user).includes(normalized);
}

function assertUserCanAccessCountry(user = {}, countryCode = '', message = 'No tienes permiso para acceder a este país.') {
  if (userCanAccessCountry(user, countryCode)) return true;
  const error = new Error(message);
  error.statusCode = 403;
  throw error;
}

function quoteCountryCode(quote = {}) {
  return resolveRecordCountryCode(quote.countryCode, quote.city, quote.clientAddress, quote.email);
}

function visitCountryCode(visit = {}) {
  return resolveRecordCountryCode(visit.countryCode, visit.clientPhone, visit.clientAddress, visit.clientEmail, visit.notes);
}

function orderCountryCode(order = {}) {
  return resolveRecordCountryCode(order.countryCode, order.city, order.address, order.clientEmail);
}

function conformityCountryCode(conformity = {}) {
  return resolveRecordCountryCode(conformity.countryCode, conformity.address, conformity.clientEmail);
}

function resolveRecordCountryCode(...values) {
  return inferCountryFromSources(...values);
}

function normalizeInstallationOrder(order = {}) {
  return {
    ...order,
    countryCode: orderCountryCode(order),
  };
}

function normalizeConformityRecord(item = {}) {
  return {
    id: String(item.id || '').trim(),
    installationOrderId: String(item.installationOrderId || '').trim(),
    quoteId: String(item.quoteId || '').trim(),
    warrantyId: String(item.warrantyId || '').trim(),
    warrantyCode: String(item.warrantyCode || '').trim(),
    warrantyValidUntil: String(item.warrantyValidUntil || '').trim(),
    warrantyPdfUrl: String(item.warrantyPdfUrl || '').trim(),
    date: String(item.date || '').trim(),
    countryCode: conformityCountryCode(item),
    clientName: String(item.clientName || '').trim(),
    clientEmail: normalizeEmail(item.clientEmail || ''),
    ruc: String(item.ruc || '').trim(),
    address: String(item.address || '').trim(),
    chargerBrand: String(item.chargerBrand || '').trim(),
    serialNumber: String(item.serialNumber || '').trim(),
    voltage: String(item.voltage || '').trim(),
    amperage: String(item.amperage || '').trim(),
    other: String(item.other || '').trim(),
    powerKw: String(item.powerKw || '').trim(),
    observations: String(item.observations || '').trim(),
    deliveredItems: Array.isArray(item.deliveredItems) ? item.deliveredItems : [],
    cajaCargador: item.cajaCargador === true,
    cargadorEvinka: item.cargadorEvinka === true,
    manualCargador: item.manualCargador === true,
    tarjetasCargador: item.tarjetasCargador === true,
    adicional: item.adicional === true,
    adicionalDesc: String(item.adicionalDesc || '').trim(),
    photoUrls: Array.isArray(item.photoUrls) ? item.photoUrls : [],
    installerSignatureUrl: String(item.installerSignatureUrl || '').trim(),
    clientSignatureUrl: String(item.clientSignatureUrl || '').trim(),
    pdfUrl: String(item.pdfUrl || '').trim(),
    pdfPath: String(item.pdfPath || '').trim(),
    pdfFilename: String(item.pdfFilename || '').trim(),
    pdfBase64: String(item.pdfBase64 || '').trim(),
    hasPdfBase64: Boolean(String(item.pdfBase64 || '').trim()),
    status: String(item.status || 'pdf_generated').trim(),
    createdAt: String(item.createdAt || '').trim(),
    createdBy: String(item.createdBy || '').trim(),
    emailDelivery: item.emailDelivery || null,
  };
}

function normalizeWarrantyRecord(item = {}) {
  return {
    id: String(item.id || '').trim(),
    warrantyCode: String(item.warrantyCode || '').trim(),
    validUntil: String(item.validUntil || '').trim(),
    installationOrderId: String(item.installationOrderId || '').trim(),
    quoteId: String(item.quoteId || '').trim(),
    countryCode: resolveRecordCountryCode(item.countryCode, item.address, item.clientEmail),
    clientName: String(item.clientName || '').trim(),
    clientEmail: normalizeEmail(item.clientEmail || ''),
    clientDocument: String(item.clientDocument || '').trim(),
    address: String(item.address || '').trim(),
    chargerBrand: String(item.chargerBrand || '').trim(),
    serialNumber: String(item.serialNumber || '').trim(),
    voltage: String(item.voltage || '').trim(),
    amperage: String(item.amperage || '').trim(),
    powerKw: String(item.powerKw || '').trim(),
    installerSignatureUrl: String(item.installerSignatureUrl || '').trim(),
    clientSignatureUrl: String(item.clientSignatureUrl || '').trim(),
    pdfUrl: String(item.pdfUrl || '').trim(),
    pdfPath: String(item.pdfPath || '').trim(),
    pdfFilename: String(item.pdfFilename || '').trim(),
    pdfBase64: String(item.pdfBase64 || '').trim(),
    hasPdfBase64: Boolean(String(item.pdfBase64 || '').trim()),
    status: String(item.status || 'warranty_generated').trim(),
    createdAt: String(item.createdAt || '').trim(),
    createdBy: String(item.createdBy || '').trim(),
  };
}

function isAllowedCorporateEmail(email) {
  const normalized = normalizeEmail(email);
  return ALLOWED_CORPORATE_DOMAINS.some((domain) => normalized.endsWith(`@${domain}`));
}

function allowedCorporateDomainsLabel() {
  return ALLOWED_CORPORATE_DOMAINS.map((domain) => `@${domain}`).join(' o ');
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function isStrongPassword(value) {
  const password = String(value || '');
  return password.length >= 10 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(hash, 'hex'));
}

function invalidateUserSessions(userId) {
  const sessions = readJSON(files.sessions, {});
  let changed = false;
  for (const [token, session] of Object.entries(sessions)) {
    if (session?.userId === userId) {
      delete sessions[token];
      changed = true;
    }
  }
  if (changed) writeJSON(files.sessions, sessions);
}

function parseCookie(header) {
  return header.split(';').reduce((acc, pair) => {
    const index = pair.indexOf('=');
    if (index === -1) return acc;
    const key = pair.slice(0, index).trim();
    const value = decodeURIComponent(pair.slice(index + 1).trim());
    acc[key] = value;
    return acc;
  }, {});
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function roundQty(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function money(value) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 2 }).format(Number(value || 0));
}

function amount(value) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
}

function pdfCurrencyLabel(quote = {}) {
  return quote?.countryCode === 'CO' ? '$' : 'S/';
}

function pdfAmount(quote = {}, value) {
  if (quote?.countryCode === 'CO') {
    return new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(value || 0));
  }
  return amount(value);
}

function normalizeQuotePdfTemplate(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'motorysa' ? 'motorysa' : normalized === 'standard' ? 'standard' : '';
}

function resolveProfilePdfTemplate(profile = {}) {
  const profileId = slugProfileId(profile?.id || profile?.name || '');
  const profileName = String(profile?.name || '').trim().toLowerCase();
  if (profileId === 'motorysa' || profileName.includes('motorysa')) return 'motorysa';
  return 'standard';
}

function resolveQuotePdfTemplate(quote = {}) {
  const explicit = normalizeQuotePdfTemplate(quote?.pdfTemplate || quote?.templateKind || quote?.quoteTemplate);
  if (explicit) return explicit;
  if (quote?.commercialProfile || quote?.commercialProfileId || quote?.commercialProfileName) {
    return resolveProfilePdfTemplate({
      id: quote?.commercialProfile?.id || quote?.commercialProfileId,
      name: quote?.commercialProfile?.name || quote?.commercialProfileName,
    });
  }
  const company = String(quote?.companyName || '').trim().toLowerCase();
  const client = String(quote?.clientName || '').trim().toLowerCase();
  const email = String(quote?.email || '').trim().toLowerCase();
  return [company, client, email].some((value) => value.includes('motorysa')) ? 'motorysa' : 'standard';
}

function quotePdfTemplateKind(quote = {}) {
  return resolveQuotePdfTemplate(quote);
}

function buildQuoteIntro(quote = {}) {
  if (quote.countryCode === 'CO') {
    return 'De acuerdo con su solicitud, a continuación presentamos la propuesta económica para la instalación del sistema de carga del vehículo eléctrico, elaborada con base en la información comercial y técnica actualmente disponible.';
  }
  return 'Nos es grato presentar la siguiente cotización por el servicio de instalación propuesto:';
}

function buildTraceabilityLines({ orderCode = '-', warrantyCode = '-', serialNumber = '-', record = '-' } = {}) {
  return [
    `Código de orden: ${orderCode || '-'}`,
    `Código de garantía: ${warrantyCode || '-'}`,
    `Número de serie: ${serialNumber || '-'}`,
    `Registro: ${record || '-'}`,
  ];
}

function buildLegalAddendumLines() {
  return [
    'Todo trabajo o adecuación no detallada expresamente en esta propuesta será considerado adicional y cotizado por separado.',
    'El cliente autoriza el registro y uso de fotografías de la instalación y equipos con fines de soporte técnico, trazabilidad, capacitación y material comercial o publicitario, evitando divulgar información sensible.',
    'La responsabilidad de EVINKA se limita al alcance del servicio contratado y al valor efectivamente pagado por el cliente.',
    'Aplican las condiciones del Certificado de Garantía EVINKA entregado junto con la instalación.',
  ];
}

function buildWarrantyLegalLines() {
  return [
    'Sección 5: La atención de garantía estará sujeta a evaluación técnica y disponibilidad operativa de EVINKA, no implicando reemplazo inmediato ni cobertura de perjuicios indirectos o lucro cesante.',
    'Sección 7: Funciones remotas, conectividad, aplicaciones, plataformas, integración OCPP o servicios en línea podrán depender de terceros, internet o condiciones externas ajenas al control de EVINKA.',
    'Sección 8: EVINKA podrá reparar, reemplazar componentes o aplicar soluciones técnicas equivalentes según evaluación técnica y disponibilidad.',
    'Sección 10: La garantía no cubre trabajos civiles, acabados, pintura, modificaciones posteriores de la instalación ni daños ocasionados por infraestructura eléctrica preexistente del inmueble. La atención de garantía estará sujeta a evaluación técnica y disponibilidad operativa de EVINKA, no implicando reemplazo inmediato ni cobertura de perjuicios indirectos o lucro cesante. Funciones remotas, conectividad, aplicaciones, plataformas, integración OCPP o servicios en línea podrán depender de terceros, internet o condiciones externas ajenas al control de EVINKA. Los tiempos de carga y desempeño final podrán variar según el vehículo, batería, suministro eléctrico y condiciones externas de operación. EVINKA podrá conservar registro fotográfico técnico de la instalación para fines de trazabilidad, soporte, capacitación y mejora continua.',
  ];
}

function buildQuoteSectionsForPdf(quote = {}) {
  if (quote.countryCode !== 'CO') {
    return [
      { title: 'Servicio de Instalación Estándar de Cargador', lines: [buildServiceParagraph(quote)], bullets: buildIncludedBulletLines(quote) },
      {
        title: 'Trazabilidad documental y condiciones legales',
        lines: buildTraceabilityLines({
          orderCode: quote.installationOrderId || quote.id || '-',
          warrantyCode: quote.warrantyCode || 'Se emite al cierre',
          serialNumber: quote.serialNumber || '-',
          record: quote.id || quote.installationOrderId || '-',
        }),
        bullets: buildLegalAddendumLines(),
      },
    ];
  }
  const chargerRef = quote.chargerReference || quote.charger?.label || 'cargador';
  const templateKind = quotePdfTemplateKind(quote);
  return [
    {
      title: 'Objeto',
      lines: [
        buildServiceParagraph(quote),
        `Cliente: ${formatDisplayName(quote.clientName) || '-'} · Documento: ${quote.documentType || '-'} ${quote.clientDocument || '-'}.`,
      ],
      bullets: [],
    },
    {
      title: templateKind === 'motorysa' ? 'Alcance técnico de la instalación' : 'Alcance de la instalación propuesta',
      lines: [
        `Se contempla la instalación para la referencia ${chargerRef}, considerando la acometida existente, el recorrido del cableado y las protecciones requeridas.`,
      ],
      bullets: buildIncludedBulletLines(quote).slice(0, 6),
    },
    {
      title: 'Condiciones del sitio',
      lines: [
        `Ubicación: ${[quote.city, quote.department, quote.locality, quote.neighborhood, quote.address].filter(Boolean).join(' / ') || '-'}.`,
        `Acometida reportada: ${quote.acometidaType || '-'} · Calibre ${quote.acometidaCaliber || '-'} · Breaker principal ${quote.primaryBreaker || '-'}.`,
      ],
      bullets: (quote.reviewReasons || []).length ? quote.reviewReasons : ['La propuesta está sujeta a confirmación técnica final en sitio.'],
    },
    {
      title: 'Exclusiones y aclaraciones',
      lines: [
        'La cotización corresponde únicamente al servicio de instalación y materiales definidos en el presente documento.',
        'Cualquier adecuación eléctrica adicional no contemplada expresamente será cotizada por separado.',
      ],
      bullets: [],
    },
    {
      title: 'Trazabilidad documental y condiciones legales',
      lines: buildTraceabilityLines({
        orderCode: quote.installationOrderId || quote.id || '-',
        warrantyCode: quote.warrantyCode || 'Se emite al cierre',
        serialNumber: quote.serialNumber || '-',
        record: quote.id || quote.installationOrderId || '-',
      }),
      bullets: buildLegalAddendumLines(),
    },
  ];
}

function formatNumber(value) {
  return new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatDate(value) {
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: DISPLAY_TIME_ZONE }).format(new Date(value));
}

function formatDateOnly(value) {
  return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: DISPLAY_TIME_ZONE }).format(new Date(value));
}

function formatTimeOnly(value) {
  return new Intl.DateTimeFormat('es-PE', { hour: 'numeric', minute: '2-digit', timeZone: DISPLAY_TIME_ZONE }).format(new Date(value));
}

function clickUpEnabled() {
  return Boolean(CLICKUP_API_TOKEN && CLICKUP_B2C_LIST_ID);
}

function buildClickUpVisitTaskName(visit = {}) {
  const client = String(visit.clientName || 'Cliente EVINKA').trim();
  const date = visit.scheduledAt ? formatDateOnly(visit.scheduledAt) : 'sin fecha';
  const time = visit.scheduledAt ? formatTimeOnly(visit.scheduledAt) : 'sin hora';
  return `${client} - ${date} - ${time}`;
}

let clickUpFieldMapCache = null;

function findQuoteForVisit(visit = {}) {
  const quoteId = String(visit.quoteId || '').trim();
  if (!quoteId) return null;
  return readJSON(files.quotes, [])
    .map(normalizeStoredQuote)
    .find((item) => item.id === quoteId) || null;
}

function buildLeadSourceLabel(visit = {}) {
  const source = String(visit.source || '').trim().toLowerCase();
  if (source === 'chatbot') return 'Chatbot WhatsApp EVINKA';
  if (source === 'app') return 'Cotizador / operación EVINKA';
  return String(visit.source || 'EVINKA').trim() || 'EVINKA';
}

function extractVehicleBrand(visit = {}, quote = null) {
  const raw = String(quote?.vehicleModel || '').trim();
  if (!raw) return '';
  return raw.split(/[\/,-]/)[0].trim();
}

function extractDistrictFromAddress(address = '') {
  const value = String(address || '').replace(/\s+/g, ' ').trim();
  if (!value) return '';
  const compact = value;
  const limaCercado = compact.match(/\b(lima cercado|cercado de lima)\b/i);
  if (limaCercado) return 'Lima Cercado';
  const numberMatch = compact.match(/\d+[A-Za-z-]*\s+(.*)$/);
  const tail = String(numberMatch?.[1] || '').trim();
  const tokens = tail ? tail.split(/\s+/).filter(Boolean) : [];
  while (tokens.length > 1 && ['lima', 'callao', 'peru', 'perú', 'colombia', 'bogota', 'bogotá', 'medellin', 'medellín', 'cali'].includes(tokens[tokens.length - 1].toLowerCase())) {
    tokens.pop();
  }
  if (tokens.length >= 2) return tokens.slice(-2).join(' ');
  if (tokens.length === 1) return tokens[0];
  return '';
}

function resolveClickUpDistrict(visit = {}, quote = null) {
  return String(
    visit.clientDistrict
    || visit.district
    || quote?.locality
    || quote?.neighborhood
    || extractDistrictFromAddress(visit.clientAddress || quote?.address || '')
    || ''
  ).trim();
}

function resolveClickUpVisitStatus(visit = {}, quote = null) {
  const visitStatus = String(visit.status || '').trim().toLowerCase();
  const quoteStatus = String(quote?.status || '').trim().toLowerCase();
  const conformityStatus = String(quote?.conformityStatus || '').trim().toLowerCase();
  if (quoteStatus === 'abono_100_confirmado') return 'Closed';
  if (conformityStatus === 'pdf_generated' || ['pendiente_cierre', 'cerrada'].includes(visitStatus) || quoteStatus === 'instalada') {
    return 'finalizados';
  }
  if (
    String(visit.type || '').trim().toLowerCase() === 'instalacion'
    || ['agendada', 'en_ruta', 'en_visita'].includes(visitStatus)
    || quoteStatus === 'aceptada_cliente'
    || visitStatus === 'aceptada_cliente'
  ) {
    return 'en ejecución';
  }
  if (['recotizar', 'cancelada'].includes(quoteStatus) || ['recotizar', 'cancelada', 'reprogramada'].includes(visitStatus)) {
    return 'trabajo previo / a la espe';
  }
  if (visitStatus === 'lista_envio' || quoteStatus === 'lista_envio') {
    return 'cotizados';
  }
  if (
    visitStatus === 'pendiente_cotizacion'
    || visitStatus === 'cotizada'
    || quoteStatus === 'cotizada'
  ) {
    return CLICKUP_B2C_QUOTE_PENDING_STATUS;
  }
  return CLICKUP_B2C_STATUS;
}

async function getClickUpFieldMap() {
  if (clickUpFieldMapCache) return clickUpFieldMapCache;
  const data = await clickUpRequest('GET', `/list/${encodeURIComponent(CLICKUP_B2C_LIST_ID)}/field`);
  const map = {};
  for (const field of data.fields || []) {
    const name = String(field?.name || '').trim().toLowerCase();
    if (!name) continue;
    map[name] = field;
  }
  clickUpFieldMapCache = map;
  return map;
}

async function buildClickUpCustomFields(visit = {}, quote = null) {
  const fieldMap = await getClickUpFieldMap();
  const values = [];
  const pushValue = (fieldName, value) => {
    const field = fieldMap[String(fieldName || '').trim().toLowerCase()];
    if (!field || value == null || value === '') return;
    values.push({ id: field.id, value });
  };

  const rawPhone = String(visit.clientPhone || quote?.phone || '').trim();
  const phoneDigits = normalizePhoneForWhatsApp(rawPhone);
  const phone = phoneDigits ? `+${phoneDigits}` : '';
  const address = String(visit.clientAddress || quote?.address || '').trim();
  const leadSource = buildLeadSourceLabel(visit);
  const vehicleBrand = extractVehicleBrand(visit, quote);
  const district = resolveClickUpDistrict(visit, quote);

  pushValue('numero del cliente', phone);
  pushValue('ubicacion del cliente', address);
  pushValue('procedencia del lead', leadSource);
  pushValue('distrito', district);
  // Se usa solo el campo de texto para evitar duplicar datos entre "MARCA" y "🚙 MARCA".
  pushValue('🚙 marca', vehicleBrand);
  return values;
}

function buildClickUpVisitTaskDescription(visit = {}, quote = null) {
  const normalizedStatus = String(visit.status || '').trim().toLowerCase();
  const lines = [
    'Visita técnica creada automáticamente desde el chatbot de WhatsApp.',
    '',
    `Cliente: ${visit.clientName || '-'}`,
    `Teléfono: ${visit.clientPhone || '-'}`,
    `Correo: ${visit.clientEmail || '-'}`,
    `Documento: ${visit.clientDocument || '-'}`,
    `Dirección: ${visit.clientAddress || '-'}`,
    `Fecha programada: ${visit.scheduledAt ? formatDate(visit.scheduledAt) : '-'}`,
    `Franja: ${visit.timeWindow || '-'}`,
    `Referencia: ${visit.reference || '-'}`,
    `Estado operativo: ${normalizedStatus || '-'}`,
    `Técnico asignado: ${visit.assignedTechName || visit.assignedTechEmail || '-'}`,
    `Procedencia del lead: ${buildLeadSourceLabel(visit)}`,
    `Cotización: ${quote?.id || visit.quoteId || '-'}`,
    `Estado cotización: ${quote?.status || '-'}`,
    `Orden instalación: ${quote?.installationOrderId || visit.installationOrderId || '-'}`,
    '',
    `Notas: ${visit.notes || 'Sin notas.'}`,
  ];
  return lines.join('\n').trim();
}

async function buildClickUpVisitPayload(visit = {}, quote = null) {
  const scheduledAt = visit.scheduledAt ? new Date(visit.scheduledAt) : null;
  const startMs = scheduledAt && Number.isFinite(scheduledAt.getTime())
    ? scheduledAt.getTime()
    : null;
  const durationMinutes = Number.isFinite(CLICKUP_DEFAULT_DURATION_MINUTES) && CLICKUP_DEFAULT_DURATION_MINUTES > 0
    ? CLICKUP_DEFAULT_DURATION_MINUTES
    : 60;
  const dueMs = startMs ? startMs + durationMinutes * 60 * 1000 : null;
  const customFields = await buildClickUpCustomFields(visit, quote);
  return {
    name: buildClickUpVisitTaskName(visit),
    description: buildClickUpVisitTaskDescription(visit, quote),
    status: resolveClickUpVisitStatus(visit, quote),
    priority: 3,
    start_date: startMs ? String(startMs) : undefined,
    start_date_time: Boolean(startMs),
    due_date: dueMs ? String(dueMs) : undefined,
    due_date_time: Boolean(dueMs),
    custom_fields: customFields,
  };
}

function resolveClickUpMilestoneAssigneeIds(visit = {}, quote = null) {
  return [];
}

async function buildClickUpCreateVisitPayload(visit = {}, quote = null) {
  const payload = await buildClickUpVisitPayload(visit, quote);
  const milestoneAssignees = resolveClickUpMilestoneAssigneeIds(visit, quote);
  if (milestoneAssignees.length) {
    payload.assignees = milestoneAssignees;
  } else if (Number.isFinite(CLICKUP_B2C_DEFAULT_ASSIGNEE_ID) && CLICKUP_B2C_DEFAULT_ASSIGNEE_ID > 0) {
    payload.assignees = [CLICKUP_B2C_DEFAULT_ASSIGNEE_ID];
  }
  return payload;
}

async function clickUpRequest(method, endpoint, payload = null) {
  const response = await fetch(`${CLICKUP_API_BASE}${endpoint}`, {
    method,
    headers: {
      Authorization: CLICKUP_API_TOKEN,
      'Content-Type': 'application/json',
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`ClickUp ${response.status}: ${data.err || data.error || response.statusText}`);
  }
  return data;
}

async function syncClickUpCustomFields(taskId, fields = []) {
  for (const field of fields) {
    if (!field?.id) continue;
    await clickUpRequest(
      'POST',
      `/task/${encodeURIComponent(taskId)}/field/${encodeURIComponent(field.id)}`,
      { value: field.value },
    );
  }
}

function isClickUpNotFoundError(error) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /clickup\s+404/i.test(message) || /task not found/i.test(message) || /deleted/i.test(message);
}

async function getClickUpAttachmentNames(taskId) {
  const normalizedTaskId = String(taskId || '').trim();
  if (!normalizedTaskId) return new Set();
  const currentTask = await clickUpRequest('GET', `/task/${encodeURIComponent(normalizedTaskId)}`);
  const names = Array.isArray(currentTask?.attachments)
    ? currentTask.attachments
      .map((item) => String(item?.title || item?.name || '').trim())
      .filter(Boolean)
    : [];
  return new Set(names);
}

async function attachBufferToClickUpTask(taskId, {
  buffer,
  fileName = '',
  mimeType = 'application/octet-stream',
} = {}, attachedNames = null) {
  const normalizedTaskId = String(taskId || '').trim();
  const normalizedFileName = String(fileName || '').trim();
  if (!normalizedTaskId || !normalizedFileName || !buffer) {
    return { ok: false, skipped: true, reason: 'missing_attachment_payload' };
  }
  const knownNames = attachedNames || await getClickUpAttachmentNames(normalizedTaskId);
  if (knownNames.has(normalizedFileName)) {
    return { ok: true, skipped: true, reason: 'already_attached' };
  }
  const form = new FormData();
  form.append('attachment', new Blob([buffer], { type: mimeType || 'application/octet-stream' }), normalizedFileName);

  const response = await fetch(`${CLICKUP_API_BASE}/task/${encodeURIComponent(normalizedTaskId)}/attachment`, {
    method: 'POST',
    headers: {
      Authorization: CLICKUP_API_TOKEN,
    },
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`ClickUp attachment ${response.status}: ${data.err || data.error || response.statusText}`);
  }
  knownNames.add(normalizedFileName);
  return {
    ok: true,
    skipped: false,
    attachmentId: String(data?.id || '').trim(),
    attachmentTitle: String(data?.title || normalizedFileName).trim(),
  };
}

async function attachQuotePdfToClickUpTask(taskId, quote = null, attachedNames = null) {
  const normalizedTaskId = String(taskId || '').trim();
  const pdfPath = String(quote?.pdfFile || '').trim();
  const pdfFilename = String(quote?.pdfFilename || path.basename(pdfPath || '')).trim();
  if (!normalizedTaskId || !pdfPath || !pdfFilename) {
    return { ok: false, skipped: true, reason: 'missing_pdf' };
  }
  if (!fs.existsSync(pdfPath)) {
    return { ok: false, skipped: true, reason: 'pdf_not_found', error: `No existe el PDF ${pdfPath}` };
  }
  const buffer = await fs.promises.readFile(pdfPath);
  return attachBufferToClickUpTask(normalizedTaskId, {
    buffer,
    fileName: pdfFilename,
    mimeType: 'application/pdf',
  }, attachedNames);
}

function isUuidLike(value = '') {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function normalizeStoragePhone(value = '') {
  return String(value || '').replace(/\D+/g, '');
}

async function listClientFilesForClickUpContext({ visit = {}, quote = null } = {}) {
  if (!liveBookingsSb) return [];
  const reference = String(visit?.reference || quote?.reference || '').trim();
  const phone = normalizeStoragePhone(visit?.clientPhone || quote?.phone || '');
  const conversationIds = new Set();
  const rows = [];

  if (reference) {
    if (isUuidLike(reference)) conversationIds.add(reference);
    try {
      const conversations = await liveBookingsSb.select(
        'conversaciones',
        `codigo_ticket_solicitado=eq.${encodeURIComponent(reference)}&select=id_conversacion&limit=20`,
      );
      for (const item of conversations) {
        const conversationId = String(item?.id_conversacion || '').trim();
        if (conversationId) conversationIds.add(conversationId);
      }
    } catch (error) {
      console.warn('listClientFilesForClickUpContext conversations lookup failed:', error?.message || error);
    }
  }

  const queries = [];
  if (reference) {
    queries.push(`ticket_id=eq.${encodeURIComponent(reference)}&select=*&order=created_at.asc&limit=100`);
  }
  if (conversationIds.size) {
    queries.push(`conversation_id=in.(${[...conversationIds].join(',')})&select=*&order=created_at.asc&limit=100`);
  }
  if (!queries.length && phone) {
    queries.push(`phone=eq.${encodeURIComponent(phone)}&select=*&order=created_at.asc&limit=50`);
  }

  for (const query of queries) {
    try {
      const result = await liveBookingsSb.select('client_files', query);
      if (Array.isArray(result)) rows.push(...result);
    } catch (error) {
      if (!String(error?.message || '').includes('client_files')) {
        console.warn('listClientFilesForClickUpContext files lookup failed:', error?.message || error);
      }
    }
  }

  const seen = new Set();
  return rows.filter((item) => {
    const key = [
      String(item?.id || '').trim(),
      String(item?.storage_bucket || '').trim(),
      String(item?.storage_path || '').trim(),
      String(item?.file_name || '').trim(),
    ].join('|');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function downloadClientFileForClickUp(file = {}) {
  const bucket = String(file?.storage_bucket || '').trim();
  const objectPath = String(file?.storage_path || '').trim();
  const fileName = String(file?.file_name || 'archivo').trim() || 'archivo';
  const mimeType = String(file?.mime_type || 'application/octet-stream').trim() || 'application/octet-stream';
  if (liveStorageSb && bucket && objectPath) {
    const downloaded = await liveStorageSb.downloadObject(bucket, objectPath);
    return {
      buffer: downloaded.buffer,
      fileName,
      mimeType: downloaded.mimeType || mimeType,
    };
  }
  const url = String(file?.signed_url || file?.public_url || '').trim();
  if (!url) {
    throw new Error(`No encontré storage para ${fileName}.`);
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`No pude descargar ${fileName} (${response.status}).`);
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    fileName,
    mimeType: response.headers.get('content-type') || mimeType,
  };
}

async function attachOperationalCaseFilesToClickUpTask(taskId, {
  visit = null,
  quote = null,
  conformity = null,
  warranty = null,
} = {}) {
  const normalizedTaskId = String(taskId || '').trim();
  if (!normalizedTaskId) return { ok: false, skipped: true, reason: 'missing_task' };

  let attachedNames = null;
  const attached = [];
  const errors = [];

  try {
    attachedNames = await getClickUpAttachmentNames(normalizedTaskId);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error || 'No pude leer los adjuntos actuales de ClickUp.'));
    attachedNames = new Set();
  }

  if (quote) {
    try {
      const result = await attachQuotePdfToClickUpTask(normalizedTaskId, quote, attachedNames);
      if (result.ok && !result.skipped) attached.push(result.attachmentTitle || String(quote?.pdfFilename || '').trim());
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error || 'No pude adjuntar la cotización.'));
    }
  }

  for (const generated of [
    conformity
      ? {
          base64: String(conformity.pdfBase64 || '').trim(),
          fileName: String(conformity.pdfFilename || `Conformidad_${conformity.installationOrderId || conformity.id}.pdf`).trim(),
          mimeType: 'application/pdf',
        }
      : null,
    warranty
      ? {
          base64: String(warranty.pdfBase64 || '').trim(),
          fileName: String(warranty.pdfFilename || `Garantia_${warranty.installationOrderId || warranty.id}.pdf`).trim(),
          mimeType: 'application/pdf',
        }
      : null,
  ].filter(Boolean)) {
    if (!generated.base64 || !generated.fileName) continue;
    try {
      const result = await attachBufferToClickUpTask(normalizedTaskId, {
        buffer: Buffer.from(generated.base64, 'base64'),
        fileName: generated.fileName,
        mimeType: generated.mimeType,
      }, attachedNames);
      if (result.ok && !result.skipped) attached.push(result.attachmentTitle || generated.fileName);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error || `No pude adjuntar ${generated.fileName}.`));
    }
  }

  const clientFiles = await listClientFilesForClickUpContext({ visit: visit || {}, quote });
  for (const file of clientFiles) {
    try {
      const downloaded = await downloadClientFileForClickUp(file);
      const result = await attachBufferToClickUpTask(normalizedTaskId, downloaded, attachedNames);
      if (result.ok && !result.skipped) attached.push(result.attachmentTitle || downloaded.fileName);
    } catch (error) {
      const fileName = String(file?.file_name || 'archivo').trim() || 'archivo';
      errors.push(error instanceof Error ? `${fileName}: ${error.message}` : `${fileName}: ${String(error || 'error desconocido')}`);
    }
  }

  return {
    ok: errors.length === 0,
    skipped: !attached.length && !clientFiles.length,
    attached,
    clientFilesFound: clientFiles.length,
    error: errors.join(' | '),
  };
}

async function requestGlobalVisitDeleteSync({ eventId = '', ticket = '', countryCode = '' } = {}) {
  const normalizedEventId = String(eventId || '').trim();
  const normalizedTicket = String(ticket || '').trim();
  if (!normalizedEventId && !normalizedTicket) return { ok: true, skipped: true };
  const response = await fetch(`${META_WEBHOOK_INTERNAL_URL}/api/internal/global-visit-delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-evinka-bot-key': BOT_VISITS_API_KEY,
    },
    body: JSON.stringify({
      eventId: normalizedEventId,
      ticket: normalizedTicket,
      countryCode: String(countryCode || '').trim().toUpperCase(),
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `No pude eliminar la visita globalmente en meta-webhook (${response.status}).`);
  }
  return data;
}

function resolveStorageFilePath(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (path.isAbsolute(raw)) return raw;
  if (raw.startsWith('/pdf/')) return path.join(quotesDir, raw.replace(/^\/pdf\//, ''));
  if (raw.startsWith('pdf/')) return path.join(quotesDir, raw.replace(/^pdf\//, ''));
  return '';
}

function archiveDeletedFile(filePath = '', backupDir = '') {
  const normalized = String(filePath || '').trim();
  if (!normalized || !fs.existsSync(normalized)) return '';
  const destination = path.join(backupDir, path.basename(normalized));
  try {
    fs.renameSync(normalized, destination);
    return destination;
  } catch {
    try {
      fs.copyFileSync(normalized, destination);
      fs.unlinkSync(normalized);
      return destination;
    } catch {
      return '';
    }
  }
}

function matchesDeletedCaseAuditEntry(entry = {}, {
  visitId = '',
  relatedVisitIds = [],
  quoteId = '',
  orderId = '',
  reference = '',
  conformityIds = [],
  warrantyIds = [],
} = {}) {
  const ids = new Set([
    String(visitId || '').trim(),
    ...relatedVisitIds.map((item) => String(item || '').trim()),
    String(quoteId || '').trim(),
    String(orderId || '').trim(),
    String(reference || '').trim(),
    ...conformityIds.map((item) => String(item || '').trim()),
    ...warrantyIds.map((item) => String(item || '').trim()),
  ].filter(Boolean));
  if (!ids.size) return false;

  const entityId = String(entry?.entityId || '').trim();
  if (entityId && ids.has(entityId)) return true;

  const detail = entry?.detail && typeof entry.detail === 'object' ? entry.detail : {};
  const detailValues = [
    detail.visitId,
    detail.quoteId,
    detail.installationOrderId,
    detail.orderId,
    detail.reference,
    detail.ticket,
    detail.conformityId,
    detail.warrantyId,
  ].map((item) => String(item || '').trim()).filter(Boolean);
  return detailValues.some((item) => ids.has(item));
}

async function resetConversationAfterGlobalDelete({ visit = {}, booking = null, quote = null, order = null } = {}) {
  if (!liveBookingsSb) return { ok: false, skipped: true, reason: 'supabase_not_configured' };

  const candidates = [
    String(visit.reference || '').trim(),
    String(booking?.codigo_cita || '').trim(),
    String(quote?.reference || '').trim(),
    String(order?.reference || '').trim(),
  ].filter(Boolean);

  const conversationId = candidates.find((value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) || '';
  if (!conversationId) {
    return { ok: true, skipped: true, reason: 'conversation_not_linked' };
  }

  await liveBookingsSb.update('conversaciones', `id_conversacion=eq.${encodeURIComponent(conversationId)}`, {
    paso_actual: 'menu_principal',
    estado_conversacion: 'open',
    codigo_ticket_solicitado: null,
    requiere_handoff: false,
    motivo_handoff: null,
    subestado_flujo: null,
    actualizado_en: new Date().toISOString(),
  }).catch(() => []);

  return { ok: true, conversationId };
}

function shouldSyncVisitToClickUp(visit = {}) {
  const status = String(visit.status || '').trim().toLowerCase();
  return clickUpEnabled()
    && String(visit.source || '').trim().toLowerCase() === 'chatbot'
    && String(visit.countryCode || '').trim().toUpperCase() === 'PE'
    && Boolean(String(visit.scheduledAt || '').trim())
    && !['cancelada', 'cerrada'].includes(status);
}

async function syncTechVisitToClickUp(visit = {}, { quote = null } = {}) {
  if (!clickUpEnabled()) {
    return {
      ok: false,
      skipped: true,
      reason: 'clickup_not_configured',
      error: 'ClickUp no está configurado en este servidor.',
    };
  }
  if (!shouldSyncVisitToClickUp(visit)) {
    return { ok: false, skipped: true, reason: 'visit_not_schedulable' };
  }

  try {
    const linkedQuote = quote || findQuoteForVisit(visit);
    const payload = await buildClickUpVisitPayload(visit, linkedQuote);
    const milestoneAssignees = resolveClickUpMilestoneAssigneeIds(visit, linkedQuote);
    const { custom_fields: customFields = [], ...taskPayload } = payload;
    let task;
    let taskId = String(visit.clickupTaskId || '').trim();
    if (taskId) {
      try {
        if (milestoneAssignees.length) {
          const currentTask = await clickUpRequest('GET', `/task/${encodeURIComponent(taskId)}`);
          const currentAssignees = Array.isArray(currentTask?.assignees)
            ? currentTask.assignees
                .map((item) => Number(item?.id || item?.userid || item?.user_id || 0))
                .filter((value, index, array) => Number.isFinite(value) && value > 0 && array.indexOf(value) === index)
            : [];
          const add = milestoneAssignees.filter((id) => !currentAssignees.includes(id));
          const rem = currentAssignees.filter((id) => !milestoneAssignees.includes(id));
          if (add.length || rem.length) {
            taskPayload.assignees = { add, rem };
          }
        }
        task = await clickUpRequest('PUT', `/task/${encodeURIComponent(taskId)}`, taskPayload);
      } catch (error) {
        if (!isClickUpNotFoundError(error)) throw error;
        taskId = '';
      }
    }
    if (!taskId) {
      task = await clickUpRequest('POST', `/list/${encodeURIComponent(CLICKUP_B2C_LIST_ID)}/task`, await buildClickUpCreateVisitPayload(visit, linkedQuote));
      taskId = String(task?.id || '').trim();
    }
    if (customFields.length) {
      await syncClickUpCustomFields(String(task?.id || taskId || visit.clickupTaskId || '').trim(), customFields);
    }
    let attachmentError = '';
    if (linkedQuote?.pdfFile && taskId) {
      try {
        await attachQuotePdfToClickUpTask(taskId, linkedQuote);
      } catch (error) {
        attachmentError = error instanceof Error ? error.message : String(error || 'No pude adjuntar el PDF en ClickUp.');
      }
    }
    return {
      ok: !attachmentError,
      skipped: false,
      taskId: String(task?.id || taskId || '').trim(),
      taskUrl: String(task?.url || visit.clickupTaskUrl || '').trim(),
      syncedAt: new Date().toISOString(),
      error: attachmentError,
    };
  } catch (error) {
    console.error('syncTechVisitToClickUp failed:', error);
    return {
      ok: false,
      skipped: false,
      error: error instanceof Error ? error.message : String(error || 'Error desconocido al sincronizar con ClickUp.'),
    };
  }
}

function buildVisitTimeLabel(visit = {}) {
  return String(visit?.timeWindow || '').trim() || (visit?.scheduledAt ? formatTimeOnly(visit.scheduledAt) : 'tu cita programada');
}

function displayQuoteNumber(id) {
  const match = String(id || '').match(/(\d+)/g);
  const raw = match ? match.join('') : String(id || '').replace(/\D/g, '');
  return String(raw || '1').slice(-12).padStart(6, '0');
}

function slugPdfPart(value, fallback = 'SIN-DATO') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || fallback;
}

function buildPdfFilename(quote) {
  const date = new Date(quote.createdAt || Date.now());
  const yyyymmdd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const number = displayQuoteNumber(quote.id);
  const client = slugPdfPart(quote.clientName, 'CLIENTE');
  return `COT-${yyyymmdd}-${number}-${client}.pdf`;
}
