const state = {
  user: null,
  config: null,
  theme: 'dark',
  activeCountry: '',
  clients: [],
  quotes: [],
  techVisits: [],
  installationOrders: [],
  conformities: [],
  adminUsers: [],
  selectedTab: 'quote',
  catalogDraft: null,
  quotePhotos: [],
  conformityOrderId: '',
  conformityPhotoFiles: [null, null],
  conformitySignatureData: { installer: '', client: '' },
};

const TAB_ORDER = ['quote', 'quotes', 'visits', 'ops', 'conformities', 'advisor', 'admin'];

const el = (id) => document.getElementById(id);

init();

async function init() {
  loadThemePreference();
  bindUI();
  await loadSession();
}

function bindUI() {
  el('loginForm').addEventListener('submit', onLogin);
  el('registerForm')?.addEventListener('submit', onRegisterRequest);
  el('toggleRegisterBtn')?.addEventListener('click', toggleRegisterForm);
  el('logoutBtn').addEventListener('click', onLogout);
  el('themeDarkBtn')?.addEventListener('click', () => setTheme('dark'));
  el('themeLightBtn')?.addEventListener('click', () => setTheme('light'));
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
  el('countryScopeSelect')?.addEventListener('change', onChangeCountryScope);
  el('userEditorForm')?.addEventListener('submit', onSubmitUserEditor);
  el('closeUserEditorBtn')?.addEventListener('click', closeUserEditorModal);
  el('cancelUserEditorBtn')?.addEventListener('click', closeUserEditorModal);
  el('userEditorModal')?.addEventListener('click', (event) => {
    if (event.target?.id === 'userEditorModal') closeUserEditorModal();
  });
  el('conformityForm')?.addEventListener('submit', onSubmitConformityForm);
  el('cancelConformityBtn')?.addEventListener('click', resetConformityForm);
  el('conformityOrderSelect')?.addEventListener('change', onChangeConformityOrder);
  el('loadConformityOrderBtn')?.addEventListener('click', onLoadConformityOrder);
  el('generateWarrantyBtn')?.addEventListener('click', onGenerateWarranty);
  el('conformityPhoto1')?.addEventListener('change', (event) => onChangeConformityPhoto(event, 0));
  el('conformityPhoto2')?.addEventListener('change', (event) => onChangeConformityPhoto(event, 1));
  el('conformityAdditionalToggle')?.addEventListener('change', syncConformityAdditionalField);
  document.querySelectorAll('[data-clear-signature]').forEach((button) => {
    button.addEventListener('click', () => clearSignaturePad(button.dataset.clearSignature));
  });
  el('reloadAdvisorFrameBtn')?.addEventListener('click', reloadAdvisorFrame);
  document.querySelectorAll('.tab').forEach((btn) => btn.addEventListener('click', () => setTab(btn.dataset.tab)));
  initSignaturePad('installer');
  initSignaturePad('client');
}

function loadThemePreference() {
  const saved = String(localStorage.getItem('evinkaTheme') || '').trim();
  const preferred = saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  setTheme(preferred === 'light' ? 'light' : 'dark', { persist: false });
}

function setTheme(theme, { persist = true } = {}) {
  state.theme = theme === 'light' ? 'light' : 'dark';
  document.body.dataset.theme = state.theme;
  document.documentElement.style.colorScheme = state.theme;
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute('content', state.theme === 'light' ? '#f4efe7' : '#0c0c0c');
  el('themeDarkBtn')?.classList.toggle('is-active', state.theme === 'dark');
  el('themeLightBtn')?.classList.toggle('is-active', state.theme === 'light');
  if (persist) localStorage.setItem('evinkaTheme', state.theme);
}

async function loadSession() {
  const res = await fetch(withCountryQuery('/api/me'));
  const data = await res.json();
  state.user = data.user;
  state.config = data.config;
  state.activeCountry = data.config?.activeCountry || resolveDefaultCountry(data.user);
  if (!state.user) {
    showLogin();
    return;
  }
  showDashboard();
  await Promise.allSettled([
    loadCatalog(),
    loadClients(),
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
  syncCountryScopeSelector();
  refreshScopePanels();
  el('companyName').textContent = state.config?.company?.name || 'EVINKA Cotizador';
  const countryScope = activeCountryLabel();
  const tagline = String(state.config?.company?.tagline || '').trim();
  const shouldAppendScope = countryScope && !tagline.toLowerCase().includes(countryScope.toLowerCase()) && !isGlobalScope();
  el('companyTagline').textContent = [tagline, shouldAppendScope ? countryScope : ''].filter(Boolean).join(' · ');
  el('sessionBadge').textContent = `${roleLabel()} · ${state.user.name}${countryScope ? ` · ${countryScope}` : ''}`;
  TAB_ORDER.forEach((tab) => {
    const button = el(`${tab}TabBtn`);
    if (button) button.classList.toggle('hidden', !canAccessTab(tab));
  });
  el('techName').value = state.user.name;
  if (el('quoteForm').visitDate && !el('quoteForm').visitDate.value) {
    el('quoteForm').visitDate.value = new Date().toISOString().slice(0, 10);
  }
  const defaultTab = TAB_ORDER.find((tab) => canAccessTab(tab)) || 'quote';
  setTab(defaultTab);
}

function setTab(name) {
  const nextTab = canAccessTab(name)
    ? name
    : TAB_ORDER.find((tab) => canAccessTab(tab)) || 'quote';
  state.selectedTab = nextTab;
  document.querySelectorAll('.tab').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === nextTab));
  TAB_ORDER.forEach((tab) => {
    const panel = el(`tab-${tab}`);
    if (panel) panel.classList.toggle('hidden', tab !== nextTab);
  });
  if (nextTab === 'advisor') reloadAdvisorFrame(false);
}

function reloadAdvisorFrame(force = true) {
  const frame = el('advisorFrame');
  if (!frame) return;
  const current = frame.getAttribute('src') || 'https://asesor.evinka.net/';
  if (!force) {
    if (!frame.src) frame.src = current;
    return;
  }
  const url = new URL(current, window.location.origin);
  if (state.activeCountry && state.activeCountry !== 'ALL') url.searchParams.set('country', state.activeCountry);
  else url.searchParams.delete('country');
  url.searchParams.set('_embed_ts', Date.now().toString());
  frame.src = url.toString();
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
    return alert(data.error || 'No pude entrar. Revisa tu usuario/PIN o el acceso admin de respaldo.');
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
  const res = await fetch(withCountryQuery('/api/catalog'));
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

  const harCatalogs = state.catalog?.harCatalogs || {};
  fillDatalist('chargerReferenceOptions', harCatalogs.chargerReferences || []);
  fillDatalist('acometidaTypeOptions', harCatalogs.acometidaTypes || []);
  fillDatalist('acometidaCaliberOptions', harCatalogs.acometidaCalibers || []);
  fillDatalist('primaryBreakerOptions', harCatalogs.primaryBreakers || []);
  fillDatalist('cityOptions', harCatalogs.cities || []);
  renderHarGuide();
}

function renderHarGuide() {
  const wrap = el('coHarGuide');
  if (!wrap) return;
  const harCatalogs = state.catalog?.harCatalogs || {};
  const isColombia = (state.activeCountry || state.catalog?.activeCountry) === 'CO';
  if (!isColombia) {
    wrap.classList.add('hidden');
    wrap.innerHTML = '';
    return;
  }
  wrap.classList.remove('hidden');
  const rubrics = harCatalogs.installationRubrics || [];
  const statuses = harCatalogs.technicalStatuses || [];
  wrap.innerHTML = `
    <h3>Base HAR Colombia</h3>
    <p class="muted">Ya dejé cargadas referencias base del HAR para cotizar más alineado con CO y no depender tanto de texto libre.</p>
    <div class="result-grid">
      <div class="metric"><b>Referencias cargador</b><span>${escapeHtml(String((harCatalogs.chargerReferences || []).length))}</span></div>
      <div class="metric"><b>Ciudades sugeridas</b><span>${escapeHtml(String((harCatalogs.cities || []).length))}</span></div>
      <div class="metric"><b>Tipos acometida</b><span>${escapeHtml(String((harCatalogs.acometidaTypes || []).length))}</span></div>
      <div class="metric"><b>Estados técnicos</b><span>${escapeHtml(String(statuses.length))}</span></div>
    </div>
    ${rubrics.length ? `<p><strong>Rubros base CO:</strong> ${escapeHtml(rubrics.join(' · '))}</p>` : ''}
    ${statuses.length ? `<p class="muted">Estados base: ${escapeHtml(statuses.join(' · '))}</p>` : ''}
  `;
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
  if (!isAdminUser()) {
    wrap.innerHTML = '';
    return;
  }
  const users = state.adminUsers || [];
  const pending = users.filter((user) => user.status === 'pending');
  const active = users.filter((user) => user.status === 'active');
  const blocked = users.filter((user) => user.status === 'blocked');
  const roleDefinitions = state.config?.roleDefinitions || [];
  const roles = state.config?.roles || roleDefinitions.map((role) => role.id) || ['admin', 'supervisor', 'asesor_comercial', 'tecnico_visitas', 'tecnico_instalador'];
  wrap.innerHTML = `
    <h3>Cuentas</h3>
    <p class="muted">El admin crea las cuentas y asigna un usuario + PIN para entrar directo.</p>
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
        Teléfono alertas (opcional)
        <input name="notificationPhone" type="tel" placeholder="+51999999999" />
      </label>
      <label>
        Rol
        <select name="role">
          ${roles.map((role) => {
            const definition = roleDefinitions.find((item) => item.id === role);
            return `<option value="${escapeHtml(role)}">${escapeHtml(definition?.label || role)}</option>`;
          }).join('')}
        </select>
      </label>
      <label>
        País permitido
        <select name="allowedCountries">
          <option value="PE">Perú</option>
          <option value="CO">Colombia</option>
          <option value="ALL">Perú y Colombia</option>
        </select>
      </label>
      <label>
        Usuario (opcional)
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
  const countries = Array.isArray(user.allowedCountries) && user.allowedCountries.length ? user.allowedCountries.join(', ') : 'Todos';
  const queues = Array.isArray(user.allowedQueues) && user.allowedQueues.length ? user.allowedQueues.join(', ') : 'Todas';
  return `
    <article class="quote-card account-card">
      <div class="row">
        <strong>${escapeHtml(user.name || user.email)}</strong>
        <span class="pill pill-${escapeHtml(user.status)}">${escapeHtml(labelUserStatus(user.status))}</span>
      </div>
      <div class="row"><span>${escapeHtml(user.email || '-')}</span><span>${escapeHtml(roleLabel(user.role || 'tecnico_visitas'))}</span></div>
      <div class="row"><span>Usuario</span><span>${escapeHtml(user.employeeCode || '-')}</span></div>
      <div class="row"><span>Teléfono alertas</span><span>${escapeHtml(user.notificationPhone || '-')}</span></div>
      <div class="row"><span>País</span><span>${escapeHtml(countries)}</span></div>
      <div class="row"><span>Colas</span><span>${escapeHtml(queues)}</span></div>
      <div class="row"><span>PIN</span><span>${escapeHtml(pinStatus)}</span></div>
      <div class="row"><span>Solicitud</span><span>${requested}</span></div>
      <div class="row"><span>Acceso</span><span>${granted}</span></div>
      <div class="row quote-card-actions">
        ${user.status !== 'active' ? `<button class="primary compact-btn" type="button" onclick="window.updateUserAccess('${user.id}','approve')">Dar acceso</button>` : ''}
        ${user.status !== 'blocked' ? `<button class="secondary compact-btn" type="button" onclick="window.updateUserAccess('${user.id}','block')">Quitar acceso</button>` : ''}
        <button class="secondary compact-btn" type="button" onclick="window.editAdminUser('${user.id}')">Editar usuario</button>
        <button class="secondary compact-btn" type="button" onclick="window.manageUserCredentials('${user.id}')">Usuario / PIN</button>
      </div>
    </article>
  `;
}

function labelUserStatus(status) {
  if (status === 'pending') return 'Pendiente';
  if (status === 'blocked') return 'Bloqueada';
  return 'Activa';
}

function normalizeAllowedCountriesInput(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return [];
  if (raw === 'ALL') return ['ALL'];
  return raw.split(/[\s,;|]+/).map((item) => item.trim()).filter(Boolean);
}

function resolveDefaultCountry(user = state.user) {
  const allowed = Array.isArray(user?.allowedCountries) ? user.allowedCountries.filter(Boolean) : [];
  if (allowed.length === 1 && allowed[0] !== 'ALL') return allowed[0];
  return state.activeCountry || state.config?.activeCountry || (canUseGlobalScope(user) ? 'ALL' : 'PE');
}

function withCountryQuery(url) {
  const country = state.activeCountry || resolveDefaultCountry();
  if (!country) return url;
  const next = new URL(url, window.location.origin);
  next.searchParams.set('country', country);
  return `${next.pathname}${next.search}`;
}

function activeCountryLabel() {
  const country = state.activeCountry || state.config?.activeCountry || resolveDefaultCountry();
  if (country === 'ALL') return 'Global';
  return country === 'CO' ? 'Colombia' : 'Perú';
}

function activeCountryCode() {
  const country = state.activeCountry || state.config?.activeCountry || resolveDefaultCountry();
  return country === 'CO' ? 'CO' : country === 'ALL' ? 'ALL' : 'PE';
}

function setQuoteFieldLabel(fieldName, text) {
  const control = document.querySelector(`#quoteForm [name="${fieldName}"]`);
  const label = control?.closest('label');
  if (!label) return;
  const textNode = [...label.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
  if (textNode) textNode.textContent = text;
}

function refreshQuoteCountryCopy() {
  const country = activeCountryCode();
  const legend = document.querySelector('#quoteForm fieldset.extras-box legend');
  const documentType = document.querySelector('#quoteForm [name="documentType"]');
  const phone = document.querySelector('#quoteForm [name="phone"]');
  const company = document.querySelector('#quoteForm [name="companyName"]');
  const city = document.querySelector('#quoteForm [name="city"]');
  const department = document.querySelector('#quoteForm [name="department"]');
  const locality = document.querySelector('#quoteForm [name="locality"]');
  const neighborhood = document.querySelector('#quoteForm [name="neighborhood"]');

  if (country === 'CO') {
    if (legend) legend.textContent = 'Ficha cliente Colombia';
    setQuoteFieldLabel('department', 'Departamento');
    setQuoteFieldLabel('locality', 'Localidad');
    setQuoteFieldLabel('neighborhood', 'Barrio');
    if (phone) phone.placeholder = '3001234567';
    if (company) company.placeholder = 'Motorysa / empresa';
    if (city) city.placeholder = 'Bogotá';
    if (department) department.placeholder = 'Cundinamarca';
    if (locality) locality.placeholder = 'Suba';
    if (neighborhood) neighborhood.placeholder = 'Barrio';
    if (documentType) {
      const current = documentType.value;
      documentType.innerHTML = `
        <option value="CC">CC</option>
        <option value="CE">CE</option>
        <option value="NIT">NIT</option>
        <option value="PASAPORTE">PASAPORTE</option>
      `;
      documentType.value = ['CC', 'CE', 'NIT', 'PASAPORTE'].includes(current) ? current : 'CC';
    }
    return;
  }

  if (legend) legend.textContent = country === 'ALL' ? 'Ficha cliente' : 'Ficha cliente Perú';
  setQuoteFieldLabel('department', 'Departamento');
  setQuoteFieldLabel('locality', 'Distrito');
  setQuoteFieldLabel('neighborhood', 'Zona / referencia');
  if (phone) phone.placeholder = '999123456';
  if (company) company.placeholder = 'Empresa / razón social';
  if (city) city.placeholder = 'Lima';
  if (department) department.placeholder = 'Lima';
  if (locality) locality.placeholder = 'Miraflores';
  if (neighborhood) neighborhood.placeholder = 'Referencia';
  if (documentType) {
    const current = documentType.value;
    documentType.innerHTML = `
      <option value="DNI">DNI</option>
      <option value="CE">CE</option>
      <option value="RUC">RUC</option>
      <option value="PASAPORTE">PASAPORTE</option>
    `;
    documentType.value = ['DNI', 'CE', 'RUC', 'PASAPORTE'].includes(current) ? current : 'DNI';
  }
}

function hostFixedCountry() {
  const host = window.location.hostname.toLowerCase();
  if (['co-suite.evinka.net', 'co-cotizador.evinka.net', 'co.evinka.net', 'colombia.evinka.net'].includes(host)) return 'CO';
  if (['pe-suite.evinka.net', 'pe-cotizador.evinka.net', 'pe.evinka.net', 'peru.evinka.net'].includes(host)) return 'PE';
  return '';
}

function canUseGlobalScope(user = state.user) {
  const allowed = Array.isArray(user?.allowedCountries) ? user.allowedCountries.filter(Boolean) : [];
  return isAdminUser() || allowed.includes('ALL') || !allowed.length;
}

function isGlobalScope() {
  return (state.activeCountry || state.config?.activeCountry || resolveDefaultCountry()) === 'ALL';
}

function allowedCountriesLabel(user = state.user) {
  const allowed = Array.isArray(user?.allowedCountries) ? user.allowedCountries.filter(Boolean) : [];
  if (!allowed.length || allowed.includes('ALL')) return 'Perú y Colombia';
  return allowed.map((code) => code === 'CO' ? 'Colombia' : code === 'PE' ? 'Perú' : code).join(' · ');
}

function canSwitchCountryScope(user = state.user) {
  if (hostFixedCountry()) return false;
  const allowed = Array.isArray(user?.allowedCountries) ? user.allowedCountries.filter(Boolean) : [];
  return isAdminUser() || allowed.includes('ALL') || allowed.length > 1;
}

function syncCountryScopeSelector() {
  const wrap = el('countryScopeWrap');
  const select = el('countryScopeSelect');
  if (!wrap || !select) return;
  const countries = Array.isArray(state.config?.countries) ? state.config.countries : [
    { code: 'PE', label: 'Perú' },
    { code: 'CO', label: 'Colombia' },
  ];
  const options = [
    ...(canUseGlobalScope() && !hostFixedCountry() ? [{ code: 'ALL', label: 'Global' }] : []),
    ...countries,
  ];
  const current = state.activeCountry || resolveDefaultCountry();
  select.innerHTML = options.map((item) => `<option value="${escapeHtml(item.code)}">${escapeHtml(item.label)}</option>`).join('');
  select.value = options.some((item) => item.code === current) ? current : (options[0]?.code || 'PE');
  wrap.classList.toggle('hidden', !canSwitchCountryScope());
}

async function onChangeCountryScope(event) {
  const nextCountry = String(event.target?.value || '').trim().toUpperCase();
  if (!nextCountry || nextCountry === state.activeCountry) return;
  state.activeCountry = nextCountry;
  await loadSession();
}

function refreshScopePanels() {
  const quoteNotice = el('quoteScopeNotice');
  const adminNotice = el('adminScopeNotice');
  const quoteButton = document.querySelector('#quoteForm button[type="submit"]');
  const adminButton = document.querySelector('#adminForm button[type="submit"]');
  const global = isGlobalScope();
  if (quoteNotice) quoteNotice.classList.toggle('hidden', !global);
  if (adminNotice) adminNotice.classList.toggle('hidden', !global);
  if (quoteButton) quoteButton.disabled = global;
  if (adminButton) adminButton.disabled = global;
  refreshQuoteCountryCopy();
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
      notificationPhone: form.get('notificationPhone'),
      role: form.get('role'),
      allowedCountries: normalizeAllowedCountriesInput(form.get('allowedCountries')),
      employeeCode: form.get('employeeCode'),
      pin: form.get('pin'),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return alert(data.error || 'No se pudo crear la cuenta.');
  event.target.reset();
  await loadAdminUsers();
  alert(`Cuenta creada. Usuario asignado: ${data.user?.employeeCode || '-'}`);
}

async function manageUserCredentials(id) {
  const user = (state.adminUsers || []).find((item) => item.id === id);
  if (!user) return;
  const employeeCode = window.prompt('Usuario de acceso', user.employeeCode || '');
  if (employeeCode === null) return;
  const notificationPhone = window.prompt('Teléfono de alertas (WhatsApp)', user.notificationPhone || '');
  if (notificationPhone === null) return;
  const pin = window.prompt('Nuevo PIN (4 a 8 dígitos). Déjalo vacío para mantener el actual.', '');
  if (pin === null) return;
  const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}/credentials`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      employeeCode,
      notificationPhone,
      ...(pin ? { pin } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return alert(data.error || 'No se pudo actualizar el usuario o PIN.');
  await loadAdminUsers();
  alert('Usuario / PIN actualizado.');
}

function fillUserEditorRoles(selectedRole = '') {
  const select = el('userEditorRole');
  if (!select) return;
  const roles = state.config?.roleDefinitions || [];
  select.innerHTML = roles.map((role) => `<option value="${escapeHtml(role.id)}">${escapeHtml(role.label || role.id)}</option>`).join('');
  select.value = selectedRole || roles[0]?.id || 'asesor_comercial';
}

function setCheckboxValues(name, values = []) {
  document.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
    input.checked = values.includes(input.value);
  });
}

function getCheckboxValues(name) {
  return [...document.querySelectorAll(`input[name="${name}"]`)]
    .filter((input) => input.checked)
    .map((input) => input.value);
}

function openUserEditorModal(user) {
  const modal = el('userEditorModal');
  const form = el('userEditorForm');
  if (!modal || !form || !user) return;
  fillUserEditorRoles(user.role || 'asesor_comercial');
  form.elements.id.value = user.id || '';
  form.elements.name.value = user.name || '';
  form.elements.email.value = user.email || '';
  form.elements.status.value = user.status || 'active';
  form.elements.employeeCode.value = user.employeeCode || '';
  form.elements.notificationPhone.value = user.notificationPhone || '';
  form.elements.pin.value = '';
  setCheckboxValues('allowedCountries', Array.isArray(user.allowedCountries) ? user.allowedCountries : []);
  setCheckboxValues('allowedQueues', Array.isArray(user.allowedQueues) ? user.allowedQueues : []);
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function closeUserEditorModal() {
  const modal = el('userEditorModal');
  const form = el('userEditorForm');
  if (form) form.reset();
  setCheckboxValues('allowedCountries', []);
  setCheckboxValues('allowedQueues', []);
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

async function editAdminUser(id) {
  const user = (state.adminUsers || []).find((item) => item.id === id);
  if (!user) return;
  openUserEditorModal(user);
}

async function onSubmitUserEditor(event) {
  event.preventDefault();
  const form = event.target;
  const id = form.elements.id.value;
  if (!id) return;
  const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: form.elements.name.value,
      email: form.elements.email.value,
      role: form.elements.role.value,
      status: form.elements.status.value,
      employeeCode: form.elements.employeeCode.value,
      notificationPhone: form.elements.notificationPhone.value,
      allowedCountries: getCheckboxValues('allowedCountries'),
      allowedQueues: getCheckboxValues('allowedQueues'),
      ...(form.elements.pin.value ? { pin: form.elements.pin.value } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return alert(data.error || 'No se pudo actualizar el usuario.');
  await loadAdminUsers();
  closeUserEditorModal();
  alert('Usuario actualizado.');
}

window.createAdminUser = createAdminUser;
window.manageUserCredentials = manageUserCredentials;
window.editAdminUser = editAdminUser;

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
  if (!isAdminUser()) return alert('Sin permisos.');
  if (isGlobalScope()) return alert('Selecciona Perú o Colombia antes de guardar configuración.');
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
  const res = await fetch(withCountryQuery('/api/catalog'), {
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
  if (isGlobalScope()) {
    return alert('Estás en vista Global. Selecciona Perú o Colombia antes de generar una cotización.');
  }
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
  body.countryCode = state.activeCountry || resolveDefaultCountry(state.user);
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
  await Promise.allSettled([loadClients(), loadQuotes(), loadTechVisits(), loadInstallationOrders(), loadConformities()]);
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
      <div class="metric"><b>Documento</b><span>${escapeHtml([quote.documentType, quote.clientDocument].filter(Boolean).join(' ') || '-')}</span></div>
      <div class="metric"><b>Celular</b><span>${escapeHtml(quote.phone || '-')}</span></div>
      <div class="metric"><b>Perfil</b><span>${escapeHtml(quote.commercialProfile?.name || 'GENERAL')}</span></div>
      <div class="metric"><b>Correo</b><span>${escapeHtml(quote.email || '-')}</span></div>
      <div class="metric"><b>Fotos</b><span>${escapeHtml(String((quote.photos || []).length))}</span></div>
      <div class="metric"><b>Base técnica</b><span>${money(quote.subtotalBeforeCountryAdjustments || quote.subtotal, quote.currency || quote.countryCode)}</span></div>
      <div class="metric"><b>Ajustes CO</b><span>${money(quote.countryAdjustmentsTotal || 0, quote.currency || quote.countryCode)}</span></div>
      <div class="metric"><b>Subtotal</b><span>${money(quote.subtotal, quote.currency || quote.countryCode)}</span></div>
      <div class="metric"><b>IVA</b><span>${money(quote.igv, quote.currency || quote.countryCode)}</span></div>
      <div class="metric"><b>Total</b><span>${money(quote.total, quote.currency || quote.countryCode)}</span></div>
    </div>
    <div class="catalog-section">
      <h3>${quote.countryCode === 'CO' ? 'Ficha Colombia' : 'Ficha Perú'}</h3>
      <div class="result-grid">
        <div class="metric"><b>Ubicación</b><span>${escapeHtml([quote.city, quote.department, quote.locality].filter(Boolean).join(' / ') || '-')}</span></div>
        <div class="metric"><b>Dirección</b><span>${escapeHtml(quote.address || '-')}</span></div>
        <div class="metric"><b>Vehículo</b><span>${escapeHtml(quote.vehicleModel || '-')}</span></div>
        <div class="metric"><b>VIN</b><span>${escapeHtml(quote.vin || '-')}</span></div>
        <div class="metric"><b>Referencia cargador</b><span>${escapeHtml(quote.chargerReference || quote.charger?.label || '-')}</span></div>
        <div class="metric"><b>Revisión</b><span>${quote.requiresReview ? 'Sí' : 'No'}</span></div>
      </div>
      ${(quote.countryAdjustments || []).length ? `
        <div class="top-gap-sm">
          <p><strong>${quote.countryCode === 'CO' ? 'Ajustes Colombia' : 'Ajustes por país'}</strong></p>
          <ul class="included-list">${(quote.countryAdjustments || []).map((row) => `<li>${escapeHtml(row.label)} · ${money(row.total, quote.currency || quote.countryCode)}</li>`).join('')}</ul>
        </div>
      ` : ''}
      ${(quote.reviewReasons || []).length ? `
        <div class="top-gap-sm">
          <p><strong>Motivos de revisión</strong></p>
          <ul class="included-list">${(quote.reviewReasons || []).map((row) => `<li>${escapeHtml(row)}</li>`).join('')}</ul>
        </div>
      ` : ''}
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

async function loadClients() {
  const res = await fetch(withCountryQuery('/api/clients'));
  if (!res.ok) return;
  const data = await res.json().catch(() => []);
  state.clients = Array.isArray(data) ? data : [];
  renderClients();
}

function renderClients() {
  const wrap = el('clientsList');
  if (!wrap) return;
  wrap.innerHTML = state.clients.length
    ? state.clients.slice(0, 12).map(renderClientCard).join('')
    : '<p class="muted">Todavía no hay clientes registrados en esta base.</p>';
}

function renderClientCard(client) {
  return `
    <article class="quote-card">
      <div class="row"><strong>${escapeHtml(client.fullName || '-')}</strong><span>${escapeHtml(client.countryCode || '-')}</span></div>
      <div class="row"><span>${escapeHtml([client.documentType, client.documentNumber].filter(Boolean).join(' ') || '-')}</span><span>${escapeHtml(client.phone || '-')}</span></div>
      <div class="row"><span>${escapeHtml(client.email || '-')}</span><span>${escapeHtml(client.city || '-')}</span></div>
      <div class="row"><span>${escapeHtml(client.address || '-')}</span><span>${escapeHtml(client.lastQuoteId || 'Sin cotización')}</span></div>
    </article>
  `;
}

async function loadQuotes() {
  const res = await fetch(withCountryQuery('/api/quotes'));
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
      <div class="row"><span>${escapeHtml(quote.installationType || '')} · ${escapeHtml(quote.cable?.label || '')}</span><span><strong>${money(quote.total, quote.currency || quote.countryCode)}</strong></span></div>
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
        ${quote.warrantyPdfUrl || quote.warrantyCode ? `<a class="link" href="${escapeHtml(quote.warrantyPdfUrl || "/api/warranties/" + encodeURIComponent(quote.warrantyId || '') + "/pdf")}" target="_blank" rel="noreferrer">Garantía</a>` : ''}
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
  const res = await fetch(withCountryQuery('/api/tech/visits'));
  if (!res.ok) return;
  const data = await res.json().catch(() => []);
  state.techVisits = Array.isArray(data) ? data : [];
  renderVisits();
  renderOperations();
}

async function loadInstallationOrders() {
  const res = await fetch(withCountryQuery('/api/installation-orders'));
  if (!res.ok) return;
  const data = await res.json().catch(() => []);
  state.installationOrders = Array.isArray(data) ? data : [];
  renderOperations();
}

async function loadConformities() {
  const res = await fetch(withCountryQuery('/api/conformities'));
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
    } else if (canGenerateConformity()) {
      actions.push(`<button class="secondary compact-btn" type="button" onclick="window.openConformityModal('${visit.installationOrderId}')">Conformidad</button>`);
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
  const conformityPending = orders.filter((order) => isOrderReadyForConformity(order) && String(order.conformityStatus || 'not_started').toLowerCase() !== 'pdf_generated');
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
  const actions = [];
  if (order.quotePdfUrl) actions.push(`<a class="link" href="${order.quotePdfUrl}" target="_blank" rel="noreferrer">PDF cotización</a>`);
  if (conformity) {
    actions.push(`<a class="link" href="/api/conformities/${encodeURIComponent(conformity.id)}/pdf" target="_blank" rel="noreferrer">PDF conformidad</a>`);
  } else if (canGenerateConformity() && isOrderReadyForConformity(order)) {
    actions.push(`<button class="secondary compact-btn" type="button" onclick="window.openConformityModal('${order.id}')">Generar conformidad</button>`);
  } else {
    actions.push(`<span class="muted">${isOrderReadyForConformity(order) ? 'Aún sin PDF' : 'Esperando cierre operativo'}</span>`);
  }
  return `
    <article class="quote-card compact-card">
      <div class="row">
        <strong>${escapeHtml(order.clientName || order.id)}</strong>
        <span class="pill ${statusPillClass(order.conformityStatus === 'pdf_generated' ? 'cerrada' : 'pendiente_conformidad')}">${escapeHtml(order.conformityStatus === 'pdf_generated' ? 'Conformidad generada' : 'Pendiente de conformidad')}</span>
      </div>
      <div class="row"><span>${escapeHtml(order.id)}</span><span>${escapeHtml(formatOptionalDate(order.updatedAt || order.createdAt, order.status || '-'))}</span></div>
      <div class="row"><span>${escapeHtml(order.address || '-')}</span><span>${escapeHtml(order.assignedTechnician || order.assignedTechEmail || '-')}</span></div>
      <div class="row quote-card-actions">
        ${actions.join('')}
      </div>
    </article>
  `;
}

function renderConformities() {
  const summary = el('conformitiesSummary');
  const orderSelect = el('conformityOrderSelect');
  const form = el('conformityForm');
  const empty = el('conformityEmptyState');
  const flowSummary = el('conformityFlowSummary');
  const list = el('conformitiesList');
  if (!summary || !list) return;
  const conformities = [...(state.conformities || [])];
  const pendingOrders = [...(state.installationOrders || [])].filter((order) => isOrderReadyForConformity(order) && !findConformityByOrderId(order.id));
  const readyCount = pendingOrders.length;
  summary.innerHTML = `
    <div class="metric"><b>Registradas</b><span>${conformities.length}</span></div>
    <div class="metric"><b>Con PDF</b><span>${conformities.filter((item) => item.hasPdfBase64 || item.pdfUrl).length}</span></div>
    <div class="metric"><b>Correo OK</b><span>${conformities.filter((item) => item.emailDelivery?.ok).length}</span></div>
    <div class="metric"><b>Pendientes</b><span>${readyCount}</span></div>
  `;
  if (orderSelect) {
    const previous = state.conformityOrderId;
    orderSelect.innerHTML = [
      '<option value="">Manual / sin orden</option>',
      ...pendingOrders.map((order) => `<option value="${escapeHtml(order.id)}">${escapeHtml(order.id)} · ${escapeHtml(order.clientName || 'Cliente')} · ${escapeHtml(order.address || '-')}</option>`),
    ].join('');
    const nextId = pendingOrders.some((order) => order.id === previous) ? previous : '';
    orderSelect.value = nextId;
    state.conformityOrderId = nextId;
  }
  if (form) form.classList.toggle('hidden', !canGenerateConformity());
  if (empty) {
    empty.classList.toggle('hidden', canGenerateConformity());
    empty.textContent = canGenerateConformity()
      ? 'No hay órdenes listas para generar conformidad en este momento.'
      : 'Tu usuario no tiene permiso para generar conformidades desde web.';
  }
  if (canGenerateConformity()) {
    if (state.conformityOrderId) {
      loadConformityForm(state.conformityOrderId);
    } else {
      resetConformityForm({ preserveSelection: true });
    }
    renderConformityPhotoPreview();
    syncConformityAdditionalField();
    updateConformityGuidedUi();
  }
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
        ${item.warrantyPdfUrl || item.warrantyCode ? `<a class="link" href="${escapeHtml(item.warrantyPdfUrl || "/api/warranties/" + encodeURIComponent(item.warrantyId || '') + "/pdf")}" target="_blank" rel="noreferrer">Garantía</a>` : ''}
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

function findOrderById(id) {
  return (state.installationOrders || []).find((item) => item.id === id) || null;
}

function findQuoteById(id) {
  return (state.quotes || []).find((item) => item.id === id) || null;
}

function deliveredItemsToTextarea(value = []) {
  return (Array.isArray(value) ? value : []).filter(Boolean).join('\n');
}

function textareaToDeliveredItems(value = '') {
  return String(value || '')
    .split(/\r?\n/)
    .map((item) => item.replace(/^[-•\s]+/, '').trim())
    .filter(Boolean);
}

function conformityDeliveredItemsFromForm(form) {
  const items = [];
  if (form.cajaCargador?.checked) items.push('Caja del cargador');
  if (form.cargadorEvinka?.checked) items.push('Cargador Evinka');
  if (form.manualCargador?.checked) items.push('Manual del cargador');
  if (form.tarjetasCargador?.checked) items.push('Tarjetas del cargador');
  if (form.adicional?.checked && String(form.adicionalDesc?.value || '').trim()) items.push(String(form.adicionalDesc.value).trim());
  return items;
}

function setConformityImplementedChecks(form, deliveredItems = [], raw = {}) {
  const list = Array.isArray(deliveredItems) ? deliveredItems.map((item) => String(item || '').trim().toLowerCase()) : [];
  form.cajaCargador.checked = raw.cajaCargador === true || list.includes('caja del cargador');
  form.cargadorEvinka.checked = raw.cargadorEvinka === true || list.includes('cargador evinka');
  form.manualCargador.checked = raw.manualCargador === true || list.includes('manual del cargador');
  form.tarjetasCargador.checked = raw.tarjetasCargador === true || list.includes('tarjetas del cargador');
  const known = new Set(['caja del cargador', 'cargador evinka', 'manual del cargador', 'tarjetas del cargador']);
  const adicionalDesc = String(raw.adicionalDesc || deliveredItems.find((item) => !known.has(String(item || '').trim().toLowerCase())) || '').trim();
  form.adicional.checked = raw.adicional === true || Boolean(adicionalDesc);
  form.adicionalDesc.value = adicionalDesc;
}

function conformityFlowMissingItems() {
  const form = el('conformityForm');
  if (!form) return [];
  const list = [];
  if (!String(form.clientName.value || '').trim()) list.push('Cliente');
  if (!String(form.clientEmail.value || '').trim()) list.push('Correo');
  if (!String(form.chargerBrand.value || '').trim()) list.push('Marca');
  if (!String(form.serialNumber.value || '').trim()) list.push('Serie');
  if (!state.conformitySignatureData.installer) list.push('Firma instalador');
  if (!state.conformitySignatureData.client) list.push('Firma cliente');
  return list;
}

function updateConformityGuidedUi() {
  const flowSummary = el('conformityFlowSummary');
  const syncState = el('conformitySyncState');
  if (flowSummary) {
    const missing = conformityFlowMissingItems();
    flowSummary.innerHTML = `
      <div class="quote-card compact-card">
        <div class="row"><strong>Flujo guiado de conformidad</strong><span class="pill ${missing.length ? 'pill-pending' : 'pill-active'}">${missing.length ? 'Pendientes' : 'Listo para generar'}</span></div>
        <div class="row">
          <span>${state.conformityOrderId ? `Orden vinculada: ${escapeHtml(state.conformityOrderId)}` : 'Modo manual / sin orden'}</span>
          <span>${missing.length ? `Faltan: ${escapeHtml(missing.slice(0, 4).join(', '))}${missing.length > 4 ? '...' : ''}` : 'Checklist completo'}</span>
        </div>
      </div>
    `;
  }
  if (syncState && syncState.textContent) syncState.classList.remove('hidden');
}

function signaturePadRef(kind) {
  return el(kind === 'installer' ? 'installerSignaturePad' : 'clientSignaturePad');
}

function initSignaturePad(kind) {
  const canvas = signaturePadRef(kind);
  if (!canvas || canvas.dataset.ready === 'true') return;
  const ctx = canvas.getContext('2d');
  const setup = () => {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, Math.round(rect.width || 520));
    const height = Math.max(180, Math.round(rect.height || 180));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.2 * ratio;
    ctx.strokeStyle = '#181818';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.dataset.pixelRatio = String(ratio);
    canvas.classList.add('signature-pad--empty');
  };
  setup();
  let drawing = false;
  const point = (event) => {
    const rect = canvas.getBoundingClientRect();
    const source = event.touches?.[0] || event;
    const scaleX = canvas.width / Math.max(rect.width, 1);
    const scaleY = canvas.height / Math.max(rect.height, 1);
    return {
      x: (source.clientX - rect.left) * scaleX,
      y: (source.clientY - rect.top) * scaleY,
    };
  };
  const start = (event) => {
    event.preventDefault();
    drawing = true;
    const p = point(event);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = (event) => {
    if (!drawing) return;
    event.preventDefault();
    const p = point(event);
    canvas.classList.remove('signature-pad--empty');
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const end = () => {
    if (!drawing) return;
    drawing = false;
    state.conformitySignatureData[kind] = canvas.toDataURL('image/png');
    updateConformityGuidedUi();
  };
  canvas.addEventListener('pointerdown', start);
  canvas.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end, { passive: false });
  canvas.dataset.ready = 'true';
}

async function restoreSignaturePad(kind, dataUrl = '') {
  const canvas = signaturePadRef(kind);
  if (!canvas) return;
  initSignaturePad(kind);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!dataUrl) {
    state.conformitySignatureData[kind] = '';
    canvas.classList.add('signature-pad--empty');
    updateConformityGuidedUi();
    return;
  }
  const img = await loadImage(dataUrl);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  canvas.classList.remove('signature-pad--empty');
  state.conformitySignatureData[kind] = dataUrl;
  updateConformityGuidedUi();
}

function clearSignaturePad(kind) {
  restoreSignaturePad(kind, '');
}

async function onChangeConformityPhoto(event, index) {
  const file = event.target?.files?.[0] || null;
  if (file && !/^image\/(jpeg|jpg|png|webp)$/i.test(file.type || '')) {
    alert('Solo se permiten imágenes JPG, PNG o WEBP.');
    event.target.value = '';
    return;
  }
  state.conformityPhotoFiles[index] = file;
  await renderConformityPhotoPreview();
}

async function renderConformityPhotoPreview() {
  const wrap = el('conformityPhotoPreview');
  if (!wrap) return;
  const cards = await Promise.all((state.conformityPhotoFiles || []).map(async (file, index) => {
    if (!file) {
      return `<div class="photo-preview-card"><div class="photo-preview-name">Foto ${index + 1}</div><div class="muted">Sin imagen cargada.</div></div>`;
    }
    const src = await fileToDataUrl(file);
    return `
      <div class="photo-preview-card">
        <div class="photo-preview-name">Foto ${index + 1}</div>
        <img src="${src}" alt="Foto ${index + 1}" style="width:100%;max-height:180px;object-fit:cover;border-radius:12px;margin-top:8px;" />
        <div class="photo-preview-actions top-gap-sm"><button class="secondary compact-btn" type="button" data-remove-conformity-photo="${index}">Quitar</button></div>
      </div>
    `;
  }));
  wrap.innerHTML = cards.join('');
  document.querySelectorAll('[data-remove-conformity-photo]').forEach((button) => {
    button.onclick = () => {
      const index = Number(button.dataset.removeConformityPhoto);
      state.conformityPhotoFiles[index] = null;
      const input = el(index === 0 ? 'conformityPhoto1' : 'conformityPhoto2');
      if (input) input.value = '';
      renderConformityPhotoPreview();
    };
  });
}

function syncConformityAdditionalField() {
  const toggle = el('conformityAdditionalToggle');
  const input = el('conformityAdditionalDescription');
  if (!toggle || !input) return;
  input.disabled = !toggle.checked;
  if (!toggle.checked) input.value = '';
}

async function onLoadConformityOrder() {
  const code = String(el('conformityOrderCode')?.value || '').trim();
  if (!code) return alert('Ingresa un código de orden o cotización.');
  const res = await fetch(withCountryQuery(`/api/installation-orders/${encodeURIComponent(code)}`));
  let data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const fallback = (state.installationOrders || []).find((item) => item.quoteId === code);
    if (!fallback) return alert(data.error || 'No pude cargar la orden desde web.');
    data = fallback;
  }
  const known = (state.installationOrders || []).some((item) => item.id === data.id);
  if (!known) state.installationOrders.unshift(data);
  state.conformityOrderId = data.id || '';
  renderConformities();
  loadConformityForm(data.id);
}

async function onGenerateWarranty() {
  const form = el('conformityForm');
  const syncState = el('conformitySyncState');
  if (!form) return;
  const payload = {
    installationOrderId: form.installationOrderId.value,
    date: form.date.value,
    quoteId: form.quoteId.value,
    clientName: form.clientName.value,
    clientEmail: form.clientEmail.value,
    clientDocument: form.ruc.value,
    address: form.address.value,
    chargerBrand: form.chargerBrand.value,
    serialNumber: form.serialNumber.value,
    voltage: form.voltage.value,
    amperage: form.amperage.value,
    powerKw: form.powerKw.value,
    installerSignatureUrl: state.conformitySignatureData.installer,
    clientSignatureUrl: state.conformitySignatureData.client,
  };
  if (!payload.clientName.trim()) return alert('Falta el cliente para generar la garantía.');
  if (!payload.chargerBrand.trim()) return alert('Falta la marca del cargador para generar la garantía.');
  if (syncState) {
    syncState.textContent = 'Generando garantía de 2 años...';
    syncState.className = 'hint top-gap-sm sync-state-warn';
    syncState.classList.remove('hidden');
  }
  const res = await fetch(withCountryQuery('/api/warranties'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (syncState) syncState.textContent = data.error || 'No se pudo generar la garantía.';
    return alert(data.error || 'No se pudo generar la garantía.');
  }
  if (syncState) {
    syncState.textContent = 'Garantía generada correctamente.';
    syncState.className = 'hint top-gap-sm sync-state-ok';
    syncState.classList.remove('hidden');
  }
  if (data?.warranty?.id) window.open(`/api/warranties/${encodeURIComponent(data.warranty.id)}/pdf`, '_blank', 'noopener');
}

function linkedOrderSummary(order, quote = null) {
  if (!order) return '';
  return `
    <strong>Orden: ${escapeHtml(order.id || '-')}</strong><br />
    Cotización: ${escapeHtml(order.quoteId || quote?.id || '-')}<br />
    Perfil comercial: ${escapeHtml(order.commercialProfileName || quote?.commercialProfile?.name || '-')}<br />
    Cliente: ${escapeHtml(order.clientName || quote?.clientName || '-')}<br />
    ${escapeHtml(order.clientEmail || quote?.email || '-')}
  `;
}

function loadConformityForm(orderId) {
  const order = findOrderById(orderId);
  const form = el('conformityForm');
  const orderSelect = el('conformityOrderSelect');
  const orderCode = el('conformityOrderCode');
  const linkedCard = el('conformityLinkedOrderCard');
  if (!order || !form) return false;
  const quote = findQuoteById(order.quoteId);
  state.conformityOrderId = orderId;
  if (orderSelect) orderSelect.value = orderId;
  if (orderCode) orderCode.value = order.id || '';
  form.installationOrderId.value = order.id || '';
  form.date.value = todayInputValue();
  form.quoteId.value = order.quoteId || quote?.id || '';
  form.clientName.value = order.clientName || quote?.clientName || '';
  form.clientEmail.value = order.clientEmail || quote?.email || '';
  form.ruc.value = order.ruc || quote?.ruc || '';
  form.address.value = order.address || quote?.clientAddress || '';
  form.chargerBrand.value = order.chargerBrand || quote?.charger?.brand || quote?.charger?.label || 'GENERAL';
  form.serialNumber.value = order.serialNumber || quote?.serialNumber || '';
  form.voltage.value = order.voltage || quote?.voltage || 220;
  form.amperage.value = order.amperage || quote?.current || 32;
  form.other.value = order.other || quote?.other || '';
  form.powerKw.value = order.powerKw || quote?.powerKw || '';
  setConformityImplementedChecks(form, order.deliveredItems || [], order);
  if (!String(form.observations.value || '').trim()) form.observations.value = '';
  if (linkedCard) {
    linkedCard.innerHTML = linkedOrderSummary(order, quote);
    linkedCard.classList.remove('hidden');
  }
  updateConformityGuidedUi();
  return true;
}

function onChangeConformityOrder(event) {
  const orderId = String(event?.target?.value || '').trim();
  if (!orderId) return resetConformityForm({ preserveSelection: true });
  loadConformityForm(orderId);
}

function resetConformityForm({ preserveSelection = false } = {}) {
  const form = el('conformityForm');
  if (!form) return;
  const orderSelect = el('conformityOrderSelect');
  const orderCode = el('conformityOrderCode');
  const linkedCard = el('conformityLinkedOrderCard');
  const orderId = preserveSelection ? String(orderSelect?.value || '') : (state.conformityOrderId || String(orderSelect?.value || ''));
  if (orderId) {
    loadConformityForm(orderId);
    form.observations.value = '';
    return;
  }
  state.conformityOrderId = '';
  if (orderSelect) orderSelect.value = '';
  if (orderCode) orderCode.value = '';
  form.reset();
  form.installationOrderId.value = '';
  form.quoteId.value = '';
  form.date.value = todayInputValue();
  if (linkedCard) {
    linkedCard.innerHTML = '';
    linkedCard.classList.add('hidden');
  }
  form.chargerBrand.value = 'GENERAL';
  setConformityImplementedChecks(form, [], {});
  state.conformityPhotoFiles = [null, null];
  clearSignaturePad('installer');
  clearSignaturePad('client');
  renderConformityPhotoPreview();
  syncConformityAdditionalField();
  updateConformityGuidedUi();
}

function openConformityModal(orderId) {
  const order = findOrderById(orderId);
  if (!order) return alert('No encontré la orden para generar la conformidad.');
  if (!canGenerateConformity()) return alert('Tu usuario no tiene permiso para generar conformidades desde web.');
  if (!isOrderReadyForConformity(order)) return alert('La orden todavía no está lista para generar conformidad.');
  const existing = findConformityByOrderId(orderId);
  if (existing) {
    window.open(`/api/conformities/${encodeURIComponent(existing.id)}/pdf`, '_blank', 'noopener');
    return;
  }
  setTab('conformities');
  loadConformityForm(orderId);
  const form = el('conformityForm');
  if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function onSubmitConformityForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitBtn = form.querySelector('button[type="submit"]');
  const syncState = el('conformitySyncState');
  const photoPayload = await Promise.all((state.conformityPhotoFiles || []).map((file) => file ? resizeImageFile(file, 1800, 0.84) : null));
  const payload = {
    installationOrderId: form.installationOrderId.value,
    date: form.date.value,
    quoteId: form.quoteId.value,
    clientName: form.clientName.value,
    clientEmail: form.clientEmail.value,
    ruc: form.ruc.value,
    address: form.address.value,
    chargerBrand: form.chargerBrand.value,
    serialNumber: form.serialNumber.value,
    voltage: form.voltage.value,
    amperage: form.amperage.value,
    other: form.other.value,
    powerKw: form.powerKw.value,
    deliveredItems: conformityDeliveredItemsFromForm(form),
    cajaCargador: form.cajaCargador.checked,
    cargadorEvinka: form.cargadorEvinka.checked,
    manualCargador: form.manualCargador.checked,
    tarjetasCargador: form.tarjetasCargador.checked,
    adicional: form.adicional.checked,
    adicionalDesc: form.adicionalDesc.value,
    photoUrls: photoPayload.filter(Boolean),
    installerSignatureUrl: state.conformitySignatureData.installer,
    clientSignatureUrl: state.conformitySignatureData.client,
    observations: form.observations.value,
  };
  if (!payload.clientName.trim()) return alert('Falta el cliente.');
  if (!payload.clientEmail.trim()) return alert('Falta el correo del cliente.');
  if (!payload.chargerBrand.trim()) return alert('Falta la marca del cargador.');
  if (!state.conformitySignatureData.installer || !state.conformitySignatureData.client) return alert('Faltan ambas firmas para generar la conformidad.');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Generando...';
  }
  if (syncState) {
    syncState.textContent = 'Generando PDF y sincronizando conformidad...';
    syncState.className = 'hint top-gap-sm sync-state-warn';
    syncState.classList.remove('hidden');
  }
  const res = await fetch(withCountryQuery('/api/conformities'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Generar conformidad';
  }
  if (!res.ok) {
    if (res.status === 409 && data?.conformity?.id) {
      await refreshOperationalData();
      window.open(`/api/conformities/${encodeURIComponent(data.conformity.id)}/pdf`, '_blank', 'noopener');
      return;
    }
    if (syncState) {
      syncState.textContent = data.error || 'No se pudo generar la conformidad.';
      syncState.className = 'hint top-gap-sm sync-state-warn';
      syncState.classList.remove('hidden');
    }
    return alert(data.error || 'No se pudo generar la conformidad.');
  }
  const conformityId = data?.conformity?.id;
  if (syncState) {
    syncState.textContent = data?.emailDelivery?.message || 'Conformidad generada correctamente.';
    syncState.className = 'hint top-gap-sm sync-state-ok';
    syncState.classList.remove('hidden');
  }
  await refreshOperationalData();
  if (conformityId) {
    window.open(`/api/conformities/${encodeURIComponent(conformityId)}/pdf`, '_blank', 'noopener');
  }
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
window.openConformityModal = openConformityModal;

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

function resolveRoleKey(role = state.user?.role || '') {
  const normalized = normalizedRoleKey(role);
  const definitions = state.config?.roleDefinitions || [];
  for (const definition of definitions) {
    const aliases = [definition.id, ...(definition.aliases || [])]
      .map((item) => normalizedRoleKey(item));
    if (aliases.includes(normalized)) return definition.id;
  }
  return normalized || 'tecnico_visitas';
}

function getRoleDefinition(role = state.user?.role || '') {
  const key = resolveRoleKey(role);
  return (state.config?.roleDefinitions || []).find((definition) => definition.id === key) || null;
}

function roleHasPermission(permission) {
  return Boolean(getRoleDefinition()?.permissions?.includes(permission));
}

function canAccessTab(tab) {
  return Boolean(getRoleDefinition()?.tabs?.includes(tab));
}

function roleLabel(role = state.user?.role || '') {
  return getRoleDefinition(role)?.label || resolveRoleKey(role);
}

function normalizedEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function isAdminUser() {
  return resolveRoleKey() === 'admin';
}

function isLuisSupervisor() {
  return normalizedEmail(state.user?.email) === 'luis.campos@evinka.tech';
}

function isTechSupervisor() {
  return resolveRoleKey() === 'supervisor';
}

function canEditCommercialFlow() {
  return roleHasPermission('quotes.write') || isLuisSupervisor();
}

function canSeeOperations() {
  return canAccessTab('visits') || canAccessTab('ops') || canAccessTab('conformities');
}

function canGenerateConformity() {
  return roleHasPermission('conformities.sign') || isTechSupervisor() || isAdminUser() || isLuisSupervisor();
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function isOrderReadyForConformity(order = {}) {
  return ['cerrada', 'instalada', 'pendiente_cierre'].includes(String(order?.status || '').trim().toLowerCase());
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

function fillDatalist(id, values = []) {
  const list = el(id);
  if (!list) return;
  list.innerHTML = (values || []).map((value) => `<option value="${escapeHtml(value)}"></option>`).join('');
}

function money(value, currencyHint = '') {
  const normalizedHint = String(currencyHint || '').trim().toUpperCase();
  const currency = normalizedHint === 'CO' ? 'COP' : normalizedHint === 'PE' ? 'PEN' : (normalizedHint || state.config?.currency || 'PEN');
  const locale = currency === 'COP' ? 'es-CO' : 'es-PE';
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0));
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
