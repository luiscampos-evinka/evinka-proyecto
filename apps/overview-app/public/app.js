const DATA_URL = '/data/overview-data.json';

const ROUTES = {
  login: { path: '/login', title: 'Acceso' },
  home: { path: '/', title: 'Resumen' },
  cuentas: { path: '/cuentas', title: 'Cuentas' },
  auditoria: { path: '/auditoria', title: 'Auditoría' },
  usuarios: { path: '/usuarios', title: 'Usuarios' },
  ubicaciones: { path: '/ubicaciones', title: 'Ubicaciones' },
  incidentes: { path: '/incidentes', title: 'Incidentes' },
  mapa: { path: '/mapa', title: 'Mapa' },
  reportes: { path: '/reportes', title: 'Reportes' },
  exportar: { path: '/exportar', title: 'Exportar' },
  alertas: { path: '/alertas', title: 'Alertas' },
};

const EXPORT_COLUMN_LIBRARY = {
  transaction: {
    label: 'Transacción',
    columns: ['StartTime', 'EndTime', 'CalibrationTime', 'Time Duration', 'User', 'Energy', 'Initial SoC', 'Final SoC', 'SoC Increment', 'Fee', 'EnergyFee', 'ServiceFee', 'Plaza', 'Station', 'StopReason', 'Coupon', 'Discount', 'NetFee'],
    presets: {
      basic: ['StartTime', 'User', 'Energy', 'Fee', 'Plaza', 'Station', 'StopReason'],
      financial: ['StartTime', 'User', 'Energy', 'Fee', 'EnergyFee', 'ServiceFee', 'Coupon', 'Discount', 'NetFee'],
      operational: ['StartTime', 'EndTime', 'Time Duration', 'Plaza', 'Station', 'Energy', 'StopReason'],
    },
  },
  recharge: {
    label: 'Recargar',
    columns: ['DateTime', 'User', 'Amount', 'Balance', 'Status'],
    presets: {
      basic: ['DateTime', 'User', 'Amount', 'Status'],
      financial: ['DateTime', 'User', 'Amount', 'Balance', 'Status'],
      operational: ['DateTime', 'User', 'Amount', 'Status'],
    },
  },
  appuser: {
    label: 'Usuaria',
    columns: ['Email', 'FirstName', 'LastName', 'Birthday', 'PhoneNumber', 'Identity', 'CreatedAt'],
    presets: {
      basic: ['Email', 'FirstName', 'LastName', 'PhoneNumber', 'CreatedAt'],
      customer: ['Email', 'FirstName', 'LastName', 'PhoneNumber', 'Identity'],
      registration: ['Email', 'CreatedAt', 'PhoneNumber'],
    },
  },
};

function defaultSelectedExportColumns() {
  return Object.fromEntries(Object.entries(EXPORT_COLUMN_LIBRARY).map(([kind, def]) => [kind, [...(def.presets.basic || def.columns || [])]]));
}

const state = {
  data: null,
  loading: false,
  error: '',
  lastRefreshAt: null,
  mapRenderToken: 0,
  users: {
    loading: false,
    exporting: false,
    error: '',
    rows: [],
    lastSyncAt: null,
    sourceExport: null,
    sourceSummary: null,
    usageSources: null,
    query: '',
    segment: 'all',
    selectedId: '',
  },
  adminUsers: {
    loading: false,
    saving: false,
    error: '',
    notice: '',
    rows: [],
    query: '',
    filter: 'all',
    create: {
      email: '',
      role: 'user',
      otpEmails: '',
      password: '',
    },
  },
  audit: {
    loading: false,
    error: '',
    rows: [],
    generatedAt: null,
    summary: null,
    prototype: 'all',
    selectedId: '',
  },
  notificationPrefs: {
    loading: false,
    saving: false,
    error: '',
    targetLabel: '',
    muteAlertsUntil: null,
    muteStatusUntil: null,
    updatedAt: null,
  },
  exports: {
    loading: false,
    creating: false,
    metaLoaded: false,
    error: '',
    refreshTimer: null,
    readyPulseTimer: null,
    justReadyIds: [],
    rows: [],
    kinds: [],
    columnDefs: EXPORT_COLUMN_LIBRARY,
    columnPickerKind: 'transaction',
    selectedColumns: defaultSelectedExportColumns(),
    cleanDownloadingIds: [],
    merchants: [],
    plazasByMerchant: {},
    form: {
      kind: 'transaction',
      merchant: '',
      plaza: '',
      startDate: '',
      endDate: '',
    },
    listFilter: {
      kind: 'all',
      status: 'all',
    },
    pagination: {
      page: 1,
      pageSize: 10,
    },
    mail: {
      recipientInput: '',
      recipients: [],
      exportIds: [],
      variant: 'original',
      subject: '',
      context: '',
      message: '',
      aiLoading: false,
      subjectTouched: false,
      messageTouched: false,
      sending: false,
      success: '',
    },
  },
  route: ROUTES.login.path,
  session: null,
  filters: {
    stationQuery: '',
    stationTone: 'all',
  },
  mapView: {
    query: '',
    tone: 'all',
    availableOnly: false,
    addressQuery: '',
    addressResults: [],
    userCoords: null,
    referenceLabel: '',
    nearestStationId: '',
    nearestTop3: [],
    routeActionsOpen: false,
    centerMode: 'network',
    statusMessage: '',
  },
  auth: {
    checking: true,
    mode: 'login',
    step: 'credentials',
    challengeId: null,
    resetToken: null,
    submitting: false,
    email: '',
    password: '',
    showPassword: false,
    resetShowPassword: false,
    resetPasswordDraft: '',
    resetConfirmPasswordDraft: '',
    maskedEmail: '',
    message: '',
    error: '',
  },
  map: null,
  mapUserMarker: null,
  markers: [],
};

function currentRole() {
  return String(state.session?.role || 'user').toLowerCase();
}

function isAdminRole(role = currentRole()) {
  return String(role || '').trim().toLowerCase() === 'admin';
}

function personalDataOwnerEmail() {
  return 'lorena.vargas@evinka.tech';
}

function canAccessPersonalDataUi() {
  const role = String(state.session?.role || '').trim().toLowerCase();
  const email = String(state.session?.email || '').trim().toLowerCase();
  return role === 'admin' || email === personalDataOwnerEmail();
}

function allowedRoutesForRole(role = currentRole()) {
  const base = isAdminRole(role)
    ? Object.values(ROUTES).map((item) => item.path)
    : role === 'marketing'
    ? [ROUTES.home.path]
    : role === 'operations'
      ? [ROUTES.home.path, ROUTES.ubicaciones.path, ROUTES.incidentes.path, ROUTES.mapa.path, ROUTES.reportes.path, ROUTES.alertas.path]
      : role === 'finance'
      ? [ROUTES.home.path, ROUTES.reportes.path, ROUTES.exportar.path]
        : Object.values(ROUTES).map((item) => item.path).filter((path) => path !== ROUTES.cuentas.path && path !== ROUTES.auditoria.path);
  return canAccessPersonalDataUi()
    ? [...new Set([...base, ROUTES.usuarios.path])]
    : base.filter((path) => path !== ROUTES.usuarios.path);
}

function canAccessRoute(path, role = currentRole()) {
  return allowedRoutesForRole(role).includes(path);
}

function defaultRouteForRole(role = currentRole()) {
  return role === 'marketing' && canAccessPersonalDataUi() ? ROUTES.usuarios.path : ROUTES.home.path;
}

function canUseNotificationControls(role = currentRole()) {
  return role === 'admin' || role === 'user' || role === 'operations';
}

function roleLabel(role = currentRole()) {
  return ({ admin: 'Administrador', user: 'General', marketing: 'Marketing', operations: 'Operaciones', finance: 'Finanzas' }[role] || role);
}

window.addEventListener('DOMContentLoaded', () => {
  void init();
});

window.addEventListener('popstate', () => {
  state.route = normalizePath(location.pathname);
  if (!state.session && state.route !== ROUTES.login.path) {
    navigate(ROUTES.login.path, { replace: true });
    return;
  }
  if (state.session && state.route === ROUTES.login.path) {
    navigate(defaultRouteForRole(), { replace: true });
    return;
  }
  if (state.session && !canAccessRoute(state.route)) {
    navigate(defaultRouteForRole(), { replace: true });
    return;
  }
  if (state.session && state.route === ROUTES.cuentas.path) void ensureAdminUsersLoaded();
  if (state.session && state.route === ROUTES.auditoria.path) void ensureAuditLoaded();
  if (state.session && state.route === ROUTES.exportar.path) void ensureExportsLoaded();
  if (state.session && state.route === ROUTES.usuarios.path) void ensureUsersLoaded();
  render();
});

window.addEventListener('fullscreenchange', () => {
  if (state.map) {
    setTimeout(() => state.map?.invalidateSize(), 120);
  }
});

async function init() {
  state.route = normalizePath(location.pathname);
  await refreshSession();
  if (state.session) {
    if (state.route === ROUTES.login.path) {
      navigate(defaultRouteForRole(), { replace: true });
      return;
    }
    if (!canAccessRoute(state.route)) {
      navigate(defaultRouteForRole(), { replace: true });
      return;
    }
    await loadData();
    const startupTasks = [];
    if (canUseNotificationControls()) startupTasks.push(loadNotificationPrefs({ silent: true }));
    if (state.route === ROUTES.cuentas.path) startupTasks.push(ensureAdminUsersLoaded());
    if (state.route === ROUTES.auditoria.path) startupTasks.push(ensureAuditLoaded());
    if (state.route === ROUTES.exportar.path) startupTasks.push(ensureExportsLoaded());
    if (state.route === ROUTES.usuarios.path) startupTasks.push(ensureUsersLoaded());
    if (startupTasks.length) await Promise.all(startupTasks);
  } else if (state.route !== ROUTES.login.path) {
    navigate(ROUTES.login.path, { replace: true });
    return;
  }
  render();
}

function normalizePath(pathname = '/') {
  const legacy = {
    '/index.html': ROUTES.home.path,
    '/cuentas.html': ROUTES.cuentas.path,
    '/auditoria.html': ROUTES.auditoria.path,
    '/usuarios.html': ROUTES.usuarios.path,
    '/ubicaciones.html': ROUTES.ubicaciones.path,
    '/incidentes.html': ROUTES.incidentes.path,
    '/mapa.html': ROUTES.mapa.path,
    '/reportes.html': ROUTES.reportes.path,
    '/exportar.html': ROUTES.exportar.path,
    '/alertas.html': ROUTES.alertas.path,
  };
  const clean = pathname.replace(/\/+$/, '') || '/';
  return legacy[clean] || clean;
}

function navigate(path, { replace = false } = {}) {
  const target = normalizePath(path);
  if (!replace) history.pushState({}, '', target);
  else history.replaceState({}, '', target);
  state.route = state.session && !canAccessRoute(target) ? defaultRouteForRole() : target;
  if (state.route === ROUTES.cuentas.path && state.session) void ensureAdminUsersLoaded();
  if (state.route === ROUTES.auditoria.path && state.session) void ensureAuditLoaded();
  if (state.route === ROUTES.exportar.path && state.session) void ensureExportsLoaded();
  if (state.route === ROUTES.usuarios.path && state.session) void ensureUsersLoaded();
  render();
}

async function api(path, options = {}) {
  const response = await fetch(path, {
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

async function refreshSession() {
  state.auth.checking = true;
  try {
    const session = await api('/api/auth/session', { method: 'GET' });
    state.session = session.authenticated ? session.user : null;
  } catch {
    state.session = null;
  } finally {
    state.auth.checking = false;
  }
}

async function loadData() {
  state.loading = true;
  state.error = '';
  render();
  try {
    const response = await fetch(`${DATA_URL}?ts=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = sanitizeStatusData(await response.json());
    state.lastRefreshAt = new Date().toISOString();
  } catch (error) {
    state.error = `No pude cargar el dataset (${error.message}).`;
  } finally {
    state.loading = false;
    render();
  }
}

async function loadNotificationPrefs({ silent = false } = {}) {
  if (!state.session) return;
  if (!silent) {
    state.notificationPrefs.loading = true;
    state.notificationPrefs.error = '';
    render();
  }
  try {
    const data = await api('/api/auth/status-notifications', { method: 'GET' });
    state.notificationPrefs.targetLabel = data.targetLabel || '';
    state.notificationPrefs.muteAlertsUntil = data.muteAlertsUntil || null;
    state.notificationPrefs.muteStatusUntil = data.muteStatusUntil || null;
    state.notificationPrefs.updatedAt = data.updatedAt || null;
    state.notificationPrefs.error = '';
  } catch (error) {
    state.notificationPrefs.error = error.message;
  } finally {
    state.notificationPrefs.loading = false;
    if (!silent) render();
  }
}

async function updateNotificationPrefs(action) {
  state.notificationPrefs.saving = true;
  state.notificationPrefs.error = '';
  render();
  try {
    const data = await api('/api/auth/status-notifications', {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
    state.notificationPrefs.targetLabel = data.targetLabel || '';
    state.notificationPrefs.muteAlertsUntil = data.muteAlertsUntil || null;
    state.notificationPrefs.muteStatusUntil = data.muteStatusUntil || null;
    state.notificationPrefs.updatedAt = data.updatedAt || null;
  } catch (error) {
    state.notificationPrefs.error = error.message;
  } finally {
    state.notificationPrefs.saving = false;
    render();
  }
}

function defaultExportRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function exportFormDefaults() {
  return { kind: 'transaction', merchant: '', plaza: '', ...defaultExportRange() };
}

state.exports.form = exportFormDefaults();

function exportKindLabel(kind) {
  return ({ transaction: 'Transacción', recharge: 'Recargar', appuser: 'Usuaria', invoice: 'Invoice' }[String(kind || '').toLowerCase()] || kind || 'Export');
}

function exportColumnDef(kind) {
  return state.exports.columnDefs?.[kind] || EXPORT_COLUMN_LIBRARY[kind] || { columns: [], presets: {} };
}

function ensureSelectedColumns(kind) {
  const def = exportColumnDef(kind);
  if (!state.exports.selectedColumns[kind]?.length) {
    state.exports.selectedColumns[kind] = [...(def.presets?.basic || def.columns || [])];
  }
  return state.exports.selectedColumns[kind];
}

function exportPresetLabel(key) {
  return ({ basic: 'Básico', financial: 'Finanzas', operational: 'Operativo', customer: 'Cliente', registration: 'Registro' }[key] || key);
}

function exportDescriptiveFilename(row, { clean = false } = {}) {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const formatPart = (value) => {
    if (!value) return 'Sin fecha';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'Sin fecha';
    return `${String(date.getUTCDate()).padStart(2, '0')} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  };
  const sanitize = (value = '') => String(value || '')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const kind = sanitize(exportKindLabel(row?.kind || 'Export'));
  const merchant = sanitize(row?.merchant || 'Toda la red');
  const range = `${formatPart(row?.startTime)} al ${formatPart(row?.endTime)}`;
  const suffix = clean ? 'Limpio' : 'Original';
  return sanitize(`EVINKA - ${kind} - ${merchant} - ${range} - ${suffix}`).concat('.xlsx');
}

function isCorporateEmail(value = '') {
  return /^[^\s@]+@evinka\.tech$/i.test(String(value || '').trim());
}

function exportMailDefaultDraft(rows, { clean = false, context = '' } = {}) {
  const list = (Array.isArray(rows) ? rows : [rows]).filter(Boolean);
  const variantLabel = clean ? 'limpios' : 'originales';
  const details = list.map((row) => {
    const start = formatDateTime(row?.startTime) || 'Sin fecha';
    const end = formatDateTime(row?.endTime) || 'Sin fecha';
    const kind = exportKindLabel(row?.kind || 'Export');
    const merchant = row?.merchant || 'Toda la red';
    return `${kind} · ${merchant} · ${start} → ${end}`;
  });
  const subject = list.length <= 1
    ? `Envío de reporte y export ${variantLabel === 'limpios' ? 'limpio' : 'original'}`
    : `Envío de reportes y exports ${variantLabel}`;
  const body = [
    'Estimados,',
    '',
    `Por medio del presente, comparto ${list.length <= 1 ? 'el reporte y export adjunto' : 'los reportes y exports adjuntos'} correspondientes a ${list.length <= 1 ? 'este periodo' : 'los periodos indicados'}, para su revisión y seguimiento.`,
    '',
    ...(details.length ? ['Detalle de exports enviados:', ...details.map((item) => `- ${item}`), ''] : []),
    context ? `${String(context || '').trim()}` : 'Adjunto a este correo encontrarán los archivos correspondientes.',
    '',
    'Quedo atento a cualquier comentario u observación.',
    '',
    'Saludos cordiales,',
    'Luis Campos',
  ].join('\n');
  return { subject, message: body };
}

function selectedExportsForMail() {
  const ids = new Set(state.exports.mail.exportIds || []);
  return (state.exports.rows || []).filter((row) => ids.has(row.id));
}

function syncExportMailDraft({ force = false } = {}) {
  const rows = selectedExportsForMail();
  const draft = exportMailDefaultDraft(rows, {
    clean: state.exports.mail.variant === 'clean',
    context: state.exports.mail.context,
  });
  if (force || !state.exports.mail.subjectTouched || !state.exports.mail.subject) {
    state.exports.mail.subject = draft.subject;
    state.exports.mail.subjectTouched = false;
  }
  if (force || !state.exports.mail.messageTouched || !state.exports.mail.message) {
    state.exports.mail.message = draft.message;
    state.exports.mail.messageTouched = false;
  }
}

function selectExportForMail(row) {
  if (!row?.id) return;
  const current = new Set(state.exports.mail.exportIds || []);
  if (current.has(row.id)) current.delete(row.id);
  else current.add(row.id);
  state.exports.mail.exportIds = [...current];
  state.exports.mail.success = '';
  syncExportMailDraft();
  render();
}

function removeSelectedExportForMail(exportId) {
  state.exports.mail.exportIds = (state.exports.mail.exportIds || []).filter((item) => item !== exportId);
  state.exports.mail.success = '';
  syncExportMailDraft();
  render();
}

function addMailRecipient(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!email) return;
  if (!isCorporateEmail(email)) {
    state.exports.error = 'Solo se permiten correos @evinka.tech.';
    render();
    return;
  }
  state.exports.mail.recipients = [...new Set([...(state.exports.mail.recipients || []), email])];
  state.exports.mail.recipientInput = '';
  state.exports.error = '';
  render();
}

function removeMailRecipient(email) {
  state.exports.mail.recipients = (state.exports.mail.recipients || []).filter((item) => item !== email);
  render();
}

function exportStatusTone(status = '') {
  const value = String(status || '').toLowerCase();
  if (value.includes('download')) return 'available';
  if (value.includes('prepar')) return 'preparing';
  if (value.includes('fail')) return 'faulted';
  return value.includes('offline') ? 'offline' : 'available';
}

function exportDownloadUrl(row) {
  const fileName = row?.fileNames?.[0] || '';
  const downloadName = exportDescriptiveFilename(row);
  return `/api/auth/exports/download?xlsxExportId=${encodeURIComponent(row?.id || '')}&fileName=${encodeURIComponent(fileName)}&downloadName=${encodeURIComponent(downloadName)}`;
}

async function loadExportsMeta({ silent = false } = {}) {
  if (!state.session) return;
  if (!silent) {
    state.exports.loading = true;
    state.exports.error = '';
    render();
  }
  try {
    const data = await api('/api/auth/exports/meta', { method: 'GET' });
    state.exports.kinds = data.kinds || [];
    state.exports.merchants = data.merchants || [];
    state.exports.plazasByMerchant = data.plazasByMerchant || {};
    state.exports.columnDefs = { ...EXPORT_COLUMN_LIBRARY, ...(data.columnDefs || {}) };
    for (const kind of Object.keys(state.exports.columnDefs || {})) ensureSelectedColumns(kind);
    state.exports.metaLoaded = true;
    state.exports.error = '';
  } catch (error) {
    state.exports.error = error.message;
  } finally {
    state.exports.loading = false;
    if (!silent) render();
  }
}

async function loadExportsList({ silent = false } = {}) {
  if (!state.session) return;
  if (!silent) {
    state.exports.loading = true;
    state.exports.error = '';
    render();
  }
  try {
    const data = await api('/api/auth/exports?pageSize=100&page=1', { method: 'GET' });
    mergeExportsRows(data.exports || []);
    state.exports.error = '';
  } catch (error) {
    state.exports.error = error.message;
  } finally {
    state.exports.loading = false;
    if (!silent) render();
  }
}

async function ensureExportsLoaded() {
  if (!state.session) return;
  if (!state.exports.metaLoaded) await loadExportsMeta({ silent: true });
  if (!state.exports.rows.length) await loadExportsList({ silent: true });
  render();
}

async function loadAdminUsers({ silent = false } = {}) {
  if (!state.session || !isAdminRole()) return;
  if (!silent) {
    state.adminUsers.loading = true;
    state.adminUsers.error = '';
    render();
  }
  try {
    const data = await api('/api/auth/admin/users', { method: 'GET' });
    state.adminUsers.rows = Array.isArray(data.users) ? data.users : [];
    state.adminUsers.error = '';
  } catch (error) {
    state.adminUsers.error = error.message;
  } finally {
    state.adminUsers.loading = false;
    render();
  }
}

async function ensureAdminUsersLoaded() {
  if (!state.session || !isAdminRole()) return;
  if (!state.adminUsers.rows.length && !state.adminUsers.loading) await loadAdminUsers({ silent: true });
  render();
}

async function loadAuditFeed({ silent = false } = {}) {
  if (!state.session || !isAdminRole()) return;
  if (!silent || !state.audit.rows.length) {
    state.audit.loading = true;
    state.audit.error = '';
    render();
  }
  try {
    const data = await api('/api/auth/audit-feed?limit=160', { method: 'GET' });
    state.audit.rows = Array.isArray(data.events) ? data.events : [];
    state.audit.summary = data.summary || null;
    state.audit.generatedAt = data.generatedAt || null;
    if (!state.audit.rows.some((item) => item.id === state.audit.selectedId)) {
      state.audit.selectedId = filteredAuditRows(state.audit.rows)[0]?.id || state.audit.rows[0]?.id || '';
    }
    state.audit.error = '';
  } catch (error) {
    state.audit.error = error.message;
  } finally {
    state.audit.loading = false;
    render();
  }
}

async function ensureAuditLoaded() {
  if (!state.session || !isAdminRole()) return;
  if (!state.audit.rows.length && !state.audit.loading) await loadAuditFeed({ silent: true });
  render();
}

async function createManagedUser() {
  if (!state.session || !isAdminRole() || state.adminUsers.saving) return;
  state.adminUsers.saving = true;
  state.adminUsers.error = '';
  state.adminUsers.notice = '';
  render();
  try {
    const payload = {
      email: state.adminUsers.create.email,
      role: state.adminUsers.create.role,
      otpEmails: state.adminUsers.create.otpEmails,
      ...(state.adminUsers.create.password ? { password: state.adminUsers.create.password } : {}),
    };
    const data = await api('/api/auth/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await loadAdminUsers({ silent: true });
    state.adminUsers.create = { email: '', role: 'user', otpEmails: '', password: '' };
    state.adminUsers.notice = `Cuenta creada. Contraseña temporal: ${data.temporaryPassword || 'generada'}`;
  } catch (error) {
    state.adminUsers.error = error.message;
  } finally {
    state.adminUsers.saving = false;
    render();
  }
}

async function updateManagedUser(email, patch = {}, successMessage = 'Cuenta actualizada.') {
  if (!state.session || !isAdminRole() || state.adminUsers.saving) return;
  state.adminUsers.saving = true;
  state.adminUsers.error = '';
  state.adminUsers.notice = '';
  render();
  try {
    await api('/api/auth/admin/users', {
      method: 'PATCH',
      body: JSON.stringify({ email, ...patch }),
    });
    await loadAdminUsers({ silent: true });
    state.adminUsers.notice = successMessage;
  } catch (error) {
    state.adminUsers.error = error.message;
  } finally {
    state.adminUsers.saving = false;
    render();
  }
}

async function resetManagedUserPassword(email) {
  if (!state.session || !isAdminRole() || state.adminUsers.saving) return;
  state.adminUsers.saving = true;
  state.adminUsers.error = '';
  state.adminUsers.notice = '';
  render();
  try {
    const data = await api('/api/auth/admin/users/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    await loadAdminUsers({ silent: true });
    state.adminUsers.notice = `Nueva contraseña temporal para ${email}: ${data.temporaryPassword || 'generada'}`;
  } catch (error) {
    state.adminUsers.error = error.message;
  } finally {
    state.adminUsers.saving = false;
    render();
  }
}

async function loadUsers({ silent = false, force = false } = {}) {
  if (!state.session) return;
  if (!silent || !state.users.rows.length) {
    state.users.loading = true;
    state.users.error = '';
    render();
  }
  try {
    const data = await api(`/api/auth/connect-users${force ? '?refresh=1' : ''}`, {
      method: force ? 'POST' : 'GET',
      ...(force ? { body: '{}' } : {}),
    });
    state.users.rows = Array.isArray(data.users) ? data.users : [];
    state.users.lastSyncAt = data.lastSyncAt || null;
    state.users.sourceExport = data.sourceExport || null;
    state.users.sourceSummary = data.sourceSummary || null;
    state.users.usageSources = data.usageSources || null;
    if (!state.users.rows.some((item) => item.id === state.users.selectedId)) {
      state.users.selectedId = state.users.rows[0]?.id || '';
    }
    state.users.error = '';
  } catch (error) {
    state.users.error = error.message;
  } finally {
    state.users.loading = false;
    render();
  }
}

async function ensureUsersLoaded() {
  if (!state.session) return;
  if (!state.users.rows.length && !state.users.loading) await loadUsers({ silent: true });
  render();
}

async function downloadUsersMarketingExport() {
  if (!state.session || state.users.exporting) return;
  state.users.exporting = true;
  state.users.error = '';
  render();
  try {
    const response = await fetch('/api/auth/connect-users/export-marketing', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: state.users.query || '', segment: state.users.segment || 'all' }),
    });
    if (!response.ok) {
      const text = await response.text();
      let message = text;
      try { message = JSON.parse(text).message || message; } catch {}
      throw new Error(message || `HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^";]+)"?/i);
    const filename = match?.[1] || 'EVINKA_usuarios_marketing.xlsx';
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    state.users.error = error.message;
  } finally {
    state.users.exporting = false;
    render();
  }
}

async function createExportFromForm() {
  state.exports.creating = true;
  state.exports.error = '';
  render();
  try {
    const { kind, merchant, startDate, endDate } = state.exports.form;
    const payload = {
      kind,
      ...(merchant ? { merchant } : {}),
      ...(startDate ? { startTime: `${startDate}T00:00:00.000Z` } : {}),
      ...(endDate ? { endTime: `${endDate}T23:59:59.999Z` } : {}),
    };
    const data = await api('/api/auth/exports', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (data.export) mergeExportsRows([data.export]);
    await loadExportsList({ silent: true });
  } catch (error) {
    state.exports.error = error.message;
  } finally {
    state.exports.creating = false;
    render();
  }
}

async function downloadCleanExport(row) {
  const kind = String(row?.kind || '').toLowerCase();
  const columns = [...ensureSelectedColumns(kind)];
  if (!columns.length) {
    state.exports.error = 'Selecciona al menos una columna para el export limpio.';
    render();
    return;
  }
  state.exports.cleanDownloadingIds = [...new Set([...(state.exports.cleanDownloadingIds || []), row.id])];
  state.exports.error = '';
  render();
  try {
    const response = await fetch('/api/auth/exports/download-clean', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        xlsxExportId: row.id,
        fileName: row.fileNames?.[0] || '',
        kind,
        columns,
        downloadName: exportDescriptiveFilename(row, { clean: true }),
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      let message = text;
      try { message = JSON.parse(text).message || message; } catch {}
      throw new Error(message || `HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportDescriptiveFilename(row, { clean: true });
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    state.exports.error = error.message;
  } finally {
    state.exports.cleanDownloadingIds = (state.exports.cleanDownloadingIds || []).filter((id) => id !== row.id);
    render();
  }
}

async function sendExportMail() {
  const rows = selectedExportsForMail();
  const clean = state.exports.mail.variant === 'clean';
  if (!rows.length) {
    state.exports.error = 'Primero selecciona al menos un export listo para enviar.';
    render();
    return;
  }
  const invalidRows = rows.filter((row) => !row?.id || !row?.fileNames?.[0]);
  if (invalidRows.length) {
    state.exports.error = 'Uno o más exports seleccionados todavía no están listos.';
    render();
    return;
  }
  if (!(state.exports.mail.recipients || []).length) {
    state.exports.error = 'Agrega al menos un correo.';
    render();
    return;
  }
  const exportsPayload = rows.map((row) => {
    const kind = String(row?.kind || '').toLowerCase();
    return {
      xlsxExportId: row.id,
      fileName: row.fileNames?.[0] || '',
      kind,
      variant: clean ? 'clean' : 'original',
      columns: clean ? [...ensureSelectedColumns(kind)] : [],
    };
  });
  if (clean && exportsPayload.some((item) => !(item.columns || []).length)) {
    state.exports.error = 'Selecciona al menos una columna válida para cada tipo antes de enviar el export limpio.';
    render();
    return;
  }
  state.exports.mail.sending = true;
  state.exports.mail.success = '';
  state.exports.error = '';
  render();
  try {
    const response = await fetch('/api/auth/exports/email', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exports: exportsPayload,
        recipients: state.exports.mail.recipients,
        subject: state.exports.mail.subject,
        text: state.exports.mail.message,
      }),
    });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch {}
    if (!response.ok) throw new Error(data.message || text || `HTTP ${response.status}`);
    state.exports.mail.success = `Correo enviado a ${(data.sentTo || state.exports.mail.recipients).join(', ')}.`;
  } catch (error) {
    state.exports.error = error.message;
  } finally {
    state.exports.mail.sending = false;
    render();
  }
}

async function generateExportMailDraftWithAi() {
  const rows = selectedExportsForMail();
  const clean = state.exports.mail.variant === 'clean';
  if (!rows.length) {
    state.exports.error = 'Primero selecciona al menos un export para redactar el correo.';
    render();
    return;
  }
  state.exports.mail.aiLoading = true;
  state.exports.mail.success = '';
  state.exports.error = '';
  render();
  try {
    const response = await fetch('/api/auth/exports/email-draft', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipients: state.exports.mail.recipients,
        context: state.exports.mail.context,
        variant: clean ? 'clean' : 'original',
        exports: rows.map((row) => ({
          xlsxExportId: row.id,
          fileName: row.fileNames?.[0] || '',
          kind: String(row?.kind || '').toLowerCase(),
          merchant: row?.merchant || 'Toda la red',
          startTime: row?.startTime || '',
          endTime: row?.endTime || '',
        })),
      }),
    });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch {}
    if (!response.ok) throw new Error(data.message || text || `HTTP ${response.status}`);
    state.exports.mail.subject = String(data.subject || '').trim();
    state.exports.mail.message = String(data.text || '').trim();
    state.exports.mail.subjectTouched = false;
    state.exports.mail.messageTouched = false;
  } catch (error) {
    state.exports.error = error.message;
  } finally {
    state.exports.mail.aiLoading = false;
    render();
  }
}

function filteredExportsRows() {
  const { kind, status } = state.exports.listFilter;
  return state.exports.rows.filter((row) => {
    const kindOk = kind === 'all' || String(row.kind || '').toLowerCase() === kind;
    const statusOk = status === 'all' || String(row.status || '').toLowerCase() === status;
    return kindOk && statusOk;
  });
}

function paginatedExportsRows(rows = filteredExportsRows()) {
  const pageSize = Math.max(1, Number(state.exports.pagination.pageSize || 10));
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(totalPages, Math.max(1, Number(state.exports.pagination.page || 1)));
  state.exports.pagination.page = currentPage;
  const start = (currentPage - 1) * pageSize;
  return {
    rows: rows.slice(start, start + pageSize),
    totalPages,
    currentPage,
    totalRows: rows.length,
    start: rows.length ? start + 1 : 0,
    end: Math.min(rows.length, start + pageSize),
  };
}

function sortExportsRows(rows = []) {
  return [...rows].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

function markExportsJustReady(ids = []) {
  const nextIds = [...new Set([...(state.exports.justReadyIds || []), ...ids.filter(Boolean)])];
  state.exports.justReadyIds = nextIds;
  if (state.exports.readyPulseTimer) clearTimeout(state.exports.readyPulseTimer);
  state.exports.readyPulseTimer = setTimeout(() => {
    state.exports.justReadyIds = [];
    state.exports.readyPulseTimer = null;
    render();
  }, 12000);
}

function mergeExportsRows(nextRows = []) {
  const byId = new Map();
  const justReady = [];
  for (const row of state.exports.rows || []) {
    if (row?.id) byId.set(row.id, row);
  }
  for (const row of nextRows || []) {
    if (!row?.id) continue;
    const prev = byId.get(row.id) || {};
    const prevStatus = String(prev.status || '').toLowerCase();
    const nextStatus = String(row.status || '').toLowerCase();
    if (nextStatus === 'downloadable' && prevStatus && prevStatus !== 'downloadable') justReady.push(row.id);
    byId.set(row.id, { ...prev, ...row });
  }
  state.exports.rows = sortExportsRows([...byId.values()]);
  if (justReady.length) markExportsJustReady(justReady);
}

function clearExportsRefreshTimer() {
  if (state.exports.refreshTimer) {
    clearTimeout(state.exports.refreshTimer);
    state.exports.refreshTimer = null;
  }
}

function clearExportsReadyPulse() {
  if (state.exports.readyPulseTimer) {
    clearTimeout(state.exports.readyPulseTimer);
    state.exports.readyPulseTimer = null;
  }
  state.exports.justReadyIds = [];
}

function hasPreparingExports(rows = state.exports.rows) {
  return (rows || []).some((row) => {
    const status = String(row?.status || '').toLowerCase();
    if (status === 'failed' || status === 'downloadable') return false;
    return status === 'preparing' || row?.ready === false;
  });
}

function scheduleExportsAutoRefresh() {
  clearExportsRefreshTimer();
  if (!state.session || state.route !== ROUTES.exportar.path) return;
  if (state.exports.loading || state.exports.creating) return;
  if (!hasPreparingExports()) return;
  state.exports.refreshTimer = setTimeout(async () => {
    state.exports.refreshTimer = null;
    if (!state.session || state.route !== ROUTES.exportar.path) return;
    await loadExportsList({ silent: true });
    render();
  }, 300000);
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDateTime(value) {
  if (!value) return 'Sin dato';
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Lima',
  }).format(new Date(value));
}

function isFuture(value) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time > Date.now();
}

function notificationStatusLabel(value, activeLabel) {
  return isFuture(value) ? `Silenciadas hasta ${formatDateTime(value)}` : activeLabel;
}

function toneLabel(tone) {
  return ({ available: 'Disponible', charging: 'Cargando', preparing: 'Preparando', offline: 'Sin conexión', faulted: 'Con falla' }[tone] || tone || 'Disponible');
}

function chip(tone, label) {
  const safeTone = ['available', 'charging', 'preparing', 'offline', 'faulted'].includes(tone) ? tone : 'available';
  return `<span class="status-chip ${safeTone}">${escapeHtml(label || toneLabel(safeTone))}</span>`;
}

function renderMapPopup(station) {
  const tone = effectiveStationTone(station);
  const connectors = effectiveConnectorsForEvinka(station);
  const stationId = escapeHtml(station.id || '');
  const connectorCount = connectors.length;
  const imageBlock = station.imageUrl
    ? `<div class="evinka-map-popup-media" style="background-image:url('${escapeHtml(station.imageUrl)}')"></div>`
    : `<div class="evinka-map-popup-media empty"></div>`;

  return `
    <article class="evinka-map-popup ${tone}">
      ${imageBlock}
      <div class="evinka-map-popup-body">
        <div class="evinka-map-popup-topline">EVINKA CONNECT · STATUS</div>
        <div class="evinka-map-popup-head">
          <div class="evinka-map-popup-brand">${escapeHtml(station.merchantName || 'EVINKA')}</div>
          <h3>${escapeHtml(station.plazaName || station.name || 'Ubicación')}</h3>
          <div class="evinka-map-popup-subtitle">${escapeHtml(station.name || 'Estación')}</div>
        </div>
        <div class="evinka-map-popup-status-row">${chip(tone, toneLabel(tone))}</div>
        <div class="evinka-map-popup-meta-grid">
          <div class="evinka-map-popup-meta"><span>Conectores</span><strong>${escapeHtml(String(connectorCount || 0))}</strong></div>
          <div class="evinka-map-popup-meta"><span>Estado</span><strong>${escapeHtml(toneLabel(tone))}</strong></div>
        </div>
        <div class="evinka-map-popup-address">${escapeHtml(station.address || 'Sin dirección')}</div>
        <div class="evinka-map-popup-coords">Lat ${escapeHtml(String(station.latitude ?? '—'))} · Lng ${escapeHtml(String(station.longitude ?? '—'))}</div>
        <div class="evinka-map-popup-connectors">
          ${connectors.length ? connectors.map((connector) => chip(connector.effectiveTone, `Conector ${connector.connectorId} · ${connector.status}`)).join('') : '<span class="table-muted">Sin conectores</span>'}
        </div>
        <button class="btn-ghost map-popup-route-btn" type="button" data-popup-route="${stationId}">Cómo llegar</button>
      </div>
    </article>
  `;
}

function uniqueAlerts(alerts = []) {
  return alerts.filter((alert, index, arr) => {
    const key = `${alert.title}|${alert.detail}|${alert.stationId}|${alert.connectorId || ''}|${alert.createdLabel || ''}`;
    return arr.findIndex((item) => `${item.title}|${item.detail}|${item.stationId}|${item.connectorId || ''}|${item.createdLabel || ''}` === key) === index;
  });
}

const EXCLUDED_STATUS_PATTERNS = [
  /\btest\b/i,
  /\bprueba\b/i,
  /\bdemo\b/i,
  /\bqa\b/i,
  /\bsandbox\b/i,
  /\blab\b/i,
];

function matchesExcludedStatusPattern(...values) {
  const haystack = values
    .flatMap((value) => value == null ? [] : [String(value)])
    .join(' ')
    .trim();
  return haystack ? EXCLUDED_STATUS_PATTERNS.some((pattern) => pattern.test(haystack)) : false;
}

function isExcludedStatusStation(station = {}) {
  return matchesExcludedStatusPattern(
    station?.name,
    station?.merchantName,
    station?.merchantId,
    station?.plazaName,
    station?.address,
    station?.locationText,
    station?.summaryStatus,
  );
}

function sanitizeStatusData(data = {}) {
  const stations = Array.isArray(data?.stations) ? data.stations.filter((station) => !isExcludedStatusStation(station)) : [];
  const stationIds = new Set(stations.map((station) => String(station?.id || '')).filter(Boolean));
  const alerts = Array.isArray(data?.alerts)
    ? data.alerts.filter((alert) => {
      const stationId = String(alert?.stationId || '');
      if (stationId && !stationIds.has(stationId)) return false;
      return !matchesExcludedStatusPattern(alert?.title, alert?.detail, alert?.stationName);
    })
    : [];
  const incidents = Array.isArray(data?.incidents)
    ? data.incidents.filter((incident) => {
      const stationId = String(incident?.stationId || '');
      if (stationId && !stationIds.has(stationId)) return false;
      return !matchesExcludedStatusPattern(incident?.title, incident?.location, incident?.stationName);
    })
    : [];
  const plazas = Array.isArray(data?.plazas)
    ? data.plazas.filter((plaza) => !matchesExcludedStatusPattern(plaza?.name, plaza?.merchantName, plaza?.merchantId, plaza?.address))
    : [];
  const totals = {
    stations: stations.length,
    connectors: stations.reduce((sum, station) => sum + (Array.isArray(station?.connectors) ? station.connectors.length : 0), 0),
    available: stations.filter((station) => station?.tone === 'available').length,
    offline: stations.filter((station) => station?.tone === 'offline').length,
    charging: stations.filter((station) => station?.tone === 'charging').length,
    preparing: stations.filter((station) => station?.tone === 'preparing').length,
    faulted: stations.filter((station) => station?.tone === 'faulted').length,
  };
  return { ...data, stations, alerts, incidents, plazas, totals };
}

function totalsSummary() {
  return state.data?.totals || { stations: 0, connectors: 0, available: 0, offline: 0, charging: 0, preparing: 0, faulted: 0 };
}

function effectiveConnectorTone(station, connector) {
  const rawTone = ['available', 'offline', 'charging', 'preparing', 'faulted'].includes(connector?.tone) ? connector.tone : 'available';
  if ((station?.tone || '') === 'offline' && rawTone === 'available') return 'offline';
  return rawTone;
}

function effectiveConnectorsForEvinka(station) {
  const connectors = station?.connectors || [];
  const filtered = connectors.filter((connector) => Number(connector?.connectorId) !== 0);
  const base = filtered.length ? filtered : connectors;
  return base.map((connector) => ({
    ...connector,
    effectiveTone: effectiveConnectorTone(station, connector),
  }));
}

function effectiveStationTone(station) {
  if ((station?.tone || '') === 'offline') return 'offline';
  if ((station?.tone || '') === 'faulted') return 'faulted';
  const connectors = effectiveConnectorsForEvinka(station);
  const tones = connectors.map((connector) => connector.effectiveTone);
  if (tones.includes('faulted')) return 'faulted';
  if (tones.includes('charging')) return 'charging';
  if (tones.includes('preparing')) return 'preparing';
  if (tones.includes('available')) return 'available';
  if (tones.includes('offline')) return 'offline';
  return ['available', 'offline', 'charging', 'preparing', 'faulted'].includes(station?.tone) ? station.tone : 'available';
}

function connectorTotalsFromStations(stations = []) {
  const totals = { total: 0, available: 0, offline: 0, charging: 0, preparing: 0, faulted: 0 };
  for (const station of stations) {
    for (const connector of effectiveConnectorsForEvinka(station)) {
      const tone = connector.effectiveTone || 'available';
      totals.total += 1;
      totals[tone] += 1;
    }
  }
  return totals;
}

function connectorTotalsSummary() {
  return connectorTotalsFromStations(getStations());
}

function toneColor(tone) {
  return ({
    available: '#25c27b',
    offline: '#d85d5d',
    preparing: '#f0c86f',
    charging: '#5e8cff',
    faulted: '#ff9a68',
  }[tone] || '#8b8b8b');
}

function statusSegmentsFromTotals(totals = {}) {
  return [
    ['available', 'Disponible', Number(totals.available || 0)],
    ['offline', 'Offline', Number(totals.offline || 0)],
    ['preparing', 'Preparing', Number(totals.preparing || 0)],
    ['charging', 'Charging', Number(totals.charging || 0)],
    ['faulted', 'Faulted', Number(totals.faulted || 0)],
  ].filter(([, , value]) => value > 0);
}

function donutGradient(segments = [], total = 0) {
  if (!total || !segments.length) return 'conic-gradient(rgba(255,255,255,0.08) 0 100%)';
  let acc = 0;
  const stops = segments.map(([tone, , value]) => {
    const start = (acc / total) * 100;
    acc += value;
    const end = (acc / total) * 100;
    return `${toneColor(tone)} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

function renderStatusDonutPanel(title, subtitle, totals = {}, totalOverride = null) {
  const segments = statusSegmentsFromTotals(totals);
  const total = Number(totalOverride ?? totals.total ?? segments.reduce((sum, [, , value]) => sum + value, 0));
  return `
    <article class="panel donut-panel">
      <div class="section-head">
        <div>
          <div class="section-title">${escapeHtml(title)}</div>
          <p class="section-copy">${escapeHtml(subtitle)}</p>
        </div>
        <span class="badge">${escapeHtml(String(total))}</span>
      </div>
      <div class="donut-layout">
        <div class="donut-ring" style="background:${donutGradient(segments, total)};">
          <div class="donut-hole">
            <div class="small">Total</div>
            <strong>${escapeHtml(String(total))}</strong>
          </div>
        </div>
        <div class="donut-legend">
          ${segments.length ? segments.map(([tone, label, value]) => `
            <div class="donut-legend-item">
              <span class="donut-dot" style="background:${toneColor(tone)};"></span>
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(String(value))}</strong>
            </div>
          `).join('') : '<div class="empty-state">Sin datos para graficar.</div>'}
        </div>
      </div>
    </article>
  `;
}

function getStations() {
  return state.data?.stations || [];
}

function getAlerts() {
  return uniqueAlerts(state.data?.alerts || []);
}

function getIncidents() {
  return state.data?.incidents || [];
}

function getLocations() {
  return state.data?.plazas || [];
}

function getReports() {
  return state.data?.reports || [];
}

function mappedStations() {
  return getStations().filter((station) => Number.isFinite(station.latitude) && Number.isFinite(station.longitude));
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const radius = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(a));
}

function mapStatusColor(tone) {
  return ({ available: '#27c784', charging: '#4d8dff', preparing: '#d9a441', offline: '#8b95a7', faulted: '#ff8a5b' }[tone] || '#c7a06a');
}

function isMapStationAvailable(station) {
  return effectiveStationTone(station) === 'available';
}

function filteredMappedStations() {
  const query = searchNormalized(state.mapView.query || '');
  const tone = state.mapView.tone || 'all';
  const availableOnly = !!state.mapView.availableOnly;
  return mappedStations().filter((station) => {
    const text = searchNormalized([station.name, station.id, station.plazaName, station.address, station.merchantName].join(' '));
    const connectorTones = effectiveConnectorsForEvinka(station).map((connector) => connector.effectiveTone);
    const toneOk = tone === 'all' || effectiveStationTone(station) === tone || connectorTones.includes(tone);
    const queryOk = !query || text.includes(query);
    const availabilityOk = !availableOnly || isMapStationAvailable(station);
    return toneOk && queryOk && availabilityOk;
  });
}

function nearestMapStations(limit = 3) {
  const coords = state.mapView.userCoords;
  if (!coords) return [];
  return filteredMappedStations()
    .map((station) => ({ station, distanceKm: haversineKm(coords.latitude, coords.longitude, Number(station.latitude), Number(station.longitude)) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

function referenceMapBounds() {
  const coords = state.mapView.userCoords;
  if (!coords) return [];
  const nearest = state.mapView.nearestTop3?.length ? state.mapView.nearestTop3 : nearestMapStations(3);
  const points = [[Number(coords.latitude), Number(coords.longitude)]];
  for (const item of nearest) {
    if (!item?.station) continue;
    points.push([Number(item.station.latitude), Number(item.station.longitude)]);
  }
  return points.filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
}

function refreshMapNearest() {
  const nearest = nearestMapStations(3);
  state.mapView.nearestStationId = nearest[0]?.station?.id || '';
  state.mapView.nearestTop3 = nearest;
  if (!nearest.length) state.mapView.routeActionsOpen = false;
}

function setMapStatus(message = '') {
  state.mapView.statusMessage = message;
}

function clearMapAddressResults() {
  state.mapView.addressResults = [];
}

function applyMapReferencePoint(latitude, longitude, label = 'Ubicación seleccionada') {
  state.mapView.userCoords = { latitude: Number(latitude), longitude: Number(longitude) };
  state.mapView.referenceLabel = label;
  state.mapView.centerMode = 'reference';
  clearMapAddressResults();
  refreshMapNearest();
}

async function searchMapAddress() {
  const query = String(state.mapView.addressQuery || '').trim();
  if (!query) {
    setMapStatus('Escribe una dirección para buscar.');
    clearMapAddressResults();
    render();
    return;
  }
  setMapStatus('Buscando dirección…');
  render();
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=pe&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('search_failed');
    const data = await response.json();
    state.mapView.addressResults = Array.isArray(data) ? data : [];
    setMapStatus(state.mapView.addressResults.length ? 'Selecciona una dirección sugerida.' : 'No encontré esa dirección.');
  } catch {
    state.mapView.addressResults = [];
    setMapStatus('No pude buscar esa dirección.');
  }
  render();
}

function openMapGuide(app, stationId = state.mapView.nearestStationId) {
  const station = filteredMappedStations().find((item) => String(item.id) === String(stationId)) || mappedStations().find((item) => String(item.id) === String(stationId));
  if (!station) return;
  const lat = Number(station.latitude);
  const lng = Number(station.longitude);
  const name = station.plazaName || station.name || 'Cargador EVINKA';
  const origin = state.mapView.userCoords;
  let url = '';
  if (app === 'waze') {
    url = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  } else if (app === 'maps') {
    const originPart = origin ? `&origin=${encodeURIComponent(`${origin.latitude},${origin.longitude}`)}` : '';
    url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}${originPart}&travelmode=driving`;
  } else if (app === 'uber') {
    const pickup = origin
      ? `&pickup[latitude]=${encodeURIComponent(String(origin.latitude))}&pickup[longitude]=${encodeURIComponent(String(origin.longitude))}`
      : '&pickup=my_location';
    url = `https://m.uber.com/ul/?action=setPickup${pickup}&dropoff[latitude]=${encodeURIComponent(String(lat))}&dropoff[longitude]=${encodeURIComponent(String(lng))}&dropoff[nickname]=${encodeURIComponent(name)}`;
  }
  if (url) window.open(url, '_blank', 'noopener');
}

function appTitle() {
  const route = Object.values(ROUTES).find((item) => item.path === state.route);
  return route ? `${route.title} · EVINKA Status Center` : 'EVINKA Status Center';
}

function generateSecurePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*-_?';
  const array = new Uint32Array(18);
  crypto.getRandomValues(array);
  let password = 'Evk!';
  for (const value of array) password += alphabet[value % alphabet.length];
  return `${password}9aA`;
}

async function copyText(text, successMessage = 'Copiado.') {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    state.auth.message = successMessage;
    state.auth.error = '';
  } catch {
    state.auth.error = 'No pude copiar la contraseña automáticamente.';
  }
  render();
}

function render() {
  document.title = appTitle();
  const app = document.getElementById('app');
  if (!app) return;

  if (state.auth.checking) {
    clearExportsRefreshTimer();
    clearExportsReadyPulse();
    app.innerHTML = `<section class="login-screen"><div class="login-card"><div class="empty-state">Validando tu sesión…</div></div></section>`;
    destroyMap();
    return;
  }

  if (!state.session) {
    clearExportsRefreshTimer();
    clearExportsReadyPulse();
    app.innerHTML = renderAuthScreen();
    bindAuthScreen();
    destroyMap();
    return;
  }

  if (state.route === ROUTES.mapa.path && state.map) {
    destroyMap();
  }

  app.innerHTML = renderShell();
  bindShell();

  if (state.route === ROUTES.exportar.path) scheduleExportsAutoRefresh();
  else {
    clearExportsRefreshTimer();
    clearExportsReadyPulse();
  }

  if (state.route === ROUTES.mapa.path) {
    queueMapRender();
  } else {
    destroyMap();
  }
}

function queueMapRender() {
  const token = ++state.mapRenderToken;
  const attempt = (delay) => {
    setTimeout(() => {
      if (token !== state.mapRenderToken || state.route !== ROUTES.mapa.path) return;
      renderMap();
    }, delay);
  };
  requestAnimationFrame(() => {
    if (token !== state.mapRenderToken || state.route !== ROUTES.mapa.path) return;
    renderMap();
  });
  attempt(120);
  attempt(400);
}

function renderAuthScreen() {
  const isRegister = state.auth.mode === 'register';
  const isReset = state.auth.mode === 'reset';
  const isVerify = state.auth.step === 'verify';
  return `
    <section class="login-screen">
      <div class="login-card">
        <div class="login-hero">
          <div class="login-hero-copy">
            <div class="eyebrow">EVINKA CONNECT</div>
            <h1>Acceso corporativo al Status Center.</h1>
            <p class="login-note">
              Solo correos <strong>@evinka.tech</strong>. Los dispositivos nuevos se verifican con un código enviado por correo y luego quedan confiables.
            </p>
          </div>
          <div class="kpi-row">
            <div class="kpi-box"><span class="small">Dominio</span><strong>@evinka.tech</strong></div>
            <div class="kpi-box"><span class="small">Dispositivo</span><strong>Confiable 30d</strong></div>
            <div class="kpi-box"><span class="small">Verificación</span><strong>OTP 6 dígitos</strong></div>
          </div>
        </div>
        <div class="login-form-wrap">
          <div class="tab-row">
            <button type="button" class="tab-btn ${!isRegister && !isReset ? 'active' : ''}" data-auth-mode="login">Ingresar</button>
            <button type="button" class="tab-btn ${isRegister ? 'active' : ''}" data-auth-mode="register">Crear cuenta</button>
          </div>
          <div class="eyebrow" style="margin-top:18px;">${isVerify ? 'Verifica tu acceso' : state.auth.step === 'reset-password' ? 'Nueva contraseña' : isReset ? 'Recuperar acceso' : isRegister ? 'Crear cuenta' : 'Iniciar sesión'}</div>
          <h2 style="font-size:34px; margin:10px 0 8px; letter-spacing:-0.04em;">${isVerify ? 'Confirma el código' : state.auth.step === 'reset-password' ? 'Define tu nueva contraseña' : isReset ? 'Recupera tu contraseña' : isRegister ? 'Activa tu cuenta corporativa' : 'Accede con tu contraseña'}</h2>
          <p class="login-note" style="margin-bottom:22px; line-height:1.7;">
            ${isVerify
              ? `Te enviamos un código a <strong>${escapeHtml(state.auth.maskedEmail || '')}</strong>.`
              : state.auth.step === 'reset-password'
                ? 'Tu código ya fue validado. Ahora crea una nueva contraseña para volver a ingresar.'
                : isReset
                  ? 'Te enviaremos un código al correo corporativo y recién después podrás cambiar la contraseña.'
              : isRegister
                ? 'Crea tu cuenta con correo corporativo y confirma el dispositivo por única vez.'
                : 'Si ya confiaste este dispositivo antes, entrarás solo con correo y contraseña.'}
          </p>
          ${state.auth.message ? `<div class="success-box">${escapeHtml(state.auth.message)}</div>` : ''}
          ${state.auth.error ? `<div class="login-error">${escapeHtml(state.auth.error)}</div>` : ''}
          ${isVerify ? renderVerifyForm() : state.auth.step === 'reset-password' ? renderResetPasswordForm() : renderCredentialsForm()}
        </div>
      </div>
    </section>
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
          <input class="input" id="authPasswordInput" name="password" type="${state.auth.showPassword ? 'text' : 'password'}" autocomplete="current-password" value="${escapeHtml(state.auth.password)}" placeholder="Mínimo 10 caracteres" required ${disabled} />
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
          <input class="input" id="resetPasswordInput" name="password" type="${state.auth.resetShowPassword ? 'text' : 'password'}" autocomplete="new-password" value="${escapeHtml(state.auth.resetPasswordDraft || '')}" placeholder="Mínimo 10 caracteres" required ${disabled} />
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

function bindAuthScreen() {
  document.querySelectorAll('[data-auth-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      state.auth.mode = button.getAttribute('data-auth-mode');
      state.auth.step = 'credentials';
      state.auth.challengeId = null;
      state.auth.resetToken = null;
      state.auth.error = '';
      state.auth.message = '';
      render();
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
    render();
  });

  document.getElementById('generateRegisterPasswordBtn')?.addEventListener('click', () => {
    state.auth.password = generateSecurePassword();
    state.auth.showPassword = true;
    render();
  });

  document.getElementById('toggleRegisterPasswordBtn')?.addEventListener('click', () => {
    state.auth.showPassword = !state.auth.showPassword;
    render();
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
    render();
  });

  document.getElementById('toggleResetPasswordBtn')?.addEventListener('click', () => {
    state.auth.resetShowPassword = !state.auth.resetShowPassword;
    render();
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
    state.auth.mode = 'login';
    state.auth.step = 'credentials';
    state.auth.challengeId = null;
    state.auth.resetToken = null;
    state.auth.showPassword = false;
    state.auth.resetShowPassword = false;
    state.auth.error = '';
    state.auth.message = '';
    render();
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
    render();
    try {
      const endpoint = state.auth.mode === 'register'
        ? '/api/auth/register/start'
        : state.auth.mode === 'reset'
          ? '/api/auth/password/reset/start'
          : '/api/auth/login';
      const data = await api(endpoint, {
        method: 'POST',
        body: JSON.stringify(state.auth.mode === 'reset'
          ? { email: state.auth.email }
          : { email: state.auth.email, password: state.auth.password }),
      });
      if (data.authenticated) {
        state.session = data.user;
        state.auth.step = 'credentials';
        state.auth.challengeId = null;
        state.auth.resetToken = null;
        state.auth.message = '';
        state.auth.error = '';
        await loadData();
        if (canUseNotificationControls()) await loadNotificationPrefs({ silent: true });
        navigate(defaultRouteForRole(), { replace: true });
        return;
      }
      state.auth.step = 'verify';
      state.auth.challengeId = data.challengeId;
      state.auth.maskedEmail = data.maskedEmail;
      state.auth.message = data.reused
        ? 'Ya te había enviado un código hace unos segundos. Usa ese mismo correo.'
        : state.auth.mode === 'reset'
          ? 'Código de recuperación enviado.'
          : 'Código enviado correctamente.';
      render();
    } catch (error) {
      state.auth.error = error.message;
      render();
    } finally {
      state.auth.submitting = false;
      render();
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
    render();
    try {
      const endpoint = state.auth.mode === 'register'
        ? '/api/auth/register/verify'
        : state.auth.mode === 'reset'
          ? '/api/auth/password/reset/verify'
          : '/api/auth/login/verify';
      const data = await api(endpoint, {
        method: 'POST',
        body: JSON.stringify({ challengeId: state.auth.challengeId, code }),
      });
      if (state.auth.mode === 'reset') {
        state.auth.step = 'reset-password';
        state.auth.resetToken = data.resetToken;
        state.auth.challengeId = null;
        state.auth.resetShowPassword = false;
        state.auth.resetPasswordDraft = '';
        state.auth.resetConfirmPasswordDraft = '';
        state.auth.error = '';
        state.auth.message = 'Código validado. Ya puedes crear tu nueva contraseña.';
        render();
        return;
      }
      state.session = data.user;
      state.auth.step = 'credentials';
      state.auth.challengeId = null;
      state.auth.resetToken = null;
      state.auth.error = '';
      state.auth.message = '';
      await loadData();
      if (canUseNotificationControls()) await loadNotificationPrefs({ silent: true });
      navigate(defaultRouteForRole(), { replace: true });
    } catch (error) {
      state.auth.error = error.message;
      render();
    } finally {
      state.auth.submitting = false;
      render();
    }
  });

  document.getElementById('backToCredentialsBtn')?.addEventListener('click', () => {
    state.auth.step = 'credentials';
    state.auth.challengeId = null;
    state.auth.resetShowPassword = false;
    state.auth.message = '';
    state.auth.error = '';
    render();
  });

  document.getElementById('resendCodeBtn')?.addEventListener('click', async () => {
    if (state.auth.submitting) return;
    state.auth.submitting = true;
    state.auth.error = '';
    state.auth.message = '';
    render();
    try {
      const endpoint = state.auth.mode === 'register'
        ? '/api/auth/register/start'
        : state.auth.mode === 'reset'
          ? '/api/auth/password/reset/start'
          : '/api/auth/login';
      const data = await api(endpoint, {
        method: 'POST',
        body: JSON.stringify(state.auth.mode === 'reset'
          ? { email: state.auth.email }
          : { email: state.auth.email, password: state.auth.password }),
      });
      state.auth.challengeId = data.challengeId;
      state.auth.maskedEmail = data.maskedEmail;
      state.auth.message = data.reused
        ? 'Ya te había enviado un código hace unos segundos. Revisa ese mismo correo.'
        : 'Te envié un nuevo código.';
      render();
    } catch (error) {
      state.auth.error = error.message;
      render();
    } finally {
      state.auth.submitting = false;
      render();
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
    state.auth.submitting = true;
    state.auth.error = '';
    state.auth.message = '';
    render();

    if (password !== confirmPassword) {
      state.auth.error = 'Las contraseñas no coinciden.';
      state.auth.submitting = false;
      render();
      return;
    }

    try {
      const data = await api('/api/auth/password/reset/complete', {
        method: 'POST',
        body: JSON.stringify({ resetToken: state.auth.resetToken, password }),
      });
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
      state.auth.message = data.message || 'Contraseña actualizada.';
      render();
    } catch (error) {
      state.auth.error = error.message;
      render();
    } finally {
      state.auth.submitting = false;
      render();
    }
  });

  document.getElementById('cancelResetPasswordBtn')?.addEventListener('click', () => {
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
    state.auth.message = '';
    render();
  });
}

function renderShell() {
  const body = state.loading && !state.data
    ? renderLoadingPanel()
    : state.error && !state.data
      ? renderErrorPanel(state.error)
      : renderRoute();

  return `
    <div class="app-shell">
      ${renderSidebar()}
      <main class="content">
        ${renderTopbar()}
        ${canUseNotificationControls() ? renderNotificationControls() : ''}
        ${body}
      </main>
    </div>
  `;
}

function renderSidebar() {
  const navItems = [
    ['Resumen', ROUTES.home.path, totalsSummary().stations],
    ['Cuentas', ROUTES.cuentas.path, state.adminUsers.rows.length],
    ['Auditoría', ROUTES.auditoria.path, state.audit.summary?.total ?? state.audit.rows.length],
    ['Usuarios', ROUTES.usuarios.path, state.users.rows.length],
    ['Ubicaciones', ROUTES.ubicaciones.path, getLocations().length],
    ['Incidentes', ROUTES.incidentes.path, getIncidents().length],
    ['Mapa', ROUTES.mapa.path, mappedStations().length],
    ['Reportes', ROUTES.reportes.path, getReports().length],
    ['Exportar', ROUTES.exportar.path, state.exports.rows.length],
    ['Alertas', ROUTES.alertas.path, getAlerts().length],
  ].filter(([, path]) => canAccessRoute(path));

  return `
    <aside class="sidebar">
      <div>
        <div class="brand-lockup">
          <div class="brand-title">EVINKA</div>
          <div class="brand-subtitle">Status Center</div>
        </div>
        <nav class="nav-group">
          ${navItems.map(([label, path, meta]) => `
            <a href="${path}" class="nav-link ${state.route === path ? 'active' : ''}" data-link>
              <span>${label}</span>
              <span>${escapeHtml(String(meta ?? ''))}</span>
            </a>
          `).join('')}
        </nav>
      </div>
      <div class="sidebar-footer">
        <div class="small">Panel operativo de EVINKA Connect</div>
        <div class="user-chip"><span class="user-dot"></span><span>${escapeHtml(state.session?.email || '')}</span></div>
        <div class="small">Rol: ${escapeHtml(roleLabel())}</div>
        <button class="btn-ghost" id="logoutBtn" type="button">Cerrar sesión</button>
      </div>
    </aside>
  `;
}

function renderTopbar() {
  const current = Object.values(ROUTES).find((route) => route.path === state.route) || ROUTES.home;
  return `
    <section class="topbar">
      <div>
        <div class="eyebrow">EVINKA CONNECT</div>
        <h1>${escapeHtml(current.title)}</h1>
      </div>
      <div class="topbar-actions">
        <div class="info-pill"><span class="small">Última actualización</span><strong>${escapeHtml(formatDateTime(state.data?.generatedAt))}</strong></div>
        <div class="info-pill"><span class="small">Refresco UI</span><strong>${state.loading ? 'Actualizando…' : escapeHtml(formatDateTime(state.lastRefreshAt))}</strong></div>
        <button class="btn-ghost" id="refreshBtn" type="button" ${state.loading ? 'disabled' : ''}>${state.loading ? 'Actualizando…' : 'Actualizar'}</button>
      </div>
    </section>
  `;
}

function renderNotificationControls() {
  const prefs = state.notificationPrefs;
  const busy = prefs.loading || prefs.saving;
  return `
    <section class="panel notification-panel">
      <div class="section-head notification-head">
        <div>
          <div class="section-title">Controles web de notificaciones</div>
          <p class="section-copy">Silencia o reactiva alertas y cambios de estado sin salir del dashboard.</p>
        </div>
        <div class="notification-target">Destino WhatsApp: <strong>${escapeHtml(prefs.targetLabel || 'Sin configurar')}</strong></div>
      </div>
      <div class="notification-grid">
        <div class="notification-card ${isFuture(prefs.muteAlertsUntil) ? 'muted' : ''}">
          <div class="small">Alertas críticas</div>
          <strong>${escapeHtml(notificationStatusLabel(prefs.muteAlertsUntil, 'Activas'))}</strong>
        </div>
        <div class="notification-card ${isFuture(prefs.muteStatusUntil) ? 'muted' : ''}">
          <div class="small">Cambios de estado</div>
          <strong>${escapeHtml(notificationStatusLabel(prefs.muteStatusUntil, 'Activos'))}</strong>
        </div>
        <div class="notification-card">
          <div class="small">Último ajuste</div>
          <strong>${escapeHtml(formatDateTime(prefs.updatedAt))}</strong>
        </div>
      </div>
      <div class="notification-actions">
        <button class="btn-ghost" data-notification-action="mute_alerts_24h" type="button" ${busy ? 'disabled' : ''}>Silenciar alertas</button>
        <button class="btn-ghost" data-notification-action="mute_status_24h" type="button" ${busy ? 'disabled' : ''}>Silenciar estados</button>
        <button class="btn" data-notification-action="resume_all" type="button" ${busy ? 'disabled' : ''}>Reactivar todo</button>
        <button class="btn-ghost" id="notificationReloadBtn" type="button" ${busy ? 'disabled' : ''}>${busy ? 'Guardando…' : 'Actualizar controles'}</button>
      </div>
      ${prefs.error ? `<div class="notification-feedback error">${escapeHtml(prefs.error)}</div>` : ''}
    </section>
  `;
}

function searchNormalized(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function daysSince(value) {
  if (!value) return Infinity;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return Infinity;
  return Math.floor((Date.now() - time) / (24 * 60 * 60 * 1000));
}

function userMarketingSegment(row) {
  const score = userActivityScore(row);
  const lastDays = daysSince(row?.usage?.lastActivityAt);
  if (!score) return 'lead';
  if (lastDays <= 45) return 'active';
  return 'dormant';
}

function userMarketingLabel(row) {
  return ({ lead: 'Lead', active: 'Cliente activo', dormant: 'Cliente dormido' }[userMarketingSegment(row)] || 'Lead');
}

function matchesUserSegment(row, segment = state.users.segment || 'all') {
  const current = String(segment || 'all');
  if (current === 'all') return true;
  if (current === 'with-email') return Boolean(row?.email);
  if (current === 'with-phone') return Boolean(row?.phone);
  return userMarketingSegment(row) === current;
}

function filteredUsersRows() {
  const query = searchNormalized(state.users.query);
  const rows = Array.isArray(state.users.rows) ? state.users.rows : [];
  return rows.filter((row) => {
    const queryOk = !query || [row.fullName, row.email, row.phone, row.identity]
      .some((value) => searchNormalized(value).includes(query));
    return queryOk && matchesUserSegment(row, state.users.segment);
  });
}

function auditPrototypeCatalog() {
  return [
    { key: 'all', label: 'Todo' },
    { key: 'status', label: 'Status' },
    { key: 'chatbot', label: 'Chatbot' },
    { key: 'cotizador', label: 'Cotizador' },
    { key: 'conformidad', label: 'Conformidad' },
    { key: 'mapa-publico', label: 'Mapa público' },
  ];
}

function filteredAuditRows(rows = state.audit.rows || []) {
  const current = String(state.audit.prototype || 'all');
  const list = Array.isArray(rows) ? rows : [];
  return current === 'all' ? list : list.filter((item) => item.prototype === current);
}

function ensureSelectedAuditEvent(rows = state.audit.rows || []) {
  const list = filteredAuditRows(rows);
  const exists = list.some((item) => item.id === state.audit.selectedId);
  if (!exists) state.audit.selectedId = list[0]?.id || '';
  return list.find((item) => item.id === state.audit.selectedId) || list[0] || null;
}

function auditPrototypeLabel(key = '') {
  return auditPrototypeCatalog().find((item) => item.key === key)?.label || key || 'Sin categoría';
}

function formatMoney(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return '—';
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numeric);
}

function formatAuditStatus(value = '') {
  const current = String(value || '').trim().toLowerCase();
  return ({ success: 'Correcto', denied: 'Bloqueado', open: 'Abierto', closed: 'Cerrado', pdf_generated: 'PDF generado', pending: 'Pendiente', draft: 'Borrador' }[current] || value || 'Sin estado');
}

function timeAgo(value) {
  const time = new Date(value || '').getTime();
  if (!Number.isFinite(time)) return 'Sin fecha';
  const diffMinutes = Math.max(1, Math.round((Date.now() - time) / 60000));
  if (diffMinutes < 60) return `hace ${diffMinutes} min`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;
  const diffDays = Math.round(diffHours / 24);
  return `hace ${diffDays} d`;
}

function renderRoute() {
  switch (state.route) {
    case ROUTES.cuentas.path: return renderAccountsView();
    case ROUTES.auditoria.path: return renderAuditView();
    case ROUTES.usuarios.path: return renderUsersView();
    case ROUTES.ubicaciones.path: return renderLocationsView();
    case ROUTES.incidentes.path: return renderIncidentsView();
    case ROUTES.mapa.path: return renderMapView();
    case ROUTES.reportes.path: return renderReportsView();
    case ROUTES.exportar.path: return renderExportsView();
    case ROUTES.alertas.path: return renderAlertsView();
    case ROUTES.home.path:
    default:
      return renderOverviewView();
  }
}

function renderLoadingPanel() {
  return `<section class="panel"><div class="section-title">Cargando dashboard</div><div class="empty-state">Estoy trayendo el snapshot operativo para renderizar la app.</div></section>`;
}

function renderErrorPanel(error) {
  return `<section class="panel"><div class="section-title">No pude cargar el status</div><div class="empty-state">${escapeHtml(error)}</div></section>`;
}

function formatCompactNumber(value) {
  return new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDecimal(value) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
}

function userActivityScore(row) {
  return Number(row?.usage?.transactions || 0) + Number(row?.usage?.rechargeCount || 0);
}

function ensureSelectedUser(rows = state.users.rows || []) {
  const list = Array.isArray(rows) ? rows : [];
  const exists = list.some((item) => item.id === state.users.selectedId);
  if (!exists) state.users.selectedId = list[0]?.id || '';
  return list.find((item) => item.id === state.users.selectedId) || list[0] || null;
}

function renderOverviewView() {
  const totals = totalsSummary();
  const connectorTotals = connectorTotalsSummary();
  const alerts = getAlerts();
  const incidents = getIncidents();
  const reports = getReports();

  return `
    <section class="hero-card">
      <div class="hero-block">
        <div class="eyebrow">Centro operativo</div>
        <h2 style="font-size:36px; line-height:1.05; letter-spacing:-0.04em;">Una sola app para ver red, alertas, ubicaciones y reportes sin saltar entre páginas.</h2>
        <p class="section-copy" style="margin:0; max-width:720px; line-height:1.7;">
          Estado general de la red EVINKA con snapshot consolidado, métricas clave y acceso corporativo por dispositivo confiable.
        </p>
        <div class="hero-grid">
          <div class="stat-box"><div class="stat-label">Operador</div><div class="stat-value" style="font-size:22px; line-height:1.2;">${escapeHtml(state.data?.operator || 'Sin dato')}</div></div>
          <div class="stat-box"><div class="stat-label">Refresh</div><div class="stat-value">${escapeHtml(String(state.data?.refreshSeconds || 0))}<span style="font-size:18px; color:var(--muted);">s</span></div></div>
          <div class="stat-box"><div class="stat-label">Estado</div><div class="stat-value" style="font-size:24px;">${escapeHtml(state.data?.status || 'Sin dato')}</div></div>
          <div class="stat-box"><div class="stat-label">Alertas pendientes</div><div class="stat-value">${alerts.length}</div></div>
        </div>
      </div>
      <div class="panel" style="padding:18px; border-radius:20px; background:rgba(255,255,255,0.03);">
        <div class="section-title">Lectura rápida</div>
        <div class="card-stack">
          <div class="list-card"><div class="info-kicker">Salud operativa</div><div style="font-size:28px; margin:8px 0; font-weight:800;">${incidents.length ? `${incidents.length} con incidencia` : 'Red estable'}</div>${chip(incidents.length ? 'offline' : 'available', incidents.length ? 'Revisar' : 'Disponible')}</div>
          <div class="list-card"><div class="info-kicker">Mapa geolocalizado</div><div style="font-size:28px; margin:8px 0; font-weight:800;">${mappedStations().length}</div><div class="helper">estaciones con coordenadas listas para visualizar</div></div>
          <div class="list-card"><div class="info-kicker">Reportes listos</div><div style="font-size:28px; margin:8px 0; font-weight:800;">${reports.length}</div><div class="helper">cortes consolidados desde el snapshot</div></div>
        </div>
      </div>
    </section>

    <section class="metrics-grid">
      ${renderMetricCard('Estaciones', totals.stations, 'ver toda la red', '', 'all')}
      ${renderMetricCard('Conectores', connectorTotals.total, 'conteo estilo EVINKA Connect', '', 'all')}
      ${renderMetricCard('Disponibles', connectorTotals.available, 'conectores disponibles', 'available', 'available')}
      ${renderMetricCard('Offline', connectorTotals.offline, 'conectores offline', 'offline', 'offline')}
      ${renderMetricCard('Preparing', connectorTotals.preparing, 'conectores preparing', 'preparing', 'preparing')}
      ${renderMetricCard('Charging', connectorTotals.charging, 'conectores charging', 'charging', 'charging')}
    </section>

    <section class="donut-grid">
      ${renderStatusDonutPanel('Estados por estaciones', 'Lectura consolidada por cargador.', totals, totals.stations)}
      ${renderStatusDonutPanel('Estados por conectores', 'Vista visual alineada con EVINKA Connect.', connectorTotals, connectorTotals.total)}
    </section>

    <section class="status-strip panel">
      <div><span>Último snapshot</span><strong>${escapeHtml(formatDateTime(state.data?.generatedAt))}</strong></div>
      <div><span>Operador</span><strong>${escapeHtml(state.data?.operator || 'Sin dato')}</strong></div>
      <div><span>Acceso</span><strong>Correo + contraseña</strong></div>
      <div><span>Dominio</span><strong>@evinka.tech</strong></div>
    </section>

    <section class="overview-grid">
      <article class="panel">
        <div class="section-head">
          <div>
            <div class="section-title">Alertas activas</div>
            <p class="section-copy">Vista resumida para priorizar respuesta operativa.</p>
          </div>
          <span class="badge">${alerts.length}</span>
        </div>
        <div class="alert-grid">
          ${alerts.slice(0, 4).map(renderAlertCard).join('') || '<div class="empty-state">No hay alertas activas.</div>'}
        </div>
      </article>
      <article class="panel">
        <div class="section-head">
          <div>
            <div class="section-title">Incidencias</div>
            <p class="section-copy">Equipos con heartbeat atrasado o sin comunicación.</p>
          </div>
          <span class="badge">${incidents.length}</span>
        </div>
        ${incidents.length ? incidents.map(renderIncidentCard).join('') : '<div class="empty-state">No hay estaciones caídas en este snapshot.</div>'}
      </article>
    </section>
  `;
}

function renderMetricCard(label, value, hint, tone, filter = 'all') {
  return `
    <button type="button" class="metric-card metric-button ${tone}" data-metric-filter="${escapeHtml(filter)}">
      <div class="small">${escapeHtml(label)}</div>
      <div class="metric-value">${escapeHtml(String(value ?? 0))}</div>
      <div class="metric-subtitle">${escapeHtml(hint)}</div>
    </button>
  `;
}

function renderAuditView() {
  if (!isAdminRole()) {
    return `<section class="panel"><div class="section-title">Auditoría</div><div class="empty-state">Este módulo es solo para administradores.</div></section>`;
  }

  const totalRows = Array.isArray(state.audit.rows) ? state.audit.rows : [];
  const rows = filteredAuditRows(totalRows);
  const selected = ensureSelectedAuditEvent(totalRows);
  const summary = state.audit.summary || { total: totalRows.length, prototypes: [] };
  const isInitialLoading = state.audit.loading && !totalRows.length;

  if (isInitialLoading) {
    return `
      <section class="panel">
        <div class="section-head">
          <div>
            <div class="section-title">Auditoría ejecutiva</div>
            <p class="section-copy">Estoy consolidando actividad de Status, chatbot, cotizador y conformidad.</p>
          </div>
          <span class="badge">…</span>
        </div>
        <div class="empty-state">Cargando auditoría…</div>
      </section>
    `;
  }

  const prototypeCounts = new Map((summary.prototypes || []).map((item) => [item.key, item.count]));

  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <div class="section-title">Auditoría ejecutiva</div>
          <p class="section-copy">Mensajes simples por prototipo para revisar qué pasó y abrir el detalle completo de cada evento.</p>
        </div>
        <span class="badge">${escapeHtml(String(summary.total || totalRows.length))}</span>
      </div>

      <div class="users-summary-grid audit-summary-grid">
        <div class="stat-box"><div class="stat-label">Eventos totales</div><div class="stat-value">${escapeHtml(String(summary.total || totalRows.length))}</div></div>
        <div class="stat-box"><div class="stat-label">Mostrando</div><div class="stat-value">${escapeHtml(String(rows.length))}</div></div>
        <div class="stat-box"><div class="stat-label">Último evento</div><div class="stat-value audit-stat-value">${escapeHtml(formatDateTime(summary.lastEventAt || totalRows[0]?.at))}</div></div>
        <div class="stat-box"><div class="stat-label">Actualizado</div><div class="stat-value audit-stat-value">${escapeHtml(formatDateTime(state.audit.generatedAt))}</div></div>
      </div>

      <div class="toolbar users-toolbar audit-toolbar">
        <div class="filter-chip-row audit-chip-row">
          ${auditPrototypeCatalog().map((item) => `
            <button type="button" class="tab-btn ${state.audit.prototype === item.key ? 'active' : ''}" data-audit-prototype="${escapeHtml(item.key)}">
              ${escapeHtml(item.label)}${item.key === 'all' ? ` (${escapeHtml(String(summary.total || totalRows.length))})` : ` (${escapeHtml(String(prototypeCounts.get(item.key) || 0))})`}
            </button>
          `).join('')}
        </div>
        <div class="notification-actions" style="margin:0;">
          <div class="info-pill"><span class="small">Filtro</span><strong>${escapeHtml(auditPrototypeLabel(state.audit.prototype))}</strong></div>
          <button class="btn-ghost" id="auditRefreshBtn" type="button" ${state.audit.loading ? 'disabled' : ''}>${state.audit.loading ? 'Actualizando…' : 'Refrescar auditoría'}</button>
        </div>
      </div>

      ${state.audit.error ? `<div class="notification-feedback error" style="margin-bottom:16px;">${escapeHtml(state.audit.error)}</div>` : ''}

      <div class="audit-layout">
        <div class="panel audit-list-panel">
          <div class="section-head" style="margin-bottom:12px;">
            <div>
              <div class="section-title">Actividad</div>
              <p class="section-copy">Cada fila es clickeable y abre el detalle al costado.</p>
            </div>
            <span class="badge">${escapeHtml(String(rows.length))}</span>
          </div>
          <div class="audit-list-scroll">
            ${rows.map((item) => `
              <button type="button" class="audit-row-button ${item.id === selected?.id ? 'active' : ''}" data-audit-select="${escapeHtml(item.id)}">
                <div class="audit-row-top">
                  <span class="mini-chip neutral">${escapeHtml(item.prototypeLabel || auditPrototypeLabel(item.prototype))}</span>
                  <span class="small">${escapeHtml(timeAgo(item.at))}</span>
                </div>
                <strong>${escapeHtml(item.message || 'Evento')}</strong>
                <div class="table-muted">${escapeHtml(formatDateTime(item.at))}</div>
              </button>
            `).join('') || '<div class="empty-state">Aún no hay eventos para este prototipo.</div>'}
          </div>
        </div>

        <div class="panel audit-detail-panel">
          ${selected ? `
            <div class="section-head">
              <div>
                <div class="section-title">${escapeHtml(selected.message || 'Detalle de auditoría')}</div>
                <p class="section-copy">${escapeHtml(selected.prototypeLabel || auditPrototypeLabel(selected.prototype))} · ${escapeHtml(formatDateTime(selected.at))}</p>
              </div>
              <span class="badge">${escapeHtml(formatAuditStatus(selected.status))}</span>
            </div>

            <div class="audit-detail-grid">
              <div class="stat-box"><div class="stat-label">Prototipo</div><div class="stat-value audit-detail-value">${escapeHtml(selected.prototypeLabel || auditPrototypeLabel(selected.prototype))}</div></div>
              <div class="stat-box"><div class="stat-label">Actor</div><div class="stat-value audit-detail-value">${escapeHtml(selected.actorName || 'Sistema EVINKA')}</div></div>
              <div class="stat-box"><div class="stat-label">Cliente / destino</div><div class="stat-value audit-detail-value">${escapeHtml(selected.targetName || selected.detail?.clientName || selected.detail?.target || 'Sin dato')}</div></div>
              <div class="stat-box"><div class="stat-label">Fecha</div><div class="stat-value audit-detail-value">${escapeHtml(formatDateTime(selected.at))}</div></div>
            </div>

            <div class="audit-kv-grid">
              ${selected.detail?.quoteId ? `<div class="audit-kv"><span>Quote</span><strong>${escapeHtml(selected.detail.quoteId)}</strong></div>` : ''}
              ${selected.detail?.installationOrderId ? `<div class="audit-kv"><span>Orden</span><strong>${escapeHtml(selected.detail.installationOrderId)}</strong></div>` : ''}
              ${selected.detail?.conformityId ? `<div class="audit-kv"><span>Conformidad</span><strong>${escapeHtml(selected.detail.conformityId)}</strong></div>` : ''}
              ${selected.detail?.visitId ? `<div class="audit-kv"><span>Visita</span><strong>${escapeHtml(selected.detail.visitId)}</strong></div>` : ''}
              ${selected.detail?.ticket ? `<div class="audit-kv"><span>Ticket</span><strong>${escapeHtml(selected.detail.ticket)}</strong></div>` : ''}
              ${selected.detail?.total != null ? `<div class="audit-kv"><span>Monto</span><strong>${escapeHtml(formatMoney(selected.detail.total))}</strong></div>` : ''}
              ${selected.detail?.status ? `<div class="audit-kv"><span>Estado</span><strong>${escapeHtml(formatAuditStatus(selected.detail.status))}</strong></div>` : ''}
              ${selected.detail?.scheduledAt ? `<div class="audit-kv"><span>Programado</span><strong>${escapeHtml(formatDateTime(selected.detail.scheduledAt))}</strong></div>` : ''}
              ${selected.detail?.address ? `<div class="audit-kv"><span>Dirección</span><strong>${escapeHtml(selected.detail.address)}</strong></div>` : ''}
              ${selected.detail?.clientEmail ? `<div class="audit-kv"><span>Correo</span><strong>${escapeHtml(selected.detail.clientEmail)}</strong></div>` : ''}
            </div>

            ${Array.isArray(selected.detail?.items) && selected.detail.items.length ? `
              <div class="audit-block">
                <div class="section-title">Items</div>
                <div class="audit-mini-list">
                  ${selected.detail.items.map((item) => `<div class="audit-mini-row"><span>${escapeHtml(item.label || 'Item')}</span><strong>${escapeHtml(String(item.qty || 0))} · ${escapeHtml(formatMoney(item.total || 0))}</strong></div>`).join('')}
                </div>
              </div>
            ` : ''}

            ${Array.isArray(selected.detail?.deliveredItems) && selected.detail.deliveredItems.length ? `
              <div class="audit-block">
                <div class="section-title">Entregado</div>
                <div class="audit-tag-row">
                  ${selected.detail.deliveredItems.map((item) => `<span class="mini-chip neutral">${escapeHtml(item)}</span>`).join('')}
                </div>
              </div>
            ` : ''}

            ${(selected.detail?.technicianNotes || selected.detail?.notes || selected.detail?.observations) ? `
              <div class="audit-block">
                <div class="section-title">Detalle</div>
                <div class="empty-state" style="text-align:left;">${escapeHtml(selected.detail.technicianNotes || selected.detail.notes || selected.detail.observations)}</div>
              </div>
            ` : ''}

            ${selected.detail?.quotePdfUrl || selected.detail?.pdfUrl ? `
              <div class="audit-block">
                <div class="section-title">Archivo</div>
                <div class="audit-kv"><span>PDF</span><strong>${escapeHtml(selected.detail.quotePdfUrl || selected.detail.pdfUrl)}</strong></div>
              </div>
            ` : ''}
          ` : '<div class="empty-state">Selecciona un evento para ver el detalle completo.</div>'}
        </div>
      </div>
    </section>
  `;
}

function renderUsersView() {
  const rows = filteredUsersRows();
  const totalRows = state.users.rows || [];
  const isInitialLoading = state.users.loading && !totalRows.length;
  if (isInitialLoading) {
    return `
      <section class="panel">
        <div class="section-head">
          <div>
            <div class="section-title">Usuarios EVINKA</div>
            <p class="section-copy">Estoy cargando Connect, cotizador y chatbot con su uso detectado.</p>
          </div>
          <span class="badge">…</span>
        </div>
        <div class="empty-state">Cargando usuarios…</div>
      </section>
    `;
  }
  const withEmail = totalRows.filter((item) => item.email).length;
  const withPhone = totalRows.filter((item) => item.phone).length;
  const withUsage = totalRows.filter((item) => userActivityScore(item) > 0).length;
  const leads = totalRows.filter((item) => userMarketingSegment(item) === 'lead').length;
  const active = totalRows.filter((item) => userMarketingSegment(item) === 'active').length;
  const dormant = totalRows.filter((item) => userMarketingSegment(item) === 'dormant').length;
  const selected = rows.find((item) => item.id === state.users.selectedId) || rows[0] || ensureSelectedUser(totalRows);
  const usage = selected?.usage || {};
  const listRows = rows
    .slice()
    .sort((a, b) => userActivityScore(b) - userActivityScore(a) || (a.fullName || a.email || '').localeCompare((b.fullName || b.email || ''), 'es'));
  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <div class="section-title">Usuarios EVINKA</div>
          <p class="section-copy">Vista pensada para marketing: une contactos de Connect, cotizador y chatbot para revisar ficha, contacto y uso detectado.</p>
        </div>
        <span class="badge">${totalRows.length}</span>
      </div>

      <div class="users-summary-grid">
        <div class="stat-box"><div class="stat-label">Usuarios totales</div><div class="stat-value">${escapeHtml(String(totalRows.length))}</div></div>
        <div class="stat-box"><div class="stat-label">Leads</div><div class="stat-value">${escapeHtml(String(leads))}</div></div>
        <div class="stat-box"><div class="stat-label">Clientes activos</div><div class="stat-value">${escapeHtml(String(active))}</div></div>
        <div class="stat-box"><div class="stat-label">Clientes dormidos</div><div class="stat-value">${escapeHtml(String(dormant))}</div></div>
      </div>

      <div class="toolbar users-toolbar">
        <div class="search-row" style="flex:1 1 420px;">
          <input class="input" id="usersSearch" type="search" placeholder="Buscar por nombre, correo, teléfono o documento" value="${escapeHtml(state.users.query || '')}" style="flex:1 1 320px; min-width:260px;" />
        </div>
        <div class="notification-actions" style="margin:0;">
          <div class="info-pill"><span class="small">Última sincronización</span><strong>${escapeHtml(formatDateTime(state.users.lastSyncAt))}</strong></div>
          <button class="btn-ghost" id="usersExportBtn" type="button" ${state.users.loading || state.users.exporting ? 'disabled' : ''}>${state.users.exporting ? 'Exportando…' : 'Exportar Excel marketing'}</button>
          <button class="btn-ghost" id="usersRefreshBtn" type="button" ${state.users.loading ? 'disabled' : ''}>${state.users.loading ? 'Actualizando…' : 'Refrescar usuarios'}</button>
        </div>
      </div>

      <div class="filter-chip-row users-segment-row">
        ${[
          ['all', `Todos (${totalRows.length})`],
          ['lead', `Leads (${leads})`],
          ['active', `Activos (${active})`],
          ['dormant', `Dormidos (${dormant})`],
          ['with-email', `Con correo (${withEmail})`],
          ['with-phone', `Con teléfono (${withPhone})`],
        ].map(([value, label]) => `<button type="button" class="tab-btn ${state.users.segment === value ? 'active' : ''}" data-user-segment="${escapeHtml(value)}">${escapeHtml(label)}</button>`).join('')}
      </div>

      ${(state.users.sourceExport || state.users.sourceSummary) ? `
        <div class="status-strip" style="margin-bottom:16px;">
          <div><span>Export Connect</span><strong>${escapeHtml(state.users.sourceExport?.id || 'Sin dato')}</strong></div>
          <div><span>Connect</span><strong>${escapeHtml(String(state.users.sourceSummary?.connect || 0))}</strong></div>
          <div><span>Cotizador</span><strong>${escapeHtml(String(state.users.sourceSummary?.cotizador || 0))}</strong></div>
          <div><span>Chatbot</span><strong>${escapeHtml(String(state.users.sourceSummary?.chatbot || 0))}</strong></div>
          <div><span>Con uso detectado</span><strong>${escapeHtml(String(withUsage))}</strong></div>
        </div>
      ` : ''}

      ${state.users.usageSources ? `
        <div class="status-strip" style="margin-bottom:16px;">
          <div><span>Uso transacciones</span><strong>${state.users.usageSources.transaction ? `${escapeHtml(formatDateTime(state.users.usageSources.transaction.startTime))} → ${escapeHtml(formatDateTime(state.users.usageSources.transaction.endTime))}` : 'Sin export'}</strong></div>
          <div><span>Uso recargas</span><strong>${state.users.usageSources.recharge ? `${escapeHtml(formatDateTime(state.users.usageSources.recharge.startTime))} → ${escapeHtml(formatDateTime(state.users.usageSources.recharge.endTime))}` : 'Sin export'}</strong></div>
          <div><span>Resultados filtro</span><strong>${escapeHtml(String(rows.length))}</strong></div>
        </div>
      ` : ''}

      ${state.users.error ? `<div class="notification-feedback error" style="margin-bottom:16px;">${escapeHtml(state.users.error)}</div>` : ''}

      <div class="users-layout">
        <div class="panel users-list-panel">
          <div class="section-head" style="margin-bottom:12px;">
            <div>
              <div class="section-title">Ficha por usuario</div>
              <p class="section-copy">Selecciona a quién quieres revisar. Ordeno primero a quienes sí tienen uso.</p>
            </div>
            <span class="badge">${escapeHtml(String(rows.length))}</span>
          </div>
          <div class="users-list-scroll">
            ${listRows.map((row) => `
              <button type="button" class="user-card-button ${row.id === selected?.id ? 'active' : ''}" data-user-select="${escapeHtml(row.id)}">
                <div>
                  <strong>${escapeHtml(row.fullName || row.email || row.phone || 'Sin nombre')}</strong>
                  <div class="table-muted">${escapeHtml(row.email || row.phone || row.identity || 'Sin dato de contacto')}</div>
                  <div class="table-muted">Origen: ${escapeHtml((row.sourceLabels || []).join(' · ') || 'Sin origen')}</div>
                </div>
                <div class="user-card-meta">
                  <span class="mini-chip ${userMarketingSegment(row) === 'active' ? 'available' : userMarketingSegment(row) === 'dormant' ? 'offline' : 'neutral'}">${escapeHtml(userMarketingLabel(row))}</span>
                  <span class="small">${escapeHtml(String(userActivityScore(row)))} mov.</span>
                </div>
              </button>
            `).join('') || '<div class="empty-state">No encontré usuarios para ese filtro.</div>'}
          </div>
        </div>

        <div class="panel users-detail-panel">
          ${selected ? `
            <div class="section-head">
              <div>
                <div class="section-title">${escapeHtml(selected.fullName || 'Sin nombre')}</div>
                <p class="section-copy">Ficha comercial y de uso lista para marketing.</p>
              </div>
              <span class="badge">${escapeHtml(userMarketingLabel(selected))}</span>
            </div>

            <div class="users-detail-grid">
              <div class="stat-box"><div class="stat-label">Correo</div><div class="stat-value users-detail-value">${escapeHtml(selected.email || 'Sin correo')}</div></div>
              <div class="stat-box"><div class="stat-label">Teléfono</div><div class="stat-value users-detail-value">${escapeHtml(selected.phone || 'Sin teléfono')}</div></div>
              <div class="stat-box"><div class="stat-label">Documento</div><div class="stat-value users-detail-value">${escapeHtml(selected.identity || 'Sin documento')}</div></div>
              <div class="stat-box"><div class="stat-label">Registro</div><div class="stat-value users-detail-value">${escapeHtml(formatDateTime(selected.createdAt))}</div></div>
              <div class="stat-box"><div class="stat-label">Origen</div><div class="stat-value users-detail-value">${escapeHtml((selected.sourceLabels || []).join(' · ') || 'Sin origen')}</div></div>
              <div class="stat-box"><div class="stat-label">País</div><div class="stat-value users-detail-value">${escapeHtml(selected.countryCode || 'Sin dato')}</div></div>
            </div>

            <div class="users-usage-grid">
              <div class="stat-box"><div class="stat-label">Sesiones de carga</div><div class="stat-value">${escapeHtml(formatCompactNumber(usage.transactions || 0))}</div></div>
              <div class="stat-box"><div class="stat-label">Energía total</div><div class="stat-value">${escapeHtml(formatDecimal(usage.totalEnergy || 0))}<span class="small"> kWh</span></div></div>
              <div class="stat-box"><div class="stat-label">Gasto total</div><div class="stat-value users-detail-value">${escapeHtml(formatCurrency(usage.totalSpent || 0))}</div></div>
              <div class="stat-box"><div class="stat-label">Recargas</div><div class="stat-value">${escapeHtml(formatCompactNumber(usage.rechargeCount || 0))}</div></div>
              <div class="stat-box"><div class="stat-label">Monto recargado</div><div class="stat-value users-detail-value">${escapeHtml(formatCurrency(usage.totalRecharge || 0))}</div></div>
              <div class="stat-box"><div class="stat-label">Plazas usadas</div><div class="stat-value">${escapeHtml(formatCompactNumber(usage.plazasUsed || 0))}</div></div>
            </div>

            <div class="status-strip" style="margin-top:16px;">
              <div><span>Última actividad</span><strong>${escapeHtml(formatDateTime(usage.lastActivityAt))}</strong></div>
              <div><span>Última plaza</span><strong>${escapeHtml(usage.lastPlaza || 'Sin dato')}</strong></div>
              <div><span>Última estación</span><strong>${escapeHtml(usage.lastStation || 'Sin dato')}</strong></div>
              <div><span>Saldo detectado</span><strong>${usage.currentBalance == null ? 'Sin dato' : escapeHtml(formatCurrency(usage.currentBalance))}</strong></div>
            </div>
          ` : '<div class="empty-state">Selecciona un usuario para ver su ficha y uso.</div>'}
        </div>
      </div>
    </section>
  `;
}

function filteredAdminUsersRows() {
  const query = searchNormalized(state.adminUsers.query || '');
  const rows = Array.isArray(state.adminUsers.rows) ? state.adminUsers.rows : [];
  return rows.filter((row) => {
    const queryOk = !query || [row.email, row.role, ...(Array.isArray(row.otpEmails) ? row.otpEmails : [])].some((value) => searchNormalized(value).includes(query));
    const filter = state.adminUsers.filter || 'all';
    const filterOk = filter === 'all'
      || (filter === 'pending' && row.accessEnabled === false)
      || (filter === 'active' && row.accessEnabled !== false)
      || (filter === 'admin' && row.role === 'admin');
    return queryOk && filterOk;
  });
}

function renderAccountsView() {
  if (!isAdminRole()) {
    return `<section class="panel"><div class="section-title">Cuentas</div><div class="empty-state">Este módulo es solo para administradores.</div></section>`;
  }
  const rows = filteredAdminUsersRows().slice().sort((a, b) => {
    if (a.accessEnabled !== b.accessEnabled) return a.accessEnabled ? 1 : -1;
    return String(a.email || '').localeCompare(String(b.email || ''), 'es');
  });
  const total = state.adminUsers.rows.length;
  const pending = state.adminUsers.rows.filter((item) => item.accessEnabled === false).length;
  const admins = state.adminUsers.rows.filter((item) => item.role === 'admin').length;
  const active = total - pending;
  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <div class="section-title">Cuentas y accesos</div>
          <p class="section-copy">Panel de control para aprobar accesos, asignar roles y mantener las cuentas corporativas ordenadas.</p>
        </div>
        <span class="badge">${escapeHtml(String(total))}</span>
      </div>

      <div class="users-summary-grid">
        <div class="stat-box"><div class="stat-label">Total cuentas</div><div class="stat-value">${escapeHtml(String(total))}</div></div>
        <div class="stat-box"><div class="stat-label">Pendientes</div><div class="stat-value">${escapeHtml(String(pending))}</div></div>
        <div class="stat-box"><div class="stat-label">Admins</div><div class="stat-value">${escapeHtml(String(admins))}</div></div>
        <div class="stat-box"><div class="stat-label">Activas</div><div class="stat-value">${escapeHtml(String(active))}</div></div>
      </div>

      <div class="panel accounts-create-panel" style="padding:18px; margin-bottom:16px; background:rgba(255,255,255,0.02);">
        <div class="section-head" style="margin-bottom:12px;">
          <div>
            <div class="section-title">Crear cuenta</div>
            <p class="section-copy">Alta rápida para nuevas cuentas. Si dejas la contraseña vacía, el sistema genera una temporal segura.</p>
          </div>
        </div>
        <div class="accounts-create-grid">
          <label class="field-stack">
            <span class="small">Correo corporativo</span>
            <input class="input" id="adminCreateEmail" type="email" placeholder="correo@evinka.tech" value="${escapeHtml(state.adminUsers.create.email || '')}" />
          </label>
          <label class="field-stack">
            <span class="small">Rol inicial</span>
            <select class="select" id="adminCreateRole">
              ${['user', 'marketing', 'operations', 'finance', 'admin'].map((role) => `<option value="${role}" ${state.adminUsers.create.role === role ? 'selected' : ''}>${escapeHtml(roleLabel(role))}</option>`).join('')}
            </select>
          </label>
          <label class="field-stack">
            <span class="small">Correos OTP</span>
            <input class="input" id="adminCreateOtpEmails" type="text" placeholder="ejemplo@evinka.tech, soporte@evinka.tech" value="${escapeHtml(state.adminUsers.create.otpEmails || '')}" />
          </label>
          <label class="field-stack">
            <span class="small">Contraseña temporal</span>
            <input class="input" id="adminCreatePassword" type="text" placeholder="Opcional" value="${escapeHtml(state.adminUsers.create.password || '')}" />
          </label>
        </div>
        <div class="accounts-create-actions">
          <button class="btn" id="adminCreateUserBtn" type="button" ${state.adminUsers.saving ? 'disabled' : ''}>${state.adminUsers.saving ? 'Guardando…' : 'Crear cuenta'}</button>
        </div>
      </div>

      <div class="toolbar">
        <div class="search-row" style="flex:1 1 420px;">
          <input class="input" id="adminUsersSearch" type="search" placeholder="Buscar por correo, rol o OTP" value="${escapeHtml(state.adminUsers.query || '')}" style="flex:1 1 320px; min-width:260px;" />
        </div>
        <button class="btn-ghost" id="adminUsersRefreshBtn" type="button" ${state.adminUsers.loading ? 'disabled' : ''}>${state.adminUsers.loading ? 'Actualizando…' : 'Refrescar cuentas'}</button>
      </div>

      <div class="filter-chip-row users-segment-row">
        ${[
          ['all', `Todas (${total})`],
          ['pending', `Pendientes (${pending})`],
          ['active', `Con acceso (${active})`],
          ['admin', `Admins (${admins})`],
        ].map(([value, label]) => `<button type="button" class="tab-btn ${state.adminUsers.filter === value ? 'active' : ''}" data-admin-filter="${escapeHtml(value)}">${escapeHtml(label)}</button>`).join('')}
      </div>

      ${state.adminUsers.notice ? `<div class="notification-feedback success" style="margin-bottom:12px;">${escapeHtml(state.adminUsers.notice)}</div>` : ''}
      ${state.adminUsers.error ? `<div class="notification-feedback error" style="margin-bottom:12px;">${escapeHtml(state.adminUsers.error)}</div>` : ''}

      <div class="users-list-scroll" style="max-height:none;">
        ${rows.map((row) => `
          <div class="panel accounts-card ${row.accessEnabled ? '' : 'pending'}" style="padding:16px; background:rgba(255,255,255,0.02); box-shadow:none;">
            <div class="section-head" style="margin-bottom:10px; gap:12px;">
              <div style="min-width:0; flex:1 1 auto;">
                <div class="section-title" style="font-size:18px;">${escapeHtml(row.email || '')}</div>
                <div class="table-muted">OTP: ${escapeHtml((row.otpEmails || []).join(', ') || 'Sin correos OTP')}</div>
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
                <span class="mini-chip ${row.accessEnabled ? 'available' : 'offline'}">${row.accessEnabled ? 'Con acceso' : 'Pendiente de aprobación'}</span>
                <span class="mini-chip neutral">${escapeHtml(roleLabel(row.role))}</span>
              </div>
            </div>
            <div class="users-detail-grid" style="margin-top:0; margin-bottom:12px;">
              <div class="stat-box"><div class="stat-label">Creada</div><div class="users-detail-value">${escapeHtml(formatDateTime(row.createdAt))}</div></div>
              <div class="stat-box"><div class="stat-label">Verificada</div><div class="users-detail-value">${escapeHtml(formatDateTime(row.verifiedAt))}</div></div>
              <div class="stat-box"><div class="stat-label">Sesiones activas</div><div class="users-detail-value">${escapeHtml(String(row.activeSessions || 0))}</div></div>
              <div class="stat-box"><div class="stat-label">Dispositivos</div><div class="users-detail-value">${escapeHtml(String(row.trustedDevices || 0))}</div></div>
            </div>
            <div class="accounts-edit-grid">
              <label class="field-stack">
                <span class="small">Rol</span>
                <select class="select" data-admin-role-email="${escapeHtml(row.email)}">
                  ${['user', 'marketing', 'operations', 'finance', 'admin'].map((role) => `<option value="${role}" ${row.role === role ? 'selected' : ''}>${escapeHtml(roleLabel(role))}</option>`).join('')}
                </select>
              </label>
              <label class="field-stack" style="grid-column: span 2;">
                <span class="small">Correos OTP</span>
                <input class="input" data-admin-otp-email="${escapeHtml(row.email)}" type="text" value="${escapeHtml((row.otpEmails || []).join(', '))}" placeholder="Correos OTP" />
              </label>
            </div>
            <div class="accounts-actions">
              <button class="btn" type="button" data-admin-toggle-access="${escapeHtml(row.email)}" data-admin-current-access="${row.accessEnabled ? 'true' : 'false'}" ${state.adminUsers.saving ? 'disabled' : ''}>${row.accessEnabled ? 'Retirar acceso' : 'Aprobar acceso'}</button>
              <button class="btn-ghost" type="button" data-admin-save-user="${escapeHtml(row.email)}" ${state.adminUsers.saving ? 'disabled' : ''}>Guardar cambios</button>
              <button class="btn-ghost" type="button" data-admin-revoke-sessions="${escapeHtml(row.email)}" ${state.adminUsers.saving ? 'disabled' : ''}>Cerrar sesiones</button>
              <button class="btn-danger" type="button" data-admin-reset-password="${escapeHtml(row.email)}" ${state.adminUsers.saving ? 'disabled' : ''}>Resetear contraseña</button>
            </div>
          </div>
        `).join('') || '<div class="empty-state">No encontré cuentas para ese filtro.</div>'}
      </div>
    </section>
  `;
}

function renderLocationsView() {
  const plazas = getLocations();
  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <div class="section-title">Ubicaciones EVINKA</div>
          <p class="section-copy">Todas las plazas y comercios dentro de la misma aplicación.</p>
        </div>
        <span class="badge">${plazas.length}</span>
      </div>
      <div class="location-grid">
        ${plazas.map((plaza) => {
          const plazaStations = getStations().filter((station) => (station.plazaName || '').trim() === (plaza.name || '').trim());
          const plazaTotals = connectorTotalsFromStations(plazaStations);
          const plazaTone = plazaStations.some((station) => effectiveStationTone(station) === 'faulted') ? 'faulted'
            : plazaStations.some((station) => effectiveStationTone(station) === 'charging') ? 'charging'
            : plazaStations.some((station) => effectiveStationTone(station) === 'preparing') ? 'preparing'
            : plazaStations.every((station) => effectiveStationTone(station) === 'offline') && plazaStations.length ? 'offline'
            : plazaStations.some((station) => effectiveStationTone(station) === 'available') ? 'available'
            : 'available';
          return `
          <article class="location-card">
            <div class="location-image ${plaza.imageUrl ? '' : 'empty'}"${plaza.imageUrl ? ` style="background-image:url('${escapeHtml(plaza.imageUrl)}')"` : ''}></div>
            <div>
              <div class="info-pill">${escapeHtml(plaza.merchantName || plaza.merchantId || 'EVINKA')}</div>
              <h3 style="margin-top:12px; font-size:22px;">${escapeHtml(plaza.name || 'Ubicación')}</h3>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              ${chip(plazaTone, toneLabel(plazaTone))}
              ${plazaTotals.total ? `<span class="badge">${escapeHtml(String(plazaTotals.available))} disp · ${escapeHtml(String(plazaTotals.offline))} off · ${escapeHtml(String(plazaTotals.preparing))} prep · ${escapeHtml(String(plazaTotals.charging))} chg</span>` : '<span class="badge">Sin cargadores</span>'}
            </div>
            <div class="location-meta">
              <div>${escapeHtml(plaza.address || 'Sin dirección')}</div>
              <div>Lat ${escapeHtml(String(plaza.latitude ?? '—'))} · Lng ${escapeHtml(String(plaza.longitude ?? '—'))}</div>
            </div>
          </article>
        `;}).join('')}
      </div>
    </section>
  `;
}

function filteredStations() {
  const query = state.filters.stationQuery.trim().toLowerCase();
  const tone = state.filters.stationTone;
  return getStations().filter((station) => {
    const text = [station.name, station.id, station.plazaName, station.address, station.merchantName].join(' ').toLowerCase();
    const connectorTones = effectiveConnectorsForEvinka(station).map((connector) => connector.effectiveTone);
    const toneOk = tone === 'all' || effectiveStationTone(station) === tone || connectorTones.includes(tone);
    const queryOk = !query || text.includes(query);
    return toneOk && queryOk;
  });
}

function renderIncidentsView() {
  const incidents = getIncidents();
  const stations = filteredStations();
  const alerts = getAlerts();

  return `
    <section class="dual-grid">
      <article class="panel">
        <div class="section-head">
          <div>
            <div class="section-title">Estaciones caídas</div>
            <p class="section-copy">Equipos sin comunicación o con heartbeat atrasado.</p>
          </div>
          <span class="badge">${incidents.length}</span>
        </div>
        ${incidents.length ? incidents.map(renderIncidentCard).join('') : '<div class="empty-state">No hay estaciones caídas en este snapshot.</div>'}
      </article>
      <article class="panel">
        <div class="section-head">
          <div>
            <div class="section-title">Alertas específicas</div>
            <p class="section-copy">Alarmas activas agrupadas por estación.</p>
          </div>
          <span class="badge">${alerts.length}</span>
        </div>
        <div class="alert-grid">
          ${alerts.map(renderAlertCard).join('') || '<div class="empty-state">No hay alertas activas.</div>'}
        </div>
      </article>
    </section>

    <section class="table-card">
      <div class="toolbar">
        <div>
          <div class="section-title">Cargadores y conectores</div>
          <div class="section-copy">Vista operativa detallada dentro de la misma app.</div>
          ${state.filters.stationTone !== 'all' ? `<div class="filter-chip-row"><span class="status-chip ${state.filters.stationTone === 'available' ? 'available' : state.filters.stationTone === 'offline' ? 'offline' : state.filters.stationTone === 'preparing' ? 'preparing' : state.filters.stationTone === 'charging' ? 'charging' : 'faulted'}">Filtrando: ${escapeHtml(toneLabel(state.filters.stationTone))}</span><button type="button" class="btn-ghost btn-inline" id="clearStationFilterBtn">Ver todo</button></div>` : ''}
        </div>
        <div class="search-row">
          <input class="input" id="stationQuery" type="search" placeholder="Buscar estación, plaza o merchant" value="${escapeHtml(state.filters.stationQuery)}" />
          <select class="select" id="stationTone">
            ${[
              ['all', 'Todos los estados'],
              ['available', 'Disponible'],
              ['offline', 'Offline'],
              ['preparing', 'Preparing'],
              ['charging', 'Charging'],
              ['faulted', 'Faulted'],
            ].map(([value, label]) => `<option value="${value}" ${state.filters.stationTone === value ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Estación</th>
              <th>Ubicación</th>
              <th>Equipo</th>
              <th>Heartbeat</th>
              <th>Boot</th>
              <th>Conectores</th>
            </tr>
          </thead>
          <tbody>
            ${stations.map(renderStationRow).join('') || '<tr><td colspan="6"><div class="empty-state">No encontré estaciones con ese filtro.</div></td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderStationRow(station) {
  const stationTone = effectiveStationTone(station);
  const connectors = effectiveConnectorsForEvinka(station).length
    ? effectiveConnectorsForEvinka(station).map((connector) => `${chip(connector.effectiveTone, `Conector ${connector.connectorId} · ${connector.status}`)}<div class="table-muted">${escapeHtml(connector.errorCode || 'NoError')}</div>`).join('<div style="height:8px"></div>')
    : '<span class="table-muted">Sin conectores</span>';

  return `
    <tr>
      <td>
        <strong>${escapeHtml(station.name || 'Sin nombre')}</strong><br />
        <span class="table-muted">${escapeHtml(station.id || '')} · ${escapeHtml(station.merchantName || '')}</span><br />
        ${chip(stationTone, toneLabel(stationTone))}
      </td>
      <td>
        <strong>${escapeHtml(station.plazaName || 'Ubicación por confirmar')}</strong><br />
        <span class="table-muted">${escapeHtml(station.address || station.locationText || 'Sin dirección')}</span>
      </td>
      <td>
        <strong>${escapeHtml([station.vendor, station.model].filter(Boolean).join(' ') || 'Sin dato')}</strong><br />
        <span class="table-muted">FW: ${escapeHtml(station.firmware || 'Sin dato')}</span>
      </td>
      <td>
        <strong>${escapeHtml(station.heartbeatLabel || 'Sin dato')}</strong><br />
        <span class="table-muted">${escapeHtml(station.actualHeartbeatInterval || '')}</span>
      </td>
      <td>${escapeHtml(station.bootLabel || 'Sin dato')}</td>
      <td>${connectors}</td>
    </tr>
  `;
}

function renderMapView() {
  const allStations = mappedStations();
  const stations = filteredMappedStations();
  refreshMapNearest();
  const legendCounts = connectorTotalsFromStations(stations);
  const totalCounts = connectorTotalsFromStations(allStations);
  const activeStations = stations.filter((station) => ['available', 'charging', 'preparing'].includes(effectiveStationTone(station))).length;
  const nearest = state.mapView.nearestTop3 || [];
  const nearestPrimary = nearest[0] || null;
  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <div class="section-title">Mapa de la red</div>
          <p class="section-copy">Vista operativa más limpia para explorar la red, detectar estados y ubicar rápidamente cada estación.</p>
        </div>
        <div class="map-actions"><span class="badge">${stations.length} / ${allStations.length}</span><button class="btn-ghost" type="button" id="mapFullscreenBtn">Pantalla grande</button></div>
      </div>

      <div class="users-summary-grid map-kpi-grid">
        <div class="stat-box"><div class="stat-label">Estaciones geolocalizadas</div><div class="stat-value">${escapeHtml(String(allStations.length))}</div></div>
        <div class="stat-box"><div class="stat-label">Mostrando</div><div class="stat-value">${escapeHtml(String(stations.length))}</div></div>
        <div class="stat-box"><div class="stat-label">Red activa</div><div class="stat-value">${escapeHtml(String(activeStations))}</div></div>
        <div class="stat-box"><div class="stat-label">Conectores disponibles</div><div class="stat-value">${escapeHtml(String(totalCounts.available))}</div></div>
      </div>

      <div class="toolbar map-toolbar">
        <div class="search-row" style="flex:1 1 520px;">
          <input class="input" id="mapSearch" type="search" placeholder="Buscar estación, plaza, merchant o dirección" value="${escapeHtml(state.mapView.query || '')}" style="flex:1 1 320px; min-width:260px;" />
          <select class="select" id="mapToneFilter">
            ${[
              ['all', 'Todos los estados'],
              ['available', 'Disponible'],
              ['charging', 'Cargando'],
              ['preparing', 'Preparando'],
              ['faulted', 'Fallando'],
              ['offline', 'Sin conexión'],
            ].map(([value, label]) => `<option value="${value}" ${state.mapView.tone === value ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
          <label class="map-filter-toggle">
            <input id="mapAvailableOnly" type="checkbox" ${state.mapView.availableOnly ? 'checked' : ''} />
            <span>Solo disponibles</span>
          </label>
        </div>
        <div class="map-actions">
          <button class="btn-ghost" type="button" id="mapCenterNetworkBtn">Centrar red</button>
          ${(state.mapView.query || state.mapView.tone !== 'all' || state.mapView.availableOnly) ? '<button class="btn-ghost" type="button" id="mapClearFiltersBtn">Limpiar filtros</button>' : ''}
        </div>
      </div>

      <div class="map-layout">
        <div class="map-card map-stage" id="mapStage">
          <aside class="map-fullscreen-sidebar">
            <div class="map-fullscreen-title">Estaciones visibles</div>
            <div class="map-fullscreen-list">
              ${stations.map((station) => `
                <button class="location-button compact tone-${escapeHtml(effectiveStationTone(station))}" type="button" data-map-station="${escapeHtml(station.id)}">
                  <div class="location-card-topline">
                    <strong>${escapeHtml(station.name)}</strong>
                    <span class="location-card-dot ${escapeHtml(effectiveStationTone(station))}"></span>
                  </div>
                  <div class="helper location-card-plaza">${escapeHtml(station.plazaName || 'Sin plaza')}</div>
                  <div class="helper">${escapeHtml(station.address || 'Sin dirección')}</div>
                  <div style="margin-top:8px;">${chip(effectiveStationTone(station), toneLabel(effectiveStationTone(station)))}</div>
                </button>
              `).join('')}
            </div>
          </aside>
          <div class="map-overlay-legend horizontal">
            <div class="map-overlay-title">Lectura rápida del mapa</div>
            <div class="map-overlay-subtitle">Color solo para el estado operativo</div>
            <div class="map-legend-row">
              <div class="map-legend-pill available"><span class="legend-dot available"></span><span>Disponibles</span><strong>${legendCounts.available}</strong></div>
              <div class="map-legend-pill charging"><span class="legend-dot charging"></span><span>Cargando</span><strong>${legendCounts.charging}</strong></div>
              <div class="map-legend-pill preparing"><span class="legend-dot preparing"></span><span>Preparando</span><strong>${legendCounts.preparing}</strong></div>
              <div class="map-legend-pill faulted"><span class="legend-dot faulted"></span><span>Fallando</span><strong>${legendCounts.faulted}</strong></div>
              <div class="map-legend-pill offline"><span class="legend-dot offline"></span><span>Sin conexión</span><strong>${legendCounts.offline}</strong></div>
            </div>
          </div>
          <div id="map"></div>
        </div>
        <div class="map-card">
          <div class="section-head" style="margin-bottom:12px;">
            <div>
              <div class="section-title">Exploración operativa</div>
              <p class="section-copy">Traje aquí las herramientas útiles del mapa público para ubicar, validar y guiar mejor.</p>
            </div>
            <span class="badge">${stations.length}</span>
          </div>
          <div class="map-side-stack">
            <button class="btn" type="button" id="mapLocateBtn">Usar mi ubicación</button>
            <div class="map-address-card">
              <div class="search-row map-address-row">
                <input class="input" id="mapAddressSearch" type="search" placeholder="Buscar dirección en Perú" value="${escapeHtml(state.mapView.addressQuery || '')}" />
                <button class="btn-ghost" type="button" id="mapAddressSearchBtn">Buscar</button>
              </div>
              ${state.mapView.addressResults?.length ? `
                <div class="map-address-results">
                  ${state.mapView.addressResults.map((item, index) => `
                    <button class="map-address-option" type="button" data-map-address-index="${index}">
                      <strong>${escapeHtml(item.display_name || item.name || 'Dirección')}</strong>
                    </button>
                  `).join('')}
                </div>
              ` : ''}
              ${state.mapView.statusMessage ? `<div class="helper" style="margin-top:8px;">${escapeHtml(state.mapView.statusMessage)}</div>` : ''}
            </div>
            ${nearestPrimary ? `
              <button class="map-nearest-card" type="button" id="mapNearestCard">
                <div class="eyebrow">Cargador más cercano</div>
                <strong>${escapeHtml(nearestPrimary.station.name || nearestPrimary.station.plazaName || 'Cargador')}</strong>
                <div class="helper">${escapeHtml(nearestPrimary.station.address || nearestPrimary.station.plazaName || 'Sin dirección')}</div>
                <div class="map-nearest-distance">${nearestPrimary.distanceKm < 1 ? `${Math.round(nearestPrimary.distanceKm * 1000)} m` : `${nearestPrimary.distanceKm.toFixed(1)} km`}</div>
              </button>
            ` : '<div class="map-empty-note">Usa tu ubicación o una dirección para calcular el cargador más cercano.</div>'}
            ${nearestPrimary ? `
              <div class="map-nearest-actions-wrap">
                <button class="btn-ghost" type="button" id="mapRouteToggleBtn">Cómo llegar</button>
                ${state.mapView.routeActionsOpen ? `
                  <div class="map-guide-grid">
                    <button class="btn-ghost" type="button" id="mapGuideWazeBtn">Waze</button>
                    <button class="btn-ghost" type="button" id="mapGuideMapsBtn">Maps</button>
                    <button class="btn-ghost" type="button" id="mapGuideUberBtn">Uber</button>
                  </div>
                ` : ''}
              </div>
            ` : ''}
            ${nearest.length > 1 ? `
              <div class="map-nearest-list">
                ${nearest.slice(0, 3).map(({ station, distanceKm }, index) => `
                  <button class="map-nearest-item" type="button" data-map-nearest-station="${escapeHtml(station.id)}">
                    <strong>${index + 1}. ${escapeHtml(station.name || station.plazaName || 'Cargador')}</strong>
                    <div class="helper">${escapeHtml(station.address || station.plazaName || 'Sin dirección')}</div>
                    <div class="map-nearest-distance">${distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`}</div>
                  </button>
                `).join('')}
              </div>
            ` : ''}
          </div>
          <div class="location-list">
            ${stations.map((station) => `
              <button class="location-button tone-${escapeHtml(effectiveStationTone(station))}" type="button" data-map-station="${escapeHtml(station.id)}">
                <div class="location-card-topline">
                  <strong>${escapeHtml(station.name)}</strong>
                  <span class="location-card-dot ${escapeHtml(effectiveStationTone(station))}"></span>
                </div>
                <div class="helper location-card-plaza">${escapeHtml(station.plazaName || 'Sin plaza')}</div>
                <div class="helper">${escapeHtml(station.address || 'Sin dirección')}</div>
                <div style="margin-top:8px;">${chip(effectiveStationTone(station), toneLabel(effectiveStationTone(station)))}</div>
              </button>
            `).join('') || '<div class="empty-state">No encontré estaciones con esos filtros.</div>'}
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderReportsView() {
  const reports = getReports();
  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <div class="section-title">Reportes listos</div>
          <p class="section-copy">Cortes y métricas operativas consolidadas.</p>
        </div>
        <span class="badge">${reports.length}</span>
      </div>
      <div class="report-grid">
        ${reports.map((report) => `
          <article class="report-card">
            <div class="eyebrow">${escapeHtml(report.idRef || 'Reporte')}</div>
            <h3 style="font-size:22px; margin:8px 0 14px;">${escapeHtml(report.stationName || report.idRef || 'Resumen')}</h3>
            <div class="card-stack">
              <div><span class="small">Transacciones</span><div class="stat-value" style="font-size:26px; margin-top:6px;">${escapeHtml(String(report.transactionCount ?? 0))}</div></div>
              <div><span class="small">Energía</span><div style="margin-top:6px;">${escapeHtml(String(report.energyCharged ?? 0))} kWh</div></div>
              <div><span class="small">Recaudación</span><div style="margin-top:6px;">S/ ${escapeHtml(String(report.feesCollected ?? 0))}</div></div>
              <div><span class="small">CO₂ evitado</span><div style="margin-top:6px;">${escapeHtml(String(report.reductionOfCarbonEmissions ?? 0))}</div></div>
            </div>
          </article>
        `).join('') || '<div class="empty-state">No hay reportes en el snapshot actual.</div>'}
      </div>
    </section>
  `;
}

function renderExportsView() {
  const busy = state.exports.loading || state.exports.creating;
  const filteredRows = filteredExportsRows();
  const pager = paginatedExportsRows(filteredRows);
  const rows = pager.rows;
  const merchantPlazas = state.exports.plazasByMerchant[state.exports.form.merchant] || [];
  const preparingCount = (state.exports.rows || []).filter((row) => {
    const status = String(row?.status || '').toLowerCase();
    return status === 'preparing' || row?.ready === false;
  }).length;
  const activeColumnKind = state.exports.columnPickerKind || 'transaction';
  const activeColumnDef = exportColumnDef(activeColumnKind);
  const activeSelectedColumns = ensureSelectedColumns(activeColumnKind);
  const selectedMailRows = selectedExportsForMail();
  const mailReady = !!selectedMailRows.length && selectedMailRows.every((row) => row?.ready && row?.fileNames?.[0]);
  const selectedMailAttachments = selectedMailRows.map((row) => exportDescriptiveFilename(row, { clean: state.exports.mail.variant === 'clean' }));
  return `
    <section class="dual-grid">
      <article class="panel">
        <div class="section-head">
          <div>
            <div class="section-title">Nuevo export</div>
            <p class="section-copy">Replica el flujo de EVINKA Connect para generar y luego descargar exportaciones.</p>
          </div>
          <span class="badge">${escapeHtml(exportKindLabel(state.exports.form.kind))}</span>
        </div>
        <div class="export-form-grid">
          <div class="field-stack">
            <span class="small">Tipo</span>
            <div class="export-kind-grid">
              ${(state.exports.kinds.length ? state.exports.kinds : [
                { value: 'transaction', label: 'Transacción', enabled: true },
                { value: 'recharge', label: 'Recargar', enabled: true },
                { value: 'appuser', label: 'Usuaria', enabled: true },
                { value: 'invoice', label: 'Invoice', enabled: false },
              ]).map((kind) => `
                <button
                  type="button"
                  class="export-kind-card ${state.exports.form.kind === kind.value ? 'active' : ''} ${kind.enabled === false ? 'disabled' : ''}"
                  data-export-kind="${escapeHtml(kind.value)}"
                  ${kind.enabled === false ? 'disabled' : ''}
                >
                  <strong>${escapeHtml(kind.label)}</strong>
                  <span>${kind.enabled === false ? 'Próximamente' : 'Disponible'}</span>
                </button>
              `).join('')}
            </div>
          </div>
          <label class="field-stack">
            <span class="small">Comerciante</span>
            <select class="select" id="exportMerchant">
              <option value="">Toda</option>
              ${state.exports.merchants.map((merchant) => `<option value="${escapeHtml(merchant.id)}" ${state.exports.form.merchant === merchant.id ? 'selected' : ''}>${escapeHtml(merchant.label)}</option>`).join('')}
            </select>
          </label>
          <label class="field-stack">
            <span class="small">Plaza</span>
            <select class="select" id="exportPlaza" disabled>
              <option value="">Todas las plazas</option>
              ${merchantPlazas.map((plaza) => `<option value="${escapeHtml(plaza.id)}">${escapeHtml(plaza.label)}</option>`).join('')}
            </select>
            <span class="helper">La API detectada está respetando comerciante y rango; plaza todavía no filtra de forma consistente.</span>
          </label>
          <label class="field-stack">
            <span class="small">Desde</span>
            <input class="input" id="exportStartDate" type="date" value="${escapeHtml(state.exports.form.startDate)}" />
          </label>
          <label class="field-stack">
            <span class="small">Hasta</span>
            <input class="input" id="exportEndDate" type="date" value="${escapeHtml(state.exports.form.endDate)}" />
          </label>
        </div>
        <div class="notification-actions" style="margin-top:16px;">
          <button class="btn" id="createExportBtn" type="button" ${busy ? 'disabled' : ''}>${state.exports.creating ? 'Exportando…' : 'Exportar'}</button>
          <button class="btn-ghost" id="resetExportDatesBtn" type="button" ${busy ? 'disabled' : ''}>Mes actual</button>
          <button class="btn-ghost" id="reloadExportsBtn" type="button" ${busy ? 'disabled' : ''}>${state.exports.loading ? 'Actualizando…' : 'Recargar exports'}</button>
        </div>
        <div class="column-picker-panel">
          <div class="section-head" style="margin:18px 0 10px;">
            <div>
              <div class="section-title">Descarga limpia</div>
              <p class="section-copy">Marca las columnas que quieras conservar. Lo seleccionado queda en verde.</p>
            </div>
            <span class="badge">${activeSelectedColumns.length}</span>
          </div>
          <div class="export-kind-grid compact-3">
            ${['transaction', 'recharge', 'appuser'].map((kind) => `
              <button type="button" class="export-kind-card ${activeColumnKind === kind ? 'active' : ''}" data-column-kind="${kind}">
                <strong>${escapeHtml(exportKindLabel(kind))}</strong>
                <span>${escapeHtml(String((exportColumnDef(kind).columns || []).length))} columnas</span>
              </button>
            `).join('')}
          </div>
          <div class="export-filter-grid" style="margin-top:12px;">
            <button type="button" class="export-filter-chip" data-column-preset="all">Todas</button>
            <button type="button" class="export-filter-chip" data-column-preset="none">Ninguna</button>
            ${Object.keys(activeColumnDef.presets || {}).map((preset) => `
              <button type="button" class="export-filter-chip" data-column-preset="${preset}">${escapeHtml(exportPresetLabel(preset))}</button>
            `).join('')}
          </div>
          <div class="column-chip-grid">
            ${(activeColumnDef.columns || []).map((column) => `
              <button type="button" class="column-chip ${activeSelectedColumns.includes(column) ? 'active' : ''}" data-column-name="${escapeHtml(column)}">${escapeHtml(column)}</button>
            `).join('')}
          </div>
        </div>
        <div class="column-picker-panel">
          <div class="section-head" style="margin:18px 0 10px;">
            <div>
              <div class="section-title">Enviar por correo</div>
              <p class="section-copy">Agrega correos corporativos, selecciona uno o varios exports del historial y redacta el correo con ayuda de IA.</p>
            </div>
            <span class="badge">${escapeHtml(String((state.exports.mail.exportIds || []).length))}</span>
          </div>
          <div class="notification-actions" style="gap:10px; align-items:flex-end; flex-wrap:wrap;">
            <label class="field-stack" style="flex:1 1 280px; min-width:240px;">
              <span class="small">Correo</span>
              <input class="input" id="exportMailRecipientInput" type="email" placeholder="julio.campos@evinka.tech" value="${escapeHtml(state.exports.mail.recipientInput || '')}" />
            </label>
            <button class="btn-ghost" id="addExportMailRecipientBtn" type="button">Añadir</button>
          </div>
          <div class="export-filter-grid" style="margin-top:12px;">
            ${(state.exports.mail.recipients || []).map((email) => `
              <button type="button" class="export-filter-chip active" data-mail-recipient-remove="${escapeHtml(email)}">${escapeHtml(email)} ✕</button>
            `).join('') || '<span class="helper">Aún no agregaste destinatarios.</span>'}
          </div>
          <div class="field-stack" style="margin-top:14px;">
            <span class="small">Archivos que se adjuntarán</span>
            <div class="export-filter-grid" style="margin-top:8px;">
              ${selectedMailRows.length ? selectedMailRows.map((row, index) => `
                <button type="button" class="export-filter-chip active" data-mail-export-remove="${escapeHtml(row.id)}" title="Quitar este adjunto">
                  ${escapeHtml(selectedMailAttachments[index] || exportDescriptiveFilename(row, { clean: state.exports.mail.variant === 'clean' }))} ✕
                </button>
              `).join('') : '<span class="helper">Aquí aparecerán los archivos seleccionados. Puedes quitarlos con la X si te equivocas.</span>'}
            </div>
            <div class="helper" style="margin-top:8px;">${mailReady ? `${selectedMailRows.length} archivo${selectedMailRows.length === 1 ? '' : 's'} listo${selectedMailRows.length === 1 ? '' : 's'} para enviar en un solo correo.` : (selectedMailRows.length ? 'Hay archivos seleccionados, pero alguno todavía no está listo.' : 'Sin archivos seleccionados todavía.')}</div>
          </div>
          <div class="export-filter-grid" style="margin-top:12px;">
            <button type="button" class="export-filter-chip ${state.exports.mail.variant === 'original' ? 'active' : ''}" data-export-mail-variant="original">Original</button>
            <button type="button" class="export-filter-chip ${state.exports.mail.variant === 'clean' ? 'active' : ''}" data-export-mail-variant="clean">Limpio</button>
          </div>
          <label class="field-stack" style="margin-top:14px;">
            <span class="small">Asunto</span>
            <input class="input" id="exportMailSubject" type="text" value="${escapeHtml(state.exports.mail.subject || '')}" placeholder="Envío de reportes y exports" />
          </label>
          <label class="field-stack" style="margin-top:14px;">
            <span class="small">Contexto adicional para IA</span>
            <textarea class="input" id="exportMailContext" style="min-height:90px; resize:vertical;" placeholder="Ej.: envío para revisión y seguimiento de abril y mayo.">${escapeHtml(state.exports.mail.context || '')}</textarea>
          </label>
          <label class="field-stack" style="margin-top:14px;">
            <span class="small">Mensaje</span>
            <textarea class="input" id="exportMailMessage" style="min-height:150px; resize:vertical;">${escapeHtml(state.exports.mail.message || '')}</textarea>
          </label>
          <div class="notification-actions" style="margin-top:12px;">
            <button class="btn-ghost" id="draftExportMailWithAiBtn" type="button" ${(state.exports.mail.aiLoading || !selectedMailRows.length) ? 'disabled' : ''}>${state.exports.mail.aiLoading ? 'Redactando…' : 'Redactar con IA'}</button>
            <button class="btn" id="sendExportMailBtn" type="button" ${(state.exports.mail.sending || !mailReady || !(state.exports.mail.recipients || []).length) ? 'disabled' : ''}>${state.exports.mail.sending ? 'Enviando…' : 'Enviar correo'}</button>
          </div>
          ${state.exports.mail.success ? `<div class="notification-feedback success" style="margin-top:12px;">${escapeHtml(state.exports.mail.success)}</div>` : ''}
        </div>
        ${state.exports.error ? `<div class="notification-feedback error" style="margin-top:14px;">${escapeHtml(state.exports.error)}</div>` : ''}
      </article>

      <article class="panel">
        <div class="section-head">
          <div>
            <div class="section-title">Historial de exports</div>
            <p class="section-copy">Filtra por tipo o estado y descarga cuando quede en Downloadable.${preparingCount ? ` Autoactualizando cada pocos segundos (${preparingCount} pendientes).` : ''}</p>
          </div>
          <span class="badge">${pager.totalRows}</span>
        </div>
        <div class="export-filters-stack" style="margin-bottom:14px;">
          <div class="field-stack">
            <span class="small">Tipo</span>
            <div class="export-filter-grid">
              ${[
                ['all', 'Todos los tipos'],
                ['transaction', 'Transacción'],
                ['recharge', 'Recargar'],
                ['appuser', 'Usuaria'],
              ].map(([value, label]) => `
                <button type="button" class="export-filter-chip ${state.exports.listFilter.kind === value ? 'active' : ''}" data-export-filter-kind="${value}">${label}</button>
              `).join('')}
            </div>
          </div>
          <div class="field-stack">
            <span class="small">Estado</span>
            <div class="export-filter-grid compact">
              ${[
                ['all', 'Todos los estados'],
                ['preparing', 'Preparing'],
                ['downloadable', 'Downloadable'],
                ['failed', 'Failed'],
              ].map(([value, label]) => `
                <button type="button" class="export-filter-chip ${state.exports.listFilter.status === value ? 'active' : ''}" data-export-filter-status="${value}">${label}</button>
              `).join('')}
            </div>
          </div>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Creada</th>
                <th>Comerciante</th>
                <th>Tipo</th>
                <th>Intervalo</th>
                <th>Registros</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row) => {
                const justReady = (state.exports.justReadyIds || []).includes(row.id);
                return `
                <tr class="${justReady ? 'export-row-ready' : ''}">
                  <td>${escapeHtml(formatDateTime(row.createdAt))}</td>
                  <td>${escapeHtml(row.merchant || 'Toda')}</td>
                  <td>${escapeHtml(exportKindLabel(row.kind))}</td>
                  <td>${escapeHtml(formatDateTime(row.startTime))} → ${escapeHtml(formatDateTime(row.endTime))}</td>
                  <td>${escapeHtml(String(row.recordCount ?? 0))}</td>
                  <td>${chip(exportStatusTone(row.status), row.status || 'Sin estado')}${justReady ? '<span class="export-ready-pill">¡Listo!</span>' : ''}</td>
                  <td>${row.ready && row.fileNames?.[0] ? `<div class="export-download-actions"><a class="btn-ghost btn-inline ${justReady ? 'download-ready' : ''}" href="${exportDownloadUrl(row)}" download="${escapeHtml(exportDescriptiveFilename(row))}">Original</a><button type="button" class="btn btn-inline ${justReady ? 'download-ready' : ''}" data-download-clean="${escapeHtml(row.id)}" data-download-kind="${escapeHtml(String(row.kind || ''))}" data-download-file="${escapeHtml(row.fileNames?.[0] || '')}">${(state.exports.cleanDownloadingIds || []).includes(row.id) ? 'Generando…' : 'Limpio'}</button><button type="button" class="btn-ghost btn-inline ${(state.exports.mail.exportIds || []).includes(row.id) ? 'active' : ''}" data-export-mail-select="${escapeHtml(row.id)}">Correo</button></div>` : '<span class="table-muted">Esperando</span>'}</td>
                </tr>
              `;}).join('') || '<tr><td colspan="7"><div class="empty-state">No hay exports que coincidan con ese filtro.</div></td></tr>'}
            </tbody>
          </table>
        </div>
        <div class="export-pagination">
          <div class="small">${pager.totalRows ? `Mostrando ${pager.start}-${pager.end} de ${pager.totalRows}` : 'Sin resultados'}</div>
          <div class="export-pagination-controls">
            <button type="button" class="btn-ghost btn-inline" id="exportsPrevPageBtn" ${pager.currentPage <= 1 ? 'disabled' : ''}>Anterior</button>
            <div class="export-page-pills">
              ${Array.from({ length: pager.totalPages }, (_, index) => index + 1).slice(Math.max(0, pager.currentPage - 3), Math.min(pager.totalPages, pager.currentPage + 2)).map((page) => `
                <button type="button" class="export-page-pill ${pager.currentPage === page ? 'active' : ''}" data-export-page="${page}">${page}</button>
              `).join('')}
            </div>
            <button type="button" class="btn-ghost btn-inline" id="exportsNextPageBtn" ${pager.currentPage >= pager.totalPages ? 'disabled' : ''}>Siguiente</button>
          </div>
        </div>
      </article>
    </section>
  `;
}

function renderAlertsView() {
  const alerts = getAlerts();
  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <div class="section-title">Alertas activas</div>
          <p class="section-copy">Todas las alertas dentro de una sola vista operativa.</p>
        </div>
        <span class="badge">${alerts.length}</span>
      </div>
      <div class="alert-grid">
        ${alerts.map(renderAlertCard).join('') || '<div class="empty-state">No hay alertas activas.</div>'}
      </div>
    </section>
  `;
}

function renderAlertCard(alert) {
  return `
    <article class="alert-card">
      <div class="section-head" style="margin-bottom:10px;">
        <strong>${escapeHtml(alert.title || 'Alerta')}</strong>
        ${chip(alert.status || 'faulted')}
      </div>
      <div class="helper" style="line-height:1.6;">${escapeHtml(alert.detail || 'Sin detalle')}</div>
      <div class="small" style="margin-top:12px;">${escapeHtml(alert.stationId || 'Sin estación')}${alert.connectorId ? ` · Conector ${escapeHtml(String(alert.connectorId))}` : ''}</div>
      <div class="small" style="margin-top:6px;">${escapeHtml(alert.createdLabel || 'Sin fecha')}</div>
    </article>
  `;
}

function renderIncidentCard(item) {
  return `
    <article class="incident-card">
      <div class="section-head" style="margin-bottom:10px;">
        <strong>${escapeHtml(item.title || 'Incidencia')}</strong>
        ${chip('offline', item.status || 'Offline')}
      </div>
      <div class="helper">${escapeHtml(item.location || 'Sin ubicación')}</div>
      <div class="small" style="margin-top:10px;">Heartbeat: ${escapeHtml(item.heartbeat || 'Sin dato')}</div>
      <div class="small" style="margin-top:6px;">Último boot: ${escapeHtml(item.boot || 'Sin dato')}</div>
    </article>
  `;
}

function bindShell() {
  document.querySelectorAll('[data-link]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      navigate(link.getAttribute('href') || '/');
    });
  });

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try { await api('/api/auth/logout', { method: 'POST', body: '{}' }); } catch {}
    state.session = null;
    state.notificationPrefs.error = '';
    state.auth.error = '';
    state.auth.message = '';
    state.auth.step = 'credentials';
    navigate(ROUTES.login.path, { replace: true });
  });

  document.getElementById('refreshBtn')?.addEventListener('click', async () => {
    await loadData();
    if (state.route === ROUTES.mapa.path) queueMapRender();
    if (state.route === ROUTES.cuentas.path) await loadAdminUsers({ silent: true });
    if (state.route === ROUTES.auditoria.path) await loadAuditFeed({ silent: true });
    if (state.route === ROUTES.exportar.path) await loadExportsList({ silent: true });
    if (state.route === ROUTES.usuarios.path) await loadUsers({ silent: true, force: true });
  });

  document.getElementById('adminUsersRefreshBtn')?.addEventListener('click', async () => {
    await loadAdminUsers();
  });

  document.getElementById('auditRefreshBtn')?.addEventListener('click', async () => {
    await loadAuditFeed();
  });

  document.querySelectorAll('[data-audit-prototype]').forEach((button) => {
    button.addEventListener('click', () => {
      state.audit.prototype = button.getAttribute('data-audit-prototype') || 'all';
      if (!filteredAuditRows().some((item) => item.id === state.audit.selectedId)) {
        state.audit.selectedId = filteredAuditRows()[0]?.id || '';
      }
      render();
    });
  });

  document.querySelectorAll('[data-audit-select]').forEach((button) => {
    button.addEventListener('click', () => {
      state.audit.selectedId = button.getAttribute('data-audit-select') || '';
      render();
    });
  });

  document.getElementById('adminUsersSearch')?.addEventListener('input', (event) => {
    state.adminUsers.query = event.target.value;
    render();
  });

  document.querySelectorAll('[data-admin-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      state.adminUsers.filter = button.getAttribute('data-admin-filter') || 'all';
      render();
    });
  });

  document.getElementById('adminCreateEmail')?.addEventListener('input', (event) => {
    state.adminUsers.create.email = event.target.value;
  });

  document.getElementById('adminCreateRole')?.addEventListener('change', (event) => {
    state.adminUsers.create.role = event.target.value;
  });

  document.getElementById('adminCreateOtpEmails')?.addEventListener('input', (event) => {
    state.adminUsers.create.otpEmails = event.target.value;
  });

  document.getElementById('adminCreatePassword')?.addEventListener('input', (event) => {
    state.adminUsers.create.password = event.target.value;
  });

  document.getElementById('adminCreateUserBtn')?.addEventListener('click', async () => {
    await createManagedUser();
  });

  document.querySelectorAll('[data-admin-toggle-access]').forEach((button) => {
    button.addEventListener('click', async () => {
      const email = button.getAttribute('data-admin-toggle-access') || '';
      const current = button.getAttribute('data-admin-current-access') === 'true';
      await updateManagedUser(email, { accessEnabled: !current }, !current ? `Acceso habilitado para ${email}.` : `Acceso retirado para ${email}.`);
    });
  });

  document.querySelectorAll('[data-admin-save-user]').forEach((button) => {
    button.addEventListener('click', async () => {
      const email = button.getAttribute('data-admin-save-user') || '';
      const role = document.querySelector(`[data-admin-role-email="${CSS.escape(email)}"]`)?.value || 'user';
      const otpEmails = document.querySelector(`[data-admin-otp-email="${CSS.escape(email)}"]`)?.value || '';
      await updateManagedUser(email, { role, otpEmails }, `Cambios guardados para ${email}.`);
    });
  });

  document.querySelectorAll('[data-admin-revoke-sessions]').forEach((button) => {
    button.addEventListener('click', async () => {
      const email = button.getAttribute('data-admin-revoke-sessions') || '';
      await updateManagedUser(email, { revokeSessions: true }, `Sesiones cerradas para ${email}.`);
    });
  });

  document.querySelectorAll('[data-admin-reset-password]').forEach((button) => {
    button.addEventListener('click', async () => {
      const email = button.getAttribute('data-admin-reset-password') || '';
      await resetManagedUserPassword(email);
    });
  });

  document.getElementById('usersRefreshBtn')?.addEventListener('click', async () => {
    await loadUsers({ force: true });
  });

  document.getElementById('usersExportBtn')?.addEventListener('click', async () => {
    await downloadUsersMarketingExport();
  });

  document.getElementById('usersSearch')?.addEventListener('input', (event) => {
    state.users.query = event.target.value;
    render();
  });

  document.querySelectorAll('[data-user-segment]').forEach((button) => {
    button.addEventListener('click', () => {
      state.users.segment = button.getAttribute('data-user-segment') || 'all';
      if (!filteredUsersRows().some((item) => item.id === state.users.selectedId)) {
        state.users.selectedId = filteredUsersRows()[0]?.id || '';
      }
      render();
    });
  });

  document.querySelectorAll('[data-user-select]').forEach((button) => {
    button.addEventListener('click', () => {
      state.users.selectedId = button.getAttribute('data-user-select') || '';
      render();
    });
  });

  document.getElementById('notificationReloadBtn')?.addEventListener('click', async () => {
    await loadNotificationPrefs();
  });

  document.querySelectorAll('[data-notification-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      await updateNotificationPrefs(button.getAttribute('data-notification-action'));
    });
  });

  document.getElementById('stationQuery')?.addEventListener('input', (event) => {
    state.filters.stationQuery = event.target.value;
    render();
  });

  document.getElementById('stationTone')?.addEventListener('change', (event) => {
    state.filters.stationTone = event.target.value;
    render();
  });

  document.getElementById('clearStationFilterBtn')?.addEventListener('click', () => {
    state.filters.stationTone = 'all';
    render();
  });

  document.querySelectorAll('[data-export-kind]').forEach((button) => {
    button.addEventListener('click', () => {
      state.exports.form.kind = button.getAttribute('data-export-kind') || 'transaction';
      render();
    });
  });

  document.querySelectorAll('[data-column-kind]').forEach((button) => {
    button.addEventListener('click', () => {
      state.exports.columnPickerKind = button.getAttribute('data-column-kind') || 'transaction';
      ensureSelectedColumns(state.exports.columnPickerKind);
      render();
    });
  });

  document.querySelectorAll('[data-column-preset]').forEach((button) => {
    button.addEventListener('click', () => {
      const kind = state.exports.columnPickerKind || 'transaction';
      const def = exportColumnDef(kind);
      const preset = button.getAttribute('data-column-preset') || 'all';
      if (preset === 'all') state.exports.selectedColumns[kind] = [...(def.columns || [])];
      else if (preset === 'none') state.exports.selectedColumns[kind] = [];
      else state.exports.selectedColumns[kind] = [...(def.presets?.[preset] || [])];
      render();
    });
  });

  document.querySelectorAll('[data-column-name]').forEach((button) => {
    button.addEventListener('click', () => {
      const kind = state.exports.columnPickerKind || 'transaction';
      const name = button.getAttribute('data-column-name') || '';
      const current = new Set(ensureSelectedColumns(kind));
      if (current.has(name)) current.delete(name);
      else current.add(name);
      state.exports.selectedColumns[kind] = (exportColumnDef(kind).columns || []).filter((item) => current.has(item));
      render();
    });
  });

  document.getElementById('exportMerchant')?.addEventListener('change', (event) => {
    state.exports.form.merchant = event.target.value;
    state.exports.form.plaza = '';
    render();
  });

  document.getElementById('exportStartDate')?.addEventListener('change', (event) => {
    state.exports.form.startDate = event.target.value;
  });

  document.getElementById('exportEndDate')?.addEventListener('change', (event) => {
    state.exports.form.endDate = event.target.value;
  });

  document.getElementById('createExportBtn')?.addEventListener('click', async () => {
    await createExportFromForm();
  });

  document.getElementById('resetExportDatesBtn')?.addEventListener('click', () => {
    Object.assign(state.exports.form, exportFormDefaults(), {
      kind: state.exports.form.kind,
      merchant: state.exports.form.merchant,
      plaza: '',
    });
    render();
  });

  document.getElementById('reloadExportsBtn')?.addEventListener('click', async () => {
    await loadExportsList();
  });

  document.getElementById('exportMailRecipientInput')?.addEventListener('input', (event) => {
    state.exports.mail.recipientInput = event.target.value;
  });

  document.getElementById('exportMailRecipientInput')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addMailRecipient(event.target.value);
    }
  });

  document.getElementById('addExportMailRecipientBtn')?.addEventListener('click', () => {
    addMailRecipient(state.exports.mail.recipientInput);
  });

  document.querySelectorAll('[data-mail-recipient-remove]').forEach((button) => {
    button.addEventListener('click', () => {
      removeMailRecipient(button.getAttribute('data-mail-recipient-remove') || '');
    });
  });

  document.querySelectorAll('[data-mail-export-remove]').forEach((button) => {
    button.addEventListener('click', () => {
      removeSelectedExportForMail(button.getAttribute('data-mail-export-remove') || '');
    });
  });

  document.querySelectorAll('[data-export-mail-select]').forEach((button) => {
    button.addEventListener('click', () => {
      const row = (state.exports.rows || []).find((item) => item.id === (button.getAttribute('data-export-mail-select') || ''));
      if (row) selectExportForMail(row);
    });
  });

  document.querySelectorAll('[data-export-mail-variant]').forEach((button) => {
    button.addEventListener('click', () => {
      state.exports.mail.variant = button.getAttribute('data-export-mail-variant') || 'original';
      syncExportMailDraft();
      render();
    });
  });

  document.getElementById('exportMailSubject')?.addEventListener('input', (event) => {
    state.exports.mail.subject = event.target.value;
    state.exports.mail.subjectTouched = true;
  });

  document.getElementById('exportMailContext')?.addEventListener('input', (event) => {
    state.exports.mail.context = event.target.value;
  });

  document.getElementById('exportMailContext')?.addEventListener('change', (event) => {
    state.exports.mail.context = event.target.value;
    syncExportMailDraft();
    render();
  });

  document.getElementById('exportMailMessage')?.addEventListener('input', (event) => {
    state.exports.mail.message = event.target.value;
    state.exports.mail.messageTouched = true;
  });

  document.getElementById('draftExportMailWithAiBtn')?.addEventListener('click', async () => {
    await generateExportMailDraftWithAi();
  });

  document.getElementById('sendExportMailBtn')?.addEventListener('click', async () => {
    await sendExportMail();
  });

  document.querySelectorAll('[data-export-filter-kind]').forEach((button) => {
    button.addEventListener('click', () => {
      state.exports.listFilter.kind = button.getAttribute('data-export-filter-kind') || 'all';
      state.exports.pagination.page = 1;
      render();
    });
  });

  document.querySelectorAll('[data-export-filter-status]').forEach((button) => {
    button.addEventListener('click', () => {
      state.exports.listFilter.status = button.getAttribute('data-export-filter-status') || 'all';
      state.exports.pagination.page = 1;
      render();
    });
  });

  document.getElementById('exportsPrevPageBtn')?.addEventListener('click', () => {
    state.exports.pagination.page = Math.max(1, state.exports.pagination.page - 1);
    render();
  });

  document.getElementById('exportsNextPageBtn')?.addEventListener('click', () => {
    state.exports.pagination.page = state.exports.pagination.page + 1;
    render();
  });

  document.querySelectorAll('[data-export-page]').forEach((button) => {
    button.addEventListener('click', () => {
      state.exports.pagination.page = Number(button.getAttribute('data-export-page') || '1') || 1;
      render();
    });
  });

  document.querySelectorAll('[data-download-clean]').forEach((button) => {
    button.addEventListener('click', async () => {
      await downloadCleanExport({
        id: button.getAttribute('data-download-clean') || '',
        kind: button.getAttribute('data-download-kind') || '',
        fileNames: [button.getAttribute('data-download-file') || ''],
      });
    });
  });

  document.querySelectorAll('[data-metric-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      state.filters.stationTone = button.getAttribute('data-metric-filter') || 'all';
      state.filters.stationQuery = '';
      navigate(ROUTES.incidentes.path);
    });
  });

  document.querySelectorAll('[data-map-station]').forEach((button) => {
    button.addEventListener('click', () => focusStation(button.getAttribute('data-map-station')));
  });

  document.getElementById('mapSearch')?.addEventListener('input', (event) => {
    state.mapView.query = event.target.value;
    render();
  });

  document.getElementById('mapToneFilter')?.addEventListener('change', (event) => {
    state.mapView.tone = event.target.value;
    render();
  });

  document.getElementById('mapAvailableOnly')?.addEventListener('change', (event) => {
    state.mapView.availableOnly = !!event.target.checked;
    render();
  });

  document.getElementById('mapClearFiltersBtn')?.addEventListener('click', () => {
    state.mapView.query = '';
    state.mapView.tone = 'all';
    state.mapView.availableOnly = false;
    render();
  });

  document.getElementById('mapCenterNetworkBtn')?.addEventListener('click', () => {
    state.mapView.centerMode = 'network';
    setMapStatus('Mapa centrado en la red visible.');
    render();
  });

  document.getElementById('mapLocateBtn')?.addEventListener('click', () => {
    if (!navigator.geolocation) {
      setMapStatus('Este navegador no expone geolocalización.');
      render();
      return;
    }
    setMapStatus('Buscando tu ubicación…');
    render();
    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude, longitude } = position.coords;
      applyMapReferencePoint(latitude, longitude, 'Tu ubicación aproximada');
      setMapStatus('Ubicación detectada.');
      render();
    }, () => {
      setMapStatus('No pude obtener tu ubicación.');
      render();
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  });

  document.getElementById('mapAddressSearch')?.addEventListener('input', (event) => {
    state.mapView.addressQuery = event.target.value;
  });

  document.getElementById('mapAddressSearch')?.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      await searchMapAddress();
    }
  });

  document.getElementById('mapAddressSearchBtn')?.addEventListener('click', async () => {
    await searchMapAddress();
  });

  document.querySelectorAll('[data-map-address-index]').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.getAttribute('data-map-address-index'));
      const item = state.mapView.addressResults?.[index];
      if (!item) return;
      state.mapView.addressQuery = item.display_name || item.name || '';
      applyMapReferencePoint(Number(item.lat), Number(item.lon), item.display_name || 'Dirección seleccionada');
      setMapStatus('Dirección detectada.');
      render();
    });
  });

  document.getElementById('mapNearestCard')?.addEventListener('click', () => {
    if (state.mapView.nearestStationId) focusStation(state.mapView.nearestStationId);
  });

  document.querySelectorAll('[data-map-nearest-station]').forEach((button) => {
    button.addEventListener('click', () => {
      const stationId = button.getAttribute('data-map-nearest-station') || '';
      state.mapView.nearestStationId = stationId;
      focusStation(stationId);
    });
  });

  document.getElementById('mapRouteToggleBtn')?.addEventListener('click', () => {
    state.mapView.routeActionsOpen = !state.mapView.routeActionsOpen;
    render();
  });

  document.getElementById('mapGuideWazeBtn')?.addEventListener('click', () => openMapGuide('waze'));
  document.getElementById('mapGuideMapsBtn')?.addEventListener('click', () => openMapGuide('maps'));
  document.getElementById('mapGuideUberBtn')?.addEventListener('click', () => openMapGuide('uber'));

  document.getElementById('mapFullscreenBtn')?.addEventListener('click', async () => {
    const stage = document.getElementById('mapStage');
    if (!stage) return;
    if (document.fullscreenElement === stage) {
      await document.exitFullscreen();
    } else {
      await stage.requestFullscreen();
      setTimeout(() => state.map?.invalidateSize(), 120);
    }
  });
}

function renderMap() {
  if (!window.L) {
    setTimeout(() => {
      if (state.route === ROUTES.mapa.path) renderMap();
    }, 200);
    return;
  }
  const mapElement = document.getElementById('map');
  if (!mapElement) return;

  const stations = filteredMappedStations();
  if (state.map && typeof state.map.getContainer === 'function' && state.map.getContainer() !== mapElement) {
    destroyMap();
  }

  if (!state.map) {
    try { delete mapElement._leaflet_id; } catch {}
    state.map = window.L.map(mapElement, { zoomControl: true }).setView([-12.3, -76.8], 6);
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(state.map);
    state.map.on('popupopen', (event) => {
      const button = event.popup?.getElement()?.querySelector('[data-popup-route]');
      if (!button || button.dataset.bound === '1') return;
      button.dataset.bound = '1';
      button.addEventListener('click', () => openMapGuide('maps', button.getAttribute('data-popup-route')));
    });
  }

  state.markers.forEach((marker) => marker.remove());
  state.markers = [];
  if (state.mapUserMarker) {
    state.mapUserMarker.remove();
    state.mapUserMarker = null;
  }

  const bounds = [];
  stations.forEach((station) => {
    const color = mapStatusColor(effectiveStationTone(station));
    const marker = window.L.circleMarker([station.latitude, station.longitude], {
      radius: 9,
      color,
      fillColor: color,
      fillOpacity: 0.92,
      weight: 2,
    }).addTo(state.map);
    marker.__stationId = station.id;
    marker.bindPopup(renderMapPopup(station), {
      className: 'evinka-map-popup-shell',
      maxWidth: 460,
      minWidth: 380,
    });
    state.markers.push(marker);
    bounds.push([station.latitude, station.longitude]);
  });

  if (state.mapView.userCoords) {
    const { latitude, longitude } = state.mapView.userCoords;
    const icon = window.L.divIcon({
      className: 'map-user-marker-wrap',
      html: '<div class="map-user-marker"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    state.mapUserMarker = window.L.marker([latitude, longitude], { icon, keyboard: false })
      .addTo(state.map)
      .bindPopup(escapeHtml(state.mapView.referenceLabel || 'Punto de referencia'));
  }

  if (state.mapView.centerMode === 'reference' && state.mapView.userCoords) {
    const refBounds = referenceMapBounds();
    if (refBounds.length > 1) {
      state.map.fitBounds(refBounds, { padding: [72, 72], maxZoom: 13 });
    } else {
      state.map.setView([state.mapView.userCoords.latitude, state.mapView.userCoords.longitude], 12);
    }
  } else if (bounds.length) {
    state.map.fitBounds(bounds, { padding: [28, 28] });
  }

  setTimeout(() => state.map?.invalidateSize(), 0);
  setTimeout(() => state.map?.invalidateSize(), 180);
}

function focusStation(stationId) {
  if (!state.map) return;
  const marker = state.markers.find((item) => item.__stationId === stationId);
  if (!marker) return;
  state.mapView.nearestStationId = stationId;
  const latlng = marker.getLatLng();
  state.map.flyTo(latlng, 15, { duration: 0.8 });
  marker.openPopup();
  document.querySelectorAll('[data-map-station]').forEach((button) => {
    button.classList.toggle('active', button.getAttribute('data-map-station') === stationId);
  });
}

function destroyMap() {
  if (!state.map) return;
  state.map.remove();
  state.map = null;
  state.mapUserMarker = null;
  state.markers = [];
}
