import { readFile, writeFile } from 'node:fs/promises';

const INPUT = '/root/.openclaw/workspace/apps/mapco-web/public/data/places-reviewed-final.json';
const OUTPUT = '/root/.openclaw/workspace/apps/mapco-web/public/data/places-reviewed-sensitive-final.json';
const SUMMARY = '/root/.openclaw/workspace/apps/mapco-web/public/data/summary-bogota-reviewed-sensitive-final.json';
const AUDIT = '/root/.openclaw/workspace/deliverables/mapco-bogota-sensibles-final-actions.json';

const rows = JSON.parse(await readFile(INPUT, 'utf8'));
const removed = new Set();
const actions = [];

function norm(text) {
  return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
}
function uniq(arr) { return [...new Set(arr.filter(Boolean))]; }
function find(pred) { return rows.find((r) => !removed.has(r.id) && pred(r)); }
function update(row, patch, reason) {
  if (!row || removed.has(row.id)) return;
  Object.assign(row, patch);
  row.reviewReasons = uniq([...(row.reviewReasons || []), reason]);
  actions.push({ type: 'update', name: row.canonicalName, reason, patch });
}
function suppress(row, reason) {
  if (!row || removed.has(row.id)) return;
  removed.add(row.id);
  actions.push({ type: 'suppress', name: row.canonicalName, reason });
}

// ---- Malls / strip malls ----
for (const [pattern, name] of [
  [/^C\.C\. Belmira Plaza$/i, 'Belmira Plaza'],
  [/^C\.C\. Puentelargo$/i, 'Puentelargo'],
  [/Gran Estaci[oó]n Costado Esfera/i, 'Gran Estación'],
  [/^Palatino$/i, 'Centro Comercial Palatino'],
  [/^Plaza 80$/i, 'Centro Comercial Plaza 80'],
  [/Unicentro de Occidente/i, 'Centro Comercial Unicentro de Occidente'],
]) {
  const row = find((r) => r.category === 'Centro comercial / strip mall' && pattern.test(r.canonicalName || ''));
  if (row) update(row, { canonicalName: name, name, reviewStatus: 'review_light', commercialReady: false }, 'validated_mall_name');
}
suppress(find((r) => r.category === 'Centro comercial / strip mall' && norm(r.canonicalName) === 'centro comercial'), 'generic_non_actionable_name');
update(find((r) => r.category === 'Centro comercial / strip mall' && /Edificio Britalia Comercial/i.test(r.canonicalName || '')), { reviewStatus: 'review_light', commercialReady: false }, 'kept_as_mixed_use_commercial_site');

// ---- Hotels ----
for (const [pattern, name] of [
  [/Casa Hotel La Estancia/i, 'Casa Hotel La Estancia'],
  [/Hotel Augusta/i, 'Hotel Augusta'],
  [/Hotel el Expositor/i, 'Hotel El Expositor'],
  [/Hotel Fontana Plaza/i, 'Hotel Fontana Plaza'],
]) {
  const row = find((r) => r.category === 'Hotel' && pattern.test(r.canonicalName || ''));
  if (row) update(row, { canonicalName: name, name, reviewStatus: 'review_light', commercialReady: false }, 'validated_hotel_name');
}
suppress(find((r) => r.category === 'Hotel' && norm(r.canonicalName) === 'hotel'), 'generic_non_actionable_name');

// ---- Clinics / hospitals ----
for (const [pattern, patch, reason] of [
  [/^Aliansalud$/i, { reviewStatus: 'review_light', commercialReady: false }, 'validated_clinic_group' ],
  [/Centro M[eé]dico Dali/i, { reviewStatus: 'review_light', commercialReady: false }, 'validated_clinic_group' ],
  [/Cl[ií]nica de la Mujer/i, { reviewStatus: 'review_light', commercialReady: false }, 'validated_clinic_group' ],
  [/Cl[ií]nica Los Nogales/i, { canonicalName: 'Clínica Los Nogales', name: 'Clínica Los Nogales', reviewStatus: 'review_light', commercialReady: false }, 'validated_clinic_group' ],
  [/Cl[ií]nica Odontologica Jasban/i, { canonicalName: 'Clínica Odontológica Jasban', name: 'Clínica Odontológica Jasban', reviewStatus: 'review_light', commercialReady: false }, 'validated_clinic_group' ],
  [/orqu[ií]deas materno infantil colsubsidio/i, { canonicalName: 'Clínica Orquídeas Materno Infantil Colsubsidio', name: 'Clínica Orquídeas Materno Infantil Colsubsidio', reviewStatus: 'review_light', commercialReady: false }, 'validated_clinic_group' ],
  [/Colm[eé]dica sede Colina/i, { canonicalName: 'Colmédica - Sede Colina', name: 'Colmédica - Sede Colina', reviewStatus: 'review_light', commercialReady: false }, 'validated_clinic_branch' ],
  [/Edificio Ambulatorio - Fundaci[oó]n Santa Fe de Bogot[aá]/i, { canonicalName: 'Fundación Santa Fe de Bogotá', name: 'Fundación Santa Fe de Bogotá', reviewStatus: 'review_light', commercialReady: false }, 'validated_hospital_main' ],
  [/Fundaci[oó]n Cardio Infantil/i, { canonicalName: 'Fundación Cardio Infantil', name: 'Fundación Cardio Infantil', reviewStatus: 'review_light', commercialReady: false }, 'validated_hospital_main' ],
  [/Fundacion Medica de los Andes/i, { canonicalName: 'Fundación Médica de los Andes', name: 'Fundación Médica de los Andes', reviewStatus: 'review_light', commercialReady: false }, 'validated_clinic_group' ],
  [/Hospital Universitario Cl[ií]nica San Rafael/i, { canonicalName: 'Hospital Universitario Clínica San Rafael', name: 'Hospital Universitario Clínica San Rafael', reviewStatus: 'review_light', commercialReady: false }, 'validated_hospital_main' ],
  [/Instituto Colombiano del Sistema Nervioso Cl[ií]nica Monserrat/i, { canonicalName: 'Instituto Colombiano del Sistema Nervioso - Clínica Monserrat', name: 'Instituto Colombiano del Sistema Nervioso - Clínica Monserrat', reviewStatus: 'review_light', commercialReady: false }, 'validated_clinic_group' ],
  [/Instituto de Ortoped[ií]a Infantil Roosevelt - Sede Propace/i, { canonicalName: 'Instituto Roosevelt - Sede Propace', name: 'Instituto Roosevelt - Sede Propace', reviewStatus: 'review_light', commercialReady: false }, 'validated_clinic_branch' ],
  [/La Carolina Centro M[eé]dico/i, { canonicalName: 'La Carolina Centro Médico', name: 'La Carolina Centro Médico', reviewStatus: 'review_light', commercialReady: false }, 'validated_clinic_group' ],
  [/Laboratorio Cl[ií]nico G[oó]mez Vesga/i, { reviewStatus: 'review_light', commercialReady: false }, 'validated_clinic_branch' ],
  [/Unidad de Urgencias EPS Sanitas/i, { reviewStatus: 'review_light', commercialReady: false }, 'validated_urgent_care_site' ],
  [/UPA 26 Alcala Muzu/i, { canonicalName: 'UPA 26 Alcalá Muzu', name: 'UPA 26 Alcalá Muzu', reviewStatus: 'review_light', commercialReady: false }, 'validated_healthcare_branch' ],
  [/UPA [ÁA]lamos/i, { canonicalName: 'UPA Álamos', name: 'UPA Álamos', reviewStatus: 'review_light', commercialReady: false }, 'validated_healthcare_branch' ],
  [/IMEVI sede Galerias/i, { canonicalName: 'IMEVI - Sede Galerías', name: 'IMEVI - Sede Galerías', reviewStatus: 'review_light', commercialReady: false }, 'validated_clinic_branch' ],
]) {
  const row = find((r) => r.category === 'Clínica / hospital' && pattern.test(r.canonicalName || ''));
  if (row) update(row, patch, reason);
}

for (const pattern of [
  /^Bloque N\/ Santa Barbara$/i,
  /Centro de Urgencias Argenitna/i,
  /Consultorio Medico Familliar/i,
  /Consultorio Radiologico/i,
  /Consultorios Country/i,
  /Consultorios Medicos/i,
  /Curia Provincial Orden Hospitalaria de San Juan de Dios/i,
  /Edificio El Bosque/i,
]) {
  const row = find((r) => r.category === 'Clínica / hospital' && pattern.test(r.canonicalName || ''));
  if (row) suppress(row, 'non_actionable_subunit_or_ambiguous_medical_point');
}

const finalRows = rows.filter((r) => !removed.has(r.id));
const counts = finalRows.reduce((acc, row) => {
  acc[row.reviewStatus] = (acc[row.reviewStatus] || 0) + 1;
  if (!acc.byCategory[row.category]) acc.byCategory[row.category] = {};
  acc.byCategory[row.category][row.reviewStatus] = (acc.byCategory[row.category][row.reviewStatus] || 0) + 1;
  return acc;
}, { byCategory: {} });

await writeFile(OUTPUT, JSON.stringify(finalRows, null, 2));
await writeFile(SUMMARY, JSON.stringify({ generatedAt: new Date().toISOString(), total: finalRows.length, counts, actionsCount: actions.length }, null, 2));
await writeFile(AUDIT, JSON.stringify(actions, null, 2));
console.log(JSON.stringify({ total: finalRows.length, actionsCount: actions.length, counts }, null, 2));
