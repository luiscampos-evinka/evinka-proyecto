import crypto from 'node:crypto';
import { loadEnv, requiredEnv } from '../src/config.mjs';
import { SupabaseRest } from '../src/supabase.mjs';

loadEnv();

const sb = new SupabaseRest({
  url: requiredEnv('SUPABASE_URL'),
  key: requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
});

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

async function main() {
  const conversations = await sb.select(
    'conversaciones',
    'paso_actual=eq.lead_captado&subestado_flujo=eq.marketing_optin&select=id_conversacion,id_usuario,resumen,creado_en&order=creado_en.asc&limit=5000',
  );

  const userIds = [...new Set((conversations || []).map((item) => String(item.id_usuario || '').trim()).filter(Boolean))];
  const users = userIds.length
    ? await sb.select('usuarios', `id_usuario=in.(${userIds.map((value) => encodeURIComponent(value)).join(',')})&select=id_usuario,nombre_visible,nombre_usuario,correo_electronico`)
    : [];

  const usersById = new Map((users || []).map((user) => [String(user.id_usuario || '').trim(), user]));

  let scanned = 0;
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];

  for (const conversation of conversations || []) {
    scanned += 1;
    try {
      const summary = typeof conversation.resumen === 'string' ? JSON.parse(conversation.resumen || '{}') : (conversation.resumen || {});
      const source = String(summary.source || '').trim();
      const page = String(summary.page || '').trim();
      const acceptMarketing = !!summary.acceptMarketing;
      const acceptCookies = !!summary.acceptCookies;

      if (source !== 'solo-mapa.html' && page !== '/solo-mapa.html') {
        skipped += 1;
        continue;
      }
      if (!acceptMarketing || !acceptCookies) {
        skipped += 1;
        continue;
      }

      const user = usersById.get(String(conversation.id_usuario || '').trim()) || null;
      const email = normalizeEmail(user?.correo_electronico || '');
      const name = normalizeName(user?.nombre_visible || user?.nombre_usuario || '');
      if (!isValidEmail(email) || !name) {
        skipped += 1;
        continue;
      }

      const deviceKey = 'sin_device';
      const capturedAt = String(summary.capturedAt || conversation.creado_en || new Date().toISOString());
      const existingRows = await sb.select(
        'leads_mapa_publico',
        `correo=eq.${encodeURIComponent(email)}&device_key=eq.${encodeURIComponent(deviceKey)}&select=id_lead,id_usuario&limit=1`,
      );
      const existingLead = Array.isArray(existingRows) ? existingRows[0] : null;
      const payload = {
        id_usuario: String(user.id_usuario || '').trim() || null,
        nombre: name,
        correo: email,
        telefono: null,
        acepta_promociones: true,
        acepta_cookies: true,
        device_key: deviceKey,
        fuente: 'mapa_publico',
        canal: 'web_mapa',
        origen_url: page || '/solo-mapa.html',
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        user_agent: summary.userAgent ? String(summary.userAgent).slice(0, 1000) : null,
        ip_hash: summary.ip ? sha256(summary.ip) : null,
        metadata: {
          backfilled: true,
          backfilledFrom: 'conversaciones',
          source: source || 'solo-mapa.html',
          page: page || '/solo-mapa.html',
          originalConversationId: conversation.id_conversacion,
          originalCapturedAt: capturedAt,
        },
      };

      if (existingLead?.id_lead) {
        await sb.update('leads_mapa_publico', `id_lead=eq.${encodeURIComponent(existingLead.id_lead)}`, payload);
        updated += 1;
      } else {
        await sb.insert('leads_mapa_publico', {
          ...payload,
          capturado_en: capturedAt,
          actualizado_en: capturedAt,
        });
        inserted += 1;
      }
    } catch (error) {
      errors.push({ id_conversacion: conversation.id_conversacion, error: error.message });
    }
  }

  console.log(JSON.stringify({ scanned, inserted, updated, skipped, errors }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
