function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function normalizeNotificationPhone(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const cleaned = raw.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  const digits = cleaned.replace(/^\+/, '').replace(/\D/g, '');
  if (/^9\d{8}$/.test(digits)) return `51${digits}`;
  if (/^3\d{9}$/.test(digits)) return `57${digits}`;
  if (/^(51\d{9}|57\d{10})$/.test(digits)) return digits;
  if (/^\d{8,15}$/.test(digits)) return digits;
  return '';
}

function normalizeCountryList(value) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => String(item || '').trim().toUpperCase()).filter(Boolean))]
    : [];
}

function normalizeQueueList(value) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean))]
    : [];
}

function normalizeLooseText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeOperationalUsers(users = []) {
  return Array.isArray(users)
    ? users.map((user) => ({
        ...user,
        email: normalizeEmail(user.email || ''),
        role: String(user.role || '').trim().toLowerCase(),
        status: String(user.status || 'active').trim().toLowerCase(),
        notificationPhone: normalizeNotificationPhone(user.notificationPhone || user.phone || ''),
        allowedCountries: normalizeCountryList(user.allowedCountries),
        allowedQueues: normalizeQueueList(user.allowedQueues),
      }))
    : [];
}

function isAdvisorAlertRole(user = {}) {
  const role = String(user.role || '').trim().toLowerCase();
  return role === 'admin'
    || role === 'supervisor'
    || role.startsWith('asesor')
    || role.startsWith('kam');
}

function userAllowsCountry(user = {}, countryCode = null) {
  const allowed = normalizeCountryList(user.allowedCountries);
  if (!countryCode || !allowed.length || allowed.includes('ALL')) return true;
  return allowed.includes(String(countryCode || '').trim().toUpperCase());
}

function userAllowsQueue(user = {}, queueKey = '') {
  const normalizedQueue = String(queueKey || '').trim().toLowerCase();
  if (!normalizedQueue) return true;
  const allowed = normalizeQueueList(user.allowedQueues);
  return !allowed.length || allowed.includes(normalizedQueue);
}

export function advisorQueueLabel(queueKey = '') {
  switch (String(queueKey || '').trim().toLowerCase()) {
    case 'b2b': return 'B2B / Corporativo';
    case 'agenda': return 'Agenda';
    case 'postventa': return 'Postventa';
    case 'pagos': return 'Pagos';
    default: return 'Comercial';
  }
}

function isCorporateConversation(conversation = {}) {
  const haystack = normalizeLooseText([
    conversation?.motivo_handoff,
    conversation?.subestado_flujo,
    conversation?.paso_actual,
    conversation?.resumen,
    conversation?.intencion_principal,
  ].filter(Boolean).join(' '));
  if (!haystack) return false;
  return haystack.includes('corporativo')
    || haystack.includes('empresa')
    || haystack.includes('b2b')
    || haystack.includes('asesor corporativo')
    || haystack.includes('contacto corporativo');
}

export function resolveAdvisorQueue({ conversation } = {}) {
  const haystack = normalizeLooseText([
    conversation?.motivo_handoff,
    conversation?.subestado_flujo,
    conversation?.paso_actual,
    conversation?.resumen,
    conversation?.intencion_principal,
  ].filter(Boolean).join(' '));
  if (!haystack) return 'comercial';

  if (isCorporateConversation(conversation)) return 'b2b';

  const hasKeyword = (keywords = []) => keywords.some((keyword) => haystack.includes(keyword));
  if (hasKeyword(['boleta', 'boletas', 'pago', 'pagos', 'abono', 'deposito', 'factura', 'facturacion', 'caja', 'comprobante'])) return 'pagos';
  if (hasKeyword(['agenda', 'agendar', 'agendamiento', 'reprogram', 'calendario', 'cita', 'horario'])) return 'agenda';
  if (hasKeyword(['postventa', 'garantia', 'garantias', 'soporte tecnico', 'falla', 'mantenimiento', 'incidencia'])) return 'postventa';
  return 'comercial';
}

export function isPreferredB2BAdvisor(user = {}, countryCode = null) {
  const normalizedCountry = String(countryCode || '').trim().toUpperCase() || 'PE';
  const email = normalizeEmail(user.email || '');
  const code = String(user.employeeCode || '').trim().toUpperCase();
  const name = normalizeLooseText(user.name || '');
  if (normalizedCountry === 'PE') {
    return email === 'antonio.milla@evinka.tech' || code === 'ANTONIO' || name === 'antonio';
  }
  return false;
}

function isPrimaryPeCommercialAdvisor(user = {}) {
  const email = normalizeEmail(user.email || '');
  const code = String(user.employeeCode || '').trim().toUpperCase();
  const phone = normalizeNotificationPhone(user.notificationPhone || user.phone || '');
  return email === 'luis.campos@evinka.tech'
    || email === 'raul.flores@evinka.tech'
    || code === 'LUIS'
    || code === 'RAUL'
    || phone === '51904432138'
    || phone === '51923587116';
}

function isGeneralAdvisorWatcher(user = {}, countryCode = null) {
  const normalizedCountry = String(countryCode || '').trim().toUpperCase() || 'PE';
  if (normalizedCountry === 'PE') {
    return isPrimaryPeCommercialAdvisor(user);
  }
  if (isPreferredB2BAdvisor(user, countryCode)) return false;
  const role = String(user.role || '').trim().toLowerCase();
  if (role === 'admin' || role === 'supervisor') return true;
  const allowed = normalizeQueueList(user.allowedQueues);
  return !allowed.length || allowed.includes('comercial') || allowed.includes('b2b');
}

function prioritizeAdvisorRecipients(recipients = [], { queueKey = '', countryCode = null } = {}) {
  const normalizedQueue = String(queueKey || '').trim().toLowerCase();
  const list = [...recipients];
  if (normalizedQueue === 'b2b') {
    list.sort((a, b) => {
      const aPreferred = isPreferredB2BAdvisor(a, countryCode) ? 1 : 0;
      const bPreferred = isPreferredB2BAdvisor(b, countryCode) ? 1 : 0;
      if (aPreferred !== bPreferred) return bPreferred - aPreferred;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    return list;
  }
  list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  return list;
}

function dedupeUsers(users = []) {
  const seen = new Set();
  return users.filter((user) => {
    const key = String(user.id || user.email || user.notificationPhone || user.name || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function resolveAdvisorAlertRecipients(users = [], { countryCode = null, queueKey = '' } = {}) {
  const normalizedQueue = String(queueKey || '').trim().toLowerCase();
  const baseRecipients = normalizeOperationalUsers(users).filter((user) => (
    user.status === 'active'
    && isAdvisorAlertRole(user)
    && userAllowsCountry(user, countryCode)
    && user.notificationPhone
  ));
  if (!normalizedQueue) {
    return prioritizeAdvisorRecipients(
      baseRecipients.filter((user) => isGeneralAdvisorWatcher(user, countryCode)),
      { queueKey: 'comercial', countryCode },
    );
  }

  if (normalizedQueue === 'b2b') {
    const generalWatchers = baseRecipients.filter((user) => isGeneralAdvisorWatcher(user, countryCode));
    const b2bSpecialists = baseRecipients.filter((user) => {
      if (isPreferredB2BAdvisor(user, countryCode)) return true;
      const allowed = normalizeQueueList(user.allowedQueues);
      return allowed.includes('b2b');
    });
    return prioritizeAdvisorRecipients(dedupeUsers([...generalWatchers, ...b2bSpecialists]), { queueKey: normalizedQueue, countryCode });
  }

  const nonB2BRecipients = baseRecipients.filter((user) => (
    isGeneralAdvisorWatcher(user, countryCode)
    && userAllowsQueue(user, normalizedQueue)
  ));
  return prioritizeAdvisorRecipients(nonB2BRecipients, { queueKey: normalizedQueue, countryCode });
}
