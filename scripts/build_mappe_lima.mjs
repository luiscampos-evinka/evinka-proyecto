import { mkdir, writeFile } from 'node:fs/promises';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const OUTPUT = '/root/.openclaw/workspace/apps/mappe-web/public/data/places-lima.json';
const SUMMARY = '/root/.openclaw/workspace/apps/mappe-web/public/data/summary-lima.json';
const BBOX = '-12.35,-77.24,-11.72,-76.62';
const CITY = 'Lima';
const COUNTRY = 'Perú';

const CATEGORIES = [
  { key: 'fuel', label: 'Grifo / estación de servicio', parkingProbability: 'medium', selectors: ['node["amenity"="fuel"](BBOX);', 'way["amenity"="fuel"](BBOX);', 'relation["amenity"="fuel"](BBOX);'] },
  { key: 'mall', label: 'Centro comercial / strip mall', parkingProbability: 'high', selectors: ['node["shop"="mall"](BBOX);', 'way["shop"="mall"](BBOX);', 'relation["shop"="mall"](BBOX);'] },
  { key: 'supermarket', label: 'Supermercado', parkingProbability: 'high', selectors: ['node["shop"="supermarket"](BBOX);', 'way["shop"="supermarket"](BBOX);', 'relation["shop"="supermarket"](BBOX);'] },
  { key: 'fast_food', label: 'Cadena comida rápida', parkingProbability: 'medium', selectors: ['node["amenity"="fast_food"](BBOX);', 'way["amenity"="fast_food"](BBOX);', 'relation["amenity"="fast_food"](BBOX);'] },
  { key: 'cafe', label: 'Cadena café/restaurante', parkingProbability: 'medium', selectors: ['node["amenity"="cafe"](BBOX);', 'way["amenity"="cafe"](BBOX);', 'relation["amenity"="cafe"](BBOX);', 'node["amenity"="restaurant"](BBOX);', 'way["amenity"="restaurant"](BBOX);', 'relation["amenity"="restaurant"](BBOX);'] },
  { key: 'health', label: 'Clínica / hospital', parkingProbability: 'high', selectors: ['node["amenity"="hospital"](BBOX);', 'way["amenity"="hospital"](BBOX);', 'relation["amenity"="hospital"](BBOX);', 'node["amenity"="clinic"](BBOX);', 'way["amenity"="clinic"](BBOX);', 'relation["amenity"="clinic"](BBOX);'] },
  { key: 'university', label: 'Universidad', parkingProbability: 'high', selectors: ['node["amenity"="university"](BBOX);', 'way["amenity"="university"](BBOX);', 'relation["amenity"="university"](BBOX);'] },
  { key: 'parking', label: 'Parqueadero público', parkingProbability: 'high', selectors: ['node["amenity"="parking"](BBOX);', 'way["amenity"="parking"](BBOX);', 'relation["amenity"="parking"](BBOX);'] },
  { key: 'car', label: 'Concesionario', parkingProbability: 'high', selectors: ['node["shop"="car"](BBOX);', 'way["shop"="car"](BBOX);', 'relation["shop"="car"](BBOX);'] },
  { key: 'hotel', label: 'Hotel', parkingProbability: 'high', selectors: ['node["tourism"="hotel"](BBOX);', 'way["tourism"="hotel"](BBOX);', 'relation["tourism"="hotel"](BBOX);'] },
];

const CATEGORY_PROFILES = {
  'Centro comercial / strip mall': { viability: 86, branch: 'Retail', detail: 'Retail · gran formato', scale: 'grande', scaleLabel: 'Gran formato' },
  'Supermercado': { viability: 74, branch: 'Retail', detail: 'Retail · formato medio', scale: 'mediano', scaleLabel: 'Formato mediano' },
  'Hotel': { viability: 82, branch: 'Hotelería', detail: 'Hotelería · gran formato', scale: 'grande', scaleLabel: 'Gran formato' },
  'Clínica / hospital': { viability: 80, branch: 'Salud', detail: 'Salud · gran formato', scale: 'grande', scaleLabel: 'Gran formato' },
  'Universidad': { viability: 79, branch: 'Educación', detail: 'Educación · gran formato', scale: 'grande', scaleLabel: 'Gran formato' },
  'Parqueadero público': { viability: 77, branch: 'Parking', detail: 'Parking · estructurado', scale: 'grande', scaleLabel: 'Gran formato' },
  'Concesionario': { viability: 81, branch: 'Automotriz', detail: 'Automotriz · concesionario', scale: 'grande', scaleLabel: 'Gran formato' },
  'Grifo / estación de servicio': { viability: 67, branch: 'Movilidad', detail: 'Movilidad · estación de servicio', scale: 'mediano', scaleLabel: 'Formato mediano' },
  'Cadena comida rápida': { viability: 53, branch: 'Consumo', detail: 'Consumo · comida rápida', scale: 'pequeno_auxiliar', scaleLabel: 'Pequeño / auxiliar' },
  'Cadena café/restaurante': { viability: 51, branch: 'Consumo', detail: 'Consumo · café / restaurante', scale: 'pequeno_auxiliar', scaleLabel: 'Pequeño / auxiliar' },
};

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function stripAccents(text) { return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function norm(text) { return stripAccents(text).toLowerCase().replace(/&/g, ' y ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function titleCase(str) { return String(str || '').replace(/\s+/g, ' ').trim(); }
function hav(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const q = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(q));
}
function pickLatLon(el) { return { lat: el.lat ?? el.center?.lat ?? null, lng: el.lon ?? el.center?.lon ?? null }; }
function compactAddress(tags) {
  const parts = [tags['addr:street'], tags['addr:housenumber'], tags['addr:suburb'], tags['addr:district'], tags['addr:city']].filter(Boolean);
  return titleCase(parts.join(', ')) || `${CITY}, ${COUNTRY}`;
}
function buildName(tags, categoryLabel) { return titleCase(tags.name || tags.brand || tags.operator || tags.network || categoryLabel); }
function normalizeGroup(tags, fallbackName) { return titleCase(tags.brand || tags.operator || tags.network || fallbackName || 'Sin agrupar'); }
function buildQuery(selectors) {
  return `[out:json][timeout:120];\n(\n${selectors.map((selector) => selector.replaceAll('BBOX', BBOX)).join('\n')}\n);\nout center tags;`;
}
async function overpass(query, tries = 5) {
  let lastError;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      const res = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'MapPe EVINKA Lima extractor/1.0',
        },
        body: 'data=' + encodeURIComponent(query),
      });
      if (!res.ok) throw new Error(`Overpass ${res.status} ${res.statusText}: ${(await res.text()).slice(0, 300)}`);
      return await res.json();
    } catch (error) {
      lastError = error;
      if (attempt < tries) await sleep(1500 * attempt);
    }
  }
  throw lastError;
}
async function fetchDistricts() {
  const query = `[out:json][timeout:120];relation[boundary=administrative][admin_level=8](${BBOX});out bb center tags;`;
  const data = await overpass(query);
  return (data.elements || [])
    .filter((el) => el.tags?.name && el.center && el.bounds)
    .map((el) => ({
      name: el.tags.name,
      ref: el.tags.ref || el.tags['ref:inei'] || el.tags['ref:sunat'] || null,
      bounds: el.bounds,
      center: el.center,
    }));
}
function assignDistrict(row, districts) {
  const inside = districts.filter((d) => row.lat >= d.bounds.minlat && row.lat <= d.bounds.maxlat && row.lng >= d.bounds.minlon && row.lng <= d.bounds.maxlon);
  const pool = inside.length ? inside : districts;
  const best = pool.map((d) => ({ d, dist: hav(row.lat, row.lng, d.center.lat, d.center.lon) })).sort((a, b) => a.dist - b.dist)[0]?.d;
  return best || null;
}
function viabilityTier(score) {
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  if (score >= 40) return 'low';
  return 'discard';
}
function recommendedAction(score) {
  if (score >= 80) return 'Prioridad alta';
  if (score >= 60) return 'Revisar comercialmente';
  if (score >= 40) return 'Baja prioridad';
  return 'Descartar para carga pública';
}
function priorityFor(score) {
  if (score >= 80) return 'atacar_ya';
  if (score >= 60) return 'revisar';
  return 'descartar';
}
function superTier(score, priority) {
  if (priority === 'descartar' || score < 45) return 'descartar';
  if (score >= 78) return 'A';
  if (score >= 62) return 'B';
  return 'C';
}
function markerId(prefix, el, index) { return `${prefix}-${el.type}-${el.id ?? index}`; }
function shouldKeep(row) { return row.lat != null && row.lng != null && row.name && row.name !== row.category; }
function dedupeKey(row) { return `${row.category}|${norm(row.name)}|${row.lat.toFixed(5)}|${row.lng.toFixed(5)}`; }

const districts = await fetchDistricts();
const seen = new Set();
const rows = [];
const extractionSummary = [];

for (const category of CATEGORIES) {
  const data = await overpass(buildQuery(category.selectors));
  let kept = 0;
  for (const [index, el] of (data.elements || []).entries()) {
    const tags = el.tags || {};
    const { lat, lng } = pickLatLon(el);
    const name = buildName(tags, category.label);
    const operator = titleCase(tags.operator || tags.brand || tags.network || name);
    const address = compactAddress(tags);
    const base = {
      id: markerId(`lima-${category.key}`, el, index),
      city: CITY,
      country: COUNTRY,
      ubigeo: '1501',
      zone: titleCase(tags['addr:suburb'] || tags['addr:district'] || tags['is_in:suburb'] || tags['is_in:city_district'] || CITY),
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
      aliases: [name],
      aliasCount: 1,
      rawIds: [markerId(`raw-${category.key}`, el, index)],
      rawCount: 1,
      confidence: 'medium',
      consolidationMode: 'raw_osm_lima',
      hasSubunits: false,
      canonicalName: name,
      canonicalOperator: operator,
      googleValidationStatus: 'not_found',
      googleMapsUri: null,
      commercialReady: true,
      reviewReasons: [],
      reviewStatus: 'approved_auto',
      nivel_socioeconomico: null,
      estrato_entorno: null,
      estrato_fuente: null,
    };
    if (!shouldKeep(base)) continue;
    const dedupe = dedupeKey(base);
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    const district = assignDistrict(base, districts);
    const profile = CATEGORY_PROFILES[base.category] || { viability: 60, branch: 'Otros', detail: base.category, scale: 'mediano', scaleLabel: 'Formato mediano' };
    const viabilityScore = profile.viability;
    const viabilityTierValue = viabilityTier(viabilityScore);
    const evinkaPriority = priorityFor(viabilityScore);
    const superPremiumScore = Math.min(100, Math.round((viabilityScore * 0.65) + (profile.scale === 'grande' ? 18 : profile.scale === 'mediano' ? 10 : 4)));
    const finalRow = {
      ...base,
      ubigeo: district?.ref || '1501',
      officialDivisionType: 'distrito',
      officialDivisionName: titleCase(district?.name || base.zone || CITY),
      officialDivisionCode: district?.ref || null,
      officialDivisionSource: district ? 'OSM administrative boundary (bbox+center)' : 'zone_fallback',
      provinceCommercial: titleCase(district?.name || base.zone || CITY),
      commercialBranch: profile.branch,
      commercialBranchDetail: profile.detail,
      commercialScale: profile.scale,
      commercialScaleLabel: profile.scaleLabel,
      parkingAccessScore: base.parkingProbability === 'high' ? 28 : base.parkingProbability === 'medium' ? 18 : 8,
      siteScaleScore: profile.scale === 'grande' ? 24 : profile.scale === 'mediano' ? 16 : 9,
      dwellTimeScore: ['Hotel', 'Centro comercial / strip mall', 'Clínica / hospital', 'Universidad', 'Parqueadero público'].includes(base.category) ? 20 : 10,
      publicChargingFitScore: ['Centro comercial / strip mall', 'Hotel', 'Parqueadero público', 'Concesionario', 'Universidad'].includes(base.category) ? 18 : 12,
      commercialPotentialScore: profile.scale === 'grande' ? 18 : profile.scale === 'mediano' ? 14 : 8,
      viabilityScore,
      viabilityTier: viabilityTierValue,
      recommendedAction: recommendedAction(viabilityScore),
      publicChargingCandidate: viabilityScore >= 60,
      evinkaPriority,
      evinkaRationale: [evinkaPriority === 'atacar_ya' ? 'host_prioritario_lima' : evinkaPriority === 'revisar' ? 'revisar_lima' : 'baja_prioridad_lima'],
      evinkaPremiumCandidate: evinkaPriority === 'atacar_ya',
      populationDemandScore: 10,
      populationDemandLocality: null,
      populationDemandUpz: null,
      activityDensityScore: 12,
      activityDensitySignals: null,
      evAffinityAdvancedScore: Math.round((viabilityScore / 100) * 25),
      hostImportanceScore: profile.scale === 'grande' ? 15 : profile.scale === 'mediano' ? 11 : 6,
      newsSignalScore: 5,
      newsSignalMode: 'neutral_pending_curated_news',
      superPremiumScore,
      superPremiumTier: superTier(superPremiumScore, evinkaPriority),
      superPremiumAction: superTier(superPremiumScore, evinkaPriority) === 'A' ? 'Atacar ya' : superTier(superPremiumScore, evinkaPriority) === 'B' ? 'Revisar pronto' : superTier(superPremiumScore, evinkaPriority) === 'C' ? 'Observar' : 'Descartar',
    };
    rows.push(finalRow);
    kept += 1;
  }
  extractionSummary.push({ city: CITY, category: category.label, totalRaw: (data.elements || []).length, kept });
  await sleep(300);
}

rows.sort((a, b) => a.category.localeCompare(b.category, 'es') || (a.canonicalName || a.name).localeCompare((b.canonicalName || b.name), 'es'));

const summary = {
  generatedAt: new Date().toISOString(),
  total: rows.length,
  cities: [CITY],
  country: COUNTRY,
  methodology: {
    extraction: 'Extracción OSM/Overpass sobre Lima Metropolitana con categorías base de MapCo.',
    territory: 'Asignación territorial preliminar por distritos OSM dentro de bbox metropolitana.',
    scoring: 'Scoring inicial heredando la lógica comercial general de MapCo, ajustado como baseline para Lima.',
  },
  extractionSummary,
  counts: rows.reduce((acc, row) => {
    acc.super[row.superPremiumTier] = (acc.super[row.superPremiumTier] || 0) + 1;
    acc.premium[row.evinkaPriority] = (acc.premium[row.evinkaPriority] || 0) + 1;
    acc.viability[row.viabilityTier] = (acc.viability[row.viabilityTier] || 0) + 1;
    return acc;
  }, { super: { A: 0, B: 0, C: 0, descartar: 0 }, premium: { atacar_ya: 0, revisar: 0, descartar: 0 }, viability: { high: 0, medium: 0, low: 0, discard: 0 } }),
};

await mkdir('/root/.openclaw/workspace/apps/mappe-web/public/data', { recursive: true });
await writeFile(OUTPUT, JSON.stringify(rows, null, 2));
await writeFile(SUMMARY, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ total: rows.length, summary: summary.counts }, null, 2));
