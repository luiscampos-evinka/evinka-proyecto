function cleanTextValue(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalize(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function titleCase(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/\b([a-záéíóúüñ])/g, (match) => match.toUpperCase());
}

function normalizeDisplayName(value = '') {
  const cleaned = String(value || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  if (/^\+?\d[\d\s()-]{6,}$/.test(cleaned)) return '';
  if (cleaned.length < 2) return '';
  return cleaned.slice(0, 80);
}

const CORPORATE_COMPANY_HINTS = [
  'Astara',
  'Grupo Pana',
  'Telemundo',
  'IPESA',
  'Geely Wigo',
  'La Positiva',
  'Toyota',
  'Geely',
  'BYD',
  'BMW',
  'MINI',
  'Volvo',
  'Subaru',
  'Chery',
  'Omoda',
  'Edificio Corporativo',
  'Corporativo',
];

const CORPORATE_CONTEXT_HINTS = [
  'empresa',
  'cuenta corporativa',
  'corporativo',
  'flota',
  'sede',
  'sedes',
  'concesionario',
  'dealer',
  'operador de grifo',
  'grifo',
  'estacion de servicio',
  'estación de servicio',
  'varios cargadores',
  'varias estaciones',
  'nuestra empresa',
  'nuestro local',
  'nuestra sede',
  'cliente corporativo',
  'parque automotor',
  'ruc empresa',
  'nit empresa',
];

const CONSUMER_CONTEXT_HINTS = [
  'voy a comprar',
  'estoy comprando',
  'quiero comprar',
  'me voy a comprar',
  'para mi casa',
  'en mi casa',
  'en mi cochera',
  'en mi domicilio',
  'para mi departamento',
  'mi direccion',
  'mi dirección',
  'mi recibo',
  'recibo de luz',
  'quiero instalar',
  'quiero cotizar',
  'quiero agendar',
  'quiero evaluar',
  'coordinar una visita',
  'mi vehiculo',
  'mi vehículo',
  'mi carro',
  'mi auto',
  'vehiculo geely',
  'vehículo geely',
  'vehiculo byd',
  'vehículo byd',
];

const STRONG_CORPORATE_PATTERNS = [
  /\bsoy\s+[^,.\n]{1,80}\s+(?:de|desde)\s+[^,.\n]{2,80}/i,
  /\bhabl[oa]\s+[^,.\n]{1,80}\s+(?:de|desde)\s+[^,.\n]{2,80}/i,
  /\bmi nombre es\s+[^,.\n]{1,80}\s+(?:de|desde)\s+[^,.\n]{2,80}/i,
  /\b(?:somos|escribo|te escribo|escribimos|contacto)\s+(?:de|desde)\s+[^,.\n]{2,80}/i,
  /\b(?:necesitamos|queremos)\b[^.\n]{0,80}\b(?:empresa|flota|sede|sedes|concesionario|dealer|operador|grifo)\b/i,
  /\b(?:varios|m[úu]ltiples|varias)\s+(?:cargadores|veh[ií]culos|sedes|estaciones)\b/i,
];

const CORPORATE_SUFFIX_RE = /\b(sac|s\.a\.?c\.?|s\.a\.?|srl|eirl|corp|corporation|company|empresa|holding)\b/i;

function cleanCorporateName(value = '') {
  const cleaned = cleanTextValue(value)
    .replace(/^(la\s+empresa|empresa|cuenta\s+corporativa|cuenta)\s+/i, '')
    .replace(/\s+(?:y|para)\s+(?:queremos|necesitamos|buscamos|deseamos|solicitamos|cotizar|coordinar|evaluar)\b.*$/i, '')
    .replace(/[.,;:!?]+$/g, '')
    .trim();
  const exactHint = CORPORATE_COMPANY_HINTS.find((item) => normalize(cleaned).includes(normalize(item)));
  if (exactHint) return exactHint;
  return cleaned === cleaned.toLowerCase() ? titleCase(cleaned) : cleaned;
}

function findCorporateHint(normalized = '') {
  return CORPORATE_COMPANY_HINTS.find((item) => normalized.includes(normalize(item))) || null;
}

function countHintMatches(normalized = '', hints = []) {
  return hints.filter((item) => normalized.includes(normalize(item))).length;
}

function companyLooksCorporate(value = '') {
  const cleaned = cleanTextValue(value);
  const normalized = normalize(cleaned);
  if (!normalized) return false;
  return Boolean(
    CORPORATE_SUFFIX_RE.test(cleaned)
    || findCorporateHint(normalized)
    || CORPORATE_CONTEXT_HINTS.some((item) => normalized.includes(normalize(item)))
  );
}

function classifyCorporateLead(text = '') {
  const raw = cleanTextValue(text);
  const normalized = normalize(raw);
  if (!normalized) {
    return { route: 'bot', corporateLead: null, corporateScore: 0, consumerScore: 0, reasons: ['empty'] };
  }

  const reasons = [];
  let corporateScore = 0;
  let consumerScore = 0;

  const namedMatch = raw.match(/(?:^|\b)(?:hola|buenas|buen dia|buen día|buenas tardes|buenas noches)?\s*(?:soy|habla|hablo|mi nombre es)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ'´`.-]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'´`.-]+){0,3})\s+(?:de|desde)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9&().,\-/ ]{2,80})/i);
  if (namedMatch && companyLooksCorporate(namedMatch[2])) {
    reasons.push('explicit_company_intro');
    corporateScore += 5;
  }

  const companyOnlyMatch = raw.match(/(?:^|\b)(?:somos|escribo|te escribo|escribimos|contacto)\s+(?:de|desde)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9&().,\-/ ]{2,80})/i);
  if (companyOnlyMatch && companyLooksCorporate(companyOnlyMatch[1])) {
    reasons.push('company_origin_intro');
    corporateScore += 4;
  }

  const strongPatternHits = STRONG_CORPORATE_PATTERNS.filter((pattern) => pattern.test(raw)).length;
  if (strongPatternHits) {
    reasons.push(`strong_patterns:${strongPatternHits}`);
    corporateScore += Math.min(4, strongPatternHits * 2);
  }

  const corporateContextHits = countHintMatches(normalized, CORPORATE_CONTEXT_HINTS);
  if (corporateContextHits) {
    reasons.push(`corporate_context:${corporateContextHits}`);
    corporateScore += Math.min(4, corporateContextHits * 2);
  }

  const corporateHint = findCorporateHint(normalized);
  if (corporateHint) {
    reasons.push(`company_hint:${corporateHint}`);
    if (corporateContextHits || namedMatch || companyOnlyMatch) {
      corporateScore += 2;
    }
  }

  if (CORPORATE_SUFFIX_RE.test(raw)) {
    reasons.push('corporate_suffix');
    corporateScore += 3;
  }

  const consumerContextHits = countHintMatches(normalized, CONSUMER_CONTEXT_HINTS);
  if (consumerContextHits) {
    reasons.push(`consumer_context:${consumerContextHits}`);
    consumerScore += Math.min(4, consumerContextHits * 2);
  }

  if (/\b(?:mi|para mi|en mi)\b/.test(normalized)) {
    reasons.push('first_person_consumer');
    consumerScore += 1;
  }

  if (/\b(?:comprar|comprando|cotizar|agendar|evaluar|instalar)\b/.test(normalized) && /\b(?:vehiculo|veh[ií]culo|carro|auto|cargador|visita)\b/.test(normalized)) {
    reasons.push('consumer_flow_intent');
    consumerScore += 2;
  }

  const explicitCorporateLead = corporateScore >= 4 && (reasons.includes('explicit_company_intro') || reasons.includes('company_origin_intro') || reasons.includes('corporate_suffix'));
  const shouldRouteB2B = explicitCorporateLead || (corporateScore >= 4 && corporateScore > consumerScore);

  if (!shouldRouteB2B) {
    return {
      route: 'bot',
      corporateLead: null,
      corporateScore,
      consumerScore,
      reasons,
    };
  }

  const contactName = namedMatch ? titleCase(normalizeDisplayName(namedMatch[1])) : '';
  const companyName = namedMatch
    ? cleanCorporateName(namedMatch[2])
    : companyOnlyMatch
      ? cleanCorporateName(companyOnlyMatch[1])
      : corporateHint
        ? cleanCorporateName(corporateHint)
        : '';
  const reason = reasons.includes('explicit_company_intro')
    ? 'intro_de_empresa'
    : reasons.includes('company_origin_intro')
      ? 'empresa_directa'
      : companyName
        ? 'empresa_conocida'
        : 'contexto_corporativo';

  return {
    route: 'advisor_b2b',
    corporateScore,
    consumerScore,
    reasons,
    corporateLead: {
      contactName,
      companyName,
      reason,
      confidence: corporateScore >= 6 ? 'high' : 'medium',
    },
  };
}

export function detectCorporateLead(text = '') {
  return classifyCorporateLead(text).corporateLead;
}

export function classifyRoutingTarget(text = '') {
  return classifyCorporateLead(text);
}
