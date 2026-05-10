import { writeFile, mkdir } from 'node:fs/promises';

const OVERPASS_URL = 'https://overpass.kumi.systems/api/interpreter';
const AREA_SELECTOR = 'area["name"="Bogotá"]["boundary"="administrative"]->.a;';
const CATEGORIES = [
  {
    key: 'fuel',
    label: 'Grifo / estación de servicio',
    parkingProbability: 'medium',
    selectors: ['node["amenity"="fuel"](area.a);', 'way["amenity"="fuel"](area.a);', 'relation["amenity"="fuel"](area.a);'],
  },
  {
    key: 'mall',
    label: 'Centro comercial / strip mall',
    parkingProbability: 'high',
    selectors: ['node["shop"="mall"](area.a);', 'way["shop"="mall"](area.a);', 'relation["shop"="mall"](area.a);'],
  },
  {
    key: 'supermarket',
    label: 'Supermercado',
    parkingProbability: 'high',
    selectors: ['node["shop"="supermarket"](area.a);', 'way["shop"="supermarket"](area.a);', 'relation["shop"="supermarket"](area.a);'],
  },
  {
    key: 'fast_food',
    label: 'Cadena comida rápida',
    parkingProbability: 'medium',
    selectors: ['node["amenity"="fast_food"](area.a);', 'way["amenity"="fast_food"](area.a);', 'relation["amenity"="fast_food"](area.a);'],
  },
  {
    key: 'cafe',
    label: 'Cadena café/restaurante',
    parkingProbability: 'medium',
    selectors: ['node["amenity"="cafe"](area.a);', 'way["amenity"="cafe"](area.a);', 'relation["amenity"="cafe"](area.a);', 'node["amenity"="restaurant"](area.a);', 'way["amenity"="restaurant"](area.a);', 'relation["amenity"="restaurant"](area.a);'],
  },
  {
    key: 'health',
    label: 'Clínica / hospital',
    parkingProbability: 'high',
    selectors: ['node["amenity"="hospital"](area.a);', 'way["amenity"="hospital"](area.a);', 'relation["amenity"="hospital"](area.a);', 'node["amenity"="clinic"](area.a);', 'way["amenity"="clinic"](area.a);', 'relation["amenity"="clinic"](area.a);'],
  },
  {
    key: 'university',
    label: 'Universidad',
    parkingProbability: 'high',
    selectors: ['node["amenity"="university"](area.a);', 'way["amenity"="university"](area.a);', 'relation["amenity"="university"](area.a);'],
  },
  {
    key: 'parking',
    label: 'Parqueadero público',
    parkingProbability: 'high',
    selectors: ['node["amenity"="parking"](area.a);', 'way["amenity"="parking"](area.a);', 'relation["amenity"="parking"](area.a);'],
  },
  {
    key: 'car',
    label: 'Concesionario',
    parkingProbability: 'high',
    selectors: ['node["shop"="car"](area.a);', 'way["shop"="car"](area.a);', 'relation["shop"="car"](area.a);'],
  },
  {
    key: 'hotel',
    label: 'Hotel',
    parkingProbability: 'high',
    selectors: ['node["tourism"="hotel"](area.a);', 'way["tourism"="hotel"](area.a);', 'relation["tourism"="hotel"](area.a);'],
  },
];

function buildQuery(selectors) {
  return `[out:json][timeout:120];\n${AREA_SELECTOR}\n(\n${selectors.join('\n')}\n);\nout center tags;`;
}

async function overpass(query) {
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'User-Agent': 'MapCo EVINKA extractor/1.0',
    },
    body: 'data=' + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status} ${res.statusText}: ${await res.text()}`);
  return res.json();
}

function pickLatLon(el) {
  return {
    lat: el.lat ?? el.center?.lat ?? null,
    lng: el.lon ?? el.center?.lon ?? null,
  };
}

function titleCase(str) {
  return String(str || '').replace(/\s+/g, ' ').trim();
}

function compactAddress(tags) {
  const parts = [
    tags['addr:street'],
    tags['addr:housenumber'],
    tags['addr:suburb'],
    tags['addr:district'],
    tags['addr:city'],
  ].filter(Boolean);
  return titleCase(parts.join(', '));
}

function normalizeGroup(tags, fallbackName) {
  return titleCase(tags.brand || tags.operator || tags.network || fallbackName || 'Sin agrupar');
}

function buildName(tags, categoryLabel) {
  return titleCase(tags.name || tags.brand || tags.operator || tags.network || categoryLabel);
}

function stableId(prefix, el, index) {
  return `bog-${prefix}-${el.type}-${el.id ?? index}`;
}

function shouldKeep(row) {
  if (!row.lat || !row.lng) return false;
  if (!row.name || row.name === row.category) return false;
  return true;
}

const seen = new Set();
const rows = [];
const summary = [];

for (const category of CATEGORIES) {
  const data = await overpass(buildQuery(category.selectors));
  let kept = 0;
  for (const [index, el] of (data.elements || []).entries()) {
    const tags = el.tags || {};
    const { lat, lng } = pickLatLon(el);
    const name = buildName(tags, category.label);
    const operator = titleCase(tags.operator || tags.brand || tags.network || name);
    const address = compactAddress(tags) || titleCase(tags['addr:full'] || tags.address || tags.description || 'Bogotá, Colombia');
    const row = {
      id: stableId(category.key, el, index),
      city: 'Bogotá',
      ubigeo: '11001',
      zone: titleCase(tags['addr:suburb'] || tags['addr:district'] || tags['is_in:suburb'] || tags['is_in:city_district'] || 'Bogotá'),
      category: category.label,
      operator,
      name,
      address,
      lat,
      lng,
      parkingProbability: category.parkingProbability,
      brandGroup: normalizeGroup(tags, name),
      source: 'OpenStreetMap',
      osmType: el.type,
      osmId: el.id,
    };
    const dedupeKey = `${row.category}|${row.name.toLowerCase()}|${row.lat.toFixed(5)}|${row.lng.toFixed(5)}`;
    if (!shouldKeep(row) || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    rows.push(row);
    kept += 1;
  }
  summary.push({ category: category.label, totalRaw: (data.elements || []).length, kept });
}

rows.sort((a, b) => a.category.localeCompare(b.category, 'es') || a.brandGroup.localeCompare(b.brandGroup, 'es') || a.name.localeCompare(b.name, 'es'));

await mkdir('/root/.openclaw/workspace/apps/mapco-web/public/data', { recursive: true });
await writeFile('/root/.openclaw/workspace/apps/mapco-web/public/data/places.json', JSON.stringify(rows, null, 2));
await writeFile('/root/.openclaw/workspace/apps/mapco-web/public/data/summary-bogota.json', JSON.stringify({ generatedAt: new Date().toISOString(), total: rows.length, summary }, null, 2));

console.log(JSON.stringify({ total: rows.length, summary }, null, 2));
