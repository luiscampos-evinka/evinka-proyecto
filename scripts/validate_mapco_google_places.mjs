import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const DATASET = '/root/.openclaw/workspace/apps/mapco-web/public/data/places-colombia-multicity.json';
const OUT_DIR = '/root/.openclaw/workspace/deliverables';
const SEARCH_API_URL = 'https://places.googleapis.com/v1/places:searchText';
const SEARCH_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.googleMapsUri',
  'places.businessStatus',
  'places.primaryType',
  'places.primaryTypeDisplayName',
].join(',');
const DETAILS_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'googleMapsUri',
  'businessStatus',
  'primaryType',
  'primaryTypeDisplayName',
  'nationalPhoneNumber',
  'websiteUri',
  'regularOpeningHours',
  'shortFormattedAddress',
].join(',');

function parseEnv(text) {
  const env = {};
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    env[key] = value;
  }
  return env;
}

function normalize(text = '') {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(text = '') {
  return new Set(normalize(text).split(' ').filter(Boolean));
}

function jaccard(a, b) {
  const aa = tokens(a);
  const bb = tokens(b);
  if (!aa.size || !bb.size) return 0;
  let inter = 0;
  for (const t of aa) if (bb.has(t)) inter += 1;
  const union = new Set([...aa, ...bb]).size;
  return union ? inter / union : 0;
}

function havKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function priorityRank(priority) {
  if (priority === 'atacar_ya') return 3;
  if (priority === 'revisar') return 2;
  return 1;
}

function categoryHint(row) {
  const map = {
    'Parqueadero público': 'parking',
    'Clínica / hospital': 'hospital',
    'Centro comercial / strip mall': 'shopping_mall',
    'Hotel': 'hotel',
    'Universidad': 'university',
    'Supermercado': 'supermarket',
    'Concesionario': 'car_dealer',
    'Grifo / estación de servicio': 'gas_station',
  };
  return map[row.category] || '';
}

function buildQuery(row) {
  const base = row.canonicalName || row.name || row.operator;
  const address = row.address && !/^(Bogota|Bogotá|Medellin|Medellín|Cali)(, Colombia)?$/i.test(row.address) ? row.address : row.city;
  return `${base}, ${address}, Colombia`;
}

function biasCircle(row) {
  if (!row.lat || !row.lng) return undefined;
  return {
    circle: {
      center: { latitude: Number(row.lat), longitude: Number(row.lng) },
      radius: 2500,
    },
  };
}

function chooseBestCandidate(row, places = []) {
  const sourceName = row.canonicalName || row.name || row.operator || '';
  const scored = places.map((place) => {
    const placeName = place.displayName?.text || '';
    const nameScore = jaccard(sourceName, placeName);
    const addrScore = jaccard(row.address || row.city || '', place.formattedAddress || '');
    let distanceScore = 0;
    let distanceKm = null;
    const plat = place.location?.latitude;
    const plng = place.location?.longitude;
    if (row.lat && row.lng && plat && plng) {
      distanceKm = havKm(Number(row.lat), Number(row.lng), plat, plng);
      if (distanceKm <= 0.15) distanceScore = 1;
      else if (distanceKm <= 0.5) distanceScore = 0.7;
      else if (distanceKm <= 1.5) distanceScore = 0.4;
      else distanceScore = 0.1;
    }
    const total = (nameScore * 0.6) + (addrScore * 0.2) + (distanceScore * 0.2);
    return { place, total, nameScore, addrScore, distanceKm };
  }).sort((a, b) => b.total - a.total);

  const best = scored[0];
  if (!best) return { status: 'no_match', confidence: 0, candidates: [] };

  let status = 'ambiguous';
  if (best.total >= 0.72) status = 'validated';
  else if (best.total < 0.42) status = 'not_found';

  return {
    status,
    confidence: Number(best.total.toFixed(3)),
    best: {
      id: best.place.id,
      displayName: best.place.displayName?.text || null,
      formattedAddress: best.place.formattedAddress || null,
      googleMapsUri: best.place.googleMapsUri || null,
      businessStatus: best.place.businessStatus || null,
      primaryType: best.place.primaryType || null,
      primaryTypeDisplayName: best.place.primaryTypeDisplayName?.text || null,
      distanceKm: best.distanceKm == null ? null : Number(best.distanceKm.toFixed(3)),
      nameScore: Number(best.nameScore.toFixed(3)),
      addressScore: Number(best.addrScore.toFixed(3)),
    },
    candidates: scored.slice(0, 3).map((item) => ({
      id: item.place.id,
      displayName: item.place.displayName?.text || null,
      formattedAddress: item.place.formattedAddress || null,
      googleMapsUri: item.place.googleMapsUri || null,
      businessStatus: item.place.businessStatus || null,
      score: Number(item.total.toFixed(3)),
    })),
  };
}

async function loadApiKey() {
  if (process.env.GOOGLE_MAPS_API_KEY) return process.env.GOOGLE_MAPS_API_KEY;
  if (process.env.GOOGLE_PLACES_API_KEY) return process.env.GOOGLE_PLACES_API_KEY;
  try {
    const envText = await readFile('/root/.openclaw/workspace/.env', 'utf8');
    const env = parseEnv(envText);
    return env.GOOGLE_MAPS_API_KEY || env.GOOGLE_PLACES_API_KEY || '';
  } catch {
    return '';
  }
}

async function searchPlace(apiKey, row) {
  const body = {
    textQuery: buildQuery(row),
    languageCode: 'es',
    regionCode: 'CO',
    maxResultCount: 5,
  };
  const hint = categoryHint(row);
  if (hint) body.includedType = hint;
  const bias = biasCircle(row);
  if (bias) body.locationBias = bias;

  const res = await fetch(SEARCH_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': SEARCH_FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Places ${res.status}: ${text.slice(0, 500)}`);
  }

  return res.json();
}

async function fetchPlaceDetails(apiKey, placeId) {
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': DETAILS_FIELD_MASK,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Place Details ${res.status}: ${text.slice(0, 500)}`);
  }

  return res.json();
}

function selectRows(rows, limit) {
  const sorted = rows
    .sort((a, b) => {
      const pa = priorityRank(a.evinkaPriority);
      const pb = priorityRank(b.evinkaPriority);
      return pb - pa || (b.superPremiumScore || 0) - (a.superPremiumScore || 0);
    });
  return Number.isFinite(limit) ? sorted.slice(0, limit) : sorted;
}

function parseArgs(argv) {
  const options = { limit: 25, city: '', concurrency: 4, outFile: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--all') options.limit = Infinity;
    else if (arg === '--city') { options.city = argv[i + 1] || ''; i += 1; }
    else if (arg === '--concurrency') { options.concurrency = Math.max(1, Number(argv[i + 1] || 4)); i += 1; }
    else if (arg === '--out') { options.outFile = argv[i + 1] || ''; i += 1; }
    else if (/^\d+$/.test(arg)) options.limit = Number(arg);
  }
  return options;
}

async function mapPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let index = 0;
  async function runner() {
    while (true) {
      const current = index;
      index += 1;
      if (current >= items.length) return;
      results[current] = await worker(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, () => runner()));
  return results;
}

async function main() {
  const apiKey = await loadApiKey();
  if (!apiKey) {
    throw new Error('Falta GOOGLE_MAPS_API_KEY o GOOGLE_PLACES_API_KEY en el entorno.');
  }

  const options = parseArgs(process.argv.slice(2));
  const rows = JSON.parse(await readFile(DATASET, 'utf8'));
  const scoped = options.city ? rows.filter((row) => row.city === options.city) : rows;
  const selected = selectRows(scoped, options.limit);
  const results = await mapPool(selected, options.concurrency, async (row, idx) => {
    const raw = await searchPlace(apiKey, row);
    const match = chooseBestCandidate(row, raw.places || []);
    if (match.best?.id && ['validated', 'ambiguous'].includes(match.status)) {
      try {
        const details = await fetchPlaceDetails(apiKey, match.best.id);
        match.best = {
          ...match.best,
          formattedAddress: details.formattedAddress || match.best.formattedAddress,
          shortFormattedAddress: details.shortFormattedAddress || null,
          googleMapsUri: details.googleMapsUri || match.best.googleMapsUri,
          businessStatus: details.businessStatus || match.best.businessStatus,
          primaryType: details.primaryType || match.best.primaryType,
          primaryTypeDisplayName: details.primaryTypeDisplayName?.text || match.best.primaryTypeDisplayName,
          nationalPhoneNumber: details.nationalPhoneNumber || null,
          websiteUri: details.websiteUri || null,
          regularOpeningHours: details.regularOpeningHours || null,
        };
      } catch (error) {
        match.detailsError = error.message || String(error);
      }
    }
    if ((idx + 1) % 100 === 0) console.log(`processed ${idx + 1}/${selected.length}`);
    return {
      id: row.id,
      city: row.city,
      category: row.category,
      sourceName: row.canonicalName || row.name,
      sourceAddress: row.address,
      evinkaPriority: row.evinkaPriority,
      superPremiumTier: row.superPremiumTier,
      googleValidation: match,
    };
  });

  const summary = results.reduce((acc, item) => {
    const key = item.googleValidation.status;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const scopeSlug = options.city ? options.city.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'multicity';
  const outFile = options.outFile || path.join(OUT_DIR, `mapco-google-validation-${scopeSlug}.json`);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(outFile, JSON.stringify({ generatedAt: new Date().toISOString(), city: options.city || null, totalRows: selected.length, summary, results }, null, 2));
  console.log(JSON.stringify({ outFile, city: options.city || null, totalRows: selected.length, summary }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
