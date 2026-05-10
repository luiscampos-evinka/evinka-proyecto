const state = {
  user: null,
  config: null,
  quotes: [],
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
  await Promise.all([
    loadCatalog(),
    loadQuotes(),
    state.user.role === 'admin' ? loadAdminUsers() : Promise.resolve(),
  ]);
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
  el('adminTabBtn').classList.toggle('hidden', state.user.role !== 'admin');
  el('techName').value = state.user.name;
  if (el('quoteForm').visitDate && !el('quoteForm').visitDate.value) {
    el('quoteForm').visitDate.value = new Date().toISOString().slice(0, 10);
  }
  setTab('quote');
}

function setTab(name) {
  state.selectedTab = name;
  document.querySelectorAll('.tab').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === name));
  ['quote', 'quotes', 'admin'].forEach((tab) => el(`tab-${tab}`).classList.toggle('hidden', tab !== name));
}

async function onLogin(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return alert(data.error || 'No pude entrar. Revisa correo y contraseña.');
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
  wrap.innerHTML = `
    <h3>Cuentas</h3>
    <p class="muted">Solicitudes corporativas @evinka.tech con aprobación manual.</p>
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
  return `
    <article class="quote-card account-card">
      <div class="row">
        <strong>${escapeHtml(user.name || user.email)}</strong>
        <span class="pill pill-${escapeHtml(user.status)}">${escapeHtml(labelUserStatus(user.status))}</span>
      </div>
      <div class="row"><span>${escapeHtml(user.email || '-')}</span><span>${escapeHtml(user.role || 'tech')}</span></div>
      <div class="row"><span>Solicitud</span><span>${requested}</span></div>
      <div class="row"><span>Acceso</span><span>${granted}</span></div>
      <div class="row quote-card-actions">
        ${user.status !== 'active' ? `<button class="primary compact-btn" type="button" onclick="window.updateUserAccess('${user.id}','approve')">Dar acceso</button>` : ''}
        ${user.status !== 'blocked' ? `<button class="secondary compact-btn" type="button" onclick="window.updateUserAccess('${user.id}','block')">Quitar acceso</button>` : ''}
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
  await loadQuotes();
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
  state.quotes = await res.json();
  el('quotesList').innerHTML = state.quotes.length
    ? state.quotes.map((quote) => `
      <article class="quote-card">
        <div class="row">
          <strong>${displayQuoteLabel(quote)}</strong>
          <span class="pill">${quote.status}</span>
        </div>
        <div class="row"><span>${quote.clientName || '-'}</span><span>${formatDate(quote.createdAt)}</span></div>
        <div class="row"><span>${quote.email || '-'}</span><span>${quote.emailDelivery?.ok ? 'Correo enviado' : 'Correo pendiente'}</span></div>
        <div class="row"><span>${quote.commercialProfile?.name || 'GENERAL'}</span><span>${formatPercent(quote.marginPercent || 0)}</span></div>
        <div class="row"><span>${quote.installationOrderId || 'Sin orden'}</span><span>${labelQuoteStatus(quote)}</span></div>
        <div class="row"><span>${quote.installationType || ''} · ${quote.cable?.label || ''}</span><span><strong>${money(quote.total)}</strong></span></div>
        <div class="row quote-card-actions">
          <a class="link" href="${quote.pdfPath}" target="_blank" rel="noreferrer">PDF</a>
          ${state.user.role === 'admin' && quote.status !== 'aceptada' && quote.status !== 'instalada' ? `<button class="secondary compact-btn" type="button" onclick="window.acceptQuote('${quote.id}')">Aceptar</button>` : ''}
        </div>
      </article>
    `).join('')
    : '<p class="muted">Todavía no hay cotizaciones.</p>';
}

async function acceptQuote(id) {
  const ok = window.confirm('¿Aceptar esta cotización y crear la orden de instalación?');
  if (!ok) return;
  const res = await fetch(`/api/quotes/${encodeURIComponent(id)}/accept`, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return alert(data.error || 'No se pudo aceptar la cotización.');
  await loadQuotes();
  alert(`Cotización aceptada. Orden creada: ${data.installationOrder?.id || '-'}`);
}

window.acceptQuote = acceptQuote;

function labelQuoteStatus(quote) {
  const quoteStatus = String(quote?.status || 'emitida').toLowerCase();
  const conformity = String(quote?.conformityStatus || 'not_started').toLowerCase();
  if (conformity === 'pdf_generated') return 'Conformidad generada';
  if (quoteStatus === 'instalada') return 'Instalada';
  if (quoteStatus === 'aceptada') return 'Aceptada';
  return 'Emitida';
}

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
