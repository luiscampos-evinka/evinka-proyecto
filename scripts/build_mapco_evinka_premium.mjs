import { readFile, writeFile } from 'node:fs/promises';

const INPUT = '/root/.openclaw/workspace/apps/mapco-web/public/data/places-commercial-final.json';
const OUTPUT = '/root/.openclaw/workspace/apps/mapco-web/public/data/places-evinka-premium.json';
const SUMMARY = '/root/.openclaw/workspace/apps/mapco-web/public/data/summary-bogota-evinka-premium.json';
const AUDIT = '/root/.openclaw/workspace/deliverables/mapco-bogota-evinka-premium-audit.json';

const rows = JSON.parse(await readFile(INPUT, 'utf8'));

function norm(text) {
  return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function haystack(row) {
  return [row.canonicalName, row.name, row.operator, row.address, ...(row.aliases || []), ...(row.commercialReviewNotes || [])].join(' ');
}

function has(re, row) {
  return re.test(haystack(row));
}

function isLargeRetail(row) {
  return /\b(exito|carulla|jumbo|makro|pricesmart|olimpica|homecenter|alkosto|metro)\b/.test(norm(haystack(row)));
}

function isDiscountRetail(row) {
  return /\b(d1|ara|oxxo|justo\s*&?\s*bueno|justo y bueno)\b/.test(norm(haystack(row)));
}

const actions = [];

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
  actions.push({ id: row.id, name: row.canonicalName, category: row.category, priority, rationale });
}

const counts = rows.reduce((acc, row) => {
  acc[row.evinkaPriority] = (acc[row.evinkaPriority] || 0) + 1;
  if (!acc.byCategory[row.category]) acc.byCategory[row.category] = { atacar_ya: 0, revisar: 0, descartar: 0 };
  acc.byCategory[row.category][row.evinkaPriority] += 1;
  return acc;
}, { atacar_ya: 0, revisar: 0, descartar: 0, byCategory: {} });

await writeFile(OUTPUT, JSON.stringify(rows, null, 2));
await writeFile(SUMMARY, JSON.stringify({ generatedAt: new Date().toISOString(), total: rows.length, counts }, null, 2));
await writeFile(AUDIT, JSON.stringify(actions, null, 2));
console.log(JSON.stringify({ total: rows.length, counts }, null, 2));
