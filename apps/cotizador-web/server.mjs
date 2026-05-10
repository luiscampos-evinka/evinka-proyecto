import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'url';
import { loadEnv } from '../src/config.mjs';
import { MicrosoftGraphClient } from '../src/microsoftGraph.mjs';
import { SupabaseRest } from '../src/supabase.mjs';
import { WhatsAppMetaClient } from '../src/whatsappMeta.mjs';

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
  quotes: path.join(dataDir, 'quotes.json'),
  installationOrders: path.join(dataDir, 'installation-orders.json'),
  conformities: path.join(dataDir, 'conformities.json'),
  techVisits: path.join(dataDir, 'tech-visits.json'),
  sessions: path.join(dataDir, 'sessions.json'),
};

const COOKIE_NAME = 'cotizador_session';
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;
const DISPLAY_TIME_ZONE = 'America/Lima';
const PORT = Number(process.env.PORT || 3008);
const MOBILE_APP_API_KEY = process.env.CONFORMITY_APP_API_KEY || 'EvinkaConformidad#2026';
const BOT_VISITS_API_KEY = process.env.EVINKA_BOT_VISITS_API_KEY || 'EvinkaBotVisits#2026';
const ALLOWED_CORPORATE_DOMAIN = 'evinka.tech';
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
const TECH_VISITS_DEFAULT_EMAIL = String(process.env.TECH_VISITS_DEFAULT_EMAIL || 'luis.campos@evinka.tech').trim().toLowerCase();
const TECH_VISITS_DEFAULT_NAME = String(process.env.TECH_VISITS_DEFAULT_NAME || 'Luis Campos').trim();

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

app.get('/', (req, res) => {
  res.type('html').send(fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8'));
});
app.get('/health', (req, res) => res.json({ ok: true }));

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  const users = readUsers();
  const user = users.find((u) => u.email.toLowerCase() === String(email || '').toLowerCase());
  if (!user || !verifyPassword(String(password || ''), user.passwordHash)) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
  if (user.status !== 'active') {
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
  res.json({ user: safeUser(user), config: publicConfig() });
});

app.post('/api/register-request', (req, res) => {
  const body = req.body || {};
  const name = String(body.name || '').trim();
  const email = normalizeEmail(body.email || '');
  const password = String(body.password || '');
  if (!name) return res.status(400).json({ error: 'Falta el nombre.' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Correo inválido.' });
  if (!email.endsWith(`@${ALLOWED_CORPORATE_DOMAIN}`)) {
    return res.status(400).json({ error: `Solo se permiten correos @${ALLOWED_CORPORATE_DOMAIN}.` });
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
  if (token) {
    const sessions = readJSON(files.sessions, {});
    delete sessions[token];
    writeJSON(files.sessions, sessions);
  }
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get('/api/me', authOptional, (req, res) => {
  if (!req.user) return res.json({ user: null, config: publicConfig() });
  res.json({ user: safeUser(req.user), config: publicConfig() });
});

app.get('/api/catalog', authRequired, (req, res) => {
  res.json(buildAppConfig());
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
    role: ['admin', 'tech', 'supervisor'].includes(role) ? role : 'tech',
    status: action === 'approve' ? 'active' : 'blocked',
    accessGrantedAt: action === 'approve' ? new Date().toISOString() : '',
    approvedBy: safeUser(req.user),
  });
  writeUsers(users);
  invalidateUserSessions(users[index].id);
  res.json({ ok: true, user: safeUser(users[index]) });
});

app.put('/api/catalog', authRequired, adminOnly, (req, res) => {
  const incoming = req.body || {};
  const current = readJSON(files.config, defaultConfig());
  const next = mergeConfig(current, incoming);
  writeJSON(files.config, next);
  res.json(buildAppConfig());
});

app.get('/api/quotes', authRequired, (req, res) => {
  const quotes = readJSON(files.quotes, []);
  res.json(quotes.slice().map(normalizeStoredQuote).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

app.post('/api/quotes', authRequired, async (req, res) => {
  const config = buildAppConfig();
  const quotes = readJSON(files.quotes, []);
  const visits = readJSON(files.techVisits, []);
  const payload = req.body || {};
  const email = normalizeEmail(payload.email);
  if (email && !isValidEmail(email)) {
    return res.status(400).json({ error: 'Correo inválido' });
  }
  payload.email = email;
  const quote = buildQuote(payload, config, req.user);
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

  const visitIndex = findTechVisitIndex(visits, {
    visitId: payload.visitId,
    quoteId: quote.id,
    reference: payload.reference,
  });
  if (visitIndex >= 0) {
    const currentVisit = normalizeTechVisit(visits[visitIndex]);
    visits[visitIndex] = normalizeTechVisit({
      ...currentVisit,
      status: 'cotizada',
      quoteId: quote.id,
      clientDocument: String(currentVisit.clientDocument || quote.clientDocument || '').trim(),
      installationOrderId: currentVisit.installationOrderId || '',
      notes: String(payload.technicianNotes ?? currentVisit.notes ?? '').trim(),
      updatedAt: new Date().toISOString(),
      updatedBy: safeUser(req.user),
    });
    saveTechVisits(visits);
  }

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
  const nextStatus = normalizeQuoteStatus(body.status || currentQuote.status);
  let order = currentQuote.installationOrderId
    ? installationOrders.find((item) => item.id === currentQuote.installationOrderId)
    : installationOrders.find((item) => item.quoteId === currentQuote.id);
  if (!order && ['aceptada_cliente', 'instalada'].includes(nextStatus)) {
    order = buildInstallationOrderFromQuote(currentQuote, req.user);
    installationOrders.push(order);
    writeJSON(files.installationOrders, installationOrders);
  }

  const nextQuote = normalizeStoredQuote({
    ...currentQuote,
    status: nextStatus,
    installationOrderId: order?.id || currentQuote.installationOrderId || '',
    readyForSendAt: nextStatus === 'lista_envio' ? new Date().toISOString() : currentQuote.readyForSendAt || '',
    readyForSendBy: nextStatus === 'lista_envio' ? safeUser(req.user) : currentQuote.readyForSendBy || null,
    clientAcceptedAt: nextStatus === 'aceptada_cliente' ? new Date().toISOString() : currentQuote.clientAcceptedAt || '',
    clientAcceptedBy: nextStatus === 'aceptada_cliente' ? safeUser(req.user) : currentQuote.clientAcceptedBy || null,
    cancelledAt: nextStatus === 'cancelada' ? new Date().toISOString() : currentQuote.cancelledAt || '',
    recotizarAt: nextStatus === 'recotizar' ? new Date().toISOString() : currentQuote.recotizarAt || '',
  });
  if (nextStatus === 'lista_envio' && nextQuote.pdfFile && nextQuote.pdfFilename) {
    nextQuote.emailDelivery = await deliverQuoteEmail({
      quote: nextQuote,
      config,
      req,
      pdfPath: nextQuote.pdfFile,
      pdfFilename: nextQuote.pdfFilename,
    });
  }
  quotes[index] = nextQuote;
  writeJSON(files.quotes, quotes);

  const visitIndex = findTechVisitIndex(visits, { visitId: body.visitId, quoteId: currentQuote.id, reference: body.reference });
  if (visitIndex >= 0) {
    const currentVisit = normalizeTechVisit(visits[visitIndex]);
    const nextVisitStatus = nextStatus === 'cotizada'
      ? 'cotizada'
      : nextStatus === 'lista_envio'
        ? 'lista_envio'
        : nextStatus === 'aceptada_cliente'
          ? 'aceptada_cliente'
          : nextStatus === 'recotizar'
            ? 'recotizar'
            : nextStatus === 'cancelada'
              ? 'cancelada'
              : currentVisit.status;
    visits[visitIndex] = normalizeTechVisit({
      ...currentVisit,
      status: nextVisitStatus,
      quoteId: currentQuote.id,
      installationOrderId: nextQuote.installationOrderId || currentVisit.installationOrderId,
      updatedAt: new Date().toISOString(),
      updatedBy: safeUser(req.user),
    });
    saveTechVisits(visits);
  }

  res.json({ ok: true, quote: nextQuote, installationOrder: order || null });
});

app.post('/api/quotes/:id/schedule-installation', authRequired, async (req, res) => {
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
  if (visitIndex >= 0) visits[visitIndex] = nextVisit;
  else visits.push(nextVisit);
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

  res.json({ ok: true, quote: nextQuote, installationOrder: order, visit: nextVisit });
});

app.post('/api/quotes/:id/accept', authRequired, (req, res) => {
  const quotes = readJSON(files.quotes, []);
  const installationOrders = readJSON(files.installationOrders, []);
  const index = quotes.findIndex((item) => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Cotización no encontrada' });
  const currentQuote = normalizeStoredQuote(quotes[index]);
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
  const quote = readJSON(files.quotes, []).map(normalizeStoredQuote).find((q) => q.id === req.params.id);
  if (!quote) return res.status(404).json({ error: 'No encontrado' });
  res.json(quote);
});

app.get('/api/installation-orders/:id', authRequired, (req, res) => {
  const order = readJSON(files.installationOrders, []).find((item) => item.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
  res.json(order);
});

app.get('/api/tech/visits', authRequired, async (req, res) => {
  const visits = (await syncTechVisitsFromCalendar())
    .filter((visit) => req.user?.role === 'admin' || normalizeEmail(visit.assignedTechEmail) === normalizeEmail(req.user?.email))
    .sort((a, b) => {
      const dateA = String(a.scheduledAt || a.createdAt || '');
      const dateB = String(b.scheduledAt || b.createdAt || '');
      return dateA.localeCompare(dateB);
    });
  res.json(visits);
});

app.patch('/api/tech/visits/:id', authRequired, async (req, res) => {
  const visits = readJSON(files.techVisits, []);
  const index = visits.findIndex((item) => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Visita no encontrada' });

  const current = normalizeTechVisit(visits[index]);
  const sameTech = normalizeEmail(current.assignedTechEmail) === normalizeEmail(req.user?.email);
  if (req.user?.role !== 'admin' && !sameTech) {
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
  visits[index] = next;
  saveTechVisits(visits);
  const notifications = [];
  if (current.status !== 'en_ruta' && next.status === 'en_ruta') {
    notifications.push(...await notifyVisitOnTheWay(next));
  }
  res.json({ ...normalizeTechVisit(next), notifications });
});

app.post('/api/internal/tech-visits', internalBotAuth, (req, res) => {
  const body = req.body || {};
  const clientName = String(body.clientName || '').trim();
  const clientAddress = String(body.clientAddress || '').trim();
  if (!clientName || !clientAddress) {
    return res.status(400).json({ error: 'Faltan clientName y clientAddress' });
  }

  const visits = readJSON(files.techVisits, []);
  const techs = readUsers().filter((user) => user.role === 'tech' && user.status === 'active');
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
    scheduledAt: String(body.scheduledAt || '').trim(),
    timeWindow: String(body.timeWindow || '').trim(),
    notes: String(body.notes || '').trim(),
    resolution: base?.resolution || '',
    reference,
    quoteId: String(body.quoteId || '').trim(),
    installationOrderId: String(body.installationOrderId || '').trim(),
    assignedTechEmail: assignedTech?.email || assignedEmail,
    assignedTechName: assignedTech?.name || String(body.assignedTechName || '').trim(),
    checklist: Array.isArray(body.checklist) ? body.checklist.map((item) => String(item || '').trim()).filter(Boolean) : [],
    createdAt: base?.createdAt || createdAt,
    updatedAt: createdAt,
    startedAt: base?.startedAt || '',
    closedAt: base?.closedAt || '',
  });
  if (existingIndex >= 0) {
    visits[existingIndex] = visit;
  } else {
    visits.push(visit);
  }
  writeJSON(files.techVisits, visits);
  res.json({ ok: true, created: existingIndex < 0, visit });
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
  if (!orderId || !quoteId) return res.status(400).json({ error: 'Faltan installationOrderId y quoteId' });
  if (clientEmail && !isValidEmail(clientEmail)) return res.status(400).json({ error: 'Correo inválido' });

  const orders = readJSON(files.installationOrders, []);
  const orderIndex = orders.findIndex((item) => item.id === orderId && item.quoteId === quoteId);
  if (orderIndex < 0) return res.status(404).json({ error: 'Orden no encontrada' });

  const conformities = readJSON(files.conformities, []);
  const conformity = {
    id: body.id || `CONF-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
    installationOrderId: orderId,
    quoteId,
    clientName: String(body.clientName || '').trim(),
    clientEmail,
    ruc: String(body.ruc || '').trim(),
    address: String(body.address || '').trim(),
    chargerBrand: String(body.chargerBrand || '').trim(),
    serialNumber: String(body.serialNumber || '').trim(),
    voltage: String(body.voltage || '').trim(),
    amperage: String(body.amperage || '').trim(),
    powerKw: String(body.powerKw || '').trim(),
    observations: String(body.observations || '').trim(),
    deliveredItems: Array.isArray(body.deliveredItems) ? body.deliveredItems : [],
    photoUrls: Array.isArray(body.photoUrls) ? body.photoUrls : [],
    installerSignatureUrl: String(body.installerSignatureUrl || '').trim(),
    clientSignatureUrl: String(body.clientSignatureUrl || '').trim(),
    pdfUrl: String(body.pdfUrl || '').trim(),
    pdfBase64,
    status: String(body.status || 'pdf_generated').trim(),
    createdAt: new Date().toISOString(),
    createdBy: 'mobile_app',
  };
  conformity.emailDelivery = await deliverConformityEmail({ conformity, req });
  conformities.push(conformity);
  writeJSON(files.conformities, conformities);

  orders[orderIndex] = {
    ...orders[orderIndex],
    status: 'conformidad_generada',
    conformityStatus: 'pdf_generated',
    conformityId: conformity.id,
    conformityPdfUrl: conformity.pdfUrl,
    updatedAt: new Date().toISOString(),
  };
  writeJSON(files.installationOrders, orders);

  const quotes = readJSON(files.quotes, []);
  const quoteIndex = quotes.findIndex((item) => item.id === quoteId);
  if (quoteIndex >= 0) {
    quotes[quoteIndex] = {
      ...normalizeStoredQuote(quotes[quoteIndex]),
      status: 'instalada',
      conformityStatus: 'pdf_generated',
      conformityId: conformity.id,
      conformityPdfUrl: conformity.pdfUrl,
    };
    writeJSON(files.quotes, quotes);
  }

  const visits = readJSON(files.techVisits, []);
  let visitsChanged = false;
  for (let i = 0; i < visits.length; i += 1) {
    const currentVisit = normalizeTechVisit(visits[i]);
    const isTarget = currentVisit.type === 'instalacion'
      && (currentVisit.installationOrderId === orderId || currentVisit.quoteId === quoteId);
    if (!isTarget) continue;
    visits[i] = normalizeTechVisit({
      ...currentVisit,
      status: 'pendiente_cierre',
      installationOrderId: orderId,
      quoteId,
      updatedAt: new Date().toISOString(),
      closedAt: '',
      resolution: currentVisit.resolution || 'Instalación concluida con conformidad generada.',
      checklist: buildAutoChecklistForVisit({
        ...currentVisit,
        status: 'pendiente_cierre',
        installationOrderId: orderId,
        quoteId,
      }),
    });
    visitsChanged = true;
  }
  if (visitsChanged) saveTechVisits(visits);

  res.json({ ok: true, conformity, emailDelivery: conformity.emailDelivery });
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'No encontrado' });
  res.type('html').send(fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8'));
});

app.listen(PORT, () => {
  console.log(`Cotizador EVINKA listo en http://localhost:${PORT}`);
});

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
    role: user.role,
    status: user.status || 'active',
    requestedAt: user.requestedAt || '',
    accessGrantedAt: user.accessGrantedAt || '',
    approvedBy: user.approvedBy ? {
      id: user.approvedBy.id,
      name: user.approvedBy.name,
      email: user.approvedBy.email,
      role: user.approvedBy.role,
    } : null,
  };
}

function publicConfig() {
  const config = buildAppConfig();
  return {
    company: config.company,
    currency: config.currency,
    defaults: config.defaults,
    commercialProfiles: config.commercialProfiles,
    roles: config.roles,
  };
}

function normalizeQuoteStatus(value) {
  const status = String(value || 'cotizada').trim().toLowerCase();
  const aliases = {
    emitida: 'cotizada',
    aceptada: 'aceptada_cliente',
  };
  const normalized = aliases[status] || status;
  const allowed = new Set(['cotizada', 'lista_envio', 'recotizar', 'cancelada', 'aceptada_cliente', 'instalada']);
  return allowed.has(normalized) ? normalized : 'cotizada';
}

function normalizeStoredQuote(quote = {}) {
  return {
    ...quote,
    clientDocument: String(quote?.clientDocument || quote?.ruc || '').trim(),
    status: normalizeQuoteStatus(quote?.status || 'cotizada'),
    conformityStatus: String(quote?.conformityStatus || 'not_started').trim(),
  };
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

  const techs = readUsers().filter((user) => user.role === 'tech' && user.status === 'active');
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
    status: normalizeTechVisitStatus(visit.status),
    clientName: String(visit.clientName || '').trim(),
    clientPhone: String(visit.clientPhone || '').trim(),
    clientDocument: String(visit.clientDocument || visit.ruc || '').trim(),
    clientEmail: normalizeEmail(visit.clientEmail || ''),
    clientAddress: String(visit.clientAddress || '').trim(),
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

function buildAppConfig() {
  const stored = readJSON(files.config, defaultConfig());
  if (!EXCEL_SOURCE) {
    const defaults = {
      ...stored.defaults,
      factorGeneralCosts: Number(stored.defaults?.factorGeneralCosts || 1),
      divisorMargin: Number(stored.defaults?.divisorMargin || 0.75),
    };
    return {
      ...stored,
      defaults,
      commercialProfiles: normalizeCommercialProfiles(stored.commercialProfiles, defaults.divisorMargin),
      catalog: buildCatalogFromItems(stored.catalog?.items || [], defaults),
    };
  }
  const defaults = {
    ...EXCEL_SOURCE.defaults,
    ...stored.defaults,
    factorGeneralCosts: Number(stored.defaults?.factorGeneralCosts ?? EXCEL_SOURCE.defaults.factorGeneralCosts ?? 1),
    divisorMargin: Number(stored.defaults?.divisorMargin ?? EXCEL_SOURCE.defaults.divisorMargin ?? 0.75),
  };
  const items = Array.isArray(stored.catalog?.items) && stored.catalog.items.length
    ? stored.catalog.items
    : EXCEL_SOURCE.catalog.items;
  return {
    company: { ...EXCEL_SOURCE.company, ...stored.company },
    currency: 'PEN',
    defaults,
    commercialProfiles: normalizeCommercialProfiles(stored.commercialProfiles, defaults.divisorMargin),
    roles: stored.roles?.length ? stored.roles : ['admin', 'tech'],
    catalog: buildCatalogFromItems(items, defaults),
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
    }))
    .filter((photo) => photo.dataUrl.startsWith('data:image/'));
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

function buildQuote(payload, config, user) {
  const commercialProfile = resolveCommercialProfile(config, payload.commercialProfileId);
  const effectiveConfig = buildQuoteConfigForProfile(config, commercialProfile);
  const distance = Math.max(0, Number(payload.distance || 0));
  const tubeType = String(payload.tubeType || 'EMT').toUpperCase();
  const propertyType = String(payload.propertyType || 'Casa').trim();
  const cable = effectiveConfig.catalog.cables.find((item) => item.id === payload.cableId) || pickCableByDistance(distance, effectiveConfig.catalog.cables, effectiveConfig.defaults);
  const charger = resolveChargerSelection(payload);

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
  const subtotal = roundMoney(minimumBase + additionalMeterage + totalConditionals + charger.pricePen);
  const igv = roundMoney(subtotal * Number(effectiveConfig.defaults.igv || 0));
  const total = roundMoney(subtotal + igv);
  const commercialRows = buildCommercialRows({
    propertyType,
    minimumBase,
    additionalMeterage,
    conditionalRows,
    charger,
  });
  const photos = sanitizeQuotePhotos(payload.photos);

  return {
    id: `COT-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
    createdAt: new Date().toISOString(),
    createdBy: safeUser(user),
    clientName: String(payload.clientName || '').trim(),
    email: normalizeEmail(payload.email),
    clientDocument: String(payload.clientDocument || payload.ruc || '').trim(),
    city: String(payload.city || '').trim(),
    visitDate: String(payload.visitDate || '').trim(),
    installationType: String(payload.installationType || '').trim(),
    clientType: String(payload.clientType || '').trim(),
    commercialProfile,
    propertyType,
    tubeType,
    voltage: Number(payload.voltage || 0),
    current: Number(payload.current || 0),
    grounding: String(payload.grounding || '').trim(),
    outOfCity: String(payload.outOfCity || '').trim(),
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
  minibox: { code: 'EVK-CHG-MINIBOX', label: 'Cargador EVINKA MiniBox', priceUsd: 700 },
  alien: { code: 'EVK-CHG-ALIEN', label: 'Cargador EVINKA Alien', priceUsd: 900 },
};

function resolveChargerSelection(payload = {}) {
  const requestedModel = String(payload.chargerModel || '').trim().toLowerCase();
  const selected = CHARGER_CATALOG[requestedModel] || CHARGER_CATALOG.minibox;
  const rawUsd = Number(payload.chargerPriceUsd);
  const rawFx = Number(payload.exchangeRate);
  const priceUsd = Number.isFinite(rawUsd) && rawUsd > 0 ? rawUsd : Number(selected.priceUsd || 0);
  const exchangeRate = Number.isFinite(rawFx) && rawFx > 0 ? rawFx : 3.75;
  return {
    id: requestedModel || 'minibox',
    code: selected.code,
    label: selected.label,
    priceUsd: roundMoney(priceUsd),
    exchangeRate: roundMoney(exchangeRate),
    pricePen: roundMoney(priceUsd * exchangeRate),
  };
}

function buildCommercialRows({ propertyType, minimumBase, additionalMeterage, conditionalRows, charger }) {
  const rows = [
    {
      code: '0060001',
      label: 'Servicio de instalación estándar de cargador',
      qty: 1,
      unitPrice: roundMoney(minimumBase),
      total: roundMoney(minimumBase),
      unit: 'UND',
    },
    {
      code: charger.code,
      label: `${charger.label} · ref. US$ ${amount(charger.priceUsd)} · TC ${amount(charger.exchangeRate)}`,
      qty: 1,
      unitPrice: roundMoney(charger.pricePen),
      total: roundMoney(charger.pricePen),
      unit: 'UND',
    },
  ];
  if (additionalMeterage > 0) {
    rows.push({
      code: '0060001A',
      label: 'Adecuaciones adicionales a la instalación',
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

async function createPdf(quote, config, filePath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    const logoPath = '/root/.openclaw/workspace/.tmp/evinka_technology_logo.jpg';
    const bankRows = [
      ['BCP', 'SOLES', '1949917309036', '00219400991730906398'],
      ['BCP', 'DÓLAR', '1949897105165', '00219400989710516595'],
    ];

    drawQuoteHeader(doc, quote, logoPath);

    doc.fontSize(10).font('Helvetica').text(buildGreeting(quote.clientName), 36, 160);
    doc.text('Nos es grato presentar la siguiente cotización por el servicio de instalación propuesto:', 36, 174, { width: 523 });

    const commercialTableBottom = drawTable(doc, [28, 38, 42, 64, 215, 68, 68], ['It.', 'Cant.', 'Unid', 'Código', 'Descripción', 'Precio Unit. S/', 'Total S/'], quote.commercialRows.map((row, index) => [String(index + 1), formatNumber(row.qty), normalizeUnit(row.unit), row.code, row.label, amount(row.unitPrice), amount(row.total)]), { x: 36, y: 204, rowHeight: 18, headerHeight: 20, fontSize: 8.3 });

    const termsTop = commercialTableBottom + 10;
    doc.fontSize(9.5).font('Helvetica');
    doc.text(`Lugar de instalación : ${quote.city || 'LIMA'}`, 36, termsTop);
    doc.text('Tiempo de ejecución : 5 días', 36, termsTop + 14);
    doc.text('Validez de cotización : 30 días', 36, termsTop + 28);
    doc.text('Forma de pago : 50% de adelanto y 50% al finalizar la instalación', 36, termsTop + 42, { width: 315 });
    doc.text('Garantía : 12 meses', 36, termsTop + 58);

    drawSummaryBox(doc, 350, termsTop, [
      ['SUB TOTAL', amount(quote.subtotal)],
      ['IGV', amount(quote.igv)],
      ['TOTAL', amount(quote.total)],
    ]);

    let cursorY = Math.max(termsTop + 92, termsTop + 24 + 60);
    cursorY = writeSectionTitle(doc, cursorY, 'Servicio de Instalación Estándar de Cargador', quote, logoPath);
    cursorY = writeBulletParagraph(doc, cursorY, buildServiceParagraph(quote), 72, quote, logoPath);
    for (const line of buildIncludedBulletLines(quote)) {
      cursorY = writeBulletParagraph(doc, cursorY, line, 72, quote, logoPath);
    }

    if (quote.commercialRows.length > 1) {
      for (const row of quote.commercialRows.slice(1)) {
        cursorY = writeSectionTitle(doc, cursorY + 4, row.label, quote, logoPath);
        cursorY = writeBulletParagraph(doc, cursorY, buildAdditionalParagraph(row, quote), 72, quote, logoPath);
      }
    }

    cursorY = writeSectionTitle(doc, cursorY + 6, 'Observaciones', quote, logoPath);
    for (const line of buildObservationLines(quote)) {
      cursorY = writeBulletParagraph(doc, cursorY, line, 72, quote, logoPath);
    }
    cursorY = writePlainParagraph(doc, cursorY + 4, buildWarrantyNote(quote), 36, 523, quote, logoPath);
    if (String(quote.technicianNotes || '').trim()) {
      cursorY = writePlainParagraph(doc, cursorY + 6, `Comentarios adicionales: ${String(quote.technicianNotes || '').trim()}`, 36, 523, quote, logoPath);
    }
    cursorY = writePlainParagraph(doc, cursorY + 10, 'Gracias por su atención. Quedamos atentos a cualquier consulta.', 36, 523, quote, logoPath);
    cursorY = writeSignatureBlock(doc, cursorY + 8, quote, logoPath);

    const bankStartY = ensurePageSpace(doc, cursorY + 18, 160, quote, logoPath, true);
    const bankTableBottom = drawTable(doc, [90, 90, 145, 198], ['BANCO', 'MONEDA', 'N° CUENTA', 'N° CCI'], bankRows, { x: 36, y: bankStartY, rowHeight: 18, headerHeight: 18, fontSize: 8.5 });
    let noteY = bankTableBottom;
    noteY = drawBorderNote(doc, 36, noteY, 523, 'BANCO DE CRÉDITO DEL PERÚ');
    noteY = drawBorderNote(doc, 36, noteY, 523, 'DOMICILIO: CALLE LAS CAMELIAS 750 INT. BANKING AND LEASING AREA SAN ISIDRO, LIMA');
    noteY = drawBorderNote(doc, 36, noteY, 523, 'CODIGO SWIFT: BCPLPEPL');
    noteY = drawBorderNote(doc, 36, noteY, 523, 'CUENTA DE DETRACCIONES BANCO DE LA NACION: 00-003-338576');

    drawFooter(doc);

    renderPhotoReport(doc, quote, logoPath);

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
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
      doc.image(photo.filePath, frameX + imageInset + 8, frameY + imageInset + 8, { fit: [frameW - (imageInset * 2) - 16, imageAreaH - 16], align: 'center', valign: 'center' });
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
  drawKeyValue(doc, rightX, y, 'Moneda', 'SOLES', { labelWidth: 74, valueWidth: 110 }); y += 18;
  drawKeyValue(doc, rightX, y, 'Inmueble', quote.propertyType || '-', { labelWidth: 74, valueWidth: 110 });
}

function buildGreeting(clientName) {
  const displayName = formatDisplayName(clientName);
  return displayName ? `Estimado Sr. ${displayName}` : 'Estimado cliente';
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
  const chargerLabel = quote?.charger?.label || 'cargador EVINKA';
  const priceUsd = amount(quote?.charger?.priceUsd || 0);
  const fx = amount(quote?.charger?.exchangeRate || 0);
  return `Se plantea realizar la instalación eléctrica desde el punto de alimentación hasta la ubicación definida para el ${chargerLabel}, dentro del alcance del servicio estándar de instalación. Esta propuesta contempla la visita técnica, la ingeniería básica, el transporte, las protecciones, el tablero, la canalización, el cableado, la conexión final del sistema y el cargador con precio referencial de US$ ${priceUsd} calculado al tipo de cambio referencial ${fx}, para una instalación ordenada, segura y conforme a las normativas eléctricas vigentes.`;
}

function buildAdditionalParagraph(row, quote) {
  return `Se considera el adicional ${row.label.replace(/^Servicios Adicionales:\s*/, '')}, incorporado según validación técnica en visita. Este concepto complementa la instalación principal y forma parte de los trabajos requeridos para la correcta implementación del sistema en ${quote.propertyType || 'el proyecto'}.`;
}

function buildWarrantyNote(quote) {
  return 'La garantía de la instalación tiene una vigencia de 12 meses contados desde la entrega del servicio.';
}

function buildBaseIncludedScope({ propertyType, includedMeters, tubeType, cable, charger }) {
  const isEdificio = String(propertyType || '').toUpperCase() === 'EDIFICIO';
  return [
    `Servicio estándar de instalación del cargador con visita técnica, ingeniería, transporte, movilidad y herramientas.`,
    `${charger?.label || 'Cargador EVINKA'} incluido con precio referencial de US$ ${amount(charger?.priceUsd || 0)} (TC ref. ${amount(charger?.exchangeRate || 0)}).`,
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
  return [
    'Durante la instalación se realizará una interrupción breve del suministro eléctrico.',
    'Se solicita mantener despejada el área de trabajo y los estacionamientos involucrados el día de la instalación.',
    'La presente cotización no incluye trabajos de picado, demoliciones ni trabajos en altura.',
    'El servicio estándar contempla 1 día de trabajo y la participación de 2 electricistas.',
    'No se incluyen adecuaciones eléctricas adicionales al tablero ni infraestructura complementaria no detallada en esta propuesta.',
    'No se incluyen trabajos de pintura ni reposición de acabados.',
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
  y = ensurePageSpace(doc, y, 52, quote, logoPath, true);
  doc.font('Helvetica').fontSize(9.2).text('Atentamente,', 36, y, { width: 523 });
  doc.font('Helvetica-Bold').text('EVINKA Technology S.A.C.', 36, y + 14, { width: 523 });
  doc.font('Helvetica').text(advisor === 'Equipo EVINKA' ? 'Área Comercial' : advisor, 36, y + 28, { width: 523 });
  return y + 44;
}

function drawFooter(doc) {
  const footerY = 680;
  doc.moveTo(36, footerY).lineTo(559, footerY).strokeColor('#111').lineWidth(1.5).stroke();
  doc.font('Helvetica-Bold').fontSize(9).text('EVINKA TECHNOLOGY S.A.C.', 36, footerY + 8);
  doc.font('Helvetica').fontSize(8.5).text('AV. FELIPE PARDO Y ALIAGA NRO. 220 URB. SANTA CRUZ (DP 3 PISO 3) LIMA - LIMA - SAN ISIDRO', 36, footerY + 22, { width: 523 });
  doc.text('Telef : 945 149 285', 36, footerY + 35);
  doc.text('E-Mail : contacto@evinka.tech', 36, footerY + 47);
  doc.text('Pag.Web : evinka.tech', 36, footerY + 59);
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

function mergeConfig(current, incoming) {
  const next = structuredClone(current);
  if (incoming.company) next.company = { ...next.company, ...incoming.company };
  if (incoming.defaults) next.defaults = { ...next.defaults, ...incoming.defaults };
  if (incoming.commercialProfiles) next.commercialProfiles = incoming.commercialProfiles;
  if (incoming.catalog?.items) next.catalog = { ...next.catalog, items: incoming.catalog.items };
  return next;
}

function defaultConfig() {
  return {
    company: {
      name: 'EVINKA Cotizador',
      tagline: 'Cotizador web para técnicos y administración',
    },
    currency: 'PEN',
    defaults: {},
    commercialProfiles: defaultCommercialProfiles(0.75),
    roles: ['admin', 'tech'],
    catalog: { services: [], cables: [], conditionals: [], items: [] },
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
  if (!fs.existsSync(files.quotes)) writeJSON(files.quotes, []);
  if (!fs.existsSync(files.installationOrders)) writeJSON(files.installationOrders, []);
  if (!fs.existsSync(files.conformities)) writeJSON(files.conformities, []);
  if (!fs.existsSync(files.sessions)) writeJSON(files.sessions, {});
  if (!fs.existsSync(files.users)) {
    writeJSON(files.users, [
      {
        id: 'admin',
        name: 'Admin EVINKA',
        email: process.env.COTIZADOR_ADMIN_EMAIL || 'admin@evinka.net',
        role: 'admin',
        status: 'active',
        requestedAt: new Date().toISOString(),
        accessGrantedAt: new Date().toISOString(),
        passwordHash: hashPassword(process.env.COTIZADOR_ADMIN_PASSWORD || 'Admin12345!'),
      },
      {
        id: 'tech',
        name: 'Técnico EVINKA',
        email: process.env.COTIZADOR_TECH_EMAIL || 'tecnico@evinka.net',
        role: 'tech',
        status: 'active',
        requestedAt: new Date().toISOString(),
        accessGrantedAt: new Date().toISOString(),
        passwordHash: hashPassword(process.env.COTIZADOR_TECH_PASSWORD || 'Tecnico12345!'),
      },
    ]);
  } else {
    writeUsers(readUsers());
  }
  if (!fs.existsSync(files.techVisits)) writeJSON(files.techVisits, defaultTechVisits());
}

function readUsers() {
  return readJSON(files.users, []).map(normalizeUserRecord);
}

function writeUsers(users) {
  writeJSON(files.users, users.map(normalizeUserRecord));
}

function normalizeUserRecord(user = {}) {
  const role = String(user.role || 'tech').trim().toLowerCase() || 'tech';
  const email = normalizeEmail(user.email || '');
  return {
    id: String(user.id || `usr-${Date.now()}`).trim(),
    name: String(user.name || '').trim(),
    email,
    role,
    status: normalizeUserStatus(user.status || 'active'),
    passwordHash: String(user.passwordHash || '').trim(),
    requestedAt: String(user.requestedAt || user.createdAt || '').trim(),
    accessGrantedAt: String(user.accessGrantedAt || '').trim(),
    approvedBy: user.approvedBy || null,
  };
}

function normalizeUserStatus(value) {
  const status = String(value || 'active').trim().toLowerCase();
  return ['pending', 'active', 'blocked'].includes(status) ? status : 'active';
}

function defaultTechVisits() {
  const users = readUsers();
  const orders = readJSON(files.installationOrders, []);
  const techs = users.filter((user) => user.role === 'tech');
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

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
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
