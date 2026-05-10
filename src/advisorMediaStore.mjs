import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.env.ADVISOR_MEDIA_ROOT || '/root/.openclaw/workspace/data/advisor-media';

function safeName(value = 'archivo') {
  const clean = String(value || 'archivo')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return clean || 'archivo';
}

export function ensureAdvisorMediaRoot() {
  fs.mkdirSync(ROOT, { recursive: true });
}

export function saveConversationMedia({ conversationId, direction = 'misc', fileName = 'archivo', mimeType = 'application/octet-stream', buffer }) {
  ensureAdvisorMediaRoot();
  const ext = path.extname(fileName || '') || '';
  const base = safeName(path.basename(fileName || 'archivo', ext));
  const stamped = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${base}${ext}`;
  const relDir = path.join(String(conversationId), direction);
  const absDir = path.join(ROOT, relDir);
  fs.mkdirSync(absDir, { recursive: true });
  const absPath = path.join(absDir, stamped);
  fs.writeFileSync(absPath, buffer);
  const relPath = path.join(relDir, stamped).replace(/\\/g, '/');
  return {
    root: ROOT,
    absolutePath: absPath,
    relativePath: relPath,
    urlPath: `/api/inbox/media/${encodeURIComponent(relPath)}`,
    fileName: `${base}${ext}`,
    mimeType,
    size: Buffer.byteLength(buffer),
  };
}

export function resolveConversationMedia(relPath = '') {
  ensureAdvisorMediaRoot();
  const decoded = decodeURIComponent(String(relPath || '')).replace(/\\/g, '/').replace(/^\/+/, '');
  const absPath = path.resolve(ROOT, decoded);
  const rootPath = path.resolve(ROOT);
  if (!absPath.startsWith(rootPath)) return null;
  if (!fs.existsSync(absPath)) return null;
  return absPath;
}
