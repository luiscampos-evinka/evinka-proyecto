const state = {
  rows: [],
  summary: null,
  filtered: [],
  exporting: false,
  booted: false,
  activeGroup: '',
  map: null,
  clusterer: null,
  markersLayer: [],
  markerById: new Map(),
  infoWindow: null,
  renderedMapRows: [],
  auth: {
    checked: false,
    authenticated: false,
    user: null,
    mode: 'login',
    step: 'credentials',
    submitting: false,
    email: '',
    password: '',
    showPassword: false,
    challengeId: null,
    maskedEmail: '',
    resetToken: null,
    resetShowPassword: false,
    resetPasswordDraft: '',
    resetConfirmPasswordDraft: '',
    error: '',
    message: '',
  },
};

const DEFAULT_COLOMBIA_BOUNDS = [
  [ -4.3, -79.3 ],
  [ 13.6, -66.7 ],
];

const debouncedApplyFilters = debounce(applyFilters, 180);

init().catch((error) => {
  console.error(error);
  showAuthError(`No pude iniciar MapCo: ${error.message || error}`);
  document.getElementById('resultsSummary').textContent = `Error cargando mapa: ${error.message || error}`;
});

async function init() {
  bindAuthUI();
  bindShellUI();
  await refreshSession();
  if (!state.auth.authenticated) return;
  await bootApp();
}

async function bootApp() {
  if (state.booted) {
    state.map?.invalidateSize?.();
    return;
  }
  if (!window.L?.map) throw new Error('No se pudo cargar Leaflet');
  const [rows, summary] = await Promise.all([
    fetchJson('./data/places-colombia-multicity.json'),
    fetchJson('./data/summary-colombia-multicity.json'),
  ]);
  state.rows = rows.map(enrichTerritoryRow);
  assignRelativeTerritorialTiers(state.rows);
  state.summary = summary;
  buildFilters();
  bindUI();
  createMap();
  applyFilters();
  window.addEventListener('resize', () => state.map?.invalidateSize?.());
  state.booted = true;
}

function buildFilters() {
  fillSelect('cityFilter', ['Todos', ...sortAlpha(unique(state.rows.map((r) => r.city)))]);
  updateDivisionFilterLabel();
  rebuildProvinceFilter();
  rebuildUbigeoSelect();
  rebuildCategorySelect();
  rebuildDataStateSelect();
  rebuildNseSelect();
  rebuildGoogleValidationSelect();
}

function rebuildUbigeoSelect() {
  const el = document.getElementById('ubigeoFilter');
  const current = el.value || 'Todos';
  const rows = filterRowsExcept('ubigeoFilter');
  const codes = sortAlpha(unique(state.rows.map((r) => r.ubigeo)));
  const counts = new Map();
  const labels = new Map();
  rows.forEach((row) => {
    counts.set(row.ubigeo, (counts.get(row.ubigeo) || 0) + 1);
    if (!labels.has(row.ubigeo)) labels.set(row.ubigeo, `${row.city} (${row.ubigeo})`);
  });
  state.rows.forEach((row) => {
    if (!labels.has(row.ubigeo)) labels.set(row.ubigeo, `${row.city} (${row.ubigeo})`);
  });
  const options = [['Todos', `Todos (${rows.length})`, false]];
  for (const code of codes) {
    const count = counts.get(code) || 0;
    options.push([code, `${labels.get(code) || code} (${count})`, count === 0 && current !== code]);
  }
  el.innerHTML = options.map(([value, label, disabled]) => `<option value="${escapeHtml(value)}"${disabled ? ' disabled' : ''}>${escapeHtml(label)}</option>`).join('');
  el.value = options.some(([value]) => value === current) ? current : 'Todos';
}

function rebuildProvinceFilter() {
  const city = document.getElementById('cityFilter')?.value || 'Todos';
  const el = document.getElementById('provinceFilter');
  const current = el.value || 'Todos';
  const allRows = city === 'Todos' ? state.rows : state.rows.filter((row) => row.city === city);
  const filteredRows = filterRowsExcept('provinceFilter').filter((row) => city === 'Todos' || row.city === city);
  const counts = new Map();
  filteredRows.forEach((row) => {
    const key = divisionFilterValue(row, city);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const values = ['Todos', ...sortAlpha(unique(allRows.map((row) => divisionFilterValue(row, city))))];
  el.innerHTML = values.map((value) => {
    const count = value === 'Todos' ? filteredRows.length : (counts.get(value) || 0);
    const disabled = value !== 'Todos' && count === 0 && current !== value;
    return `<option value="${escapeHtml(value)}"${disabled ? ' disabled' : ''}>${escapeHtml(`${value} (${count})`)}</option>`;
  }).join('');
  el.value = values.includes(current) ? current : 'Todos';
}

function updateDivisionFilterLabel() {
  const city = document.getElementById('cityFilter')?.value || 'Todos';
  const label = city === 'Bogotá'
    ? 'Zona (localidad)'
    : city === 'Medellín' || city === 'Cali'
      ? 'Zona (comuna / corregimiento)'
      : 'Zona';
  document.getElementById('divisionFilterLabel').textContent = label;
}

function fillSelect(id, values) {
  const el = document.getElementById(id);
  el.innerHTML = values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
}

function rebuildCategorySelect() {
  const el = document.getElementById('categoryFilter');
  const current = el.value || 'Todos';
  const rows = filterRowsExcept('categoryFilter');
  const counts = new Map();
  rows.forEach((row) => {
    const key = row.commercialBranchDetail || labelCategory(row.category);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const values = ['Todos', ...unique(state.rows.map((r) => r.commercialBranchDetail || labelCategory(r.category))).sort(compareCategoryFilterValues)];
  el.innerHTML = values.map((value) => {
    const count = value === 'Todos' ? rows.length : (counts.get(value) || 0);
    const label = `${labelCommercialBranchDetail(value, 'filter')} (${count})`;
    const disabled = count === 0 && current !== value;
    return `<option value="${escapeHtml(value)}"${disabled ? ' disabled' : ''}>${escapeHtml(label)}</option>`;
  }).join('');
  el.value = values.includes(current) ? current : 'Todos';
}

function rebuildDataStateSelect() {
  const el = document.getElementById('dataStateFilter');
  const current = el.value || 'all';
  const rows = filterRowsExcept('dataStateFilter');
  const counts = {
    all: rows.length,
    validated_any: rows.filter((r) => ['validated', 'validated_auto'].includes(r.googleValidationStatus)).length,
    with_real_link: rows.filter((r) => !!r.googleMapsUri).length,
    pending: rows.filter((r) => !['validated', 'validated_auto'].includes(r.googleValidationStatus) && !r.googleMapsUri).length,
  };
  const values = [
    ['all', 'Todos'],
    ['validated_any', 'Validado'],
    ['with_real_link', 'Con link real'],
    ['pending', 'Pendiente'],
  ];
  el.innerHTML = values.map(([value, label]) => {
    const count = counts[value] || 0;
    const disabled = value !== 'all' && count === 0 && current !== value;
    return `<option value="${escapeHtml(value)}"${disabled ? ' disabled' : ''}>${escapeHtml(`${label} (${count})`)}</option>`;
  }).join('');
  el.value = values.some(([value]) => value === current) ? current : 'all';
}

function rebuildNseSelect() {
  const el = document.getElementById('nseFilter');
  const current = el.value || 'all';
  const rows = filterRowsExcept('nseFilter');
  const counts = {
    all: rows.length,
    alto: rows.filter((r) => r.nivel_socioeconomico === 'alto').length,
    medio: rows.filter((r) => r.nivel_socioeconomico === 'medio').length,
    bajo: rows.filter((r) => r.nivel_socioeconomico === 'bajo').length,
    sin_dato: rows.filter((r) => !r.nivel_socioeconomico).length,
  };
  const values = [
    ['all', 'Todos'],
    ['alto', 'Alto'],
    ['medio', 'Medio'],
    ['bajo', 'Bajo'],
    ['sin_dato', 'Sin dato'],
  ];
  el.innerHTML = values.map(([value, label]) => {
    const count = counts[value] || 0;
    const disabled = value !== 'all' && count === 0 && current !== value;
    return `<option value="${escapeHtml(value)}"${disabled ? ' disabled' : ''}>${escapeHtml(`${label} (${count})`)}</option>`;
  }).join('');
  el.value = values.some(([value]) => value === current) ? current : 'all';
}

function rebuildGoogleValidationSelect() {
  const el = document.getElementById('googleValidationFilter');
  const current = el.value || 'all';
  const rows = filterRowsExcept('googleValidationFilter');
  const values = [
    ['all', 'Todos'],
    ['validated', 'Validado'],
    ['validated_auto', 'Validado auto'],
    ['ambiguous', 'Ambiguo'],
    ['not_found', 'No encontrado'],
    ['no_match', 'Sin match'],
    ['with_real_link', 'Con link real Maps'],
  ];
  const counts = {
    all: rows.length,
    validated: rows.filter((r) => r.googleValidationStatus === 'validated').length,
    validated_auto: rows.filter((r) => r.googleValidationStatus === 'validated_auto').length,
    ambiguous: rows.filter((r) => r.googleValidationStatus === 'ambiguous').length,
    not_found: rows.filter((r) => r.googleValidationStatus === 'not_found').length,
    no_match: rows.filter((r) => r.googleValidationStatus === 'no_match').length,
    with_real_link: rows.filter((r) => r.googleMapsUri).length,
  };
  el.innerHTML = values.map(([value, label]) => {
    const count = counts[value] || 0;
    const disabled = value !== 'all' && count === 0 && current !== value;
    return `<option value="${escapeHtml(value)}"${disabled ? ' disabled' : ''}>${escapeHtml(`${label} (${count})`)}</option>`;
  }).join('');
  el.value = values.some(([value]) => value === current) ? current : 'all';
}

function bindUI() {
  document.getElementById('cityFilter').addEventListener('change', () => {
    updateDivisionFilterLabel();
    rebuildProvinceFilter();
    applyFilters();
  });
  ['provinceFilter', 'ubigeoFilter', 'categoryFilter', 'dataStateFilter', 'nseFilter', 'reviewFilter', 'googleValidationFilter', 'viabilityFilter', 'premiumFilter', 'superFilter'].forEach((id) => document.getElementById(id).addEventListener('change', applyFilters));
  document.getElementById('searchInput').addEventListener('input', debouncedApplyFilters);
  document.getElementById('parkingFilter').addEventListener('change', applyFilters);
  document.getElementById('publicOnlyFilter').addEventListener('change', applyFilters);
  document.getElementById('premiumOnlyFilter').addEventListener('change', applyFilters);
  document.getElementById('mapsUriOnlyFilter').addEventListener('change', applyFilters);
  document.getElementById('exportExcelBtn').addEventListener('click', exportFilteredExcel);
  document.getElementById('resetBtn').addEventListener('click', () => {
    document.getElementById('cityFilter').value = 'Todos';
    rebuildProvinceFilter();
    document.getElementById('provinceFilter').value = 'Todos';
    document.getElementById('ubigeoFilter').value = 'Todos';
    document.getElementById('categoryFilter').value = 'Todos';
    document.getElementById('searchInput').value = '';
    document.getElementById('parkingFilter').checked = false;
    document.getElementById('dataStateFilter').value = 'all';
    document.getElementById('nseFilter').value = 'all';
    document.getElementById('reviewFilter').value = 'all';
    document.getElementById('googleValidationFilter').value = 'all';
    document.getElementById('viabilityFilter').value = 'all';
    document.getElementById('premiumFilter').value = 'all';
    document.getElementById('superFilter').value = 'all';
    document.getElementById('publicOnlyFilter').checked = false;
    document.getElementById('premiumOnlyFilter').checked = false;
    document.getElementById('mapsUriOnlyFilter').checked = false;
    state.activeGroup = '';
    applyFilters();
  });
}

function createMap() {
  state.map = L.map('map', {
    zoomControl: true,
    preferCanvas: true,
    zoomAnimation: true,
    fadeAnimation: true,
    markerZoomAnimation: true,
    worldCopyJump: false,
  }).setView([4.6486, -74.2479], 10);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20,
  }).addTo(state.map);
}

function applyFilters() {
  rebuildProvinceFilter();
  rebuildUbigeoSelect();
  rebuildCategorySelect();
  rebuildDataStateSelect();
  rebuildNseSelect();
  rebuildGoogleValidationSelect();
  const city = document.getElementById('cityFilter').value;
  const province = document.getElementById('provinceFilter').value;
  const ubigeo = document.getElementById('ubigeoFilter').value;
  const category = document.getElementById('categoryFilter').value;
  const search = document.getElementById('searchInput').value.trim().toLowerCase();
  const parkingOnly = document.getElementById('parkingFilter').checked;
  const dataStateFilter = document.getElementById('dataStateFilter').value;
  const nseFilter = document.getElementById('nseFilter').value;
  const reviewFilter = document.getElementById('reviewFilter').value;
  const googleValidationFilter = document.getElementById('googleValidationFilter').value;
  const viabilityFilter = document.getElementById('viabilityFilter').value;
  const premiumFilter = document.getElementById('premiumFilter').value;
  const superFilter = document.getElementById('superFilter').value;
  const publicOnly = document.getElementById('publicOnlyFilter').checked;
  const premiumOnly = document.getElementById('premiumOnlyFilter').checked;
  const mapsUriOnly = document.getElementById('mapsUriOnlyFilter').checked;

  state.filtered = state.rows.filter((row) => {
    if (city !== 'Todos' && row.city !== city) return false;
    if (province !== 'Todos' && divisionFilterValue(row, city) !== province) return false;
    if (ubigeo !== 'Todos' && row.ubigeo !== ubigeo) return false;
    if (category !== 'Todos' && (row.commercialBranchDetail || labelCategory(row.category)) !== category) return false;
    if (dataStateFilter === 'validated_any' && !['validated', 'validated_auto'].includes(row.googleValidationStatus)) return false;
    if (dataStateFilter === 'with_real_link' && !row.googleMapsUri) return false;
    if (dataStateFilter === 'pending' && (['validated', 'validated_auto'].includes(row.googleValidationStatus) || row.googleMapsUri)) return false;
    if (nseFilter === 'sin_dato' && row.nivel_socioeconomico) return false;
    if (nseFilter !== 'all' && nseFilter !== 'sin_dato' && row.nivel_socioeconomico !== nseFilter) return false;
    if (parkingOnly && row.parkingProbability === 'low') return false;
    if (reviewFilter !== 'all' && row.reviewStatus !== reviewFilter) return false;
    if (googleValidationFilter === 'with_real_link' && !row.googleMapsUri) return false;
    if (googleValidationFilter !== 'all' && googleValidationFilter !== 'with_real_link' && (row.googleValidationStatus || 'pending') !== googleValidationFilter) return false;
    if (viabilityFilter !== 'all' && row.viabilityTier !== viabilityFilter) return false;
    if (premiumFilter !== 'all' && row.evinkaPriority !== premiumFilter) return false;
    if (superFilter !== 'all' && territorialTier(row) !== superFilter) return false;
    if (publicOnly && !row.publicChargingCandidate) return false;
    if (premiumOnly && !row.evinkaPremiumCandidate) return false;
    if (mapsUriOnly && !row.googleMapsUri) return false;
    if (state.activeGroup && row.brandGroup !== state.activeGroup) return false;
    if (search) {
      const haystack = [row.operator, row.name, row.address, row.category, row.commercialBranch, row.commercialBranchDetail, row.zone, row.city, row.officialDivisionName, row.localityName, row.upzName].join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  renderMetrics();
  renderGroups();
  renderQualitySummary();
  renderViabilitySummary();
  renderPremiumSummary();
  renderSuperSummary();
  renderLocations();
  updateExportStatus();
  renderMap();
}

function filterRowsExcept(skipId) {
  const city = document.getElementById('cityFilter')?.value || 'Todos';
  const province = document.getElementById('provinceFilter')?.value || 'Todos';
  const ubigeo = document.getElementById('ubigeoFilter')?.value || 'Todos';
  const category = document.getElementById('categoryFilter')?.value || 'Todos';
  const dataStateFilter = document.getElementById('dataStateFilter')?.value || 'all';
  const nseFilter = document.getElementById('nseFilter')?.value || 'all';
  const search = document.getElementById('searchInput')?.value?.trim().toLowerCase() || '';
  const parkingOnly = !!document.getElementById('parkingFilter')?.checked;
  const reviewFilter = document.getElementById('reviewFilter')?.value || 'all';
  const googleValidationFilter = document.getElementById('googleValidationFilter')?.value || 'all';
  const viabilityFilter = document.getElementById('viabilityFilter')?.value || 'all';
  const premiumFilter = document.getElementById('premiumFilter')?.value || 'all';
  const superFilter = document.getElementById('superFilter')?.value || 'all';
  const publicOnly = !!document.getElementById('publicOnlyFilter')?.checked;
  const premiumOnly = !!document.getElementById('premiumOnlyFilter')?.checked;
  const mapsUriOnly = !!document.getElementById('mapsUriOnlyFilter')?.checked;

  return state.rows.filter((row) => {
    if (city !== 'Todos' && row.city !== city) return false;
    if (skipId !== 'provinceFilter' && province !== 'Todos' && divisionFilterValue(row, city) !== province) return false;
    if (ubigeo !== 'Todos' && row.ubigeo !== ubigeo) return false;
    if (skipId !== 'categoryFilter' && category !== 'Todos' && (row.commercialBranchDetail || labelCategory(row.category)) !== category) return false;
    if (skipId !== 'dataStateFilter') {
      if (dataStateFilter === 'validated_any' && !['validated', 'validated_auto'].includes(row.googleValidationStatus)) return false;
      if (dataStateFilter === 'with_real_link' && !row.googleMapsUri) return false;
      if (dataStateFilter === 'pending' && (['validated', 'validated_auto'].includes(row.googleValidationStatus) || row.googleMapsUri)) return false;
    }
    if (skipId !== 'nseFilter') {
      if (nseFilter === 'sin_dato' && row.nivel_socioeconomico) return false;
      if (nseFilter !== 'all' && nseFilter !== 'sin_dato' && row.nivel_socioeconomico !== nseFilter) return false;
    }
    if (parkingOnly && row.parkingProbability === 'low') return false;
    if (reviewFilter !== 'all' && row.reviewStatus !== reviewFilter) return false;
    if (skipId !== 'googleValidationFilter') {
      if (googleValidationFilter === 'with_real_link' && !row.googleMapsUri) return false;
      if (googleValidationFilter !== 'all' && googleValidationFilter !== 'with_real_link' && (row.googleValidationStatus || 'pending') !== googleValidationFilter) return false;
    }
    if (viabilityFilter !== 'all' && row.viabilityTier !== viabilityFilter) return false;
    if (premiumFilter !== 'all' && row.evinkaPriority !== premiumFilter) return false;
    if (superFilter !== 'all' && territorialTier(row) !== superFilter) return false;
    if (publicOnly && !row.publicChargingCandidate) return false;
    if (premiumOnly && !row.evinkaPremiumCandidate) return false;
    if (mapsUriOnly && !row.googleMapsUri) return false;
    if (state.activeGroup && row.brandGroup !== state.activeGroup) return false;
    if (search) {
      const haystack = [row.operator, row.name, row.address, row.category, row.commercialBranch, row.commercialBranchDetail, row.zone, row.city, row.officialDivisionName, row.localityName, row.upzName].join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

function renderMetrics() {
  const total = state.filtered.length;
  const groups = unique(state.filtered.map((r) => r.brandGroup)).length;
  const parkingHigh = state.filtered.filter((r) => r.parkingProbability === 'high').length;
  const viable = state.filtered.filter((r) => r.publicChargingCandidate).length;
  const premium = state.filtered.filter((r) => r.evinkaPremiumCandidate).length;
  const superA = state.filtered.filter((r) => territorialTier(r) === 'A').length;
  const mapsReal = state.filtered.filter((r) => r.googleMapsUri).length;
  const avgScore = state.filtered.length ? Math.round(state.filtered.reduce((acc, row) => acc + territorialScore(row), 0) / state.filtered.length) : 0;
  document.getElementById('metrics').innerHTML = [
    metric('Oportunidades visibles', total),
    metric('Marcas / grupos', groups),
    metric('Parking probable alto', parkingHigh),
    metric('Listos para carga pública', viable),
    metric('Leads listos', premium),
    metric('Territorial alta', superA),
    metric('Links reales Maps', mapsReal),
    metric('Puntaje promedio', avgScore),
  ].join('');
}

function renderQualitySummary() { renderExpandableSummary('qualitySummary', [
  { label: 'Dato limpio', value: 'approved_auto', cls: 'approved_auto', items: state.filtered.filter((row) => row.reviewStatus === 'approved_auto').sort((a, b) => territorialScore(b) - territorialScore(a)) },
  { label: 'Dato con duda', value: 'review_light', cls: 'review_light', items: state.filtered.filter((row) => row.reviewStatus === 'review_light').sort((a, b) => territorialScore(b) - territorialScore(a)) },
]); }
function renderViabilitySummary() { renderExpandableSummary('viabilitySummary', [
  { label: 'Potencial alto', value: 'high', cls: 'high', items: state.filtered.filter((row) => row.viabilityTier === 'high').sort((a, b) => territorialScore(b) - territorialScore(a)) },
  { label: 'Potencial medio', value: 'medium', cls: 'medium', items: state.filtered.filter((row) => row.viabilityTier === 'medium').sort((a, b) => territorialScore(b) - territorialScore(a)) },
  { label: 'Potencial bajo', value: 'low', cls: 'low', items: state.filtered.filter((row) => row.viabilityTier === 'low').sort((a, b) => territorialScore(b) - territorialScore(a)) },
  { label: 'Sin potencial', value: 'discard', cls: 'discard', items: state.filtered.filter((row) => row.viabilityTier === 'discard').sort((a, b) => territorialScore(b) - territorialScore(a)) },
]); }
function renderPremiumSummary() { renderExpandableSummary('premiumSummary', [
  { label: 'Lead listo', value: 'atacar_ya', cls: 'atacar_ya', items: state.filtered.filter((row) => row.evinkaPriority === 'atacar_ya').sort((a, b) => territorialScore(b) - territorialScore(a)) },
  { label: 'Validar', value: 'revisar', cls: 'revisar', items: state.filtered.filter((row) => row.evinkaPriority === 'revisar').sort((a, b) => territorialScore(b) - territorialScore(a)) },
  { label: 'No priorizar', value: 'descartar', cls: 'descartar', items: state.filtered.filter((row) => row.evinkaPriority === 'descartar').sort((a, b) => territorialScore(b) - territorialScore(a)) },
]); }
function renderSuperSummary() { renderExpandableSummary('superSummary', [
  { label: 'Prioridad territorial alta', value: 'A', cls: 'A', items: state.filtered.filter((row) => territorialTier(row) === 'A').sort((a, b) => territorialScore(b) - territorialScore(a)) },
  { label: 'Prioridad territorial media', value: 'B', cls: 'B', items: state.filtered.filter((row) => territorialTier(row) === 'B').sort((a, b) => territorialScore(b) - territorialScore(a)) },
  { label: 'Prioridad territorial baja', value: 'C', cls: 'C', items: state.filtered.filter((row) => territorialTier(row) === 'C').sort((a, b) => territorialScore(b) - territorialScore(a)) },
  { label: 'Sin prioridad territorial', value: 'descartar', cls: 'descartar', items: state.filtered.filter((row) => territorialTier(row) === 'descartar').sort((a, b) => territorialScore(b) - territorialScore(a)) },
]); }

function renderExpandableSummary(containerId, groups) {
  const el = document.getElementById(containerId);
  el.innerHTML = groups.map((group) => {
    const preview = group.items.slice(0, 12);
    return `
      <details class="summary-accordion ${state.activeGroup === group.value ? 'active' : ''}">
        <summary class="summary-toggle">
          <div>
            <strong>${escapeHtml(group.label)}</strong>
            <p>${group.items.length ? `${group.items.length} sitios` : 'Sin resultados'}</p>
          </div>
          <span class="pill ${escapeHtml(group.cls)}">${escapeHtml(String(group.items.length))}</span>
        </summary>
        <div class="summary-items ${group.items.length ? '' : 'empty'}">
          ${preview.length ? preview.map((row) => `
            <button class="summary-item" type="button" data-id="${escapeHtml(row.id)}">
              <strong>${escapeHtml(row.canonicalName || row.name)}</strong>
              <span>${escapeHtml(labelCommercialBranchDetail(row.commercialBranchDetail || labelCategory(row.category)))} · ${escapeHtml(territorialAction(row) || row.recommendedAction)}</span>
            </button>
          `).join('') : '<div class="summary-empty">No hay puntos en este grupo.</div>'}
          ${group.items.length > preview.length ? `<div class="summary-more">+ ${escapeHtml(String(group.items.length - preview.length))} más. Usa filtros o búsqueda para afinar.</div>` : ''}
        </div>
      </details>
    `;
  }).join('');
  el.querySelectorAll('[data-id]').forEach((btn) => btn.addEventListener('click', () => focusRow(btn.dataset.id)));
}

function metric(label, value) { return `<div class="metric"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(String(value))}</span></div>`; }

function renderGroups() {
  const groupsMap = new Map();
  state.filtered.forEach((row) => {
    const group = groupsMap.get(row.brandGroup) || { name: row.brandGroup, count: 0, rawCount: 0, cities: new Set(), parkingHigh: 0, viable: 0, premium: 0, superA: 0, scoreSum: 0, items: [] };
    group.count += 1;
    group.rawCount += row.rawCount || 1;
    group.cities.add(row.city);
    if (row.parkingProbability === 'high') group.parkingHigh += 1;
    if (row.publicChargingCandidate) group.viable += 1;
    if (row.evinkaPremiumCandidate) group.premium += 1;
    if (territorialTier(row) === 'A') group.superA += 1;
    group.scoreSum += territorialScore(row);
    group.items.push(row);
    groupsMap.set(row.brandGroup, group);
  });
  const list = [...groupsMap.values()].sort((a, b) => b.count - a.count);
  const visibleGroups = list.slice(0, 120);
  const wrap = document.getElementById('groupsList');
  wrap.innerHTML = visibleGroups.length ? visibleGroups.map((group) => {
    const preview = group.items.sort((a, b) => territorialScore(b) - territorialScore(a)).slice(0, 12);
    return `
      <details class="summary-accordion ${state.activeGroup === group.name ? 'active' : ''}">
        <summary class="summary-toggle">
          <div>
            <strong>${escapeHtml(group.name)}</strong>
            <p>${group.count} oportunidades · ${group.superA} territorial alta · ${group.premium} leads listos · puntaje prom. ${Math.round(group.scoreSum / Math.max(1, group.count))}</p>
          </div>
          <span class="pill ${state.activeGroup === group.name ? 'atacar_ya' : 'B'}">${escapeHtml(String(group.count))}</span>
        </summary>
        <div class="summary-items">
          <button class="summary-filter-btn" type="button" data-group-filter="${escapeHtml(group.name)}">${state.activeGroup === group.name ? 'Quitar filtro del grupo' : 'Ver solo este grupo'}</button>
          ${preview.map((row) => `
            <button class="summary-item" type="button" data-id="${escapeHtml(row.id)}">
              <strong>${escapeHtml(row.canonicalName || row.name)}</strong>
              <span>${escapeHtml(labelCommercialBranchDetail(row.commercialBranchDetail || labelCategory(row.category)))} · ${escapeHtml(territorialAction(row) || row.recommendedAction)}</span>
            </button>
          `).join('')}
          ${group.items.length > preview.length ? `<div class="summary-more">+ ${escapeHtml(String(group.items.length - preview.length))} más. Usa filtros o búsqueda para afinar.</div>` : ''}
        </div>
      </details>
    `;
  }).join('') : '<div class="group-card"><p>Sin resultados.</p></div>';
  wrap.querySelectorAll('[data-id]').forEach((btn) => btn.addEventListener('click', () => focusRow(btn.dataset.id)));
  wrap.querySelectorAll('[data-group-filter]').forEach((btn) => btn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const group = btn.dataset.groupFilter;
    state.activeGroup = state.activeGroup === group ? '' : group;
    applyFilters();
  }));
}

function renderLocations() {
  const wrap = document.getElementById('locationsList');
  const visibleRows = state.filtered.slice(0, 120);
  const mapRows = state.filtered;
  const rawTotal = state.filtered.reduce((acc, row) => acc + (row.rawCount || 1), 0);
  const viable = state.filtered.filter((row) => row.publicChargingCandidate).length;
  const premium = state.filtered.filter((row) => row.evinkaPremiumCandidate).length;
  const superA = state.filtered.filter((row) => territorialTier(row) === 'A').length;
  const mapsReal = state.filtered.filter((row) => row.googleMapsUri).length;
  const googleValidated = state.filtered.filter((row) => ['validated', 'validated_auto'].includes(row.googleValidationStatus)).length;
  const publicOnly = document.getElementById('publicOnlyFilter').checked;
  const premiumOnly = document.getElementById('premiumOnlyFilter').checked;
  const mapsUriOnly = document.getElementById('mapsUriOnlyFilter').checked;
  const city = document.getElementById('cityFilter').value;
  const province = document.getElementById('provinceFilter').value;
  document.getElementById('resultsSummary').textContent = `${state.filtered.length} oportunidades · ${superA} territorial alta · ${premium} leads listos · ${viable} listos para carga pública · ${googleValidated} validados Google · ${mapsReal} con link real · base raw ${rawTotal} registros · lista ${visibleRows.length} · mapa ${mapRows.length}` + (city !== 'Todos' ? ` · ciudad: ${city}` : '') + (province !== 'Todos' ? ` · territorio: ${province}` : '') + (publicOnly ? ' · filtro: solo listos para carga pública' : '') + (premiumOnly ? ' · filtro: solo leads listos' : '') + (mapsUriOnly ? ' · filtro: solo con link real' : '') + (state.activeGroup ? ` · grupo: ${state.activeGroup}` : '') + (state.filtered.length > visibleRows.length ? ' · usa filtros para afinar' : '');
  wrap.innerHTML = visibleRows.length ? visibleRows.map((row) => `
    <div class="location-card" data-id="${escapeHtml(row.id)}">
      <h3>${escapeHtml(row.name)}</h3>
      <p>${escapeHtml(labelCommercialBranchDetail(row.commercialBranchDetail || labelCategory(row.category)))} · ${escapeHtml(row.operator)}</p>
      <p>${escapeHtml(row.address)}</p>
      <p>${row.rawCount > 1 ? `${row.rawCount} registros consolidados · ${row.aliasCount} alias detectados` : '1 registro limpio'}</p>
      <p>Puntaje territorial ${escapeHtml(String(territorialScore(row)))} · ${escapeHtml(territorialAction(row))}</p>
      <p>Demanda ${escapeHtml(String(row.populationDemandScore || 0))} · actividad ${escapeHtml(String(row.activityDensityScore || 0))} · afinidad EV ${escapeHtml(String(row.evAffinityAdvancedScore || 0))} · señal noticias ${escapeHtml(String(row.newsSignalScore || 0))}</p>
      ${row.commercialReviewNotes?.length ? `<p>Ajuste del dato: ${escapeHtml(formatCommercialNotes(row.commercialReviewNotes))}</p>` : ''}
      ${row.evinkaRationale?.length ? `<p>Motivo comercial: ${escapeHtml(formatCommercialNotes(row.evinkaRationale))}</p>` : ''}
      ${row.commercialScaleLabel ? `<p>Escala comercial: ${escapeHtml(row.commercialScaleLabel)}</p>` : ''}
      ${formatTerritoryLine(row) ? `<p>Territorio: ${escapeHtml(formatTerritoryLine(row))}</p>` : ''}
      <div class="location-actions">
        <button class="location-action primary-soft" type="button" data-focus-id="${escapeHtml(row.id)}">Ver en mapa</button>
        <a class="location-action" href="${escapeHtml(googleMapsUrl(row))}" target="_blank" rel="noopener noreferrer">Abrir en Google Maps</a>
      </div>
      <span class="pill ${escapeHtml(territorialTier(row))}">${escapeHtml(labelSuper(territorialTier(row)))}</span>
      <span class="pill ${escapeHtml(row.evinkaPriority)}">${escapeHtml(labelPremium(row.evinkaPriority))}</span>
      <span class="pill ${escapeHtml(row.viabilityTier)}">Potencial ${escapeHtml(labelTier(row.viabilityTier))}</span>
      <span class="pill ${escapeHtml(row.parkingProbability)}">Parking probable ${escapeHtml(labelParking(row.parkingProbability))} · ${escapeHtml(row.ubigeo)} · confianza ${escapeHtml(labelConfidence(row.confidence))}</span>
      <span class="pill ${escapeHtml(row.reviewStatus)}">${escapeHtml(labelReview(row.reviewStatus))}</span>
      <span class="pill ${escapeHtml(googleValidationPillClass(row.googleValidationStatus))}">${escapeHtml(labelGoogleValidation(row.googleValidationStatus, row.googleMapsUri))}</span>
    </div>
  `).join('') : '<div class="location-card"><p>No hay ubicaciones con esos filtros.</p></div>';
  wrap.querySelectorAll('[data-focus-id]').forEach((btn) => btn.addEventListener('click', () => focusRow(btn.dataset.focusId)));
}

function updateExportStatus(message = '') {
  const btn = document.getElementById('exportExcelBtn');
  const status = document.getElementById('exportStatus');
  if (!btn || !status) return;
  if (message) {
    status.textContent = message;
    return;
  }
  if (state.exporting) {
    status.textContent = `Preparando Excel profesional con ${state.filtered.length} oportunidades filtradas...`;
    return;
  }
  const filters = describeActiveFilters();
  btn.disabled = !state.filtered.length;
  btn.textContent = state.filtered.length ? 'Exportar estudio Excel' : 'Sin datos para exportar';
  status.textContent = state.filtered.length
    ? `Listo para exportar ${state.filtered.length} oportunidades${filters.length ? ` · filtros: ${filters.map((item) => `${item.label}: ${item.value}`).join(' · ')}` : ' · sin filtros activos'}.`
    : 'No hay resultados con esos filtros.';
}

async function exportFilteredExcel() {
  if (state.exporting) return;
  if (!state.filtered.length) {
    updateExportStatus('No hay datos con esos filtros para exportar.');
    return;
  }
  if (!window.ExcelJS?.Workbook) {
    updateExportStatus('No se cargó el motor de Excel.');
    return;
  }

  const btn = document.getElementById('exportExcelBtn');
  const previousLabel = btn?.textContent || 'Exportar estudio Excel';
  state.exporting = true;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Generando Excel...';
  }
  updateExportStatus();

  try {
    const workbook = buildMarketStudyWorkbook(state.filtered);
    const buffer = await workbook.xlsx.writeBuffer();
    const city = document.getElementById('cityFilter')?.value || 'Todos';
    const filename = buildExportFileName(city, state.filtered.length);
    downloadWorkbook(buffer, filename);
    updateExportStatus(`Excel listo: ${filename} · ${state.filtered.length} oportunidades exportadas.`);
  } catch (error) {
    console.error(error);
    updateExportStatus(`No se pudo exportar el Excel: ${error.message || error}`);
  } finally {
    state.exporting = false;
    if (btn) {
      btn.disabled = !state.filtered.length;
      btn.textContent = previousLabel;
    }
  }
}

function buildMarketStudyWorkbook(rows) {
  const workbook = new window.ExcelJS.Workbook();
  const generatedAt = new Date();
  const sortedRows = [...rows].sort(compareRowsForExport);
  const filters = describeActiveFilters();
  const metrics = buildExportMetrics(sortedRows);
  const rankingRows = buildBrandRankingRows(sortedRows);
  const glossary = buildExportGlossary();

  workbook.creator = 'Evi';
  workbook.company = 'EVINKA';
  workbook.created = generatedAt;
  workbook.modified = generatedAt;
  workbook.subject = 'MapCo · Estudio de mercado';
  workbook.title = 'MapCo Estudio de mercado';

  const summary = workbook.addWorksheet('Resumen ejecutivo', { properties: { tabColor: { argb: 'FFC7A06A' } } });
  summary.mergeCells('A1:F1');
  summary.getCell('A1').value = 'MapCo · Estudio de mercado';
  summary.getCell('A1').font = { bold: true, size: 18, color: { argb: 'FFF8F2EA' } };
  summary.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17120F' } };
  summary.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
  summary.mergeCells('A2:F2');
  summary.getCell('A2').value = 'Export profesional generado desde los filtros activos del mapa.';
  summary.getCell('A2').font = { italic: true, color: { argb: 'FF5B6574' } };
  summary.addRow([]);
  summary.columns = [
    { key: 'metric', width: 34 },
    { key: 'value', width: 20 },
    { key: 'metric2', width: 6 },
    { key: 'filter', width: 28 },
    { key: 'filterValue', width: 42 },
    { key: 'spacer', width: 4 },
  ];

  summary.getCell('A4').value = 'Métrica';
  summary.getCell('B4').value = 'Valor';
  summary.getCell('D4').value = 'Filtro';
  summary.getCell('E4').value = 'Valor aplicado';
  styleSheetHeader(summary.getRow(4));

  const maxRows = Math.max(metrics.length, Math.max(filters.length, 1));
  for (let i = 0; i < maxRows; i += 1) {
    const metric = metrics[i];
    const filter = filters[i];
    const row = summary.getRow(5 + i);
    if (metric) {
      row.getCell(1).value = metric.label;
      row.getCell(2).value = metric.value;
    }
    if (filter) {
      row.getCell(4).value = filter.label;
      row.getCell(5).value = filter.value;
    } else if (i === 0) {
      row.getCell(4).value = 'Filtros';
      row.getCell(5).value = 'Sin filtros activos';
    }
    styleDataRow(row, i);
  }
  summary.getColumn(2).numFmt = '#,##0';

  const glossaryTitleRow = 5 + maxRows + 2;
  summary.mergeCells(`A${glossaryTitleRow}:F${glossaryTitleRow}`);
  summary.getCell(`A${glossaryTitleRow}`).value = 'Guía rápida de filtros y términos';
  summary.getCell(`A${glossaryTitleRow}`).font = { bold: true, size: 13, color: { argb: 'FFF8F2EA' } };
  summary.getCell(`A${glossaryTitleRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17120F' } };
  summary.getCell(`A${glossaryTitleRow}`).alignment = { vertical: 'middle', horizontal: 'left' };

  const glossaryHeaderRow = glossaryTitleRow + 1;
  summary.getCell(`A${glossaryHeaderRow}`).value = 'Filtro / término';
  summary.getCell(`B${glossaryHeaderRow}`).value = 'Qué significa en simple';
  summary.mergeCells(`B${glossaryHeaderRow}:F${glossaryHeaderRow}`);
  styleSheetHeader(summary.getRow(glossaryHeaderRow));

  glossary.forEach((item, index) => {
    const rowNumber = glossaryHeaderRow + 1 + index;
    const row = summary.getRow(rowNumber);
    row.getCell(1).value = item.label;
    row.getCell(2).value = item.description;
    summary.mergeCells(`B${rowNumber}:F${rowNumber}`);
    styleDataRow(row, index);
  });

  const ranking = workbook.addWorksheet('Ranking marcas', { properties: { tabColor: { argb: 'FF1F2937' } } });
  ranking.columns = [
    { header: 'Rank', key: 'rank', width: 10 },
    { header: 'Marca / grupo', key: 'brandGroup', width: 28 },
    { header: 'Oportunidades', key: 'count', width: 16 },
    { header: 'Territorial alta', key: 'superA', width: 16 },
    { header: 'Leads listos', key: 'premium', width: 14 },
    { header: 'Carga pública', key: 'publicCharging', width: 14 },
    { header: 'Links reales', key: 'mapsReal', width: 14 },
    { header: 'Puntaje promedio', key: 'avgScore', width: 16 },
    { header: 'Ciudades', key: 'cities', width: 28 },
  ];
  styleSheetHeader(ranking.getRow(1));
  rankingRows.forEach((item, index) => {
    ranking.addRow({
      rank: index + 1,
      brandGroup: item.brandGroup,
      count: item.count,
      superA: item.superA,
      premium: item.premium,
      publicCharging: item.publicCharging,
      mapsReal: item.mapsReal,
      avgScore: item.avgScore,
      cities: item.cities,
    });
  });
  finalizeDataSheet(ranking);

  const sheet = workbook.addWorksheet('Oportunidades', { properties: { tabColor: { argb: 'FF5E8CFF' } } });
  sheet.columns = [
    { header: 'Rank', key: 'rank', width: 8 },
    { header: 'Nombre', key: 'name', width: 32 },
    { header: 'Marca / grupo', key: 'brandGroup', width: 24 },
    { header: 'Operador', key: 'operator', width: 20 },
    { header: 'Ciudad', key: 'city', width: 14 },
    { header: 'Territorio', key: 'territory', width: 24 },
    { header: 'Dirección', key: 'address', width: 42 },
    { header: 'Tipo de lugar', key: 'category', width: 26 },
    { header: 'Escala comercial', key: 'scale', width: 18 },
    { header: 'Prioridad territorial', key: 'superTier', width: 18 },
    { header: 'Puntaje territorial', key: 'superScore', width: 16 },
    { header: 'Estado comercial', key: 'priority', width: 16 },
    { header: 'Potencial', key: 'viability', width: 14 },
    { header: 'Carga pública', key: 'publicCharging', width: 14 },
    { header: 'Lead listo', key: 'premium', width: 12 },
    { header: 'Parking probable', key: 'parking', width: 16 },
    { header: 'Google', key: 'google', width: 18 },
    { header: 'Link Maps', key: 'mapsLink', width: 14 },
    { header: 'Teléfono', key: 'phone', width: 18 },
    { header: 'Web', key: 'website', width: 18 },
    { header: 'Estrato', key: 'estrato', width: 12 },
    { header: 'Nivel socioeconómico', key: 'nse', width: 20 },
    { header: 'Registros consolidados', key: 'rawCount', width: 18 },
    { header: 'Confianza', key: 'confidence', width: 12 },
    { header: 'Ajuste del dato', key: 'reviewNotes', width: 34 },
    { header: 'Motivo comercial', key: 'commercialNotes', width: 40 },
    { header: 'Latitud', key: 'lat', width: 12 },
    { header: 'Longitud', key: 'lng', width: 12 },
  ];
  styleSheetHeader(sheet.getRow(1));
  sortedRows.forEach((row, index) => {
    sheet.addRow({
      rank: index + 1,
      name: row.canonicalName || row.name,
      brandGroup: row.brandGroup || row.operator || 'Sin grupo',
      operator: row.operator || '',
      city: row.city || '',
      territory: formatTerritoryLine(row),
      address: row.address || '',
      category: labelCommercialBranchDetail(row.commercialBranchDetail || labelCategory(row.category), 'filter'),
      scale: row.commercialScaleLabel || '',
      superTier: labelSuper(territorialTier(row)),
      superScore: territorialScore(row),
      priority: labelPremium(row.evinkaPriority),
      viability: labelTier(row.viabilityTier),
      publicCharging: row.publicChargingCandidate ? 'Sí' : 'No',
      premium: row.evinkaPremiumCandidate ? 'Sí' : 'No',
      parking: labelParking(row.parkingProbability),
      google: labelGoogleValidation(row.googleValidationStatus, !!row.googleMapsUri),
      mapsLink: { text: 'Abrir mapa', hyperlink: googleMapsUrl(row), tooltip: googleMapsUrl(row) },
      phone: row.googleCandidatePhone || '',
      website: row.googleCandidateWebsite ? { text: 'Sitio web', hyperlink: row.googleCandidateWebsite, tooltip: row.googleCandidateWebsite } : '',
      estrato: row.estrato_entorno ?? '',
      nse: labelNse(row.nivel_socioeconomico),
      rawCount: row.rawCount || 1,
      confidence: labelConfidence(row.confidence),
      reviewNotes: row.commercialReviewNotes?.length ? formatCommercialNotes(row.commercialReviewNotes) : '',
      commercialNotes: row.evinkaRationale?.length ? formatCommercialNotes(row.evinkaRationale) : (territorialAction(row) || row.recommendedAction || ''),
      lat: Number(row.lat) || 0,
      lng: Number(row.lng) || 0,
    });
  });
  sheet.getColumn('superScore').numFmt = '#,##0';
  sheet.getColumn('lat').numFmt = '0.000000';
  sheet.getColumn('lng').numFmt = '0.000000';
  finalizeDataSheet(sheet);

  return workbook;
}

function finalizeDataSheet(sheet) {
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columns.length },
  };
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    styleDataRow(row, rowNumber - 2);
  });
}

function styleSheetHeader(row) {
  row.font = { bold: true, color: { argb: 'FFF9F1E7' } };
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC7A06A' } };
  row.height = 24;
  row.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin', color: { argb: '33FFFFFF' } },
      left: { style: 'thin', color: { argb: '33FFFFFF' } },
      bottom: { style: 'thin', color: { argb: '33FFFFFF' } },
      right: { style: 'thin', color: { argb: '33FFFFFF' } },
    };
  });
}

function styleDataRow(row, index = 0) {
  row.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin', color: { argb: '22D8CFC3' } },
      left: { style: 'thin', color: { argb: '22D8CFC3' } },
      bottom: { style: 'thin', color: { argb: '22D8CFC3' } },
      right: { style: 'thin', color: { argb: '22D8CFC3' } },
    };
    cell.alignment = { vertical: 'middle', wrapText: true };
    if (index % 2 === 0) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F3ED' } };
    }
    if (cell.value && typeof cell.value === 'object' && cell.value.hyperlink) {
      cell.font = { color: { argb: 'FF1D4ED8' }, underline: true };
    }
  });
}

function buildExportMetrics(rows) {
  return [
    { label: 'Oportunidades filtradas', value: rows.length },
    { label: 'Marcas / grupos', value: unique(rows.map((row) => row.brandGroup)).length },
    { label: 'Ciudades cubiertas', value: unique(rows.map((row) => row.city)).length },
    { label: 'Territorial alta', value: rows.filter((row) => territorialTier(row) === 'A').length },
    { label: 'Leads listos', value: rows.filter((row) => row.evinkaPremiumCandidate).length },
    { label: 'Listos para carga pública', value: rows.filter((row) => row.publicChargingCandidate).length },
    { label: 'Links reales Maps', value: rows.filter((row) => row.googleMapsUri).length },
    { label: 'Google validado', value: rows.filter((row) => ['validated', 'validated_auto'].includes(row.googleValidationStatus)).length },
    { label: 'Parking probable alto', value: rows.filter((row) => row.parkingProbability === 'high').length },
    { label: 'Con estrato oficial', value: rows.filter((row) => row.estrato_entorno != null).length },
    { label: 'Puntaje territorial promedio', value: rows.length ? Math.round(rows.reduce((acc, row) => acc + territorialScore(row), 0) / rows.length) : 0 },
  ];
}

function buildBrandRankingRows(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = row.brandGroup || row.operator || 'Sin grupo';
    const item = groups.get(key) || { brandGroup: key, count: 0, superA: 0, premium: 0, publicCharging: 0, mapsReal: 0, scoreSum: 0, cities: new Set() };
    item.count += 1;
    if (territorialTier(row) === 'A') item.superA += 1;
    if (row.evinkaPremiumCandidate) item.premium += 1;
    if (row.publicChargingCandidate) item.publicCharging += 1;
    if (row.googleMapsUri) item.mapsReal += 1;
    item.scoreSum += territorialScore(row);
    if (row.city) item.cities.add(row.city);
    groups.set(key, item);
  });
  return [...groups.values()]
    .map((item) => ({ ...item, avgScore: Math.round(item.scoreSum / Math.max(1, item.count)), cities: [...item.cities].sort((a, b) => String(a).localeCompare(String(b), 'es')).join(', ') }))
    .sort((a, b) => b.count - a.count || b.avgScore - a.avgScore || a.brandGroup.localeCompare(b.brandGroup, 'es'));
}

function describeActiveFilters() {
  const filters = [];
  const add = (label, value, isDefault = false) => {
    if (!isDefault && value) filters.push({ label, value });
  };
  const city = document.getElementById('cityFilter')?.value || 'Todos';
  const zone = document.getElementById('provinceFilter')?.value || 'Todos';
  const category = document.getElementById('categoryFilter')?.value || 'Todos';
  const dataState = document.getElementById('dataStateFilter')?.value || 'all';
  const nse = document.getElementById('nseFilter')?.value || 'all';
  const search = document.getElementById('searchInput')?.value?.trim() || '';
  const ubigeo = document.getElementById('ubigeoFilter')?.value || 'Todos';
  const review = document.getElementById('reviewFilter')?.value || 'all';
  const google = document.getElementById('googleValidationFilter')?.value || 'all';
  const viability = document.getElementById('viabilityFilter')?.value || 'all';
  const premium = document.getElementById('premiumFilter')?.value || 'all';
  const superTier = document.getElementById('superFilter')?.value || 'all';

  add('Ciudad (dónde están los puntos)', city, city === 'Todos');
  add('Zona (subárea dentro de la ciudad)', zone, zone === 'Todos');
  add('Tipo de lugar (clase de negocio o sitio)', labelCommercialBranchDetail(category, 'filter'), category === 'Todos');
  add('Estado del dato (calidad general del registro)', ({ validated_any: 'Validado', with_real_link: 'Con link real', pending: 'Pendiente' }[dataState] || ''), dataState === 'all');
  add('Nivel socioeconómico (entorno del punto)', labelNse(nse), nse === 'all');
  add('Buscar', search, !search);
  add('Municipio DANE (código oficial del municipio)', ubigeo, ubigeo === 'Todos');
  add('Calidad interna (revisión manual del dato)', ({ approved_auto: 'Dato limpio', review_light: 'Dato con duda' }[review] || ''), review === 'all');
  add('Estado Google (validación contra Google Places)', ({ validated: 'Validado', validated_auto: 'Validado auto', ambiguous: 'Ambiguo', not_found: 'No encontrado', no_match: 'Sin match', with_real_link: 'Con link real Maps' }[google] || ''), google === 'all');
  add('Potencial (qué tan prometedor se ve el sitio)', ({ high: 'Potencial alto', medium: 'Potencial medio', low: 'Potencial bajo', discard: 'Sin potencial' }[viability] || ''), viability === 'all');
  add('Estado comercial / premium (prioridad para ventas)', ({ atacar_ya: 'Lead listo', revisar: 'Validar', descartar: 'No priorizar' }[premium] || ''), premium === 'all');
  add('Prioridad territorial (qué tan estratégica es la zona)', ({ A: 'Alta', B: 'Media', C: 'Baja', descartar: 'Sin prioridad' }[superTier] || ''), superTier === 'all');
  add('Solo aptos carga pública (mejor encaje para cargador público)', 'Sí', !document.getElementById('publicOnlyFilter')?.checked);
  add('Solo leads listos (sitios más accionables)', 'Sí', !document.getElementById('premiumOnlyFilter')?.checked);
  add('Solo con parking probable (más chance de estacionamiento)', 'Sí', !document.getElementById('parkingFilter')?.checked);
  add('Solo con link real Maps (enlace exacto validado)', 'Sí', !document.getElementById('mapsUriOnlyFilter')?.checked);
  add('Grupo filtrado (marca o cadena)', state.activeGroup, !state.activeGroup);
  return filters;
}

function buildExportGlossary() {
  return [
    { label: 'Estado del dato', description: 'Resume la calidad general del registro. “Validado” significa que ya pasó por una verificación fuerte; “Con link real” que tiene enlace exacto a Google Maps; “Pendiente” que todavía necesita depuración.' },
    { label: 'Premium / estado comercial', description: 'Indica prioridad para ventas. “Lead listo” es un punto más accionable; “Validar” requiere revisión comercial; “No priorizar” hoy no es foco.' },
    { label: 'Potencial', description: 'Qué tan prometedor se ve el sitio para el negocio, combinando señales de demanda, ubicación y encaje comercial.' },
    { label: 'Prioridad territorial', description: 'Qué tan estratégica se ve la zona. A = alta, B = media, C = baja.' },
    { label: 'Estado Google', description: 'Muestra el nivel de validación contra Google Places y Google Maps.' },
    { label: 'Nivel socioeconómico', description: 'Clasificación del entorno del punto cuando exista fuente oficial de estrato. Si no hay fuente, aparece como “Sin dato”.' },
    { label: 'Parking probable', description: 'Señal estimada de que el sitio podría tener estacionamiento útil para instalación o uso.' },
    { label: 'Carga pública', description: 'Marca los puntos con mejor encaje estimado para infraestructura de carga pública.' },
  ];
}

function labelNse(value) {
  if (value === 'alto') return 'Alto';
  if (value === 'medio') return 'Medio';
  if (value === 'bajo') return 'Bajo';
  if (value === 'sin_dato') return 'Sin dato';
  return value || '';
}

function compareRowsForExport(a, b) {
  const superRank = { A: 4, B: 3, C: 2, descartar: 1 };
  return (superRank[territorialTier(b)] || 0) - (superRank[territorialTier(a)] || 0)
    || priorityRankValue(b.evinkaPriority) - priorityRankValue(a.evinkaPriority)
    || territorialScore(b) - territorialScore(a)
    || String(a.city || '').localeCompare(String(b.city || ''), 'es')
    || String(a.canonicalName || a.name || '').localeCompare(String(b.canonicalName || b.name || ''), 'es');
}

function buildExportFileName(city, total) {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const scope = city && city !== 'Todos' ? city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-') : 'colombia';
  return `mapco-estudio-mercado-${scope}-${total}-${stamp}.xlsx`;
}

function downloadWorkbook(buffer, filename) {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 0);
}

function renderMap() {
  if (!state.map) return;
  if (state.clusterer) {
    state.clusterer.clearLayers();
    state.map.removeLayer(state.clusterer);
    state.clusterer = null;
  }
  state.markersLayer.forEach((marker) => marker.remove());
  state.markersLayer = [];
  state.markerById = new Map();
  state.renderedMapRows = [...state.filtered];
  const bounds = [];
  state.clusterer = L.markerClusterGroup({
    chunkedLoading: true,
    chunkInterval: 120,
    chunkDelay: 20,
    removeOutsideVisibleBounds: true,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    disableClusteringAtZoom: 16,
    maxClusterRadius: 60,
  });
  state.renderedMapRows.forEach((row) => {
    const marker = L.marker([row.lat, row.lng], {
      title: row.canonicalName || row.name,
      icon: buildLeafletMarkerIcon(row),
      keyboard: false,
      riseOnHover: true,
    });
    marker.__rowId = row.id;
    marker.bindPopup(buildPopupContent(row), { maxWidth: 360, minWidth: 280, autoPan: false, className: 'mapco-popup-shell' });
    marker.on('click', () => {
      highlightCard(row.id);
    });
    state.markersLayer.push(marker);
    state.markerById.set(row.id, marker);
    state.clusterer.addLayer(marker);
    bounds.push([row.lat, row.lng]);
  });
  state.map.addLayer(state.clusterer);
  const city = document.getElementById('cityFilter')?.value || 'Todos';
  const province = document.getElementById('provinceFilter')?.value || 'Todos';
  const ubigeo = document.getElementById('ubigeoFilter')?.value || 'Todos';
  const shouldFocusFilteredArea = city !== 'Todos' || province !== 'Todos' || ubigeo !== 'Todos';
  if (bounds.length && shouldFocusFilteredArea) {
    state.map.fitBounds(bounds, { padding: [48, 48], animate: false });
  } else if (!shouldFocusFilteredArea) {
    state.map.fitBounds(DEFAULT_COLOMBIA_BOUNDS, { padding: [36, 36], animate: false });
  }
}

function focusRow(id) {
  const row = state.filtered.find((item) => item.id === id);
  if (!row) return;
  const marker = state.markerById.get(id);
  state.map.flyTo([row.lat, row.lng], Math.max(state.map.getZoom() || 0, 16), { animate: true, duration: 0.45 });
  if (marker) {
    window.setTimeout(() => marker.openPopup(), 180);
  } else {
    L.popup({ maxWidth: 360, minWidth: 280, autoPan: false, className: 'mapco-popup-shell' })
      .setLatLng([row.lat, row.lng])
      .setContent(buildPopupContent(row))
      .openOn(state.map);
  }
  highlightCard(id);
}

function buildPopupContent(row) {
  return [
    `<div class="popup">`,
    `<div class="popup-title">${escapeHtml(row.canonicalName || row.name)}</div>`,
    `<div class="popup-subtitle">${escapeHtml(labelCommercialBranchDetail(row.commercialBranchDetail || labelCategory(row.category)))} · ${escapeHtml(row.operator)}</div>`,
    `<div class="popup-address">${escapeHtml(row.address)}</div>`,
    `<div class="popup-line"><strong>Puntaje</strong><span>territorial ${escapeHtml(String(territorialScore(row)))} · ${escapeHtml(territorialAction(row))}</span></div>`,
    `<div class="popup-line"><strong>Señales</strong><span>demanda ${escapeHtml(String(row.populationDemandScore || 0))} · actividad ${escapeHtml(String(row.activityDensityScore || 0))} · EV ${escapeHtml(String(row.evAffinityAdvancedScore || 0))} · noticias ${escapeHtml(String(row.newsSignalScore || 0))}</span></div>`,
    `<div class="popup-line"><strong>Estado</strong><span>${escapeHtml(labelPremium(row.evinkaPriority))}</span></div>`,
    row.commercialScaleLabel ? `<div class="popup-line"><strong>Escala</strong><span>${escapeHtml(row.commercialScaleLabel)}</span></div>` : '',
    formatTerritoryLine(row) ? `<div class="popup-line"><strong>Territorio</strong><span>${escapeHtml(formatTerritoryLine(row))}</span></div>` : '',
    row.commercialReviewNotes?.length ? `<div class="popup-line"><strong>Ajuste</strong><span>${escapeHtml(formatCommercialNotes(row.commercialReviewNotes))}</span></div>` : '',
    `<div class="popup-line"><strong>Base</strong><span>${row.rawCount > 1 ? `${escapeHtml(String(row.rawCount))} consolidados · ${escapeHtml(String(row.aliasCount))} alias` : 'registro único limpio'}</span></div>`,
    `<div class="popup-line"><strong>Calidad</strong><span>Ubigeo ${escapeHtml(row.ubigeo)} · parking ${escapeHtml(labelParking(row.parkingProbability))} · confianza ${escapeHtml(labelConfidence(row.confidence))} · ${escapeHtml(labelReview(row.reviewStatus))}</span></div>`,
    `<a class="popup-link" href="${escapeHtml(googleMapsUrl(row))}" target="_blank" rel="noopener noreferrer">Abrir en Google Maps</a>`,
    `</div>`,
  ].join('');
}

function highlightCard(id) {
  document.querySelectorAll('.location-card').forEach((card) => card.classList.toggle('active', card.dataset.id === id));
}

function labelCategory(value) {
  const labels = { 'Grifo / estación de servicio': 'Estación de servicio', 'Centro comercial / strip mall': 'Centro comercial', 'Supermercado': 'Retail / supermercado', 'Cadena comida rápida': 'Comida rápida', 'Cadena café/restaurante': 'Café / restaurante', 'Clínica / hospital': 'Salud', 'Universidad': 'Educación superior', 'Parqueadero público': 'Parking', 'Concesionario': 'Concesionario automotriz', 'Hotel': 'Hotel / alojamiento', 'Todos': 'Todas las categorías' };
  return labels[value] || value;
}

function labelCommercialBranchDetail(value, mode = 'short') {
  const labels = {
    'Todos': { short: 'Todas las ramas', filter: 'Todas las ramas' },
    'Salud · pequeño / auxiliar': { short: 'Salud pequeño', filter: 'Salud pequeño · farmacias, consultorios, laboratorios y apoyo' },
    'Salud · mediano formato': { short: 'Salud mediano', filter: 'Salud mediano · IPS, EPS, centros médicos y atención intermedia' },
    'Salud · gran formato': { short: 'Salud grande', filter: 'Salud grande · clínicas, hospitales y complejos de salud' },
    'Retail · pequeño / auxiliar': { short: 'Retail pequeño', filter: 'Retail pequeño · pasajes, bazares, zonas y comercio auxiliar' },
    'Retail · formato medio': { short: 'Retail mediano', filter: 'Retail mediano · galerías, plazas y comercio consolidado medio' },
    'Retail · gran formato': { short: 'Retail grande', filter: 'Retail grande · centros comerciales, malls y outlets' },
    'Educación · subunidad / auxiliar': { short: 'Educación pequeño', filter: 'Educación pequeño · bloques, facultades y subunidades' },
    'Educación · formato medio': { short: 'Educación mediano', filter: 'Educación mediano · sedes y campus intermedios' },
    'Educación · gran formato': { short: 'Educación grande', filter: 'Educación grande · universidades y campus principales' },
    'Hotelería · pequeño / auxiliar': { short: 'Hotelería pequeño', filter: 'Hotelería pequeño · subzonas, torres o apoyo' },
    'Hotelería · formato medio': { short: 'Hotelería mediano', filter: 'Hotelería mediano · hostales, boutique y apartahotel' },
    'Hotelería · gran formato': { short: 'Hotelería grande', filter: 'Hotelería grande · hoteles y complejos principales' },
    'Parking · pequeño / auxiliar': { short: 'Parking pequeño', filter: 'Parking pequeño · apoyo interno o auxiliar' },
    'Parking · formato medio': { short: 'Parking mediano', filter: 'Parking mediano · parking comercial estándar' },
    'Parking · estructurado': { short: 'Parking grande', filter: 'Parking grande · parking estructurado o ancla' },
    'Automotriz · concesionario': { short: 'Automotriz grande', filter: 'Automotriz grande · concesionarios' },
    'Movilidad · estación de servicio': { short: 'Movilidad mediano', filter: 'Movilidad mediano · estaciones de servicio' },
    'Consumo · comida rápida': { short: 'Consumo pequeño', filter: 'Consumo pequeño · comida rápida' },
    'Consumo · café / restaurante': { short: 'Consumo pequeño', filter: 'Consumo pequeño · cafés y restaurantes' },
  };
  return labels[value]?.[mode] || labels[value]?.short || value;
}

function labelParking(value) { return value === 'high' ? 'alto' : value === 'medium' ? 'medio' : 'bajo'; }
function labelConfidence(value) { return value === 'high' ? 'alta' : value === 'medium' ? 'media' : 'baja'; }
function labelTier(value) { if (value === 'high') return 'alto'; if (value === 'medium') return 'medio'; if (value === 'low') return 'bajo'; return 'sin potencial'; }
function labelSuper(value) { if (value === 'A') return 'Prioridad territorial alta'; if (value === 'B') return 'Prioridad territorial media'; if (value === 'C') return 'Prioridad territorial baja'; return 'Sin prioridad territorial'; }
function labelPremium(value) { if (value === 'atacar_ya') return 'Lead listo'; if (value === 'revisar') return 'Validar'; return 'No priorizar'; }
function labelGoogleValidation(value, hasRealLink = false) {
  if (value === 'validated') return hasRealLink ? 'Google validado · link real' : 'Google validado';
  if (value === 'validated_auto') return hasRealLink ? 'Google validado auto · link real' : 'Google validado auto';
  if (value === 'ambiguous') return 'Google ambiguo';
  if (value === 'not_found') return 'Google no encontrado';
  if (value === 'no_match') return 'Google sin match';
  return hasRealLink ? 'Con link real Maps' : 'Google pendiente';
}
function googleValidationPillClass(value) {
  if (value === 'validated' || value === 'validated_auto') return 'approved_auto';
  if (value === 'ambiguous') return 'review_light';
  return 'descartar';
}
function formatCommercialNotes(notes) { return notes.map((note) => note.replaceAll('_', ' ')).join(' · '); }
function labelReview(value) { if (value === 'review_light') return 'Dato con duda'; return 'Dato limpio'; }
function enrichTerritoryRow(row) { return { ...row, commercialBranch: row.commercialBranch || 'Otros', commercialBranchDetail: row.commercialBranchDetail || labelCategory(row.category), commercialScale: row.commercialScale || 'mediano', commercialScaleLabel: row.commercialScaleLabel || 'Formato mediano', officialDivisionType: row.officialDivisionType || inferDivisionType(row), officialDivisionName: row.officialDivisionName || row.provinceCommercial || row.localityName || row.zone || 'Sin división' }; }
function googleMapsUrl(row) {
  if (row.googleMapsUri) return row.googleMapsUri;
  const placeId = row.placeId || row.googlePlaceId || row.google_place_id;
  if (placeId) return `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(placeId)}`;
  if (Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lng))) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${row.lat},${row.lng}`)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([row.canonicalName || row.name || row.operator || '', row.address || '', row.city || '', 'Colombia'].filter(Boolean).join(', '))}`;
}
function formatTerritoryLine(row) { return [row.officialDivisionType, row.officialDivisionName].filter(Boolean).join(' · '); }
function sortAlpha(list) { return [...list].sort((a, b) => String(a).localeCompare(String(b), 'es')); }
function unique(list) { return [...new Set(list.filter(Boolean))]; }
function escapeHtml(value = '') { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }
function divisionFilterValue(row, city) { return row.officialDivisionName || row.provinceCommercial || row.localityName || row.zone || 'Sin división'; }
function inferDivisionType(row) { if (row.city === 'Bogotá') return 'localidad'; if (row.city === 'Medellín' || row.city === 'Cali') return 'comuna'; return 'territorio'; }
function compareCategoryFilterValues(a, b) {
  const familyOrder = {
    'Retail': 1,
    'Consumo': 2,
    'Movilidad': 3,
    'Parking': 4,
    'Automotriz': 5,
    'Hotelería': 6,
    'Salud': 7,
    'Educación': 8,
  };
  const scaleOrder = {
    'pequeño / auxiliar': 1,
    'subunidad / auxiliar': 1,
    'pequeño': 1,
    'formato medio': 2,
    'mediano formato': 2,
    'mediano': 2,
    'estación de servicio': 2,
    'concesionario': 2,
    'gran formato': 3,
    'grande': 3,
    'estructurado': 3,
  };
  const parse = (value) => {
    const [family = value, scale = ''] = String(value).split(' · ');
    return {
      family,
      scale,
      familyRank: familyOrder[family] || 999,
      scaleRank: scaleOrder[scale] || 999,
    };
  };
  const aa = parse(a);
  const bb = parse(b);
  return aa.familyRank - bb.familyRank
    || aa.scaleRank - bb.scaleRank
    || aa.family.localeCompare(bb.family, 'es')
    || aa.scale.localeCompare(bb.scale, 'es')
    || String(a).localeCompare(String(b), 'es');
}
function buildLeafletMarkerIcon(row) {
  const tier = territorialTier(row);
  const color = tier === 'A' ? '#1f1f1f' : tier === 'B' ? '#575757' : tier === 'C' ? '#8d8d8d' : '#b6b6b6';
  return L.divIcon({
    className: 'mapco-marker-wrap',
    html: `<span class="marker-dot" style="background:${escapeHtml(color)}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  });
}

function assignRelativeTerritorialTiers(rows) {
  const byCity = new Map();
  rows.forEach((row) => {
    const city = row.city || 'Sin ciudad';
    if (!byCity.has(city)) byCity.set(city, []);
    byCity.get(city).push(row);
  });
  for (const cityRows of byCity.values()) {
    const scores = cityRows.map((row) => Number(row.superPremiumScore) || 0).sort((a, b) => a - b);
    const cutA = quantile(scores, 0.9);
    const cutB = quantile(scores, 0.7);
    const cutC = quantile(scores, 0.45);
    cityRows.forEach((row) => {
      const score = Number(row.superPremiumScore) || 0;
      row.cityRelativeScore = Math.round(percentilePosition(score, scores) * 100);
      row.cityRelativeTier = score >= cutA ? 'A' : score >= cutB ? 'B' : score >= cutC ? 'C' : 'descartar';
      row.cityRelativeAction = row.cityRelativeTier === 'A' ? 'Atacar ya en su ciudad' : row.cityRelativeTier === 'B' ? 'Revisar pronto en su ciudad' : row.cityRelativeTier === 'C' ? 'Observar en su ciudad' : 'Descartar en su ciudad';
    });
  }
}

function percentilePosition(value, sortedValues) {
  if (!sortedValues.length) return 0;
  let belowOrEqual = 0;
  for (const item of sortedValues) {
    if (item <= value) belowOrEqual += 1;
  }
  return Math.max(0, Math.min(1, belowOrEqual / sortedValues.length));
}

function quantile(sortedValues, q) {
  if (!sortedValues.length) return 0;
  const pos = (sortedValues.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sortedValues[base + 1] !== undefined ? sortedValues[base] + rest * (sortedValues[base + 1] - sortedValues[base]) : sortedValues[base];
}

function territorialTier(row) {
  return row.cityRelativeTier || row.superPremiumTier || 'descartar';
}

function territorialAction(row) {
  return row.cityRelativeAction || row.superPremiumAction || row.recommendedAction || 'Descartar';
}

function territorialScore(row) {
  return Number(row.cityRelativeScore ?? row.superPremiumScore ?? 0) || 0;
}
function priorityRankValue(priority) {
  if (priority === 'atacar_ya') return 3;
  if (priority === 'revisar') return 2;
  return 1;
}
function debounce(fn, wait = 150) {
  let timeout = null;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
}

function bindShellUI() {
  document.getElementById('logoutBtn')?.addEventListener('click', onLogout);
}

function bindAuthUI() {
  renderAuthUI();
}

async function refreshSession() {
  state.auth.checked = false;
  renderAuthUI();
  try {
    const session = await authApi('/api/auth/session', { method: 'GET' });
    state.auth.authenticated = Boolean(session.authenticated && session.user);
    state.auth.user = session.authenticated ? session.user : null;
  } catch {
    state.auth.authenticated = false;
    state.auth.user = null;
  } finally {
    state.auth.checked = true;
    renderAuthUI();
  }
}

async function onLogout() {
  try {
    await authApi('/api/auth/logout', { method: 'POST', body: '{}' });
  } catch (error) {
    console.error(error);
  }
  window.location.reload();
}

function resetAuthToLogin() {
  state.auth.mode = 'login';
  state.auth.step = 'credentials';
  state.auth.challengeId = null;
  state.auth.resetToken = null;
  state.auth.password = '';
  state.auth.showPassword = false;
  state.auth.resetShowPassword = false;
  state.auth.resetPasswordDraft = '';
  state.auth.resetConfirmPasswordDraft = '';
  state.auth.error = '';
  renderAuthUI();
}

function generateSecurePassword(length = 18) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%*-_+=';
  const all = upper + lower + digits + symbols;
  const chars = [upper, lower, digits, symbols].map((set) => set[Math.floor(Math.random() * set.length)]);
  while (chars.length < length) chars.push(all[Math.floor(Math.random() * all.length)]);
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

async function copyText(text, successMessage = 'Copiado.') {
  if (!text) {
    showAuthError('No hay texto para copiar.');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    state.auth.message = successMessage;
    state.auth.error = '';
    renderAuthUI();
  } catch {
    showAuthError('No pude copiar automáticamente.');
  }
}

function showAuthError(message) {
  state.auth.error = message || 'No pude completar el acceso.';
  renderAuthUI();
}

function renderAuthUI() {
  const gate = document.getElementById('authGate');
  const sessionBar = document.getElementById('sessionBar');
  const sessionEmail = document.getElementById('sessionEmail');
  const panel = document.getElementById('authPanel');
  if (sessionEmail) sessionEmail.textContent = state.auth.user?.email || '—';
  if (sessionBar) sessionBar.hidden = !state.auth.authenticated;
  if (state.auth.authenticated) {
    gate.hidden = true;
    return;
  }
  gate.hidden = false;
  panel.innerHTML = renderAuthPanel();
  bindRenderedAuthPanel();
}

function renderAuthPanel() {
  if (!state.auth.checked) {
    return `
      <div class="eyebrow" style="margin-top:18px;">Iniciar sesión</div>
      <h2 style="font-size:34px; margin:10px 0 8px; letter-spacing:-0.04em;">Verificando acceso…</h2>
      <p class="login-note" style="margin-bottom:22px; line-height:1.7;">Espera un momento mientras validamos tu sesión.</p>
    `;
  }

  const isRegister = state.auth.mode === 'register';
  const isReset = state.auth.mode === 'reset';
  const isVerify = state.auth.step === 'verify';
  const isResetPassword = state.auth.step === 'reset-password';

  return `
    <div class="tab-row">
      <button type="button" class="tab-btn ${!isRegister && !isReset ? 'active' : ''}" data-auth-mode="login">Ingresar</button>
      <button type="button" class="tab-btn ${isRegister ? 'active' : ''}" data-auth-mode="register">Crear cuenta</button>
    </div>
    <div class="eyebrow" style="margin-top:18px;">${isVerify ? 'Verifica tu acceso' : isResetPassword ? 'Nueva contraseña' : isReset ? 'Recuperar acceso' : 'Iniciar sesión'}</div>
    <h2 style="font-size:34px; margin:10px 0 8px; letter-spacing:-0.04em;">${isVerify ? 'Confirma el código' : isResetPassword ? 'Define tu nueva contraseña' : isReset ? 'Recupera tu contraseña' : isRegister ? 'Activa tu cuenta corporativa' : 'Accede con tu contraseña'}</h2>
    <p class="login-note" style="margin-bottom:22px; line-height:1.7;">
      ${isVerify
        ? `Te enviamos un código a <strong>${escapeHtml(state.auth.maskedEmail || '')}</strong>.`
        : isResetPassword
          ? 'Tu código ya fue validado. Ahora crea una nueva contraseña para volver a ingresar.'
          : isReset
            ? 'Te enviaremos un código al correo corporativo y recién después podrás cambiar la contraseña.'
            : isRegister
              ? 'Crea tu cuenta con correo corporativo y confirma el dispositivo por única vez.'
              : 'Si ya confiaste este dispositivo antes, entrarás solo con correo y contraseña.'}
    </p>
    ${state.auth.message ? `<div class="success-box">${escapeHtml(state.auth.message)}</div>` : ''}
    ${state.auth.error ? `<div class="login-error">${escapeHtml(state.auth.error)}</div>` : ''}
    ${isVerify ? renderVerifyForm() : isResetPassword ? renderResetPasswordForm() : renderCredentialsForm()}
  `;
}

function renderCredentialsForm() {
  const isRegister = state.auth.mode === 'register';
  const isReset = state.auth.mode === 'reset';
  const disabled = state.auth.submitting ? 'disabled' : '';
  return `
    <form class="login-form" id="authCredentialsForm">
      <div class="form-grid">
        <label>
          <span class="form-label">Correo corporativo</span>
          <input class="input" name="email" type="email" autocomplete="username" value="${escapeHtml(state.auth.email)}" placeholder="nombre@evinka.tech" required ${disabled} />
        </label>
        ${isReset ? '' : `
        <label>
          <span class="form-label">Contraseña</span>
          <input class="input" id="authPasswordInput" name="password" type="${state.auth.showPassword ? 'text' : 'password'}" autocomplete="current-password" value="${escapeHtml(state.auth.password)}" placeholder="Mínimo 12 caracteres" required ${disabled} />
        </label>`}
      </div>
      ${isRegister ? `<div class="notification-actions" style="margin-top:14px;"><button class="btn-ghost" id="generateRegisterPasswordBtn" type="button" ${disabled}>Generar contraseña segura</button><button class="btn-ghost" id="toggleRegisterPasswordBtn" type="button" ${disabled}>${state.auth.showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}</button><button class="btn-ghost" id="copyRegisterPasswordBtn" type="button" ${disabled || !state.auth.password ? 'disabled' : ''}>Copiar contraseña</button></div>` : ''}
      <div class="form-help">${isReset ? 'Te enviaremos un código de recuperación y, después de validarlo, podrás crear una nueva contraseña.' : isRegister ? 'Te enviaremos un código para confirmar este dispositivo.' : 'Si el dispositivo es nuevo, también te pediremos un código.'}</div>
      <button class="btn" type="submit" ${disabled}>${state.auth.submitting ? 'Enviando…' : isReset ? 'Enviar código de recuperación' : isRegister ? 'Crear cuenta y enviar código' : 'Continuar'}</button>
      <div class="inline-actions">
        ${!isRegister && !isReset ? `<button type="button" class="btn-ghost" id="forgotPasswordBtn" ${disabled}>Me olvidé la contraseña</button>` : ''}
        ${isReset ? `<button type="button" class="btn-ghost" id="backToLoginBtn" ${disabled}>Volver al ingreso</button>` : ''}
      </div>
    </form>
  `;
}

function renderVerifyForm() {
  const isRegister = state.auth.mode === 'register';
  const disabled = state.auth.submitting ? 'disabled' : '';
  return `
    <form class="login-form" id="authVerifyForm">
      <label>
        <span class="form-label">Código de 6 dígitos</span>
        <input class="input" name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="000000" required ${disabled} />
      </label>
      <div class="form-help">Vence en 10 minutos. Si cambiaste de idea, puedes volver y reenviar otro código.</div>
      <button class="btn" type="submit" ${disabled}>${state.auth.submitting ? 'Validando…' : isRegister ? 'Confirmar cuenta' : 'Confirmar dispositivo'}</button>
      <div class="inline-actions">
        <button type="button" class="btn-ghost" id="backToCredentialsBtn" ${disabled}>Volver</button>
        <button type="button" class="btn-ghost" id="resendCodeBtn" ${disabled}>${state.auth.submitting ? 'Enviando…' : 'Reenviar código'}</button>
      </div>
    </form>
  `;
}

function renderResetPasswordForm() {
  const disabled = state.auth.submitting ? 'disabled' : '';
  return `
    <form class="login-form" id="authResetPasswordForm">
      <div class="form-grid">
        <label>
          <span class="form-label">Nueva contraseña</span>
          <input class="input" id="resetPasswordInput" name="password" type="${state.auth.resetShowPassword ? 'text' : 'password'}" autocomplete="new-password" value="${escapeHtml(state.auth.resetPasswordDraft || '')}" placeholder="Mínimo 12 caracteres" required ${disabled} />
        </label>
        <label>
          <span class="form-label">Confirmar contraseña</span>
          <input class="input" id="resetConfirmPasswordInput" name="confirmPassword" type="${state.auth.resetShowPassword ? 'text' : 'password'}" autocomplete="new-password" value="${escapeHtml(state.auth.resetConfirmPasswordDraft || '')}" placeholder="Repite la contraseña" required ${disabled} />
        </label>
      </div>
      <div class="notification-actions" style="margin-top:14px;"><button class="btn-ghost" id="generateResetPasswordBtn" type="button" ${disabled}>Generar contraseña segura</button><button class="btn-ghost" id="toggleResetPasswordBtn" type="button" ${disabled}>${state.auth.resetShowPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}</button><button class="btn-ghost" id="copyResetPasswordBtn" type="button" ${disabled}>Copiar contraseña</button></div>
      <div class="form-help">Por seguridad, cerraremos las sesiones anteriores y tendrás que volver a ingresar.</div>
      <button class="btn" type="submit" ${disabled}>${state.auth.submitting ? 'Guardando…' : 'Guardar nueva contraseña'}</button>
      <div class="inline-actions">
        <button type="button" class="btn-ghost" id="cancelResetPasswordBtn" ${disabled}>Cancelar</button>
      </div>
    </form>
  `;
}

function bindRenderedAuthPanel() {
  document.querySelectorAll('[data-auth-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      state.auth.mode = button.getAttribute('data-auth-mode') === 'register' ? 'register' : 'login';
      state.auth.step = 'credentials';
      state.auth.challengeId = null;
      state.auth.resetToken = null;
      state.auth.showPassword = false;
      state.auth.resetShowPassword = false;
      state.auth.resetPasswordDraft = '';
      state.auth.resetConfirmPasswordDraft = '';
      state.auth.error = '';
      state.auth.message = '';
      renderAuthUI();
    });
  });

  document.getElementById('forgotPasswordBtn')?.addEventListener('click', () => {
    state.auth.mode = 'reset';
    state.auth.step = 'credentials';
    state.auth.challengeId = null;
    state.auth.resetToken = null;
    state.auth.password = '';
    state.auth.showPassword = false;
    state.auth.resetShowPassword = false;
    state.auth.resetPasswordDraft = '';
    state.auth.resetConfirmPasswordDraft = '';
    state.auth.error = '';
    state.auth.message = '';
    renderAuthUI();
  });

  document.getElementById('generateRegisterPasswordBtn')?.addEventListener('click', () => {
    state.auth.password = generateSecurePassword();
    state.auth.showPassword = true;
    state.auth.message = 'Generé una contraseña segura para esta cuenta.';
    state.auth.error = '';
    renderAuthUI();
  });

  document.getElementById('toggleRegisterPasswordBtn')?.addEventListener('click', () => {
    state.auth.showPassword = !state.auth.showPassword;
    renderAuthUI();
  });

  document.getElementById('copyRegisterPasswordBtn')?.addEventListener('click', async () => {
    await copyText(state.auth.password, 'Contraseña copiada.');
  });

  document.getElementById('generateResetPasswordBtn')?.addEventListener('click', () => {
    const password = generateSecurePassword();
    state.auth.resetPasswordDraft = password;
    state.auth.resetConfirmPasswordDraft = password;
    state.auth.resetShowPassword = true;
    state.auth.message = 'Generé una contraseña segura y la puse en ambos campos.';
    state.auth.error = '';
    renderAuthUI();
  });

  document.getElementById('toggleResetPasswordBtn')?.addEventListener('click', () => {
    state.auth.resetShowPassword = !state.auth.resetShowPassword;
    renderAuthUI();
  });

  document.getElementById('copyResetPasswordBtn')?.addEventListener('click', async () => {
    await copyText(state.auth.resetPasswordDraft || document.getElementById('resetPasswordInput')?.value || '', 'Nueva contraseña copiada.');
  });

  document.getElementById('resetPasswordInput')?.addEventListener('input', (event) => {
    state.auth.resetPasswordDraft = event.target.value;
  });

  document.getElementById('resetConfirmPasswordInput')?.addEventListener('input', (event) => {
    state.auth.resetConfirmPasswordDraft = event.target.value;
  });

  document.getElementById('backToLoginBtn')?.addEventListener('click', () => {
    resetAuthToLogin();
  });

  document.getElementById('backToCredentialsBtn')?.addEventListener('click', () => {
    state.auth.step = 'credentials';
    state.auth.challengeId = null;
    state.auth.error = '';
    state.auth.message = '';
    renderAuthUI();
  });

  document.getElementById('resendCodeBtn')?.addEventListener('click', async () => {
    if (state.auth.submitting) return;
    state.auth.submitting = true;
    state.auth.error = '';
    state.auth.message = '';
    renderAuthUI();
    try {
      const endpoint = state.auth.mode === 'reset' ? '/api/auth/password/reset/start' : state.auth.mode === 'register' ? '/api/auth/register/start' : '/api/auth/login';
      const body = state.auth.mode === 'reset' ? { email: state.auth.email } : { email: state.auth.email, password: state.auth.password };
      const data = await authApi(endpoint, { method: 'POST', body: JSON.stringify(body) });
      state.auth.challengeId = data.challengeId;
      state.auth.maskedEmail = data.maskedEmail || '';
      state.auth.message = data.reused ? 'Ya te había enviado un código hace unos segundos. Revisa ese mismo correo.' : 'Te envié un nuevo código.';
    } catch (error) {
      showAuthError(error.message);
    } finally {
      state.auth.submitting = false;
      renderAuthUI();
    }
  });

  document.getElementById('authCredentialsForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (state.auth.submitting) return;
    const form = new FormData(event.currentTarget);
    state.auth.email = String(form.get('email') || '').trim().toLowerCase();
    state.auth.password = String(form.get('password') || '');
    state.auth.submitting = true;
    state.auth.error = '';
    state.auth.message = '';
    renderAuthUI();
    try {
      const endpoint = state.auth.mode === 'reset' ? '/api/auth/password/reset/start' : state.auth.mode === 'register' ? '/api/auth/register/start' : '/api/auth/login';
      const body = state.auth.mode === 'reset' ? { email: state.auth.email } : { email: state.auth.email, password: state.auth.password };
      const data = await authApi(endpoint, { method: 'POST', body: JSON.stringify(body) });
      if (data.authenticated) {
        state.auth.authenticated = true;
        state.auth.user = data.user;
        state.auth.step = 'credentials';
        state.auth.challengeId = null;
        state.auth.resetToken = null;
        state.auth.error = '';
        state.auth.message = '';
        renderAuthUI();
        await bootApp();
        return;
      }
      state.auth.step = 'verify';
      state.auth.challengeId = data.challengeId;
      state.auth.maskedEmail = data.maskedEmail || '';
      state.auth.message = data.reused ? 'Ya te había enviado un código hace unos segundos. Usa ese mismo correo.' : state.auth.mode === 'reset' ? 'Código de recuperación enviado.' : state.auth.mode === 'register' ? 'Código de activación enviado.' : 'Código enviado correctamente.';
    } catch (error) {
      showAuthError(error.message);
    } finally {
      state.auth.submitting = false;
      renderAuthUI();
    }
  });

  document.getElementById('authVerifyForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (state.auth.submitting) return;
    const form = new FormData(event.currentTarget);
    const code = String(form.get('code') || '').trim();
    state.auth.submitting = true;
    state.auth.error = '';
    state.auth.message = '';
    renderAuthUI();
    try {
      const endpoint = state.auth.mode === 'reset' ? '/api/auth/password/reset/verify' : state.auth.mode === 'register' ? '/api/auth/register/verify' : '/api/auth/login/verify';
      const data = await authApi(endpoint, { method: 'POST', body: JSON.stringify({ challengeId: state.auth.challengeId, code }) });
      if (state.auth.mode === 'reset') {
        state.auth.step = 'reset-password';
        state.auth.resetToken = data.resetToken;
        state.auth.challengeId = null;
        state.auth.resetShowPassword = false;
        state.auth.resetPasswordDraft = '';
        state.auth.resetConfirmPasswordDraft = '';
        state.auth.message = 'Código validado. Ya puedes crear tu nueva contraseña.';
      } else if (state.auth.mode === 'register' && data.requiresApproval) {
        state.auth.step = 'credentials';
        state.auth.challengeId = null;
        state.auth.message = data.message || 'Tu cuenta quedó verificada y pendiente de aprobación.';
        state.auth.error = '';
        state.auth.mode = 'login';
        state.auth.password = '';
        state.auth.showPassword = false;
      } else {
        state.auth.authenticated = true;
        state.auth.user = data.user;
        state.auth.step = 'credentials';
        state.auth.challengeId = null;
        state.auth.resetToken = null;
        state.auth.error = '';
        state.auth.message = '';
        renderAuthUI();
        await bootApp();
        return;
      }
    } catch (error) {
      showAuthError(error.message);
    } finally {
      state.auth.submitting = false;
      renderAuthUI();
    }
  });

  document.getElementById('authResetPasswordForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (state.auth.submitting) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') || '');
    const confirmPassword = String(form.get('confirmPassword') || '');
    state.auth.resetPasswordDraft = password;
    state.auth.resetConfirmPasswordDraft = confirmPassword;
    if (password !== confirmPassword) {
      showAuthError('Las contraseñas no coinciden.');
      return;
    }
    state.auth.submitting = true;
    state.auth.error = '';
    state.auth.message = '';
    renderAuthUI();
    try {
      const data = await authApi('/api/auth/password/reset/complete', { method: 'POST', body: JSON.stringify({ resetToken: state.auth.resetToken, password }) });
      resetAuthToLogin();
      state.auth.message = data.message || 'Contraseña actualizada.';
    } catch (error) {
      showAuthError(error.message);
    } finally {
      state.auth.submitting = false;
      renderAuthUI();
    }
  });

  document.getElementById('cancelResetPasswordBtn')?.addEventListener('click', () => {
    resetAuthToLogin();
  });
}


async function authApi(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  const text = await response.text();
  let data = {};
  if (text) {
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
  }
  if (!response.ok) {
    throw new Error(data.message || data.error || `HTTP ${response.status}`);
  }
  return data;
}

async function fetchJson(url) {
  const response = await fetch(`${url}?ts=${Date.now()}`, {
    cache: 'no-store',
    credentials: 'same-origin',
  });
  if (response.status === 401) {
    state.auth.authenticated = false;
    state.auth.user = null;
    state.auth.checked = true;
    state.auth.mode = 'login';
    state.auth.step = 'credentials';
    state.auth.message = 'Tu sesión expiró. Vuelve a ingresar.';
    renderAuthUI();
    throw new Error('Sesión vencida');
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
