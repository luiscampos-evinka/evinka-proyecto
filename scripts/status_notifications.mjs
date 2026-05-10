import fs from 'node:fs';
import path from 'node:path';
import { loadEnv, requiredEnv } from '../src/config.mjs';
import { WhatsAppMetaClient } from '../src/whatsappMeta.mjs';

loadEnv();

const WORKDIR = process.cwd();
const DATA_PATH = process.env.STATUS_OVERVIEW_DATA_PATH || '/var/www/status.evinka.net/data/overview-data.json';
const PREFS_PATH = path.resolve(WORKDIR, 'data/status-notification-prefs.json');
const STATE_PATH = path.resolve(WORKDIR, 'data/status-notification-state.json');
const CONFIG_PATH = path.resolve(WORKDIR, 'data/status-notification-config.json');
const DEFAULT_TARGET = '51904432138';
const ALERT_REPEAT_WINDOW_MS = 6 * 60 * 60 * 1000;
const STATUS_REPEAT_WINDOW_MS = 3 * 60 * 60 * 1000;
const MAX_SUMMARY_ITEMS = 3;

const mode = process.argv.includes('--mode') ? process.argv[process.argv.indexOf('--mode') + 1] : 'check';
const slot = process.argv.includes('--slot') ? process.argv[process.argv.indexOf('--slot') + 1] : 'default';

const meta = new WhatsAppMetaClient({
  accessToken: requiredEnv('WHATSAPP_ACCESS_TOKEN'),
  phoneNumberId: requiredEnv('WHATSAPP_PHONE_NUMBER_ID'),
  appSecret: process.env.META_APP_SECRET,
});

function ensureFile(filePath, fallback) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
  }
}

function readJson(filePath, fallback) {
  ensureFile(filePath, fallback);
  return JSON.parse(fs.readFileSync(filePath, 'utf8') || JSON.stringify(fallback));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function nowIso() {
  return new Date().toISOString();
}

function formatTime(value) {
  if (!value) return 'Sin dato';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

function toneLabel(tone) {
  return ({ available: 'Disponible', charging: 'Charging', preparing: 'Preparing', offline: 'Offline', faulted: 'Faulted' }[tone] || tone || 'Disponible');
}

function meaningForTone(tone) {
  return {
    offline: 'el cargador perdió comunicación',
    faulted: 'hay una falla operativa activa',
    preparing: 'está en transición previa a carga',
    charging: 'hay una sesión de carga activa',
    available: 'volvió a quedar operativo',
  }[tone] || 'hubo un cambio operativo';
}

function loadConfig() {
  return readJson(CONFIG_PATH, {
    targetPhone: DEFAULT_TARGET,
    summaryHours: [8, 18],
  });
}

function loadState() {
  return readJson(STATE_PATH, {
    lastGeneratedAt: null,
    stationTones: {},
    notifiedAlerts: {},
    notifiedStatuses: {},
    summaries: {},
  });
}

function loadPrefs() {
  return readJson(PREFS_PATH, { users: {} });
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function isMuted(pref, field) {
  const value = pref?.[field];
  return value ? new Date(value).getTime() > Date.now() : false;
}

function cleanupHistory(map, windowMs) {
  const out = {};
  const now = Date.now();
  for (const [key, ts] of Object.entries(map || {})) {
    if (now - new Date(ts).getTime() < windowMs) out[key] = ts;
  }
  return out;
}

function stationLocation(station) {
  return station.plazaName || station.address || station.locationText || 'Ubicación por confirmar';
}

function buildAlertMessage(item) {
  return [
    '🚨 EVINKA ALERTA',
    `Tipo: ${item.title || 'Crítica'}`,
    `Estación: ${item.stationName}`,
    `Qué pasó: ${item.what}`,
    `Significa: ${item.meaning}`,
    `Dónde: ${item.where}`,
    `Cuándo: ${item.when}`,
  ].join('\n');
}

function buildStatusMessage(item) {
  return [
    'ℹ️ EVINKA STATUS',
    `Estación: ${item.stationName}`,
    `Estado: ${item.what}`,
    `Significa: ${item.meaning}`,
    `Dónde: ${item.where}`,
    `Cuándo: ${item.when}`,
  ].join('\n');
}

function buildSummaryMessage(data) {
  const totals = data.totals || {};
  const important = [];
  const offlineStations = (data.stations || []).filter((station) => station.tone === 'offline');
  const faultedAlerts = (data.alerts || []).filter((alert) => (alert.status || '').toLowerCase() === 'faulted');
  const preparingStations = (data.stations || []).filter((station) => station.tone === 'preparing');

  if (offlineStations.length) important.push(`Offline: ${offlineStations.slice(0, MAX_SUMMARY_ITEMS).map((s) => s.name).join(', ')}`);
  if (faultedAlerts.length) important.push(`Fallando: ${faultedAlerts.slice(0, MAX_SUMMARY_ITEMS).map((a) => a.stationId || a.title).join(', ')}`);
  if (preparingStations.length) important.push(`Preparing: ${preparingStations.slice(0, MAX_SUMMARY_ITEMS).map((s) => s.name).join(', ')}`);

  return [
    '📊 EVINKA RESUMEN',
    `Hora: ${formatTime(data.generatedAt)}`,
    `Red: ${totals.stations || 0} estaciones · ${totals.connectors || 0} conectores`,
    `Estados: ${totals.available || 0} disp. · ${totals.offline || 0} offline · ${totals.faulted || 0} faulted · ${totals.preparing || 0} preparing`,
    important.length ? `Clave: ${important.join(' | ')}` : 'Clave: sin novedades críticas en este snapshot.',
  ].join('\n');
}

function buildButtonsFooter() {
  return 'Controles rápidos de notificaciones';
}

function defaultButtons() {
  return [
    { id: 'status_alerts_24h', title: 'Silenciar alertas' },
    { id: 'status_states_24h', title: 'Silenciar estados' },
    { id: 'status_resume_on', title: 'Reactivar' },
  ];
}

function buildEvents(data, state) {
  const events = [];
  const alertByStation = new Map((data.stations || []).map((station) => [station.id, station]));

  for (const station of data.stations || []) {
    const prevTone = state.stationTones?.[station.id] || null;
    const tone = station.tone || 'available';
    if (!prevTone) continue;

    if (prevTone !== tone) {
      const isImportant = ['offline', 'faulted'].includes(tone) || (['offline', 'faulted'].includes(prevTone) && tone === 'available');
      if (isImportant) {
        events.push({
          kind: 'status',
          key: `status:${station.id}:${prevTone}->${tone}`,
          stationName: station.name,
          what: `${toneLabel(prevTone)} → ${toneLabel(tone)}`,
          meaning: tone === 'available' ? 'el cargador se recuperó y volvió a estar operativo' : meaningForTone(tone),
          where: stationLocation(station),
          when: formatTime(data.generatedAt),
          severity: tone === 'available' ? 'recovery' : 'important',
        });
      }
    }
  }

  for (const alert of data.alerts || []) {
    const normalized = String(alert.status || '').toLowerCase();
    if (!['faulted', 'offline'].includes(normalized)) continue;
    const station = alertByStation.get(alert.stationId) || {};
    const detail = String(alert.detail || '').trim();
    events.push({
      kind: 'alert',
      key: `alert:${alert.stationId || 'na'}:${alert.title || 'na'}:${detail}`,
      stationName: station.name || alert.stationId || 'Estación por confirmar',
      title: alert.title || 'Alerta crítica',
      what: normalized === 'offline' ? 'Offline' : 'Faulted',
      meaning: detail || meaningForTone(normalized),
      where: stationLocation(station),
      when: alert.createdLabel || formatTime(alert.createdAt || data.generatedAt),
      severity: 'critical',
    });
  }

  return events;
}

async function sendButtonsMessage(to, body) {
  return meta.sendButtons(to, {
    body,
    footer: buildButtonsFooter(),
    buttons: defaultButtons(),
  });
}

async function runCheck() {
  const data = readJson(DATA_PATH, {});
  const config = loadConfig();
  const targetPhone = normalizePhone(config.targetPhone || DEFAULT_TARGET);
  const prefs = loadPrefs();
  const pref = prefs.users?.[targetPhone] || {};
  const state = loadState();
  state.notifiedAlerts = cleanupHistory(state.notifiedAlerts, ALERT_REPEAT_WINDOW_MS);
  state.notifiedStatuses = cleanupHistory(state.notifiedStatuses, STATUS_REPEAT_WINDOW_MS);

  const events = buildEvents(data, state);
  const sent = [];

  for (const event of events) {
    if (event.kind === 'alert') {
      if (isMuted(pref, 'muteAlertsUntil')) continue;
      if (state.notifiedAlerts[event.key]) continue;
      await sendButtonsMessage(targetPhone, buildAlertMessage(event));
      state.notifiedAlerts[event.key] = nowIso();
      sent.push({ type: 'alert', key: event.key });
    }

    if (event.kind === 'status') {
      if (isMuted(pref, 'muteStatusUntil')) continue;
      if (state.notifiedStatuses[event.key]) continue;
      await sendButtonsMessage(targetPhone, buildStatusMessage(event));
      state.notifiedStatuses[event.key] = nowIso();
      sent.push({ type: 'status', key: event.key });
    }
  }

  state.lastGeneratedAt = data.generatedAt || null;
  state.stationTones = Object.fromEntries((data.stations || []).map((station) => [station.id, station.tone || 'available']));
  writeJson(STATE_PATH, state);
  return { ok: true, mode: 'check', targetPhone, sent, generatedAt: data.generatedAt || null };
}

async function runSummary() {
  const data = readJson(DATA_PATH, {});
  const config = loadConfig();
  const targetPhone = normalizePhone(config.targetPhone || DEFAULT_TARGET);
  const prefs = loadPrefs();
  const pref = prefs.users?.[targetPhone] || {};
  const state = loadState();
  const now = new Date();
  const summaryKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}:${mode}:${slot}`;

  if (isMuted(pref, 'muteStatusUntil') && isMuted(pref, 'muteAlertsUntil')) {
    return { ok: true, mode: 'summary', skipped: 'all_muted' };
  }

  if (state.summaries?.[summaryKey]) {
    return { ok: true, mode: 'summary', skipped: 'already_sent', summaryKey };
  }

  await sendButtonsMessage(targetPhone, buildSummaryMessage(data));
  state.summaries ||= {};
  state.summaries[summaryKey] = nowIso();
  writeJson(STATE_PATH, state);
  return { ok: true, mode: 'summary', slot, targetPhone, summaryKey };
}

const result = mode === 'summary' ? await runSummary() : await runCheck();
console.log(JSON.stringify(result, null, 2));
