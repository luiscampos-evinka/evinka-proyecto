const state = {
  user: null,
  config: null,
  quotes: [],
  techVisits: [],
  installationOrders: [],
  conformities: [],
  adminUsers: [],
  selectedTab: 'quote',
  catalogDraft: null,
  quotePhotos: [],
};

const el = (id) => document.getElementById(id);

init();

async function init() {
  bindUI();
  await loadSession();
}

function bindUI() {
  el('loginForm').addEventListener('submit', onLogin);
  el('registerForm')?.addEventListener('submit', onRegisterRequest);
  el('toggleRegisterBtn')?.addEventListener('click', toggleRegisterForm);
  el('logoutBtn').addEventListener('click', onLogout);
  el('quoteForm').addEventListener('submit', onGenerateQuote);
  el('resetFormBtn').addEventListener('click', () => {
    el('quoteForm').reset();
    clearQuotePrefill();
    if (el('sitePhotos')) el('sitePhotos').value = '';
    state.quotePhotos = [];
    renderSelectedPhotosPreview();
    renderQuoteSelects();
  });
  el('sitePhotos')?.addEventListener('change', onAddSitePhotos);
  el('commercialProfileSelect')?.addEventListener('change', renderQuoteSelects);
  el('adminForm').addEventListener('submit', onSaveAdmin);
  document.querySelectorAll('.tab').forEach((btn) => btn.addEventListener('click', () => setTab(btn.dataset.tab)));
}

async function loadSession() {
  const res = await fetch('/api/me');
  const data = await res.json();
  state.user = data.user;
  state.config = data.config;
  if (!state.user) {
    showLogin();
    return;
  }
  showDashboard();
  await Promise.allSettled([
    loadCatalog(),
    loadQuotes(),
    loadTechVisits(),
    loadInstallationOrders(),
    loadConformities(),
    state.user.role === 'admin' ? loadAdminUsers() : Promise.resolve(),
  ]);
  applyAdvisorPrefillFromQuery();
}

function showLogin() {
  el('loginView').classList.remove('hidden');
  el('dashboardView').classList.add('hidden');
}

function showDashboard() {
  el('loginView').classList.add('hidden');
  el('dashboardView').classList.remove('hidden');
  el('companyName').textContent = state.config?.company?.name || 'EVINKA Cotizador';
  el('companyTagline').textContent = state.config?.company?.tagline || '';
  el('sessionBadge').textContent = `${state.user.role} · ${state.user.name}`;
  el('adminTabBtn').classList.toggle('hidden', !isAdminUser());
  el('quoteTabBtn')?.classList.toggle('hidden', !canEditCommercialFlow());
  el('quotesTabBtn')?.classList.toggle('hidden', !canEditCommercialFlow());
  el('visitsTabBtn')?.classList.toggle('hidden', !canSeeOperations());
  el('opsTabBtn')?.classList.toggle('hidden', !canSeeOperations());
  el('conformitiesTabBtn')?.classList.toggle('hidden', !canSeeOperations());
  el('techName').value = state.user.name;
  if (el('quoteForm').visitDate && !el('quoteForm').visitDate.value) {
    el('quoteForm').visitDate.value = new Date().toISOString().slice(0, 10);
  }
  setTab(canEditCommercialFlow() ? 'quote' : 'ops');
}

function setTab(name) {
  state.selectedTab = name;
  document.querySelectorAll('.tab').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === name));
  ['quote', 'quotes', 'visits', 'ops', 'conformities', 'admin'].forEach((tab) => {
    const panel = el(`tab-${tab}`);
    if (panel) panel.classList.toggle('hidden', tab !== name);
  });
}

function applyAdvisorPrefillFromQuery() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('source') !== 'advisor') return;
  const form = el('quoteForm');
  if (!form || !canEditCommercialFlow()) return;
  const map = [
    ['clientName', 'clientName'],
    ['email', 'email'],
    ['city', 'city'],
    ['visitDate', 'visitDate'],
    ['technicianNotes', 'technicianNotes'],
  ];
  for (const [field, param] of map) {
    if (form[field] && params.get(param)) form[field].value = params.get(param);
  }
  if (params.get('reference')) form.dataset.reference = params.get('reference');
  setTab('quote');
}

async function onLogin(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: form.get('identifier'), secret: form.get('secret') }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return alert(data.error || 'No pude entrar. Revisa tu código/PIN o el acceso admin de respaldo.');
  }
  await loadSession();
}

function toggleRegisterForm() {
  el('registerForm')?.classList.toggle('hidden');
}

async function onRegisterRequest(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const res = await fetch('/api/register-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: form.get('name'),
      email: form.get('email'),
      password: form.get('password'),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return alert(data.error || 'No pude registrar la solicitud.');
  event.target.reset();
  event.target.classList.add('hidden');
  alert(data.message || 'Solicitud enviada. Espera aprobación del admin.');
}

async function onLogout() {
  await fetch('/api/logout', { method: 'POST' });
  location.reload();
}

async function loadCatalog() {
  const res = await fetch('/api/catalog');
  if (!res.ok) return;
  state.catalog = await res.json();
  state.catalogDraft = structuredClone(state.catalog);
  renderQuoteSelects();
  renderExtras();
  renderAdminEditor();
}

function renderQuoteSelects() {
  const profiles = state.catalog.commercialProfiles || [];
  const currentProfileId = el('commercialProfileSelect')?.value;
  fillSelect('commercialProfileSelect', profiles.map((item) => ({ value: item.id, label: `${item.name} · margen ${formatPercent(item.marginPercent)}` })), currentProfileId);
  const effectiveProfile = getSelectedCommercialProfile();
  const cables = buildCablesForProfile(effectiveProfile);
  const currentCableId = el('cableSelect')?.value;
  fillSelect('cableSelect', cables.map((item) => ({ value: item.id, label: `${item.label} (${money(item.pricePerMeter)}/m)` })), currentCableId);
}

function renderExtras() {
  const wrap = el('extrasList');
  const extras = state.catalog.catalog?.conditionals || [];
  wrap.innerHTML = extras.map((item) => `
    <label class="extras-item">
      <input type="checkbox" name="cond_${item.code}_active" value="1">
      <span>
        <strong>${item.description}</strong>
        <small>${item.section} · ${item.unit}</small>
      </span>
      <input type="number" name="cond_${item.code}_qty" min="0" step="0.01" value="1">
    </label>
  `).join('');
}

function renderAdminEditor() {
  const config = state.catalogDraft || state.catalog;
  const wrap = el('catalogEditor');
  if (state.user.role !== 'admin') {
    wrap.innerHTML = '<p class="muted">Sin acceso de admin.</p>';
    return;
  }
  wrap.innerHTML = `
    <div class="catalog-section">
      <h3>PARÁMETROS · Reglas del cotizador</h3>
      <p class="muted">Aquí puedes cambiar factores, mínimos comerciales y límites sin tocar fórmulas.</p>
      ${parametersEditor(config.defaults)}
    </div>
    <div class="catalog-section">
      <h3>PERFILES COMERCIALES · Márgenes por cliente o marca</h3>
      <p class="muted">Define qué opciones verá el técnico en el cotizador. Cada perfil aplica su propio margen automático. La primera fila queda como perfil general por defecto.</p>
      ${commercialProfilesEditor(config.commercialProfiles || [])}
    </div>
    <div class="catalog-section">
      <h3>CATÁLOGO · Maestro único de precios</h3>
      <p class="muted">Edita <strong>Costo base</strong> y el <strong>factor general</strong> aquí; el cotizador jala el costo ajustado.</p>
      ${catalogMasterTable(config.catalog.items)}
    </div>
  `;
  el('adminForm').companyName.value = config.company.name || '';
  el('adminForm').companyTagline.value = config.company.tagline || '';
  el('adminForm').igv.value = config.defaults.igv ?? 0.18;
}

async function loadAdminUsers() {
  if (state.user?.role !== 'admin') return;
  const res = await fetch('/api/admin/users');
  const data = await res.json().catch(() => []);
  if (!res.ok) return;
  state.adminUsers = data;
  renderAdminUsers();
}

function renderAdminUsers() {
  const wrap = el('accountsAdmin');
  if (!wrap) return;
  if (state.user?.role !== 'admin') {
    wrap.innerHTML = '';
    return;
  }
  const users = state.adminUsers || [];
  const pending = users.filter((user) => user.status === 'pending');
  const active = users.filter((user) => user.status === 'active');
  const blocked = users.filter((user) => user.status === 'blocked');
  const roles = state.config?.roles || ['admin', 'tech', 'tecnico_supervisor'];
  wrap.innerHTML = `
    <h3>Cuentas</h3>
    <p class="muted">El admin crea las cuentas y asigna un código + PIN para entrar directo.</p>
    <form class="form-grid top-gap-sm" onsubmit="window.createAdminUser(event)">
      <label>
        Nombre
        <input name="name" type="text" placeholder="Julio Campos" required />
      </label>
      <label>
        Correo (opcional)
        <input name="email" type="email" placeholder="julio.campos@evinka.tech" />
      </label>
      <label>
        Rol
        <select name="role">
          ${roles.map((role) => `<option value="${escapeHtml(role)}">${escapeHtml(role)}</option>`).join('')}
        </select>
      </label>
      <label>
        Código (opcional)
        <input name="employeeCode" type="text" placeholder="TEC014" />
      </label>
      <label>
        PIN
        <input name="pin" type="password" inputmode="numeric" pattern="\\d{4,8}" placeholder="1234" required />
      </label>
      <button class="primary" type="submit">Crear cuenta</button>
    </form>
    <div class="result-grid top-gap-sm">
      <div class="metric"><b>Pendientes</b><span>${pending.length}</span></div>
      <div class="metric"><b>Activas</b><span>${active.length}</span></div>
      <div class="metric"><b>Bloqueadas</b><span>${blocked.length}</span></div>
    </div>
    <div class="accounts-grid top-gap-sm">
      ${users.length ? users.map(renderAdminUserCard).join('') : '<p class="muted">No hay cuentas registradas.</p>'}
    </div>
  `;
}

function renderAdminUserCard(user) {
  const requested = user.requestedAt ? formatDate(user.requestedAt) : '-';
  const granted = user.accessGrantedAt ? formatDate(user.accessGrantedAt) : '-';
  const pinStatus = user.hasPin ? 'PIN listo' : 'Sin PIN';
  return `
    <article class="quote-card account-card">
      <div class="row">
        <strong>${escapeHtml(user.name || user.email)}</strong>
        <span class="pill pill-${escapeHtml(user.status)}">${escapeHtml(labelUserStatus(user.status))}</span>
      </div>
      <div class="row"><span>${escapeHtml(user.email || '-')}</span><span>${escapeHtml(user.role || 'tech')}</span></div>
      <div class="row"><span>Código</span><span>${escapeHtml(user.employeeCode || '-')}</span></div>
      <div class="row"><span>PIN</span><span>${escapeHtml(pinStatus)}</span></div>
      <div class="row"><span>Solicitud</span><span>${requested}</span></div>
      <div class="row"><span>Acceso</span><span>${granted}</span></div>
      <div class="row quote-card-actions">
        ${user.status !== 'active' ? `<button class="primary compact-btn" type="button" onclick="window.updateUserAccess('${user.id}','approve')">Dar acceso</button>` : ''}
        ${user.status !== 'blocked' ? `<button class="secondary compact-btn" type="button" onclick="window.updateUserAccess('${user.id}','block')">Quitar acceso</button>` : ''}
        <button class="secondary compact-btn" type="button" onclick="window.manageUserCredentials('${user.id}')">Código / PIN</button>
      </div>
    </article>
  `;
}

function labelUserStatus(status) {
  if (status === 'pending') return 'Pendiente';
  if (status === 'blocked') return 'Bloqueada';
  return 'Activa';
}

async function updateUserAccess(id, action) {
  const ok = window.confirm(action === 'approve'
    ? '¿Dar acceso a esta cuenta?'
    : '¿Quitar acceso a esta cuenta?');
  if (!ok) return;
  const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}/access`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return alert(data.error || 'No se pudo actualizar la cuenta.');
  await loadAdminUsers();
  alert(action === 'approve' ? 'Acceso aprobado.' : 'Acceso retirado.');
}

window.updateUserAccess = updateUserAccess;

async function createAdminUser(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const res = await fetch('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: form.get('name'),
      email: form.get('email'),
      role: form.get('role'),
      employeeCode: form.get('employeeCode'),
      pin: form.get('pin'),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return alert(data.error || 'No se pudo crear la cuenta.');
  event.target.reset();
  await loadAdminUsers();
  alert(`Cuenta creada. Código asignado: ${data.user?.employeeCode || '-'}`);
}

async function manageUserCredentials(id) {
  const user = (state.adminUsers || []).find((item) => item.id === id);
  if (!user) return;
  const employeeCode = window.prompt('Código del usuario', user.employeeCode || '');
  if (employeeCode === null) return;
  const pin = window.prompt('Nuevo PIN (4 a 8 dígitos). Déjalo vacío para mantener el actual.', '');
  if (pin === null) return;
  const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}/credentials`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      employeeCode,
      ...(pin ? { pin } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return alert(data.error || 'No se pudo actualizar el código o PIN.');
  await loadAdminUsers();
  alert('Código / PIN actualizado.');
}

window.createAdminUser = createAdminUser;
window.manageUserCredentials = manageUserCredentials;

function parametersEditor(defaults = {}) {
  const factors = Array.isArray(defaults.distanceFactors) && defaults.distanceFactors.length
    ? defaults.distanceFactors
    : [
        { upto: 25, factor: 1 },
        { upto: 30, factor: 1.5 },
        { upto: 40, factor: 2 },
        { upto: 50, factor: 3 },
        { upto: Infinity, factor: 3 },
      ];
  const notes = ['0–25 m', '25–30 m', '30–40 m', '40–50 m', '50+ editable'];
  return `
    <div class="catalog-subsection">
      <h4>FACTORES POR DISTANCIA</h4>
      <table class="catalog-table">
        <thead><tr><th>Rango hasta (m)</th><th>Factor</th><th>Nota</th></tr></thead>
        <tbody>
          ${factors.map((item, index) => `
            <tr>
              <td><input name="distanceFactorUpto_${index}" type="text" value="${escapeHtml(Number.isFinite(Number(item?.upto)) ? Number(item.upto) : '>50')}" ${index === factors.length - 1 ? '' : ''}></td>
              <td><input name="distanceFactorValue_${index}" type="number" min="0" step="0.01" value="${escapeHtml(item?.factor ?? 0)}"></td>
              <td>${notes[index] || ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="catalog-subsection">
      <h4>MARGEN Y COSTOS</h4>
      <table class="catalog-table">
        <thead><tr><th>Parámetro</th><th>Valor</th><th>Nota</th></tr></thead>
        <tbody>
          <tr>
            <td>Divisor precio con margen</td>
            <td><input name="divisorMargin" type="number" min="0" max="1" step="0.01" value="${escapeHtml(defaults.divisorMargin ?? 0.75)}"></td>
            <td>Precio con margen = costo ajustado / este valor</td>
          </tr>
          <tr>
            <td>Factor de costos</td>
            <td><input name="factorGeneralCosts" type="number" min="0" step="0.01" value="${escapeHtml(defaults.factorGeneralCosts ?? 1)}"></td>
            <td>Ahora vive en el catálogo y recalcula el costo ajustado</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="catalog-subsection">
      <h4>LÍMITES DE CALIBRES</h4>
      <table class="catalog-table">
        <thead><tr><th>Parámetro</th><th>Valor</th><th>Nota</th></tr></thead>
        <tbody>
          <tr><td>Distancia máxima 6mm</td><td><input name="max6mm" type="number" min="0" step="1" value="${escapeHtml(defaults.max6mm ?? 40)}"></td><td>Hasta este valor usa 6mm</td></tr>
          <tr><td>Distancia máxima 10mm</td><td><input name="max10mm" type="number" min="0" step="1" value="${escapeHtml(defaults.max10mm ?? 50)}"></td><td>Hasta este valor usa 10mm</td></tr>
          <tr><td>Calibre superior</td><td>16mm</td><td>Por encima del límite de 10mm</td></tr>
        </tbody>
      </table>
    </div>

    <div class="catalog-subsection">
      <h4>MÍNIMOS COMERCIALES</h4>
      <table class="catalog-table">
        <thead><tr><th>Parámetro</th><th>Valor</th><th>Nota</th></tr></thead>
        <tbody>
          <tr><td>Casa · metros incluidos</td><td><input name="includedMetersCasa" type="number" min="0" step="1" value="${escapeHtml(defaults.includedMetersCasa ?? 10)}"></td><td>Distancia total incluida en el mínimo</td></tr>
          <tr><td>Casa · precio mínimo</td><td><input name="minimumCasa" type="number" min="0" step="0.01" value="${escapeHtml(defaults.minimumCasa ?? 1499)}"></td><td>Base comercial sin adicionales</td></tr>
          <tr><td>Edificio · metros incluidos</td><td><input name="includedMetersEdificio" type="number" min="0" step="1" value="${escapeHtml(defaults.includedMetersEdificio ?? 20)}"></td><td>Distancia total incluida en el mínimo</td></tr>
          <tr><td>Edificio · precio mínimo</td><td><input name="minimumEdificio" type="number" min="0" step="0.01" value="${escapeHtml(defaults.minimumEdificio ?? 1799)}"></td><td>Base comercial sin adicionales</td></tr>
        </tbody>
      </table>
    </div>
  `;
}

function catalogMasterTable(items) {
  const rows = items.map((item, index) => {
    return `
      <tr>
        <td>${escapeHtml(item.code ?? '')}</td>
        <td>${escapeHtml(item.section ?? '')}</td>
        <td>${escapeHtml(item.nature ?? '')}</td>
        <td>${escapeHtml(item.label ?? '')}</td>
        <td>${escapeHtml(item.unit ?? '')}</td>
        <td>${escapeHtml(item.description ?? '')}</td>
        <td><input data-section="items" data-index="${index}" data-field="costBase" type="number" min="0" step="0.01" value="${escapeHtml(item.costBase ?? 0)}"></td>
        <td>${money(item.costAdjusted)}</td>
        <td>${money(item.margin)}</td>
        <td>${money(item.priceWithMargin)}</td>
        <td>${escapeHtml(item.rule ?? '')}</td>
      </tr>
    `;
  }).join('');
  queueMicrotask(() => bindCatalogInputs());
  return `
    <table class="catalog-table">
      <thead><tr>${['Código', 'Sección', 'Naturaleza', 'Etiqueta', 'Unidad', 'Descripción', 'Costo base', 'Costo ajustado', 'Margen', 'Precio con margen', 'Regla'].map((header) => `<th>${header}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function commercialProfilesEditor(profiles = []) {
  const rows = profiles.map((item, index) => `
    <tr>
      <td><input data-section="commercialProfiles" data-index="${index}" data-field="name" type="text" value="${escapeHtml(item.name ?? '')}" placeholder="Ej.: BYD"></td>
      <td><input data-section="commercialProfiles" data-index="${index}" data-field="marginPercent" type="number" min="0" max="95" step="0.01" value="${escapeHtml(item.marginPercent ?? 25)}"></td>
      <td>${formatPercent(item.marginPercent)}</td>
      <td><button class="secondary compact-btn" type="button" data-remove-profile="${index}">Quitar</button></td>
    </tr>
  `).join('');
  queueMicrotask(() => bindCommercialProfilesActions());
  return `
    <table class="catalog-table">
      <thead><tr><th>Nombre visible</th><th>Margen %</th><th>Vista</th><th>Acción</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="actions-row top-gap-sm">
      <button class="secondary" type="button" id="addCommercialProfileBtn">Agregar perfil comercial</button>
    </div>
  `;
}

function bindCatalogInputs() {
  document.querySelectorAll('#catalogEditor input[data-section]').forEach((input) => {
    input.oninput = (event) => {
      const { section, index, field } = event.target.dataset;
      ensureDraft();
      if (section === 'commercialProfiles') {
        state.catalogDraft.commercialProfiles[Number(index)][field] = parseFieldValue(field, event.target.value);
        return;
      }
      state.catalogDraft.catalog[section][Number(index)][field] = parseFieldValue(field, event.target.value);
    };
  });
}

function bindCommercialProfilesActions() {
  el('addCommercialProfileBtn')?.addEventListener('click', addCommercialProfile);
  document.querySelectorAll('[data-remove-profile]').forEach((button) => {
    button.onclick = () => removeCommercialProfile(Number(button.dataset.removeProfile));
  });
}

function addCommercialProfile() {
  ensureDraft();
  state.catalogDraft.commercialProfiles.push({
    id: `perfil-${Date.now()}`,
    name: 'NUEVO PERFIL',
    marginPercent: 25,
  });
  renderAdminEditor();
}

function removeCommercialProfile(index) {
  ensureDraft();
  if ((state.catalogDraft.commercialProfiles || []).length <= 1) {
    alert('Debe quedar al menos un perfil comercial.');
    return;
  }
  state.catalogDraft.commercialProfiles.splice(index, 1);
  renderAdminEditor();
}

function getSelectedCommercialProfile() {
  const profiles = state.catalog?.commercialProfiles || [];
  const selectedId = el('commercialProfileSelect')?.value;
  return profiles.find((item) => item.id === selectedId) || profiles[0] || { id: 'general', name: 'GENERAL', marginPercent: 25 };
}

function buildCablesForProfile(profile) {
  const divisorMargin = Math.max(0.05, 1 - (Number(profile?.marginPercent || 0) / 100));
  const byCode = Object.fromEntries((state.catalog?.catalog?.items || []).map((item) => [item.code, item]));
  return [
    { id: 'cable-6', code: '0060102', label: '6 mm²' },
    { id: 'cable-10', code: '0060110', label: '10 mm²' },
    { id: 'cable-16', code: '0060111', label: '16 mm²' },
  ].map((item) => {
    const source = byCode[item.code] || {};
    return {
      ...item,
      pricePerMeter: divisorMargin ? Number(source.costAdjusted || 0) / divisorMargin : 0,
    };
  });
}

function ensureDraft() {
  if (!state.catalogDraft) state.catalogDraft = structuredClone(state.catalog);
}

async function onSaveAdmin(event) {
  event.preventDefault();
  if (state.user.role !== 'admin') return alert('Sin permisos.');
  const form = new FormData(event.target);
  const payload = {
    company: {
      name: form.get('companyName'),
      tagline: form.get('companyTagline'),
    },
    defaults: {
      igv: Number(form.get('igv') || 0),
      factorGeneralCosts: Number(form.get('factorGeneralCosts') || 1),
      divisorMargin: Number(form.get('divisorMargin') || 0.75),
      max6mm: Number(form.get('max6mm') || 0),
      max10mm: Number(form.get('max10mm') || 0),
      includedMetersCasa: Number(form.get('includedMetersCasa') || 0),
      minimumCasa: Number(form.get('minimumCasa') || 0),
      includedMetersEdificio: Number(form.get('includedMetersEdificio') || 0),
      minimumEdificio: Number(form.get('minimumEdificio') || 0),
      distanceFactors: [0, 1, 2, 3, 4].map((index) => ({
        upto: String(form.get(`distanceFactorUpto_${index}`) || '').trim().includes('>') ? Infinity : Number(form.get(`distanceFactorUpto_${index}`) || 0),
        factor: Number(form.get(`distanceFactorValue_${index}`) || 0),
      })),
    },
    commercialProfiles: (state.catalogDraft.commercialProfiles || []).map((item, index) => ({
      id: item.id || `perfil-${index + 1}`,
      name: String(item.name || '').trim(),
      marginPercent: Number(item.marginPercent || 0),
      isDefault: index === 0,
    })),
    catalog: { items: state.catalogDraft.catalog.items },
  };
  const res = await fetch('/api/catalog', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return alert('No se pudo guardar.');
  await loadCatalog();
  alert('Guardado.');
}

async function onGenerateQuote(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const body = Object.fromEntries(form.entries());
  if (event.target.dataset.visitId) body.visitId = event.target.dataset.visitId;
  if (event.target.dataset.reference) body.reference = event.target.dataset.reference;
  body.conditionals = (state.catalog.catalog?.conditionals || []).map((item) => ({
    code: item.code,
    active: form.get(`cond_${item.code}_active`) === '1',
    quantity: Number(form.get(`cond_${item.code}_qty`) || 0),
  }));
  body.photos = await collectQuotePhotos();
  body.distance = Number(body.distance || 0);
  body.voltage = Number(body.voltage || 0);
  body.current = Number(body.current || 0);
  const res = await fetch('/api/quotes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return alert(data.error || 'No pude generar la cotización.');
  const quote = data;
  renderQuoteResult(quote);
  clearQuotePrefill();
  await Promise.allSettled([loadQuotes(), loadTechVisits(), loadInstallationOrders(), loadConformities()]);
  el('sitePhotos').value = '';
  state.quotePhotos = [];
  renderSelectedPhotosPreview();
  setTab('quotes');
}

function renderQuoteResult(quote) {
  const host = el('quoteResult');
  host.classList.remove('hidden');
  host.innerHTML = `
    <h3>Cotización lista</h3>
    <div class="result-grid">
      <div class="metric"><b>Cotización</b><span>${displayQuoteLabel(quote)}</span></div>
      <div class="metric"><b>Perfil</b><span>${escapeHtml(quote.commercialProfile?.name || 'GENERAL')}</span></div>
      <div class="metric"><b>Correo</b><span>${escapeHtml(quote.email || '-')}</span></div>
      <div class="metric"><b>Fotos</b><span>${escapeHtml(String((quote.photos || []).length))}</span></div>
      <div class="metric"><b>Subtotal</b><span>${money(quote.subtotal)}</span></div>
      <div class="metric"><b>IGV</b><span>${money(quote.igv)}</span></div>
      <div class="metric"><b>Total</b><span>${money(quote.total)}</span></div>
    </div>
    <div class="catalog-section">
      <h3>Incluye en el precio base</h3>
      <ul class="included-list">
        ${(quote.includedScope || []).map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
      </ul>
    </div>
    <p class="${quote.emailDelivery?.ok ? 'muted' : 'muted'}"><strong>Envío por correo:</strong> ${escapeHtml(quote.emailDelivery?.message || 'Sin estado')}</p>
    <p><strong>PDF:</strong> <a class="link" href="${quote.pdfPath}" target="_blank" rel="noreferrer">abrir / descargar</a></p>
  `;
}

async function loadQuotes() {
  const res = await fetch('/api/quotes');
  if (!res.ok) return;
  const data = await res.json().catch(() => []);
  state.quotes = Array.isArray(data) ? data : [];
  el('quotesList').innerHTML = state.quotes.length
    ? state.quotes.map(renderQuoteCard).join('')
    : '<p class="muted">Todavía no hay cotizaciones.</p>';
  renderOperations();
}

async function acceptQuote(id) {
  const ok = window.confirm('¿Aceptar esta cotización y crear la orden de instalación?');
  if (!ok) return;
  const res = await fetch(`/api/quotes/${encodeURIComponent(id)}/accept`, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return alert(data.error || 'No se pudo aceptar la cotización.');
  await refreshOperationalData();
  alert(`Cotización aceptada. Orden creada: ${data.installationOrder?.id || '-'}`);
}

window.acceptQuote = acceptQuote;

function renderQuoteCard(rawQuote) {
  const quote = decorateQuote(rawQuote);
  const conformity = findConformityByOrderId(quote.installationOrderId);
  return `
    <article class="quote-card">
      <div class="row">
        <strong>${displayQuoteLabel(quote)}</strong>
        <span class="pill ${statusPillClass(quote.hasGeneratedConformity ? 'pdf_generated' : quote.normalizedStatus)}">${escapeHtml(quote.statusLabel)}</span>
      </div>
      <div class="row"><span>${escapeHtml(quote.clientName || '-')}</span><span>${formatDate(quote.createdAt)}</span></div>
      <div class="row"><span>${escapeHtml(quote.email || '-')}</span><span>${escapeHtml(quote.emailSent ? 'Correo enviado' : 'Correo pendiente')}</span></div>
      <div class="row"><span>${escapeHtml(quote.profileName || quote.commercialProfile?.name || 'GENERAL')}</span><span>${formatPercent(quote.marginPercent || 0)}</span></div>
      <div class="row"><span>${escapeHtml(quote.installationOrderId || 'Sin orden')}</span><span>${escapeHtml(quote.scheduledInstallationWindow || labelQuoteStatus(quote))}</span></div>
      <div class="row"><span>${escapeHtml(quote.installationType || '')} · ${escapeHtml(quote.cable?.label || '')}</span><span><strong>${money(quote.total)}</strong></span></div>
      ${quote.scheduledInstallationAt ? `<div class="row"><span>Instalación programada</span><span>${escapeHtml(formatDate(quote.scheduledInstallationAt))}</span></div>` : ''}
      <div class="row quote-card-actions">
        <a class="link" href="${quote.pdfPath}" target="_blank" rel="noreferrer">PDF</a>
        ${quote.canConfirmForSend ? `<button class="secondary compact-btn" type="button" onclick="window.confirmQuote('${quote.id}')">Confirmar</button>` : ''}
        ${quote.canMarkClientAccepted ? `<button class="secondary compact-btn" type="button" onclick="window.markQuoteAccepted('${quote.id}')">Cliente acepta</button>` : ''}
        ${quote.canScheduleInstallation ? `<button class="secondary compact-btn" type="button" onclick="window.scheduleInstallation('${quote.id}')">Agendar</button>` : ''}
        ${quote.canRequestRecotizar ? `<button class="secondary compact-btn" type="button" onclick="window.requestQuoteRecotizar('${quote.id}')">Recotizar</button>` : ''}
        ${quote.canCancel ? `<button class="secondary compact-btn" type="button" onclick="window.cancelQuote('${quote.id}')">Cancelar</button>` : ''}
        ${isAdminUser() && quote.normalizedStatus !== 'aceptada_cliente' && quote.normalizedStatus !== 'instalada' && !quote.hasOrder ? `<button class="secondary compact-btn" type="button" onclick="window.acceptQuote('${quote.id}')">Crear orden</button>` : ''}
        ${conformity ? `<a class="link" href="/api/conformities/${encodeURIComponent(conformity.id)}/pdf" target="_blank" rel="noreferrer">Conformidad</a>` : ''}
      </div>
    </article>
  `;
}

async function updateQuoteStatusAction(id, status, successMessage) {
  const res = await fetch(`/api/quotes/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return alert(data.error || 'No se pudo actualizar la cotización.');
  await refreshOperationalData();
  alert(successMessage);
}

async function confirmQuote(id) {
  const ok = window.confirm('¿Dejar esta cotización lista para enviarse al cliente?');
  if (!ok) return;
  await updateQuoteStatusAction(id, 'lista_envio', 'Cotización confirmada. Ya quedó lista para enviar.');
}

async function markQuoteAccepted(id) {
  const ok = window.confirm('¿Registrar que el cliente aceptó la cotización?');
  if (!ok) return;
  await updateQuoteStatusAction(id, 'aceptada_cliente', 'Cliente aceptado registrado. Ya puedes agendar la instalación.');
}

async function requestQuoteRecotizar(id) {
  const ok = window.confirm('¿Mandar esta cotización a recotizar?');
  if (!ok) return;
  await updateQuoteStatusAction(id, 'recotizar', 'La cotización quedó marcada para recotizar.');
}

async function cancelQuote(id) {
  const ok = window.confirm('¿Cancelar esta cotización?');
  if (!ok) return;
  await updateQuoteStatusAction(id, 'cancelada', 'La cotización quedó cancelada.');
}

async function scheduleInstallation(id) {
  const quote = (state.quotes || []).find((item) => item.id === id);
  if (!quote) return alert('No encontré la cotización.');
  const date = window.prompt('Fecha de instalación (YYYY-MM-DD)', new Date().toISOString().slice(0, 10));
  if (!date) return;
  const exactTime = window.prompt('Hora exacta (HH:MM, 24h)', '10:00');
  if (!exactTime) return;
  const timeWindow = window.prompt('Texto visible del horario', exactTime) || exactTime;
  const address = window.prompt('Dirección de instalación', quote.clientAddress || quote.address || quote.city || '');
  if (address === null) return;
  const clientPhone = window.prompt('Teléfono del cliente', quote.clientPhone || '') || '';
  const notes = window.prompt('Notas de instalación', '') || '';
  const assignedTechEmail = window.prompt('Correo del técnico asignado', state.user?.email || '');
  if (!assignedTechEmail) return alert('Necesito el correo del técnico asignado.');

  const scheduledAt = new Date(`${date}T${exactTime}:00`);
  if (Number.isNaN(scheduledAt.getTime())) {
    return alert('Fecha u hora inválida.');
  }

  const res = await fetch(`/api/quotes/${encodeURIComponent(id)}/schedule-installation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scheduledAt: scheduledAt.toISOString(),
      timeWindow,
      clientAddress: address,
      clientPhone,
      notes,
      assignedTechEmail,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return alert(data.error || 'No se pudo agendar la instalación.');
  await refreshOperationalData();
  alert(`Instalación agendada. Orden: ${data.installationOrder?.id || quote.installationOrderId || '-'}`);
}

window.confirmQuote = confirmQuote;
window.markQuoteAccepted = markQuoteAccepted;
window.requestQuoteRecotizar = requestQuoteRecotizar;
window.cancelQuote = cancelQuote;
window.scheduleInstallation = scheduleInstallation;

function labelQuoteStatus(quote) {
  return decorateQuote(quote).statusLabel;
}

async function loadTechVisits() {
  const res = await fetch('/api/tech/visits');
  if (!res.ok) return;
  const data = await res.json().catch(() => []);
  state.techVisits = Array.isArray(data) ? data : [];
  renderVisits();
  renderOperations();
}

async function loadInstallationOrders() {
  const res = await fetch('/api/installation-orders');
  if (!res.ok) return;
  const data = await res.json().catch(() => []);
  state.installationOrders = Array.isArray(data) ? data : [];
  renderOperations();
}

async function loadConformities() {
  const res = await fetch('/api/conformities');
  if (!res.ok) return;
  const data = await res.json().catch(() => []);
  state.conformities = Array.isArray(data) ? data : [];
  renderConformities();
  renderOperations();
}

async function refreshOperationalData() {
  await Promise.allSettled([
    loadQuotes(),
    loadTechVisits(),
    loadInstallationOrders(),
    loadConformities(),
  ]);
}

function renderVisits() {
  const summary = el('visitsSummary');
  const list = el('visitsList');
  if (!summary || !list) return;
  const visits = [...(state.techVisits || [])].map(decorateVisit).sort(compareVisits);
  const today = visits.filter((visit) => visit.isToday && !visit.isClosed);
  const pending = visits.filter((visit) => !visit.isClosed);
  const onRoute = visits.filter((visit) => visit.status === 'en_ruta' || visit.status === 'en_visita');
  summary.innerHTML = `
    <div class="metric"><b>Hoy</b><span>${today.length}</span></div>
    <div class="metric"><b>Abiertas</b><span>${pending.length}</span></div>
    <div class="metric"><b>En movimiento</b><span>${onRoute.length}</span></div>
    <div class="metric"><b>Cerradas</b><span>${visits.filter((visit) => visit.isClosed).length}</span></div>
  `;
  list.innerHTML = visits.length
    ? visits.map(renderVisitCard).join('')
    : '<p class="muted">No hay visitas registradas todavía.</p>';
}

function renderVisitCard(rawVisit, { compact = false } = {}) {
  const visit = decorateVisit(rawVisit);
  const actions = [];
  actions.push(`<button class="secondary compact-btn" type="button" onclick="window.openVisitMaps('${visit.id}')">Ruta</button>`);
  if (visit.status === 'agendada') {
    actions.push(`<button class="secondary compact-btn" type="button" onclick="window.updateVisitStatus('${visit.id}','en_ruta')">Ir en ruta</button>`);
  }
  if (visit.status === 'en_ruta') {
    actions.push(`<button class="secondary compact-btn" type="button" onclick="window.updateVisitStatus('${visit.id}','en_visita')">Marcar en visita</button>`);
  }
  if (visit.status === 'en_visita') {
    actions.push(`<button class="secondary compact-btn" type="button" onclick="window.updateVisitStatus('${visit.id}','${visit.isInstallation ? 'pendiente_cierre' : 'visitada'}')">${visit.isInstallation ? 'Pendiente de cierre' : 'Marcar visitada'}</button>`);
  }
  if ((visit.status === 'visitada' || visit.status === 'pendiente_cierre') && !visit.isClosed) {
    actions.push(`<button class="secondary compact-btn" type="button" onclick="window.closeVisit('${visit.id}')">Cerrar</button>`);
  }
  if (visit.needsQuote && canEditCommercialFlow()) {
    actions.push(`<button class="secondary compact-btn" type="button" onclick="window.prefillQuoteFromVisit('${visit.id}')">Cotizar</button>`);
  }
  if (visit.installationOrderId) {
    const conformity = findConformityByOrderId(visit.installationOrderId);
    if (conformity) {
      actions.push(`<a class="link" href="/api/conformities/${encodeURIComponent(conformity.id)}/pdf" target="_blank" rel="noreferrer">PDF conformidad</a>`);
    }
  }
  return `
    <article class="quote-card ${compact ? 'compact-card' : ''}">
      <div class="row">
        <strong>${escapeHtml(visit.clientName || visit.reference || visit.id)}</strong>
        <span class="pill ${statusPillClass(visit.status)}">${escapeHtml(visit.statusLabel)}</span>
      </div>
      <div class="row"><span>${escapeHtml(visit.typeLabel)}</span><span>${escapeHtml(formatOptionalDate(visit.scheduledAt, visit.timeWindow || 'Sin hora'))}</span></div>
      <div class="row"><span>${escapeHtml(visit.clientAddress || '-')}</span><span>${escapeHtml(visit.assignedTechName || visit.assignedTechEmail || '-')}</span></div>
      <div class="row"><span>${escapeHtml(visit.reference || '-')}</span><span>${escapeHtml(visit.quoteId || visit.installationOrderId || '-')}</span></div>
      ${visit.notes && !compact ? `<div class="row"><span class="muted">${escapeHtml(visit.notes)}</span></div>` : ''}
      <div class="row quote-card-actions">${actions.join('')}</div>
    </article>
  `;
}

function renderOperations() {
  const board = el('opsBoard');
  if (!board) return;
  const visits = [...(state.techVisits || [])].map(decorateVisit).sort(compareVisits);
  const quotes = [...(state.quotes || [])].map(decorateQuote);
  const orders = [...(state.installationOrders || [])];
  const conformities = [...(state.conformities || [])];
  const todayOpen = visits.filter((visit) => visit.isToday && !visit.isClosed);
  const quotePending = visits.filter((visit) => visit.needsQuote && !visit.isClosed);
  const closePending = visits.filter((visit) => (visit.isPendingClose || visit.status === 'visitada') && !visit.isClosed);
  const conformityPending = orders.filter((order) => String(order.conformityStatus || 'not_started').toLowerCase() !== 'pdf_generated');
  const recentConformities = conformities.slice(0, 5);
  const quoteFlowPending = quotes.filter((quote) => quote.canConfirmForSend || quote.canMarkClientAccepted || quote.canScheduleInstallation).slice(0, 6);

  board.innerHTML = `
    <div class="result-grid">
      <div class="metric"><b>Hoy</b><span>${todayOpen.length}</span></div>
      <div class="metric"><b>Por cotizar</b><span>${quotePending.length}</span></div>
      <div class="metric"><b>Por cerrar</b><span>${closePending.length}</span></div>
      <div class="metric"><b>Sin conformidad</b><span>${conformityPending.length}</span></div>
    </div>
    <div class="operations-grid top-gap-sm">
      <section class="catalog-section">
        <h3>Para hoy</h3>
        <p class="muted">Lo más urgente de agenda.</p>
        <div class="quotes-list top-gap-sm">${todayOpen.length ? todayOpen.slice(0, 5).map((visit) => renderVisitCard(visit, { compact: true })).join('') : '<p class="muted">No hay visitas abiertas para hoy.</p>'}</div>
      </section>
      <section class="catalog-section">
        <h3>Flujo comercial pendiente</h3>
        <p class="muted">Cotizaciones que todavía necesitan decisión.</p>
        <div class="quotes-list top-gap-sm">${quoteFlowPending.length ? quoteFlowPending.map(renderQuoteCard).join('') : '<p class="muted">No hay cotizaciones pendientes en este momento.</p>'}</div>
      </section>
      <section class="catalog-section">
        <h3>Órdenes sin conformidad</h3>
        <p class="muted">Instalaciones que aún no cerraron documentalmente.</p>
        <div class="quotes-list top-gap-sm">${conformityPending.length ? conformityPending.slice(0, 8).map(renderOrderCard).join('') : '<p class="muted">Todo lo instalado ya tiene conformidad o todavía no existe orden.</p>'}</div>
      </section>
      <section class="catalog-section">
        <h3>Conformidades recientes</h3>
        <p class="muted">Lo que ya quedó registrado en backend.</p>
        <div class="quotes-list top-gap-sm">${recentConformities.length ? recentConformities.map(renderConformityCard).join('') : '<p class="muted">Aún no hay conformidades registradas.</p>'}</div>
      </section>
    </div>
  `;
}

function renderOrderCard(order) {
  const conformity = findConformityByOrderId(order.id);
  return `
    <article class="quote-card compact-card">
      <div class="row">
        <strong>${escapeHtml(order.clientName || order.id)}</strong>
        <span class="pill ${statusPillClass(order.conformityStatus === 'pdf_generated' ? 'cerrada' : 'pendiente_conformidad')}">${escapeHtml(order.conformityStatus === 'pdf_generated' ? 'Conformidad generada' : 'Pendiente de conformidad')}</span>
      </div>
      <div class="row"><span>${escapeHtml(order.id)}</span><span>${escapeHtml(formatOptionalDate(order.updatedAt || order.createdAt, order.status || '-'))}</span></div>
      <div class="row"><span>${escapeHtml(order.address || '-')}</span><span>${escapeHtml(order.assignedTechnician || order.assignedTechEmail || '-')}</span></div>
      <div class="row quote-card-actions">
        ${order.quotePdfUrl ? `<a class="link" href="${order.quotePdfUrl}" target="_blank" rel="noreferrer">PDF cotización</a>` : ''}
        ${conformity ? `<a class="link" href="/api/conformities/${encodeURIComponent(conformity.id)}/pdf" target="_blank" rel="noreferrer">PDF conformidad</a>` : '<span class="muted">Aún sin PDF</span>'}
      </div>
    </article>
  `;
}

function renderConformities() {
  const summary = el('conformitiesSummary');
  const list = el('conformitiesList');
  if (!summary || !list) return;
  const conformities = [...(state.conformities || [])];
  summary.innerHTML = `
    <div class="metric"><b>Registradas</b><span>${conformities.length}</span></div>
    <div class="metric"><b>Con PDF</b><span>${conformities.filter((item) => item.hasPdfBase64 || item.pdfUrl).length}</span></div>
    <div class="metric"><b>Correo OK</b><span>${conformities.filter((item) => item.emailDelivery?.ok).length}</span></div>
    <div class="metric"><b>Últimas 24h</b><span>${conformities.filter((item) => isWithinHours(item.createdAt, 24)).length}</span></div>
  `;
  list.innerHTML = conformities.length
    ? conformities.map(renderConformityCard).join('')
    : '<p class="muted">Todavía no hay conformidades sincronizadas en backend.</p>';
}

function renderConformityCard(item) {
  const downloadHref = `/api/conformities/${encodeURIComponent(item.id)}/pdf`;
  return `
    <article class="quote-card compact-card">
      <div class="row">
        <strong>${escapeHtml(item.clientName || item.installationOrderId || item.id)}</strong>
        <span class="pill ${statusPillClass(item.status || 'pdf_generated')}">${escapeHtml(item.status === 'pdf_generated' ? 'PDF generado' : item.status || 'Conformidad')}</span>
      </div>
      <div class="row"><span>${escapeHtml(item.installationOrderId || '-')}</span><span>${escapeHtml(formatOptionalDate(item.createdAt, '-'))}</span></div>
      <div class="row"><span>${escapeHtml(item.clientEmail || '-')}</span><span>${escapeHtml(item.ruc || '-')}</span></div>
      <div class="row"><span>${escapeHtml(item.address || '-')}</span><span>${escapeHtml(item.emailDelivery?.ok ? 'Correo enviado' : (item.emailDelivery?.message || 'Sin envío'))}</span></div>
      <div class="row quote-card-actions">
        <a class="link" href="${downloadHref}" target="_blank" rel="noreferrer">Abrir PDF</a>
      </div>
    </article>
  `;
}

async function updateVisitStatus(id, status, extra = {}) {
  const res = await fetch(`/api/tech/visits/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, ...extra }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return alert(data.error || 'No se pudo actualizar la visita.');
  await refreshOperationalData();
}

async function closeVisit(id) {
  const resolution = window.prompt('Resultado / cierre de la visita', 'Visita cerrada desde navegador.');
  if (resolution === null) return;
  await updateVisitStatus(id, 'cerrada', { resolution });
}

function openVisitMaps(id) {
  const visit = (state.techVisits || []).find((item) => item.id === id);
  if (!visit) return alert('No encontré la visita.');
  const target = (visit.clientAddress || visit.reference || '').trim();
  if (!target) return alert('La visita no tiene una dirección útil todavía.');
  window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target)}`, '_blank', 'noopener');
}

function prefillQuoteFromVisit(id) {
  const visit = (state.techVisits || []).find((item) => item.id === id);
  const form = el('quoteForm');
  if (!visit || !form) return;
  if (!canEditCommercialFlow()) {
    alert('Este usuario no tiene acceso al flujo comercial desde web.');
    return;
  }
  form.clientName.value = visit.clientName || '';
  form.email.value = visit.clientEmail || '';
  if (form.city && !form.city.value) form.city.value = 'Lima';
  if (form.visitDate && visit.scheduledAt) form.visitDate.value = new Date(visit.scheduledAt).toISOString().slice(0, 10);
  form.technicianNotes.value = [
    visit.clientAddress ? `Dirección visita: ${visit.clientAddress}` : '',
    visit.reference ? `Referencia visita: ${visit.reference}` : '',
    visit.notes ? `Notas previas: ${visit.notes}` : '',
  ].filter(Boolean).join('\n');
  form.dataset.visitId = visit.id;
  form.dataset.reference = visit.reference || '';
  setTab('quote');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function clearQuotePrefill() {
  const form = el('quoteForm');
  if (!form) return;
  delete form.dataset.visitId;
  delete form.dataset.reference;
}

window.updateVisitStatus = updateVisitStatus;
window.closeVisit = closeVisit;
window.openVisitMaps = openVisitMaps;
window.prefillQuoteFromVisit = prefillQuoteFromVisit;

function displayQuoteLabel(quote) {
  const fromFile = String(quote?.pdfFilename || '').replace(/\.pdf$/i, '');
  if (fromFile) return fromFile;
  const date = new Date(quote?.createdAt || Date.now());
  const yyyymmdd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const number = displayQuoteNumber(quote?.id);
  const client = slugPdfPart(quote?.clientName, 'CLIENTE');
  return `COT-${yyyymmdd}-${number}-${client}`;
}

async function collectQuotePhotos() {
  const photos = [];
  for (const [index, photo] of (state.quotePhotos || []).slice(0, 6).entries()) {
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(photo.file?.type || '')) continue;
    photos.push(await fileToPhotoPayload(photo, index));
  }
  return photos.filter(Boolean);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No pude leer una de las imágenes.'));
    reader.readAsDataURL(file);
  });
}

async function fileToPhotoPayload(photo, index) {
  const dataUrl = await resizeImageFile(photo.file, 1600, 0.82);
  return {
    name: photo.name || `foto-${index + 1}.jpg`,
    contentType: 'image/jpeg',
    title: String(photo.title || '').trim(),
    comment: String(photo.comment || '').trim(),
    dataUrl,
  };
}

async function onAddSitePhotos(event) {
  const input = event.target;
  const incomingFiles = [...(input?.files || [])];
  if (!incomingFiles.length) return;
  const availableSlots = Math.max(0, 6 - state.quotePhotos.length);
  if (!availableSlots) {
    alert('Ya tienes 6 imágenes cargadas. Quita una para agregar otra.');
    input.value = '';
    return;
  }
  const acceptedFiles = incomingFiles
    .filter((file) => /^image\/(jpeg|jpg|png|webp)$/i.test(file.type || ''))
    .slice(0, availableSlots);
  const nextPhotos = acceptedFiles.map((file) => ({
    id: crypto.randomUUID(),
    file,
    name: file.name || 'archivo',
    title: '',
    comment: '',
  }));
  state.quotePhotos.push(...nextPhotos);
  input.value = '';
  renderSelectedPhotosPreview();
  if (incomingFiles.length > acceptedFiles.length) {
    alert('Solo se agregaron las imágenes disponibles hasta completar el máximo de 6.');
  }
}

async function resizeImageFile(file, maxSize = 1600, quality = 0.82) {
  const original = await fileToDataUrl(file);
  const img = await loadImage(original);
  const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * ratio));
  const height = Math.max(1, Math.round(img.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No pude procesar una imagen seleccionada.'));
    img.src = src;
  });
}

function renderSelectedPhotosPreview() {
  const wrap = el('sitePhotosPreview');
  const info = el('sitePhotosInfo');
  const status = el('sitePhotosStatus');
  if (!wrap || !info) return;
  const photos = state.quotePhotos || [];
  info.textContent = photos.length
    ? `${photos.length} imagen(es) cargadas. Puedes agregar más en otra tanda o quitar una por una.`
    : 'Máximo 6 imágenes. Puedes cargarlas en varias tandas y se incluirán en el PDF como anexo técnico.';
  if (status) status.textContent = photos.length ? `${photos.length}/6 cargadas` : 'Sin imágenes cargadas';
  wrap.innerHTML = photos.map((photo, index) => `
    <div class="photo-preview-card">
      <div class="photo-preview-name">Ilustración ${index + 1}</div>
      <div class="photo-preview-file">${escapeHtml(photo.name || 'archivo')}</div>
      <label class="photo-preview-field">
        <span>Título</span>
        <input type="text" data-photo-title-id="${photo.id}" value="${escapeHtml(photo.title || '')}" placeholder="Ej.: Medidor eléctrico" />
      </label>
      <label class="photo-preview-field">
        <span>Leyenda / comentario</span>
        <textarea rows="3" data-photo-comment-id="${photo.id}" placeholder="Ej.: Vista actual del medidor existente y punto de alimentación disponible.">${escapeHtml(photo.comment || '')}</textarea>
      </label>
      <div class="photo-preview-actions">
        <button class="secondary compact-btn" type="button" data-remove-photo-id="${photo.id}">Quitar imagen</button>
      </div>
    </div>
  `).join('');
  bindPhotoPreviewInputs();
}

function bindPhotoPreviewInputs() {
  document.querySelectorAll('[data-photo-title-id]').forEach((input) => {
    input.oninput = (event) => updateQuotePhotoMeta(event.target.dataset.photoTitleId, { title: event.target.value });
  });
  document.querySelectorAll('[data-photo-comment-id]').forEach((input) => {
    input.oninput = (event) => updateQuotePhotoMeta(event.target.dataset.photoCommentId, { comment: event.target.value });
  });
  document.querySelectorAll('[data-remove-photo-id]').forEach((button) => {
    button.onclick = () => removeQuotePhoto(button.dataset.removePhotoId);
  });
}

function updateQuotePhotoMeta(photoId, patch) {
  const photo = state.quotePhotos.find((item) => item.id === photoId);
  if (!photo) return;
  Object.assign(photo, patch);
}

function removeQuotePhoto(photoId) {
  state.quotePhotos = state.quotePhotos.filter((item) => item.id !== photoId);
  renderSelectedPhotosPreview();
}

function displayQuoteNumber(id) {
  const match = String(id || '').match(/(\d+)/g);
  const raw = match ? match.join('') : String(id || '').replace(/\D/g, '');
  return String(raw || '1').slice(-12).padStart(6, '0');
}

function normalizedRoleKey(role = state.user?.role || '') {
  return String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function normalizedEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function isAdminUser() {
  return normalizedRoleKey() === 'admin';
}

function isLuisSupervisor() {
  return normalizedEmail(state.user?.email) === 'luis.campos@evinka.tech';
}

function isTechSupervisor() {
  return ['tecnico_supervisor', 'supervisor_tecnico', 'tech_supervisor', 'technical_supervisor', 'supervisor'].includes(normalizedRoleKey());
}

function canEditCommercialFlow() {
  return isAdminUser()
    || isLuisSupervisor()
    || isTechSupervisor()
    || ['comercial', 'ventas', 'sales', 'commercial', 'asesor', 'advisor', 'asesor_humano', 'human_advisor'].includes(normalizedRoleKey());
}

function canSeeOperations() {
  return Boolean(state.user);
}

function decorateQuote(quote = {}) {
  const normalizedStatus = String(quote?.status || 'cotizada').trim().toLowerCase();
  const normalizedConformityStatus = String(quote?.conformityStatus || 'not_started').trim().toLowerCase();
  const hasOrder = String(quote?.installationOrderId || '').trim().length > 0;
  const hasGeneratedConformity = normalizedConformityStatus === 'pdf_generated';
  const hasScheduledInstallation = String(quote?.scheduledInstallationAt || '').trim().length > 0;
  return {
    ...quote,
    normalizedStatus,
    normalizedConformityStatus,
    hasOrder,
    hasGeneratedConformity,
    hasScheduledInstallation,
    emailSent: quote?.emailDelivery?.ok === true,
    profileName: quote?.commercialProfile?.name || quote?.profileName || 'GENERAL',
    canConfirmForSend: normalizedStatus === 'cotizada',
    canMarkClientAccepted: normalizedStatus === 'lista_envio',
    canRequestRecotizar: normalizedStatus === 'lista_envio',
    canCancel: ['cotizada', 'lista_envio', 'recotizar'].includes(normalizedStatus),
    canScheduleInstallation: normalizedStatus === 'aceptada_cliente' && !hasGeneratedConformity && !hasScheduledInstallation,
    statusLabel: (() => {
      if (hasGeneratedConformity) return 'Conformidad generada';
      if (normalizedStatus === 'instalada') return 'Instalada';
      if (normalizedStatus === 'aceptada_cliente') return 'Aceptada por cliente';
      if (normalizedStatus === 'lista_envio') return 'Lista para enviar';
      if (normalizedStatus === 'recotizar') return 'Recotizar';
      if (normalizedStatus === 'cancelada') return 'Cancelada';
      return 'Cotizada';
    })(),
  };
}

function decorateVisit(visit = {}) {
  const status = String(visit?.status || 'pendiente').trim().toLowerCase();
  const scheduledDate = visit?.scheduledAt ? new Date(visit.scheduledAt) : null;
  const hasQuote = String(visit?.quoteId || '').trim().length > 0;
  const hasOrder = String(visit?.installationOrderId || '').trim().length > 0;
  const isInstallation = String(visit?.type || '').trim().toLowerCase() === 'instalacion';
  const isClosed = status === 'cerrada';
  const isPendingClose = status === 'pendiente_cierre';
  const now = new Date();
  const isToday = scheduledDate && scheduledDate.getFullYear() === now.getFullYear() && scheduledDate.getMonth() === now.getMonth() && scheduledDate.getDate() === now.getDate();
  const needsQuote = status === 'recotizar' || (!hasQuote && ['agendada', 'en_ruta', 'en_visita', 'visitada', 'pendiente_cotizacion', 'reprogramada', 'pendiente'].includes(status));
  return {
    ...visit,
    status,
    scheduledDate,
    hasQuote,
    hasOrder,
    isInstallation,
    isClosed,
    isPendingClose,
    isToday: Boolean(isToday),
    needsQuote,
    statusLabel: (() => {
      switch (status) {
        case 'agendada': return 'Agendada';
        case 'en_ruta': return 'En ruta';
        case 'en_visita': return 'En visita';
        case 'visitada': return 'Visitada';
        case 'cotizada': return 'Cotizada';
        case 'pendiente_cotizacion': return 'Pendiente de cotización';
        case 'lista_envio': return 'Lista para enviar';
        case 'aceptada_cliente': return 'Cliente acepta';
        case 'cancelada': return 'Cotización cancelada';
        case 'recotizar': return 'Recotizar';
        case 'pendiente_conformidad': return 'Pendiente de conformidad';
        case 'pendiente_cierre': return 'Pendiente de cierre';
        case 'reprogramada': return 'Reprogramada';
        case 'cerrada': return 'Cerrada';
        default: return 'Pendiente';
      }
    })(),
    typeLabel: isInstallation ? 'Instalación' : 'Evaluación / visita',
  };
}

function compareVisits(a, b) {
  const rawA = new Date(a?.scheduledAt || a?.createdAt || 0).getTime();
  const rawB = new Date(b?.scheduledAt || b?.createdAt || 0).getTime();
  const dateA = Number.isNaN(rawA) ? 0 : rawA;
  const dateB = Number.isNaN(rawB) ? 0 : rawB;
  return dateA - dateB;
}

function statusPillClass(status) {
  const key = String(status || '').trim().toLowerCase();
  if (['active', 'cerrada', 'instalada', 'pdf_generated'].includes(key)) return 'pill-active';
  if (['pending', 'pendiente', 'agendada', 'lista_envio', 'aceptada_cliente', 'pendiente_cierre', 'pendiente_conformidad', 'recotizar'].includes(key)) return 'pill-pending';
  if (['blocked', 'cancelada'].includes(key)) return 'pill-blocked';
  return '';
}

function formatOptionalDate(value, fallback = '-') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return formatDate(value);
}

function findConformityByOrderId(orderId) {
  return (state.conformities || []).find((item) => String(item.installationOrderId || '').trim() === String(orderId || '').trim()) || null;
}

function isWithinHours(value, hours) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return (Date.now() - date.getTime()) <= hours * 60 * 60 * 1000;
}

function slugPdfPart(value, fallback = 'SIN-DATO') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || fallback;
}

function fillSelect(id, options, selectedValue = null) {
  const select = el(id);
  if (!select) return;
  select.innerHTML = options.map((option) => `<option value="${option.value}">${option.label}</option>`).join('');
  const nextValue = options.some((option) => option.value === selectedValue) ? selectedValue : options[0]?.value;
  if (nextValue != null) select.value = nextValue;
}

function money(value) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2).replace(/\.00$/, '')}%`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parseFieldValue(field, value) {
  return ['price', 'pricePerMeter', 'igv', 'laborRate', 'costBase', 'factorGeneralCosts', 'marginPercent'].includes(field) ? Number(value || 0) : value;
}
