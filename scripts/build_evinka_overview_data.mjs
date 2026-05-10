import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from '../src/config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
loadEnv(path.join(ROOT, '.env'));

const OUT_DIR = path.join(ROOT, 'apps/overview-app/public/data');
const CACHE_DIR = path.join(ROOT, '.runtime/evinka-overview');
const FILES = ['UBICACIONES.har', 'TODO.har', 'exportar.har'];
const HEARTBEAT_OFFLINE_MS = 5 * 60 * 1000;
const EVINKA_BASE_URL = 'https://connect.evinka.net';
const EVINKA_SSO_BASE_URL = 'https://sso.connect.evinka.net';

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function downloadFromSupabase(name) {
  const base = process.env.SUPABASE_URL.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(`${base}/storage/v1/object/authenticated/EVINKA/${encodeURIComponent(name)}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`${name}: ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const filePath = path.join(CACHE_DIR, name);
  await ensureDir(CACHE_DIR);
  await fs.writeFile(filePath, buf);
  return filePath;
}

async function ensureHar(name) {
  const filePath = path.join(CACHE_DIR, name);
  try {
    return await downloadFromSupabase(name);
  } catch (error) {
    try {
      await fs.access(filePath);
      console.warn(`[overview] usando cache local para ${name}: ${error.message}`);
      return filePath;
    } catch {
      throw error;
    }
  }
}

function parseResponseText(entry) {
  const content = entry?.response?.content || {};
  if (!content.text) return null;
  let text = content.text;
  if (content.encoding === 'base64') text = Buffer.from(text, 'base64').toString('utf8');
  return text;
}

function parseJson(entry) {
  const text = parseResponseText(entry);
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function findEntries(entries, matcher) {
  return entries.filter(entry => matcher(entry.request?.url || '', entry));
}

function statusTone(status = '') {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('fault')) return 'faulted';
  if (normalized.includes('charg')) return 'charging';
  if (normalized.includes('prepar')) return 'preparing';
  if (normalized.includes('suspend')) return 'faulted';
  if (normalized.includes('finish')) return 'available';
  if (normalized.includes('reserv')) return 'preparing';
  if (normalized.includes('unavail')) return 'offline';
  return normalized.includes('offline') ? 'offline' : 'available';
}

function formatDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit', month: '2-digit', year: '2-digit', hour: 'numeric', minute: '2-digit'
  }).format(d);
}

function heartbeatAgeMs(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return Number.POSITIVE_INFINITY;
  return Date.now() - ts;
}

function hasRecentHeartbeat(value) {
  return heartbeatAgeMs(value) <= HEARTBEAT_OFFLINE_MS;
}

function connectorPriority(tone = '') {
  return ({ faulted: 5, charging: 4, preparing: 3, offline: 2, available: 1 }[tone] || 0);
}

function pickPrimaryConnector(connectors = []) {
  return [...connectors].sort((a, b) => connectorPriority(b.tone) - connectorPriority(a.tone))[0] || null;
}

function decodeHtmlEntities(value = '') {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function parseSetCookie(setCookieValue = '') {
  const parts = String(setCookieValue || '').split(';').map(part => part.trim()).filter(Boolean);
  const [nameValue, ...attrs] = parts;
  if (!nameValue || !nameValue.includes('=')) return null;
  const idx = nameValue.indexOf('=');
  const name = nameValue.slice(0, idx).trim();
  const value = nameValue.slice(idx + 1).trim();
  const domainAttr = attrs.find(attr => attr.toLowerCase().startsWith('domain='));
  const domain = domainAttr ? domainAttr.slice(7).trim().toLowerCase() : null;
  return { name, value, domain };
}

class SimpleCookieJar {
  constructor() {
    this.cookies = [];
  }

  setFromCookieHeader(cookieHeader = '', url = null) {
    const host = url ? new URL(url).hostname.toLowerCase() : null;
    for (const part of String(cookieHeader || '').split(';').map(x => x.trim()).filter(Boolean)) {
      const idx = part.indexOf('=');
      if (idx === -1) continue;
      this.set({ name: part.slice(0, idx), value: part.slice(idx + 1), domain: host });
    }
  }

  set(cookie) {
    if (!cookie?.name) return;
    const domain = String(cookie.domain || '').toLowerCase() || null;
    this.cookies = this.cookies.filter(item => !(item.name === cookie.name && (item.domain || null) === domain));
    this.cookies.push({ name: cookie.name, value: cookie.value, domain });
  }

  absorb(url, response) {
    const raw = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')] : []);
    const host = new URL(url).hostname.toLowerCase();
    for (const item of raw) {
      const parsed = parseSetCookie(item);
      if (!parsed) continue;
      this.set({ ...parsed, domain: parsed.domain || host });
    }
  }

  header(url) {
    const host = new URL(url).hostname.toLowerCase();
    return this.cookies
      .filter(cookie => !cookie.domain || host === cookie.domain || host.endsWith(cookie.domain.replace(/^\./, '')))
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');
  }
}

async function fetchWithCookies(url, { jar, method = 'GET', headers = {}, body = undefined, redirect = 'manual' } = {}) {
  const cookie = jar?.header(url);
  const res = await fetch(url, {
    method,
    headers: {
      'user-agent': 'EVINKA Status Builder/1.0',
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body,
    redirect,
  });
  jar?.absorb(url, res);
  return res;
}

function extractLoginForm(html = '') {
  const actionMatch = html.match(/<form[^>]+id="kc-form-login"[^>]+action="([^"]+)"/i) || html.match(/<form[^>]+action="([^"]+)"/i);
  const action = actionMatch ? decodeHtmlEntities(actionMatch[1]) : null;
  const fields = {};
  for (const match of html.matchAll(/<input[^>]+name="([^"]+)"[^>]*value="([^"]*)"[^>]*>/gi)) {
    fields[match[1]] = decodeHtmlEntities(match[2]);
  }
  return { action, fields };
}

async function loginToEvinka({ username, password }) {
  const jar = new SimpleCookieJar();
  const seedUrl = `${EVINKA_BASE_URL}/api/v1/admin/merchants/-/plazas/-/stationoverview`;
  const initial = await fetchWithCookies(seedUrl, { jar, redirect: 'manual' });
  const location = initial.headers.get('location');
  if (!location) throw new Error('No pude obtener la redirección de login de EVINKA Connect.');

  const loginPage = await fetchWithCookies(location, { jar, redirect: 'manual' });
  const html = await loginPage.text();
  const { action, fields } = extractLoginForm(html);
  if (!action) throw new Error('No pude encontrar el formulario de login de EVINKA Connect.');

  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  form.set('username', username);
  form.set('password', password);
  if (!form.has('credentialId')) form.set('credentialId', '');
  if (!form.has('login')) form.set('login', 'Sign In');

  let res = await fetchWithCookies(action, {
    jar,
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
    redirect: 'manual',
  });

  for (let i = 0; i < 10 && [301, 302, 303, 307, 308].includes(res.status); i += 1) {
    const next = res.headers.get('location');
    if (!next) break;
    res = await fetchWithCookies(new URL(next, res.url).toString(), { jar, redirect: 'manual' });
  }

  const userInfo = await fetchWithCookies(`${EVINKA_BASE_URL}/oauth2/userinfo`, { jar, redirect: 'manual' });
  if (userInfo.status !== 200) {
    throw new Error('Las credenciales de EVINKA Connect no autenticaron correctamente.');
  }
  return { jar, userinfo: await userInfo.json() };
}

async function fetchJsonFromConnect(pathname, jar) {
  const url = pathname.startsWith('http') ? pathname : `${EVINKA_BASE_URL}${pathname}`;
  const res = await fetchWithCookies(url, { jar, redirect: 'manual' });
  if ([301, 302, 303, 307, 308].includes(res.status)) {
    throw new Error(`EVINKA Connect redirigió a login al pedir ${pathname}`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) throw new Error(`EVINKA Connect devolvió ${res.status} en ${pathname}`);
  if (!contentType.includes('application/json')) throw new Error(`EVINKA Connect no devolvió JSON en ${pathname}`);
  return res.json();
}

async function loadLiveSnapshot() {
  const cookie = process.env.EVINKA_CONNECT_COOKIE || '';
  const username = process.env.EVINKA_CONNECT_USERNAME || '';
  const password = process.env.EVINKA_CONNECT_PASSWORD || '';
  if (!cookie && !(username && password)) return null;

  try {
    const jar = new SimpleCookieJar();
    let userinfo = null;
    if (cookie) {
      jar.setFromCookieHeader(cookie, EVINKA_BASE_URL);
      userinfo = await fetchJsonFromConnect('/oauth2/userinfo', jar);
    } else {
      const session = await loginToEvinka({ username, password });
      userinfo = session.userinfo;
      session.jar.cookies.forEach(cookieItem => jar.set(cookieItem));
    }

    const stationsData = await fetchJsonFromConnect('/api/v1/admin/merchants/-/plazas/-/stations?page_size=200&page=1', jar);
    const merchantIds = [...new Set((stationsData?.stations || []).map(station => station?.merchantId).filter(Boolean))];
    const plazasList = await Promise.all(merchantIds.map(async (merchantId) => {
      const encoded = encodeURIComponent(merchantId);
      const data = await fetchJsonFromConnect(`/api/v1/admin/merchants/${encoded}/plazas?page_size=200&page=1`, jar);
      return data?.plazas || [];
    }));

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const qs = new URLSearchParams({
      start_time: weekAgo.toISOString(),
      end_time: now.toISOString(),
      page_size: '100',
      page: '1',
    });

    return {
      userinfo,
      overview: await fetchJsonFromConnect('/api/v1/admin/merchants/-/plazas/-/stationoverview', jar),
      plazas: plazasList.flat(),
      stationdigests: await fetchJsonFromConnect('/api/v1/admin/merchants/-/plazas/-/stationdigests', jar),
      stations: stationsData,
      chargingAlarms: await fetchJsonFromConnect('/api/v1/admin/extensions/chargingAlarms?read=no&page_size=100&page=1', jar),
      generalAlarms: await fetchJsonFromConnect('/api/v1/admin/extensions/generalAlarms?lifted=no&page_size=100&page=1', jar),
      moduleStatuses: await fetchJsonFromConnect('/api/v1/admin/extensions/moduleStatuses?state=ng&page_size=100&page=1', jar),
      faultPrompts: await fetchJsonFromConnect('/api/v1/admin/faultPrompts?status=unread&page_size=100&page=1', jar),
      transactionstatistics: await fetchJsonFromConnect(`/api/v1/admin/merchants/-/plazas/-/stations/-/transactionstatistics?${qs.toString()}`, jar),
    };
  } catch (error) {
    console.warn(`[overview] modo live no disponible: ${error.message}`);
    return null;
  }
}

function merchantNiceName(id = '') {
  return String(id)
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const plazaMap = new Map();
const stationMap = new Map();
const stationDigestMap = new Map();
const alerts = [];
const incidents = [];
const transactions = [];
let overview = null;
let operator = null;

function normalizeLoose(value = '') {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function inferStationPlaza(stationName, plazas) {
  const name = normalizeLoose(stationName);
  const byNeedle = (needle) => plazas.find(plaza => normalizeLoose(`${plaza.name} ${plaza.address} ${plaza.merchantName}`).includes(needle));

  if (name.includes('miraflores')) return byNeedle('miraflores');
  if (name.includes('surco') || name.includes('polo')) return byNeedle('surco') || byNeedle('polo');
  if (name.includes('chincha')) return byNeedle('chincha');
  if (name.includes('paracas')) return byNeedle('paracas');
  if (name.includes('villa 1')) return byNeedle('villa 1') || byNeedle('ucsur');
  if (name.includes('villa 2')) return byNeedle('villa 1') || byNeedle('ucsur');
  if (name.includes('20kw')) return byNeedle('grifo kio') || byNeedle('panamericana sur km 25');
  if (name.includes('60kw')) return byNeedle('grifosa') || byNeedle('km87') || byNeedle('panamericana sur km87');
  return null;
}

function isExcludedLabText(value = '') {
  const normalized = normalizeLoose(value);
  return normalized === 'lab1'
    || normalized === 'lab 1'
    || normalized === 'lab2'
    || normalized === 'lab 2'
    || normalized.includes('software lab');
}

function shouldExcludePlaza(plaza = {}) {
  return isExcludedLabText(plaza?.name)
    || isExcludedLabText(plaza?.merchantId)
    || isExcludedLabText(plaza?.merchantName)
    || isExcludedLabText(plaza?.address);
}

function isExcludedStationName(name = '') {
  return isExcludedLabText(name);
}

function shouldExcludeStation(station = {}) {
  return isExcludedStationName(station?.name)
    || isExcludedLabText(station?.merchantId)
    || isExcludedLabText(station?.merchantName)
    || isExcludedLabText(station?.plazaName)
    || isExcludedLabText(station?.locationText);
}

const STATION_OVERRIDES = {
  '60KW - EVinka': {
    merchantId: 'RZ - Grifosa',
    merchantName: 'RZ - Grifosa',
    plazaId: 'a9dxxzk',
    plazaName: 'PetroPerú - Grifosa',
    address: 'Panamericana sur km87',
    latitude: -12.682766634118785,
    longitude: -76.64992972883582,
    imageUrl: 'https://storage.googleapis.com/evinka-connect-plazaimage-abls9v6f1rixul3ag4ozpxdgoxbeg55t/d2ee056aff8c488d8b006ec3ec74ccfc/uploadfile',
    inferredLocation: false,
  },
  'Cargador 1 - villa 1 ': {
    merchantId: 'Universidad Cientifica del Sur',
    merchantName: 'Universidad Cientifica del Sur',
    plazaId: 'ayq7mub',
    plazaName: 'Villa 1 - ucsur',
    address: 'Campus villa 1 - ucsur',
    latitude: -12.219784701760119,
    longitude: -76.97811240238599,
    imageUrl: 'https://storage.googleapis.com/evinka-connect-plazaimage-abls9v6f1rixul3ag4ozpxdgoxbeg55t/ayq7mub',
    inferredLocation: false,
  },
  'Cargador 1 - Villa 2': {
    merchantId: 'Universidad Cientifica del Sur',
    merchantName: 'Universidad Cientifica del Sur',
    plazaId: 'derived-villa-2-ucsur',
    plazaName: 'Villa 2 - ucsur',
    address: 'Campus villa 2 - ucsur',
    latitude: -12.22197123051052,
    longitude: -76.9770693694316,
    imageUrl: '',
    inferredLocation: false,
  },
  Paracas_Casa_Andina: {
    merchantId: 'EVINKA',
    merchantName: 'EVINKA',
    plazaName: 'Casa Andina Paracas',
    address: 'KM 18.5 de la Autopista Pisco Paracas, Paracas, Ica, Perú',
    latitude: -13.80531,
    longitude: -76.24541,
  },
};

function applyStationOverrides(station) {
  return {
    ...station,
    ...(STATION_OVERRIDES[station.name] || {}),
  };
}

function addPlazas(data) {
  for (const plaza of data?.plazas || data || []) {
    const normalizedPlaza = {
      id: plaza.id,
      merchantId: plaza.merchantId,
      merchantName: merchantNiceName(plaza.merchantId),
      name: plaza.displayName,
      address: plaza.address || '',
      latitude: plaza.latitude,
      longitude: plaza.longitude,
      imageUrl: plaza.downloadUrl || plaza.imageUrl || '',
    };
    if (shouldExcludePlaza(normalizedPlaza)) continue;
    plazaMap.set(plaza.id, normalizedPlaza);
  }
}

function addStationDigests(data) {
  for (const station of data || []) {
    if (station?.id) stationDigestMap.set(station.id, { id: station.id, name: station.displayName || station.id });
  }
}

function addStations(data) {
  for (const station of data?.stations || []) {
    stationMap.set(station.id, {
      id: station.id,
      name: station.displayName,
      merchantId: station.merchantId,
      merchantName: merchantNiceName(station.merchantId),
      plazaId: station.plazaId,
      vendor: station.chargePointVendor,
      model: station.chargePointModel,
      firmware: station.firmwareVersion,
      serialNumber: station.serialNumber || '',
      locationText: station.location || '',
      lastHeartbeatTime: station.lastHeartbeatTime,
      lastBootTime: station.lastBootTime,
      actualHeartbeatInterval: station.actualHeartbeatInterval,
      connectors: (station.connectorStates || []).map(connector => ({
        connectorId: connector.connectorId,
        type: connector.type || '',
        errorCode: connector.errorCode || '',
        status: connector.status || 'Unknown',
        tone: statusTone(connector.status),
        updatedAt: connector.updatedAt || null,
      })),
    });
  }
}

function addChargingAlarms(data) {
  for (const alarm of data?.exChargingAlarms || []) {
    alerts.push({
      kind: 'charging_alarm',
      title: alarm.stationDisplayname || 'Charging alarm',
      stationId: alarm.stationId,
      connectorId: alarm.connector || alarm.connectorId || null,
      status: 'charging',
      detail: alarm.reason || alarm.alarmCode || 'Alarma de carga activa',
      createdAt: alarm.createdAt || null,
    });
  }
}

function addGeneralAlarms(data) {
  for (const alarm of data?.exGeneralAlarms || []) {
    alerts.push({
      kind: 'general_alarm',
      title: alarm.stationDisplayname || 'General alarm',
      stationId: alarm.stationId,
      connectorId: alarm.connector || null,
      status: 'faulted',
      detail: alarm.reason || alarm.message || 'Alarma general activa',
      createdAt: alarm.createdAt || null,
    });
  }
}

function addModuleStatuses(data) {
  for (const item of data?.exModuleStatuses || []) {
    const activeFlags = (item.eachBitKeys || []).filter((_, idx) => item.eachBitValues?.[idx]);
    alerts.push({
      kind: 'module_status',
      title: 'Módulo anómalo',
      stationId: item.stationId,
      connectorId: item.connector,
      status: 'faulted',
      detail: activeFlags.join(', ') || 'Estado anómalo del módulo',
      createdAt: item.updatedAt || item.createdAt || null,
    });
  }
}

function addFaultPrompts(data) {
  for (const fault of data?.faultPrompts || []) {
    alerts.push({
      kind: 'fault_prompt',
      title: fault.abbreviation || 'Fault prompt',
      stationId: fault.stationId,
      connectorId: null,
      status: 'faulted',
      detail: fault.description || 'Sin detalle',
      createdAt: fault.createdAt || null,
    });
  }
}

function addTransactions(data) {
  for (const row of data?.transactionStatistics || []) {
    transactions.push(row);
  }
}

const liveSnapshot = await loadLiveSnapshot();

if (liveSnapshot) {
  operator = liveSnapshot.userinfo?.email || operator;
  if (liveSnapshot.overview?.totalStation != null) overview = liveSnapshot.overview;
  addPlazas(liveSnapshot.plazas);
  addStationDigests(liveSnapshot.stationdigests);
  addStations(liveSnapshot.stations);
  addChargingAlarms(liveSnapshot.chargingAlarms);
  addGeneralAlarms(liveSnapshot.generalAlarms);
  addModuleStatuses(liveSnapshot.moduleStatuses);
  addFaultPrompts(liveSnapshot.faultPrompts);
  addTransactions(liveSnapshot.transactionstatistics);
} else for (const name of FILES) {
  const filePath = await ensureHar(name);
  const har = JSON.parse(await fs.readFile(filePath, 'utf8'));
  const entries = har?.log?.entries || [];

  for (const entry of findEntries(entries, url => url.includes('/oauth2/userinfo'))) {
    const data = parseJson(entry);
    if (data?.email) operator = data.email;
  }

  for (const entry of findEntries(entries, url => url.includes('/stationoverview'))) {
    const data = parseJson(entry);
    if (data?.totalStation != null) overview = data;
  }

  for (const entry of findEntries(entries, url => /\/plazas\?/.test(url))) {
    const data = parseJson(entry);
    for (const plaza of data?.plazas || []) {
      const normalizedPlaza = {
        id: plaza.id,
        merchantId: plaza.merchantId,
        merchantName: merchantNiceName(plaza.merchantId),
        name: plaza.displayName,
        address: plaza.address || '',
        latitude: plaza.latitude,
        longitude: plaza.longitude,
        imageUrl: plaza.downloadUrl || plaza.imageUrl || '',
      };
      if (shouldExcludePlaza(normalizedPlaza)) continue;
      plazaMap.set(plaza.id, normalizedPlaza);
    }
  }

  for (const entry of findEntries(entries, url => url.includes('/stationdigests'))) {
    const data = parseJson(entry);
    for (const station of data || []) {
      if (station?.id) stationDigestMap.set(station.id, { id: station.id, name: station.displayName || station.id });
    }
  }

  for (const entry of findEntries(entries, url => /\/stations\?/.test(url) && !url.includes('transactionstatistics') && !url.includes('/transactions'))) {
    const data = parseJson(entry);
    for (const station of data?.stations || []) {
      stationMap.set(station.id, {
        id: station.id,
        name: station.displayName,
        merchantId: station.merchantId,
        merchantName: merchantNiceName(station.merchantId),
        plazaId: station.plazaId,
        vendor: station.chargePointVendor,
        model: station.chargePointModel,
        firmware: station.firmwareVersion,
        serialNumber: station.serialNumber || '',
        locationText: station.location || '',
        lastHeartbeatTime: station.lastHeartbeatTime,
        lastBootTime: station.lastBootTime,
        actualHeartbeatInterval: station.actualHeartbeatInterval,
        connectors: (station.connectorStates || []).map(connector => ({
          connectorId: connector.connectorId,
          type: connector.type || '',
          errorCode: connector.errorCode || '',
          status: connector.status || 'Unknown',
          tone: statusTone(connector.status),
          updatedAt: connector.updatedAt || null,
        })),
      });
    }
  }

  for (const entry of findEntries(entries, url => url.includes('/chargingAlarms'))) {
    const data = parseJson(entry);
    for (const alarm of data?.exChargingAlarms || []) {
      alerts.push({
        kind: 'charging_alarm',
        title: alarm.stationDisplayname || 'Charging alarm',
        stationId: alarm.stationId,
        connectorId: alarm.connector || alarm.connectorId || null,
        status: 'charging',
        detail: alarm.reason || alarm.alarmCode || 'Alarma de carga activa',
        createdAt: alarm.createdAt || null,
      });
    }
  }

  for (const entry of findEntries(entries, url => url.includes('/generalAlarms'))) {
    const data = parseJson(entry);
    for (const alarm of data?.exGeneralAlarms || []) {
      alerts.push({
        kind: 'general_alarm',
        title: alarm.stationDisplayname || 'General alarm',
        stationId: alarm.stationId,
        connectorId: alarm.connector || null,
        status: 'faulted',
        detail: alarm.reason || alarm.message || 'Alarma general activa',
        createdAt: alarm.createdAt || null,
      });
    }
  }

  for (const entry of findEntries(entries, url => url.includes('/moduleStatuses'))) {
    const data = parseJson(entry);
    for (const item of data?.exModuleStatuses || []) {
      const activeFlags = (item.eachBitKeys || []).filter((_, idx) => item.eachBitValues?.[idx]);
      alerts.push({
        kind: 'module_status',
        title: 'Módulo anómalo',
        stationId: item.stationId,
        connectorId: item.connector,
        status: 'faulted',
        detail: activeFlags.join(', ') || 'Estado anómalo del módulo',
        createdAt: item.updatedAt || item.createdAt || null,
      });
    }
  }

  for (const entry of findEntries(entries, url => url.includes('/faultPrompts'))) {
    const data = parseJson(entry);
    for (const fault of data?.faultPrompts || []) {
      alerts.push({
        kind: 'fault_prompt',
        title: fault.abbreviation || 'Fault prompt',
        stationId: fault.stationId,
        connectorId: null,
        status: 'faulted',
        detail: fault.description || 'Sin detalle',
        createdAt: fault.createdAt || null,
      });
    }
  }

  for (const entry of findEntries(entries, url => url.includes('/transactionstatistics'))) {
    const data = parseJson(entry);
    for (const row of data?.transactionStatistics || []) {
      transactions.push(row);
    }
  }
}

const plazas = [...plazaMap.values()].sort((a, b) => a.name.localeCompare(b.name));
const faultedStationIds = new Set(
  alerts
    .filter((item) => item?.stationId && String(item.status || '').toLowerCase() === 'faulted')
    .map((item) => item.stationId)
);

const stations = [...stationMap.values()].filter(station => !shouldExcludeStation(station)).map((station, index) => {
  const plaza = plazaMap.get(station.plazaId) || inferStationPlaza(station.name, plazas);
  const primaryConnector = pickPrimaryConnector(station.connectors || []);
  const recentHeartbeat = hasRecentHeartbeat(station.lastHeartbeatTime);

  let computedTone = primaryConnector?.tone || 'available';
  let summaryStatus = primaryConnector?.status || 'Disponible';

  if (!recentHeartbeat) {
    computedTone = 'offline';
    summaryStatus = station.lastHeartbeatTime ? 'Offline por heartbeat vencido' : 'Offline sin heartbeat';
  } else if (faultedStationIds.has(station.id)) {
    computedTone = 'faulted';
    summaryStatus = 'Fault activo';
  }

  return applyStationOverrides({
    ...station,
    plazaName: plaza?.name || station.plazaId,
    address: plaza?.address || '',
    latitude: Number.isFinite(plaza?.latitude) ? Number(plaza.latitude) : null,
    longitude: Number.isFinite(plaza?.longitude) ? Number(plaza.longitude) : null,
    imageUrl: plaza?.imageUrl || '',
    tone: computedTone,
    summaryStatus,
    heartbeatLabel: formatDate(station.lastHeartbeatTime),
    bootLabel: formatDate(station.lastBootTime),
    inferredLocation: !plazaMap.get(station.plazaId) && !!plaza,
  });
});

for (const [id, digest] of stationDigestMap.entries()) {
  if (isExcludedStationName(digest.name)) continue;
  if (stations.some(station => station.id === id)) continue;
  const plaza = inferStationPlaza(digest.name, plazas);
  const index = stations.length;
  stations.push(applyStationOverrides({
    id,
    name: digest.name,
    merchantId: plaza?.merchantId || '',
    merchantName: plaza?.merchantName || 'Pendiente de clasificar',
    plazaId: plaza?.id || '',
    plazaName: plaza?.name || 'Ubicación por confirmar',
    address: plaza?.address || '',
    latitude: Number.isFinite(plaza?.latitude) ? Number(plaza.latitude) : null,
    longitude: Number.isFinite(plaza?.longitude) ? Number(plaza.longitude) : null,
    imageUrl: plaza?.imageUrl || '',
    vendor: '',
    model: '',
    firmware: '',
    serialNumber: '',
    locationText: '',
    lastHeartbeatTime: null,
    lastBootTime: null,
    actualHeartbeatInterval: '',
    connectors: [],
    tone: 'offline',
    summaryStatus: 'Offline · solo detectado en digest',
    heartbeatLabel: null,
    bootLabel: null,
    inferredLocation: !!plaza,
  }));
}

stations.sort((a, b) => a.name.localeCompare(b.name));

const allPlazas = [...plazas];
const knownPlazaNames = new Set(allPlazas.map((plaza) => plaza.name));
for (const station of stations) {
  if (!station.plazaName || knownPlazaNames.has(station.plazaName)) continue;
  allPlazas.push({
    id: station.plazaId || `derived-${normalizeLoose(station.plazaName).replace(/\s+/g, '-')}`,
    merchantId: station.merchantId || '',
    merchantName: station.merchantName || 'EVINKA',
    name: station.plazaName,
    address: station.address || '',
    latitude: station.latitude ?? null,
    longitude: station.longitude ?? null,
    imageUrl: station.imageUrl || '',
  });
  knownPlazaNames.add(station.plazaName);
}
allPlazas.sort((a, b) => a.name.localeCompare(b.name));

const offlineStations = stations.filter(station => station.tone === 'offline');
for (const station of offlineStations) {
  incidents.push({
    title: station.name,
    location: station.locationText || station.address,
    heartbeat: station.heartbeatLabel,
    boot: station.bootLabel,
    status: station.summaryStatus,
  });
}

const reportByRef = new Map();
for (const tx of transactions) {
  const key = tx.idRef || 'Sin referencia';
  const current = reportByRef.get(key) || {
    idRef: key,
    transactionCount: 0,
    energyCharged: 0,
    feesCollected: 0,
    reductionOfCarbonEmissions: 0,
  };
  current.transactionCount += Number(tx.transactionCount || 0);
  current.energyCharged += Number(tx.energyCharged || 0);
  current.feesCollected += Number(tx.feesCollected || 0);
  current.reductionOfCarbonEmissions += Number(tx.reductionOfCarbonEmissions || 0);
  reportByRef.set(key, current);
}

const reports = [...reportByRef.values()]
  .sort((a, b) => b.feesCollected - a.feesCollected)
  .slice(0, 8)
  .map(item => ({
    ...item,
    energyCharged: Number(item.energyCharged.toFixed(2)),
    feesCollected: Number(item.feesCollected.toFixed(2)),
    reductionOfCarbonEmissions: Number(item.reductionOfCarbonEmissions.toFixed(2)),
  }));

const totals = {
  stations: stations.length,
  connectors: stations.reduce((acc, station) => acc + (station.connectors?.length || 0), 0),
  available: stations.filter(station => station.tone === 'available').length,
  offline: stations.filter(station => station.tone === 'offline').length,
  charging: stations.filter(station => station.tone === 'charging').length,
  preparing: stations.filter(station => station.tone === 'preparing').length,
  faulted: stations.filter(station => station.tone === 'faulted').length,
};

const recentHeartbeatStations = stations.filter((station) => hasRecentHeartbeat(station.lastHeartbeatTime));
const visibleStationIds = new Set(stations.map(station => station.id));

const payload = {
  generatedAt: new Date().toISOString(),
  operator: operator || 'julio.campos@evinka.tech',
  refreshSeconds: 30,
  status: recentHeartbeatStations.length ? 'Activo' : 'Snapshot desactualizado',
  totals,
  plazas: allPlazas,
  stations,
  incidents,
  alerts: alerts
    .filter(item => !item.stationId || visibleStationIds.has(item.stationId))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 20)
    .map(item => ({ ...item, createdLabel: formatDate(item.createdAt) })),
  reports,
};

await ensureDir(OUT_DIR);
const output = JSON.stringify(payload, null, 2);
const localPath = path.join(OUT_DIR, 'overview-data.json');
const servedPath = '/var/www/status.evinka.net/data/overview-data.json';
await fs.writeFile(localPath, output);
await fs.writeFile(servedPath, output);
console.log(`Wrote ${localPath}`);
console.log(`Wrote ${servedPath}`);
