import fs from 'node:fs';
import path from 'node:path';
import { SupabaseRest } from '../src/supabase.mjs';

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

function normalizePhone(value = '') {
  return String(value || '').replace(/\D+/g, '') || 'desconocido';
}

async function fetchMessages() {
  return sb.select('mensajes', "select=id_mensaje,id_conversacion,id_usuario,contenido,tipo_mensaje,payload_crudo,creado_en&or=(payload_crudo->>type.eq.contacts,payload_crudo->>type.eq.location)&order=creado_en.asc&limit=500");
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

async function fetchExistingArtifacts() {
  const rows = await sb.select('client_artifacts', 'select=id,message_id,artifact_type');
  return new Map(rows.map((row) => [`${row.message_id}:${row.artifact_type}`, row]));
}

async function main() {
  const messages = await fetchMessages();
  const conversationMap = await fetchConversationMap([...new Set(messages.map((m) => m.id_conversacion).filter(Boolean))]);
  const userMap = await fetchUserMap([...new Set(messages.map((m) => m.id_usuario).filter(Boolean))]);
  const existing = await fetchExistingArtifacts();
  const summary = { scanned: messages.length, inserted: 0, skipped: [] };

  for (const message of messages) {
    const payload = message.payload_crudo || {};
    const artifactType = String(payload.type || message.tipo_mensaje || '').trim().toLowerCase();
    if (!['contacts', 'location'].includes(artifactType)) continue;
    const key = `${message.id_mensaje}:${artifactType}`;
    if (existing.has(key)) {
      summary.skipped.push({ id_mensaje: message.id_mensaje, reason: 'already_backfilled' });
      continue;
    }
    const user = userMap.get(message.id_usuario) || null;
    const conversation = conversationMap.get(message.id_conversacion) || null;
    let title = null;
    let summaryText = null;
    let artifactPayload = null;
    if (artifactType === 'contacts') {
      const first = Array.isArray(payload.contacts) ? payload.contacts[0] : null;
      const name = first?.name?.formatted_name || [first?.name?.first_name, first?.name?.last_name].filter(Boolean).join(' ') || payload.contactName || 'Contacto compartido';
      const phone = first?.phones?.[0]?.phone || first?.phones?.[0]?.wa_id || payload.contactPhone || '';
      title = name;
      summaryText = ['Contacto compartido', name, phone].filter(Boolean).join(' · ');
      artifactPayload = { contacts: payload.contacts || payload.sharedContacts || [] };
    } else if (artifactType === 'location') {
      const location = payload.location || {
        name: payload.locationName || null,
        address: payload.locationAddress || null,
        latitude: payload.latitude ?? null,
        longitude: payload.longitude ?? null,
      };
      title = location.name || 'Ubicación compartida';
      summaryText = ['Ubicación compartida', location.name, location.address].filter(Boolean).join(' · ');
      artifactPayload = { location };
    }

    await sb.insert('client_artifacts', {
      client_id: user?.id_usuario || null,
      client_name: user?.nombre_visible || user?.nombre_usuario || null,
      phone: normalizePhone(payload.from || user?.telefono_principal || message.id_usuario),
      ticket_id: conversation?.codigo_ticket_solicitado || null,
      message_id: String(message.id_mensaje),
      conversation_id: message.id_conversacion || null,
      country_code: normalizePhone(payload.from || user?.telefono_principal || '').startsWith('57') ? 'CO' : 'PE',
      artifact_type: artifactType,
      title,
      summary: summaryText,
      payload: artifactPayload,
      source_platform: 'whatsapp',
    });
    summary.inserted += 1;
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
