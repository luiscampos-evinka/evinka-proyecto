import { readFile, writeFile } from 'node:fs/promises';

const INPUT = '/root/.openclaw/workspace/apps/mapco-web/public/data/places-reviewed-sensitive-final.json';
const OUTPUT = '/root/.openclaw/workspace/apps/mapco-web/public/data/places-scored.json';
const SUMMARY = '/root/.openclaw/workspace/apps/mapco-web/public/data/summary-bogota-scored.json';

const rows = JSON.parse(await readFile(INPUT, 'utf8'));

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

function norm(text) {
  return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
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
  if (/bogot[aá],? colombia/i.test(row.address || '')) penalty += 2;
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

const scored = rows.map((row) => {
  const profile = CATEGORY_PROFILES[row.category] || { scale: 10, dwell: 10, fit: 10, commercial: 10 };
  const components = {
    parkingAccessScore: parkingScore(row),
    siteScaleScore: Math.min(25, profile.scale + scaleBoost(row)),
    dwellTimeScore: Math.min(25, profile.dwell),
    publicChargingFitScore: Math.min(20, profile.fit),
    commercialPotentialScore: Math.min(20, profile.commercial),
  };
  let score = Object.values(components).reduce((a, b) => a + b, 0) - qualityPenalty(row);

  // Hard downgrades for small-format categories.
  if (row.category === 'Cadena café/restaurante') score -= 12;
  if (row.category === 'Cadena comida rápida') score -= 8;
  if (row.category === 'Grifo / estación de servicio') score -= 6;

  // Strong boosts for obviously public-charging-friendly categories.
  if (['Centro comercial / strip mall', 'Hotel', 'Parqueadero público', 'Universidad'].includes(row.category)) score += 4;

  score = Math.max(0, Math.min(100, Math.round(score)));
  const tier = viabilityTier(score);
  return {
    ...row,
    ...components,
    viabilityScore: score,
    viabilityTier: tier,
    recommendedAction: recommendedAction(score),
    publicChargingCandidate: score >= 60,
  };
});

const counts = scored.reduce((acc, row) => {
  acc[row.viabilityTier] = (acc[row.viabilityTier] || 0) + 1;
  if (!acc.byCategory[row.category]) acc.byCategory[row.category] = { high: 0, medium: 0, low: 0, discard: 0 };
  acc.byCategory[row.category][row.viabilityTier] += 1;
  return acc;
}, { high: 0, medium: 0, low: 0, discard: 0, byCategory: {} });

await writeFile(OUTPUT, JSON.stringify(scored, null, 2));
await writeFile(SUMMARY, JSON.stringify({ generatedAt: new Date().toISOString(), total: scored.length, counts }, null, 2));
console.log(JSON.stringify({ total: scored.length, counts }, null, 2));
