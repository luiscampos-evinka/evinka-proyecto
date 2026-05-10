import { mkdir, readFile, writeFile } from 'node:fs/promises';

const EXISTING_BOGOTA = '/root/.openclaw/workspace/apps/mapco-web/public/data/places-super-premium-deduped.json';
const OUTPUT = '/root/.openclaw/workspace/apps/mapco-web/public/data/places-colombia-multicity.json';
const SUMMARY = '/root/.openclaw/workspace/apps/mapco-web/public/data/summary-colombia-multicity.json';
const AUDIT = '/root/.openclaw/workspace/deliverables/mapco-colombia-multicity-audit.json';

const OVERPASS_URL = 'https://overpass.kumi.systems/api/interpreter';
const CITIES = [
  { slug: 'med', city: 'Medellín', areaName: 'Medellín', ubigeo: '05001', country: 'Colombia', center: { lat: 6.2442, lng: -75.5812 }, bbox: '6.15,-75.68,6.34,-75.50', officialDivisionType: 'comuna' },
  { slug: 'cal', city: 'Cali', areaName: 'Santiago de Cali', ubigeo: '76001', country: 'Colombia', center: { lat: 3.4516, lng: -76.5320 }, bbox: '3.30,-76.65,3.55,-76.44', officialDivisionType: 'comuna' },
];

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

const CLEAN_RULES = {
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

const CATEGORY_PROFILES = {
  'Centro comercial / strip mall': { scale: 26, dwell: 22, fit: 20, commercial: 20 },
  'Supermercado': { scale: 22, dwell: 14, fit: 18, commercial: 20 },
  'Hotel': { scale: 18, dwell: 24, fit: 20, commercial: 16 },
  'Clínica / hospital': { scale: 18, dwell: 18, fit: 18, commercial: 16 },
  'Universidad': { scale: 20, dwell: 20, fit: 18, commercial: 16 },
  'Parqueadero público': { scale: 18, dwell: 20, fit: 22, commercial: 18 },
  'Concesionario': { scale: 16, dwell: 16, fit: 20, commercial: 14 },
  'Grifo / estación de servicio': { scale: 14, dwell: 10, fit: 14, commercial: 12 },
  'Cadena comida rápida': { scale: 8, dwell: 8, fit: 8, commercial: 10 },
  'Cadena café/restaurante': { scale: 6, dwell: 8, fit: 6, commercial: 8 },
};

const SENSITIVE = new Set(['Universidad', 'Clínica / hospital', 'Centro comercial / strip mall', 'Hotel']);
const STOPWORDS = new Set(['de','del','la','las','el','los','y','en','a','por','para','un','una','colombia','bogota','bogotá','medellin','medellín','cali']);
const SUBUNIT_WORDS = [
  'facultad','bloque','torre','edificio','pabellon','pabellón','campus','sede','porteria','portería','entrada','auditorio','biblioteca','modulo','módulo','laboratorio','ala','piso','oficina','consultorio','urgencias','cultural','administrativa','admisiones','decanatura'
];
const BAD_GENERIC = ['universidad','hotel','hospital','clinica','clínica','centro comercial','mall','campus','facultad'];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripAccents(text) {
  return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function norm(text) {
  return stripAccents(text)
    .toLowerCase()
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(str) {
  return String(str || '').replace(/\s+/g, ' ').trim();
}

function tokenSet(text) {
  return new Set(norm(text).split(' ').filter(Boolean).filter((t) => !STOPWORDS.has(t)));
}

function containsSubunit(text) {
  const n = norm(text);
  return SUBUNIT_WORDS.some((word) => n.includes(word));
}

function isGenericName(text) {
  return BAD_GENERIC.includes(norm(text));
}

function isGenericAddress(text, city) {
  const n = norm(text);
  const cityNorm = norm(city);
  return !n || n === `${cityNorm} colombia` || n === cityNorm || n === `${cityNorm} valle del cauca colombia` || n === `${cityNorm} antioquia colombia`;
}

function compactAddress(tags, city) {
  const parts = [
    tags['addr:street'],
    tags['addr:housenumber'],
    tags['addr:suburb'],
    tags['addr:district'],
    tags['addr:city'],
  ].filter(Boolean);
  return titleCase(parts.join(', ')) || `${city}, Colombia`;
}

function buildName(tags, categoryLabel) {
  return titleCase(tags.name || tags.brand || tags.operator || tags.network || categoryLabel);
}

function normalizeGroup(tags, fallbackName) {
  return titleCase(tags.brand || tags.operator || tags.network || fallbackName || 'Sin agrupar');
}

function pickLatLon(el) {
  return { lat: el.lat ?? el.center?.lat ?? null, lng: el.lon ?? el.center?.lon ?? null };
}

function stableId(prefix, el, index) {
  return `${prefix}-${el.type}-${el.id ?? index}`;
}

function withinCityBounds(row, cityConfig) {
  if (!cityConfig?.bbox) return true;
  const [minLat, minLng, maxLat, maxLng] = cityConfig.bbox.split(',').map(Number);
  return row.lat >= minLat && row.lat <= maxLat && row.lng >= minLng && row.lng <= maxLng;
}

function shouldKeep(row, cityConfig) {
  if (!row.lat || !row.lng) return false;
  if (!row.name || row.name === row.category) return false;
  if (!withinCityBounds(row, cityConfig)) return false;
  return true;
}

function buildQuery(city, selectors) {
  const scopedSelectors = city.bbox
    ? selectors.map((selector) => selector.replace('(area.a)', `(${city.bbox})`))
    : selectors;
  const header = city.bbox
    ? '[out:json][timeout:120];'
    : `[out:json][timeout:120];\narea["name"="${city.areaName}"]["boundary"="administrative"]->.a;`;
  return `${header}\n(\n${scopedSelectors.join('\n')}\n);\nout center tags;`;
}

async function overpass(query, tries = 5) {
  let lastError;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      const res = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'MapCo EVINKA multicity extractor/1.0',
        },
        body: 'data=' + encodeURIComponent(query),
      });
      if (!res.ok) throw new Error(`Overpass ${res.status} ${res.statusText}: ${(await res.text()).slice(0, 400)}`);
      return await res.json();
    } catch (error) {
      lastError = error;
      if (attempt < tries) await sleep(2000 * attempt);
    }
  }
  throw lastError;
}

async function extractCity(city) {
  const seen = new Set();
  const rows = [];
  const summary = [];
  for (const category of CATEGORIES) {
    const data = await overpass(buildQuery(city, category.selectors));
    let kept = 0;
    for (const [index, el] of (data.elements || []).entries()) {
      const tags = el.tags || {};
      const { lat, lng } = pickLatLon(el);
      const name = buildName(tags, category.label);
      const operator = titleCase(tags.operator || tags.brand || tags.network || name);
      const address = compactAddress(tags, city.city);
      const row = {
        id: stableId(`${city.slug}-${category.key}`, el, index),
        city: city.city,
        ubigeo: city.ubigeo,
        zone: titleCase(tags['addr:suburb'] || tags['addr:district'] || tags['is_in:suburb'] || tags['is_in:city_district'] || city.city),
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
      const dedupeKey = `${row.city}|${row.category}|${norm(row.name)}|${row.lat.toFixed(5)}|${row.lng.toFixed(5)}`;
      if (!shouldKeep(row, city) || seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      rows.push(row);
      kept += 1;
    }
    summary.push({ city: city.city, category: category.label, totalRaw: (data.elements || []).length, kept });
    await sleep(350);
  }
  return { rows, summary };
}

async function fetchOfficialDivisions(city) {
  if (!city?.bbox) return [];
  const query = `[out:json][timeout:120];relation[boundary=administrative][admin_level=8](${city.bbox});out bb center tags;`;
  const data = await overpass(query);
  return (data.elements || [])
    .filter((el) => el.tags?.name && el.center)
    .map((el) => ({
      name: el.tags.name,
      ref: el.tags.ref || null,
      bounds: el.bounds || null,
      center: el.center,
      type: /^comuna\b/i.test(el.tags.name) ? 'comuna' : 'corregimiento',
      city: city.city,
    }));
}

function assignTerritory(point, territories) {
  if (!territories?.length) return null;
  const inside = territories.filter((t) => t.bounds && point.lat >= t.bounds.minlat && point.lat <= t.bounds.maxlat && point.lng >= t.bounds.minlon && point.lng <= t.bounds.maxlon);
  const candidates = inside.length ? inside : territories;
  return candidates
    .map((t) => ({ territory: t, d: hav(point.lat, point.lng, t.center.lat, t.center.lon) }))
    .sort((a, b) => a.d - b.d)[0]?.territory || null;
}

function assignOfficialDivisions(rows, city, territories) {
  return rows.map((row) => {
    const territory = assignTerritory(row, territories);
    return {
      ...row,
      officialDivisionType: territory?.type || city.officialDivisionType || 'division',
      officialDivisionName: territory?.name || row.zone || row.city,
      officialDivisionCode: territory?.ref || null,
      officialDivisionSource: territory ? 'OSM administrative boundary (bbox+center)' : 'zone_fallback',
    };
  });
}

function baseCampusName(row) {
  let value = norm([row.name, row.operator, row.brandGroup].filter(Boolean).join(' '));
  for (const word of SUBUNIT_WORDS) value = value.replace(new RegExp(`\\b${word}\\b`, 'g'), ' ');
  value = value.replace(/\basab\b/g, ' academia superior de artes de bogota asab ');
  value = value.replace(/\s+/g, ' ').trim();
  return value;
}

function baseBranchName(row) {
  return norm([row.name, row.operator, row.brandGroup].filter(Boolean).join(' '));
}

function normalizedAddress(row) {
  return norm(row.address || '');
}

function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad((b.lat || 0) - (a.lat || 0));
  const dLng = toRad((b.lng || 0) - (a.lng || 0));
  const lat1 = toRad(a.lat || 0);
  const lat2 = toRad(b.lat || 0);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
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
  if (norm(name) === norm(row.category || '')) score -= 20;
  if (row.address && !isGenericAddress(row.address, row.city)) score += 8;
  if (row.osmType === 'way' || row.osmType === 'relation') score += 4;
  return score;
}

function chooseCanonical(members) {
  return [...members].sort((a, b) => candidateScore(b) - candidateScore(a) || String(b.name).length - String(a.name).length)[0];
}

function confidenceFor(members, mode) {
  if (members.length >= 3) return 'high';
  if (mode === 'campus' && members.length >= 2) return 'high';
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

function mergeIntoGroup(row, group) {
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
  const aliases = [...new Set(group.members.map((m) => m.name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
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

function cleanRows(rawRows) {
  const byKey = new Map();
  for (const row of rawRows) {
    const key = `${row.city}||${row.category}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(row);
  }
  const clean = [];
  for (const rows of byKey.values()) {
    const category = rows[0].category;
    const rule = CLEAN_RULES[category] || { radius: 35, mode: 'branch' };
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
      if (matched) mergeIntoGroup(row, matched, rule);
      else groups.push({
        members: [row],
        centroid: { lat: row.lat, lng: row.lng },
        baseKey: makeGroupKey(row, rule.mode),
        addressKey: normalizedAddress(row),
        hasSubunit: containsSubunit(row.name),
      });
    }
    clean.push(...groups.map((group) => buildCanonical(group, rule)));
  }
  return clean;
}

function conflictingAliases(row) {
  const aliases = (row.aliases || []).map(norm).filter(Boolean);
  const institutionish = aliases.filter((a) => /universidad|fundacion universitaria|politecnico|escuela|academia|externado|javeriana|rosario|tadeo|catolica|santo tomas|unad|uniminuto|uniciencia|cooperativa/.test(a));
  return new Set(institutionish).size >= 2;
}

function annotateReview(rows) {
  return rows.map((row) => {
    const reasons = [];
    if (SENSITIVE.has(row.category)) {
      if ((row.rawCount || 1) >= 3) reasons.push(`merged:${row.rawCount}`);
      else if ((row.rawCount || 1) === 2) reasons.push('merged:2');
      if (row.hasSubunits || containsSubunit(row.canonicalName) || (row.aliases || []).some(containsSubunit)) reasons.push('subunits');
      if (isGenericAddress(row.address, row.city)) reasons.push('generic_address');
      if (row.confidence !== 'high') reasons.push(`confidence:${row.confidence}`);
      if (isGenericName(row.canonicalName)) reasons.push('generic_name');
      if (conflictingAliases(row)) reasons.push('alias_conflict');
    }
    let reviewStatus = 'approved_auto';
    if (SENSITIVE.has(row.category)) {
      if (reasons.includes('alias_conflict') || reasons.includes('generic_name') || reasons.includes('subunits') || (reasons.some((r) => r.startsWith('merged:')) && reasons.includes('generic_address'))) reviewStatus = 'review_critical';
      else if (reasons.length) reviewStatus = 'review_light';
    }
    if (reviewStatus === 'review_critical') reviewStatus = 'review_light';
    return {
      ...row,
      reviewReasons: reasons,
      reviewStatus,
      commercialReady: reviewStatus === 'approved_auto',
    };
  });
}

function parkingScore(row) {
  let score = row.parkingProbability === 'high' ? 28 : row.parkingProbability === 'medium' ? 18 : 8;
  if (/parqueadero|parking|mall|centro comercial|hotel|universidad|clinica|cl[ií]nica|hospital|supermercado|concesionario/i.test(row.category + ' ' + row.canonicalName)) score += 2;
  return Math.min(30, score);
}

function scaleBoost(row) {
  let bonus = 0;
  if ((row.rawCount || 1) >= 3) bonus += 4;
  else if ((row.rawCount || 1) === 2) bonus += 2;
  if (/campus|sede|plaza|mall|centro comercial|hotel|universidad|cl[ií]nica|hospital|supermercado|parqueadero/i.test(row.canonicalName || '')) bonus += 1;
  return bonus;
}

function qualityPenalty(row) {
  let penalty = 0;
  if (row.reviewStatus === 'review_light') penalty += 4;
  if (row.hasSubunits) penalty += 2;
  if (isGenericAddress(row.address, row.city)) penalty += 2;
  return penalty;
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

function scoreViability(rows) {
  return rows.map((row) => {
    const profile = CATEGORY_PROFILES[row.category] || { scale: 10, dwell: 10, fit: 10, commercial: 10 };
    const components = {
      parkingAccessScore: parkingScore(row),
      siteScaleScore: Math.min(25, profile.scale + scaleBoost(row)),
      dwellTimeScore: Math.min(25, profile.dwell),
      publicChargingFitScore: Math.min(20, profile.fit),
      commercialPotentialScore: Math.min(20, profile.commercial),
    };
    let score = Object.values(components).reduce((a, b) => a + b, 0) - qualityPenalty(row);
    if (row.category === 'Cadena café/restaurante') score -= 12;
    if (row.category === 'Cadena comida rápida') score -= 8;
    if (row.category === 'Grifo / estación de servicio') score -= 6;
    if (['Centro comercial / strip mall', 'Hotel', 'Parqueadero público', 'Universidad'].includes(row.category)) score += 4;
    score = Math.max(0, Math.min(100, Math.round(score)));
    const tier = viabilityTier(score);
    return { ...row, ...components, viabilityScore: score, viabilityTier: tier, recommendedAction: recommendedAction(score), publicChargingCandidate: score >= 60 };
  });
}

function haystack(row) {
  return [row.canonicalName, row.name, row.operator, row.address, ...(row.aliases || []), ...(row.commercialReviewNotes || [])].join(' ');
}

function has(re, row) {
  return re.test(haystack(row));
}

function isChainSupermarket(row) {
  return /\b(exito|carulla|jumbo|makro|pricesmart|olimpica|homecenter|alkosto|metro)\b/.test(norm(haystack(row)));
}

function isDiscountChain(row) {
  return /\b(d1|ara|oxxo|justo\s*&?\s*bueno|justo y bueno)\b/.test(norm(haystack(row)));
}

function applyPenalty(row, points, reason, minScore = 0) {
  const before = row.viabilityScore || 0;
  row.viabilityScore = Math.max(minScore, before - points);
  row.commercialReviewNotes = [...new Set([...(row.commercialReviewNotes || []), reason])];
}

function refineCommercial(rows) {
  for (const row of rows) {
    const n = norm([row.canonicalName, row.name, row.operator, row.address, ...(row.aliases || [])].join(' '));
    if (row.category === 'Supermercado') {
      if (/(minimarket|minimercado|droguer|papeler|miscel|\btienda\b|viver|abarrot|naturista|de la esquina|el barrio)/.test(n) && !isChainSupermarket(row) && !isDiscountChain(row)) applyPenalty(row, 55, 'micro_retail_supermarket_false_positive');
      if (isDiscountChain(row)) applyPenalty(row, 28, 'discount_chain_requires_site_size_review');
      if (/\bedificio\b/.test(n)) applyPenalty(row, 45, 'building_not_actionable_supermarket_site');
    }
    if (/\bcolegio\b/.test(n) && row.category === 'Universidad' && !/^universidad colegio mayor/.test(norm(row.canonicalName))) applyPenalty(row, 70, 'school_misclassified_as_university');
    if (/\b(colegio|jardin|guarderia|kindergarten)\b/.test(n) && row.category === 'Parqueadero público') applyPenalty(row, 65, 'school_parking_not_public_charging_host');
    if (row.category === 'Parqueadero público') {
      if (/\b(edificio|torre|ph|residencial|conjunto)\b/.test(n)) applyPenalty(row, 60, 'private_building_parking_false_positive');
      if (/\b(comercial la papelera|papelera)\b/.test(n)) applyPenalty(row, 55, 'small_commercial_parking_false_positive');
      if (/\b(privado|private|empleados|empleado|clientes|cliente|estudiantes|profesores|rectoria|rectoría|interno|interna|internos|internas)\b/.test(n)) applyPenalty(row, 72, 'internal_or_private_parking_not_public_host');
      if (/\b(sin nombre|wikidata|parking|parqueadero|estacionamiento|aparcamiento)\b/.test(n) && !/\b(cc|centro comercial|mall|hotel|hospital|clinica|clínica|universidad|homecenter|carrefour|jumbo|makro|exito|éxito|olimpica|olímpica|viva|teatro|museo|terminal|aeropuerto)\b/.test(n)) {
        applyPenalty(row, 46, 'generic_parking_name_without_anchor');
      }
      if (isGenericAddress(row.address, row.city) && /\b(parking|parqueadero|estacionamiento|aparcamiento)\b/.test(n) && !/\b(98|100|106|127|140|centro comercial|mall|hotel|hospital|clinica|clínica|universidad|homecenter|carrefour|jumbo|makro|exito|éxito|olimpica|olímpica|viva|teatro|museo|terminal|aeropuerto)\b/.test(n)) {
        applyPenalty(row, 28, 'generic_parking_without_specific_address');
      }
    }
    if (row.category === 'Clínica / hospital') {
      if (/(droguer|consultor|odont|laborator|urgenc|\bips\b|unidad de urgencias|centro medico y odontologico)/.test(n) && !/(hospital|fundacion|clinica)/.test(n)) applyPenalty(row, 42, 'small_medical_point_not_major_host');
      if (/(droguer|consultor|odont|laborator)/.test(n)) applyPenalty(row, 28, 'medical_subscale_site_requires_manual_validation');
    }
    if (row.category === 'Centro comercial / strip mall' && /\bedificio\b/.test(n)) applyPenalty(row, 30, 'mixed_use_building_not_top_tier_mall');
    if (row.category === 'Cadena comida rápida' && /\b(local|empanadas|broaster|tienda)\b/.test(n)) applyPenalty(row, 18, 'small_fast_food_point');
    if (row.category === 'Universidad' && /\b(administrativa|virtual|distancia)\b/.test(n)) applyPenalty(row, 30, 'administrative_or_virtual_campus_lower_priority');
    row.viabilityScore = Math.max(0, Math.min(100, Math.round(row.viabilityScore || 0)));
    row.viabilityTier = viabilityTier(row.viabilityScore);
    row.recommendedAction = recommendedAction(row.viabilityScore);
    row.publicChargingCandidate = row.viabilityScore >= 60;
  }
  return rows;
}

function isLargeRetail(row) {
  return /\b(exito|carulla|jumbo|makro|pricesmart|olimpica|homecenter|alkosto|metro)\b/.test(norm(haystack(row)));
}

function isDiscountRetail(row) {
  return /\b(d1|ara|oxxo|justo\s*&?\s*bueno|justo y bueno)\b/.test(norm(haystack(row)));
}

function buildPremium(rows) {
  for (const row of rows) {
    let priority = 'descartar';
    let rationale = [];
    if (row.viabilityTier === 'discard') {
      priority = 'descartar';
      rationale.push('viabilidad_descartada');
    } else if (row.category === 'Cadena café/restaurante' || row.category === 'Cadena comida rápida') {
      priority = 'descartar';
      rationale.push('retail_comida_no_prioritario');
    } else if (row.category === 'Centro comercial / strip mall') {
      if (has(/mixed_use_building_not_top_tier_mall/i, row)) {
        priority = 'revisar';
        rationale.push('mall_mixto_revisar');
      } else {
        priority = row.viabilityTier === 'high' ? 'atacar_ya' : 'revisar';
        rationale.push('mall_prioritario');
      }
    } else if (row.category === 'Hotel') {
      priority = row.viabilityTier === 'high' ? 'atacar_ya' : 'revisar';
      rationale.push('hotel_prioritario');
    } else if (row.category === 'Concesionario') {
      priority = row.viabilityTier === 'high' ? 'atacar_ya' : 'revisar';
      rationale.push('concesionario_prioritario');
    } else if (row.category === 'Parqueadero público') {
      if (has(/private_building_parking_false_positive|school_parking_not_public_charging_host/i, row)) {
        priority = 'descartar';
        rationale.push('parqueadero_no_accionable');
      } else {
        priority = row.viabilityTier === 'high' ? 'atacar_ya' : 'revisar';
        rationale.push('parqueadero_publico_prioritario');
      }
    } else if (row.category === 'Universidad') {
      if (has(/school_misclassified_as_university/i, row)) {
        priority = 'descartar';
        rationale.push('colegio_mal_clasificado');
      } else if (has(/administrative_or_virtual_campus_lower_priority/i, row)) {
        priority = 'revisar';
        rationale.push('sede_administrativa_o_virtual');
      } else {
        priority = row.viabilityTier === 'high' ? 'atacar_ya' : 'revisar';
        rationale.push('universidad_real_prioritaria');
      }
    } else if (row.category === 'Clínica / hospital') {
      if (has(/small_medical_point_not_major_host|medical_subscale_site_requires_manual_validation/i, row)) {
        priority = row.viabilityTier === 'medium' ? 'revisar' : 'descartar';
        rationale.push('salud_subescala');
      } else {
        priority = row.viabilityTier === 'high' ? 'atacar_ya' : 'revisar';
        rationale.push('hospital_clinica_prioritario');
      }
    } else if (row.category === 'Supermercado') {
      if (isLargeRetail(row)) {
        priority = row.viabilityTier === 'high' ? 'atacar_ya' : 'revisar';
        rationale.push('retail_grande_prioritario');
      } else if (isDiscountRetail(row)) {
        priority = 'revisar';
        rationale.push('retail_descuento_revisar_tamano');
      } else if (has(/micro_retail_supermarket_false_positive/i, row)) {
        priority = 'descartar';
        rationale.push('micro_retail_descartar');
      } else if (row.viabilityTier === 'high') {
        priority = 'revisar';
        rationale.push('supermercado_independiente_revisar');
      } else {
        priority = 'descartar';
        rationale.push('supermercado_baja_senal');
      }
    } else if (row.category === 'Grifo / estación de servicio') {
      priority = row.viabilityTier === 'medium' || row.viabilityTier === 'high' ? 'revisar' : 'descartar';
      rationale.push('estacion_servicio_revisar_espacio');
    }
    row.evinkaPriority = priority;
    row.evinkaRationale = rationale;
    row.evinkaPremiumCandidate = priority === 'atacar_ya';
  }
  return rows;
}

function hostImportance(row) {
  if (row.category === 'Centro comercial / strip mall') return 15;
  if (row.category === 'Parqueadero público') return 15;
  if (row.category === 'Hotel') return 14;
  if (row.category === 'Concesionario') return 13;
  if (row.category === 'Universidad') return 12;
  if (row.category === 'Clínica / hospital') return 12;
  if (row.category === 'Supermercado') {
    const n = norm([row.canonicalName, row.operator].join(' '));
    if (/\b(exito|carulla|jumbo|makro|pricesmart|olimpica|homecenter|alkosto|metro)\b/.test(n)) return 12;
    if (/\b(d1|ara|oxxo|justo y bueno|justo bueno)\b/.test(n)) return 9;
    return 8;
  }
  if (row.category === 'Grifo / estación de servicio') return 9;
  return 4;
}

function percentileScore(value, values, maxPoints) {
  if (!values.length || !value) return Math.round(maxPoints * 0.35);
  const sorted = [...values].sort((a, b) => a - b);
  let idx = sorted.findIndex((v) => value <= v);
  if (idx === -1) idx = sorted.length - 1;
  const pct = sorted.length === 1 ? 1 : idx / (sorted.length - 1);
  return Math.round((0.25 + (pct * 0.75)) * maxPoints);
}

function superTier(score, priority) {
  if (priority === 'descartar' || score < 45) return 'descartar';
  if (score >= 78) return 'A';
  if (score >= 62) return 'B';
  return 'C';
}

function addProvince(rows) {
  return rows.map((row) => ({
    ...row,
    localityName: row.localityName || row.zone || null,
    officialDivisionType: row.officialDivisionType || (row.city === 'Bogotá' ? 'localidad' : 'division'),
    officialDivisionName: row.officialDivisionName || (row.city === 'Bogotá' ? (row.localityName || 'Bogotá por validar') : (row.zone || row.city)),
    officialDivisionCode: row.officialDivisionCode || (row.city === 'Bogotá' ? (row.localityCode || null) : null),
    officialDivisionSource: row.officialDivisionSource || (row.city === 'Bogotá' ? 'existing_bogota_assignment' : 'zone_fallback'),
    provinceCommercial: row.provinceCommercial || row.officialDivisionName || (row.city === 'Bogotá' ? (row.localityName || 'Bogotá por validar') : (row.zone || row.city)),
  }));
}

function buildGenericSuper(rows) {
  const enriched = addProvince(rows);
  const provinceStats = new Map();
  for (const row of enriched) {
    const key = `${row.city}||${row.provinceCommercial}`;
    const stat = provinceStats.get(key) || { totalSites: 0, viableSites: 0, premiumSites: 0, highTierSites: 0 };
    stat.totalSites += 1;
    if (row.publicChargingCandidate) stat.viableSites += 1;
    if (row.evinkaPremiumCandidate) stat.premiumSites += 1;
    if (row.viabilityTier === 'high') stat.highTierSites += 1;
    provinceStats.set(key, stat);
  }
  const provinceTotals = [...provinceStats.values()].map((s) => s.totalSites);
  const activityValues = [...provinceStats.values()].map((s) => (s.viableSites * 0.7) + (s.premiumSites * 1.3) + (s.highTierSites * 0.9));

  for (const row of enriched) {
    const stat = provinceStats.get(`${row.city}||${row.provinceCommercial}`) || { totalSites: 0, viableSites: 0, premiumSites: 0, highTierSites: 0 };
    const populationDemandScore = percentileScore(stat.totalSites, provinceTotals, 30);
    const activityBase = (stat.viableSites * 0.7) + (stat.premiumSites * 1.3) + (stat.highTierSites * 0.9);
    const activityDensityScore = percentileScore(activityBase, activityValues, 25);
    const evAffinityAdvancedScore = Math.round(((row.viabilityScore || 0) / 100) * 25);
    const hostImportanceScore = hostImportance(row);
    const newsSignalScore = 5;
    const superPremiumScore = Math.max(0, Math.min(100, populationDemandScore + activityDensityScore + evAffinityAdvancedScore + hostImportanceScore + newsSignalScore));
    const tier = superTier(superPremiumScore, row.evinkaPriority);
    row.populationDemandScore = populationDemandScore;
    row.populationDemandLocality = null;
    row.populationDemandUpz = null;
    row.activityDensityScore = activityDensityScore;
    row.activityDensitySignals = stat;
    row.evAffinityAdvancedScore = evAffinityAdvancedScore;
    row.hostImportanceScore = hostImportanceScore;
    row.newsSignalScore = newsSignalScore;
    row.newsSignalMode = 'neutral_pending_curated_news';
    row.superPremiumScore = superPremiumScore;
    row.superPremiumTier = tier;
    row.superPremiumAction = tier === 'A' ? 'Atacar ya' : tier === 'B' ? 'Revisar pronto' : tier === 'C' ? 'Observar' : 'Descartar';
  }

  return enriched;
}

function hav(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const q = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(q));
}

function similarName(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const sa = new Set(na.split(' '));
  const sb = new Set(nb.split(' '));
  let overlap = 0;
  for (const token of sa) if (sb.has(token)) overlap += 1;
  return overlap / Math.max(sa.size, sb.size, 1) >= 0.8;
}

function mergeable(a, b) {
  if (a.city !== b.city) return false;
  if (a.category !== b.category) return false;
  const d = hav(a.lat, a.lng, b.lat, b.lng) * 1000;
  if (d > 120) return false;
  if (!similarName(a.canonicalName || a.name, b.canonicalName || b.name)) return false;
  const chainish = /starbucks|juan valdez|tostao|dunkin|mcdonald|subway|carulla|jumbo|exito|olimpica|d1|ara|hotel|universidad/i.test([a.canonicalName, a.operator, a.brandGroup, b.canonicalName, b.operator, b.brandGroup].join(' '));
  if (chainish && d > 90) return false;
  return true;
}

const COMPLEX_HOST_PRIORITY = {
  'Centro comercial / strip mall': 100,
  'Concesionario': 95,
  'Hotel': 90,
  'Universidad': 88,
  'Clínica / hospital': 86,
  'Supermercado': 84,
  'Grifo / estación de servicio': 82,
  'Parqueadero público': 20,
};

function complexNameKey(text) {
  return norm(text)
    .replace(/\b(parqueadero|parking|estacionamiento|centro comercial|mall|hotel|universidad|clinica|hospital|toyota|subaru)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sameComplexMergeable(a, b) {
  if (a.city !== b.city) return false;
  const pair = new Set([a.category, b.category]);
  const allowed = [
    ['Parqueadero público', 'Concesionario'],
    ['Parqueadero público', 'Centro comercial / strip mall'],
    ['Parqueadero público', 'Supermercado'],
    ['Parqueadero público', 'Hotel'],
    ['Parqueadero público', 'Universidad'],
    ['Parqueadero público', 'Clínica / hospital'],
    ['Parqueadero público', 'Grifo / estación de servicio'],
  ].some((combo) => combo.every((item) => pair.has(item)));
  if (!allowed) return false;
  const d = hav(a.lat, a.lng, b.lat, b.lng) * 1000;
  if (d > 45) return false;
  const aName = complexNameKey(a.canonicalName || a.name);
  const bName = complexNameKey(b.canonicalName || b.name);
  if (!aName || !bName) return false;
  return aName === bName || aName.includes(bName) || bName.includes(aName) || similarName(aName, bName);
}

function sameComplexDedupe(rows) {
  const used = new Set();
  const out = [];
  const audit = [];

  for (let i = 0; i < rows.length; i += 1) {
    const base = rows[i];
    if (used.has(base.id)) continue;
    const cluster = [base];
    used.add(base.id);

    let changed = true;
    while (changed) {
      changed = false;
      for (let j = 0; j < rows.length; j += 1) {
        const cand = rows[j];
        if (used.has(cand.id)) continue;
        if (cluster.some((item) => sameComplexMergeable(item, cand))) {
          cluster.push(cand);
          used.add(cand.id);
          changed = true;
        }
      }
    }

    if (cluster.length === 1) {
      out.push(base);
      continue;
    }

    const host = [...cluster].sort((a, b) => {
      const pA = COMPLEX_HOST_PRIORITY[a.category] || 0;
      const pB = COMPLEX_HOST_PRIORITY[b.category] || 0;
      return pB - pA || (b.superPremiumScore || 0) - (a.superPremiumScore || 0);
    })[0];

    const aliases = [...new Set(cluster.flatMap((r) => [r.canonicalName, r.name, ...(r.aliases || [])].filter(Boolean)))];
    const merged = {
      ...host,
      aliases,
      aliasCount: aliases.length,
      rawIds: [...new Set(cluster.flatMap((r) => [r.id, ...(r.rawIds || [])].filter(Boolean)))],
      rawCount: cluster.reduce((sum, r) => sum + (r.rawCount || 1), 0),
      lat: Number((cluster.reduce((sum, r) => sum + r.lat, 0) / cluster.length).toFixed(7)),
      lng: Number((cluster.reduce((sum, r) => sum + r.lng, 0) / cluster.length).toFixed(7)),
      parkingProbability: cluster.some((r) => r.parkingProbability === 'high') ? 'high' : host.parkingProbability,
      consolidationMode: 'same_complex_merge',
      reviewStatus: host.reviewStatus === 'approved_auto' ? 'review_light' : host.reviewStatus,
      reviewReasons: [...new Set([...(host.reviewReasons || []), `same_complex_merge:${cluster.length}`])],
      sameComplexComponents: cluster.map((r) => ({ id: r.id, name: r.canonicalName || r.name, category: r.category })),
      address: host.address && !isGenericAddress(host.address, host.city)
        ? host.address
        : (cluster.find((r) => r.address && !isGenericAddress(r.address, r.city))?.address || host.address),
    };

    audit.push({
      keptId: host.id,
      keptName: host.canonicalName,
      city: host.city,
      category: host.category,
      mergedCategories: [...new Set(cluster.map((r) => r.category))],
      size: cluster.length,
    });
    out.push(merged);
  }

  return { rows: out, audit };
}

function applyFreshnessSanityPenalty(row, points, reason) {
  const before = row.viabilityScore || 0;
  row.viabilityScore = Math.max(0, before - points);
  row.commercialReviewNotes = [...new Set([...(row.commercialReviewNotes || []), reason])];
}

function classifyCommercialTaxonomy(row) {
  const n = norm([row.canonicalName, row.name, row.operator, row.address, ...(row.aliases || [])].join(' '));
  const base = {
    commercialBranch: 'Otros',
    commercialBranchDetail: row.category,
    commercialScale: 'mediano',
    commercialScaleLabel: 'Formato mediano',
  };

  if (row.category === 'Clínica / hospital') {
    if (/\b(droguer|farmacia|consultor|odont|laborator|ocupacional|ambulancia|terapia|rehabilit|diagnostico|diagnóstico|optica|óptica|radiolog|vacun|imagen|especializad|servicios medicos|servicios médicos)\b/.test(n)) {
      return { commercialBranch: 'Salud', commercialBranchDetail: 'Salud · pequeño / auxiliar', commercialScale: 'pequeno_auxiliar', commercialScaleLabel: 'Pequeño / auxiliar' };
    }
    if (/\b(hospital|clinica|clínica|fundacion|fundación|unidad hospitalaria|campus de salud|sede principal hospitalaria)\b/.test(n)) {
      return { commercialBranch: 'Salud', commercialBranchDetail: 'Salud · gran formato', commercialScale: 'grande', commercialScaleLabel: 'Gran formato' };
    }
    if (/\b(centro medico|centro médico|ips|eps|unidad medica|unidad médica|upa|uap|cami|caps|atencion prioritaria|atención prioritaria|centro de atencion|centro de atención|salud total|famisanar|sanitas|colsubsidio|coomeva|compensar|medicina prepagada|unidad renal)\b/.test(n)) {
      return { commercialBranch: 'Salud', commercialBranchDetail: 'Salud · mediano formato', commercialScale: 'mediano', commercialScaleLabel: 'Formato mediano' };
    }
    return { commercialBranch: 'Salud', commercialBranchDetail: 'Salud · mediano formato', commercialScale: 'mediano', commercialScaleLabel: 'Formato mediano' };
  }

  if (row.category === 'Centro comercial / strip mall') {
    if (/\b(zona|portal|pasaje|galeria|galería|plazoleta|strip|bazar|feria comercial|zona de comercio)\b/.test(n) && !/\b(centro comercial|mall|outlet|shopping|plaza|galerias|galerías)\b/.test(n)) {
      return { commercialBranch: 'Retail', commercialBranchDetail: 'Retail · pequeño / auxiliar', commercialScale: 'pequeno_auxiliar', commercialScaleLabel: 'Pequeño / auxiliar' };
    }
    if (/\b(locales|etapa|fase|plazoleta|pasarela|sector comercial|bulevar|boulevard)\b/.test(n) && !/\b(centro comercial|mall|outlet|shopping)\b/.test(n)) {
      return { commercialBranch: 'Retail', commercialBranchDetail: 'Retail · formato medio', commercialScale: 'mediano', commercialScaleLabel: 'Formato mediano' };
    }
    if (/\b(outlet|shopping|centro comercial|mall)\b/.test(n)) {
      return { commercialBranch: 'Retail', commercialBranchDetail: 'Retail · gran formato', commercialScale: 'grande', commercialScaleLabel: 'Gran formato' };
    }
    return { commercialBranch: 'Retail', commercialBranchDetail: 'Retail · formato medio', commercialScale: 'mediano', commercialScaleLabel: 'Formato mediano' };
  }

  if (row.category === 'Supermercado') {
    if (/\b(minimarket|minimercado|droguer|tienda|miscel|abarrot|naturista|viver|de la esquina|barrio)\b/.test(n)) {
      return { commercialBranch: 'Retail', commercialBranchDetail: 'Retail · pequeño / auxiliar', commercialScale: 'pequeno_auxiliar', commercialScaleLabel: 'Pequeño / auxiliar' };
    }
    if (/\b(exito|éxito|carulla|jumbo|makro|pricesmart|olimpica|olímpica|homecenter|alkosto|metro)\b/.test(n)) {
      return { commercialBranch: 'Retail', commercialBranchDetail: 'Retail · gran formato', commercialScale: 'grande', commercialScaleLabel: 'Gran formato' };
    }
    return { commercialBranch: 'Retail', commercialBranchDetail: 'Retail · formato medio', commercialScale: 'mediano', commercialScaleLabel: 'Formato mediano' };
  }

  if (row.category === 'Universidad') {
    if (/\b(bloque|facultad|edificio|modulo|módulo|porteria|portería|biblioteca|laboratorio|auditorio|torre|pabellon|pabellón)\b/.test(n)) {
      return { commercialBranch: 'Educación', commercialBranchDetail: 'Educación · subunidad / auxiliar', commercialScale: 'pequeno_auxiliar', commercialScaleLabel: 'Pequeño / auxiliar' };
    }
    if (/\b(universidad|campus|sede principal)\b/.test(n)) {
      return { commercialBranch: 'Educación', commercialBranchDetail: 'Educación · gran formato', commercialScale: 'grande', commercialScaleLabel: 'Gran formato' };
    }
    return { commercialBranch: 'Educación', commercialBranchDetail: 'Educación · formato medio', commercialScale: 'mediano', commercialScaleLabel: 'Formato mediano' };
  }

  if (row.category === 'Hotel') {
    if (/\b(portal|torre|zona|bloque)\b/.test(n) && !/\b(hotel|hostal|hostel|inn|suite|suites)\b/.test(n)) {
      return { commercialBranch: 'Hotelería', commercialBranchDetail: 'Hotelería · pequeño / auxiliar', commercialScale: 'pequeno_auxiliar', commercialScaleLabel: 'Pequeño / auxiliar' };
    }
    if (/\b(hostal|hostel|boutique|inn|aparta|apartahotel)\b/.test(n)) {
      return { commercialBranch: 'Hotelería', commercialBranchDetail: 'Hotelería · formato medio', commercialScale: 'mediano', commercialScaleLabel: 'Formato mediano' };
    }
    return { commercialBranch: 'Hotelería', commercialBranchDetail: 'Hotelería · gran formato', commercialScale: 'grande', commercialScaleLabel: 'Gran formato' };
  }

  if (row.category === 'Parqueadero público') {
    if (/\b(cityparking|geoparking|parkingspot|aparcar|apar car|terminal|aeropuerto|centro comercial|mall|hospital|clinica|clínica)\b/.test(n)) {
      return { commercialBranch: 'Parking', commercialBranchDetail: 'Parking · estructurado', commercialScale: 'grande', commercialScaleLabel: 'Gran formato' };
    }
    if (/\b(privado|empleados|clientes|estudiantes|interno|p\d+|zona parqueo|bahia|bahía)\b/.test(n)) {
      return { commercialBranch: 'Parking', commercialBranchDetail: 'Parking · pequeño / auxiliar', commercialScale: 'pequeno_auxiliar', commercialScaleLabel: 'Pequeño / auxiliar' };
    }
    return { commercialBranch: 'Parking', commercialBranchDetail: 'Parking · formato medio', commercialScale: 'mediano', commercialScaleLabel: 'Formato mediano' };
  }

  if (row.category === 'Concesionario') {
    return { commercialBranch: 'Automotriz', commercialBranchDetail: 'Automotriz · concesionario', commercialScale: 'grande', commercialScaleLabel: 'Gran formato' };
  }

  if (row.category === 'Grifo / estación de servicio') {
    return { commercialBranch: 'Movilidad', commercialBranchDetail: 'Movilidad · estación de servicio', commercialScale: 'mediano', commercialScaleLabel: 'Formato mediano' };
  }

  if (row.category === 'Cadena comida rápida') {
    return { commercialBranch: 'Consumo', commercialBranchDetail: 'Consumo · comida rápida', commercialScale: 'pequeno_auxiliar', commercialScaleLabel: 'Pequeño / auxiliar' };
  }

  if (row.category === 'Cadena café/restaurante') {
    return { commercialBranch: 'Consumo', commercialBranchDetail: 'Consumo · café / restaurante', commercialScale: 'pequeno_auxiliar', commercialScaleLabel: 'Pequeño / auxiliar' };
  }

  return base;
}

function taxonomyBranchPass(rows) {
  return rows.map((row) => {
    const tax = classifyCommercialTaxonomy(row);
    Object.assign(row, tax);

    if (tax.commercialScale === 'pequeno_auxiliar') {
      row.commercialReviewNotes = [...new Set([...(row.commercialReviewNotes || []), 'small_or_auxiliary_branch'] )];
      if (['Salud', 'Retail', 'Hotelería'].includes(tax.commercialBranch)) {
        row.viabilityScore = Math.min(row.viabilityScore || 0, 55);
      }
      if (tax.commercialBranch === 'Educación') {
        row.viabilityScore = Math.min(row.viabilityScore || 0, 40);
      }
    }

    if (tax.commercialScale === 'mediano') {
      if (tax.commercialBranch === 'Salud') {
        row.commercialReviewNotes = [...new Set([...(row.commercialReviewNotes || []), 'medium_health_branch'] )];
        row.viabilityScore = Math.min(row.viabilityScore || 0, 78);
      }
      if (tax.commercialBranch === 'Retail') {
        row.commercialReviewNotes = [...new Set([...(row.commercialReviewNotes || []), 'medium_retail_branch'] )];
        row.viabilityScore = Math.min(row.viabilityScore || 0, 82);
      }
      if (tax.commercialBranch === 'Hotelería') {
        row.commercialReviewNotes = [...new Set([...(row.commercialReviewNotes || []), 'medium_hospitality_branch'] )];
        row.viabilityScore = Math.min(row.viabilityScore || 0, 80);
      }
    }

    return recomputePriorityAfterSanity(row);
  });
}

function recomputeEvinkaPriorityByCategory(row) {
  if (row.viabilityTier === 'discard') return 'descartar';

  if (row.category === 'Parqueadero público') {
    if ((row.commercialReviewNotes || []).some((n) => /internal_or_private_parking_not_public_host|operational_or_transport_asset_not_host|brand_or_place_name_without_parking_signal|parking_category_without_parking_anchor_and_generic_address|slot_or_operational_label_not_actionable_host/.test(n))) {
      return 'descartar';
    }
    if ((row.commercialReviewNotes || []).some((n) => /generic_parking_name_without_anchor|generic_parking_without_specific_address|host_anchor_without_public_parking_signal/.test(n))) {
      return row.viabilityScore >= 70 ? 'revisar' : 'descartar';
    }
    return row.viabilityScore >= 80 ? 'atacar_ya' : row.viabilityScore >= 60 ? 'revisar' : 'descartar';
  }

  if (row.category === 'Clínica / hospital') {
    const touched = (row.commercialReviewNotes || []).some((n) => /health_subunit_or_service_point_with_generic_address|occupational_or_auxiliary_health_site|health_service_or_attention_unit_requires_validation|small_or_auxiliary_branch|medium_health_branch/.test(n));
    if (!touched) return row.evinkaPriority || (row.viabilityTier === 'high' ? 'atacar_ya' : 'revisar');
    if (touched) {
      return row.viabilityTier === 'high' || row.viabilityTier === 'medium' ? 'revisar' : 'descartar';
    }
  }

  if (row.category === 'Centro comercial / strip mall') {
    const touched = (row.commercialReviewNotes || []).some((n) => /government_or_operational_commerce_area_not_mall|mall_subzone_or_phase_with_generic_address|small_or_auxiliary_branch|medium_retail_branch/.test(n));
    if (!touched) return row.evinkaPriority || (row.viabilityTier === 'high' ? 'atacar_ya' : 'revisar');
    if (touched) {
      return row.viabilityTier === 'high' || row.viabilityTier === 'medium' ? 'revisar' : 'descartar';
    }
  }

  if (row.category === 'Hotel') {
    const touched = (row.commercialReviewNotes || []).some((n) => /hotel_subtower_or_zone_with_generic_address|small_or_auxiliary_branch|medium_hospitality_branch/.test(n));
    if (!touched) return row.evinkaPriority || (row.viabilityTier === 'high' ? 'atacar_ya' : 'revisar');
    if (touched) {
      return row.viabilityTier === 'high' || row.viabilityTier === 'medium' ? 'revisar' : 'descartar';
    }
  }

  if (row.category === 'Universidad') {
    const touched = (row.commercialReviewNotes || []).some((n) => /university_subunit_not_main_host/.test(n));
    if (!touched) return row.evinkaPriority || (row.viabilityTier === 'high' ? 'atacar_ya' : 'revisar');
    if (touched) {
      return 'descartar';
    }
  }

  return row.evinkaPriority || (row.viabilityScore >= 80 ? 'atacar_ya' : row.viabilityScore >= 60 ? 'revisar' : 'descartar');
}

function recomputePriorityAfterSanity(row) {
  row.viabilityScore = Math.max(0, Math.min(100, Math.round(row.viabilityScore || 0)));
  row.viabilityTier = viabilityTier(row.viabilityScore);
  row.recommendedAction = recommendedAction(row.viabilityScore);
  row.publicChargingCandidate = row.viabilityScore >= 60;
  row.evinkaPriority = recomputeEvinkaPriorityByCategory(row);
  row.evinkaPremiumCandidate = row.evinkaPriority === 'atacar_ya';

  const evAffinityAdvancedScore = Math.round(((row.viabilityScore || 0) / 100) * 25);
  row.evAffinityAdvancedScore = evAffinityAdvancedScore;
  row.superPremiumScore = Math.max(0, Math.min(100,
    (row.populationDemandScore || 0) +
    (row.activityDensityScore || 0) +
    evAffinityAdvancedScore +
    (row.hostImportanceScore || 0) +
    (row.newsSignalScore || 0)
  ));
  const tier = superTier(row.superPremiumScore, row.evinkaPriority);
  row.superPremiumTier = tier;
  row.superPremiumAction = tier === 'A' ? 'Atacar ya' : tier === 'B' ? 'Revisar pronto' : tier === 'C' ? 'Observar' : 'Descartar';
  return row;
}

function freshnessSanityPass(rows) {
  return rows.map((row) => {
    const n = norm([row.canonicalName, row.name, row.operator, row.address, ...(row.aliases || [])].join(' '));
    const genericAddress = isGenericAddress(row.address, row.city);

    if (row.category === 'Parqueadero público') {
    const parkingAnchor = /\b(parking|parqueaderos?|estacionamientos?|aparcamientos?|aparcar|patio|patios|bahia|bahía|zona parqueo|garage|garaje|valet|park|cuadradero)\b/.test(n);
    const internalOps = /\b(administracion|administración|adminsitracion|transmilenio|sitp|taxis|taxi|police|policia|policía|secretaria|secretaría|movilidad|patio portal|patios de transito|patios de tránsito|etib|gmovil|gmovil|familia|empleados|estudiantes|profesores|rectoria|rectoría|publico|p\d+\b)\b/.test(n);
    const nonParkingBrand = /\b(mcdonalds?|good year|goodyear|quirustetic|perficient|laika|imacon|mi prado|los diamantes|castellana|club de ejecutivos|capricentro|mayorca|panaderia|panadería|farmatodo|fruvar|supermercado lider|universidad santiago de cali|unicatolica|unicatolica|policia nacional|policia|police|arena plaza)\b/.test(n);
    const hostBrandParking = /\b(jumbo|makro|homecenter|alkosto|carrefour|exito|éxito|olimpica|olímpica|viva|terminal|hospital|clinica|clínica|teatro|museo|home sentry|imbanaco|casa teatro|universidad|portal norte|patio calle|patio portal)\b/.test(n);
    const parkingOperatorBrand = /\b(cityparking|geoparking|parkingspot|apar car|aparcar)\b/.test(n);
    if (/\b(privado|private|empleados|empleado|clientes|cliente|estudiantes|profesores|rectoria|rectoría|interno|interna|internos|internas)\b/.test(n)) {
      applyFreshnessSanityPenalty(row, 72, 'internal_or_private_parking_not_public_host');
    }
    if (/\b(sin nombre|desconocido|wikidata|parking|parqueadero|estacionamiento|aparcamiento|mr parking)\b/.test(n) && !/\b(cc|centro comercial|mall|hotel|hospital|clinica|clínica|universidad|homecenter|carrefour|jumbo|makro|exito|éxito|olimpica|olímpica|viva|teatro|museo|terminal|aeropuerto|fundacion santa fe|imbanaco|casa teatro|club campestre|home sentry|makro\/homecenter)\b/.test(n)) {
      applyFreshnessSanityPenalty(row, 46, 'generic_parking_name_without_anchor');
    }
    if (genericAddress && /\b(parking|parqueadero|estacionamiento|aparcamiento)\b/.test(n) && !/\b(98|100|106|127|140|cc|centro comercial|mall|hotel|hospital|clinica|clínica|universidad|homecenter|carrefour|jumbo|makro|exito|éxito|olimpica|olímpica|viva|teatro|museo|terminal|aeropuerto|fundacion santa fe|imbanaco|casa teatro|club campestre|home sentry)\b/.test(n)) {
      applyFreshnessSanityPenalty(row, 28, 'generic_parking_without_specific_address');
    }
    if (internalOps) {
      applyFreshnessSanityPenalty(row, 85, 'operational_or_transport_asset_not_host');
    }
    if (!parkingAnchor && nonParkingBrand && genericAddress) {
      applyFreshnessSanityPenalty(row, 82, 'brand_or_place_name_without_parking_signal');
    }
    if (!parkingAnchor && hostBrandParking) {
      applyFreshnessSanityPenalty(row, 38, 'host_anchor_without_public_parking_signal');
    }
    if (genericAddress && !parkingAnchor && !parkingOperatorBrand) {
      applyFreshnessSanityPenalty(row, 74, 'parking_category_without_parking_anchor_and_generic_address');
    }
    if (/\b(p\d+|zona parqueo pago|bahia de parqueo|bahia parqueo|publico|publico\b)\b/.test(n)) {
      applyFreshnessSanityPenalty(row, 78, 'slot_or_operational_label_not_actionable_host');
    }
    }

    if (row.category === 'Clínica / hospital') {
      const weakHealthUnit = /\b(unidad|atencion|atención|servicios|ocupacional|promocion|promoción|prevencion|prevención|ambulancia|diagnostico|diagnóstico|integrales|integral|basica|básica|intermedia|primaria|upa|uap)\b/.test(n);
      const strongHealthAnchor = /\b(hospital|clinica|clínica|fundacion|fundación|centro medico|centro médico|medical center|santa fe|imbanaco|cardioinfantil)\b/.test(n);
      if (genericAddress && weakHealthUnit && !strongHealthAnchor) {
        applyFreshnessSanityPenalty(row, 55, 'health_subunit_or_service_point_with_generic_address');
      }
      if (/\b(ocupacional|ambulancia|diagnostico|diagnóstico|promocion|promoción|prevencion|prevención)\b/.test(n) && genericAddress) {
        applyFreshnessSanityPenalty(row, 32, 'occupational_or_auxiliary_health_site');
      }
      if (/\b(unidad|atencion|atención|servicios)\b/.test(n) && genericAddress) {
        applyFreshnessSanityPenalty(row, 22, 'health_service_or_attention_unit_requires_validation');
      }
    }

    if (row.category === 'Centro comercial / strip mall') {
      if (/\b(ministerio|secretaria|secretaría|gobierno|alcaldia|alcaldía)\b/.test(n)) {
        applyFreshnessSanityPenalty(row, 78, 'government_or_operational_commerce_area_not_mall');
      }
      if (genericAddress && /\b(portal|zona|etapa)\b/.test(n) && !/\b(centro comercial|mall|outlet|plaza|shopping)\b/.test(n)) {
        applyFreshnessSanityPenalty(row, 44, 'mall_subzone_or_phase_with_generic_address');
      }
    }

    if (row.category === 'Hotel') {
      if (genericAddress && /\b(portal|torre|zona|bloque)\b/.test(n) && !/\b(hotel|hostal|hostel|inn|suite|suites|estelar|tequendama|marriott|hilton|ibis|nh|wyndham)\b/.test(n)) {
        applyFreshnessSanityPenalty(row, 60, 'hotel_subtower_or_zone_with_generic_address');
      }
    }

    if (row.category === 'Universidad') {
      if (genericAddress && /\b(bloque|facultad|edificio|modulo|módulo|porteria|portería|biblioteca|laboratorio|auditorio|torre|pabellon|pabellón)\b/.test(n)) {
        applyFreshnessSanityPenalty(row, 82, 'university_subunit_not_main_host');
      }
    }

    return recomputePriorityAfterSanity(row);
  });
}

function proximityDedupe(rows) {
  const used = new Set();
  const out = [];
  const audit = [];
  for (let i = 0; i < rows.length; i += 1) {
    const base = rows[i];
    if (used.has(base.id)) continue;
    const cluster = [base];
    used.add(base.id);
    let changed = true;
    while (changed) {
      changed = false;
      for (let j = 0; j < rows.length; j += 1) {
        const cand = rows[j];
        if (used.has(cand.id)) continue;
        if (cluster.some((item) => mergeable(item, cand))) {
          cluster.push(cand);
          used.add(cand.id);
          changed = true;
        }
      }
    }
    if (cluster.length === 1) {
      out.push(base);
      continue;
    }
    const best = [...cluster].sort((a, b) => ((b.superPremiumScore || 0) + (b.rawCount || 1)) - ((a.superPremiumScore || 0) + (a.rawCount || 1)))[0];
    out.push({
      ...best,
      aliases: [...new Set(cluster.flatMap((r) => [r.canonicalName, r.name, ...(r.aliases || [])].filter(Boolean)))],
      aliasCount: [...new Set(cluster.flatMap((r) => [r.canonicalName, r.name, ...(r.aliases || [])].filter(Boolean)))].length,
      rawIds: [...new Set(cluster.flatMap((r) => [r.id, ...(r.rawIds || [])].filter(Boolean)))],
      rawCount: cluster.reduce((sum, r) => sum + (r.rawCount || 1), 0),
      lat: Number((cluster.reduce((sum, r) => sum + r.lat, 0) / cluster.length).toFixed(7)),
      lng: Number((cluster.reduce((sum, r) => sum + r.lng, 0) / cluster.length).toFixed(7)),
      consolidationMode: 'proximity_dedupe',
      reviewStatus: best.reviewStatus === 'approved_auto' ? 'review_light' : best.reviewStatus,
      reviewReasons: [...new Set([...(best.reviewReasons || []), `proximity_dedupe:${cluster.length}`])],
    });
    audit.push({ keptId: best.id, keptName: best.canonicalName, city: best.city, category: best.category, size: cluster.length });
  }
  return { rows: out, audit };
}

function summarize(rows) {
  const byCity = {};
  const byProvince = {};
  const counts = rows.reduce((acc, row) => {
    acc.super[row.superPremiumTier] = (acc.super[row.superPremiumTier] || 0) + 1;
    acc.premium[row.evinkaPriority] = (acc.premium[row.evinkaPriority] || 0) + 1;
    acc.viability[row.viabilityTier] = (acc.viability[row.viabilityTier] || 0) + 1;
    byCity[row.city] ||= { total: 0, super: { A: 0, B: 0, C: 0, descartar: 0 } };
    byCity[row.city].total += 1;
    byCity[row.city].super[row.superPremiumTier] += 1;
    const pkey = `${row.city} · ${row.provinceCommercial}`;
    byProvince[pkey] ||= { city: row.city, province: row.provinceCommercial, total: 0, super: { A: 0, B: 0, C: 0, descartar: 0 } };
    byProvince[pkey].total += 1;
    byProvince[pkey].super[row.superPremiumTier] += 1;
    return acc;
  }, {
    super: { A: 0, B: 0, C: 0, descartar: 0 },
    premium: { atacar_ya: 0, revisar: 0, descartar: 0 },
    viability: { high: 0, medium: 0, low: 0, discard: 0 },
  });
  return { counts, byCity, byProvince: Object.values(byProvince).sort((a, b) => b.total - a.total) };
}

const bogota = addProvince(JSON.parse(await readFile(EXISTING_BOGOTA, 'utf8')).map((row) => ({
  ...row,
  officialDivisionType: 'localidad',
  officialDivisionName: row.localityName || 'Bogotá por validar',
  officialDivisionCode: row.localityCode || null,
  officialDivisionSource: 'existing_bogota_assignment',
})));
const extraction = [];
for (const city of CITIES) extraction.push(await extractCity(city));
const extracted = extraction.flatMap((entry) => entry.rows);
const cleaned = cleanRows(extracted);
const reviewed = annotateReview(cleaned);
const scored = scoreViability(reviewed);
const commercial = refineCommercial(scored);
const premiumBase = buildPremium(commercial);
const territoriesByCity = new Map();
for (const city of CITIES) territoriesByCity.set(city.city, await fetchOfficialDivisions(city));
const premium = premiumBase.map((row) => {
  const city = CITIES.find((item) => item.city === row.city);
  if (!city) return row;
  return assignOfficialDivisions([row], city, territoriesByCity.get(city.city))[0];
});
const superRows = buildGenericSuper(premium);
const dedupedOther = proximityDedupe(superRows);
const sameComplexOther = sameComplexDedupe(dedupedOther.rows);
const sameComplexBogota = sameComplexDedupe(bogota);
const finalRows = taxonomyBranchPass(freshnessSanityPass([...sameComplexBogota.rows, ...sameComplexOther.rows])).sort((a, b) => a.city.localeCompare(b.city, 'es') || a.category.localeCompare(b.category, 'es') || (a.canonicalName || a.name).localeCompare((b.canonicalName || b.name), 'es'));
const summary = summarize(finalRows);

await mkdir('/root/.openclaw/workspace/apps/mapco-web/public/data', { recursive: true });
await mkdir('/root/.openclaw/workspace/deliverables', { recursive: true });
await writeFile(OUTPUT, JSON.stringify(finalRows, null, 2));
await writeFile(SUMMARY, JSON.stringify({
  generatedAt: new Date().toISOString(),
  total: finalRows.length,
  methodology: {
    bogota: 'Se conserva la capa super premium deduplicada ya validada.',
    medellin_cali: 'Extracción OSM + limpieza + review + scoring comercial + premium + super premium genérico por provincia comercial.',
    officialDivision: 'División oficial de ciudad: localidad en Bogotá, comuna/corregimiento donde aplique en Medellín y Cali.',
    taxonomy: 'Clasificación comercial adicional por rama y tamaño (gran formato / medio / pequeño-auxiliar) para separar mejor salud, retail, educación y hotelería.',
  },
  extractionSummary: extraction.flatMap((entry) => entry.summary),
  medellinCaliRawTotal: extracted.length,
  medellinCaliCanonicalTotal: cleaned.length,
  medellinCaliDedupedTotal: sameComplexOther.rows.length,
  medellinCaliMergedClusters: dedupedOther.audit.length + sameComplexOther.audit.length,
  bogotaSameComplexMerges: sameComplexBogota.audit.length,
  ...summary,
}, null, 2));
await writeFile(AUDIT, JSON.stringify({
  generatedAt: new Date().toISOString(),
  bogotaTotal: sameComplexBogota.rows.length,
  medellinCaliRawTotal: extracted.length,
  medellinCaliCanonicalTotal: cleaned.length,
  medellinCaliDedupedTotal: sameComplexOther.rows.length,
  medellinCaliMergedClusters: dedupedOther.audit.length + sameComplexOther.audit.length,
  sampleMerged: [...sameComplexBogota.audit, ...dedupedOther.audit, ...sameComplexOther.audit].slice(0, 150),
}, null, 2));
console.log(JSON.stringify({
  bogota: sameComplexBogota.rows.length,
  medellinCaliRawTotal: extracted.length,
  medellinCaliCanonicalTotal: cleaned.length,
  medellinCaliDedupedTotal: sameComplexOther.rows.length,
  total: finalRows.length,
  cities: [...new Set(finalRows.map((row) => row.city))],
  counts: summary.counts,
}, null, 2));
