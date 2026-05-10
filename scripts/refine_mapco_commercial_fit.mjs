import { readFile, writeFile } from 'node:fs/promises';

const INPUT = '/root/.openclaw/workspace/apps/mapco-web/public/data/places-scored.json';
const OUTPUT = '/root/.openclaw/workspace/apps/mapco-web/public/data/places-commercial-final.json';
const SUMMARY = '/root/.openclaw/workspace/apps/mapco-web/public/data/summary-bogota-commercial-final.json';
const AUDIT = '/root/.openclaw/workspace/deliverables/mapco-bogota-commercial-cleanup-actions.json';

const rows = JSON.parse(await readFile(INPUT, 'utf8'));
const actions = [];

function norm(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function has(re, row) {
  const hay = [row.canonicalName, row.name, row.operator, row.address, ...(row.aliases || [])].join(' ');
  return re.test(hay);
}

function isChainSupermarket(row) {
  return has(/\b(exito|carulla|jumbo|makro|pricesmart|olimpica|homecenter|alkosto|metro)\b/i, row);
}

function isDiscountChain(row) {
  return has(/\b(d1|ara|oxxo|justo\s*&?\s*bueno|justo y bueno)\b/i, row);
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

function applyPenalty(row, points, reason, minScore = 0) {
  const before = row.viabilityScore || 0;
  row.viabilityScore = Math.max(minScore, before - points);
  row.commercialReviewNotes = [...new Set([...(row.commercialReviewNotes || []), reason])];
  actions.push({ id: row.id, name: row.canonicalName, category: row.category, reason, before, after: row.viabilityScore });
}

for (const row of rows) {
  const n = norm([row.canonicalName, row.name, row.operator, row.address, ...(row.aliases || [])].join(' '));

  // Micro-retail and tiny neighborhood commerce hidden under supermercado.
  if (row.category === 'Supermercado') {
    if (/(minimarket|minimercado|droguer|papeler|miscel|\btienda\b|viver|abarrot|naturista|de la esquina|el barrio)/.test(n) && !isChainSupermarket(row) && !isDiscountChain(row)) {
      applyPenalty(row, 55, 'micro_retail_supermarket_false_positive');
    }
    if (isDiscountChain(row)) {
      applyPenalty(row, 28, 'discount_chain_requires_site_size_review');
    }
    if (/\bedificio\b/.test(n)) {
      applyPenalty(row, 45, 'building_not_actionable_supermarket_site');
    }
  }

  // School noise inside universities/parkings.
  if (/\bcolegio\b/.test(n) && row.category === 'Universidad' && !/^universidad colegio mayor/.test(norm(row.canonicalName))) {
    applyPenalty(row, 70, 'school_misclassified_as_university');
  }
  if (/\b(colegio|jardin|guarderia|kindergarten)\b/.test(n) && row.category === 'Parqueadero público') {
    applyPenalty(row, 65, 'school_parking_not_public_charging_host');
  }

  // Parking lots that look internal/private/residential rather than host candidates.
  if (row.category === 'Parqueadero público') {
    if (/\b(edificio|torre|ph|residencial|conjunto)\b/.test(n)) {
      applyPenalty(row, 60, 'private_building_parking_false_positive');
    }
    if (/\b(comercial la papelera|papelera)\b/.test(n)) {
      applyPenalty(row, 55, 'small_commercial_parking_false_positive');
    }
  }

  // Small medical points are not the same as a hospital host.
  if (row.category === 'Clínica / hospital') {
    if (/(droguer|consultor|odont|laborator|urgenc|\bips\b|unidad de urgencias|centro medico y odontologico)/.test(n) && !/(hospital|fundacion|clinica)/.test(n)) {
      applyPenalty(row, 42, 'small_medical_point_not_major_host');
    }
    if (/(droguer|consultor|odont|laborator)/.test(n)) {
      applyPenalty(row, 28, 'medical_subscale_site_requires_manual_validation');
    }
  }

  // Mixed-use building sold as mall.
  if (row.category === 'Centro comercial / strip mall' && /\bedificio\b/.test(n)) {
    applyPenalty(row, 30, 'mixed_use_building_not_top_tier_mall');
  }

  // Fast food small local inside another venue.
  if (row.category === 'Cadena comida rápida' && /\b(local|empanadas|broaster|tienda)\b/.test(n)) {
    applyPenalty(row, 18, 'small_fast_food_point');
  }

  // Administrative / virtual university sites should not be top-tier.
  if (row.category === 'Universidad' && /\b(administrativa|virtual|distancia)\b/.test(n)) {
    applyPenalty(row, 30, 'administrative_or_virtual_campus_lower_priority');
  }

  row.viabilityScore = Math.max(0, Math.min(100, Math.round(row.viabilityScore || 0)));
  row.viabilityTier = viabilityTier(row.viabilityScore);
  row.recommendedAction = recommendedAction(row.viabilityScore);
  row.publicChargingCandidate = row.viabilityScore >= 60;
}

const counts = rows.reduce((acc, row) => {
  acc[row.viabilityTier] = (acc[row.viabilityTier] || 0) + 1;
  if (!acc.byCategory[row.category]) acc.byCategory[row.category] = { high: 0, medium: 0, low: 0, discard: 0 };
  acc.byCategory[row.category][row.viabilityTier] += 1;
  return acc;
}, { high: 0, medium: 0, low: 0, discard: 0, byCategory: {} });

await writeFile(OUTPUT, JSON.stringify(rows, null, 2));
await writeFile(SUMMARY, JSON.stringify({ generatedAt: new Date().toISOString(), total: rows.length, counts, actionsCount: actions.length }, null, 2));
await writeFile(AUDIT, JSON.stringify(actions, null, 2));
console.log(JSON.stringify({ total: rows.length, counts, actionsCount: actions.length }, null, 2));
