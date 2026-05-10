import { readFile, writeFile } from 'node:fs/promises';

const INPUT = '/root/.openclaw/workspace/apps/mapco-web/public/data/places-clean.json';
const OUTPUT = '/root/.openclaw/workspace/apps/mapco-web/public/data/places-curated.json';
const SUMMARY = '/root/.openclaw/workspace/apps/mapco-web/public/data/summary-bogota-curated.json';

const SENSITIVE = new Set(['Universidad', 'Clínica / hospital', 'Centro comercial / strip mall', 'Hotel']);
const SUBUNIT_WORDS = [
  'facultad','bloque','torre','edificio','pabellon','pabellón','campus','sede','porteria','portería','entrada','auditorio','biblioteca','modulo','módulo','laboratorio','ala','piso','oficina','consultorio','urgencias','cultural','administrativa','admisiones','decanatura'
];
const BAD_GENERIC = [
  'universidad','hotel','hospital','clinica','clínica','centro comercial','mall','campus','facultad'
];

function norm(text) {
  return String(text || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
}
function hasSubunitWord(text) {
  const n = norm(text);
  return SUBUNIT_WORDS.some((w) => n.includes(w));
}
function isGenericName(text) {
  const n = norm(text);
  return BAD_GENERIC.includes(n);
}
function isGenericAddress(text) {
  const n = norm(text);
  return !n || n === 'bogota colombia' || n === 'bogota d c' || n === 'bogota d c colombia';
}
function conflictingAliases(row) {
  const aliases = (row.aliases || []).map(norm).filter(Boolean);
  const institutionish = aliases.filter((a) => /universidad|fundacion universitaria|politecnico|politecnico|escuela|academia|externado|javeriana|rosario|tadeo|catolica|catolica|santo tomas|santo tomás|unad|uniminuto|uniciencia|cooperativa/.test(a));
  return new Set(institutionish).size >= 2;
}

const rows = JSON.parse(await readFile(INPUT, 'utf8'));
const curated = rows.map((row) => {
  const reasons = [];
  if (SENSITIVE.has(row.category)) {
    if ((row.rawCount || 1) >= 3) reasons.push(`merged:${row.rawCount}`);
    else if ((row.rawCount || 1) === 2) reasons.push('merged:2');
    if (row.hasSubunits || hasSubunitWord(row.canonicalName) || (row.aliases || []).some(hasSubunitWord)) reasons.push('subunits');
    if (isGenericAddress(row.address)) reasons.push('generic_address');
    if (row.confidence !== 'high') reasons.push(`confidence:${row.confidence}`);
    if (isGenericName(row.canonicalName)) reasons.push('generic_name');
    if (conflictingAliases(row)) reasons.push('alias_conflict');
  }

  let reviewStatus = 'approved_auto';
  if (SENSITIVE.has(row.category)) {
    if (reasons.includes('alias_conflict') || reasons.includes('generic_name') || reasons.includes('subunits') || reasons.some((r) => r.startsWith('merged:')) && reasons.includes('generic_address')) {
      reviewStatus = 'review_critical';
    } else if (reasons.length) {
      reviewStatus = 'review_light';
    }
  }

  return {
    ...row,
    reviewReasons: reasons,
    reviewStatus,
    commercialReady: reviewStatus === 'approved_auto',
  };
});

const counts = curated.reduce((acc, row) => {
  acc[row.reviewStatus] = (acc[row.reviewStatus] || 0) + 1;
  if (!acc.byCategory[row.category]) acc.byCategory[row.category] = { approved_auto: 0, review_light: 0, review_critical: 0 };
  acc.byCategory[row.category][row.reviewStatus] += 1;
  return acc;
}, { approved_auto: 0, review_light: 0, review_critical: 0, byCategory: {} });

await writeFile(OUTPUT, JSON.stringify(curated, null, 2));
await writeFile(SUMMARY, JSON.stringify({ generatedAt: new Date().toISOString(), total: curated.length, counts }, null, 2));
console.log(JSON.stringify({ total: curated.length, counts }, null, 2));
