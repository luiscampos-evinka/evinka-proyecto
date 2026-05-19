import fs from 'node:fs';
import path from 'node:path';
import { SupabaseRest } from '../src/supabase.mjs';
import { SupabaseStorage } from '../src/supabaseStorage.mjs';

function loadEnvFile(file = '.env') {
  const envPath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile();

const sb = new SupabaseRest({
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_ROLE_KEY,
});

const storage = new SupabaseStorage({
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_ROLE_KEY,
});

const CLIENT_FILES_BUCKET = process.env.CLIENT_FILES_BUCKET || 'evinka-client-files';
const MEDIA_ROOT = process.env.ADVISOR_MEDIA_ROOT || '/root/.openclaw/workspace/data/advisor-media';

function safeStorageFileName(value = 'archivo') {
  const clean = String(value || 'archivo')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return clean || 'archivo';
}

function normalizePhone(value = '') {
  return String(value || '').replace(/\D+/g, '') || 'desconocido';
}

function extensionFromMimeType(mimeType = '') {
  const lower = String(mimeType || '').toLowerCase();
  return {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'audio/ogg': '.ogg',
    'audio/mpeg': '.mp3',
    'video/mp4': '.mp4',
  }[lower] || '';
}

function ensureFilenameWithExtension(fileName = 'archivo', mimeType = '') {
  const ext = path.extname(fileName || '');
  if (ext) return fileName;
  return `${fileName}${extensionFromMimeType(mimeType)}`;
}

function classifyClientFileFolder({ fileName = '', mimeType = '', caption = '' } = {}) {
  const source = `${fileName} ${caption}`.toLowerCase();
  if (String(mimeType || '').startsWith('image/')) return 'fotos';
  if (/comprobante|voucher|pago|deposito|depósito|transferencia/.test(source)) return 'comprobantes';
  if (/cotizacion|cotización|quote|propuesta/.test(source)) return 'cotizaciones';
  return 'documentos';
}

function buildClientStoragePath({ phone = '', fileName = 'archivo', mimeType = '', caption = '', createdAt = new Date() } = {}) {
  const folder = classifyClientFileFolder({ fileName, mimeType, caption });
  const safePhone = normalizePhone(phone);
  const ensuredFileName = ensureFilenameWithExtension(fileName, mimeType);
  const ext = path.extname(ensuredFileName || '') || extensionFromMimeType(mimeType);
  const base = safeStorageFileName(path.basename(ensuredFileName || 'archivo', path.extname(ensuredFileName || '')) || 'archivo');
  const stamp = new Date(createdAt).toISOString().replace(/[:.]/g, '-');
  return `clientes/${safePhone}/${folder}/${stamp}-${base}${ext}`;
}

function buildStoredMediaUrl(bucket = '', objectPath = '') {
  const encodedPath = String(objectPath || '')
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `/api/inbox/storage-media/${encodeURIComponent(String(bucket || '').trim())}/${encodedPath}`;
}

function localMediaPathFromPayload(payload = {}) {
  if (payload.localMediaPath) return String(payload.localMediaPath);
  const mediaUrl = String(payload.mediaUrl || '');
  const prefix = '/api/inbox/media/';
  if (!mediaUrl.startsWith(prefix)) return '';
  return decodeURIComponent(mediaUrl.slice(prefix.length));
}

async function fetchMessages() {
  return sb.select('mensajes', 'select=id_mensaje,id_conversacion,id_usuario,contenido,tipo_mensaje,payload_crudo,creado_en&or=(payload_crudo->>mediaUrl.not.is.null,payload_crudo->>fileName.not.is.null,payload_crudo->>storagePath.not.is.null)&order=creado_en.asc&limit=500');
}

async function fetchConversationMap(ids = []) {
  if (!ids.length) return new Map();
  const rows = await sb.select('conversaciones', `id_conversacion=in.(${ids.join(',')})&select=id_conversacion,codigo_ticket_solicitado`);
  return new Map(rows.map((row) => [row.id_conversacion, row]));
}

async function fetchUserMap(ids = []) {
  if (!ids.length) return new Map();
  const encoded = ids.map((id) => encodeURIComponent(id)).join(',');
  const rows = await sb.select('usuarios', `id_usuario=in.(${encoded})&select=id_usuario,nombre_visible,nombre_usuario,telefono_principal`);
  return new Map(rows.map((row) => [row.id_usuario, row]));
}

async function fetchExistingClientFiles() {
  const rows = await sb.select('client_files', 'select=id,message_id,storage_bucket,storage_path');
  return new Map(rows.map((row) => [String(row.message_id || ''), row]));
}

async function main() {
  const messages = await fetchMessages();
  const conversationMap = await fetchConversationMap([...new Set(messages.map((m) => m.id_conversacion).filter(Boolean))]);
  const userMap = await fetchUserMap([...new Set(messages.map((m) => m.id_usuario).filter(Boolean))]);
  const existingByMessageId = await fetchExistingClientFiles();

  const summary = { scanned: messages.length, uploaded: 0, inserted: 0, updatedMessages: 0, skipped: [] };

  for (const message of messages) {
    const payload = message.payload_crudo || {};
    if (existingByMessageId.has(String(message.id_mensaje))) {
      summary.skipped.push({ id_mensaje: message.id_mensaje, reason: 'already_in_client_files' });
      continue;
    }
    const localRelPath = localMediaPathFromPayload(payload);
    if (!localRelPath) {
      summary.skipped.push({ id_mensaje: message.id_mensaje, reason: 'no_local_media_path' });
      continue;
    }
    const absPath = path.resolve(MEDIA_ROOT, localRelPath);
    if (!absPath.startsWith(path.resolve(MEDIA_ROOT)) || !fs.existsSync(absPath)) {
      summary.skipped.push({ id_mensaje: message.id_mensaje, reason: 'local_file_missing', path: localRelPath });
      continue;
    }

    const user = userMap.get(message.id_usuario) || null;
    const conversation = conversationMap.get(message.id_conversacion) || null;
    const phone = normalizePhone(payload.from || user?.telefono_principal || String(message.id_usuario || '').replace(/^whatsapp_/, ''));
    const clientName = String(user?.nombre_visible || user?.nombre_usuario || payload.profileName || '').trim() || null;
    const mimeType = String(payload.mimeType || payload.document?.mime_type || payload.image?.mime_type || 'application/octet-stream');
    const fileName = ensureFilenameWithExtension(String(payload.fileName || payload.document?.filename || path.basename(absPath) || 'archivo').trim(), mimeType);
    const buffer = fs.readFileSync(absPath);
    const objectPath = buildClientStoragePath({
      phone,
      fileName,
      mimeType,
      caption: String(message.contenido || payload.document?.caption || ''),
      createdAt: message.creado_en,
    });

    await storage.uploadObject(CLIENT_FILES_BUCKET, objectPath, buffer, { contentType: mimeType, upsert: true });
    summary.uploaded += 1;

    const record = {
      client_id: user?.id_usuario || null,
      client_name: clientName,
      phone,
      ticket_id: conversation?.codigo_ticket_solicitado || null,
      message_id: String(message.id_mensaje),
      conversation_id: message.id_conversacion || null,
      country_code: phone.startsWith('57') ? 'CO' : 'PE',
      file_name: fileName,
      file_type: classifyClientFileFolder({ fileName, mimeType, caption: String(message.contenido || '') }),
      mime_type: mimeType,
      file_size: buffer.length,
      storage_bucket: CLIENT_FILES_BUCKET,
      storage_path: objectPath,
      public_url: null,
      signed_url: null,
      source_platform: 'whatsapp',
    };

    await sb.insert('client_files', record);
    summary.inserted += 1;

    const nextPayload = {
      ...payload,
      mediaUrl: buildStoredMediaUrl(CLIENT_FILES_BUCKET, objectPath),
      storageBucket: CLIENT_FILES_BUCKET,
      storagePath: objectPath,
      fileName,
      mimeType,
      fileSize: buffer.length,
      localMediaPath: localRelPath,
      sourcePlatform: payload.sourcePlatform || 'whatsapp',
    };
    await sb.update('mensajes', `id_mensaje=eq.${message.id_mensaje}`, { payload_crudo: nextPayload });
    summary.updatedMessages += 1;
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
