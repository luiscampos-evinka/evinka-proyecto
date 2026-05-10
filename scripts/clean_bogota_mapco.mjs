import { readFile, writeFile } from 'node:fs/promises';

const RAW_PATH = '/root/.openclaw/workspace/apps/mapco-web/public/data/places.json';
const RAW_SNAPSHOT_PATH = '/root/.openclaw/workspace/apps/mapco-web/public/data/places-raw.json';
const CLEAN_PATH = '/root/.openclaw/workspace/apps/mapco-web/public/data/places-clean.json';
const SUMMARY_PATH = '/root/.openclaw/workspace/apps/mapco-web/public/data/summary-bogota-clean.json';

const RULES = {
  'Universidad': { radius: 120, mode: 'campus' },
  'Clínica / hospital': { radius: 120, mode: 'campus' },
  'Centro comercial / strip mall': { radius: 140, mode: 'campus' },
  'Hotel': { radius: 90, mode: 'campus' },
  'Concesionario': { radius: 60, mode: 'branch' },
  'Parqueadero público': { radius: 40, mode: 'branch' },
  'Grifo / estación de servicio': { radius: 35, mode: 'branch' },
  'Supermercado': { radius: 45, mode: 'branch' },
  'Cadena comida rápida': { radius: 30, mode: 'branch' },
  'Cadena café/restaurante': { radius: 25, mode: 'branch' },
};

const STOPWORDS = new Set(['de','del','la','las','el','los','y','en','a','por','para','un','una','bogota','bogotá','colombia']);
const SUBUNIT_WORDS = [
  'facultad','bloque','torre','edificio','pabellon','pabellón','campus','sede','porteria','portería','entrada','auditorio','biblioteca','modulo','módulo','laboratorio','ala','piso','oficina','consultorio','urgencias','cafeteria','cafetería'
];

function stripAccents(text) {
  return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalize(text) {
  return stripAccents(text)
    .toLowerCase()
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(text) {
  return new Set(normalize(text).split(' ').filter(Boolean).filter((t) => !STOPWORDS.has(t)));
}

function containsSubunit(text) {
  const n = normalize(text);
  return SUBUNIT_WORDS.some((word) => n.includes(word));
}

function baseCampusName(row) {
  let value = normalize([row.name, row.operator, row.brandGroup].filter(Boolean).join(' '));
  for (const word of SUBUNIT_WORDS) value = value.replace(new RegExp(`\\b${word}\\b`, 'g'), ' ');
  value = value.replace(/\basab\b/g, ' academia superior de artes de bogota asab ');
  value = value.replace(/\s+/g, ' ').trim();
  return value;
}

function baseBranchName(row) {
  return normalize([row.name, row.operator, row.brandGroup].filter(Boolean).join(' '));
}

function normalizedAddress(row) {
  return normalize(row.address || '');
}

function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad((b.lat || 0) - (a.lat || 0));
  const dLng = toRad((b.lng || 0) - (a.lng || 0));
  const lat1 = toRad(a.lat || 0);
  const lat2 = toRad(b.lat || 0);
  const s = Math.sin(dLat/2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng/2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function jaccard(setA, setB) {
  if (!setA.size || !setB.size) return 0;
  let inter = 0;
  for (const item of setA) if (setB.has(item)) inter += 1;
  const union = new Set([...setA, ...setB]).size;
  return union ? inter / union : 0;
}

function candidateScore(row) {
  const name = String(row.name || '');
  let score = name.length;
  if (containsSubunit(name)) score -= 18;
  if (normalize(name) === normalize(row.category || '')) score -= 20;
  if (row.address && row.address !== 'Bogotá, Colombia') score += 8;
  if (row.osmType === 'way' || row.osmType === 'relation') score += 4;
  return score;
}

function chooseCanonical(members) {
  return [...members].sort((a,b) => candidateScore(b) - candidateScore(a) || String(b.name).length - String(a.name).length)[0];
}

function confidenceFor(members, mode) {
  if (members.length >= 3) return 'high';
  if (mode === 'campus' && members.length >= 2) return 'high';
  if (members.length === 2) return 'medium';
  return 'medium';
}

function makeGroupKey(row, mode) {
  return mode === 'campus' ? baseCampusName(row) : baseBranchName(row);
}

function rowsMatch(row, group, rule) {
  const dist = distanceMeters(row, group.centroid);
  if (dist > rule.radius) return false;

  const rowAddress = normalizedAddress(row);
  const groupAddress = group.addressKey;
  const sameAddress = rowAddress && groupAddress && rowAddress === groupAddress;
  const rowBase = makeGroupKey(row, rule.mode);
  const groupBase = group.baseKey;
  const rowTokens = tokenSet(rowBase);
  const groupTokens = tokenSet(groupBase);
  const similarity = jaccard(rowTokens, groupTokens);

  if (rule.mode === 'campus') {
    if (sameAddress && similarity >= 0.22) return true;
    if (similarity >= 0.58) return true;
    if (sameAddress && (containsSubunit(row.name) || group.hasSubunit)) return true;
    return false;
  }

  if (sameAddress && rowBase === groupBase) return true;
  if (sameAddress && similarity >= 0.86) return true;
  if (rowBase === groupBase && dist <= Math.max(20, rule.radius * 0.75)) return true;
  return false;
}

function mergeIntoGroup(row, group, rule) {
  group.members.push(row);
  group.hasSubunit = group.hasSubunit || containsSubunit(row.name);
  const n = group.members.length;
  group.centroid = {
    lat: ((group.centroid.lat * (n - 1)) + row.lat) / n,
    lng: ((group.centroid.lng * (n - 1)) + row.lng) / n,
  };
  if (!group.addressKey && normalizedAddress(row)) group.addressKey = normalizedAddress(row);
}

function buildCanonical(group, rule) {
  const canonical = chooseCanonical(group.members);
  const aliases = [...new Set(group.members.map((m) => m.name).filter(Boolean))].sort((a,b) => a.localeCompare(b,'es'));
  const rawIds = group.members.map((m) => m.id);
  return {
    ...canonical,
    id: `canon-${canonical.id}`,
    lat: Number(group.centroid.lat.toFixed(7)),
    lng: Number(group.centroid.lng.toFixed(7)),
    rawCount: group.members.length,
    aliasCount: aliases.length,
    aliases,
    rawIds,
    canonicalName: canonical.name,
    confidence: confidenceFor(group.members, rule.mode),
    consolidationMode: rule.mode,
    hasSubunits: group.members.some((m) => containsSubunit(m.name)),
    canonicalOperator: canonical.operator,
    source: 'OpenStreetMap · curado',
  };
}

const raw = JSON.parse(await readFile(RAW_PATH, 'utf8'));
await writeFile(RAW_SNAPSHOT_PATH, JSON.stringify(raw, null, 2));

const byCategory = new Map();
for (const row of raw) {
  if (!byCategory.has(row.category)) byCategory.set(row.category, []);
  byCategory.get(row.category).push(row);
}

const clean = [];
const summary = [];

for (const [category, rows] of byCategory.entries()) {
  const rule = RULES[category] || { radius: 35, mode: 'branch' };
  const groups = [];

  for (const row of rows) {
    let matched = null;
    let bestDistance = Infinity;
    for (const group of groups) {
      if (!rowsMatch(row, group, rule)) continue;
      const dist = distanceMeters(row, group.centroid);
      if (dist < bestDistance) {
        bestDistance = dist;
        matched = group;
      }
    }
    if (matched) {
      mergeIntoGroup(row, matched, rule);
    } else {
      groups.push({
        members: [row],
        centroid: { lat: row.lat, lng: row.lng },
        baseKey: makeGroupKey(row, rule.mode),
        addressKey: normalizedAddress(row),
        hasSubunit: containsSubunit(row.name),
      });
    }
  }

  const canonRows = groups.map((group) => buildCanonical(group, rule));
  clean.push(...canonRows);
  summary.push({
    category,
    raw: rows.length,
    canonical: canonRows.length,
    mergedAway: rows.length - canonRows.length,
  });
}

clean.sort((a,b) => a.category.localeCompare(b.category,'es') || a.canonicalName.localeCompare(b.canonicalName,'es'));

await writeFile(CLEAN_PATH, JSON.stringify(clean, null, 2));
await writeFile(SUMMARY_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), rawTotal: raw.length, canonicalTotal: clean.length, summary }, null, 2));

console.log(JSON.stringify({ rawTotal: raw.length, canonicalTotal: clean.length, summary }, null, 2));
