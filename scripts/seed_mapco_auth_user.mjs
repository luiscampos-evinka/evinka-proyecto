import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const dbPath = process.env.MAPCO_AUTH_DB_PATH || '/root/.openclaw/workspace/data/mapco-auth-db.json';
const email = String(process.argv[2] || '').trim().toLowerCase();
const role = String(process.argv[3] || 'admin').trim().toLowerCase() === 'admin' ? 'admin' : 'user';
const password = String(process.argv[4] || '').trim() || generateStrongPassword();

if (!email || !/^[^\s@]+@(evinka\.tech|evinkatech\.onmicrosoft\.com)$/i.test(email)) {
  console.error('Uso: node scripts/seed_mapco_auth_user.mjs <email> [admin|user] [password]');
  process.exit(1);
}
if (!isStrongPassword(password)) {
  console.error('La contraseña debe tener al menos 12 caracteres e incluir mayúscula, minúscula, número y símbolo.');
  process.exit(1);
}

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify({
    meta: { createdAt: new Date().toISOString() },
    users: [],
    challenges: [],
    passwordResetGrants: [],
    sessions: [],
    trustedDevices: [],
  }, null, 2));
  fs.chmodSync(dbPath, 0o600);
}

const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
db.users ||= [];
const now = new Date().toISOString();
const existing = db.users.find((item) => String(item.email || '').trim().toLowerCase() === email);
if (existing) {
  existing.role = role;
  existing.accessEnabled = true;
  existing.verifiedAt ||= now;
  existing.updatedAt = now;
  existing.otpEmails = [email];
  existing.passwordHash = derivePassword(password);
} else {
  db.users.push({
    id: crypto.randomBytes(12).toString('hex'),
    email,
    role,
    accessEnabled: true,
    otpEmails: [email],
    passwordHash: derivePassword(password),
    createdAt: now,
    updatedAt: now,
    verifiedAt: now,
  });
}

const temp = `${dbPath}.tmp`;
fs.writeFileSync(temp, JSON.stringify(db, null, 2));
fs.chmodSync(temp, 0o600);
fs.renameSync(temp, dbPath);
console.log(JSON.stringify({ ok: true, email, role, password }, null, 2));

function randomToken(size = 16) {
  return crypto.randomBytes(size).toString('base64url');
}

function derivePassword(rawPassword, salt = randomToken(16)) {
  const hash = crypto.scryptSync(rawPassword, salt, 64).toString('base64');
  return `${salt}:${hash}`;
}

function generateStrongPassword() {
  const lowers = 'abcdefghijkmnpqrstuvwxyz';
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#$%^&*_-+=';
  const all = `${lowers}${uppers}${digits}${symbols}`;
  const picks = [
    lowers[randomInt(lowers.length)],
    uppers[randomInt(uppers.length)],
    digits[randomInt(digits.length)],
    symbols[randomInt(symbols.length)],
  ];
  while (picks.length < 20) picks.push(all[randomInt(all.length)]);
  return shuffle(picks).join('');
}

function isStrongPassword(value) {
  return typeof value === 'string'
    && value.length >= 12
    && /[A-Z]/.test(value)
    && /[a-z]/.test(value)
    && /\d/.test(value)
    && /[^A-Za-z0-9]/.test(value);
}

function randomInt(max) {
  return crypto.randomInt(0, max);
}

function shuffle(list) {
  const items = [...list];
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(0, index + 1);
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}
