import { readFile, writeFile } from 'node:fs/promises';

const INPUT = '/root/.openclaw/workspace/apps/mapco-web/public/data/places-super-premium.json';
const OUTPUT = '/root/.openclaw/workspace/apps/mapco-web/public/data/places-super-premium-deduped.json';
const SUMMARY = '/root/.openclaw/workspace/apps/mapco-web/public/data/summary-bogota-super-premium-deduped.json';
const AUDIT = '/root/.openclaw/workspace/deliverables/mapco-bogota-proximity-dedupe-audit.json';

const rows = JSON.parse(await readFile(INPUT, 'utf8'));

function norm(s = '') {
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function hav(a, b, c, d) {
  const R = 6371;
  const dLat = (c - a) * Math.PI / 180;
  const dLng = (d - b) * Math.PI / 180;
  const q = Math.sin(dLat / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
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
  const ratio = overlap / Math.max(sa.size, sb.size, 1);
  return ratio >= 0.8;
}

function mergeable(a, b) {
  if (a.category !== b.category) return false;
  const d = hav(a.lat, a.lng, b.lat, b.lng) * 1000;
  if (d > 120) return false;
  if (!similarName(a.canonicalName || a.name, b.canonicalName || b.name)) return false;

  // More conservative for large chains and universities/hotels.
  const chainish = /starbucks|juan valdez|tostao|dunkin|mcdonald|subway|carulla|jumbo|exito|olimpica|d1|ara|hotel|universidad/i.test(
    [a.canonicalName, a.operator, a.brandGroup, b.canonicalName, b.operator, b.brandGroup].join(' ')
  );
  if (chainish && d > 90) return false;

  // Strong candidates: generic parking and exact same brand/name.
  return true;
}

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

  const best = [...cluster].sort((a, b) => {
    const scoreA = (a.superPremiumScore || 0) + (a.rawCount || 1);
    const scoreB = (b.superPremiumScore || 0) + (b.rawCount || 1);
    return scoreB - scoreA;
  })[0];

  const merged = {
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
  };

  audit.push({
    keptId: best.id,
    keptName: best.canonicalName,
    category: best.category,
    size: cluster.length,
    mergedIds: cluster.map((r) => r.id),
    mergedNames: cluster.map((r) => r.canonicalName),
  });
  out.push(merged);
}

const counts = out.reduce((acc, row) => {
  acc[row.superPremiumTier] = (acc[row.superPremiumTier] || 0) + 1;
  if (!acc.byCategory[row.category]) acc.byCategory[row.category] = { A: 0, B: 0, C: 0, descartar: 0 };
  acc.byCategory[row.category][row.superPremiumTier] += 1;
  return acc;
}, { A: 0, B: 0, C: 0, descartar: 0, byCategory: {} });

await writeFile(OUTPUT, JSON.stringify(out, null, 2));
await writeFile(SUMMARY, JSON.stringify({ generatedAt: new Date().toISOString(), total: out.length, counts, mergedClusters: audit.length }, null, 2));
await writeFile(AUDIT, JSON.stringify(audit, null, 2));
console.log(JSON.stringify({ totalBefore: rows.length, totalAfter: out.length, mergedClusters: audit.length, counts }, null, 2));
