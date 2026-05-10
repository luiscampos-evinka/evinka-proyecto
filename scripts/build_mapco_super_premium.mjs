import { readFile, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';

const INPUT = '/root/.openclaw/workspace/apps/mapco-web/public/data/places-evinka-premium.json';
const DANE_XLSX = '/root/.openclaw/workspace/data/mapco-official/bogota-poblacion.xlsx';
const OUTPUT = '/root/.openclaw/workspace/apps/mapco-web/public/data/places-super-premium.json';
const SUMMARY = '/root/.openclaw/workspace/apps/mapco-web/public/data/summary-bogota-super-premium.json';
const TERRITORY = '/root/.openclaw/workspace/apps/mapco-web/public/data/bogota-territory-signals.json';

function normalize(text = '') {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/localidad\s+/g, '')
    .replace(/^upz\s+/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function decodeXml(s = '') {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseSharedStrings(xml) {
  const arr = [];
  for (const m of xml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)) {
    const text = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => decodeXml(x[1])).join('');
    arr.push(text);
  }
  return arr;
}

function colToIdx(col) {
  let n = 0;
  for (const ch of col) n = (n * 26) + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseSheet(xml, shared) {
  const rows = [];
  for (const rm of xml.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const rowNum = Number(rm[1]);
    const values = [];
    for (const cm of rm[2].matchAll(/<c\b[^>]*r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g)) {
      const col = colToIdx(cm[1]);
      const attrs = cm[2];
      const body = cm[3];
      const vm = body.match(/<v>([\s\S]*?)<\/v>/);
      const im = body.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/);
      let value = im ? decodeXml(im[1]) : (vm ? vm[1] : '');
      if (/t="s"/.test(attrs)) value = shared[Number(value)] ?? '';
      values[col] = value;
    }
    rows.push({ rowNum, values });
  }
  return rows;
}

function loadDanePopulation() {
  const shared = parseSharedStrings(execSync(`unzip -p '${DANE_XLSX}' xl/sharedStrings.xml`, { maxBuffer: 80_000_000 }).toString());
  const localRows = parseSheet(execSync(`unzip -p '${DANE_XLSX}' xl/worksheets/sheet1.xml`, { maxBuffer: 80_000_000 }).toString(), shared);
  const upzRows = parseSheet(execSync(`unzip -p '${DANE_XLSX}' xl/worksheets/sheet3.xml`, { maxBuffer: 80_000_000 }).toString(), shared);

  const localHeader = localRows.find((r) => r.values[0] === 'COD_LOC').values;
  const localTotalIdx = localHeader.indexOf('TOTAL');
  const localityPopulation = new Map();
  for (const row of localRows) {
    const v = row.values;
    if (v[0] && v[2] === 'Total' && v[3] === '2024') {
      localityPopulation.set(normalize(v[1]), {
        code: v[0],
        locality: v[1],
        total2024: Number(v[localTotalIdx] || 0),
      });
    }
  }

  const upzHeader = upzRows.find((r) => r.values[0] === 'AREA GEOGRÁFICA').values;
  const upzTotalIdx = upzHeader.indexOf('Total');
  const upzPopulation = new Map();
  for (const row of upzRows) {
    const v = row.values;
    if (v[0] && v[1] === '2024') {
      upzPopulation.set(normalize(v[0]), {
        upz: v[0],
        code: v[2],
        localityCode: v[3],
        total2024: Number(v[upzTotalIdx] || 0),
      });
    }
  }

  return { localityPopulation, upzPopulation };
}

async function fetchOverpass(level) {
  const query = `[out:json][timeout:120];area[name="Bogotá"][boundary=administrative]->.a;(relation(area.a)[admin_level=${level}][boundary=administrative];);out bb center tags;`;
  const res = await fetch('https://overpass.kumi.systems/api/interpreter', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': 'OpenClaw-EVINKA-MapCo/1.0 (contact: internal mapco build)',
    },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error(`Overpass ${level} failed: ${res.status}`);
  const json = await res.json();
  return json.elements
    .filter((el) => el.tags?.name && el.center)
    .map((el) => ({
      name: el.tags.name,
      ref: el.tags.ref || '',
      center: el.center,
      bounds: el.bounds || null,
      norm: normalize(el.tags.name),
    }));
}

function haversineKm(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const dLat = (bLat - aLat) * Math.PI / 180;
  const dLng = (bLng - aLng) * Math.PI / 180;
  const q = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(q));
}

function assignTerritory(point, territories) {
  const inside = territories.filter((t) => t.bounds && point.lat >= t.bounds.minlat && point.lat <= t.bounds.maxlat && point.lng >= t.bounds.minlon && point.lng <= t.bounds.maxlon);
  const candidates = inside.length ? inside : territories;
  return candidates
    .map((t) => ({ territory: t, d: haversineKm(point.lat, point.lng, t.center.lat, t.center.lon) }))
    .sort((a, b) => a.d - b.d)[0]?.territory || null;
}

function percentileScore(value, values, maxPoints) {
  if (!values.length || !value) return Math.round(maxPoints * 0.35);
  const sorted = [...values].sort((a, b) => a - b);
  let idx = sorted.findIndex((v) => value <= v);
  if (idx === -1) idx = sorted.length - 1;
  const pct = sorted.length === 1 ? 1 : idx / (sorted.length - 1);
  return Math.round((0.25 + (pct * 0.75)) * maxPoints);
}

function hostImportance(row) {
  if (row.category === 'Centro comercial / strip mall') return 15;
  if (row.category === 'Parqueadero público') return 15;
  if (row.category === 'Hotel') return 14;
  if (row.category === 'Concesionario') return 13;
  if (row.category === 'Universidad') return 12;
  if (row.category === 'Clínica / hospital') return 12;
  if (row.category === 'Supermercado') {
    const n = normalize([row.canonicalName, row.operator].join(' '));
    if (/\b(exito|carulla|jumbo|makro|pricesmart|olimpica|homecenter|alkosto|metro)\b/.test(n)) return 12;
    if (/\b(d1|ara|oxxo|justo y bueno|justo bueno)\b/.test(n)) return 9;
    return 8;
  }
  if (row.category === 'Grifo / estación de servicio') return 9;
  return 4;
}

function superTier(score, priority) {
  if (priority === 'descartar' || score < 45) return 'descartar';
  if (score >= 78) return 'A';
  if (score >= 62) return 'B';
  return 'C';
}

const rows = JSON.parse(await readFile(INPUT, 'utf8'));
const { localityPopulation, upzPopulation } = loadDanePopulation();
const localities = (await fetchOverpass(8)).filter((t) => t.norm.startsWith('localidad') || true)
  .map((t) => ({ ...t, cleanName: t.name.replace(/^Localidad\s+/i, '') }));
const upzs = (await fetchOverpass(9)).map((t) => ({ ...t, cleanName: t.name.replace(/^UPZ\s+/i, '') }));

for (const row of rows) {
  const locality = assignTerritory(row, localities);
  const upz = assignTerritory(row, upzs);
  row.localityName = locality?.cleanName || null;
  row.localityCode = locality?.ref || null;
  row.upzName = upz?.cleanName || null;
  row.upzCode = upz?.ref || null;
}

const localityPopValues = [...localityPopulation.values()].map((v) => v.total2024);
const upzPopValues = [...upzPopulation.values()].map((v) => v.total2024);

const upzStats = new Map();
for (const row of rows) {
  const key = row.upzName || 'sin-upz';
  const stat = upzStats.get(key) || { totalSites: 0, viableSites: 0, premiumSites: 0 };
  stat.totalSites += 1;
  if (row.publicChargingCandidate) stat.viableSites += 1;
  if (row.evinkaPremiumCandidate) stat.premiumSites += 1;
  upzStats.set(key, stat);
}
const activityValues = [...upzStats.values()].map((s) => (s.viableSites * 0.7) + (s.premiumSites * 1.3));

for (const row of rows) {
  const localityInfo = row.localityName ? localityPopulation.get(normalize(row.localityName)) : null;
  const upzInfo = row.upzName ? upzPopulation.get(normalize(row.upzName)) : null;
  const territoryStat = upzStats.get(row.upzName || 'sin-upz') || { totalSites: 0, viableSites: 0, premiumSites: 0 };
  const localityDemand = percentileScore(localityInfo?.total2024 || 0, localityPopValues, 13);
  const upzDemand = percentileScore(upzInfo?.total2024 || 0, upzPopValues, 12);
  const activityBase = (territoryStat.viableSites * 0.7) + (territoryStat.premiumSites * 1.3);
  const activityScore = percentileScore(activityBase, activityValues, 25);
  const evAffinityScore = Math.round(((row.viabilityScore || 0) / 100) * 25);
  const importanceScore = hostImportance(row);
  const newsSignalScore = 5; // neutral placeholder to avoid sesgo until curated news is added.
  const superPremiumScore = Math.max(0, Math.min(100, localityDemand + upzDemand + activityScore + evAffinityScore + importanceScore + newsSignalScore));
  const tier = superTier(superPremiumScore, row.evinkaPriority);
  row.populationDemandScore = localityDemand + upzDemand;
  row.populationDemandLocality = localityInfo?.total2024 || null;
  row.populationDemandUpz = upzInfo?.total2024 || null;
  row.activityDensityScore = activityScore;
  row.activityDensitySignals = territoryStat;
  row.evAffinityAdvancedScore = evAffinityScore;
  row.hostImportanceScore = importanceScore;
  row.newsSignalScore = newsSignalScore;
  row.newsSignalMode = 'neutral_pending_curated_news';
  row.superPremiumScore = superPremiumScore;
  row.superPremiumTier = tier;
  row.superPremiumAction = tier === 'A' ? 'Atacar ya' : tier === 'B' ? 'Revisar pronto' : tier === 'C' ? 'Observar' : 'Descartar';
}

const summary = rows.reduce((acc, row) => {
  acc[row.superPremiumTier] = (acc[row.superPremiumTier] || 0) + 1;
  if (!acc.byCategory[row.category]) acc.byCategory[row.category] = { A: 0, B: 0, C: 0, descartar: 0 };
  acc.byCategory[row.category][row.superPremiumTier] += 1;
  return acc;
}, { A: 0, B: 0, C: 0, descartar: 0, byCategory: {} });

await writeFile(OUTPUT, JSON.stringify(rows, null, 2));
await writeFile(SUMMARY, JSON.stringify({ generatedAt: new Date().toISOString(), total: rows.length, counts: summary, methodology: {
  populationDemand: 'DANE población 2024 por localidad y UPZ',
  territoryAssignment: 'bbox+centro usando límites OSM de localidades y UPZ',
  activityDensity: 'sitios viables/premium por UPZ',
  newsSignal: 'neutral_pending_curated_news',
}, }, null, 2));
await writeFile(TERRITORY, JSON.stringify({ localities, upzs, localityPopulation: [...localityPopulation.values()], upzPopulation: [...upzPopulation.values()] }, null, 2));
console.log(JSON.stringify({ total: rows.length, counts: summary }, null, 2));
