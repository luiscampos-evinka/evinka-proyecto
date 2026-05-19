import fs from 'node:fs';
import path from 'node:path';

const ACCESS_AUDIT_LOG_PATH = process.env.ACCESS_AUDIT_LOG_PATH
  || '/root/.openclaw/workspace/data/access-audit-log.json';
const ACCESS_AUDIT_LIMIT = Number(process.env.ACCESS_AUDIT_LIMIT || 5000);

function ensureAccessAuditFile() {
  fs.mkdirSync(path.dirname(ACCESS_AUDIT_LOG_PATH), { recursive: true });
  if (!fs.existsSync(ACCESS_AUDIT_LOG_PATH)) {
    fs.writeFileSync(ACCESS_AUDIT_LOG_PATH, '[]\n');
  }
}

export function readAccessAuditLogs() {
  try {
    ensureAccessAuditFile();
    const raw = fs.readFileSync(ACCESS_AUDIT_LOG_PATH, 'utf8');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('readAccessAuditLogs failed:', error);
    return [];
  }
}

export function appendAccessAuditLog(event = {}) {
  try {
    const logs = readAccessAuditLogs();
    logs.push({
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      module: String(event.module || 'unknown').trim().toLowerCase(),
      action: String(event.action || '').trim().toLowerCase(),
      status: String(event.status || 'success').trim().toLowerCase(),
      userId: String(event.userId || '').trim(),
      employeeCode: String(event.employeeCode || '').trim().toUpperCase(),
      email: String(event.email || '').trim().toLowerCase(),
      name: String(event.name || '').trim(),
      role: String(event.role || '').trim().toLowerCase(),
      allowedCountries: Array.isArray(event.allowedCountries)
        ? [...new Set(event.allowedCountries.map((item) => String(item || '').trim().toUpperCase()).filter(Boolean))]
        : [],
      ip: String(event.ip || '').trim(),
      userAgent: String(event.userAgent || '').trim().slice(0, 300),
      reason: String(event.reason || '').trim(),
      meta: event.meta && typeof event.meta === 'object' ? event.meta : {},
    });
    const trimmed = logs.length > ACCESS_AUDIT_LIMIT ? logs.slice(-ACCESS_AUDIT_LIMIT) : logs;
    fs.writeFileSync(ACCESS_AUDIT_LOG_PATH, `${JSON.stringify(trimmed, null, 2)}\n`);
  } catch (error) {
    console.error('appendAccessAuditLog failed:', error);
  }
}

export { ACCESS_AUDIT_LOG_PATH };
