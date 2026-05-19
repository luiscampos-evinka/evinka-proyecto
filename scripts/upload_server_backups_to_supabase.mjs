import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';

const ENV_PATH = '/root/.openclaw/workspace/.env';
const BACKUPS_DIR = '/root/backups';
const BUCKET = process.env.BACKUP_SUPABASE_BUCKET || 'EVINKA';
const PREFIX = process.env.BACKUP_SUPABASE_PREFIX || 'backups/server';

function loadEnvFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function gzipFile(sourcePath) {
  const targetPath = `${sourcePath}.gz`;
  await pipeline(
    fs.createReadStream(sourcePath),
    zlib.createGzip({ level: 9 }),
    fs.createWriteStream(targetPath),
  );
  return targetPath;
}

async function ensureCompressed(filePath) {
  const stats = fs.statSync(filePath);
  if (!stats.isFile()) return null;
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.tar.gz') || lower.endsWith('.zip') || lower.endsWith('.tgz') || lower.endsWith('.gz')) {
    return filePath;
  }
  return gzipFile(filePath);
}

async function uploadObject(baseUrl, key, objectPath, localPath) {
  const body = fs.createReadStream(localPath);
  const res = await fetch(`${baseUrl}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/octet-stream',
      'x-upsert': 'true',
    },
    duplex: 'half',
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Upload falló ${objectPath}: ${res.status} ${text}`);
  return text;
}

async function main() {
  loadEnvFile(ENV_PATH);
  const baseUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !key) throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');

  const entries = fs.readdirSync(BACKUPS_DIR)
    .map((name) => path.join(BACKUPS_DIR, name))
    .filter((item) => fs.existsSync(item));

  const uploaded = [];
  for (const entry of entries) {
    const stats = fs.statSync(entry);
    if (stats.isDirectory()) continue;
    const compressedPath = await ensureCompressed(entry);
    if (!compressedPath) continue;
    const objectPath = `${PREFIX}/${path.basename(compressedPath)}`;
    await uploadObject(baseUrl, key, objectPath, compressedPath);
    uploaded.push({ local: compressedPath, object: objectPath, size: fs.statSync(compressedPath).size });
  }

  console.log(JSON.stringify({ ok: true, bucket: BUCKET, prefix: PREFIX, uploaded }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
