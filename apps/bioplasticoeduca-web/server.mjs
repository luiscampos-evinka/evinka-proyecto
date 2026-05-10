import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import { loadEnv } from '../src/config.mjs';

loadEnv();

const app = express();
const PORT = Number(process.env.BIOPLASTICO_PORT || 3012);
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const COOKIE_NAME = 'bioedu_session';
const DB_PATH = path.resolve(process.cwd(), 'data/bioplasticoeduca-db.json');
const ROLES = new Set(['user', 'admin']);

const DEFAULT_ADMIN_EMAIL = 'luis.campos@evinka.tech';

const baseDb = {
  version: 2,
  users: [],
  sessions: [],
  progress: [],
  content: {
    sections: {
      'que-es': { extra: [] },
      beneficios: { extra: [] },
      tipos: { extra: [] },
      aprende: { extra: [] },
    },
    customQuestions: [],
  },
};

app.use(express.json({ limit: '1mb' }));

function ensureDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify(baseDb, null, 2));
}

function loadDb() {
  ensureDb();
  const raw = JSON.parse(fs.readFileSync(DB_PATH, 'utf8') || '{}');
  return {
    ...baseDb,
    ...raw,
    users: Array.isArray(raw.users) ? raw.users : [],
    sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
    progress: Array.isArray(raw.progress) ? raw.progress : [],
    content: {
      sections: {
        'que-es': { extra: raw.content?.sections?.['que-es']?.extra || [] },
        beneficios: { extra: raw.content?.sections?.beneficios?.extra || [] },
        tipos: { extra: raw.content?.sections?.tipos?.extra || [] },
        aprende: { extra: raw.content?.sections?.aprende?.extra || [] },
      },
      customQuestions: Array.isArray(raw.content?.customQuestions) ? raw.content.customQuestions : [],
    },
  };
}

function saveDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function nowIso() {
  return new Date().toISOString();
}

function randomId(size = 18) {
  return crypto.randomBytes(size).toString('hex');
}

function sha256(value = '') {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function displayNameFromEmail(email = '') {
  return String(email).split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) || 'Usuario';
}

function parseCookies(req) {
  const raw = String(req.headers.cookie || '');
  return Object.fromEntries(raw.split(';').map((item) => item.trim()).filter(Boolean).map((item) => {
    const idx = item.indexOf('=');
    if (idx === -1) return [item, ''];
    return [item.slice(0, idx), decodeURIComponent(item.slice(idx + 1))];
  }));
}

function setSessionCookie(res, token) {
  const secure = String(process.env.BIOPLASTICO_COOKIE_SECURE || 'true') !== 'false';
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function scrubExpired(db) {
  const now = Date.now();
  db.sessions = db.sessions.filter((item) => Date.parse(item.expiresAt || 0) > now);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function verifyPassword(password, storedHash = '') {
  if (!storedHash || typeof storedHash !== 'string') return false;
  const [scheme, salt, expected] = storedHash.split(':');
  if (scheme !== 'scrypt' || !salt || !expected) return false;
  const actual = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

function validatePassword(password = '') {
  const value = String(password || '');
  if (value.length < 10) return 'La contraseña debe tener al menos 10 caracteres.';
  if (!/[A-Z]/.test(value)) return 'La contraseña debe incluir al menos una mayúscula.';
  if (!/[a-z]/.test(value)) return 'La contraseña debe incluir al menos una minúscula.';
  if (!/[0-9]/.test(value)) return 'La contraseña debe incluir al menos un número.';
  if (!/[^A-Za-z0-9]/.test(value)) return 'La contraseña debe incluir al menos un símbolo.';
  return null;
}

function findUserByEmail(db, email) {
  return db.users.find((item) => normalizeEmail(item.email) === normalizeEmail(email)) || null;
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt || null,
  };
}

function buildSessionPayload(db, user) {
  const progress = db.progress.find((item) => item.userId === user.id) || null;
  return { user: sanitizeUser(user), progress };
}

function getSession(req, db) {
  scrubExpired(db);
  const cookies = parseCookies(req);
  const raw = cookies[COOKIE_NAME];
  if (!raw) return null;
  const tokenHash = sha256(raw);
  const session = db.sessions.find((item) => item.tokenHash === tokenHash);
  if (!session) return null;
  const user = db.users.find((item) => item.id === session.userId);
  if (!user) return null;
  return { session, user };
}

function requireSession(req, res, db) {
  const current = getSession(req, db);
  if (!current) {
    res.status(401).json({ error: 'unauthorized', message: 'Sesión requerida' });
    return null;
  }
  return current;
}

function requireAdmin(req, res, db) {
  const current = requireSession(req, res, db);
  if (!current) return null;
  if (current.user.role !== 'admin') {
    res.status(403).json({ error: 'forbidden', message: 'Solo admin puede realizar esta acción' });
    return null;
  }
  return current;
}

function issueSession(db, user, res) {
  const rawToken = randomId(24);
  db.sessions = db.sessions.filter((item) => item.userId !== user.id);
  db.sessions.push({
    id: randomId(10),
    userId: user.id,
    tokenHash: sha256(rawToken),
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  });
  setSessionCookie(res, rawToken);
}

function listManagedUsers(db) {
  return db.users
    .map((user) => ({
      ...sanitizeUser(user),
      hasPassword: Boolean(user.passwordHash),
      progress: db.progress.find((item) => item.userId === user.id) || null,
    }))
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')) * -1);
}

app.get('/health', (_req, res) => {
  const db = loadDb();
  scrubExpired(db);
  saveDb(db);
  res.json({ ok: true, service: 'bioplasticoeduca-auth' });
});

app.get('/api/auth/session', (req, res) => {
  const db = loadDb();
  const current = getSession(req, db);
  if (!current) {
    res.status(401).json({ error: 'unauthorized', message: 'Sin sesión activa' });
    return;
  }
  saveDb(db);
  res.json(buildSessionPayload(db, current.user));
});

app.post('/api/auth/register', (req, res) => {
  const db = loadDb();
  const name = String(req.body?.name || '').trim();
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  const confirmPassword = String(req.body?.confirmPassword || '');

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'invalid_email', message: 'Escribe un correo válido.' });
    return;
  }
  if (!name) {
    res.status(400).json({ error: 'invalid_name', message: 'Escribe un nombre.' });
    return;
  }
  if (password !== confirmPassword) {
    res.status(400).json({ error: 'password_mismatch', message: 'Las contraseñas no coinciden.' });
    return;
  }
  const validationError = validatePassword(password);
  if (validationError) {
    res.status(400).json({ error: 'weak_password', message: validationError });
    return;
  }
  if (findUserByEmail(db, email)) {
    res.status(409).json({ error: 'email_exists', message: 'Ese correo ya tiene una cuenta.' });
    return;
  }

  const user = {
    id: randomId(10),
    email,
    name,
    role: email === DEFAULT_ADMIN_EMAIL ? 'admin' : 'user',
    passwordHash: hashPassword(password),
    createdAt: nowIso(),
    lastLoginAt: null,
  };
  db.users.push(user);
  saveDb(db);
  res.json({ ok: true, user: sanitizeUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const db = loadDb();
  scrubExpired(db);
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  const user = findUserByEmail(db, email);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: 'invalid_credentials', message: 'Correo o contraseña incorrectos.' });
    return;
  }

  user.lastLoginAt = nowIso();
  if (user.email === DEFAULT_ADMIN_EMAIL) user.role = 'admin';
  issueSession(db, user, res);
  saveDb(db);
  res.json({ ok: true, ...buildSessionPayload(db, user) });
});

app.post('/api/auth/logout', (req, res) => {
  const db = loadDb();
  const cookies = parseCookies(req);
  const tokenHash = cookies[COOKIE_NAME] ? sha256(cookies[COOKIE_NAME]) : null;
  if (tokenHash) {
    db.sessions = db.sessions.filter((item) => item.tokenHash !== tokenHash);
    saveDb(db);
  }
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.post('/api/auth/change-password', (req, res) => {
  const db = loadDb();
  const current = requireSession(req, res, db);
  if (!current) return;

  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');
  const confirmPassword = String(req.body?.confirmPassword || '');

  if (!verifyPassword(currentPassword, current.user.passwordHash)) {
    res.status(400).json({ error: 'invalid_password', message: 'La contraseña actual no es correcta.' });
    return;
  }
  if (newPassword !== confirmPassword) {
    res.status(400).json({ error: 'password_mismatch', message: 'Las nuevas contraseñas no coinciden.' });
    return;
  }
  const validationError = validatePassword(newPassword);
  if (validationError) {
    res.status(400).json({ error: 'weak_password', message: validationError });
    return;
  }

  current.user.passwordHash = hashPassword(newPassword);
  current.user.updatedAt = nowIso();
  saveDb(db);
  res.json({ ok: true, message: 'Tu contraseña fue actualizada.' });
});

app.get('/api/admin/users', (req, res) => {
  const db = loadDb();
  const current = requireAdmin(req, res, db);
  if (!current) return;
  res.json({ ok: true, users: listManagedUsers(db) });
});

app.post('/api/admin/users', (req, res) => {
  const db = loadDb();
  const current = requireAdmin(req, res, db);
  if (!current) return;

  const name = String(req.body?.name || '').trim();
  const email = normalizeEmail(req.body?.email);
  const role = String(req.body?.role || 'user').trim();
  const password = String(req.body?.password || '');

  if (!name) {
    res.status(400).json({ error: 'invalid_name', message: 'Escribe un nombre.' });
    return;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'invalid_email', message: 'Escribe un correo válido.' });
    return;
  }
  if (!ROLES.has(role)) {
    res.status(400).json({ error: 'invalid_role', message: 'Rol no válido.' });
    return;
  }
  if (findUserByEmail(db, email)) {
    res.status(409).json({ error: 'email_exists', message: 'Ese correo ya existe.' });
    return;
  }
  const validationError = validatePassword(password);
  if (validationError) {
    res.status(400).json({ error: 'weak_password', message: validationError });
    return;
  }

  const user = {
    id: randomId(10),
    email,
    name,
    role,
    passwordHash: hashPassword(password),
    createdAt: nowIso(),
    createdBy: current.user.email,
    lastLoginAt: null,
  };
  db.users.push(user);
  saveDb(db);
  res.json({ ok: true, user: sanitizeUser(user), users: listManagedUsers(db) });
});

app.post('/api/admin/users/set-password', (req, res) => {
  const db = loadDb();
  const current = requireAdmin(req, res, db);
  if (!current) return;

  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  const user = findUserByEmail(db, email);
  if (!user) {
    res.status(404).json({ error: 'not_found', message: 'No encontré ese usuario.' });
    return;
  }
  const validationError = validatePassword(password);
  if (validationError) {
    res.status(400).json({ error: 'weak_password', message: validationError });
    return;
  }
  user.passwordHash = hashPassword(password);
  user.updatedAt = nowIso();
  saveDb(db);
  res.json({ ok: true, users: listManagedUsers(db) });
});

app.get('/api/content', (_req, res) => {
  const db = loadDb();
  res.json({ ok: true, content: db.content });
});

app.post('/api/content/card', (req, res) => {
  const db = loadDb();
  const current = requireAdmin(req, res, db);
  if (!current) return;
  const section = String(req.body?.section || '').trim();
  const title = String(req.body?.title || '').trim();
  const text = String(req.body?.text || '').trim();
  if (!['que-es', 'beneficios', 'tipos', 'aprende'].includes(section) || !title || !text) {
    res.status(400).json({ error: 'invalid_payload', message: 'Faltan datos para guardar la tarjeta.' });
    return;
  }
  db.content.sections[section].extra.push({
    id: randomId(8),
    title,
    text,
    createdAt: nowIso(),
    createdBy: current.user.email,
  });
  saveDb(db);
  res.json({ ok: true, content: db.content });
});

app.post('/api/content/question', (req, res) => {
  const db = loadDb();
  const current = requireAdmin(req, res, db);
  if (!current) return;
  const topic = String(req.body?.topic || '').trim();
  const question = String(req.body?.question || '').trim();
  const answers = Array.isArray(req.body?.answers) ? req.body.answers.map((item) => String(item || '').trim()).filter(Boolean) : [];
  const correct = Number(req.body?.correct);
  if (!['que-es', 'beneficios', 'tipos', 'aprende'].includes(topic) || !question || answers.length < 2 || !Number.isInteger(correct) || correct < 0 || correct >= answers.length) {
    res.status(400).json({ error: 'invalid_payload', message: 'La pregunta no tiene un formato válido.' });
    return;
  }
  db.content.customQuestions.push({
    id: randomId(8),
    topic,
    question,
    answers,
    correct,
    source: 'admin',
    createdAt: nowIso(),
    createdBy: current.user.email,
  });
  saveDb(db);
  res.json({ ok: true, content: db.content });
});

app.get('/api/progress', (req, res) => {
  const db = loadDb();
  const current = requireSession(req, res, db);
  if (!current) return;
  const progress = db.progress.find((item) => item.userId === current.user.id) || null;
  res.json({ ok: true, progress });
});

app.post('/api/progress', (req, res) => {
  const db = loadDb();
  const current = requireSession(req, res, db);
  if (!current) return;
  const score = Number(req.body?.score);
  const total = Number(req.body?.total);
  const weakTopics = Array.isArray(req.body?.weakTopics) ? req.body.weakTopics.map((item) => String(item || '')).filter(Boolean) : [];
  const payload = {
    userId: current.user.id,
    score: Number.isFinite(score) ? score : 0,
    total: Number.isFinite(total) ? total : 0,
    weakTopics,
    completedAt: nowIso(),
  };
  db.progress = db.progress.filter((item) => item.userId !== current.user.id);
  db.progress.push(payload);
  saveDb(db);
  res.json({ ok: true, progress: payload });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`BioPlástico Educa auth escuchando en http://127.0.0.1:${PORT}`);
});
