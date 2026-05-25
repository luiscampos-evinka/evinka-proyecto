import { createHash } from 'node:crypto';
import { detectCorporateLead } from './chatRouting.mjs';

const MENU = `¡Hola! 👋
Bienvenido a EVINKA.

Actualmente estamos probando una nueva automatización para atenderte más rápido.

Si ya habías conversado antes con un asesor de EVINKA, o tienes una cotización / caso pendiente de seguimiento, solo escribe *ASESOR* y te derivaremos para revisar tu caso directamente.

Te puedo ayudar con una de estas opciones:

A. Instalar un cargador
B. Reprogramar visita
C. Cancelar visita
D. Asistencia técnica
E. Soporte humano
Por favor responde con la letra de la opción que deseas.`;

const CONSENT = `Perfecto 👍

Para continuar, primero necesitaremos tu documento de identidad o tributario (por ejemplo DNI, cédula, RUC o NIT) y un recibo de luz actualizado. Con esa información podremos validar la potencia contratada y confirmar la dirección donde se realizará la instalación.

Luego coordinaremos una visita técnica con nuestro equipo especializado para evaluar la viabilidad de la instalación, las condiciones del sitio y los requerimientos técnicos.

Con esa evaluación podremos preparar una cotización precisa y adecuada para tu caso.

Antes de continuar, EVINKA usará los datos y documentos que nos compartas únicamente para:

- evaluar tu instalación
- coordinar tu visita técnica
- preparar tu cotización

¿Autorizas este uso para esa finalidad?

A. Sí, autorizo
B. No autorizo

Por favor responde con la letra de la opción que deseas.`;

const NO_CONSENT = `Entendido 👍

Sin tu autorización no puedo continuar con la evaluación, la visita técnica ni la preparación de una cotización por este medio.

Si cambias de opinión más adelante, puedes volver a escribir y con gusto retomamos el proceso.

Si deseas, también puedes elegir una de estas opciones:

A. Volver al menú principal
B. Retomar luego con el bot

Por favor responde con la letra de la opción que deseas.`;

const BUY_MENU = `Perfecto 👍

Para ayudarte con la compra de un cargador, primero necesitamos definir qué tipo de instalación tienes y qué equipo realmente se puede instalar en tu caso.

Te puedo ayudar con una de estas opciones:

A. Agendar una visita técnica para evaluar qué cargador necesitas
B. Volver al menú principal

Por favor responde con la letra de la opción que deseas.`;

const SUPPORT_CASE_MENU = `Entendido 👍

¿Qué necesitas reportar?

A. Soporte técnico
B. Emergencia
C. Hablar con un asesor

Por favor responde con la letra de la opción que deseas.`;

const RECEIPT_MENU = `Perfecto 👍

Ahora necesito el recibo de luz para continuar con la evaluación de la instalación.

Puedes elegir una de estas opciones:

A. Enviar foto o PDF del recibo
B. Escribir los datos del recibo

Por favor responde con la letra de la opción que deseas.`;

const RECEIPT_MANUAL = `Perfecto 👍

Entonces envíame los datos del recibo. De preferencia incluye esto:

- dirección del suministro
- distrito
- provincia
- potencia contratada

Si deseas, puedes enviarlo así:

Dirección del suministro: Av. Los Ingenieros 845
Distrito: La Molina
Provincia: Lima
Potencia contratada: 7.4 kW

No es obligatorio copiar exactamente ese formato, pero sí necesito que esos datos se entiendan con claridad para continuar.`;

const WHO_RECEIVES = `Gracias, ya tengo el recibo 👍

Paso 2 de 5: persona que recibirá la visita

Ahora necesito confirmar algo importante:

A. Yo mismo voy a recibir al técnico
B. Otra persona va a recibir al técnico

Por favor responde con la letra de la opción que deseas.`;

const PRE_AGENDA = `Perfecto. Ya tengo lo necesario para continuar ✅

Antes de agendar, te explico brevemente qué haremos en la visita técnica:

- revisaremos el tablero eléctrico
- veremos la distancia hasta el punto de carga
- validaremos el lugar donde iría el cargador
- revisaremos si hay condiciones adecuadas para instalar
- y con eso prepararemos la cotización

La visita dura 45 minutos.

¿Deseas agendar la visita técnica?

A. Sí
B. No por ahora

Por favor responde con la letra de la opción que deseas.`;

const NO_AGENDA = `Entendido 👍

No agendaremos la visita técnica por ahora.

Cuando lo desees más adelante, puedes volver a escribir y con gusto retomamos el proceso desde este punto.

Si deseas, también puedes elegir una de estas opciones:

A. Volver al menú principal
B. Retomar luego con el bot

Por favor responde con la letra de la opción que deseas.`;

const COUNTRY_PROMPT = `Perfecto 👍

Antes de continuar, indícame desde qué país estás haciendo esta solicitud para usar el flujo correcto.

A. Perú
B. Colombia

Por favor responde con la letra de la opción que deseas.`;

const CO_LOCATION_PROMPT = `¡Perfecto! 👌

Para mostrarte los horarios disponibles, necesito tu localidad 📍
Selecciona la opción donde se encuentre tu localidad.`;

const CO_OTHER_CITY_PROMPT = `Aún no tenemos reserva automática para esa zona.

Si quieres, prueba otra localidad o escríbenos al 3242853029.`;

const CO_ZONE_BOOKING_OPTIONS = [
  { id: 'CO_ZONE_OTHERS', title: 'Otras ciudades', description: 'Si no encuentras tu localidad o ciudad en la lista' },
  { id: 'CO_ZONE_1', title: 'Suba-Usaquén', zone: 'ÁREA 1 — SUBA–USAQUÉN', locality: 'Suba / Usaquén', description: 'Suba, Usaquén' },
  { id: 'CO_ZONE_2', title: 'Chapinero-Barrios Unidos-Teusaquillo', zone: 'ÁREA 2 — CHAPINERO–BARRIOS UNIDOS–TEUSAQUILLO', locality: 'Chapinero / Barrios Unidos / Teusaquillo', description: 'Chapinero, Barrios Unidos, Teusaquillo' },
  { id: 'CO_ZONE_3', title: 'Engativá-Fontibón', zone: 'ÁREA 3 — ENGATIVÁ–FONTIBÓN', locality: 'Engativá / Fontibón', description: 'Engativá, Fontibón' },
  { id: 'CO_ZONE_4', title: 'Kennedy-Puente Aranda-Bosa', zone: 'ÁREA 4 — KENNEDY–PUENTE ARANDA–BOSA', locality: 'Kennedy / Puente Aranda / Bosa / Soacha / Sibaté', description: 'Kennedy, Puente Aranda, Bosa, Soacha, Sibaté' },
  { id: 'CO_ZONE_5', title: 'La Candelaria-Santa Fe-Los Mártires', zone: 'ÁREA 5 — LA CANDELARIA–SANTA FE–LOS MÁRTIRES–ANTONIO NARIÑO–RAFAEL URIBE URIBE', locality: 'La Candelaria / Santa Fe / Los Mártires / Antonio Nariño / Rafael Uribe Uribe', description: 'La Candelaria, Santa Fe, Los Mártires, Antonio Nariño, Rafael Uribe Uribe' },
  { id: 'CO_ZONE_6', title: 'Mosquera-Funza-Tenjo-Cota', zone: 'ÁREA 6 — MOSQUERA–FUNZA–TENJO–COTA', locality: 'Mosquera / Funza / Tenjo / Cota', description: 'Mosquera, Funza, Tenjo, Cota' },
  { id: 'CO_ZONE_7', title: 'Chía-Cajicá-Sopó', zone: 'ÁREA 7 — CHÍA–CAJICÁ–SOPÓ', locality: 'Chía / Cajicá / Sopó', description: 'Chía, Cajicá, Sopó' },
  { id: 'CO_ZONE_8', title: 'La Calera-Usme-San Cristóbal', zone: 'ÁREA 8 — LA CALERA–USME–SAN CRISTÓBAL–TUNJUELITO–CIUDAD BOLÍVAR', locality: 'La Calera / Usme / San Cristóbal / Tunjuelito / Ciudad Bolívar', description: 'La Calera, Usme, San Cristóbal, Tunjuelito, Ciudad Bolívar' },
];

const NORTH = ['ancón','carabayllo','comas','independencia','los olivos','puente piedra','san martín de porres','santa rosa','callao','bellavista','carmen de la legua-reynoso','la perla','la punta','ventanilla','mi perú','rímac'];
const CENTER = ['breña','jesús maría','la victoria','lima','lima cercado','cercado de lima','lince','magdalena del mar','pueblo libre','san borja','san isidro','san luis','santiago de surco','surquillo','barranco','miraflores','san miguel'];
const EAST = ['ate','chaclacayo','cieneguilla','el agustino','la molina','lurigancho','chosica','san juan de lurigancho','santa anita'];
const SOUTH = ['lurín','pachacámac','pucusana','punta hermosa','punta negra','san bartolo','san juan de miraflores','santa maría del mar','villa el salvador','villa maría del triunfo','chorrillos'];

const CO_BOGOTA_AREA_1_SUBA_USAQUEN = ['Suba','Usaquén'];
const CO_BOGOTA_AREA_2_CHAPINERO_BARRIOS_UNIDOS_TEUSAQUILLO = ['Chapinero','Barrios Unidos','Teusaquillo'];
const CO_BOGOTA_AREA_3_ENGATIVA_FONTIBON = ['Engativá','Fontibón'];
const CO_BOGOTA_AREA_4_KENNEDY_PUENTE_ARANDA_BOSA = ['Kennedy','Puente Aranda','Bosa','Soacha','Sibaté'];
const CO_BOGOTA_AREA_5_CANDELARIA_SANTA_FE_MARTIRES_ANTONIO_NARINO_RUU = ['La Candelaria','Santa Fe','Los Mártires','Antonio Nariño','Rafael Uribe Uribe'];
const CO_BOGOTA_AREA_6_MOSQUERA_FUNZA_TENJO_COTA = ['Mosquera','Funza','Tenjo','Cota'];
const CO_BOGOTA_AREA_7_CHIA_CAJICA_SOPO = ['Chía','Cajicá','Sopó'];
const CO_BOGOTA_AREA_8_LA_CALERA_USME_SAN_CRISTOBAL_TUNJUELITO_CIUDAD_BOLIVAR = ['La Calera','Usme','San Cristóbal','Tunjuelito','Ciudad Bolívar'];

const CO_MEDELLIN_NORTE = ['Popular','Santa Cruz','Manrique','Aranjuez','Castilla','Doce de Octubre','Robledo Norte','Moravia','Bello','Niquía','Copacabana','Girardota','Barbosa','Machado','Acevedo','Castillita','La Francia','Andalucía','Kennedy','Picacho','Castilla Central','Pedregal','Florencia','Boyacá Las Brisas','Villa Guadalupe','San Pablo','Granizal'];
const CO_MEDELLIN_CENTRO = ['La Candelaria','Boston','Prado Centro','Villa Hermosa','Buenos Aires','San Benito','Corazón de Jesús','Perpetuo Socorro','Estación Villa','Bomboná','San Diego','Colón','Naranjal','San Joaquín','Carlos E. Restrepo','Laureles','Estadio','Conquistadores','Bolivariana','Lorena','Belén Rosales','Belén Alameda','La América','Calasanz','Floresta','Santa Lucía','Simón Bolívar','Velódromo','Suramericana'];
const CO_MEDELLIN_SUR = ['El Poblado','Belén','Guayabal','Cristo Rey','Campo Amor','Trinidad','Manila','Provenza','Castropol','Patio Bonito','Loma de los Bernal','Altavista','San Antonio de Prado','Envigado','Sabaneta','Itagüí','La Estrella','Caldas','Las Palmas','El Tesoro','La Aguacatala','Ciudad del Río','Parque Lleras','Santa María de los Ángeles','Los Balsos','Alejandría'];
const CO_MEDELLIN_ORIENTE = ['Villa Hermosa','Buenos Aires Oriental','Caicedo','Loreto','Miraflores','Cataluña','La Sierra','8 de Marzo','Enciso','La Libertad','Villatina','San Miguel','Pacífico','Bomboná Oriental'];

const CO_CALI_NORTE = ['Granada','Versalles','La Flora','Chipichape','Vipasa','Menga','Brisas de los Álamos','Sameco','Salomia','Prados del Norte','San Vicente','Santa Mónica','Juanambú','Centenario','La Campiña','Los Álamos','Flora Industrial','Calima','Petecuy','Los Guaduales','Floralia','Paso del Comercio','Puerto Mallarino','Yumbo'];
const CO_CALI_CENTRO = ['Centro','San Nicolás','El Peñón','San Antonio','San Cayetano','La Merced','Santa Rosa','Miraflores','Alameda','Sucre','Bretaña','Champagnat','Tequendama','San Fernando','Cristales','Aranjuez','Junín','El Cedro','El Lido','Bellavista','Normandía','Colseguros','Nueva Granada'];
const CO_CALI_SUR = ['Ciudad Jardín','Pance','Valle del Lili','Caney','Bochalema','Capri','Meléndez','Ciudad Córdoba','El Ingenio','Mayapán','Multicentro','La Hacienda','Santa Anita','Ciudad 2000','Limonar','Refugio','Pampalinda','Cañaveralejo','Buenos Aires','Las Vegas','Ciudad Pacífica','Jamundí','Alfaguara','Hacienda El Castillo'];
const CO_CALI_ORIENTE = ['Aguablanca','Marroquín','Mojica','Compartir','El Retiro','Los Mangos','Siete de Agosto','Potrero Grande','Charco Azul','Calipso','Antonio Nariño','Desepaz','Distrito de Aguablanca','Los Lagos','Pízamos','Manuela Beltrán','República de Israel','El Pondaje','Villa del Sur','Puerto Rellena','Mariano Ramos'];

const PERU_ZONES = {
  'LIMA NORTE': NORTH,
  'LIMA CENTRO': CENTER,
  'LIMA ESTE': EAST,
  'LIMA SUR': SOUTH,
};

const COLOMBIA_ZONES = {
  'ÁREA 1 — SUBA–USAQUÉN': CO_BOGOTA_AREA_1_SUBA_USAQUEN,
  'ÁREA 2 — CHAPINERO–BARRIOS UNIDOS–TEUSAQUILLO': CO_BOGOTA_AREA_2_CHAPINERO_BARRIOS_UNIDOS_TEUSAQUILLO,
  'ÁREA 3 — ENGATIVÁ–FONTIBÓN': CO_BOGOTA_AREA_3_ENGATIVA_FONTIBON,
  'ÁREA 4 — KENNEDY–PUENTE ARANDA–BOSA': CO_BOGOTA_AREA_4_KENNEDY_PUENTE_ARANDA_BOSA,
  'ÁREA 5 — LA CANDELARIA–SANTA FE–LOS MÁRTIRES–ANTONIO NARIÑO–RAFAEL URIBE URIBE': CO_BOGOTA_AREA_5_CANDELARIA_SANTA_FE_MARTIRES_ANTONIO_NARINO_RUU,
  'ÁREA 6 — MOSQUERA–FUNZA–TENJO–COTA': CO_BOGOTA_AREA_6_MOSQUERA_FUNZA_TENJO_COTA,
  'ÁREA 7 — CHÍA–CAJICÁ–SOPÓ': CO_BOGOTA_AREA_7_CHIA_CAJICA_SOPO,
  'ÁREA 8 — LA CALERA–USME–SAN CRISTÓBAL–TUNJUELITO–CIUDAD BOLÍVAR': CO_BOGOTA_AREA_8_LA_CALERA_USME_SAN_CRISTOBAL_TUNJUELITO_CIUDAD_BOLIVAR,
  'MEDELLÍN NORTE': CO_MEDELLIN_NORTE,
  'MEDELLÍN CENTRO': CO_MEDELLIN_CENTRO,
  'MEDELLÍN SUR': CO_MEDELLIN_SUR,
  'MEDELLÍN ORIENTE': CO_MEDELLIN_ORIENTE,
  'CALI NORTE': CO_CALI_NORTE,
  'CALI CENTRO': CO_CALI_CENTRO,
  'CALI SUR': CO_CALI_SUR,
  'CALI ORIENTE': CO_CALI_ORIENTE,
};

const COLOMBIA_CITY_HINTS = {
  BOGOTA: ['Bogotá','Bogota','Bogotá D.C.','Bogota D.C.','Cundinamarca','Chía','Cajicá','Zipaquirá','Cota','Sopó','La Calera','Funza','Mosquera','Madrid','Facatativá','Soacha'],
  MEDELLIN: ['Medellín','Medellin','Antioquia','Bello','Niquía','Copacabana','Girardota','Barbosa','Envigado','Sabaneta','Itagüí','La Estrella','Caldas'],
  CALI: ['Cali','Valle del Cauca','Jamundí','Yumbo','Alfaguara'],
};

const KNOWN_DISTRICTS = [...new Set([...NORTH, ...CENTER, ...EAST, ...SOUTH])].sort((a, b) => b.length - a.length);
const KNOWN_PROVINCES = ['lima', 'callao'];
const VEHICLE_MODEL_SHORT_ALLOWLIST = new Set(['ev', 'bev', 'phev', 'gt', 'gts', 'gl', 'gx', 'rs', 'suv', 'up']);
const LIMA_TIMEZONE = 'America/Lima';
const FLOW_ACTIVE_MEMORY_WINDOW_MS = 15 * 60 * 1000;
const FLOW_RESET_WINDOW_MS = 24 * 60 * 60 * 1000;
const ADVISOR_SHORTCUTS = new Set([
  'asesor',
  'asesora',
  'hablar con asesor',
  'hablar con un asesor',
  'agente',
  'humano',
  'persona',
  'ayuda humana',
]);
const COLOMBIA_SHARED_TECH_CAPACITY = 3;
const TEST_FLOW_PHONE_ALLOWLIST = new Set(['573028564794']);

function normalizePhoneDigits(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function isTestFlowPhone(value = '') {
  return TEST_FLOW_PHONE_ALLOWLIST.has(normalizePhoneDigits(value));
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

function hasKnownCustomerName(user = null, profile = null, fallbackName = '') {
  return Boolean(
    normalizeDisplayName(profile?.nombre_receptor)
    || normalizeDisplayName(user?.nombre_visible)
    || normalizeDisplayName(user?.nombre_usuario)
    || normalizeDisplayName(fallbackName)
  );
}

function toMeridiemLabel(time = '') {
  const [hourRaw = '0', minute = '00'] = String(time || '').split(':');
  const hour = Number(hourRaw);
  const suffix = hour >= 12 ? 'p. m.' : 'a. m.';
  const normalizedHour = hour % 12 || 12;
  return `${normalizedHour}:${minute} ${suffix}`;
}

function makeSlots(ranges = []) {
  return ranges.map((range, index) => {
    const [start, end] = String(range || '').split('-');
    const startTime = `${start}:00`;
    const endTime = `${end}:00`;
    return {
      code: String.fromCharCode(65 + index),
      label: `${toMeridiemLabel(startTime)} - ${toMeridiemLabel(endTime)}`,
      time: startTime,
      endTime,
    };
  });
}

const PE_VISIT_DURATION_MINUTES = Number(process.env.PE_VISIT_DURATION_MINUTES || 45);
const PE_TRAVEL_BUFFER_MINUTES = Number(process.env.PE_TRAVEL_BUFFER_MINUTES || 45);

const SLOT_TEMPLATES = {
  lunes: makeSlots(['10:00-10:45', '11:30-12:15', '14:00-14:45', '15:30-16:15']),
  martes: makeSlots(['10:00-10:45', '11:30-12:15']),
  miercoles: makeSlots(['10:00-10:45', '11:30-12:15', '14:00-14:45', '15:30-16:15']),
  jueves: makeSlots(['10:00-10:45', '11:30-12:15']),
  viernes: makeSlots(['10:00-10:45', '11:30-12:15', '14:00-14:45', '15:30-16:15']),
};

const COLOMBIA_ZONE_SLOT_TEMPLATES = {
  'ÁREA 1 — SUBA–USAQUÉN': {
    lunes: makeSlots(['08:00-09:00', '10:00-11:00']),
    martes: makeSlots(['13:00-14:00', '15:00-16:00']),
    miercoles: makeSlots(['08:00-09:00', '10:00-11:00']),
    jueves: makeSlots(['13:00-14:00', '15:00-16:00']),
    viernes: makeSlots(['08:00-09:00', '10:00-11:00']),
    sabado: makeSlots(['08:00-09:00', '10:00-11:00']),
  },
  'ÁREA 2 — CHAPINERO–BARRIOS UNIDOS–TEUSAQUILLO': {
    lunes: makeSlots(['13:00-14:00', '15:00-16:00']),
    martes: makeSlots(['08:00-09:00', '10:00-11:00']),
    miercoles: makeSlots(['13:00-14:00']),
    jueves: makeSlots(['10:00-11:00']),
    viernes: makeSlots(['13:00-14:00', '15:00-16:00']),
    sabado: makeSlots(['08:00-09:00', '10:00-11:00']),
  },
  'ÁREA 3 — ENGATIVÁ–FONTIBÓN': {
    lunes: makeSlots(['08:00-09:00', '15:00-16:00']),
    martes: makeSlots(['15:00-16:00']),
    miercoles: makeSlots(['08:00-09:00', '13:00-14:00']),
    jueves: makeSlots(['10:00-11:00', '15:00-16:00']),
    viernes: makeSlots(['08:00-09:00', '15:00-16:00']),
    sabado: makeSlots(['08:00-09:00']),
  },
  'ÁREA 4 — KENNEDY–PUENTE ARANDA–BOSA': {
    lunes: makeSlots(['15:00-16:00']),
    martes: makeSlots(['08:00-09:00']),
    miercoles: makeSlots(['15:00-16:00']),
    jueves: makeSlots(['08:00-09:00']),
    viernes: makeSlots(['15:00-16:00']),
    sabado: makeSlots(['08:00-09:00']),
  },
  'ÁREA 5 — LA CANDELARIA–SANTA FE–LOS MÁRTIRES–ANTONIO NARIÑO–RAFAEL URIBE URIBE': {
    lunes: makeSlots(['15:00-16:00']),
    martes: makeSlots(['08:00-09:00']),
    miercoles: makeSlots(['15:00-16:00']),
    jueves: makeSlots(['08:00-09:00']),
    viernes: makeSlots(['15:00-16:00']),
    sabado: makeSlots(['08:00-09:00']),
  },
  'ÁREA 6 — MOSQUERA–FUNZA–TENJO–COTA': {
    miercoles: makeSlots(['13:00-14:00']),
    jueves: makeSlots(['10:00-11:00']),
    sabado: makeSlots(['08:00-09:00']),
  },
  'ÁREA 7 — CHÍA–CAJICÁ–SOPÓ': {
    lunes: makeSlots(['08:00-09:00']),
    martes: makeSlots(['15:00-16:00']),
    miercoles: makeSlots(['08:00-09:00']),
    jueves: makeSlots(['15:00-16:00']),
    viernes: makeSlots(['08:00-09:00']),
    sabado: makeSlots(['08:00-09:00']),
  },
  'ÁREA 8 — LA CALERA–USME–SAN CRISTÓBAL–TUNJUELITO–CIUDAD BOLÍVAR': {
    lunes: makeSlots(['15:00-16:00']),
    martes: makeSlots(['08:00-09:00']),
    viernes: makeSlots(['15:00-16:00']),
  },
};

function normalize(s = '') {
  return s
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function cleanTextValue(s = '') {
  return s.toString().replace(/\s+/g, ' ').trim();
}

function stripNoiseLine(s = '') {
  return cleanTextValue(s)
    .replace(/^[\-•·*✅☑️✔️👉📍📌🧾🚗📧📱☎️🔹🔸◦]+\s*/g, '')
    .replace(/^(dato|datos|info|informacion|información|mi|mis)\s*[:\-]\s*/i, '')
    .replace(/^(nombre|dni|ruc|doc|documento|telefono|teléfono|cel|celular|correo|email|marca|modelo|tipo|direccion|dirección|distrito|provincia|potencia)\s*[:\-]\s*/i, (m) => m.toLowerCase().includes('nombre') || m.toLowerCase().includes('marca') || m.toLowerCase().includes('modelo') || m.toLowerCase().includes('direccion') || m.toLowerCase().includes('dirección') || m.toLowerCase().includes('distrito') || m.toLowerCase().includes('provincia') || m.toLowerCase().includes('potencia') ? m : '')
    .trim();
}

function isLikelyNoiseLine(s = '') {
  const v = normalize(s);
  if (!v) return true;
  return [
    'hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches',
    'te paso', 'te envio', 'te envío', 'mis datos', 'mis datos son', 'datos', 'info',
    'gracias', 'ok', 'oki', 'listo', 'adjunto', 'ahi va', 'ahí va'
  ].includes(v);
}

function freeformLines(text = '') {
  return text
    .split(/\r?\n|[;|]+/)
    .map(x => stripNoiseLine(x))
    .filter(Boolean)
    .filter(x => !isLikelyNoiseLine(x));
}

function titleCase(s = '') {
  return cleanTextValue(s)
    .split(' ')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function cleanFieldValue(s = '') {
  return cleanTextValue(s)
    .replace(/^(nombre del titular|titular|direcci[oó]n del suministro|direcci[oó]n|direccion del suministro|direccion|distrito|provincia|potencia contratada|potencia)\s*[:\-]\s*/i, '');
}

function cleanPhone(s = '') {
  const cleaned = (s ?? '').toString().replace(/[^+\d]/g, '');
  if (cleaned.startsWith('++')) return cleaned.replace(/^\++/, '+');
  return cleaned;
}

function cleanDoc(s = '') {
  return s.toString().replace(/[^\d]/g, '');
}

function isValidPeruDni(value = '') {
  return /^\d{8}$/.test(cleanDoc(value));
}

function isValidPeruRuc(value = '') {
  return /^\d{11}$/.test(cleanDoc(value));
}

function isValidPeruDoc(value = '') {
  const doc = cleanDoc(value);
  return isValidPeruDni(doc) || isValidPeruRuc(doc);
}

function isValidLatamDoc(value = '') {
  const doc = cleanDoc(value);
  return /^\d{6,15}$/.test(doc);
}

function isValidSupportedDoc(value = '') {
  return isValidPeruDoc(value) || isValidLatamDoc(value);
}

function normalizeContactPhone(value = '') {
  const raw = cleanPhone(value);
  if (/^9\d{8}$/.test(raw)) return raw;
  if (/^51\d{9}$/.test(raw)) return `+${raw}`;
  if (/^\+51\d{9}$/.test(raw)) return raw;
  if (/^3\d{9}$/.test(raw)) return raw;
  if (/^57\d{10}$/.test(raw)) return `+${raw}`;
  if (/^\+57\d{10}$/.test(raw)) return raw;
  return null;
}

function isValidContactPhone(value = '') {
  return Boolean(normalizeContactPhone(value));
}

function isGreeting(text = '') {
  return ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'hello', 'hi'].includes(normalize(text));
}

function shouldResetFlowOnGreeting(step = '', text = '') {
  if (!isGreeting(text)) return false;
  return [
    'sin_agenda_por_ahora',
    'retomar_o_reiniciar',
    'cita_confirmada',
    'cita_reprogramada',
    'ticket_cancelado',
    'sin_autorizacion',
  ].includes(step);
}

const STEP_INTERACTIVE_CODE_MAP = {
  menu_principal: { menu_install: 'A', menu_reschedule: 'B', menu_cancel: 'C', menu_support: 'D', menu_human: 'E' },
  menu_principal_test: { menu_test_mode: 'F' },
  soporte_tipo: { support_technical: 'A', support_emergency: 'B', support_advisor: 'C' },
  soporte_equipo: { support_equipment_evinka: 'A', support_equipment_chargepoint: 'B', support_equipment_station: 'C', support_equipment_other: 'D' },
  soporte_evidencia_opcion: { support_evidence_yes: 'A', support_evidence_skip: 'B' },
  soporte_confirmacion: { support_submit: 'A', support_restart: 'B', support_human: 'C' },
  seleccion_pais: { country_pe: 'A', country_co: 'B' },
  compra_menu: { buy_schedule: 'A', buy_menu: 'B' },
  localidad_co_no_disponible: { co_retry_locality: 'A', menu_main: 'B' },
  consentimiento: { consent_yes: 'A', consent_no: 'B' },
  sin_autorizacion: { menu_main: 'A', continue_later: 'B' },
  opcion_recibo: { receipt_upload: 'A', receipt_manual: 'B' },
  confirmando_recibo_parcial: { receipt_complete_missing: 'A', receipt_resend: 'B' },
  confirmando_recibo: { receipt_continue: 'A', receipt_edit: 'B' },
  seleccionando_campo_recibo: { receipt_field_address: 'A', receipt_field_district: 'B', receipt_field_province: 'C', receipt_field_power: 'D' },
  quien_recibe_visita: { receiver_self: 'A', receiver_other: 'B' },
  confirmando_datos_receptor: { receiver_confirm: 'A', receiver_edit: 'B' },
  seleccionando_campo_receptor: { receiver_field_name: 'A', receiver_field_doc: 'B', receiver_field_phone: 'C', receiver_field_email: 'D' },
  confirmando_direccion_instalacion: { address_confirm: 'A', address_edit: 'B' },
  confirmando_vehiculo: { vehicle_confirm: 'A', vehicle_edit: 'B' },
  seleccionando_campo_vehiculo: { vehicle_field_brand: 'A', vehicle_field_model: 'B', vehicle_field_type: 'C' },
  capturando_datos_booking_residencial: { booking_doc_cc: 'A', booking_doc_nit: 'B', booking_doc_passport: 'C' },
  confirmando_datos_booking_residencial: { booking_confirm: 'A', booking_edit: 'B' },
  seleccionando_campo_booking_residencial: {
    booking_field_neighborhood: 'A',
    booking_field_address: 'B',
    booking_field_vehicle_brand: 'C',
    booking_field_name: 'D',
    booking_field_doc_type: 'E',
    booking_field_doc_number: 'F',
    booking_field_email: 'G',
    booking_field_phone: 'H',
  },
  confirmando_agendamiento: { schedule_yes: 'A', schedule_not_now: 'B' },
  sin_agenda_por_ahora: { menu_main: 'A', continue_later: 'B' },
  confirmando_ticket: { ticket_confirm: 'A', ticket_other: 'B' },
  accion_ticket: { ticket_reschedule: 'A', ticket_cancel: 'B' },
  sin_citas_encontradas: { retry_lookup: 'A', menu_main: 'B' },
  retomar_o_reiniciar: { resume_bot: 'A', menu_main: 'B' },
  esperando_timeout_asesor: { timeout_wait: 'A', timeout_menu: 'B' },
  handoff_asesor: { menu_main: 'A' },
  cita_confirmada: { menu_main: 'A', post_reschedule: 'B' },
  cita_reprogramada: { menu_main: 'A', post_reschedule: 'B' },
  ticket_cancelado: { menu_main: 'A', post_reschedule: 'B' },
  capturando_vehiculo: { vehicle_type_bev: 'A', vehicle_type_phev: 'B', vehicle_type_unsure: 'C' },
  recordatorio_cita: { reminder_confirm: 'A', reminder_reschedule: 'B', reminder_cancel: 'C' },
};

const DYNAMIC_STEP_ID_PREFIX = {
  seleccionando_dia: 'day_',
  seleccionando_dia_reprogramacion: 'day_',
  seleccionando_bloque_horario: 'slot_',
  seleccionando_bloque_horario_reprogramacion: 'slot_',
  seleccionando_hora: 'hour_',
  seleccionando_hora_reprogramacion: 'hour_',
  seleccionando_cita_identidad: 'ticket_',
  capturando_datos_booking_residencial: 'booking_',
};

function extractInteractiveReply(payloadCrudo = null) {
  const button = payloadCrudo?.interactive?.button_reply;
  if (button?.id) return { id: button.id, title: button.title || '', kind: 'button_reply' };
  const list = payloadCrudo?.interactive?.list_reply;
  if (list?.id) return { id: list.id, title: list.title || '', description: list.description || '', kind: 'list_reply' };
  return null;
}

function inputMatches(text = '', payloadCrudo = null, values = []) {
  const interactive = extractInteractiveReply(payloadCrudo);
  const tokens = [
    normalize(text),
    normalize(interactive?.id || ''),
    normalize(interactive?.title || ''),
    normalize(interactive?.description || ''),
  ].filter(Boolean);
  return values.some((value) => {
    const normalizedValue = normalize(value);
    return normalizedValue && tokens.includes(normalizedValue);
  });
}

function buttonIdFor(step = '', code = '') {
  const normalizedCode = String(code || '').toUpperCase();
  const entry = Object.entries(STEP_INTERACTIVE_CODE_MAP[step] || {}).find(([, letter]) => letter === normalizedCode);
  return entry?.[0] || code;
}

function rowIdFor(step = '', code = '') {
  const prefix = DYNAMIC_STEP_ID_PREFIX[step];
  if (prefix) return `${prefix}${String(code || '').toUpperCase()}`;
  return buttonIdFor(step, code);
}

function makeStepButtons(step, text, buttons, footer = 'EVINKA') {
  return makeButtonsReply(text, buttons.map((button) => ({ ...button, id: buttonIdFor(step, button.id) })), footer);
}

function makeStepList(step, text, rows, options = {}) {
  return makeListReply(text, rows.map((row) => ({ ...row, id: rowIdFor(step, row.id) })), options);
}

function pickLetter(text, payloadCrudo = null, step = '') {
  const interactive = extractInteractiveReply(payloadCrudo);
  if (interactive) {
    const interactiveId = normalize(interactive.id || '');
    const mapped = STEP_INTERACTIVE_CODE_MAP[step]?.[interactiveId] || STEP_INTERACTIVE_CODE_MAP[`${step}_test`]?.[interactiveId];
    if (mapped) return mapped;
    if (/^[a-j]$/.test(interactiveId)) return interactiveId.toUpperCase();
    const prefix = DYNAMIC_STEP_ID_PREFIX[step] || '';
    if (prefix && interactiveId.startsWith(prefix)) {
      const code = interactiveId.slice(prefix.length).trim().toUpperCase();
      return code || null;
    }
    return null;
  }
  const v = normalize(text);
  if (['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].includes(v)) return v.toUpperCase();

  if (step === 'menu_principal' || ['cita_confirmada', 'cita_reprogramada', 'ticket_cancelado'].includes(step)) {
    if (['reprogramar visita', 'reprogramar', 'reagendar visita', 'reagendar', 'cambiar cita', 'mover cita'].includes(v)) return 'B';
    if (['cancelar visita', 'cancelar', 'anular cita', 'anular'].includes(v)) return 'C';
    if (['asistencia tecnica', 'asistencia técnica', 'soporte tecnico', 'soporte técnico', 'falla', 'emergencia'].includes(v)) return 'D';
    if (['soporte humano', 'asesor', 'hablar con asesor'].includes(v)) return 'E';
  }

  if (step === 'soporte_tipo') {
    if (['soporte tecnico', 'soporte técnico', 'falla', 'averia', 'avería'].includes(v)) return 'A';
    if (['emergencia', 'urgencia', 'riesgo'].includes(v)) return 'B';
    if (['asesor', 'hablar con asesor', 'soporte humano'].includes(v)) return 'C';
  }

  if (step === 'soporte_equipo') {
    if (['cargador', 'cargador evinka'].includes(v)) return 'A';
    if (['punto de carga', 'punto'].includes(v)) return 'B';
    if (['grifo', 'operacion de grifo', 'operación de grifo', 'operador de grifo'].includes(v)) return 'C';
    if (['otro', 'otro equipo'].includes(v)) return 'D';
  }

  if (step === 'soporte_evidencia_opcion') {
    if (['enviar evidencia', 'adjuntar', 'si', 'sí'].includes(v)) return 'A';
    if (['omitir', 'no', 'sin evidencia'].includes(v)) return 'B';
  }

  if (step === 'soporte_confirmacion') {
    if (['enviar caso', 'enviar', 'confirmar'].includes(v)) return 'A';
    if (['volver a empezar', 'reiniciar', 'corregir'].includes(v)) return 'B';
    if (['asesor', 'hablar con asesor', 'soporte humano'].includes(v)) return 'C';
  }

  if (step === 'seleccionando_bloque_horario_reprogramacion') {
    if (['ver mas horarios', 'ver más horarios', 'mas horarios', 'más horarios', 'siguientes horarios'].includes(v)) return 'NEXT';
    if (['ver anteriores', 'horarios anteriores', 'atras', 'atrás'].includes(v)) return 'PREV';
  }

  return null;
}

function includesNormalized(list = [], value = '') {
  const normalizedValue = normalize(value);
  if (!normalizedValue) return false;
  return list.some(item => normalize(item) === normalizedValue);
}

function normalizePlaceText(value = '') {
  return ` ${normalize(value).replace(/[^a-z0-9]+/g, ' ').trim()} `;
}

function textContainsPlace(text = '', place = '') {
  const haystack = normalizePlaceText(text);
  const needle = normalizePlaceText(place);
  return Boolean(needle.trim()) && haystack.includes(needle);
}

function detectPhoneCountry(phone = '') {
  const raw = cleanPhone(phone);
  if (/^\+?57\d{10}$/.test(raw) || /^3\d{9}$/.test(raw)) return 'CO';
  if (/^\+?51\d{9}$/.test(raw) || /^9\d{8}$/.test(raw)) return 'PE';
  return null;
}

function defaultZoneForCountry(country = '') {
  if (country === 'CO') return 'ÁREA 2 — CHAPINERO–BARRIOS UNIDOS–TEUSAQUILLO';
  return null;
}

function countryFromIntent(value = '') {
  const match = String(value || '').match(/\|(PE|CO)$/);
  return match?.[1] || null;
}

export function inferCountryFromZone(zone = '') {
  const value = String(zone || '').toUpperCase();
  if (!value) return null;
  if (value.includes('LIMA')) return 'PE';
  if (value.includes('ÁREA ') || value.includes('MEDELLÍN') || value.includes('CALI') || value.includes('BOGOTÁ')) return 'CO';
  return null;
}

function findZoneByText(text = '', zones = {}) {
  let best = null;
  for (const [zone, places] of Object.entries(zones)) {
    for (const place of places || []) {
      if (!textContainsPlace(text, place)) continue;
      const score = normalize(place).length;
      if (!best || score > best.score) best = { zone, score };
    }
  }
  return best?.zone || null;
}

function detectColombiaCityHint(text = '') {
  for (const [city, hints] of Object.entries(COLOMBIA_CITY_HINTS)) {
    if ((hints || []).some((hint) => textContainsPlace(text, hint))) return city;
  }
  return null;
}

function inferZone(locationText = '', countryHint = null) {
  const text = String(locationText || '').trim();
  if (!text) return null;

  if (countryHint === 'PE') {
    return findZoneByText(text, PERU_ZONES);
  }

  if (countryHint === 'CO') {
    const cityHint = detectColombiaCityHint(text);
    if (cityHint === 'BOGOTA') {
      return findZoneByText(text, {
        'ÁREA 1 — SUBA–USAQUÉN': CO_BOGOTA_AREA_1_SUBA_USAQUEN,
        'ÁREA 2 — CHAPINERO–BARRIOS UNIDOS–TEUSAQUILLO': CO_BOGOTA_AREA_2_CHAPINERO_BARRIOS_UNIDOS_TEUSAQUILLO,
        'ÁREA 3 — ENGATIVÁ–FONTIBÓN': CO_BOGOTA_AREA_3_ENGATIVA_FONTIBON,
        'ÁREA 4 — KENNEDY–PUENTE ARANDA–BOSA': CO_BOGOTA_AREA_4_KENNEDY_PUENTE_ARANDA_BOSA,
        'ÁREA 5 — LA CANDELARIA–SANTA FE–LOS MÁRTIRES–ANTONIO NARIÑO–RAFAEL URIBE URIBE': CO_BOGOTA_AREA_5_CANDELARIA_SANTA_FE_MARTIRES_ANTONIO_NARINO_RUU,
        'ÁREA 6 — MOSQUERA–FUNZA–TENJO–COTA': CO_BOGOTA_AREA_6_MOSQUERA_FUNZA_TENJO_COTA,
        'ÁREA 7 — CHÍA–CAJICÁ–SOPÓ': CO_BOGOTA_AREA_7_CHIA_CAJICA_SOPO,
        'ÁREA 8 — LA CALERA–USME–SAN CRISTÓBAL–TUNJUELITO–CIUDAD BOLÍVAR': CO_BOGOTA_AREA_8_LA_CALERA_USME_SAN_CRISTOBAL_TUNJUELITO_CIUDAD_BOLIVAR,
      }) || findZoneByText(text, COLOMBIA_ZONES);
    }
    if (cityHint === 'MEDELLIN') {
      return findZoneByText(text, {
        'MEDELLÍN NORTE': CO_MEDELLIN_NORTE,
        'MEDELLÍN CENTRO': CO_MEDELLIN_CENTRO,
        'MEDELLÍN SUR': CO_MEDELLIN_SUR,
        'MEDELLÍN ORIENTE': CO_MEDELLIN_ORIENTE,
      }) || findZoneByText(text, COLOMBIA_ZONES);
    }
    if (cityHint === 'CALI') {
      return findZoneByText(text, {
        'CALI NORTE': CO_CALI_NORTE,
        'CALI CENTRO': CO_CALI_CENTRO,
        'CALI SUR': CO_CALI_SUR,
        'CALI ORIENTE': CO_CALI_ORIENTE,
      }) || findZoneByText(text, COLOMBIA_ZONES);
    }
    return findZoneByText(text, COLOMBIA_ZONES);
  }

  return findZoneByText(text, PERU_ZONES) || findZoneByText(text, COLOMBIA_ZONES) || null;
}

export function resolveProfileZone(profile = {}, options = {}) {
  const countryHint = options.country
    || profile?.pais_cliente
    || detectPhoneCountry(options.phone || profile?.telefono_receptor || profile?.telefono_principal || '');

  const combinedLocation = [
    profile?.direccion_instalacion,
    profile?.distrito_instalacion,
    profile?.provincia_instalacion,
    profile?.direccion_recibo,
    profile?.distrito_recibo,
    profile?.provincia_recibo,
  ].filter(Boolean).join(' | ');

  return inferZone(combinedLocation, countryHint)
    || inferZone(profile?.distrito_instalacion, countryHint)
    || inferZone(profile?.distrito_recibo, countryHint)
    || inferZone(profile?.direccion_instalacion, countryHint)
    || inferZone(profile?.direccion_recibo, countryHint)
    || profile?.zona_cliente
    || null;
}

const TEMP_BLOCKED_APPOINTMENT_DATES = {
  PE: new Set(),
};

function isTemporarilyBlockedAppointmentDate(date, zone = null) {
  const country = inferCountryFromZone(zone) || null;
  if (!country) return false;
  return TEMP_BLOCKED_APPOINTMENT_DATES[country]?.has(date) === true;
}

function nextDays(startDate = addDays(currentDateInLima(), 1), zone = null) {
  const out = [];
  let current = startDate;
  while (out.length < 10) {
    const weekday = weekdayForDate(current);
    if (SLOT_TEMPLATES[weekday] && !isTemporarilyBlockedAppointmentDate(current, zone)) {
      out.push({
        code: String.fromCharCode(65 + out.length),
        label: formatDateLabel(current, weekday),
        date: current,
        weekday,
      });
    }
    current = addDays(current, 1);
  }
  return out;
}

function rescheduleDays(zone = null) {
  return nextDays(currentDateInLima(), zone);
}

function nextDaysThroughFriday(startDate = addDays(currentDateInLima(), 1), zone = null) {
  const out = [];
  let current = startDate;
  let sawFriday = false;
  while (!sawFriday) {
    const weekday = weekdayForDate(current);
    if (SLOT_TEMPLATES[weekday] && !isTemporarilyBlockedAppointmentDate(current, zone)) {
      out.push({
        code: String.fromCharCode(65 + out.length),
        label: formatDateLabel(current, weekday),
        date: current,
        weekday,
      });
      if (weekday === 'viernes') sawFriday = true;
    }
    current = addDays(current, 1);
  }
  return out;
}

function slotTemplateForZone(zone = '') {
  const normalized = String(zone || '').trim().toUpperCase();
  const match = Object.entries(COLOMBIA_ZONE_SLOT_TEMPLATES).find(([key]) => key.toUpperCase() === normalized);
  return match?.[1] || SLOT_TEMPLATES;
}

function hoursForDate(date, zone = null) {
  const weekday = weekdayForDate(date);
  const templates = slotTemplateForZone(zone);
  return templates[weekday] || [];
}

function formatDateLabel(date, weekday) {
  const [y, m, d] = date.split('-');
  const names = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado' };
  return `${names[weekday] || weekday} ${d}/${m}/${y}`;
}

function currentDateInLima() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: LIMA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const pick = type => parts.find(p => p.type === type)?.value;
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

function addDays(date, days) {
  const base = new Date(`${date}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function weekdayForDate(date) {
  const day = new Intl.DateTimeFormat('es-PE', { timeZone: 'UTC', weekday: 'long' }).format(new Date(`${date}T00:00:00Z`));
  return normalize(day);
}

function eventCountryFromText(text = '') {
  const raw = String(text || '');
  const countryMatch = raw.match(/pais\s*:\s*([^\n\r]+)/i) || raw.match(/país\s*:\s*([^\n\r]+)/i);
  const value = normalize(cleanTextValue(countryMatch?.[1] || ''));
  if (['pe', 'peru', 'perú'].includes(value)) return 'PE';
  if (['co', 'colombia'].includes(value)) return 'CO';
  return null;
}

function eventZoneFromText(text = '') {
  const raw = String(text || '');
  const eventCountry = eventCountryFromText(raw);
  const zoneMatch = raw.match(/zona\s*:\s*([^\n\r]+)/i);
  if (zoneMatch) return cleanTextValue(zoneMatch[1]).toUpperCase();
  const districtMatch = raw.match(/(?:distrito|localidad)\s*:\s*([^\n\r]+)/i);
  if (districtMatch) {
    const inferredFromDistrict = inferZone(districtMatch[1], eventCountry);
    if (inferredFromDistrict) return inferredFromDistrict;
  }
  return inferZone(raw, eventCountry) || null;
}

function overlaps(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function hasMinimumGapBetweenVisits(slotStart, slotEnd, eventStart, eventEnd, minimumGapMinutes = 0) {
  const minimumGapMs = Math.max(0, Number(minimumGapMinutes) || 0) * 60 * 1000;
  if (overlaps(slotStart, slotEnd, eventStart, eventEnd)) return false;
  if (slotEnd <= eventStart) return (eventStart.getTime() - slotEnd.getTime()) >= minimumGapMs;
  if (eventEnd <= slotStart) return (slotStart.getTime() - eventEnd.getTime()) >= minimumGapMs;
  return true;
}

function parseCalendarDateTime(dateTime, timeZone = '') {
  if (!dateTime) return null;
  const raw = String(dateTime);
  if (/Z|[+-]\d{2}:?\d{2}$/.test(raw)) return new Date(raw);
  if (String(timeZone || '').trim() === 'America/Lima') return new Date(`${raw}-05:00`);
  return new Date(raw);
}

function toLines(text) {
  return freeformLines(text);
}

function mergeDraftLines(existing, incoming) {
  return [...(Array.isArray(existing) ? existing : []), ...toLines(incoming)];
}

function parseCompactReceiptLine(line) {
  const compact = cleanTextValue(line);
  if (!compact) return null;
  const powerMatch = compact.match(/(\d+(?:[.,]\d+)?)\s*(?:kw)?$/i);
  if (!powerMatch) return null;
  const potencia = Number(powerMatch[1].replace(',', '.'));
  if (!Number.isFinite(potencia)) return null;
  const withoutPower = cleanTextValue(compact.slice(0, powerMatch.index));
  const province = KNOWN_PROVINCES.find(p => new RegExp(`\\b${p}\\s*$`, 'i').test(normalize(withoutPower)));
  if (!province) return null;
  const withoutProvince = cleanTextValue(withoutPower.replace(new RegExp(`${province}\\s*$`, 'i'), ''));
  const district = KNOWN_DISTRICTS.find(d => new RegExp(`\\b${normalize(d)}\\s*$`, 'i').test(normalize(withoutProvince)));
  if (!district) return null;
  const districtPattern = normalize(district).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const address = cleanTextValue(withoutProvince.replace(new RegExp(`${districtPattern}\\s*$`, 'i'), ''));
  if (!address || !/\d/.test(address)) return null;
  return {
    titular: null,
    direccion: address,
    distrito: titleCase(district),
    provincia: province.toUpperCase() === 'LIMA' ? 'Lima' : 'Callao',
    potencia,
  };
}

function parseReceiptFromLines(lines) {
  const clean = lines.map(x => cleanTextValue(x)).filter(Boolean);
  if (!clean.length) return null;

  const labeled = {};
  for (const line of clean) {
    const m = line.match(/^([^:]+):\s*(.+)$/);
    if (!m) continue;
    const key = normalize(m[1]);
    const value = m[2].trim();
    if (key.includes('titular')) labeled.titular = value;
    else if (key.includes('dirección del suministro') || key.includes('direccion del suministro') || key === 'direccion' || key.includes('suministro')) labeled.direccion = value;
    else if (key.includes('distrito')) labeled.distrito = value;
    else if (key.includes('provincia')) labeled.provincia = value;
    else if (key.includes('potencia')) labeled.potencia = Number(String(value).replace(',', '.').replace(/[^\d.]/g, ''));
  }

  if (Object.keys(labeled).length) {
    return {
      titular: labeled.titular ? cleanFieldValue(labeled.titular) : null,
      direccion: labeled.direccion ? cleanFieldValue(labeled.direccion) : null,
      distrito: labeled.distrito ? titleCase(cleanFieldValue(labeled.distrito)) : null,
      provincia: labeled.provincia ? titleCase(cleanFieldValue(labeled.provincia)) : null,
      potencia: Number.isFinite(labeled.potencia) ? labeled.potencia : null,
    };
  }

  if (clean.length === 1) {
    const compactParsed = parseCompactReceiptLine(clean[0]);
    if (compactParsed) return compactParsed;
    if (clean[0].includes(',')) {
      const parts = clean[0].split(',').map(x => cleanTextValue(x)).filter(Boolean);
      if (parts.length >= 2) {
        return {
          titular: null,
          direccion: null,
          distrito: parts[0] || null,
          provincia: parts[1] || null,
          potencia: null,
        };
      }
    }
  }

  if (clean.length === 2 && !clean.some(x => /\d/.test(x))) {
    return {
      titular: null,
      direccion: null,
      distrito: clean[0] || null,
      provincia: clean[1] || null,
      potencia: null,
    };
  }

  if (clean.length < 5) return null;
  const numeric = [...clean].reverse().find(x => /\d/.test(x));
  const potencia = numeric ? Number(String(numeric).replace(',', '.').replace(/[^\d.]/g, '')) : null;
  return {
    titular: clean[0] ? cleanFieldValue(clean[0]) : null,
    direccion: clean[1] ? cleanFieldValue(clean[1]) : null,
    distrito: clean[2] ? titleCase(cleanFieldValue(clean[2])) : null,
    provincia: clean[3] ? titleCase(cleanFieldValue(clean[3])) : null,
    potencia: Number.isFinite(potencia) ? potencia : null,
  };
}

function parseReceipt(text) {
  return parseReceiptFromLines(toLines(text));
}

function normalizeNameCandidate(value = '') {
  return titleCase(
    cleanTextValue(value)
      .replace(/^(hola|buenas|buenos dias|buenas tardes|buenas noches)\b[,:\-\s]*/i, '')
      .replace(/^(soy|me llamo|mi nombre es|nombre completo|nombre)\b[\s:,-]*/i, '')
      .replace(/^(te paso mis datos|mis datos son|datos)\b[\s:,-]*/i, '')
      .replace(/[\/|;,]+/g, ' ')
      .replace(/\s+/g, ' ')
  );
}

function personSummary(data) {
  return `Perfecto 👍\n\nEntendí estos datos:\n\n- Nombre completo: ${data.nombre}\n- Documento: ${data.doc}\n- Teléfono de contacto: ${data.telefono}\n- Correo electrónico: ${data.correo}\n\n¿Están correctos?\n\nA. Sí\nB. No, quiero corregirlos\n\nPor favor responde con la letra de la opción que deseas.`;
}

function parsePersonFromLines(lines) {
  const base = lines.map(x => cleanTextValue(x)).filter(Boolean);
  const joined = base.join(' | ');
  const fragments = base.flatMap(line => line.split(/[\/|]+/).map(x => cleanTextValue(x)).filter(Boolean));
  if (!fragments.length) return null;

  const labeled = { nombre: null, doc: null, telefono: null, correo: null };
  for (const fragment of fragments) {
    if (!labeled.correo) {
      const m = fragment.match(/(?:correo|email|mail)?\s*[:=-]?\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
      if (m) labeled.correo = m[1].toLowerCase();
    }
    if (!labeled.doc) {
      const m = fragment.match(/(?:dni|ruc|doc|documento|cedula|cédula|nit)\s*(?:es|:|-)?\s*(\d{6,15})/i);
      if (m) labeled.doc = cleanDoc(m[1]);
    }
    if (!labeled.telefono) {
      const m = fragment.match(/(?:cel|celular|telefono|teléfono|telefono de contacto|teléfono de contacto|celu)\s*(?:es|:|-)?\s*(\+?\d[\d\s()-]{7,}\d)/i);
      if (m) labeled.telefono = cleanPhone(m[1]);
    }
    if (!labeled.nombre) {
      const m = fragment.match(/(?:me llamo|mi nombre es|soy|nombre(?: completo)?)\s*[:,-]?\s*(.+)$/i);
      if (m) labeled.nombre = normalizeNameCandidate(m[1]);
    }
  }

  const emailMatch = joined.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const correo = labeled.correo || (emailMatch ? emailMatch[0].toLowerCase() : null);

  const rawNumberMatches = [...joined.matchAll(/(?:\+?\d[\d\s()-]{7,}\d)/g)].map(m => cleanPhone(m[0])).filter(Boolean);
  const normalizedNumbers = rawNumberMatches.map(x => cleanDoc(x));

  const slashNameCandidate = fragments.find(x => /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(x) && !x.includes('@') && x.split(' ').length >= 2);
  const slashDocCandidate = fragments.map(cleanDoc).find(x => isValidSupportedDoc(x)) || null;
  const slashPhoneCandidate = fragments.map(normalizeContactPhone).find(x => x && cleanDoc(x) !== slashDocCandidate) || null;

  let telefono = labeled.telefono ? normalizeContactPhone(labeled.telefono) : null;
  if (!telefono && fragments.length === 4) {
    telefono = slashPhoneCandidate;
  }
  if (!telefono) {
    telefono = rawNumberMatches.map(normalizeContactPhone).find(Boolean) || null;
  }

  let doc = labeled.doc && isValidSupportedDoc(labeled.doc) ? cleanDoc(labeled.doc) : null;
  if (!doc && fragments.length === 4) {
    doc = slashDocCandidate;
  }
  if (!doc) {
    doc = normalizedNumbers.find(x => {
      if (!isValidSupportedDoc(x)) return false;
      if (telefono && x === cleanDoc(telefono)) return false;
      if (telefono && cleanDoc(telefono).endsWith(x) && cleanDoc(telefono).length !== x.length) return false;
      return true;
    }) || null;
  }

  const explicitNameMatch = joined.match(/(?:me llamo|mi nombre es|soy|nombre(?: completo)?)\s*[:,-]?\s*([A-Za-zÁÉÍÓÚáéíóúÑñ ]{6,})/i);
  const cleanedExplicitName = explicitNameMatch ? normalizeNameCandidate(explicitNameMatch[1]) : null;
  const nameCandidates = [labeled.nombre, slashNameCandidate ? normalizeNameCandidate(slashNameCandidate) : null, cleanedExplicitName, ...fragments.map(normalizeNameCandidate)]
    .filter(Boolean)
    .filter(x => !x.includes('@'))
    .filter(x => cleanDoc(x).length < 8)
    .filter(x => cleanPhone(x).replace(/^\+/, '').length < 7)
    .filter(x => /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(x))
    .filter(x => x.split(' ').length >= 2)
    .filter(x => !/^(dni|ruc|cel|celular|telefono|tel[eé]fono|correo|email|mail)$/i.test(x));

  const nombre = nameCandidates.sort((a, b) => b.length - a.length)[0] || null;
  if (!nombre || !doc || !telefono || !correo) return null;
  if (!isValidSupportedDoc(doc) || !isValidContactPhone(telefono)) return null;
  return {
    nombre,
    doc,
    telefono,
    correo,
  };
}

function parseLabeledPersonText(text = '') {
  const nombre = text.match(/(?:^|\n|\||\/|;|-)\s*(?:nombre(?: completo)?)\s*[:=-]\s*([^\n|\/;]+)/i)?.[1];
  const doc = text.match(/(?:^|\n|\||\/|;|-)\s*(?:dni|ruc|doc|documento|cedula|cédula|nit)\s*[:=-]?\s*(\d{6,15})/i)?.[1];
  const telefono = text.match(/(?:^|\n|\||\/|;|-)\s*(?:cel|celular|telefono|teléfono|celu)\s*[:=-]?\s*(\+?\d[\d\s()-]{7,}\d)/i)?.[1];
  const correo = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const normalizedPhone = telefono ? normalizeContactPhone(telefono) : null;
  const cleanedDoc = doc ? cleanDoc(doc) : null;
  if (!nombre || !cleanedDoc || !normalizedPhone || !correo) return null;
  if (!isValidSupportedDoc(cleanedDoc)) return null;
  return {
    nombre: normalizeNameCandidate(nombre),
    doc: cleanedDoc,
    telefono: normalizedPhone,
    correo: correo.toLowerCase(),
  };
}

function parsePerson(text) {
  return parseLabeledPersonText(text) || parsePersonFromLines(toLines(text));
}

function isLikelyVehicleBrand(value = '') {
  const clean = cleanTextValue(value);
  if (!clean || !/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(clean)) return false;
  const normalized = normalize(clean).replace(/[^a-z0-9 ]/g, '');
  if (!normalized) return false;
  const compact = normalized.replace(/\s+/g, '');
  if (/^(asd|qwe|zxc|test)+/i.test(compact)) return false;
  if (/^[bcdfghjklmnpqrstvwxyz]{5,}$/i.test(compact) && compact.length > 5) return false;
  return true;
}

function isLikelyVehicleModel(value = '') {
  const clean = cleanTextValue(value);
  if (!clean || !/[A-Za-zÁÉÍÓÚáéíóúÑñ0-9]/.test(clean)) return false;
  const normalized = normalize(clean).replace(/[^a-z0-9 ]/g, '');
  if (!normalized) return false;
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  if (tokens.some(t => /^(asd|asdfa|qwe|zxc|test|xxxxx)/i.test(t))) return false;
  return tokens.every(token => {
    if (/\d/.test(token)) return true;
    if (VEHICLE_MODEL_SHORT_ALLOWLIST.has(token)) return true;
    const vowels = (token.match(/[aeiou]/g) || []).length;
    if (token.length >= 6 && vowels <= 1) return false;
    if (vowels >= 1) return true;
    return token.length <= 3 && /^[a-z]+$/.test(token);
  });
}

function parseVehicleFromLines(lines) {
  const clean = lines
    .map(x => cleanTextValue(x).replace(/^(marca|modelo|tipo)\s*[:\-]\s*/i, ''))
    .filter(Boolean);
  if (clean.length < 2) return null;
  const type = clean.find(x => ['bev','phev'].includes(normalize(x)));
  if (!type) return null;
  const withoutType = clean.filter(x => normalize(x) !== normalize(type));
  if (withoutType.length >= 2) {
    const marca = cleanTextValue(withoutType[0]);
    const modelo = cleanTextValue(withoutType[1]);
    if (!isLikelyVehicleBrand(marca) || !isLikelyVehicleModel(modelo)) return null;
    return {
      marca,
      modelo,
      tipo: type.toUpperCase(),
    };
  }
  if (withoutType.length === 1) {
    const parts = withoutType[0].split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const marca = cleanTextValue(parts[0]);
      const modelo = cleanTextValue(parts.slice(1).join(' '));
      if (!isLikelyVehicleBrand(marca) || !isLikelyVehicleModel(modelo)) return null;
      return {
        marca,
        modelo,
        tipo: type.toUpperCase(),
      };
    }
  }
  return null;
}

function vehicleSummary(data) {
  return `Perfecto 👍\n\nEntendí estos datos del vehículo:\n\n- Marca: ${data.marca}\n- Modelo: ${data.modelo}\n- Tipo: ${vehicleTypeLabel(data.tipo)}\n\n¿Están correctos?\n\nA. Sí\nB. No, quiero corregirlos\n\nPor favor responde con la letra de la opción que deseas.`;
}

function parseVehicle(text) {
  return parseVehicleFromLines(toLines(text));
}

function receiptSummary(data) {
  return `Perfecto 👍\n\nEntendí estos datos del recibo:\n\n- Dirección del suministro: ${data.direccion || '(No identificada)'}\n- Distrito: ${data.distrito || '(No identificado)'}\n- Provincia: ${data.provincia || '(No identificada)'}\n- Potencia contratada: ${data.potencia ?? '(No identificada)'}\n\n¿Están correctos?\n\nA. Sí\nB. No, quiero corregirlos\n\nPor favor responde con la letra de la opción que deseas.`;
}

function mergeReceiptData(base = {}, extra = {}) {
  return {
    titular: extra.titular || base.titular || null,
    direccion: extra.direccion || base.direccion || null,
    distrito: extra.distrito || base.distrito || null,
    provincia: extra.provincia || base.provincia || null,
    potencia: extra.potencia ?? base.potencia ?? null,
  };
}

function currentReceiptData(profile = {}) {
  return {
    titular: profile?.titular_recibo || profile?.datos_recibo_manuales?.titular || null,
    direccion: profile?.direccion_recibo || profile?.datos_recibo_manuales?.direccion || null,
    distrito: profile?.distrito_recibo || profile?.datos_recibo_manuales?.distrito || null,
    provincia: profile?.provincia_recibo || profile?.datos_recibo_manuales?.provincia || null,
    potencia: profile?.potencia_kw ?? profile?.datos_recibo_manuales?.potencia ?? null,
  };
}

function missingReceiptFields(data = {}) {
  const missing = [];
  if (!data.direccion) missing.push('dirección del suministro');
  if (!data.distrito) missing.push('distrito');
  if (!data.provincia) missing.push('provincia');
  if (!data.potencia) missing.push('potencia contratada');
  return missing;
}

function partialReceiptConfirmationPrompt(data = {}) {
  const missing = missingReceiptFields(data);
  return `Pude leer parte del recibo 👍\n\nYa identifiqué esto:\n\n- Dirección del suministro: ${data.direccion || '(No identificada)'}\n- Distrito: ${data.distrito || '(No identificado)'}\n- Provincia: ${data.provincia || '(No identificada)'}\n- Potencia contratada: ${data.potencia ?? '(No identificada)'}\n\nTodavía me faltan estos datos:\n\n- ${missing.join('\n- ')}\n\n¿Lo que sí identifiqué está correcto?\n\nA. Sí\nB. No, quiero corregirlo`;
}

function missingReceiptPrompt(data = {}) {
  const missing = missingReceiptFields(data);
  return `Perfecto 👍\n\nEntonces escríbeme solo los datos que faltan del recibo. Puedes mandarlos en cualquier orden si se entienden bien:\n\n- ${missing.join('\n- ')}`;
}

function receiptFieldKey(label = '') {
  if (label === 'dirección del suministro') return 'direccion';
  if (label === 'distrito') return 'distrito';
  if (label === 'provincia') return 'provincia';
  if (label === 'potencia contratada') return 'potencia';
  return label;
}

function highlightedFieldRequest(label = '', extra = '') {
  const detail = extra ? `\n${extra}` : '';
  return `👉 *AHORA ENVÍAME SOLO ESTO:*\n*${String(label || '').toUpperCase()}*${detail}`;
}

function receiptFieldPrompt(field) {
  const intro = 'Perfecto 👍\n\nPaso 1 de 5: datos del recibo';
  if (field === 'direccion') return `${intro}\n\n${highlightedFieldRequest('Dirección del recibo de luz', 'La dirección donde se instalará o se tiene previsto hacer la instalación.')}`;
  if (field === 'distrito') return `${intro}\n\n${highlightedFieldRequest('Distrito')}`;
  if (field === 'provincia') return `${intro}\n\n${highlightedFieldRequest('Provincia')}`;
  return `${intro}\n\n${highlightedFieldRequest('Potencia contratada', 'Ejemplo: 7.4 kW o 9.9 kW')}`;
}

function parseSingleReceiptField(field, text) {
  const value = cleanFieldValue(text);
  if (!value) return null;
  if (field === 'direccion') return value.length >= 6 ? value : null;
  if (field === 'distrito') return titleCase(value);
  if (field === 'provincia') return titleCase(value);
  if (field === 'potencia') {
    const n = Number(String(value).replace(/kw/i, '').replace(',', '.').match(/\d+(?:\.\d+)?/)?.[0]);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function invalidReceiptFieldPrompt(field) {
  if (field === 'direccion') return 'No pude leer una dirección válida. Envíamela otra vez.';
  if (field === 'distrito') return 'No pude leer un distrito válido. Envíamelo otra vez.';
  if (field === 'provincia') return 'No pude leer una provincia válida. Envíamela otra vez.';
  return 'No pude leer una potencia válida. Envíamela otra vez en formato como 7.4 o 9.9 kW.';
}

function receiptCorrectionMenu(data = {}) {
  return `Perfecto 👍\n\nIndícame qué dato deseas corregir del recibo:\n\nA. Dirección del recibo de luz (${data.direccion || '(No identificada)'})\nB. Distrito (${data.distrito || '(No identificado)'})\nC. Provincia (${data.provincia || '(No identificada)'})\nD. Potencia contratada (${data.potencia ?? '(No identificada)'})\n\nPor favor responde con la letra de la opción que deseas.`;
}

function vehicleTypeLabel(value = '') {
  const normalized = String(value || '').toUpperCase();
  if (normalized === 'BEV') return '100% eléctrico';
  if (normalized === 'PHEV') return 'Híbrido enchufable';
  if (normalized === 'NO_SEGURO') return 'No estoy seguro';
  return value || '-';
}

function vehicleFieldPrompt(field) {
  const firstIntro = 'Tomaré esa como la dirección correcta de instalación.\n\nPerfecto 👍\n\nPaso 5 de 5: vehículo';
  const stepIntro = 'Perfecto 👍\n\nPaso 5 de 5: vehículo';
  if (field === 'marca') return `${firstIntro}\n\nAhora te pediré los datos del vehículo para el cual será el cargador. Puede ser el vehículo que ya tienes o el que planeas comprar. Esto es solo de referencia para entender mejor el tipo de vehículo y orientarte correctamente.\n\n${highlightedFieldRequest('Marca')}`;
  if (field === 'modelo') return `${stepIntro}\n\n${highlightedFieldRequest('Modelo')}`;
  return `${stepIntro}\n\n👉 *AHORA ELIGE SOLO UNA OPCIÓN:*\n*TIPO DE VEHÍCULO*\n\nA. 100% eléctrico\nB. Híbrido enchufable\nC. No estoy seguro`;
}

function parseSingleVehicleField(field, text, payloadCrudo = null) {
  const value = cleanTextValue(text);
  if (field === 'marca') return value && isLikelyVehicleBrand(value) ? value : null;
  if (field === 'modelo') return value && isLikelyVehicleModel(value) ? value : null;

  if (inputMatches(text, payloadCrudo, ['vehicle_type_bev', '100% eléctrico', '100% electrico', '100 electrico', '100 por ciento electrico', 'electrico', 'bev'])) return 'BEV';
  if (inputMatches(text, payloadCrudo, ['vehicle_type_phev', 'híbrido enchufable', 'hibrido enchufable', 'enchufable', 'phev'])) return 'PHEV';
  if (inputMatches(text, payloadCrudo, ['vehicle_type_unsure', 'no estoy seguro', 'no se', 'no sé', 'no estoy seguro/a'])) return 'NO_SEGURO';

  if (!value) return null;
  const t = normalize(value);
  if (['a', '100 electrico', '100% electrico', '100 por ciento electrico', 'electrico', '100% eléctrico', '100 electrico', 'bev'].includes(t)) return 'BEV';
  if (['b', 'hibrido enchufable', 'híbrido enchufable', 'enchufable', 'phev'].includes(t)) return 'PHEV';
  if (['c', 'no estoy seguro', 'no se', 'no sé', 'no estoy seguro/a'].includes(t)) return 'NO_SEGURO';
  return null;
}

function invalidVehicleFieldPrompt(field) {
  if (field === 'marca') return 'No pude leer una marca válida. Envíamela otra vez.';
  if (field === 'modelo') return 'No pude leer un modelo válido. Envíamelo otra vez.';
  return 'No pude leer el tipo de vehículo. Responde con: 100% eléctrico, Híbrido enchufable o No estoy seguro.';
}

function vehicleCorrectionMenu(data = {}) {
  return `Perfecto 👍\n\nIndícame qué dato deseas corregir del vehículo:\n\nA. Marca (${data.marca || '-'})\nB. Modelo (${data.modelo || '-'})\nC. Tipo (${vehicleTypeLabel(data.tipo)})\n\nPor favor responde con la letra de la opción que deseas.`;
}

function parseReceiptSupplement(text, missing = []) {
  const lines = toLines(text);
  const parsed = parseReceiptFromLines(lines) || {};
  const out = {};

  const fieldOrder = ['dirección del suministro', 'distrito', 'provincia', 'potencia contratada'];
  const sequentialMissing = fieldOrder.filter(field => missing.includes(field));
  if (lines.length >= sequentialMissing.length && sequentialMissing.length >= 1) {
    sequentialMissing.forEach((field, index) => {
      const value = cleanTextValue(lines[index] || '');
      const cleanedValue = cleanFieldValue(value);
      if (!cleanedValue) return;
      if (field === 'dirección del suministro') out.direccion = cleanedValue;
      else if (field === 'potencia contratada') out.potencia = Number.isFinite(Number(cleanedValue.replace(',', '.'))) ? Number(cleanedValue.replace(',', '.')) : parsed.potencia || null;
      else out[field] = field === 'provincia' || field === 'distrito' ? titleCase(cleanedValue) : cleanedValue;
    });
  }

  if (missing.includes('distrito') && missing.includes('provincia')) {
    if (lines.length >= 2 && !lines.slice(0, 2).some(x => /\d/.test(x))) {
      out.distrito = out.distrito || cleanTextValue(lines[lines.length - 2]);
      out.provincia = out.provincia || cleanTextValue(lines[lines.length - 1]);
    } else if (lines.length === 1 && !/\d/.test(lines[0])) {
      const single = cleanTextValue(lines[0]);
      if (single.includes(',')) {
        const parts = single.split(',').map(cleanTextValue).filter(Boolean);
        if (parts.length >= 2) {
          out.distrito = out.distrito || parts[0];
          out.provincia = out.provincia || parts[1];
        }
      } else {
        const provinceMatch = single.match(/^(.*)\s+(LIMA|CALLAO)$/i);
        if (provinceMatch) {
          out.distrito = out.distrito || cleanTextValue(provinceMatch[1]);
          out.provincia = out.provincia || cleanTextValue(provinceMatch[2]);
        }
      }
    }
  }

  for (const field of ['titular', 'direccion', 'distrito', 'provincia', 'potencia']) {
    if (missing.includes(field === 'direccion' ? 'dirección del suministro' : field) && parsed?.[field]) {
      out[field] = out[field] || parsed[field];
    }
  }

  return out;
}

function personPrompt(other = false) {
  return `Perfecto 👍\n\nEntonces los siguientes datos deben ser ${other ? 'de la persona que recibirá la visita' : 'tuyos'}.\n\nPaso 3 de 5: datos de la persona que recibirá la visita\n\nGracias. Para continuar solo me faltan estos datos:\n\n- nombre completo\n- documento\n- teléfono de contacto\n- correo electrónico\n\nPuedes enviarlo todo en un solo mensaje, aunque venga desordenado.`;
}

function personFieldPrompt(field, other = false) {
  const intro = `Perfecto 👍\n\nEntonces los siguientes datos deben ser ${other ? 'de la persona que recibirá la visita' : 'tuyos'}.\n\nPaso 3 de 5: datos de la persona que recibirá la visita`;
  if (field === 'nombre') return `${intro}\n\n${highlightedFieldRequest('Nombre completo')}`;
  if (field === 'doc') return `${intro}\n\n${highlightedFieldRequest('Documento', 'Por ejemplo: DNI, cédula, RUC o NIT')}`;
  if (field === 'telefono') return `${intro}\n\n${highlightedFieldRequest('Teléfono de contacto')}`;
  return `${intro}\n\n${highlightedFieldRequest('Correo electrónico')}`;
}

function advisorLeadSummary(summary) {
  try {
    const parsed = JSON.parse(String(summary || '{}'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function nextAdvisorLeadField(data = {}) {
  if (!data.nombre) return 'nombre';
  if (!data.telefono) return 'telefono';
  if (!data.correo) return 'correo';
  if (!data.marca) return 'marca';
  if (!data.comentario) return 'comentario';
  return null;
}

function advisorLeadPrompt(field = 'nombre') {
  const intro = 'Antes de derivarte con un asesor, necesito registrar estos 5 datos obligatorios:\n\n- nombre completo\n- teléfono de contacto\n- correo electrónico\n- marca del carro\n- comentario breve de lo que necesitas\n\nSi no completas esta información, no podré derivar tu solicitud.';
  if (field === 'nombre') return `${intro}\n\nPaso 1 de 5\n\n${highlightedFieldRequest('Nombre completo')}`;
  if (field === 'telefono') return `Perfecto 👍\n\nPaso 2 de 5\n\n${highlightedFieldRequest('Teléfono de contacto')}`;
  if (field === 'correo') return `Perfecto 👍\n\nPaso 3 de 5\n\n${highlightedFieldRequest('Correo electrónico')}`;
  if (field === 'marca') return `Perfecto 👍\n\nPaso 4 de 5\n\n${highlightedFieldRequest('Marca del carro')}`;
  return `Perfecto 👍\n\nPaso 5 de 5\n\n👉 *AHORA ENVÍAME SOLO ESTO:*\n*COMENTARIO BREVE DE LO QUE NECESITAS*\n\nEjemplo: Quiero cotizar instalación para mi BYD en Surco y saber si pueden visitarme esta semana.`;
}

function normalizeAdvisorLeadPhone(value = '') {
  const known = normalizeContactPhone(value);
  if (known) return known;
  const digits = cleanPhone(value);
  if (!/^\d{8,15}$/.test(digits)) return null;
  return `+${digits}`;
}

function parseSingleAdvisorLeadField(field, text, payloadCrudo = null) {
  if (field === 'nombre') {
    const nombre = normalizeNameCandidate(text);
    return nombre && nombre.split(/\s+/).length >= 2 ? nombre : null;
  }
  if (field === 'telefono') return normalizeAdvisorLeadPhone(text);
  if (field === 'correo') return String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase() || null;
  if (field === 'marca') return parseSingleVehicleField('marca', text, payloadCrudo);
  const comentario = cleanTextValue(text);
  return comentario && comentario.length >= 8 ? comentario : null;
}

function invalidAdvisorLeadFieldPrompt(field = 'nombre') {
  if (field === 'nombre') return 'No pude leer un nombre completo válido. Envíamelo otra vez, por favor.';
  if (field === 'telefono') return 'No pude leer un teléfono válido. Envíamelo otra vez, por favor.';
  if (field === 'correo') return 'No pude leer un correo electrónico válido. Envíamelo otra vez, por favor.';
  if (field === 'marca') return 'No pude leer una marca válida. Envíamela otra vez, por favor.';
  return 'No pude leer bien el comentario. Envíamelo otra vez con un poco más de detalle, por favor.';
}

function advisorLeadHandoffText(country = null) {
  const brand = country === 'CO' ? 'EVINKA Colombia' : 'EVINKA';
  return `Muchas gracias por tu información 👍\n\nHemos derivado tu requerimiento a nuestro asesor de ${brand}, quien en breve se comunicará contigo.`;
}

const BOOKING_DATA_NOTICE_CO = '📍 ¡Perfecto! Hemos registrado correctamente la localidad seleccionada.\n\n🔐 Antes de continuar, queremos informarte que los datos suministrados serán tratados conforme a nuestra política de tratamiento de datos personales, garantizando su confidencialidad y uso adecuado únicamente para fines relacionados con el proceso de atención.\n\nAl continuar, aceptas el tratamiento de tus datos de acuerdo con la normativa vigente. 😊';

const BOOKING_DOCUMENT_TYPE_OPTIONS = {
  A: 'Cédula de ciudadanía',
  B: 'NIT',
  C: 'Pasaporte',
};

const BOOKING_DOCUMENT_TYPE_NORMALIZED = {
  cedula: 'Cédula de ciudadanía',
  'cédula': 'Cédula de ciudadanía',
  cc: 'Cédula de ciudadanía',
  nit: 'NIT',
  pasaporte: 'Pasaporte',
  passport: 'Pasaporte',
};

const BOOKING_VEHICLE_BRAND_OPTIONS = [
  'BYD',
  'Tesla',
  'Geely',
  'Kia',
  'Chery',
  'Jeep',
  'SEAT',
  'Volvo',
  'Deepal',
  'Farizon',
  'Chevrolet',
  'Renault',
  'BMW',
  'Otro',
];

const BOOKING_VEHICLE_BRAND_NORMALIZED = Object.fromEntries(
  BOOKING_VEHICLE_BRAND_OPTIONS.map((brand) => [normalize(brand).replace(/\s+/g, ''), brand]),
);

const BOOKING_VEHICLE_BRAND_PAGE_1 = ['BYD', 'Tesla', 'Geely', 'Kia', 'Chery', 'Jeep', 'SEAT', 'Volvo', 'Deepal'];
const BOOKING_VEHICLE_BRAND_PAGE_2 = ['Farizon', 'Chevrolet', 'Renault', 'BMW', 'Otro'];

function nextBookingField(data = {}) {
  if (!data.barrio) return 'barrio';
  if (!data.direccion) return 'direccion';
  if (!data.marca_vehiculo) return 'marca_vehiculo';
  if (!data.nombre) return 'nombre';
  if (!data.tipo_documento) return 'tipo_documento';
  if (!data.numero_documento) return 'numero_documento';
  if (!data.correo) return 'correo';
  if (!data.telefono) return 'telefono';
  return null;
}

function bookingFieldPrompt(field) {
  if (field === 'barrio') return '🏘️ Para continuar con tu solicitud, por favor indícanos tu barrio.';
  if (field === 'direccion') return '📍 Gracias. Ahora compártenos tu dirección completa.';
  if (field === 'marca_vehiculo' || field === 'marca_vehiculo_more') return '🚘 Selecciona la marca de tu vehículo.';
  if (field === 'nombre') return '✍️ Luego, indícanos tus nombres y apellidos completos.';
  if (field === 'tipo_documento') return '🪪 Ahora selecciona el tipo de documento con el que deseas registrarte:\n\n1️⃣ Cédula de ciudadanía\n2️⃣ NIT\n3️⃣ Pasaporte';
  if (field === 'numero_documento') return '📄 Por favor, ingresa tu número de documento de identidad.';
  if (field === 'correo') return '📧 Ahora compártenos tu correo electrónico.';
  return '📱 Finalmente, indícanos tu número de celular.\nCon esta información podremos continuar con tu proceso de manera más ágil.';
}

function parseSingleBookingField(field, text, letter = null) {
  if (field === 'barrio') {
    const barrio = cleanTextValue(text);
    return barrio && barrio.length >= 3 ? barrio : null;
  }
  if (field === 'direccion') {
    const direccion = cleanTextValue(text);
    return direccion && direccion.length >= 6 ? direccion : null;
  }
  if (field === 'marca_vehiculo' || field === 'marca_vehiculo_more') {
    const source = letter || text;
    const normalized = normalize(source).replace(/\s+/g, '');
    return BOOKING_VEHICLE_BRAND_NORMALIZED[normalized] || null;
  }
  if (field === 'nombre') {
    const nombre = normalizeNameCandidate(text);
    return nombre && nombre.split(/\s+/).length >= 2 ? nombre : null;
  }
  if (field === 'tipo_documento') {
    if (letter && BOOKING_DOCUMENT_TYPE_OPTIONS[letter]) return BOOKING_DOCUMENT_TYPE_OPTIONS[letter];
    const normalized = normalize(text).replace(/\s+/g, '');
    return BOOKING_DOCUMENT_TYPE_NORMALIZED[normalized] || null;
  }
  if (field === 'numero_documento') {
    const doc = cleanTextValue(text).replace(/\s+/g, '').replace(/[^A-Z0-9-]/gi, '').toUpperCase();
    return doc && doc.length >= 5 ? doc : null;
  }
  if (field === 'correo') {
    return String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase() || null;
  }
  const telefono = normalizeContactPhone(text);
  return isValidContactPhone(telefono) ? telefono : null;
}

function invalidBookingFieldPrompt(field) {
  if (field === 'barrio') return 'No pude leer bien el barrio. Envíamelo otra vez, por favor.';
  if (field === 'direccion') return 'No pude leer bien la dirección completa. Envíamela otra vez, por favor.';
  if (field === 'marca_vehiculo' || field === 'marca_vehiculo_more') return 'Por favor selecciona una marca válida de la lista.';
  if (field === 'nombre') return 'No pude leer bien tus nombres y apellidos completos. Envíamelos otra vez, por favor.';
  if (field === 'tipo_documento') return 'Por favor selecciona una opción válida de tipo de documento.';
  if (field === 'numero_documento') return 'No pude leer bien el número de documento. Envíamelo otra vez, por favor.';
  if (field === 'correo') return 'No pude leer bien el correo electrónico. Envíamelo otra vez, por favor.';
  return 'No pude leer bien el número de celular. Envíamelo otra vez, por favor.';
}

function bookingSummary(data = {}) {
  return `Así quedaría tu información 👌\n\n- Localidad: ${data.localidad || '-'}\n- Barrio: ${data.barrio || '-'}\n- Dirección completa: ${data.direccion || '-'}\n- Marca del vehículo: ${data.marca_vehiculo || '-'}\n- Nombres y apellidos: ${data.nombre || '-'}\n- Tipo de documento: ${data.tipo_documento || '-'}\n- Número de documento: ${data.numero_documento || '-'}\n- Correo electrónico: ${data.correo || '-'}\n- Número de celular: ${data.telefono || '-'}\n\n¿Deseas continuar con el agendamiento?`;
}

function bookingCorrectionMenu(data = {}) {
  return `Claro ✨\n\n¿Qué dato deseas corregir?\n\nA. Barrio (${data.barrio || '-'})\nB. Dirección completa (${data.direccion || '-'})\nC. Marca del vehículo (${data.marca_vehiculo || '-'})\nD. Nombres y apellidos (${data.nombre || '-'})\nE. Tipo de documento (${data.tipo_documento || '-'})\nF. Número de documento (${data.numero_documento || '-'})\nG. Correo electrónico (${data.correo || '-'})\nH. Número de celular (${data.telefono || '-'})`;
}

function bookingAddressLine(data = {}) {
  const address = cleanTextValue(data.direccion || '');
  const neighborhood = cleanTextValue(data.barrio || '');
  if (address && neighborhood) return `${address}, Barrio ${neighborhood}`;
  return address || neighborhood || '';
}

function parseSupportCaseSummary(summary) {
  try { return JSON.parse(summary || '{}'); } catch { return {}; }
}

function supportCaseModeLabel(mode = '') {
  return mode === 'emergency' ? 'Emergencia' : 'Soporte técnico';
}

function supportEquipmentLabel(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'charger') return 'Cargador EVINKA';
  if (normalized === 'charge_point') return 'Punto de carga';
  if (normalized === 'gas_operator') return 'Operación de grifo';
  if (normalized === 'other') return 'Otro';
  return value || '-';
}

function supportNamePrompt(mode = 'technical') {
  return `${mode === 'emergency' ? 'Entendido 🚨' : 'Perfecto 👍'}\n\nPaso 1 de ${mode === 'emergency' ? '4' : '5'}\n\nIndícame tu nombre completo.`;
}

function supportLocationPrompt(mode = 'technical') {
  return `${mode === 'emergency' ? 'Gracias.' : 'Perfecto 👍'}\n\nPaso 2 de ${mode === 'emergency' ? '4' : '5'}\n\nIndícame la ubicación del problema${mode === 'emergency' ? ' o de la emergencia' : ''}.`;
}

function supportIssuePrompt(mode = 'technical') {
  return `${mode === 'emergency' ? 'Gracias.' : 'Perfecto 👍'}\n\nPaso ${mode === 'emergency' ? '3 de 4' : '4 de 5'}\n\n${mode === 'emergency' ? 'Describe brevemente qué está ocurriendo ahora.' : 'Describe brevemente qué problema presenta.'}`;
}

function supportEvidencePrompt(mode = 'technical') {
  return `${mode === 'emergency' ? 'Entendido.' : 'Gracias.'}\n\nPaso ${mode === 'emergency' ? '4 de 4' : '5 de 5'}\n\nSi deseas, puedes enviarme una foto o documento del problema como evidencia.`;
}

function supportEvidenceWaitPrompt(mode = 'technical') {
  return `${mode === 'emergency' ? 'Entendido 🚨' : 'Perfecto 👍'}\n\nEnvíame ahora la foto o documento del problema. Si prefieres continuar sin adjunto, toca *Omitir*.`;
}

function supportCaseSummaryText(data = {}) {
  const lines = [
    `${data.mode === 'emergency' ? 'Entendido 🚨' : 'Perfecto 👍'}`,
    '',
    'Este es el resumen de tu caso:',
    '',
    `- Tipo: ${supportCaseModeLabel(data.mode)}`,
    `- Nombre: ${data.name || '-'}`,
    `- Ubicación: ${data.location || '-'}`,
  ];
  if (data.mode !== 'emergency') {
    lines.push(`- Equipo: ${supportEquipmentLabel(data.equipment)}`);
  }
  lines.push(`- Detalle: ${data.issue || '-'}`);
  lines.push(`- Evidencia: ${data.evidence ? 'Adjunta' : 'Sin adjunto'}`);
  lines.push('', '¿Deseas enviarlo?');
  return lines.join('\n');
}

function invalidSupportFieldPrompt(field = 'name') {
  if (field === 'name') return 'No pude leer bien tu nombre completo. Envíamelo otra vez por favor.';
  if (field === 'location') return 'No pude leer bien la ubicación. Envíamela otra vez con un poco más de detalle.';
  return 'No pude leer bien la descripción del problema. Envíamela otra vez con un poco más de detalle.';
}

function parseSupportName(text) {
  const name = normalizeNameCandidate(text);
  return name && name.split(/\s+/).length >= 2 ? name : null;
}

function parseSupportLocation(text) {
  const value = cleanTextValue(text);
  return value && value.length >= 5 ? value : null;
}

function parseSupportIssue(text) {
  const value = cleanTextValue(text);
  return value && value.length >= 8 ? value : null;
}

function supportEvidenceFromPayload(payloadCrudo = null) {
  const payload = payloadCrudo && typeof payloadCrudo === 'object' ? payloadCrudo : {};
  const mediaUrl = String(payload.mediaUrl || '').trim();
  if (!mediaUrl) return null;
  return {
    mediaUrl,
    fileName: String(payload.fileName || '').trim(),
    mimeType: String(payload.mimeType || '').trim(),
    storageBucket: String(payload.storageBucket || '').trim(),
    storagePath: String(payload.storagePath || '').trim(),
  };
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
  'nuestra empresa',
  'nuestro local',
  'nuestra sede',
];

const CORPORATE_SUFFIX_RE = /\b(sac|s\.a\.?c\.?|s\.a\.?|srl|eirl|corp|corporation|company|empresa|holding)\b/i;

function cleanCorporateName(value = '') {
  const cleaned = cleanTextValue(value)
    .replace(/^(la\s+empresa|empresa|cuenta\s+corporativa|cuenta)\s+/i, '')
    .replace(/[.,;:!?]+$/g, '')
    .trim();
  const exactHint = CORPORATE_COMPANY_HINTS.find((item) => normalize(cleaned).includes(normalize(item)));
  if (exactHint) return exactHint;
  return cleaned === cleaned.toLowerCase() ? titleCase(cleaned) : cleaned;
}

function extractCorporateLead(text = '') {
  return detectCorporateLead(text);
}

function corporateHandoffText({ contactName = '', companyName = '', country = null } = {}) {
  const brand = country === 'CO' ? 'EVINKA Colombia' : 'EVINKA';
  const hello = contactName ? `Gracias por escribirnos, ${contactName} 👍` : 'Gracias por escribirnos 👍';
  const companyLine = companyName
    ? `Veo que tu consulta parece corresponder a ${/^(el|la|los|las)\b/i.test(companyName) ? companyName : `la empresa ${companyName}`}.`
    : 'Veo que tu consulta parece corresponder a una empresa o cuenta corporativa.';
  return `${hello}\n\n${companyLine}\n\nEste canal está orientado a atención B2C, así que voy a derivarte directamente con un asesor de ${brand} para una atención personalizada.\n\nEn breve uno de nuestros asesores continuará contigo por este mismo chat.`;
}

function personCorrectionMenu(data) {
  return `Perfecto 👍\n\nIndícame qué dato deseas corregir:\n\nA. Nombre completo (${data.nombre})\nB. Documento (${data.doc})\nC. Teléfono de contacto (${data.telefono})\nD. Correo electrónico (${data.correo})\n\nPor favor responde con la letra de la opción que deseas.`;
}

function parseSinglePersonField(field, text) {
  if (field === 'nombre') {
    const nombre = normalizeNameCandidate(text);
    return nombre && nombre.split(/\s+/).length >= 2 ? nombre : null;
  }
  if (field === 'doc') {
    const doc = cleanDoc(text);
    return isValidSupportedDoc(doc) ? doc : null;
  }
  if (field === 'telefono') {
    const telefono = normalizeContactPhone(text);
    return isValidContactPhone(telefono) ? telefono : null;
  }
  const correo = String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase() || null;
  return correo;
}

function invalidPersonFieldPrompt(field) {
  if (field === 'nombre') return 'No pude leer un nombre completo válido. Por favor envíamelo otra vez.';
  if (field === 'doc') return 'No pude leer un documento válido. Envíamelo otra vez usando solo números.';
  if (field === 'telefono') return 'No pude leer un teléfono válido de Perú o Colombia. Envíamelo como 9 dígitos o +51 seguido de 9 dígitos, o como 10 dígitos o +57 seguido de 10 dígitos.';
  return 'No pude leer un correo electrónico válido. Por favor envíamelo otra vez.';
}

function addressConfirm(address) {
  return `Perfecto 👍\n\nYa tengo los datos de contacto.\n\nPaso 4 de 5: dirección exacta del punto de instalación\n\nEn el recibo que me compartiste figura esta dirección de suministro:\n\n${address}\n\n¿Esa es la dirección exacta donde se realizará la instalación?\n\nA. Sí\nB. No\n\nPor favor responde con la letra de la opción que deseas.`;
}

const WRONG_ADDRESS = `Entendido 👍\n\nEl recibo que me envíes debe corresponder exactamente al lugar donde se realizará la instalación.\n\nPor favor vuelve a enviarme el recibo correcto del punto de instalación para continuar.`;

const RECEIPT_FILE_TYPES = 'JPG, JPEG, PNG, WEBP, HEIC o PDF';

const VEHICLE_PROMPT = `Tomaré esa como la dirección correcta de instalación.\n\nPerfecto 👍\n\nPaso 5 de 5: vehículo\n\nAhora indícame:\n\n- marca\n- modelo\n- tipo de vehículo\n\nOpciones de tipo:\n- 100% eléctrico\n- Híbrido enchufable\n- No estoy seguro\n\nEjemplo:\nBYD\nYuan Up\n100% eléctrico`;

function daysPrompt(zone, options = null) {
  const finalOptions = options || nextDays();
  return `Perfecto 👍\n\nEstos son los días disponibles para tu zona (${zone}):\n\n${finalOptions.map(o => `${o.code}. ${o.label}`).join('\n')}\n\nPor favor responde con la letra de la opción que prefieras.`;
}

function hoursPrompt(date) {
  const hours = Array.isArray(date) ? date : hoursForDate(date);
  return `Perfecto.\n\nEstos son los horarios disponibles para ese día:\n\n${hours.map(o => `${o.code}. ${o.label}`).join('\n')}\n\nPor favor responde con la letra de la opción que prefieras.`;
}

function combinedSlotsPrompt(zone, options = []) {
  return `Perfecto 👍\n\nEstos son los horarios disponibles para tu zona (${zone}):\n\n${options.map(o => `${o.code}. ${o.dateLabel} — ${o.hourLabel}`).join('\n')}\n\nPor favor elige una opción.`;
}

function buildPagedSlotSummary(items = [], page = 0, extra = {}) {
  return JSON.stringify({ items, page, ...(extra && typeof extra === 'object' ? extra : {}) });
}

function parsePagedSlotSummary(summary) {
  const parsed = parseReplySummary(summary);
  if (Array.isArray(parsed)) return { items: parsed, page: 0, invalidAttempts: 0, slotLossAttempts: 0 };
  return {
    items: Array.isArray(parsed?.items) ? parsed.items : [],
    page: Number.isInteger(parsed?.page) && parsed.page >= 0 ? parsed.page : 0,
    invalidAttempts: Number(parsed?.invalidAttempts || 0),
    slotLossAttempts: Number(parsed?.slotLossAttempts || 0),
  };
}

function pagedSlotRows(summary) {
  const items = Array.isArray(summary?.items) ? summary.items : [];
  const page = Number.isInteger(summary?.page) && summary.page >= 0 ? summary.page : 0;
  const pageSize = 9;
  const start = page * pageSize;
  const visible = items.slice(start, start + pageSize).map((item) => ({
    id: item.code,
    title: clipLabel(item.dateLabel, 24),
    description: clipLabel(item.hourLabel, 48),
  }));
  if (page > 0) {
    visible.push({ id: 'PREV', title: 'Ver anteriores', description: 'Mostrar horarios previos' });
  }
  if (start + pageSize < items.length) {
    visible.push({ id: 'NEXT', title: 'Ver más horarios', description: 'Mostrar siguientes horarios' });
  }
  return visible;
}

function compactScheduleLabel(startTime = '', endTime = '') {
  const start = String(startTime || '').slice(0, 5);
  const end = String(endTime || '').slice(0, 5);
  if (!start) return '';
  return end ? `${start}-${end}` : start;
}

function compactLines(text = '') {
  return String(text || '')
    .split(/\r?\n/)
    .filter((line) => !/^\s*[A-Z]\.\s/.test(line))
    .filter((line) => !/^\s*Por favor responde con la letra/i.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function addAdvisorHint(text = '', step = '') {
  const body = String(text || '').trim();
  if (!body) return body;
  return body;
}

function hasAdvisorOption(reply) {
  if (!reply || !reply.kind) return false;
  if (reply.kind === 'buttons') {
    return (reply.buttons || []).some((button) => normalize(button?.id || '') === 'asesor' || normalize(button?.title || '') === 'hablar con asesor');
  }
  if (reply.kind === 'list') {
    return (reply.sections || []).some((section) => (section.rows || []).some((row) => normalize(row?.id || '') === 'asesor' || normalize(row?.title || '') === 'hablar con asesor'));
  }
  return false;
}

function ensureAdvisorOption(reply) {
  return reply;
}

function isAdvisorRequest(text = '') {
  const normalized = normalize(text);
  if (!normalized) return false;
  if (ADVISOR_SHORTCUTS.has(normalized) || normalized === 'asesor' || normalized === 'asesora') return true;
  return [
    /\bhablar con (un )?asesor(a)?\b/,
    /\bcomunicar(me|te)? con (un )?asesor(a)?\b/,
    /\bnecesito (un )?asesor(a)?\b/,
    /\bquiero (hablar|comunicarme) con (un )?asesor(a)?\b/,
    /\bsoporte humano\b/,
    /\bagente humano\b/,
  ].some((pattern) => pattern.test(normalized));
}

function isNegativeAttentionSignal(text = '') {
  const normalized = normalize(text);
  if (!normalized) return false;
  return [
    /\bdisgustad[oa]s?\b/,
    /\bmolest[oa]s?\b/,
    /\benojad[oa]s?\b/,
    /\bindignad[oa]s?\b/,
    /\binsatisfech[oa]s?\b/,
    /\binconforme(s)?\b/,
    /\bqueja(s)?\b/,
    /\breclamo(s)?\b/,
    /\bp[ée]sim[oa]s?\b/,
    /\bterrible\b/,
    /\bmala atencion\b/,
    /\bmal servicio\b/,
    /\bno me (ayudaron|resolvieron|atendieron)\b/,
    /\bquiero (poner|hacer) (una )?(queja|reclamo)\b/,
  ].some((pattern) => pattern.test(normalized));
}

function isContinueRequest(text = '', letter = null, payloadCrudo = null) {
  return letter === 'A' || inputMatches(text, payloadCrudo, [
    'continuar',
    'retomar',
    'seguir',
    'seguir esperando',
    'si',
    'sí',
    'ok',
    'okay',
    'vale',
    'dale',
    'quiero seguir',
    'quiero continuar',
    'quiero seguir con el asesor',
    'seguir con el asesor',
    'continuar con el asesor',
    'resume_bot',
    'retomar con bot',
  ]);
}

function isRestartRequest(text = '', letter = null, payloadCrudo = null) {
  return letter === 'B' || inputMatches(text, payloadCrudo, ['reiniciar', 'empezar otra vez', 'empezar de nuevo', 'menu', 'menú', 'menu principal', 'menú principal', 'menu_main', 'volver', 'salir']);
}

function isMainMenuRequest(text = '', payloadCrudo = null) {
  return inputMatches(text, payloadCrudo, ['menu', 'menú', 'menu principal', 'menú principal', 'menu_main', 'buy_menu', 'post_menu', 'volver', 'salir']);
}

function needsResumePrompt(conversation = null, inactivityMs = 0) {
  if (!conversation || inactivityMs <= FLOW_ACTIVE_MEMORY_WINDOW_MS || inactivityMs > FLOW_RESET_WINDOW_MS) return false;
  if (!['open', 'paused'].includes(conversation.estado_conversacion)) return false;
  return ![
    'menu_principal',
    'gestion_ticket',
    'busqueda_por_identidad',
    'sin_citas_encontradas',
    'confirmando_ticket',
    'accion_ticket',
    'seleccionando_cita_identidad',
    'seleccionando_dia_reprogramacion',
    'seleccionando_hora_reprogramacion',
    'retomar_o_reiniciar',
    'handoff_asesor',
  ].includes(conversation.paso_actual || 'menu_principal');
}

function resumePromptPayload(conversation = null, fallback = {}) {
  const previousStep = ['handoff_asesor', 'retomar_o_reiniciar'].includes(conversation?.paso_actual || '')
    ? (fallback.previousStep || 'menu_principal')
    : (conversation?.paso_actual || fallback.previousStep || 'menu_principal');
  const previousSubstate = ['handoff_asesor', 'retomar_o_reiniciar'].includes(conversation?.paso_actual || '')
    ? (fallback.previousSubstate || 'inicio')
    : (conversation?.subestado_flujo || fallback.previousSubstate || 'inicio');
  return JSON.stringify({
    kind: 'resume_prompt',
    previousStep,
    previousSubstate,
    previousSummary: conversation?.resumen ?? null,
  });
}

function parseResumePromptPayload(raw = '') {
  try {
    const parsed = JSON.parse(raw || '{}');
    if (parsed?.kind === 'resume_prompt') return parsed;
  } catch {}
  return null;
}

function resumePromptText() {
  return `Pasaron más de 15 minutos desde tu último mensaje. Guardé lo que avanzaste ✅\n\n¿Qué deseas hacer ahora?\n\nA. Retomar con el bot\nB. Ir al menú principal`;
}

function advisorHandoffText(country = null) {
  const brand = country === 'CO' ? 'EVINKA Colombia' : 'EVINKA';
  return `Gracias por contactarnos.\n\nTe estamos comunicando con un asesor de ${brand} para atender tu caso de forma personalizada.\n\nEn breve uno de nuestros asesores continuará contigo por este mismo chat.\n\nSi en cualquier momento deseas volver al menú principal, escribe MENU.`;
}

function personalizedZoneHandoffText(country = null, customerName = '') {
  const brand = country === 'CO' ? 'EVINKA Colombia' : 'EVINKA';
  const firstName = String(customerName || '').trim().split(/\s+/).filter(Boolean)[0] || '';
  const greeting = firstName ? `${firstName}, ` : '';
  return `${greeting}no pude identificar automáticamente la zona correcta para tu dirección.\n\nPara no agendarte mal, voy a pasarte con un asesor de ${brand} para que revise tu ubicación y te ayude a continuar de forma personalizada.\n\nEn breve uno de nuestros asesores seguirá contigo por este mismo chat.`;
}

function advisorInactiveText() {
  return `Por el momento no tenemos un asesor activo en este canal.\n\n¿Qué deseas hacer ahora?\n\nA. Volver al menú principal`;
}

function advisorWaitingText() {
  return `Seguimos pendientes de tu caso 👍\n\nTu conversación sigue marcada para atención humana. En cuanto un asesor esté disponible, continuará contigo por este mismo chat.\n\nSi deseas salir de esta espera y volver al menú principal, escribe MENU.`;
}

function advisorTimeoutChoiceText() {
  return `Parece que nuestros asesores se encuentran ocupados en este momento.\n\nPuedes elegir una opción:\nA. Seguir esperando atención humana\nB. Volver al menú principal\n\nResponde A o B.`;
}

function timeoutResetText() {
  return `Pasó más de 1 día desde tu último mensaje, así que reinicié el flujo para evitar confusiones.\n\nSi deseas recuperar una cita existente, puedes enviarme tu ticket o tu documento. Si prefieres empezar de cero, usa el menú principal.`;
}

function ticketRequestPrompt(action = 'gestionar') {
  const label = action === 'reschedule'
    ? 'reprogramar tu visita'
    : action === 'cancel'
      ? 'cancelar tu visita'
      : 'ayudarte con tu cita';
  return `Perfecto 👍\n\nPara ${label}, por favor envíame tu ticket de reserva.\n\nEjemplo:\nWA-20260420-73B7E190`;
}

function ticketActionPrompt() {
  return `Perfecto 👍\n\n¿Qué deseas hacer con esta cita?`;
}

function extractTicketCode(value = '') {
  const raw = String(value || '').trim().toUpperCase();
  const match = raw.match(/\b[A-Z]{2,5}-\d{8}-[A-Z0-9]{6,12}\b/);
  if (match) return match[0];
  return null;
}

function bookingReminderPrompt({ ticket, dateLabel, hourLabel, address }) {
  return `Recordatorio de cita EVINKA ⏰\n\nTicket: ${ticket}\nFecha: ${dateLabel}\nHora: ${hourLabel}\nDirección: ${address}\n\n¿Qué deseas hacer con esta cita?`;
}

function parseReminderSummary(value = '') {
  try {
    const parsed = JSON.parse(String(value || '{}'));
    if (parsed?.kind === 'booking_reminder' && parsed.ticket) return parsed;
  } catch {}
  return null;
}

function pickReminderAction(text = '', letter = null) {
  const normalized = normalize(text);
  if (letter === 'A' || ['reminder_confirm', 'recordatorio_confirmar', 'confirmar', 'confirmo', 'si', 'sí', 'ok', 'vale', 'listo'].includes(normalized)) {
    return 'confirm';
  }
  if (letter === 'B' || ['reminder_reschedule', 'recordatorio_reprogramar', 'reprogramar', 'reagendar', 'cambiar', 'mover cita'].includes(normalized)) {
    return 'reschedule';
  }
  if (letter === 'C' || ['reminder_cancel', 'recordatorio_cancelar', 'cancelar', 'anular'].includes(normalized)) {
    return 'cancel';
  }
  return null;
}

function clipLabel(value = '', max = 24) {
  const text = cleanTextValue(value || '');
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

function makeButtonsReply(text, buttons, footer = 'EVINKA') {
  return { kind: 'buttons', text: compactLines(text), footer, buttons };
}

function makeListReply(text, rows, { title = '', buttonText = 'Ver opciones', footer = 'EVINKA' } = {}) {
  return {
    kind: 'list',
    text: compactLines(text),
    footer,
    buttonText,
    sections: [{ ...(title ? { title } : {}), rows }],
  };
}

function parseReplySummary(summary) {
  try { return JSON.parse(summary || 'null'); } catch { return null; }
}

function interactiveReplyForStep(step, text, { resumen, subestado, specialMenu = false } = {}) {
  switch (step) {
    case 'menu_principal':
      return makeStepList(step, text, [
        { id: 'A', title: 'Instalar cargador', description: 'Evaluar instalación y visita técnica' },
        { id: 'B', title: 'Reprogramar visita', description: 'Cambiar fecha u hora de una visita' },
        { id: 'C', title: 'Cancelar visita', description: 'Cancelar una cita existente' },
        { id: 'D', title: 'Asistencia técnica', description: 'Reportar falla o emergencia' },
        { id: 'E', title: 'Soporte humano', description: 'Si ya tenías seguimiento, escribe ASESOR' },
        ...(specialMenu ? [{ id: 'menu_test_mode', title: 'Modo pruebas', description: 'Pruebas del flujo como usuario final' }] : []),
      ], { title: 'Elige una opción', buttonText: 'Abrir menú' });
    case 'soporte_tipo':
      return makeStepButtons(step, text, [
        { id: 'A', title: 'Soporte técnico' },
        { id: 'B', title: 'Emergencia' },
        { id: 'C', title: 'Hablar con asesor' },
      ]);
    case 'soporte_equipo':
      return makeStepList(step, text, [
        { id: 'A', title: 'Cargador EVINKA' },
        { id: 'B', title: 'Punto de carga' },
        { id: 'C', title: 'Operación de grifo' },
        { id: 'D', title: 'Otro' },
      ], { title: 'Equipo afectado', buttonText: 'Elegir equipo' });
    case 'soporte_evidencia_opcion':
      return makeStepButtons(step, text, [
        { id: 'A', title: 'Enviar evidencia' },
        { id: 'B', title: 'Omitir' },
      ]);
    case 'soporte_confirmacion':
      return makeStepButtons(step, text, [
        { id: 'A', title: 'Enviar caso' },
        { id: 'B', title: 'Volver a empezar' },
        { id: 'C', title: 'Asesor' },
      ]);
    case 'esperando_timeout_asesor':
      return makeStepButtons(step, text, [
        { id: 'timeout_wait', title: 'Seguir esperando' },
        { id: 'timeout_menu', title: 'Menú principal' },
      ]);
    case 'seleccion_pais':
      return makeStepButtons(step, text, [
        { id: 'A', title: 'Perú' },
        { id: 'B', title: 'Colombia' },
      ]);
    case 'compra_menu':
      return makeStepButtons(step, text, [
        { id: 'A', title: 'Agendar visita' },
        { id: 'B', title: 'Menú principal' },
      ]);
    case 'capturando_localidad_co':
      return makeStepList(step, text, CO_ZONE_BOOKING_OPTIONS.map((item) => ({
        id: item.id,
        title: clipLabel(item.title, 24),
        description: item.description || '',
      })), { title: 'Seleccionar localidad', buttonText: 'Elegir zona' });
    case 'localidad_co_no_disponible':
      return makeStepButtons(step, text, [
        { id: 'A', title: 'Otra localidad' },
        { id: 'B', title: 'Menú principal' },
      ]);
    case 'consentimiento':
      return makeStepButtons(step, text, [
        { id: 'A', title: 'Sí, autorizo' },
        { id: 'B', title: 'No autorizo' },
      ]);
    case 'sin_autorizacion':
      return makeStepButtons(step, text, [
        { id: 'A', title: 'Menú principal' },
        { id: 'B', title: 'Retomar luego' },
      ]);
    case 'opcion_recibo':
      return makeStepButtons(step, text, [
        { id: 'A', title: 'Enviar archivo' },
        { id: 'B', title: 'Escribir datos' },
      ]);
    case 'confirmando_recibo_parcial':
      return makeStepButtons(step, text, [
        { id: 'A', title: 'Completar datos faltantes' },
        { id: 'B', title: 'Volver a enviar recibo' },
      ]);
    case 'confirmando_recibo':
      return makeStepButtons(step, text, [
        { id: 'A', title: 'Continuar' },
        { id: 'B', title: 'Corregir' },
      ]);
    case 'seleccionando_campo_recibo':
      return makeStepList(step, text, [
        { id: 'A', title: 'Dirección', description: 'Corregir dirección del suministro' },
        { id: 'B', title: 'Distrito', description: 'Corregir distrito' },
        { id: 'C', title: 'Provincia', description: 'Corregir provincia' },
        { id: 'D', title: 'Potencia', description: 'Corregir potencia contratada' },
      ], { title: 'Dato a corregir' });
    case 'quien_recibe_visita':
      return makeStepButtons(step, text, [
        { id: 'A', title: 'Yo recibiré' },
        { id: 'B', title: 'Otra persona' },
      ]);
    case 'confirmando_datos_receptor':
      return makeStepButtons(step, text, [
        { id: 'A', title: 'Confirmar' },
        { id: 'B', title: 'Corregir' },
      ]);
    case 'seleccionando_campo_receptor':
      return makeStepList(step, text, [
        { id: 'A', title: 'Nombre', description: 'Corregir nombre completo' },
        { id: 'B', title: 'Documento', description: 'Corregir documento' },
        { id: 'C', title: 'Teléfono', description: 'Corregir teléfono' },
        { id: 'D', title: 'Correo', description: 'Corregir correo electrónico' },
      ], { title: 'Dato a corregir' });
    case 'confirmando_direccion_instalacion':
      return makeStepButtons(step, text, [
        { id: 'A', title: 'Sí, correcta' },
        { id: 'B', title: 'No, corregir' },
      ]);
    case 'confirmando_vehiculo':
      return makeStepButtons(step, text, [
        { id: 'A', title: 'Confirmar' },
        { id: 'B', title: 'Corregir' },
      ]);
    case 'seleccionando_campo_vehiculo':
      return makeStepButtons(step, text, [
        { id: 'A', title: 'Marca' },
        { id: 'B', title: 'Modelo' },
        { id: 'C', title: 'Tipo' },
      ]);
    case 'capturando_datos_booking_residencial':
      if (subestado === 'tipo_documento') {
        return makeStepButtons(step, text, [
          { id: 'booking_doc_cc', title: '1️⃣ Cédula' },
          { id: 'booking_doc_nit', title: '2️⃣ NIT' },
          { id: 'booking_doc_passport', title: '3️⃣ Pasaporte' },
        ]);
      }
      if (subestado === 'marca_vehiculo') {
        return makeStepList(step, text, [
          ...BOOKING_VEHICLE_BRAND_PAGE_1.map((brand) => ({ id: brand, title: clipLabel(brand, 24), description: '' })),
          { id: 'MORE', title: 'Más opciones', description: 'Ver más marcas' },
        ], { title: 'Marca del vehículo', buttonText: 'Elegir marca' });
      }
      if (subestado === 'marca_vehiculo_more') {
        return makeStepList(step, text, [
          ...BOOKING_VEHICLE_BRAND_PAGE_2.map((brand) => ({ id: brand, title: clipLabel(brand, 24), description: '' })),
          { id: 'BACK', title: 'Volver', description: 'Regresar al listado anterior' },
        ], { title: 'Marca del vehículo', buttonText: 'Elegir marca' });
      }
      return null;
    case 'confirmando_datos_booking_residencial':
      return makeStepButtons(step, text, [
        { id: 'A', title: 'Sí, continuar' },
        { id: 'B', title: 'Corregir' },
      ]);
    case 'seleccionando_campo_booking_residencial':
      return makeStepList(step, text, [
        { id: 'booking_field_neighborhood', title: 'Barrio', description: 'Corregir barrio' },
        { id: 'booking_field_address', title: 'Dirección completa', description: 'Corregir dirección completa' },
        { id: 'booking_field_vehicle_brand', title: 'Marca del vehículo', description: 'Corregir marca del vehículo' },
        { id: 'booking_field_name', title: 'Nombres y apellidos', description: 'Corregir nombres y apellidos' },
        { id: 'booking_field_doc_type', title: 'Tipo de documento', description: 'Corregir tipo de documento' },
        { id: 'booking_field_doc_number', title: 'Número de documento', description: 'Corregir número de documento' },
        { id: 'booking_field_email', title: 'Correo electrónico', description: 'Corregir correo electrónico' },
        { id: 'booking_field_phone', title: 'Número de celular', description: 'Corregir número de celular' },
      ], { title: 'Dato a corregir' });
    case 'confirmando_agendamiento':
      return makeStepButtons(step, text, [
        { id: 'A', title: 'Sí, agendar' },
        { id: 'B', title: 'No por ahora' },
      ]);
    case 'sin_agenda_por_ahora':
      return makeStepButtons(step, text, [
        { id: 'A', title: 'Menú principal' },
        { id: 'B', title: 'Retomar luego' },
      ]);
    case 'seleccionando_dia':
    case 'seleccionando_dia_reprogramacion': {
      const days = Array.isArray(parseReplySummary(resumen)) ? parseReplySummary(resumen) : [];
      if (!days.length) return null;
      return makeStepList(step, text, days.map((item) => ({
        id: item.code,
        title: clipLabel(item.label, 24),
        description: item.date || '',
      })), { title: 'Días disponibles', buttonText: 'Elegir día' });
    }
    case 'seleccionando_bloque_horario':
    case 'seleccionando_bloque_horario_reprogramacion': {
      const parsed = step === 'seleccionando_bloque_horario_reprogramacion'
        ? parsePagedSlotSummary(resumen)
        : { items: Array.isArray(parseReplySummary(resumen)) ? parseReplySummary(resumen) : [], page: 0 };
      const rows = step === 'seleccionando_bloque_horario_reprogramacion'
        ? pagedSlotRows(parsed)
        : parsed.items.map((item) => ({
            id: item.code,
            title: clipLabel(item.dateLabel, 24),
            description: clipLabel(item.hourLabel, 48),
          }));
      if (!rows.length) return null;
      return makeStepList(step, text, rows, { title: 'Horarios disponibles', buttonText: 'Elegir horario' });
    }
    case 'seleccionando_hora':
    case 'seleccionando_hora_reprogramacion': {
      const parsed = parseReplySummary(resumen);
      const hours = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.hours) ? parsed.hours : []);
      if (!hours.length) return null;
      return makeStepList(step, text, hours.map((item) => ({
        id: item.code,
        title: clipLabel(item.label, 24),
        description: item.time || '',
      })), { title: 'Horarios disponibles', buttonText: 'Elegir hora' });
    }
    case 'confirmando_ticket':
      return makeStepButtons(step, text, [
        { id: 'A', title: 'Sí, es esa' },
        { id: 'B', title: 'No, otra cita' },
      ]);
    case 'recordatorio_cita':
      return makeStepButtons(step, text, [
        { id: 'A', title: 'Confirmar' },
        { id: 'B', title: 'Reprogramar' },
        { id: 'C', title: 'Cancelar' },
      ]);
    case 'accion_ticket':
      return makeStepButtons(step, text, [
        { id: 'A', title: 'Reprogramar' },
        { id: 'B', title: 'Cancelar' },
      ]);
    case 'sin_citas_encontradas':
      return makeStepButtons(step, text, [
        { id: 'A', title: 'Intentar otra vez' },
        { id: 'B', title: 'Menú principal' },
      ]);
    case 'retomar_o_reiniciar':
      return makeStepButtons(step, text, [
        { id: 'A', title: 'Retomar con bot' },
        { id: 'B', title: 'Menú principal' },
      ]);
    case 'handoff_asesor':
      return makeStepButtons(step, text, [
        { id: 'A', title: 'Menú principal' },
      ]);
    case 'cita_confirmada':
    case 'cita_reprogramada':
    case 'ticket_cancelado':
      return makeStepButtons(step, text, [
        { id: 'A', title: 'Menú principal' },
        { id: 'B', title: 'Reprogramar visita' },
      ]);
    case 'capturando_vehiculo':
      if (subestado === 'tipo') {
        return makeStepButtons(step, text, [
          { id: 'A', title: '100% eléctrico' },
          { id: 'B', title: 'Híbrido enchufable' },
          { id: 'C', title: 'No estoy seguro' },
        ]);
      }
      return null;
    case 'seleccionando_cita_identidad': {
      const options = decodeTicketOptions(resumen || '[]');
      if (!options.length) return null;
      return makeStepList(step, text, options.map((item) => ({
        id: item.code,
        title: clipLabel(`Cita ${item.code}`, 24),
        description: item.ticket,
      })), { title: 'Tus citas', buttonText: 'Elegir cita' });
    }
    default:
      return null;
  }
}

function finalConfirmation({ ticket, dateLabel, hourLabel, address, country = null, kind = 'confirmed' }) {
  if (country === 'CO') {
    if (kind === 'rescheduled') {
      return `¡Listo! ✨ Tu visita quedó actualizada.\n\nTicket: ${ticket}\nFecha: ${dateLabel}\nHora: ${hourLabel}\nDirección: ${address}\n\nSi quieres moverla otra vez o cancelarla, escríbenos por aquí.`;
    }
    return `✅ Tu visita técnica fue agendada exitosamente.\n\nTicket de reserva: ${ticket}\nFecha: ${dateLabel}\nHora: ${hourLabel}\nDirección: ${address}\n\nSi deseas continuar, puedes volver al menú principal o reprogramar la visita desde aquí.`;
  }
  return `Listo ✅\nTu visita técnica quedó confirmada.\n\nTicket: ${ticket}\nFecha: ${dateLabel}\nHora: ${hourLabel}\nDirección: ${address}\n\nSi más adelante necesitas reprogramar o cancelar, escríbenos por este mismo medio.\n\n¡Gracias por elegir EVINKA! ⚡`;
}

function encodeTicketOptions(options = []) {
  return JSON.stringify(options.map(({ code, ticket }) => ({ code, ticket })));
}

function compactTicketSummary(options = []) {
  return options.map(({ code, ticket }) => `${code}:${String(ticket).slice(-8)}`).join(' | ').slice(0, 100);
}

function decodeTicketOptions(value = '') {
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed.filter(x => x?.code && x?.ticket) : [];
  } catch {
    return [];
  }
}

function parseIdentityInput(lines) {
  const clean = lines.map(x => cleanTextValue(x)).filter(Boolean);
  if (!clean.length) return null;
  const docLine = clean.find(x => /^\D*\d{6,15}\D*$/.test(x) || /\b\d{6,15}\b/.test(x));
  const doc = docLine ? cleanDoc(docLine) : null;
  const nombre = clean.find(x => x !== docLine && /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(x)) || null;
  if (doc && isValidSupportedDoc(doc)) return { nombre: nombre ? cleanTextValue(nombre) : null, doc };
  const one = clean[0];
  const m = one.match(/^(.*?)(\d{6,15})$/);
  if (!m) return null;
  const parsedDoc = cleanDoc(m[2]);
  if (!isValidSupportedDoc(parsedDoc)) return null;
  return { nombre: cleanTextValue(m[1]), doc: parsedDoc };
}

function calendarShortName(fullName = '') {
  const parts = cleanTextValue(fullName).split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Cliente EVINKA';
  if (parts.length === 1) return titleCase(parts[0]);
  const surname = parts.length >= 3 ? parts[parts.length - 2] : parts[1];
  return titleCase(`${parts[0]} ${surname}`);
}

function calendarDescription({ ticket, appointment, profile, dateLabel, hourLabel }) {
  const doc = profile.dni_receptor || profile.ruc_receptor || appointment.dni_cliente || '';
  const docLabel = 'Documento';
  return [
    `Código: ${ticket}`,
    '',
    `Cliente: ${profile.nombre_receptor || appointment.nombre_cliente || ''}`,
    `Email: ${profile.correo_receptor || appointment.correo_cliente || ''}`,
    `Teléfono: ${profile.telefono_receptor || appointment.telefono_cliente || ''}`,
    doc ? `${docLabel}: ${doc}` : '',
    `Fecha: ${dateLabel}`,
    `Hora: ${hourLabel}`,
    `Dirección: ${profile.direccion_instalacion || appointment.direccion_cita || ''}`,
    `Distrito: ${profile.distrito_instalacion || appointment.distrito_cita || ''}`,
    `Provincia: ${profile.provincia_instalacion || appointment.provincia_cita || ''}`,
    `País: ${inferCountryFromZone(profile.zona_cliente || appointment.zona_cliente || profile.provincia_instalacion || appointment.provincia_cita || '') || ''}`,
    `Zona: ${profile.zona_cliente || appointment.zona_cliente || ''}`,
    `Vehículo: ${`${profile.marca_vehiculo || appointment.marca_vehiculo || ''} ${profile.modelo_vehiculo || appointment.modelo_vehiculo || ''}`.trim()}`,
  ].filter(Boolean).join('\n');
}

function calendarSyncNote(provider = '') {
  const normalized = String(provider || '').trim().toLowerCase();
  if (normalized === 'clickup') return 'Sincronizada con ClickUp.';
  if (normalized === 'hybrid') return 'Sincronizada con ClickUp y Microsoft Calendar.';
  return 'Sincronizada con Microsoft Calendar.';
}

export class ChatbotEngine {
  constructor({ sb, calendar = null, bookings = null, reminderScheduler = null, visitPublisher = null, supportCasePublisher = null }) {
    this.sb = sb;
    this.calendar = calendar;
    this.bookings = bookings;
    this.reminderScheduler = reminderScheduler;
    this.visitPublisher = visitPublisher;
    this.supportCasePublisher = supportCasePublisher;
    this.availabilityCache = new Map();
  }

  clearAvailabilityCache() {
    this.availabilityCache.clear();
  }

  bookingsEnabledForCountry(countryCode = null) {
    return String(countryCode || '').trim().toUpperCase() === 'CO' && typeof this.bookings?.isEnabled === 'function' && this.bookings.isEnabled();
  }

  normalizeWhatsappPhoneForBookings(value = '') {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('57') && digits.length === 12) return digits;
    if (digits.length === 10) return `57${digits}`;
    return digits;
  }

  bookingsIdempotencyKey({ whatsappPhone, serviceId, date, time, endTime }) {
    return createHash('sha256').update(`${whatsappPhone}|${serviceId}|${date}|${time}|${endTime}`).digest('hex');
  }

  bookingsStateTable() {
    return process.env.BOOKINGS_STATE_TABLE || 'booking_appointments_co';
  }

  async syncBookingState(action, payload = {}) {
    if (!this.sb) return null;
    const table = this.bookingsStateTable();
    try {
      if (action === 'upsert') {
        const bookingAppointmentId = payload.booking_appointment_id || null;
        const idempotencyKey = payload.idempotency_key || null;
        const match = bookingAppointmentId
          ? `booking_appointment_id=eq.${encodeURIComponent(bookingAppointmentId)}`
          : idempotencyKey
            ? `idempotency_key=eq.${encodeURIComponent(idempotencyKey)}`
            : null;
        if (!match) return null;
        const existing = await this.sb.select(table, `${match}&select=*`);
        if (existing.length) {
          const rows = await this.sb.update(table, match, { ...payload, actualizado_en: new Date().toISOString() });
          return rows[0] || null;
        }
        const rows = await this.sb.insert(table, { ...payload, actualizado_en: new Date().toISOString() });
        return rows[0] || null;
      }
      if (action === 'findByPhone') {
        const phone = this.normalizeWhatsappPhoneForBookings(payload.whatsappPhone || '');
        if (!phone) return null;
        const rows = await this.sb.select(table, `whatsapp_phone=eq.${encodeURIComponent(phone)}&order=starts_at_local.desc&limit=1&select=*`);
        return rows[0] || null;
      }
    } catch (error) {
      const message = String(error?.message || '');
      if (message.includes('relation') || message.includes('does not exist') || message.includes('404')) return null;
      console.warn('syncBookingState skipped:', error?.message || error);
    }
    return null;
  }

  async findManagedColombiaAppointment(conversation, fallbackTicket = null) {
    const phone = this.normalizeWhatsappPhoneForBookings(this.phoneForUserId(conversation?.id_usuario || ''));
    if (!phone || !this.bookingsEnabledForCountry('CO')) return null;
    const local = await this.syncBookingState('findByPhone', { whatsappPhone: phone });
    if (local?.booking_appointment_id) {
      try {
        const result = await this.bookings.getAppointment({ appointmentId: local.booking_appointment_id });
        if (result?.appointment) return { appointment: result.appointment, localState: local, whatsappPhone: phone };
      } catch (error) {
        if (error?.reason !== 'not_found') throw error;
      }
    }
    const result = await this.bookings.getAppointment({ appointmentId: null, whatsappPhone: phone });
    if (!result?.appointment) return null;
    return { appointment: result.appointment, localState: local, whatsappPhone: phone };
  }

  async buildManagedColombiaSlots(zone, { limit = 10 } = {}) {
    const availability = await this.bookings.getAvailability({ zone, limit: Math.max(limit, 10) });
    return availability?.slots || [];
  }

  async createManagedColombiaBooking({ conversation, profile, draft, chosen }) {
    const whatsappPhone = this.normalizeWhatsappPhoneForBookings(this.phoneForUserId(conversation.id_usuario));
    const addressLine = bookingAddressLine(draft);
    const serviceId = chosen.serviceId || null;
    const idempotencyKey = this.bookingsIdempotencyKey({ whatsappPhone, serviceId, date: chosen.date, time: chosen.time, endTime: chosen.endTime });
    const existingState = await this.syncBookingState('upsert', {
      booking_appointment_id: null,
      idempotency_key: idempotencyKey,
      booking_business_id: this.bookings.businessId,
      booking_service_id: serviceId,
      whatsapp_phone: whatsappPhone,
      customer_phone: this.normalizeWhatsappPhoneForBookings(draft.telefono || whatsappPhone),
      customer_name: draft.nombre || null,
      customer_email: draft.correo || null,
      starts_at_local: `${chosen.date}T${chosen.time}-05:00`,
      ends_at_local: `${chosen.date}T${chosen.endTime}-05:00`,
      local_date: chosen.date,
      local_start_time: chosen.time,
      local_end_time: chosen.endTime,
      zone,
      status: 'pending_create',
      id_usuario: conversation.id_usuario,
      id_conversacion: conversation.id_conversacion,
    });
    if (existingState?.booking_appointment_id) {
      const existingRemote = await this.bookings.getAppointment({ appointmentId: existingState.booking_appointment_id });
      if (existingRemote?.appointment) return { booking: existingRemote.appointment, localState: existingState, idempotencyKey };
    }
    const answers = {
      documento: draft.tipo_documento,
      barrio: draft.barrio,
      direccion: addressLine,
      numero_documento: draft.numero_documento,
      marca_vehiculo: draft.marca_vehiculo,
      ya_tiene_vehiculo: 'Sí',
      ya_tiene_cargador: 'No',
    };
    const created = await this.bookings.createAppointment({
      zone,
      slot: chosen,
      whatsappPhone,
      customer: {
        name: draft.nombre,
        phone: draft.telefono,
        email: draft.correo,
      },
      answers,
      notes: `Zona: ${zone}\nDirección: ${addressLine}\nBarrio: ${draft.barrio || ''}\nDocumento: ${draft.tipo_documento || ''} ${draft.numero_documento || ''}`,
    });
    const booking = created.appointment;
    const technicianId = booking?.staffMemberIds?.[0] || created.staffId || chosen.defaultStaffId || null;
    const appointment = await this.createOrUpdateAppointment(conversation, profile, {
      codigo_cita: this.ticketFor(chosen.date, conversation.id_conversacion),
      fecha_cita: chosen.date,
      hora_inicio: chosen.time,
      hora_fin: chosen.endTime,
      fecha_hora_inicio: `${chosen.date}T${chosen.time}-05:00`,
      fecha_hora_fin: `${chosen.date}T${chosen.endTime}-05:00`,
      nombre_cliente: draft.nombre,
      telefono_cliente: draft.telefono,
      dni_cliente: cleanTextValue(draft.numero_documento || '') || null,
      correo_cliente: draft.correo,
      direccion_cita: addressLine,
      distrito_cita: draft.localidad || zone,
      provincia_cita: 'Colombia',
      zona_cliente: zone,
      zona_dia: zone,
      control_zona: zone,
      etiqueta_horario: compactScheduleLabel(chosen.time, chosen.endTime),
      marca_vehiculo: draft.marca_vehiculo || null,
      modelo_vehiculo: null,
      potencia_kw: null,
      fase_electrica: 'no_definido',
      validacion_recibo: false,
      estado_cita: 'confirmada',
      aprobacion: 'aprobada',
      confirmada_por_cliente: true,
      confirmada_en: new Date().toISOString(),
      observaciones: `Bookings appointmentId=${booking?.id || ''}; staffId=${technicianId || ''}; serviceId=${serviceId || ''}`.trim(),
    });
    const state = await this.syncBookingState('upsert', {
      booking_appointment_id: booking?.id || null,
      idempotency_key: created.idempotencyKey || idempotencyKey,
      booking_business_id: this.bookings.businessId,
      booking_service_id: serviceId,
      booking_service_name: chosen.serviceName || null,
      booking_staff_id: technicianId,
      whatsapp_phone: whatsappPhone,
      customer_phone: created.customerPhone || this.normalizeWhatsappPhoneForBookings(draft.telefono || whatsappPhone),
      customer_name: draft.nombre || null,
      customer_email: draft.correo || null,
      starts_at_local: `${chosen.date}T${chosen.time}-05:00`,
      ends_at_local: `${chosen.date}T${chosen.endTime}-05:00`,
      local_date: chosen.date,
      local_start_time: chosen.time,
      local_end_time: chosen.endTime,
      zone,
      status: 'booked',
      ticket: appointment.codigo_cita,
      id_usuario: conversation.id_usuario,
      id_conversacion: conversation.id_conversacion,
      id_cita: appointment.id_cita,
      graph_payload: created.payload,
      graph_last_response: booking,
    });
    return { booking, appointment, localState: state, technicianId };
  }

  async rescheduleManagedColombiaBooking({ conversation, cita, chosen }) {
    const managed = await this.findManagedColombiaAppointment(conversation, cita?.codigo_cita || null);
    const appointmentId = managed?.appointment?.id || managed?.localState?.booking_appointment_id || null;
    if (!appointmentId) throw new Error('No encontré la cita de Bookings asociada al teléfono de WhatsApp.');
    await this.bookings.updateAppointment({ appointmentId, startDate: chosen.date, startTime: chosen.time, endTime: chosen.endTime });
    await this.sb.update('citas', `id_cita=eq.${cita.id_cita}`, {
      fecha_cita: chosen.date,
      hora_inicio: chosen.time,
      hora_fin: chosen.endTime,
      fecha_hora_inicio: `${chosen.date}T${chosen.time}-05:00`,
      fecha_hora_fin: `${chosen.date}T${chosen.endTime}-05:00`,
      etiqueta_horario: compactScheduleLabel(chosen.time, chosen.endTime),
      estado_cita: 'reprogramada',
      motivo_reprogramacion: 'Reprogramada por cliente desde WhatsApp (Bookings).',
      confirmada_por_cliente: true,
      confirmada_en: new Date().toISOString(),
    });
    await this.syncBookingState('upsert', {
      booking_appointment_id: appointmentId,
      whatsapp_phone: this.normalizeWhatsappPhoneForBookings(this.phoneForUserId(conversation.id_usuario)),
      starts_at_local: `${chosen.date}T${chosen.time}-05:00`,
      ends_at_local: `${chosen.date}T${chosen.endTime}-05:00`,
      local_date: chosen.date,
      local_start_time: chosen.time,
      local_end_time: chosen.endTime,
      zone: cita.zona_cliente || null,
      status: 'rescheduled',
      ticket: cita.codigo_cita,
      id_usuario: conversation.id_usuario,
      id_conversacion: conversation.id_conversacion,
      id_cita: cita.id_cita,
    });
    return appointmentId;
  }

  async cancelManagedColombiaBooking({ conversation, cita, reason = 'Cancelada por cliente desde WhatsApp.' }) {
    const managed = await this.findManagedColombiaAppointment(conversation, cita?.codigo_cita || null);
    const appointmentId = managed?.appointment?.id || managed?.localState?.booking_appointment_id || null;
    if (!appointmentId) throw new Error('No encontré la cita de Bookings asociada al teléfono de WhatsApp.');
    await this.bookings.cancelAppointment({ appointmentId, reason });
    await this.sb.update('citas', `id_cita=eq.${cita.id_cita}`, {
      estado_cita: 'cancelada',
      motivo_cancelacion: reason,
      cancelada_en: new Date().toISOString(),
    });
    await this.syncBookingState('upsert', {
      booking_appointment_id: appointmentId,
      whatsapp_phone: this.normalizeWhatsappPhoneForBookings(this.phoneForUserId(conversation.id_usuario)),
      zone: cita.zona_cliente || null,
      status: 'cancelled',
      ticket: cita.codigo_cita,
      id_usuario: conversation.id_usuario,
      id_conversacion: conversation.id_conversacion,
      id_cita: cita.id_cita,
      cancelled_at: new Date().toISOString(),
      last_error_message: null,
    });
    return appointmentId;
  }

  async availableDaysForZone(zone, { includeToday = false } = {}) {
    const days = includeToday ? rescheduleDays(zone) : nextDays(addDays(currentDateInLima(), 1), zone);
    if (!this.calendar) {
      return days
        .filter((day) => hoursForDate(day.date, zone).length)
        .slice(0, 5)
        .map((day, index) => ({ ...day, code: String.fromCharCode(65 + index) }));
    }
    const out = [];
    for (const day of days) {
      const slots = await this.availableHoursForDate(day.date, { clientZone: zone });
      if (slots.length) out.push(day);
      if (out.length >= 5) break;
    }
    return out.map((day, index) => ({ ...day, code: String.fromCharCode(65 + index) }));
  }

  async availableDateHourOptionsForZone(zone, { includeToday = false, excludeEventId = null, limit = 10, throughFriday = false } = {}) {
    const days = throughFriday
      ? nextDaysThroughFriday(includeToday ? currentDateInLima() : addDays(currentDateInLima(), 1), zone)
      : (includeToday ? rescheduleDays(zone) : nextDays(addDays(currentDateInLima(), 1), zone));
    const options = [];
    for (const day of days) {
      const hours = await this.availableHoursForDate(day.date, { excludeEventId, clientZone: zone });
      for (const hour of hours) {
        options.push({
          code: String.fromCharCode(65 + options.length),
          date: day.date,
          weekday: day.weekday,
          dateLabel: day.label,
          hourLabel: hour.label,
          time: hour.time,
          endTime: hour.endTime,
        });
        if (!throughFriday && options.length >= limit) return options;
      }
    }
    return options;
  }

  async availableHoursForDate(date, { excludeEventId = null, clientZone = null } = {}) {
    if (this.bookingsEnabledForCountry(inferCountryFromZone(clientZone || ''))) {
      const availability = await this.bookings.getAvailability({ zone: clientZone, startDate: date, endDate: date, limit: 30 });
      return (availability?.slots || []).filter((slot) => !excludeEventId || slot.id !== excludeEventId);
    }
    const slots = hoursForDate(date, clientZone);
    if (!this.calendar || !slots.length) return slots;
    const cacheKey = `${date}|${String(clientZone || '').toUpperCase().trim()}|${String(excludeEventId || '')}`;
    const now = Date.now();
    const cached = this.availabilityCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      if (cached.promise) return cached.promise;
      return cached.slots.map((slot) => ({ ...slot }));
    }
    const promise = (async () => {
      const events = await this.calendar.listEvents({
        startDateTime: `${date}T00:00:00-05:00`,
        endDateTime: `${date}T23:59:59-05:00`,
        top: 100,
        clientZone,
        countryCode: inferCountryFromZone(clientZone) || null,
      });
      const normalizedClientZone = String(clientZone || '').toUpperCase().trim();
      const normalizedClientCountry = inferCountryFromZone(clientZone) || null;
      const sharedCapacity = normalizedClientCountry === 'CO' ? COLOMBIA_SHARED_TECH_CAPACITY : 1;
      const relevant = events.filter(event => {
        if (event.id === excludeEventId || event.isCancelled) return false;
        const eventText = event.body?.content || event.bodyPreview || '';
        const eventZone = eventZoneFromText(eventText);
        const eventCountry = eventCountryFromText(eventText) || inferCountryFromZone(eventZone || '');
        if (normalizedClientCountry && eventCountry && eventCountry !== normalizedClientCountry) return false;
        if (normalizedClientCountry === 'PE') return true;
        if (!normalizedClientZone) return true;
        return !eventZone || eventZone === normalizedClientZone;
      });
      const available = slots.filter(slot => {
        const slotStart = new Date(`${date}T${slot.time}-05:00`);
        const slotEnd = new Date(`${date}T${slot.endTime}-05:00`);
        const blocking = relevant.filter(event => {
          const start = parseCalendarDateTime(event.start?.dateTime || event.start, event.start?.timeZone);
          let end = parseCalendarDateTime(event.end?.dateTime || event.end, event.end?.timeZone);
          if (!start || Number.isNaN(start.getTime())) return false;
          if (!end || Number.isNaN(end.getTime())) {
            end = new Date(start.getTime() + PE_VISIT_DURATION_MINUTES * 60 * 1000);
          }
          if (normalizedClientCountry === 'PE') {
            const operationalEnd = new Date(start.getTime() + PE_VISIT_DURATION_MINUTES * 60 * 1000);
            return !hasMinimumGapBetweenVisits(slotStart, slotEnd, start, operationalEnd, PE_TRAVEL_BUFFER_MINUTES);
          }
          return overlaps(slotStart, slotEnd, start, end);
        });
        return blocking.length < sharedCapacity;
      });
      this.availabilityCache.set(cacheKey, { expiresAt: Date.now() + 15000, slots: available.map((slot) => ({ ...slot })) });
      return available;
    })();
    this.availabilityCache.set(cacheKey, { expiresAt: now + 15000, promise });
    try {
      return await promise;
    } catch (error) {
      this.availabilityCache.delete(cacheKey);
      throw error;
    }
  }

  async ensureCalendarEvent({ appointment, profile, dateLabel, hourLabel, ticket }) {
    if (!this.calendar) return null;
    const subject = calendarShortName(profile.nombre_receptor || appointment.nombre_cliente || '');
    const body = calendarDescription({ ticket, appointment, profile, dateLabel, hourLabel });
    const location = `${appointment.direccion_cita || profile.direccion_instalacion || ''}`.trim();
    const attendeeEmail = profile.correo_receptor || appointment.correo_cliente || '';
    const attendees = attendeeEmail ? [{ emailAddress: { address: attendeeEmail, name: profile.nombre_receptor || appointment.nombre_cliente || attendeeEmail }, type: 'required' }] : [];
    const countryCode = inferCountryFromZone(profile.zona_cliente || appointment.zona_cliente || profile.provincia_instalacion || appointment.provincia_cita || '') || null;

    if (appointment.microsoft_event_id) {
      await this.calendar.updateEvent(appointment.microsoft_event_id, {
        subject,
        start: { dateTime: appointment.fecha_hora_inicio, timeZone: 'America/Lima' },
        end: { dateTime: appointment.fecha_hora_fin, timeZone: 'America/Lima' },
        body: { contentType: 'text', content: body },
        location: { displayName: location },
        attendees,
        countryCode,
      });
      this.clearAvailabilityCache();
      return appointment.microsoft_event_id;
    }

    const event = await this.calendar.createEvent({
      subject,
      startDateTime: appointment.fecha_hora_inicio.replace(/-05:00$/, ''),
      endDateTime: appointment.fecha_hora_fin.replace(/-05:00$/, ''),
      timeZone: 'America/Lima',
      body,
      location,
      attendees,
      categories: ['EVINKA'],
      countryCode,
    });
    this.clearAvailabilityCache();
    return event.id;
  }

  phoneForUserId(userId = '') {
    return String(userId || '')
      .replace(/^wco_/, '')
      .replace(/^whatsapp_/, '')
      .trim();
  }

  async scheduleBookingReminder({ userId, ticket, dateLabel, hourLabel, address }) {
    if (typeof this.reminderScheduler !== 'function') return null;
    const to = this.phoneForUserId(userId);
    if (!to || !ticket || !dateLabel || !hourLabel || !address) return null;
    const userScope = String(userId || '').startsWith('wco_') ? 'co' : 'default';
    return this.reminderScheduler({ to, ticket, dateLabel, hourLabel, address, userScope });
  }

  async publishTechVisit({ conversation, profile, appointment, dateLabel, hourLabel }) {
    if (typeof this.visitPublisher !== 'function') return null;
    const fullAddress = [profile.direccion_instalacion, profile.distrito_instalacion, profile.provincia_instalacion]
      .filter(Boolean)
      .join(' ')
      .trim();
    const corporateSignals = [
      conversation?.motivo_handoff,
      conversation?.resumen,
      conversation?.intencion_principal,
      conversation?.subestado_flujo,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const customerSegment = String(profile?.nombre_empresa || '').trim() || /\b(corporativo|empresa|b2b|asesor_corporativo)\b/.test(corporateSignals)
      ? 'b2b'
      : 'b2c';
    const countryCode = inferCountryFromZone(profile.zona_cliente || appointment.zona_cliente || profile.provincia_instalacion || appointment.provincia_cita || '') || null;
    return this.visitPublisher({
      reference: appointment.codigo_cita,
      source: 'chatbot',
      type: 'visita_tecnica',
      status: 'agendada',
      clientName: profile.nombre_receptor || appointment.nombre_cliente || '',
      clientPhone: profile.telefono_receptor || appointment.telefono_cliente || '',
      clientDocument: profile.dni_receptor || profile.ruc_receptor || appointment.dni_cliente || '',
      clientEmail: profile.correo_receptor || appointment.correo_cliente || '',
      clientAddress: fullAddress || appointment.direccion_cita || '',
      customerSegment,
      companyName: profile.nombre_empresa || '',
      scheduledAt: appointment.fecha_hora_inicio,
      timeWindow: hourLabel,
      notes: `Visita creada automáticamente desde el chatbot. Ticket ${appointment.codigo_cita}.`,
      quoteId: '',
      installationOrderId: '',
      assignedTechEmail: process.env.TECH_VISITS_DEFAULT_EMAIL || 'luis.campos@evinka.tech',
      assignedTechName: process.env.TECH_VISITS_DEFAULT_NAME || 'Luis Campos',
      countryCode,
      clickupTaskId: countryCode === 'PE' ? (appointment.microsoft_event_id || '') : '',
      checklist: [
        'Confirmar acceso al sitio',
        'Tomar fotos iniciales',
        'Validar tablero y punto de instalación',
      ],
      conversationId: conversation.id_conversacion,
      ticket: appointment.codigo_cita,
      dateLabel,
      hourLabel,
    });
  }

  async publishSupportCase({ conversation, profile, caseData, countryCode = null, userScope = 'default' }) {
    if (typeof this.supportCasePublisher !== 'function') return null;
    return this.supportCasePublisher({
      conversation,
      profile,
      caseData,
      countryCode,
      userScope,
      customerPhone: this.phoneForUserId(conversation?.id_usuario || ''),
    });
  }

  async ensureUser(phone, scope = 'default') {
    const normalizedPhone = String(phone || '').replace(/[^+\d]/g, '');
    const normalizedScope = String(scope || 'default').trim().toLowerCase();
    const scopedPrefix = normalizedScope === 'co' ? 'wco_' : 'whatsapp_';
    const scopedId = normalizedPhone.startsWith(scopedPrefix) ? normalizedPhone : `${scopedPrefix}${normalizedPhone}`;
    const legacyId = normalizedPhone.startsWith('whatsapp_') ? normalizedPhone : `whatsapp_${normalizedPhone}`;
    const candidateIds = normalizedScope === 'default'
      ? [...new Set([legacyId, normalizedPhone].filter(Boolean))]
      : [scopedId];

    for (const candidateId of candidateIds) {
      const users = await this.sb.select('usuarios', `id_usuario=eq.${encodeURIComponent(candidateId)}&select=*`);
      if (users.length) return users[0];
    }

    const id = normalizedScope === 'default'
      ? (legacyId.length <= 20 ? legacyId : normalizedPhone)
      : scopedId;
    const rows = await this.sb.insert('usuarios', { id_usuario: id, telefono_principal: normalizedPhone });
    return rows[0];
  }

  normalizeUserRole(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (['cliente', 'customer'].includes(normalized)) return 'cliente';
    if (['tecnico', 'tecnico_evinka', 'tech', 'technician'].includes(normalized)) return 'tecnico';
    if (['asesor', 'advisor', 'admin', 'supervisor'].includes(normalized)) return 'asesor';
    return null;
  }

  async syncUserRole(userId, role, source = 'auto') {
    const normalizedRole = this.normalizeUserRole(role);
    if (!normalizedRole || !userId) return null;
    try {
      const rows = await this.sb.update('usuarios', `id_usuario=eq.${encodeURIComponent(userId)}`, {
        rol_usuario: normalizedRole,
        fuente_rol: source,
      });
      return rows[0] || null;
    } catch (error) {
      console.warn('syncUserRole skipped:', error?.message || error);
      return null;
    }
  }

  async rememberUserName(user = null, candidateName = '', source = 'whatsapp_profile') {
    const normalizedName = normalizeDisplayName(candidateName);
    if (!user?.id_usuario || !normalizedName) return user;
    const currentVisible = normalizeDisplayName(user.nombre_visible || '');
    const currentStored = normalizeDisplayName(user.nombre_usuario || '');
    if (currentVisible || currentStored) return user;
    try {
      const rows = await this.sb.update('usuarios', `id_usuario=eq.${encodeURIComponent(user.id_usuario)}`, {
        nombre_visible: normalizedName,
        nombre_usuario: normalizedName,
      });
      return rows[0] || { ...user, nombre_visible: normalizedName, nombre_usuario: normalizedName };
    } catch (error) {
      console.warn('rememberUserName skipped:', error?.message || error);
      return { ...user, nombre_visible: normalizedName, nombre_usuario: normalizedName };
    }
  }

  async createConversation(user, overrides = {}) {
    const created = await this.sb.insert('conversaciones', {
      id_usuario: user.id_usuario,
      canal: 'whatsapp',
      estado_conversacion: 'open',
      paso_actual: 'menu_principal',
      subestado_flujo: 'inicio',
      ...overrides,
    });
    return created[0];
  }

  async getOrCreateConversation(user) {
    const rows = await this.sb.select('conversaciones', `id_usuario=eq.${encodeURIComponent(user.id_usuario)}&estado_conversacion=in.(open,paused,handoff)&order=creado_en.desc&limit=1`);
    if (rows.length) return rows[0];
    return this.createConversation(user);
  }

  async getLatestConversation(user) {
    const rows = await this.sb.select('conversaciones', `id_usuario=eq.${encodeURIComponent(user.id_usuario)}&order=creado_en.desc&limit=1`);
    return rows[0] || null;
  }

  async activateBookingReminder({ phone, ticket, dateLabel, hourLabel, address, userScope = 'default' }) {
    const user = await this.ensureUser(phone, userScope);
    const summary = JSON.stringify({ kind: 'booking_reminder', ticket, dateLabel, hourLabel, address });
    const conversation = await this.createConversation(user, {
      paso_actual: 'recordatorio_cita',
      subestado_flujo: ticket,
      resumen: summary,
      accion_ticket_actual: 'confirm',
      codigo_ticket_solicitado: ticket,
      intencion_principal: 'otro',
    });
    await this.logMessage(conversation.id_conversacion, conversation.id_usuario, 'assistant', bookingReminderPrompt({ ticket, dateLabel, hourLabel, address }), {
      tipo_mensaje: 'interactive',
    });
    return conversation;
  }

  async getOrCreateProfile(conversation) {
    const rows = await this.sb.select('perfiles_cliente', `id_conversacion=eq.${conversation.id_conversacion}&select=*`);
    if (rows.length) return rows[0];
    const created = await this.sb.insert('perfiles_cliente', {
      id_usuario: conversation.id_usuario,
      id_conversacion: conversation.id_conversacion,
      estado_perfil: 'incomplete',
    });
    return created[0];
  }

  async logMessage(conversationId, userId, rol, contenido, extra = {}) {
    await this.sb.insert('mensajes', {
      id_conversacion: conversationId,
      id_usuario: userId,
      rol,
      contenido,
      tipo_mensaje: extra.tipo_mensaje || 'text',
      payload_crudo: extra.payload_crudo || null,
      entrada_valida: extra.entrada_valida ?? (rol === 'user' ? true : null),
      confianza_lectura: extra.confianza_lectura ?? null,
    });
  }

  async patchConversation(conversationId, patch) {
    const rows = await this.sb.update('conversaciones', `id_conversacion=eq.${conversationId}`, patch);
    return rows[0];
  }

  async patchProfile(conversationId, patch) {
    const rows = await this.sb.update('perfiles_cliente', `id_conversacion=eq.${conversationId}`, patch);
    return rows[0];
  }

  async createOrUpdateAppointment(conversation, profile, data) {
    const existing = await this.sb.select('citas', `id_conversacion=eq.${conversation.id_conversacion}&select=*`);
    if (existing.length) {
      const rows = await this.sb.update('citas', `id_cita=eq.${existing[0].id_cita}`, data);
      return rows[0];
    }
    const rows = await this.sb.insert('citas', { id_usuario: conversation.id_usuario, id_conversacion: conversation.id_conversacion, id_perfil: profile.id_perfil, ...data });
    return rows[0];
  }

  ticketFor(date, seed) {
    const compact = String(seed || '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(-8)
      .padStart(8, '0');
    return `WA-${date.replaceAll('-', '')}-${compact}`;
  }

  async reply(conversation, text, patch = {}) {
    await this.patchConversation(conversation.id_conversacion, { ultimo_mensaje_en: new Date().toISOString(), ...patch });
    const nextStep = patch.paso_actual || conversation.paso_actual || 'menu_principal';
    const specialMenu = nextStep === 'menu_principal' && isTestFlowPhone(this.phoneForUserId(conversation.id_usuario));
    const finalText = specialMenu ? `${text}\n\nF. Modo pruebas` : text;
    await this.logMessage(conversation.id_conversacion, conversation.id_usuario, 'assistant', finalText);
    const interactive = interactiveReplyForStep(nextStep, finalText, { resumen: patch.resumen ?? conversation.resumen ?? null, subestado: patch.subestado_flujo ?? conversation.subestado_flujo ?? null, specialMenu });
    if (interactive) return ensureAdvisorOption(interactive);
    return { kind: 'text', text: addAdvisorHint(finalText, nextStep) };
  }

  async replySequence(conversation, messages = [], patch = {}) {
    await this.patchConversation(conversation.id_conversacion, { ultimo_mensaje_en: new Date().toISOString(), ...patch });
    const normalized = [];
    const nextStep = patch.paso_actual || conversation.paso_actual || 'menu_principal';
    const specialMenu = nextStep === 'menu_principal' && isTestFlowPhone(this.phoneForUserId(conversation.id_usuario));
    for (let i = 0; i < messages.length; i += 1) {
      const item = messages[i];
      const text = typeof item === 'string' ? item : String(item?.text || '');
      const finalText = specialMenu && i === messages.length - 1 ? `${text}\n\nF. Modo pruebas` : text;
      await this.logMessage(conversation.id_conversacion, conversation.id_usuario, 'assistant', finalText);
      const interactive = interactiveReplyForStep(i === messages.length - 1 ? nextStep : '__sequence__', finalText, { resumen: patch.resumen ?? conversation.resumen ?? null, subestado: patch.subestado_flujo ?? conversation.subestado_flujo ?? null, specialMenu });
      normalized.push(interactive || { kind: 'text', text: finalText });
    }
    return { kind: 'sequence', messages: normalized };
  }

  async applyReceiptData(conversation, data, media = null, { partial = false } = {}) {
    const origenRecibo = media?.mimeType === 'application/pdf'
      ? 'pdf'
      : (media?.mimeType || '').startsWith('image/')
        ? 'image'
        : 'ocr';
    await this.patchProfile(conversation.id_conversacion, {
      titular_recibo: data.titular || null,
      direccion_recibo: data.direccion || null,
      distrito_recibo: data.distrito || null,
      provincia_recibo: data.provincia || null,
      potencia_kw: data.potencia ?? null,
      origen_recibo: origenRecibo,
      lectura_recibo_exitosa: !partial,
      recibo_url: media?.id ? `meta://media/${media.id}` : null,
      recibo_nombre_archivo: media?.fileName || null,
      recibo_tipo_archivo: media?.mimeType || null,
      datos_recibo_extraidos: {
        ...data,
        raw_text: media?.ocr?.rawText || null,
        media_id: media?.id || null,
        partial,
      },
      datos_recibo_manuales: partial ? data : null,
    });
    if (partial) {
      return this.reply(conversation, partialReceiptConfirmationPrompt(data), { paso_actual: 'confirmando_recibo_parcial', subestado_flujo: 'ocr_parcial' });
    }
    return this.reply(conversation, receiptSummary(data), { paso_actual: 'confirmando_recibo', subestado_flujo: 'confirmacion_recibo_archivo' });
  }

  async handleIncoming({ phone, text = '', media = null, payloadCrudo = null, defaultCountry = null, userScope = 'default', profileName = '' }) {
    let user = await this.ensureUser(phone, userScope);
    if (profileName) {
      user = await this.rememberUserName(user, profileName, 'whatsapp_profile');
    }
    const latestConversation = await this.getLatestConversation(user);
    const latestLetter = pickLetter(text, payloadCrudo, latestConversation?.paso_actual || '');
    let conversation;
    const inactivityMs = latestConversation?.ultimo_mensaje_en ? (Date.now() - new Date(latestConversation.ultimo_mensaje_en).getTime()) : 0;
    const shouldForceReset = latestConversation && ['open', 'paused'].includes(latestConversation.estado_conversacion) && inactivityMs > FLOW_RESET_WINDOW_MS;
    const shouldResumePrompt = needsResumePrompt(latestConversation, inactivityMs);
    if (latestConversation && latestConversation.estado_conversacion === 'closed' && ['cita_confirmada', 'cita_reprogramada', 'ticket_cancelado'].includes(latestConversation.paso_actual || '') && latestLetter) {
      conversation = await this.createConversation(user, { subestado_flujo: 'post_cierre' });
    } else if (shouldForceReset) {
      await this.patchConversation(latestConversation.id_conversacion, { estado_conversacion: 'closed', paso_actual: latestConversation.paso_actual || 'menu_principal', subestado_flujo: 'timeout_24h', cerrada_en: new Date().toISOString() });
      conversation = await this.createConversation(user, { subestado_flujo: 'reinicio_timeout_24h' });
    } else if (latestConversation && latestConversation.estado_conversacion === 'closed' && !latestLetter) {
      conversation = await this.getOrCreateConversation(user);
    } else {
      conversation = await this.getOrCreateConversation(user);
    }
    let profile = await this.getOrCreateProfile(conversation);
    const mediaType = media ? ((media.mimeType || '').startsWith('image/') ? 'image' : (media.mimeType === 'application/pdf' ? 'document' : 'document')) : 'text';
    await this.logMessage(conversation.id_conversacion, conversation.id_usuario, 'user', media ? `[${media.mimeType || media.fileName || 'archivo'}] ${text || ''}`.trim() : text, {
      tipo_mensaje: mediaType,
      payload_crudo: payloadCrudo || { text, media },
    });

    const forcedChannelCountry = ['PE', 'CO'].includes(String(defaultCountry || '').toUpperCase())
      ? String(defaultCountry || '').toUpperCase()
      : null;
    const selectedCountry = forcedChannelCountry || inferCountryFromZone(profile?.zona_cliente) || countryFromIntent(conversation.intencion_principal) || detectPhoneCountry(phone);
    const step = conversation.paso_actual || 'menu_principal';
    const letter = pickLetter(text, payloadCrudo, step);
    const specialTestFlow = isTestFlowPhone(phone);
    const corporateLead = extractCorporateLead(text);
    const sendToAdvisor = (reason = 'Soporte humano solicitado', customText = null, extraPatch = {}) => this.reply(
      conversation,
      customText || advisorHandoffText(selectedCountry),
      {
        paso_actual: 'handoff_asesor',
        subestado_flujo: selectedCountry === 'CO' ? 'asesor_co' : 'asesor_pe',
        estado_conversacion: 'handoff',
        requiere_handoff: true,
        motivo_handoff: reason,
        intencion_principal: conversation.intencion_principal || 'otro',
        ...extraPatch,
      },
    );

    const routeManagedColombiaAction = async (action) => {
      try {
        const managed = await this.findManagedColombiaAppointment(conversation);
        if (!managed?.appointment) {
          return sendToAdvisor(
            'No se encontró cita de Bookings asociada al teléfono de WhatsApp.',
            'No pude encontrar una visita activa asociada a este número de WhatsApp.\n\nPara evitar errores, te voy a pasar con un asesor de EVINKA Colombia para revisarlo contigo.',
            { accion_ticket_actual: action, codigo_ticket_solicitado: null },
          );
        }
        const citaRows = managed?.localState?.id_cita
          ? await this.sb.select('citas', `id_cita=eq.${encodeURIComponent(managed.localState.id_cita)}&limit=1&select=*`).catch(() => [])
          : await this.sb.select('citas', `id_usuario=eq.${encodeURIComponent(conversation.id_usuario)}&order=confirmada_en.desc.nullslast,creado_en.desc&limit=1&select=*`).catch(() => []);
        const cita = citaRows[0] || null;
        if (action === 'cancel') {
          if (!cita) {
            return sendToAdvisor('La cita de Bookings existe, pero no tiene espejo local confiable en Supabase.', 'Encontré tu reserva, pero necesito que un asesor valide el estado interno antes de cancelarla.\n\nTe paso con EVINKA Colombia para resolverlo ahora mismo.');
          }
          await this.cancelManagedColombiaBooking({ conversation, cita, reason: 'Cancelada por cliente desde WhatsApp.' });
          return this.reply(conversation, 'Entendido 👍\n\nTu cita ha sido cancelada correctamente.\n\nSi más adelante deseas agendar una nueva visita, estaremos encantados de ayudarte.\n\n¡Gracias por confiar en EVINKA! ⚡', { paso_actual: 'ticket_cancelado', subestado_flujo: cita.codigo_cita, estado_conversacion: 'closed', cerrada_en: new Date().toISOString() });
        }
        const zone = cita?.zona_cliente || profile?.zona_cliente || resolveProfileZone(profile, { phone: this.phoneForUserId(conversation.id_usuario), country: 'CO' }) || defaultZoneForCountry('CO');
        const options = await this.buildManagedColombiaSlots(zone, { limit: 15 });
        if (!options.length) {
          return sendToAdvisor('No se encontraron slots válidos para reprogramación Bookings.', 'Por ahora no encontré horarios disponibles para reprogramar tu visita.\n\nTe voy a pasar con un asesor de EVINKA Colombia para ayudarte a moverla manualmente.');
        }
        const ticket = cita?.codigo_cita || conversation.codigo_ticket_solicitado || this.ticketFor(options[0].date, conversation.id_conversacion);
        return this.reply(conversation, combinedSlotsPrompt(zone, options), { paso_actual: 'seleccionando_bloque_horario_reprogramacion', subestado_flujo: ticket, accion_ticket_actual: 'reschedule', codigo_ticket_solicitado: ticket, resumen: buildPagedSlotSummary(options, 0) });
      } catch (error) {
        console.error('routeManagedColombiaAction failed:', error);
        return sendToAdvisor('Falló la consulta de Bookings para gestionar la cita.', 'Tuve un problema al consultar la disponibilidad real de tu visita.\n\nTe paso con un asesor de EVINKA Colombia para continuar sin perder tiempo.');
      }
    };

    const startAdvisorLeadCapture = (reason = 'Soporte humano solicitado', customPrompt = null) => {
      const previousSummary = conversation.resumen || null;
      const draft = {
        kind: 'advisor_lead',
        reason,
        country: selectedCountry || forcedChannelCountry || null,
        nombre: '',
        telefono: '',
        correo: '',
        marca: '',
        comentario: '',
        previousSummary,
      };
      return this.reply(
        conversation,
        customPrompt || advisorLeadPrompt('nombre'),
        {
          paso_actual: 'capturando_datos_handoff',
          subestado_flujo: 'nombre',
          estado_conversacion: 'open',
          requiere_handoff: false,
          motivo_handoff: reason,
          resumen: JSON.stringify(draft),
          intencion_principal: conversation.intencion_principal || 'otro',
        },
      );
    };

    const knownCustomerName = hasKnownCustomerName(user, profile, profileName);
    const allowCorporateDetection = ['menu_principal', 'seleccion_pais', 'retomar_o_reiniciar', 'consentimiento', 'compra_menu'].includes(step);

    if (shouldForceReset) {
      return this.reply(conversation, timeoutResetText(), { paso_actual: 'menu_principal', subestado_flujo: 'reinicio_timeout_24h', estado_conversacion: 'open', resumen: null, intencion_principal: null });
    }

    if (allowCorporateDetection && corporateLead) {
      if (!knownCustomerName && corporateLead.contactName) {
        user = await this.rememberUserName(user, corporateLead.contactName, 'corporate_intro');
      }
      const contactName = corporateLead.contactName || normalizeDisplayName(user?.nombre_visible || profile?.nombre_receptor || profileName || '');
      if (profile?.id_perfil && (contactName || corporateLead.companyName)) {
        try {
          profile = await this.patchProfile(conversation.id_conversacion, {
            ...(contactName ? { nombre_receptor: profile?.nombre_receptor || contactName } : {}),
            ...(corporateLead.companyName ? { nombre_empresa: corporateLead.companyName } : {}),
          }) || profile;
        } catch (error) {
          console.warn('corporate profile patch skipped:', error?.message || error);
        }
      }
      return this.reply(
        conversation,
        corporateHandoffText({ contactName, companyName: corporateLead.companyName, country: selectedCountry }),
        {
          paso_actual: 'handoff_asesor',
          subestado_flujo: selectedCountry === 'CO' ? 'asesor_corporativo_co' : 'asesor_corporativo_pe',
          estado_conversacion: 'handoff',
          requiere_handoff: true,
          motivo_handoff: `Contacto corporativo detectado${corporateLead.companyName ? `: ${corporateLead.companyName}` : ''}`,
          intencion_principal: 'corporativo',
          resumen: JSON.stringify({
            tipo: 'corporativo',
            empresa: corporateLead.companyName || null,
            contacto: contactName || null,
            origen: corporateLead.reason,
          }),
        },
      );
    }

    if (step === 'capturando_nombre_handoff') {
      return startAdvisorLeadCapture(conversation.motivo_handoff || 'Soporte humano solicitado');
    }

    if (step === 'capturando_datos_handoff') {
      if (isMainMenuRequest(text, payloadCrudo)) {
        return this.reply(conversation, MENU, { paso_actual: 'menu_principal', subestado_flujo: 'menu_desde_nombre_handoff', estado_conversacion: 'open', resumen: null, requiere_handoff: false, motivo_handoff: null, intencion_principal: null });
      }
      if (isAdvisorRequest(text)) {
        const draft = advisorLeadSummary(conversation.resumen);
        const field = conversation.subestado_flujo || nextAdvisorLeadField(draft) || 'nombre';
        return this.reply(conversation, advisorLeadPrompt(field), { paso_actual: 'capturando_datos_handoff', subestado_flujo: field, resumen: conversation.resumen || null });
      }
      const draft = advisorLeadSummary(conversation.resumen);
      const field = conversation.subestado_flujo || nextAdvisorLeadField(draft) || 'nombre';
      const value = parseSingleAdvisorLeadField(field, text, payloadCrudo);
      if (!value) {
        return this.reply(conversation, `${invalidAdvisorLeadFieldPrompt(field)}\n\n${advisorLeadPrompt(field)}`, { paso_actual: 'capturando_datos_handoff', subestado_flujo: field, resumen: conversation.resumen || null });
      }
      draft[field] = value;
      draft.reason = draft.reason || conversation.motivo_handoff || 'Soporte humano solicitado';
      draft.country = draft.country || selectedCountry || forcedChannelCountry || null;
      const nextField = nextAdvisorLeadField(draft);
      user = await this.rememberUserName(user, draft.nombre, 'handoff_prompt');
      if (nextField) {
        return this.reply(conversation, advisorLeadPrompt(nextField), {
          paso_actual: 'capturando_datos_handoff',
          subestado_flujo: nextField,
          estado_conversacion: 'open',
          requiere_handoff: false,
          motivo_handoff: draft.reason,
          resumen: JSON.stringify(draft),
          intencion_principal: conversation.intencion_principal || 'otro',
        });
      }
      try {
        profile = await this.patchProfile(conversation.id_conversacion, {
          nombre_receptor: draft.nombre,
          telefono_receptor: draft.telefono,
          correo_receptor: draft.correo,
          marca_vehiculo: draft.marca,
          estado_perfil: profile?.estado_perfil || 'incomplete',
        }) || profile;
      } catch (error) {
        console.warn('handoff profile update skipped:', error?.message || error);
      }
      try {
        await this.sb.update('usuarios', `id_usuario=eq.${conversation.id_usuario}`, {
          nombre_visible: draft.nombre,
          nombre_usuario: draft.nombre,
          correo_electronico: draft.correo,
          telefono_principal: cleanPhone(draft.telefono) || draft.telefono,
        });
      } catch (error) {
        const message = String(error?.message || '');
        if (!message.includes('usuarios_correo_key')) {
          console.warn('handoff user update skipped:', error?.message || error);
        } else {
          await this.sb.update('usuarios', `id_usuario=eq.${conversation.id_usuario}`, {
            nombre_visible: draft.nombre,
            nombre_usuario: draft.nombre,
            telefono_principal: cleanPhone(draft.telefono) || draft.telefono,
          }).catch((innerError) => {
            console.warn('handoff user update fallback skipped:', innerError?.message || innerError);
          });
        }
      }
      return sendToAdvisor(
        draft.reason || 'Soporte humano solicitado por el cliente',
        advisorLeadHandoffText(draft.country || selectedCountry || forcedChannelCountry || null),
        { resumen: JSON.stringify(draft) },
      );
    }

    if (step === 'esperando_timeout_asesor') {
      if (letter === 'A' || isContinueRequest(text, letter, payloadCrudo)) {
        return this.reply(conversation, 'Entendido 👍 Seguiremos buscando un asesor para atenderte por este mismo chat. Te avisaremos apenas uno tome tu caso.', {
          paso_actual: 'handoff_asesor',
          subestado_flujo: 'cliente_esperando',
          estado_conversacion: 'handoff',
          requiere_handoff: true,
        });
      }
      if (letter === 'B' || isMainMenuRequest(text, payloadCrudo) || isRestartRequest(text, letter, payloadCrudo)) {
        return this.reply(conversation, MENU, {
          paso_actual: 'menu_principal',
          subestado_flujo: 'menu_desde_timeout_asesor',
          estado_conversacion: 'open',
          requiere_handoff: false,
          motivo_handoff: null,
          resumen: null,
          intencion_principal: null,
        });
      }
      return this.reply(conversation, advisorTimeoutChoiceText(), {
        paso_actual: 'esperando_timeout_asesor',
        subestado_flujo: 'timeout_asesor_30m',
        estado_conversacion: 'handoff',
        requiere_handoff: true,
      });
    }

    if (isAdvisorRequest(text) && conversation.estado_conversacion !== 'handoff' && step !== 'handoff_asesor') {
      return startAdvisorLeadCapture('Soporte humano solicitado por el cliente');
    }

    if (isNegativeAttentionSignal(text) && conversation.estado_conversacion !== 'handoff' && step !== 'handoff_asesor') {
      return startAdvisorLeadCapture('Cliente reporta molestia o inconformidad en la atención');
    }

    if (conversation.estado_conversacion === 'handoff' || conversation.paso_actual === 'handoff_asesor') {
      if (letter === 'A' || isRestartRequest(text, letter, payloadCrudo) || isMainMenuRequest(text, payloadCrudo)) {
        return this.reply(conversation, MENU, { paso_actual: 'menu_principal', subestado_flujo: 'menu_desde_handoff', estado_conversacion: 'open', requiere_handoff: false, motivo_handoff: null, intencion_principal: null, resumen: null });
      }
      if (isContinueRequest(text, letter, payloadCrudo) || cleanTextValue(text)) {
        return this.reply(conversation, advisorWaitingText(), { paso_actual: 'handoff_asesor', subestado_flujo: 'esperando_asesor', estado_conversacion: 'handoff', resumen: conversation.resumen || null, requiere_handoff: true, motivo_handoff: conversation.motivo_handoff || 'Soporte humano solicitado por el cliente', intencion_principal: conversation.intencion_principal || null });
      }
      return this.reply(conversation, advisorInactiveText(), { paso_actual: 'handoff_asesor', subestado_flujo: 'asesor_inactivo', estado_conversacion: 'handoff', resumen: conversation.resumen || null, requiere_handoff: true, motivo_handoff: conversation.motivo_handoff || 'Soporte humano solicitado por el cliente', intencion_principal: conversation.intencion_principal || null });
    }

    if (shouldResumePrompt && conversation.id_conversacion === latestConversation?.id_conversacion && conversation.paso_actual !== 'retomar_o_reiniciar') {
      const resumePayload = resumePromptPayload(conversation);
      return this.reply(conversation, resumePromptText(), { paso_actual: 'retomar_o_reiniciar', subestado_flujo: 'inactividad_15m', estado_conversacion: 'paused', resumen: resumePayload });
    }

    if (latestConversation && latestConversation.estado_conversacion === 'closed' && ['cita_confirmada', 'cita_reprogramada', 'ticket_cancelado'].includes(latestConversation.paso_actual || '') && letter) {
      if (letter === 'A') return this.reply(conversation, MENU, { paso_actual: 'menu_principal', subestado_flujo: 'post_cierre_menu', estado_conversacion: 'open' });
      if (letter === 'B') {
        if (this.bookingsEnabledForCountry(selectedCountry)) return routeManagedColombiaAction('reschedule');
        return this.reply(conversation, ticketRequestPrompt('reschedule'), { paso_actual: 'gestion_ticket', subestado_flujo: 'esperando_ticket', intencion_principal: 'otro', accion_ticket_actual: 'reschedule' });
      }
    }
    const continueWithCountry = async (menuOption, country) => {
      const forcedZone = defaultZoneForCountry(country);
      if (profile?.id_perfil && forcedZone) {
        profile = await this.patchProfile(conversation.id_conversacion, { zona_cliente: forcedZone }) || profile;
      }
      if (menuOption === 'A' && country === 'CO') return this.reply(conversation, CO_LOCATION_PROMPT, { intencion_principal: 'instalacion_cargador', paso_actual: 'capturando_localidad_co', subestado_flujo: 'localidad_inicial' });
      if (menuOption === 'A') return this.reply(conversation, CONSENT, { intencion_principal: 'instalacion_cargador', paso_actual: 'consentimiento', subestado_flujo: 'instalacion' });
      if (menuOption === 'B' && this.bookingsEnabledForCountry(country)) return routeManagedColombiaAction('reschedule');
      if (menuOption === 'B') return this.reply(conversation, ticketRequestPrompt('reschedule'), { intencion_principal: 'otro', paso_actual: 'gestion_ticket', subestado_flujo: 'esperando_ticket', accion_ticket_actual: 'reschedule' });
      if (menuOption === 'C' && this.bookingsEnabledForCountry(country)) return routeManagedColombiaAction('cancel');
      if (menuOption === 'C') return this.reply(conversation, ticketRequestPrompt('cancel'), { intencion_principal: 'otro', paso_actual: 'gestion_ticket', subestado_flujo: 'esperando_ticket', accion_ticket_actual: 'cancel' });
      if (menuOption === 'D') {
        return this.reply(conversation, SUPPORT_CASE_MENU, {
          intencion_principal: 'asistencia_tecnica',
          paso_actual: 'soporte_tipo',
          subestado_flujo: country || selectedCountry || 'PE',
          resumen: JSON.stringify({ mode: null }),
        });
      }
      if (menuOption === 'E') {
        return startAdvisorLeadCapture('Soporte humano solicitado desde el menú principal');
      }
      return this.reply(conversation, MENU, { paso_actual: 'menu_principal', subestado_flujo: 'reinicio' });
    };

    if (step !== 'menu_principal' && isMainMenuRequest(text, payloadCrudo)) {
      return this.reply(conversation, MENU, { paso_actual: 'menu_principal', subestado_flujo: 'menu_directo', estado_conversacion: 'open', resumen: null, requiere_handoff: false, motivo_handoff: null, intencion_principal: null });
    }

    if (step === 'recordatorio_cita') {
      const reminder = parseReminderSummary(conversation.resumen || '') || {
        ticket: conversation.subestado_flujo || conversation.codigo_ticket_solicitado,
      };
      const ticket = reminder.ticket || conversation.subestado_flujo || conversation.codigo_ticket_solicitado;
      const action = pickReminderAction(text, letter);
      if (!ticket) {
        return this.reply(conversation, MENU, { paso_actual: 'menu_principal', subestado_flujo: 'sin_ticket_recordatorio', estado_conversacion: 'open', resumen: null, intencion_principal: null });
      }
      if (!action) {
        return this.reply(conversation, bookingReminderPrompt({
          ticket,
          dateLabel: reminder.dateLabel || 'Pendiente',
          hourLabel: reminder.hourLabel || 'Pendiente',
          address: reminder.address || 'Pendiente',
        }), { paso_actual: 'recordatorio_cita', subestado_flujo: ticket, resumen: conversation.resumen || null, accion_ticket_actual: 'confirm', codigo_ticket_solicitado: ticket, estado_conversacion: 'open' });
      }
      if (action === 'confirm') {
        await this.sb.update('citas', `codigo_cita=eq.${encodeURIComponent(ticket)}`, {
          confirmada_por_cliente: true,
          confirmada_en: new Date().toISOString(),
        });
        const rows = await this.sb.select('citas', `codigo_cita=eq.${encodeURIComponent(ticket)}&select=zona_cliente,provincia_cita`);
        const reminderCountry = inferCountryFromZone(rows[0]?.zona_cliente || rows[0]?.provincia_cita || '') === 'CO' ? 'CO' : null;
        const reminderText = reminderCountry === 'CO'
          ? `¡Listo! 👌 Tu visita sigue confirmada.\n\nTicket: ${ticket}\nFecha: ${reminder.dateLabel || 'Pendiente'}\nHora: ${reminder.hourLabel || 'Pendiente'}\nDirección: ${reminder.address || 'Pendiente'}\n\nSi luego quieres moverla o cancelarla, escríbenos por aquí.`
          : `Perfecto 👍\n\nTu cita sigue confirmada.\n\nTicket: ${ticket}\nFecha: ${reminder.dateLabel || 'Pendiente'}\nHora: ${reminder.hourLabel || 'Pendiente'}\nDirección: ${reminder.address || 'Pendiente'}\n\nSi luego necesitas moverla o cancelarla, escríbenos por este mismo medio.`;
        return this.reply(conversation, reminderText, { paso_actual: 'cita_confirmada', subestado_flujo: ticket, estado_conversacion: 'closed', accion_ticket_actual: 'confirm', codigo_ticket_solicitado: ticket, cerrada_en: new Date().toISOString() });
      }
      if (action === 'reschedule') {
        const rows = await this.sb.select('citas', `codigo_cita=eq.${encodeURIComponent(ticket)}&select=*`);
        const cita = rows[0];
        if (this.bookingsEnabledForCountry(inferCountryFromZone(cita?.zona_cliente || cita?.provincia_cita || '') || selectedCountry)) {
          return routeManagedColombiaAction('reschedule');
        }
        if (!cita) return this.reply(conversation, 'No pude encontrar la cita a gestionar. Vuelve a ingresar tu ticket.', { paso_actual: 'gestion_ticket', subestado_flujo: 'esperando_ticket', accion_ticket_actual: 'reschedule' });
        const zone = cita.zona_cliente || resolveProfileZone(profile, { phone: this.phoneForUserId(conversation.id_usuario), country: selectedCountry }) || defaultZoneForCountry(selectedCountry);
        const options = await this.availableDateHourOptionsForZone(zone, { includeToday: false, excludeEventId: cita?.microsoft_event_id || null, throughFriday: true });
        if (!options.length) return this.reply(conversation, 'Por ahora no encontré horarios disponibles en el calendario para reprogramar esa cita.\n\nTe llevo al menú principal para seguir con el bot.', { paso_actual: 'menu_principal', subestado_flujo: 'sin_disponibilidad_reprogramacion', estado_conversacion: 'open', requiere_handoff: false, motivo_handoff: null, resumen: null, intencion_principal: null });
        return this.reply(conversation, combinedSlotsPrompt(zone, options), { paso_actual: 'seleccionando_bloque_horario_reprogramacion', subestado_flujo: ticket, accion_ticket_actual: 'reschedule', codigo_ticket_solicitado: ticket, resumen: buildPagedSlotSummary(options, 0) });
      }
      if (action === 'cancel') {
        const rows = await this.sb.select('citas', `codigo_cita=eq.${encodeURIComponent(ticket)}&select=*`);
        const cita = rows[0];
        if (this.bookingsEnabledForCountry(inferCountryFromZone(cita?.zona_cliente || cita?.provincia_cita || '') || selectedCountry)) {
          await this.cancelManagedColombiaBooking({ conversation, cita, reason: 'Cancelada por cliente desde recordatorio de WhatsApp.' });
          return this.reply(conversation, 'Entendido 👍\n\nTu cita ha sido cancelada correctamente.\n\nSi más adelante deseas agendar una nueva visita, estaremos encantados de ayudarte.\n\n¡Gracias por confiar en EVINKA! ⚡', { paso_actual: 'ticket_cancelado', subestado_flujo: ticket, estado_conversacion: 'closed', accion_ticket_actual: 'cancel', codigo_ticket_solicitado: ticket, cerrada_en: new Date().toISOString() });
        }
        if (!cita) return this.reply(conversation, 'No pude encontrar la cita a gestionar. Vuelve a ingresar tu ticket.', { paso_actual: 'gestion_ticket', subestado_flujo: 'esperando_ticket', accion_ticket_actual: 'cancel' });
        if (cita.microsoft_event_id && this.calendar) {
          await this.calendar.cancelEvent(cita.microsoft_event_id, 'Cancelada por cliente desde recordatorio de WhatsApp.');
          this.clearAvailabilityCache();
        }
        await this.sb.update('citas', `codigo_cita=eq.${encodeURIComponent(ticket)}`, { estado_cita: 'cancelada', motivo_cancelacion: 'Cancelada por cliente desde recordatorio de WhatsApp.', cancelada_en: new Date().toISOString() });
        return this.reply(conversation, 'Entendido 👍\n\nTu cita ha sido cancelada correctamente.\n\nSi más adelante deseas agendar una nueva visita, estaremos encantados de ayudarte.\n\n¡Gracias por confiar en EVINKA! ⚡', { paso_actual: 'ticket_cancelado', subestado_flujo: ticket, estado_conversacion: 'closed', accion_ticket_actual: 'cancel', codigo_ticket_solicitado: ticket, cerrada_en: new Date().toISOString() });
      }
    }

    if (step === 'retomar_o_reiniciar') {
      const resume = parseResumePromptPayload(conversation.resumen || '');
      if (isRestartRequest(text, letter, payloadCrudo)) {
        return this.reply(conversation, MENU, { paso_actual: 'menu_principal', subestado_flujo: 'menu_desde_pausa', estado_conversacion: 'open', resumen: null, requiere_handoff: false, motivo_handoff: null, intencion_principal: null });
      }
      if (isContinueRequest(text, letter, payloadCrudo) && resume) {
        return this.reply(conversation, 'Perfecto 👍\n\nContinuamos donde lo dejamos.', { paso_actual: resume.previousStep || 'menu_principal', subestado_flujo: resume.previousSubstate || 'inicio', resumen: resume.previousSummary ?? null, estado_conversacion: 'open' });
      }
      return this.reply(conversation, resumePromptText(), { paso_actual: 'retomar_o_reiniciar', subestado_flujo: 'inactividad_15m', estado_conversacion: 'paused', resumen: conversation.resumen || null });
    }

    if (media) {
      if (step === 'soporte_evidencia_archivo') {
        const summary = parseSupportCaseSummary(conversation.resumen);
        const evidence = supportEvidenceFromPayload(payloadCrudo) || {
          fileName: media.fileName || media.mimeType || 'archivo',
          mimeType: media.mimeType || '',
          mediaUrl: '',
        };
        summary.evidence = evidence;
        return this.reply(conversation, supportCaseSummaryText(summary), {
          paso_actual: 'soporte_confirmacion',
          subestado_flujo: summary.mode || conversation.subestado_flujo,
          resumen: JSON.stringify(summary),
        });
      }
      const canProcessReceiptFile = ['opcion_recibo', 'esperando_archivo_recibo', 'corrigiendo_recibo', 'esperando_datos_recibo_manual', 'confirmando_recibo'].includes(step);
      if (!canProcessReceiptFile) {
        return this.reply(conversation, `Recibí tu archivo 👍\n\nTodavía no estamos en el paso del recibo. Primero necesito que respondas la opción pendiente con A o B.\n\nCuando lleguemos al paso del recibo, podré revisarlo por aquí.\n\nFormatos soportados: ${RECEIPT_FILE_TYPES}.`);
      }
      if (media.error) {
        return this.reply(conversation, `No pude procesar ese archivo por ahora.\n\nPor favor vuelve a enviarlo en ${RECEIPT_FILE_TYPES}, o si prefieres escríbeme los datos del recibo manualmente.`, { paso_actual: 'esperando_archivo_recibo', subestado_flujo: 'archivo_recibo_error' });
      }
      if (!media.ocr?.ok) {
        return this.reply(conversation, `Ese archivo no es compatible todavía para leer el recibo.\n\nPor favor envíamelo en ${RECEIPT_FILE_TYPES}.`, { paso_actual: 'esperando_archivo_recibo', subestado_flujo: 'archivo_no_compatible' });
      }
      const extracted = media.ocr.fields || {};
      const missing = missingReceiptFields(extracted);
      if (missing.length) {
        return this.applyReceiptData(conversation, extracted, media, { partial: true });
      }
      return this.applyReceiptData(conversation, extracted, media);
    }

    if (shouldResetFlowOnGreeting(step, text)) {
      return this.reply(conversation, MENU, { paso_actual: 'menu_principal', subestado_flujo: 'reinicio_por_saludo', estado_conversacion: 'open' });
    }

    if (step === 'menu_principal') {
      if (!letter) return this.reply(conversation, MENU);
      if (specialTestFlow && letter === 'F') {
        return this.reply(
          conversation,
          'Modo pruebas activado ✅\n\nEste número puede seguir probando el flujo como usuario final sin afectar a los demás.\n\nEscribe MENU cuando quieras volver a ver las opciones.',
          { paso_actual: 'menu_principal', subestado_flujo: 'modo_pruebas', estado_conversacion: 'open' },
        );
      }
      if (letter === 'D') {
        return this.reply(conversation, SUPPORT_CASE_MENU, {
          intencion_principal: 'asistencia_tecnica',
          paso_actual: 'soporte_tipo',
          subestado_flujo: selectedCountry || forcedChannelCountry || 'PE',
          resumen: JSON.stringify({ mode: null }),
        });
      }
      if (letter === 'E') {
        return startAdvisorLeadCapture('Soporte humano solicitado desde el menú principal');
      }
      if (['A','B','C'].includes(letter)) {
        if (forcedChannelCountry) {
          return continueWithCountry(letter, forcedChannelCountry);
        }
        return this.reply(conversation, COUNTRY_PROMPT, { paso_actual: 'seleccion_pais', subestado_flujo: letter });
      }
    }

    if (step === 'seleccion_pais') {
      if (!letter) return this.reply(conversation, COUNTRY_PROMPT);
      const menuOption = conversation.subestado_flujo;
      const country = forcedChannelCountry || (letter === 'B' ? 'CO' : letter === 'A' ? 'PE' : null);
      if (!country) return this.reply(conversation, COUNTRY_PROMPT);
      return continueWithCountry(menuOption, country);
    }

    if (step === 'soporte_tipo') {
      if (!letter) return this.reply(conversation, SUPPORT_CASE_MENU, { paso_actual: 'soporte_tipo', subestado_flujo: conversation.subestado_flujo, resumen: conversation.resumen || JSON.stringify({ mode: null }) });
      if (letter === 'C') {
        return startAdvisorLeadCapture('Asistencia técnica: cliente solicita asesor');
      }
      const mode = letter === 'B' ? 'emergency' : letter === 'A' ? 'technical' : null;
      if (!mode) return this.reply(conversation, SUPPORT_CASE_MENU, { paso_actual: 'soporte_tipo', subestado_flujo: conversation.subestado_flujo, resumen: conversation.resumen || JSON.stringify({ mode: null }) });
      return this.reply(conversation, supportNamePrompt(mode), {
        paso_actual: 'soporte_nombre',
        subestado_flujo: mode,
        intencion_principal: 'asistencia_tecnica',
        estado_conversacion: 'open',
        resumen: JSON.stringify({ mode, country: conversation.subestado_flujo || selectedCountry || forcedChannelCountry || 'PE' }),
      });
    }

    if (step === 'soporte_nombre') {
      const summary = parseSupportCaseSummary(conversation.resumen);
      const name = parseSupportName(text);
      if (!name) return this.reply(conversation, `${invalidSupportFieldPrompt('name')}\n\n${supportNamePrompt(summary.mode || 'technical')}`, { paso_actual: 'soporte_nombre', subestado_flujo: summary.mode || conversation.subestado_flujo, resumen: conversation.resumen || null });
      summary.name = name;
      return this.reply(conversation, supportLocationPrompt(summary.mode || 'technical'), {
        paso_actual: 'soporte_ubicacion',
        subestado_flujo: summary.mode || conversation.subestado_flujo,
        resumen: JSON.stringify(summary),
      });
    }

    if (step === 'soporte_ubicacion') {
      const summary = parseSupportCaseSummary(conversation.resumen);
      const location = parseSupportLocation(text);
      if (!location) return this.reply(conversation, `${invalidSupportFieldPrompt('location')}\n\n${supportLocationPrompt(summary.mode || 'technical')}`, { paso_actual: 'soporte_ubicacion', subestado_flujo: summary.mode || conversation.subestado_flujo, resumen: conversation.resumen || null });
      summary.location = location;
      if ((summary.mode || conversation.subestado_flujo) === 'emergency') {
        return this.reply(conversation, supportIssuePrompt('emergency'), {
          paso_actual: 'soporte_descripcion',
          subestado_flujo: 'emergency',
          resumen: JSON.stringify(summary),
        });
      }
      return this.reply(conversation, 'Paso 3 de 5\n\n¿Qué equipo está afectado?', {
        paso_actual: 'soporte_equipo',
        subestado_flujo: 'technical',
        resumen: JSON.stringify(summary),
      });
    }

    if (step === 'soporte_equipo') {
      const summary = parseSupportCaseSummary(conversation.resumen);
      const equipment = letter === 'A'
        ? 'charger'
        : letter === 'B'
          ? 'charge_point'
          : letter === 'C'
            ? 'gas_operator'
            : letter === 'D'
              ? 'other'
              : null;
      if (!equipment) return this.reply(conversation, 'Paso 3 de 5\n\n¿Qué equipo está afectado?', { paso_actual: 'soporte_equipo', subestado_flujo: 'technical', resumen: conversation.resumen || null });
      summary.equipment = equipment;
      return this.reply(conversation, supportIssuePrompt('technical'), {
        paso_actual: 'soporte_descripcion',
        subestado_flujo: 'technical',
        resumen: JSON.stringify(summary),
      });
    }

    if (step === 'soporte_descripcion') {
      const summary = parseSupportCaseSummary(conversation.resumen);
      const issue = parseSupportIssue(text);
      if (!issue) return this.reply(conversation, `${invalidSupportFieldPrompt('issue')}\n\n${supportIssuePrompt(summary.mode || conversation.subestado_flujo || 'technical')}`, { paso_actual: 'soporte_descripcion', subestado_flujo: summary.mode || conversation.subestado_flujo, resumen: conversation.resumen || null });
      summary.issue = issue;
      return this.reply(conversation, supportEvidencePrompt(summary.mode || conversation.subestado_flujo || 'technical'), {
        paso_actual: 'soporte_evidencia_opcion',
        subestado_flujo: summary.mode || conversation.subestado_flujo,
        resumen: JSON.stringify(summary),
      });
    }

    if (step === 'soporte_evidencia_opcion') {
      const summary = parseSupportCaseSummary(conversation.resumen);
      if (letter === 'A') {
        return this.reply(conversation, supportEvidenceWaitPrompt(summary.mode || conversation.subestado_flujo || 'technical'), {
          paso_actual: 'soporte_evidencia_archivo',
          subestado_flujo: summary.mode || conversation.subestado_flujo,
          resumen: JSON.stringify(summary),
        });
      }
      if (letter === 'B') {
        summary.evidence = null;
        return this.reply(conversation, supportCaseSummaryText(summary), {
          paso_actual: 'soporte_confirmacion',
          subestado_flujo: summary.mode || conversation.subestado_flujo,
          resumen: JSON.stringify(summary),
        });
      }
      return this.reply(conversation, supportEvidencePrompt(summary.mode || conversation.subestado_flujo || 'technical'), {
        paso_actual: 'soporte_evidencia_opcion',
        subestado_flujo: summary.mode || conversation.subestado_flujo,
        resumen: conversation.resumen || null,
      });
    }

    if (step === 'soporte_evidencia_archivo') {
      const summary = parseSupportCaseSummary(conversation.resumen);
      if (includesNormalized(['omitir', 'sin evidencia', 'continuar'], text)) {
        summary.evidence = null;
        return this.reply(conversation, supportCaseSummaryText(summary), {
          paso_actual: 'soporte_confirmacion',
          subestado_flujo: summary.mode || conversation.subestado_flujo,
          resumen: JSON.stringify(summary),
        });
      }
      return this.reply(conversation, `${supportEvidenceWaitPrompt(summary.mode || conversation.subestado_flujo || 'technical')}\n\nSi prefieres seguir sin adjunto, escribe *omitir*.`, {
        paso_actual: 'soporte_evidencia_archivo',
        subestado_flujo: summary.mode || conversation.subestado_flujo,
        resumen: conversation.resumen || null,
      });
    }

    if (step === 'soporte_confirmacion') {
      const summary = parseSupportCaseSummary(conversation.resumen);
      if (!letter) return this.reply(conversation, supportCaseSummaryText(summary), { paso_actual: 'soporte_confirmacion', subestado_flujo: summary.mode || conversation.subestado_flujo, resumen: conversation.resumen || null });
      if (letter === 'B') {
        return this.reply(conversation, SUPPORT_CASE_MENU, {
          paso_actual: 'soporte_tipo',
          subestado_flujo: summary.country || selectedCountry || forcedChannelCountry || 'PE',
          intencion_principal: 'asistencia_tecnica',
          estado_conversacion: 'open',
          resumen: JSON.stringify({ mode: null }),
        });
      }
      if (letter === 'C') {
        return startAdvisorLeadCapture(summary.mode === 'emergency' ? 'Emergencia técnica reportada por cliente' : 'Caso de soporte técnico solicitado por cliente');
      }
      if (letter === 'A') {
        const published = await this.publishSupportCase({
          conversation,
          profile,
          caseData: summary,
          countryCode: summary.country || selectedCountry || forcedChannelCountry || 'PE',
          userScope,
        }).catch((error) => {
          console.error('publishSupportCase failed:', error);
          return null;
        });
        const caseCode = published?.caseCode || published?.ticketId || conversation.id_conversacion || 'caso-generado';
        const finalText = summary.mode === 'emergency'
          ? `Caso urgente registrado ✅\n\nCódigo: ${caseCode}\n\nLo estamos marcando como prioridad alta para revisión del equipo EVINKA.`
          : `Listo ✅\n\nTu caso fue registrado correctamente.\n\nCódigo: ${caseCode}\n\nUn miembro del equipo de EVINKA lo revisará.`;
        return this.reply(conversation, finalText, {
          paso_actual: 'caso_soporte_registrado',
          subestado_flujo: String(caseCode),
          estado_conversacion: 'closed',
          cerrada_en: new Date().toISOString(),
          resumen: JSON.stringify({ ...summary, caseCode }),
          intencion_principal: 'asistencia_tecnica',
        });
      }
    }

    if (step === 'capturando_localidad_co') {
      const rawLocation = cleanTextValue(text);
      const selectedOption = CO_ZONE_BOOKING_OPTIONS.find((item) => item.id === rawLocation);
      if (selectedOption?.id === 'CO_ZONE_OTHERS') {
        return this.reply(conversation, CO_OTHER_CITY_PROMPT, { paso_actual: 'localidad_co_no_disponible', subestado_flujo: 'otras_ciudades' });
      }
      const zone = selectedOption?.zone || inferZone(rawLocation, 'CO');
      if (!zone) {
        return this.reply(conversation, CO_OTHER_CITY_PROMPT, { paso_actual: 'localidad_co_no_disponible', subestado_flujo: 'otras_ciudades' });
      }
      const localityLabel = selectedOption?.locality || rawLocation;
      await this.patchProfile(conversation.id_conversacion, {
        zona_cliente: zone,
        distrito_instalacion: localityLabel,
        provincia_instalacion: 'Colombia',
        direccion_instalacion: localityLabel,
        estado_perfil: 'ready_for_schedule',
      });
      const draft = {
        kind: 'booking_residencial_co',
        zone,
        localidad: localityLabel,
        barrio: '',
        direccion: '',
        marca_vehiculo: '',
        nombre: '',
        tipo_documento: '',
        numero_documento: '',
        correo: '',
        telefono: '',
      };
      return this.replySequence(conversation, [BOOKING_DATA_NOTICE_CO, bookingFieldPrompt('barrio')], { paso_actual: 'capturando_datos_booking_residencial', subestado_flujo: 'barrio', resumen: JSON.stringify(draft) });
    }

    if (step === 'localidad_co_no_disponible') {
      if (!letter) return this.reply(conversation, CO_OTHER_CITY_PROMPT);
      if (letter === 'A') return this.reply(conversation, CO_LOCATION_PROMPT, { paso_actual: 'capturando_localidad_co', subestado_flujo: 'localidad_reintento' });
      if (letter === 'B') return this.reply(conversation, MENU, { paso_actual: 'menu_principal', subestado_flujo: 'otras_ciudades_menu', estado_conversacion: 'open', resumen: null, intencion_principal: null });
      return this.reply(conversation, CO_OTHER_CITY_PROMPT);
    }

    if (step === 'compra_menu') {
      if (!letter) return this.reply(conversation, BUY_MENU);
      if (letter === 'A') return this.reply(conversation, CONSENT, { intencion_principal: 'instalacion_cargador', paso_actual: 'consentimiento', subestado_flujo: 'compra_a_instalacion' });
      if (letter === 'B') return this.reply(conversation, MENU, { paso_actual: 'menu_principal', subestado_flujo: 'compra_menu_principal', estado_conversacion: 'open', requiere_handoff: false, motivo_handoff: null, resumen: null, intencion_principal: null });
      return this.reply(conversation, BUY_MENU);
    }

    if (step === 'consentimiento') {
      if (!letter) return this.reply(conversation, CONSENT);
      if (letter === 'A') return this.reply(conversation, RECEIPT_MENU, { dio_consentimiento: true, consentimiento_fecha: new Date().toISOString(), consentimiento_version: 'v1', paso_actual: 'opcion_recibo', subestado_flujo: 'esperando_recibo' });
      if (letter === 'B') return this.reply(conversation, NO_CONSENT, { dio_consentimiento: false, paso_actual: 'sin_autorizacion', subestado_flujo: 'sin_autorizacion' });
      return this.reply(conversation, CONSENT);
    }

    if (step === 'sin_autorizacion') {
      if (!letter) return this.reply(conversation, NO_CONSENT);
      if (letter === 'A') return this.reply(conversation, MENU, { paso_actual: 'menu_principal', subestado_flujo: 'reinicio' });
      if (letter === 'B') return this.reply(conversation, MENU, { paso_actual: 'menu_principal', subestado_flujo: 'sin_autorizacion_menu', estado_conversacion: 'open', requiere_handoff: false, motivo_handoff: null, resumen: null, intencion_principal: null });
      return this.reply(conversation, NO_CONSENT);
    }

    if (step === 'opcion_recibo') {
      if (!letter) return this.reply(conversation, RECEIPT_MENU);
      if (letter === 'A') return this.reply(conversation, `Perfecto 👍\n\nPor favor envíame una foto clara o el PDF de tu recibo de luz para revisarlo.\n\nFormatos soportados: ${RECEIPT_FILE_TYPES}.`, { paso_actual: 'esperando_archivo_recibo', subestado_flujo: 'archivo_recibo' });
      if (letter === 'B') {
        await this.patchProfile(conversation.id_conversacion, { datos_recibo_manuales: null, titular_recibo: null, direccion_recibo: null, distrito_recibo: null, provincia_recibo: null, potencia_kw: null });
        return this.reply(conversation, receiptFieldPrompt('direccion'), { paso_actual: 'esperando_datos_recibo_manual', subestado_flujo: 'dirección del suministro' });
      }
      return this.reply(conversation, RECEIPT_MENU);
    }

    if (step === 'esperando_archivo_recibo') {
      return this.reply(conversation, `Estoy esperando el archivo del recibo 👍\n\nPor favor envíamelo en ${RECEIPT_FILE_TYPES}.`, { paso_actual: 'esperando_archivo_recibo', subestado_flujo: 'archivo_recibo' });
    }

    if (step === 'esperando_datos_recibo_manual' || step === 'corrigiendo_recibo') {
      const existingData = currentReceiptData(profile);
      const field = conversation.subestado_flujo === 'corrigiendo_recibo' ? 'direccion' : receiptFieldKey(conversation.subestado_flujo || 'direccion');
      const value = parseSingleReceiptField(field, text);
      if (!value) return this.reply(conversation, `${invalidReceiptFieldPrompt(field)}\n\n${receiptFieldPrompt(field)}`);
      const merged = mergeReceiptData(existingData, { [field]: value });
      await this.patchProfile(conversation.id_conversacion, {
        titular_recibo: merged.titular,
        direccion_recibo: merged.direccion,
        distrito_recibo: merged.distrito,
        provincia_recibo: merged.provincia,
        potencia_kw: merged.potencia,
        origen_recibo: 'manual',
        lectura_recibo_exitosa: true,
        datos_recibo_manuales: merged,
      });
      if (!merged.direccion) return this.reply(conversation, receiptFieldPrompt('direccion'), { paso_actual: 'esperando_datos_recibo_manual', subestado_flujo: 'dirección del suministro' });
      if (!merged.distrito) return this.reply(conversation, receiptFieldPrompt('distrito'), { paso_actual: 'esperando_datos_recibo_manual', subestado_flujo: 'distrito' });
      if (!merged.provincia) return this.reply(conversation, receiptFieldPrompt('provincia'), { paso_actual: 'esperando_datos_recibo_manual', subestado_flujo: 'provincia' });
      if (!merged.potencia) return this.reply(conversation, receiptFieldPrompt('potencia'), { paso_actual: 'esperando_datos_recibo_manual', subestado_flujo: 'potencia contratada' });
      return this.reply(conversation, receiptSummary(merged), { paso_actual: 'confirmando_recibo', subestado_flujo: 'confirmacion_recibo' });
    }

    if (step === 'confirmando_recibo_parcial') {
      profile = await this.getOrCreateProfile(conversation);
      const current = currentReceiptData(profile);
      if (!letter) return this.reply(conversation, partialReceiptConfirmationPrompt(current));
      if (letter === 'A') {
        const next = missingReceiptFields(current)[0];
        return this.reply(conversation, receiptFieldPrompt(receiptFieldKey(next)), { paso_actual: 'esperando_datos_recibo_manual', subestado_flujo: next });
      }
      if (letter === 'B') {
        await this.patchProfile(conversation.id_conversacion, {
          datos_recibo_manuales: null,
          datos_recibo_extraidos: null,
          titular_recibo: null,
          direccion_recibo: null,
          distrito_recibo: null,
          provincia_recibo: null,
          potencia_kw: null,
          lectura_recibo_exitosa: false,
          recibo_url: null,
          recibo_nombre_archivo: null,
          recibo_tipo_archivo: null,
        });
        return this.reply(conversation, RECEIPT_MENU, { paso_actual: 'opcion_recibo', subestado_flujo: 'esperando_recibo' });
      }
      return this.reply(conversation, partialReceiptConfirmationPrompt(current));
    }

    if (step === 'confirmando_recibo') {
      if (!letter) return this.reply(conversation, 'Por favor responde con A o B.');
      if (letter === 'A') return this.reply(conversation, WHO_RECEIVES, { paso_actual: 'quien_recibe_visita', subestado_flujo: 'receptor_visita' });
      if (letter === 'B') {
        return this.reply(conversation, receiptCorrectionMenu(currentReceiptData(profile)), { paso_actual: 'seleccionando_campo_recibo', subestado_flujo: 'corregir_recibo' });
      }
    }

    if (step === 'seleccionando_campo_recibo') {
      if (!letter) return this.reply(conversation, receiptCorrectionMenu(currentReceiptData(profile)));
      const map = { A: 'direccion', B: 'distrito', C: 'provincia', D: 'potencia' };
      const field = map[letter];
      if (!field) return this.reply(conversation, receiptCorrectionMenu(currentReceiptData(profile)));
      return this.reply(conversation, receiptFieldPrompt(field), { paso_actual: 'esperando_datos_recibo_manual', subestado_flujo: field === 'direccion' ? 'dirección del suministro' : field === 'potencia' ? 'potencia contratada' : field });
    }

    if (step === 'quien_recibe_visita') {
      if (!letter) return this.reply(conversation, WHO_RECEIVES);
      if (letter === 'A') {
        await this.patchProfile(conversation.id_conversacion, { campos_faltantes_recibo: { _pending_persona: {}, _persona_other: false } });
        return this.reply(conversation, personFieldPrompt('nombre', false), { paso_actual: 'capturando_dato_receptor', subestado_flujo: 'nombre' });
      }
      if (letter === 'B') {
        await this.patchProfile(conversation.id_conversacion, { campos_faltantes_recibo: { _pending_persona: {}, _persona_other: true } });
        return this.reply(conversation, personFieldPrompt('nombre', true), { paso_actual: 'capturando_dato_receptor', subestado_flujo: 'nombre' });
      }
      return this.reply(conversation, WHO_RECEIVES);
    }

    if (step === 'capturando_dato_receptor') {
      const field = conversation.subestado_flujo || 'nombre';
      const other = Boolean(profile?.campos_faltantes_recibo?._persona_other);
      const current = { ...(profile?.campos_faltantes_recibo?._pending_persona || {}) };
      const value = parseSinglePersonField(field, text);
      if (!value) return this.reply(conversation, `${invalidPersonFieldPrompt(field)}\n\n${personFieldPrompt(field, other)}`);
      current[field] = value;
      await this.patchProfile(conversation.id_conversacion, {
        campos_faltantes_recibo: {
          ...(profile?.campos_faltantes_recibo || {}),
          _pending_persona: current,
        },
      });
      if (current.nombre && current.doc && current.telefono && current.correo) {
        return this.reply(conversation, personSummary(current), { paso_actual: 'confirmando_datos_receptor', subestado_flujo: other ? 'otro_recibe' : 'titular_recibe' });
      }
      if (!current.nombre) return this.reply(conversation, personFieldPrompt('nombre', other), { paso_actual: 'capturando_dato_receptor', subestado_flujo: 'nombre' });
      if (!current.doc) return this.reply(conversation, personFieldPrompt('doc', other), { paso_actual: 'capturando_dato_receptor', subestado_flujo: 'doc' });
      if (!current.telefono) return this.reply(conversation, personFieldPrompt('telefono', other), { paso_actual: 'capturando_dato_receptor', subestado_flujo: 'telefono' });
      return this.reply(conversation, personFieldPrompt('correo', other), { paso_actual: 'capturando_dato_receptor', subestado_flujo: 'correo' });
    }

    if (step === 'confirmando_datos_receptor') {
      const pending = profile?.campos_faltantes_recibo?._pending_persona;
      const other = Boolean(profile?.campos_faltantes_recibo?._persona_other);
      if (!pending) return this.reply(conversation, personFieldPrompt('nombre', other), { paso_actual: 'capturando_dato_receptor', subestado_flujo: 'nombre' });
      if (!letter) return this.reply(conversation, personSummary(pending));
      if (letter === 'B') {
        return this.reply(conversation, personCorrectionMenu(pending), { paso_actual: 'seleccionando_campo_receptor', subestado_flujo: 'corregir_persona' });
      }
      if (letter === 'A') {
        const doc = cleanDoc(pending.doc);
        const telefono = cleanPhone(pending.telefono);
        await this.patchProfile(conversation.id_conversacion, {
          nombre_receptor: pending.nombre,
          dni_receptor: /^\d{6,20}$/.test(doc) ? doc : null,
          ruc_receptor: doc.length >= 11 ? doc : null,
          telefono_receptor: telefono,
          correo_receptor: pending.correo,
          campos_faltantes_recibo: null,
        });
        try {
          await this.sb.update('usuarios', `id_usuario=eq.${conversation.id_usuario}`, { nombre_visible: pending.nombre, nombre_usuario: pending.nombre, correo_electronico: pending.correo, telefono_principal: telefono });
        } catch (error) {
          const message = String(error?.message || '');
          if (!message.includes('usuarios_correo_key')) throw error;
          await this.sb.update('usuarios', `id_usuario=eq.${conversation.id_usuario}`, { nombre_visible: pending.nombre, nombre_usuario: pending.nombre, telefono_principal: telefono });
        }
        profile = await this.getOrCreateProfile(conversation);
        return this.reply(conversation, addressConfirm(profile.direccion_recibo || profile.direccion_instalacion || '(Sin dirección)'), { paso_actual: 'confirmando_direccion_instalacion', subestado_flujo: 'direccion' });
      }
      return this.reply(conversation, personSummary(pending));
    }

    if (step === 'seleccionando_campo_receptor') {
      const other = Boolean(profile?.campos_faltantes_recibo?._persona_other);
      if (!letter) return this.reply(conversation, personCorrectionMenu(profile?.campos_faltantes_recibo?._pending_persona || {}));
      const map = { A: 'nombre', B: 'doc', C: 'telefono', D: 'correo' };
      const field = map[letter];
      if (!field) return this.reply(conversation, personCorrectionMenu(profile?.campos_faltantes_recibo?._pending_persona || {}));
      return this.reply(conversation, personFieldPrompt(field, other), { paso_actual: 'capturando_dato_receptor', subestado_flujo: field });
    }

    if (step === 'confirmando_direccion_instalacion') {
      if (!letter) return this.reply(conversation, addressConfirm(profile.direccion_recibo || '(Sin dirección)'));
      if (letter === 'A') {
        const zone = resolveProfileZone({
          ...profile,
          direccion_instalacion: profile.direccion_recibo,
          distrito_instalacion: profile.distrito_recibo,
          provincia_instalacion: profile.provincia_recibo,
        }, { phone: this.phoneForUserId(conversation.id_usuario) });
        await this.patchProfile(conversation.id_conversacion, { direccion_instalacion: profile.direccion_recibo, distrito_instalacion: profile.distrito_recibo, provincia_instalacion: profile.provincia_recibo, zona_cliente: zone, direccion_instalacion_coincide_con_recibo: true });
        await this.patchProfile(conversation.id_conversacion, { notas_recibo: '_pending_vehiculo={}' });
        return this.reply(conversation, vehicleFieldPrompt('marca'), { paso_actual: 'capturando_vehiculo', subestado_flujo: 'marca' });
      }
      if (letter === 'B') {
        await this.patchProfile(conversation.id_conversacion, { datos_recibo_manuales: null });
        return this.reply(conversation, WRONG_ADDRESS, { paso_actual: 'opcion_recibo', subestado_flujo: 'reiniciar_recibo' });
      }
    }

    if (step === 'capturando_vehiculo' || step === 'esperando_vehiculo') {
      const field = conversation.subestado_flujo === 'vehiculo' ? 'marca' : (conversation.subestado_flujo || 'marca');
      const pendingRaw = String(profile?.notas_recibo || '_pending_vehiculo={}');
      const current = pendingRaw.startsWith('_pending_vehiculo=') ? JSON.parse(pendingRaw.replace('_pending_vehiculo=', '')) : {};
      const value = parseSingleVehicleField(field, text, payloadCrudo);
      if (!value) return this.reply(conversation, `${invalidVehicleFieldPrompt(field)}\n\n${vehicleFieldPrompt(field)}`);
      current[field] = value;
      await this.patchProfile(conversation.id_conversacion, { notas_recibo: `_pending_vehiculo=${JSON.stringify(current)}` });
      if (!current.marca) return this.reply(conversation, vehicleFieldPrompt('marca'), { paso_actual: 'capturando_vehiculo', subestado_flujo: 'marca' });
      if (!current.modelo) return this.reply(conversation, vehicleFieldPrompt('modelo'), { paso_actual: 'capturando_vehiculo', subestado_flujo: 'modelo' });
      if (!current.tipo) return this.reply(conversation, vehicleFieldPrompt('tipo'), { paso_actual: 'capturando_vehiculo', subestado_flujo: 'tipo' });
      return this.reply(conversation, vehicleSummary(current), { paso_actual: 'confirmando_vehiculo', subestado_flujo: 'vehiculo_confirmacion' });
    }

    if (step === 'confirmando_vehiculo') {
      const pendingRaw = String(profile?.notas_recibo || '');
      const pending = pendingRaw.startsWith('_pending_vehiculo=') ? JSON.parse(pendingRaw.replace('_pending_vehiculo=', '')) : null;
      if (!pending) return this.reply(conversation, vehicleFieldPrompt('marca'), { paso_actual: 'capturando_vehiculo', subestado_flujo: 'marca' });
      if (!letter) return this.reply(conversation, vehicleSummary(pending));
      if (letter === 'B') {
        return this.reply(conversation, vehicleCorrectionMenu(pending), { paso_actual: 'seleccionando_campo_vehiculo', subestado_flujo: 'corregir_vehiculo' });
      }
      if (letter === 'A') {
        await this.patchProfile(conversation.id_conversacion, { marca_vehiculo: pending.marca, modelo_vehiculo: pending.modelo, notas_recibo: `tipo_vehiculo=${pending.tipo}`, estado_perfil: 'ready_for_schedule' });
        return this.reply(conversation, PRE_AGENDA, { paso_actual: 'confirmando_agendamiento', subestado_flujo: 'pre_agenda' });
      }
      return this.reply(conversation, vehicleSummary(pending));
    }

    if (step === 'seleccionando_campo_vehiculo') {
      const pendingRaw = String(profile?.notas_recibo || '_pending_vehiculo={}');
      const pending = pendingRaw.startsWith('_pending_vehiculo=') ? JSON.parse(pendingRaw.replace('_pending_vehiculo=', '')) : {};
      if (!letter) return this.reply(conversation, vehicleCorrectionMenu(pending));
      const map = { A: 'marca', B: 'modelo', C: 'tipo' };
      const field = map[letter];
      if (!field) return this.reply(conversation, vehicleCorrectionMenu(pending));
      return this.reply(conversation, vehicleFieldPrompt(field), { paso_actual: 'capturando_vehiculo', subestado_flujo: field });
    }

    if (step === 'confirmando_agendamiento') {
      if (!letter) return this.reply(conversation, PRE_AGENDA);
      if (letter === 'A') {
        profile = await this.getOrCreateProfile(conversation);
        const zone = resolveProfileZone(profile, { phone: this.phoneForUserId(conversation.id_usuario), country: selectedCountry });
        if (!profile.zona_cliente && zone) {
          await this.patchProfile(conversation.id_conversacion, { zona_cliente: zone });
          profile = { ...profile, zona_cliente: zone };
        }
        if (!zone) {
          const customerName = normalizeDisplayName(user?.nombre_visible || profile?.nombre_receptor || profileName || '');
          return sendToAdvisor(
            'Zona no reconocida automáticamente; requiere validación manual antes de agendar.',
            personalizedZoneHandoffText(selectedCountry, customerName),
          );
        }
        const days = await this.availableDaysForZone(zone);
        if (!days.length) return this.reply(conversation, 'Por ahora no encontré horarios disponibles en el calendario para esa zona.\n\nTe llevo al menú principal para seguir con el bot.', { paso_actual: 'menu_principal', subestado_flujo: 'sin_disponibilidad', estado_conversacion: 'open', requiere_handoff: false, motivo_handoff: null, resumen: null, intencion_principal: null });
        return this.reply(conversation, daysPrompt(zone, days), { paso_actual: 'seleccionando_dia', subestado_flujo: 'agenda_dia', resumen: JSON.stringify(days) });
      }
      if (letter === 'B') return this.reply(conversation, NO_AGENDA, { paso_actual: 'sin_agenda_por_ahora', subestado_flujo: 'sin_agenda' });
    }

    if (step === 'sin_agenda_por_ahora') {
      if (!letter) return this.reply(conversation, NO_AGENDA);
      if (letter === 'A') return this.reply(conversation, MENU, { paso_actual: 'menu_principal', subestado_flujo: 'reinicio' });
      if (letter === 'B') return this.reply(conversation, MENU, { paso_actual: 'menu_principal', subestado_flujo: 'sin_agenda_menu', estado_conversacion: 'open', requiere_handoff: false, motivo_handoff: null, resumen: null, intencion_principal: null });
    }

    if (step === 'seleccionando_dia') {
      const zone = resolveProfileZone(profile, { phone: this.phoneForUserId(conversation.id_usuario), country: selectedCountry }) || defaultZoneForCountry(selectedCountry);
      const days = (() => { try { return JSON.parse(conversation.resumen || '[]'); } catch { return nextDays(addDays(currentDateInLima(), 1), zone); } })();
      const chosen = days.find(x => x.code === letter);
      if (!chosen) return this.reply(conversation, daysPrompt(zone, days));
      const hours = await this.availableHoursForDate(chosen.date, { clientZone: zone });
      if (!hours.length) return this.reply(conversation, 'Ese día ya no tiene horarios disponibles. Elige otro día, por favor.', { paso_actual: 'seleccionando_dia', subestado_flujo: 'agenda_dia', resumen: JSON.stringify(days) });
      return this.reply(conversation, hoursPrompt(hours), { paso_actual: 'seleccionando_hora', subestado_flujo: chosen.date, resumen: JSON.stringify({ day: chosen, hours }) });
    }

    if (step === 'seleccionando_bloque_horario') {
      const summary = (() => { try { return JSON.parse(conversation.resumen || '[]'); } catch { return []; } })();
      const options = Array.isArray(summary) ? summary : (summary.options || []);
      const zone = summary.zone || resolveProfileZone(profile, { phone: this.phoneForUserId(conversation.id_usuario), country: selectedCountry }) || defaultZoneForCountry(selectedCountry);
      const chosen = options.find(x => x.code === letter);
      if (!chosen) {
        if (selectedCountry === 'CO' && summary?.kind === 'booking_co' && Number(summary.invalidAttempts || 0) >= 1) {
          return sendToAdvisor('Dos selecciones de horario no entendidas en el flujo de Bookings.', 'No logré entender tu elección de horario dos veces seguidas.\n\nPara no hacerte perder tiempo, te paso con un asesor de EVINKA Colombia para continuar contigo.');
        }
        const nextSummary = Array.isArray(summary) ? summary : { ...summary, invalidAttempts: Number(summary.invalidAttempts || 0) + 1 };
        return this.reply(conversation, combinedSlotsPrompt(zone, options), { paso_actual: 'seleccionando_bloque_horario', subestado_flujo: 'agenda_directa', resumen: JSON.stringify(nextSummary) });
      }
      profile = await this.getOrCreateProfile(conversation);
      if (selectedCountry === 'CO' && summary?.kind === 'booking_co') {
        try {
          const created = await this.createManagedColombiaBooking({ conversation, profile, draft: summary.draft, chosen: { ...chosen, serviceId: chosen.serviceId || summary.serviceId || null } });
          const finalAddress = `${bookingAddressLine(summary.draft)} ${summary.draft.localidad || ''} Colombia`.trim();
          try {
            await this.scheduleBookingReminder({ userId: conversation.id_usuario, ticket: created.appointment.codigo_cita, dateLabel: chosen.dateLabel, hourLabel: chosen.hourLabel, address: finalAddress });
          } catch (error) {
            console.error('scheduleBookingReminder failed:', error);
          }
          try {
            await this.publishTechVisit({ conversation, profile: { ...profile, marca_vehiculo: summary.draft.marca_vehiculo, nombre_receptor: summary.draft.nombre, correo_receptor: summary.draft.correo, telefono_receptor: summary.draft.telefono, direccion_instalacion: bookingAddressLine(summary.draft), distrito_instalacion: summary.draft.localidad || zone, provincia_instalacion: 'Colombia', zona_cliente: zone }, appointment: created.appointment, dateLabel: chosen.dateLabel, hourLabel: chosen.hourLabel });
          } catch (error) {
            console.error('publishTechVisit failed:', error);
          }
          await this.patchProfile(conversation.id_conversacion, { estado_perfil: 'scheduled' });
          return this.reply(conversation, finalConfirmation({ ticket: created.appointment.codigo_cita, dateLabel: chosen.dateLabel, hourLabel: chosen.hourLabel, address: finalAddress, country: 'CO' }), { paso_actual: 'cita_confirmada', subestado_flujo: 'agenda_confirmada', estado_conversacion: 'closed', accion_ticket_actual: 'confirm', codigo_ticket_solicitado: created.appointment.codigo_cita, cerrada_en: new Date().toISOString() });
        } catch (error) {
          console.error('createManagedColombiaBooking failed:', error);
          if (error?.reason === 'slot_unavailable') {
            const attempts = Number(summary.slotLossAttempts || 0) + 1;
            if (attempts >= 2) {
              return sendToAdvisor('Dos pérdidas consecutivas de slot en Bookings.', 'El horario elegido ya no estaba disponible y esto pasó más de una vez.\n\nTe paso con un asesor de EVINKA Colombia para terminar el agendamiento contigo.');
            }
            const refreshed = await this.buildManagedColombiaSlots(zone, { limit: 15 });
            if (!refreshed.length) {
              return sendToAdvisor('El slot se perdió y no quedaron opciones de reemplazo en Bookings.', 'El horario elegido ya no estaba disponible y ahora no veo más opciones válidas para ofrecerte.\n\nTe paso con un asesor de EVINKA Colombia para continuar.');
            }
            return this.reply(conversation, `Ese horario se acaba de ocupar.\n\nTe muestro nuevas opciones disponibles para que elijas otra:`, { paso_actual: 'seleccionando_bloque_horario', subestado_flujo: 'agenda_directa', resumen: JSON.stringify({ ...summary, options: refreshed, slotLossAttempts: attempts, invalidAttempts: 0 }) });
          }
          return sendToAdvisor('Falló la creación de la cita en Bookings.', 'Tuve un problema al confirmar la visita con la agenda real.\n\nTe paso con un asesor de EVINKA Colombia para cerrar el proceso sin demoras.');
        }
      }
      const draft = {
        kind: 'booking_residencial_co',
        zone,
        date: chosen.date,
        dateLabel: chosen.dateLabel,
        hourLabel: chosen.hourLabel,
        time: chosen.time,
        endTime: chosen.endTime,
        nombre: profile.nombre_receptor || '',
        telefono: profile.telefono_receptor || '',
        correo: profile.correo_receptor || '',
        direccion: profile.direccion_instalacion && profile.direccion_instalacion !== profile.distrito_instalacion ? profile.direccion_instalacion : '',
        localidad: profile.distrito_instalacion || '',
      };
      const nextField = !draft.nombre ? 'nombre' : !draft.telefono ? 'telefono' : !draft.correo ? 'correo' : 'direccion';
      if (draft.nombre && draft.telefono && draft.correo && draft.direccion) {
        return this.reply(conversation, bookingSummary(draft), { paso_actual: 'confirmando_datos_booking_residencial', subestado_flujo: 'booking_co', resumen: JSON.stringify(draft) });
      }
      return this.reply(conversation, bookingFieldPrompt(nextField, { includeNotice: true }), { paso_actual: 'capturando_datos_booking_residencial', subestado_flujo: nextField, resumen: JSON.stringify(draft) });
    }

    if (step === 'seleccionando_hora') {
      const date = conversation.subestado_flujo;
      const summary = (() => { try { return JSON.parse(conversation.resumen || '{}'); } catch { return {}; } })();
      const zone = resolveProfileZone(profile, { phone: this.phoneForUserId(conversation.id_usuario), country: selectedCountry }) || defaultZoneForCountry(selectedCountry);
      const day = summary.day || nextDays(addDays(currentDateInLima(), 1), zone).find(x => x.date === date);
      const availableHours = summary.hours || await this.availableHoursForDate(date, { clientZone: zone });
      const chosen = availableHours.find(x => x.code === letter);
      if (!chosen || !day) return this.reply(conversation, hoursPrompt(availableHours));
      profile = await this.getOrCreateProfile(conversation);
      if (selectedCountry === 'CO') {
        const zone = resolveProfileZone(profile, { phone: this.phoneForUserId(conversation.id_usuario), country: selectedCountry }) || defaultZoneForCountry(selectedCountry);
        const currentDocument = profile.ruc_receptor || profile.dni_receptor || '';
        const draft = {
          kind: 'booking_residencial_co',
          zone,
          date,
          dateLabel: day.label,
          hourLabel: chosen.label,
          time: chosen.time,
          endTime: chosen.endTime,
          barrio: '',
          marca_vehiculo: profile.marca_vehiculo || '',
          tipo_documento: profile.ruc_receptor ? 'NIT' : (profile.dni_receptor ? 'Cédula de ciudadanía' : ''),
          numero_documento: currentDocument,
          nombre: profile.nombre_receptor || '',
          telefono: profile.telefono_receptor || '',
          correo: profile.correo_receptor || '',
          direccion: profile.direccion_instalacion && profile.direccion_instalacion !== profile.distrito_instalacion ? profile.direccion_instalacion : '',
          localidad: profile.distrito_instalacion || '',
        };
        const nextField = nextBookingField(draft);
        if (!nextField) {
          return this.reply(conversation, bookingSummary(draft), { paso_actual: 'confirmando_datos_booking_residencial', subestado_flujo: 'booking_co', resumen: JSON.stringify(draft) });
        }
        return this.reply(conversation, bookingFieldPrompt(nextField), { paso_actual: 'capturando_datos_booking_residencial', subestado_flujo: nextField, resumen: JSON.stringify(draft) });
      }
      const appointment = await this.createOrUpdateAppointment(conversation, profile, {
        codigo_cita: this.ticketFor(date, conversation.id_conversacion),
        fecha_cita: date,
        hora_inicio: chosen.time,
        hora_fin: chosen.endTime,
        fecha_hora_inicio: `${date}T${chosen.time}-05:00`,
        fecha_hora_fin: `${date}T${chosen.endTime}-05:00`,
        nombre_cliente: profile.nombre_receptor,
        telefono_cliente: profile.telefono_receptor,
        dni_cliente: profile.dni_receptor || profile.ruc_receptor,
        correo_cliente: profile.correo_receptor,
        direccion_cita: profile.direccion_instalacion,
        distrito_cita: profile.distrito_instalacion,
        provincia_cita: profile.provincia_instalacion,
        zona_cliente: resolveProfileZone(profile, { phone: this.phoneForUserId(conversation.id_usuario), country: selectedCountry }),
        zona_dia: resolveProfileZone(profile, { phone: this.phoneForUserId(conversation.id_usuario), country: selectedCountry }),
        control_zona: resolveProfileZone(profile, { phone: this.phoneForUserId(conversation.id_usuario), country: selectedCountry }),
        etiqueta_horario: compactScheduleLabel(chosen.time, chosen.endTime),
        marca_vehiculo: profile.marca_vehiculo,
        modelo_vehiculo: profile.modelo_vehiculo,
        potencia_kw: profile.potencia_kw,
        fase_electrica: profile.fase_electrica || 'no_definido',
        validacion_recibo: true,
        estado_cita: 'confirmada',
        aprobacion: 'aprobada',
        confirmada_por_cliente: true,
        confirmada_en: new Date().toISOString(),
      });
      let microsoftEventId = null;
      try {
        microsoftEventId = await this.ensureCalendarEvent({ appointment, profile, dateLabel: day.label, hourLabel: chosen.label, ticket: appointment.codigo_cita });
        if (microsoftEventId) {
          appointment.microsoft_event_id = microsoftEventId;
          await this.sb.update('citas', `id_cita=eq.${appointment.id_cita}`, { microsoft_event_id: microsoftEventId, observaciones: calendarSyncNote(this.calendar?.provider) });
        }
      } catch (error) {
        console.error('ensureCalendarEvent failed:', error);
      }
      const finalAddress = `${profile.direccion_instalacion} ${profile.distrito_instalacion} ${profile.provincia_instalacion}`.trim();
      try {
        await this.scheduleBookingReminder({
          userId: conversation.id_usuario,
          ticket: appointment.codigo_cita,
          dateLabel: day.label,
          hourLabel: chosen.label,
          address: finalAddress,
        });
      } catch (error) {
        console.error('scheduleBookingReminder failed:', error);
      }
      try {
        await this.publishTechVisit({
          conversation,
          profile,
          appointment,
          dateLabel: day.label,
          hourLabel: chosen.label,
        });
      } catch (error) {
        console.error('publishTechVisit failed:', error);
      }
      await this.patchProfile(conversation.id_conversacion, { estado_perfil: 'scheduled' });
      return this.reply(conversation, finalConfirmation({ ticket: appointment.codigo_cita, dateLabel: day.label, hourLabel: chosen.label, address: finalAddress }), { paso_actual: 'cita_confirmada', subestado_flujo: 'agenda_confirmada', estado_conversacion: 'closed', accion_ticket_actual: 'confirm', codigo_ticket_solicitado: appointment.codigo_cita, cerrada_en: new Date().toISOString() });
    }

    if (step === 'capturando_datos_booking_residencial') {
      const draft = (() => { try { return JSON.parse(conversation.resumen || '{}'); } catch { return {}; } })();
      const field = conversation.subestado_flujo || nextBookingField(draft) || 'barrio';
      if (field === 'marca_vehiculo' && (letter === 'MORE' || includesNormalized(['more', 'más opciones', 'mas opciones', 'ver mas marcas', 'ver más marcas'], text))) {
        return this.reply(conversation, bookingFieldPrompt('marca_vehiculo_more'), { paso_actual: 'capturando_datos_booking_residencial', subestado_flujo: 'marca_vehiculo_more', resumen: conversation.resumen || null });
      }
      if (field === 'marca_vehiculo_more' && (letter === 'BACK' || includesNormalized(['back', 'volver', 'regresar'], text))) {
        return this.reply(conversation, bookingFieldPrompt('marca_vehiculo'), { paso_actual: 'capturando_datos_booking_residencial', subestado_flujo: 'marca_vehiculo', resumen: conversation.resumen || null });
      }
      const value = parseSingleBookingField(field, text, letter);
      if (!value) {
        const invalidAttempts = Number(draft.invalidAttempts || 0) + 1;
        if (invalidAttempts >= 2) {
          return sendToAdvisor('Dos inputs no entendidos durante captura de datos de Bookings.', 'No logré entender tus datos dos veces seguidas.\n\nPara avanzar más rápido, te paso con un asesor de EVINKA Colombia para continuar contigo.');
        }
        return this.reply(conversation, `${invalidBookingFieldPrompt(field)}\n\n${bookingFieldPrompt(field)}`, { paso_actual: 'capturando_datos_booking_residencial', subestado_flujo: field, resumen: JSON.stringify({ ...draft, invalidAttempts }) });
      }
      draft.invalidAttempts = 0;
      draft.marca_vehiculo = (field === 'marca_vehiculo' || field === 'marca_vehiculo_more') ? value : draft.marca_vehiculo;
      if (field !== 'marca_vehiculo' && field !== 'marca_vehiculo_more') draft[field] = value;
      const pendingField = nextBookingField(draft);
      if (pendingField) return this.reply(conversation, bookingFieldPrompt(pendingField), { paso_actual: 'capturando_datos_booking_residencial', subestado_flujo: pendingField, resumen: JSON.stringify(draft) });
      return this.reply(conversation, bookingSummary(draft), { paso_actual: 'confirmando_datos_booking_residencial', subestado_flujo: 'booking_co', resumen: JSON.stringify(draft) });
    }

    if (step === 'confirmando_datos_booking_residencial') {
      const draft = (() => { try { return JSON.parse(conversation.resumen || '{}'); } catch { return {}; } })();
      if (!letter) return this.reply(conversation, bookingSummary(draft), { paso_actual: 'confirmando_datos_booking_residencial', subestado_flujo: 'booking_co', resumen: conversation.resumen || null });
      if (letter === 'B') return this.reply(conversation, bookingCorrectionMenu(draft), { paso_actual: 'seleccionando_campo_booking_residencial', subestado_flujo: 'booking_co', resumen: JSON.stringify(draft) });
      if (letter === 'A') {
        const documentValue = cleanTextValue(draft.numero_documento || '');
        const addressLine = bookingAddressLine(draft);
        await this.patchProfile(conversation.id_conversacion, {
          marca_vehiculo: draft.marca_vehiculo,
          nombre_receptor: draft.nombre,
          dni_receptor: draft.tipo_documento === 'NIT' ? null : documentValue,
          ruc_receptor: draft.tipo_documento === 'NIT' ? documentValue : null,
          telefono_receptor: draft.telefono,
          correo_receptor: draft.correo,
          direccion_instalacion: addressLine,
          distrito_instalacion: draft.localidad || draft.zone,
          provincia_instalacion: 'Colombia',
          zona_cliente: draft.zone,
          estado_perfil: 'ready_for_schedule',
        });
        try {
          await this.sb.update('usuarios', `id_usuario=eq.${conversation.id_usuario}`, { nombre_visible: draft.nombre, nombre_usuario: draft.nombre, correo_electronico: draft.correo, telefono_principal: draft.telefono });
        } catch (error) {
          const message = String(error?.message || '');
          if (!message.includes('usuarios_correo_key')) throw error;
          await this.sb.update('usuarios', `id_usuario=eq.${conversation.id_usuario}`, { nombre_visible: draft.nombre, nombre_usuario: draft.nombre, telefono_principal: draft.telefono });
        }
        if (this.bookingsEnabledForCountry('CO') && draft.date && draft.time && draft.endTime) {
          try {
            const refreshed = await this.buildManagedColombiaSlots(draft.zone, { limit: 20 });
            const chosen = refreshed.find((item) => item.date === draft.date && item.time === draft.time && item.endTime === draft.endTime);
            if (!chosen) {
              if (!refreshed.length) {
                return sendToAdvisor('El slot elegido ya no está disponible y no hay reemplazo en Bookings.', 'El horario que habías elegido ya no está disponible y ahora no veo opciones válidas para ofrecerte.\n\nTe paso con un asesor de EVINKA Colombia para continuar sin perder el caso.');
              }
              return this.reply(conversation, 'El horario que habías elegido ya no está disponible.\n\nTe muestro opciones nuevas para que elijas otra:', { paso_actual: 'seleccionando_bloque_horario', subestado_flujo: 'agenda_directa', resumen: JSON.stringify({ kind: 'booking_co', draft, invalidAttempts: 0, slotLossAttempts: 1, options: refreshed }) });
            }
            profile = await this.getOrCreateProfile(conversation);
            const created = await this.createManagedColombiaBooking({ conversation, profile, draft, chosen });
            const finalAddress = `${bookingAddressLine(draft)} ${draft.localidad || ''} Colombia`.trim();
            try {
              await this.scheduleBookingReminder({ userId: conversation.id_usuario, ticket: created.appointment.codigo_cita, dateLabel: chosen.dateLabel, hourLabel: chosen.hourLabel, address: finalAddress });
            } catch (error) {
              console.error('scheduleBookingReminder failed:', error);
            }
            try {
              await this.publishTechVisit({ conversation, profile: { ...profile, marca_vehiculo: draft.marca_vehiculo, nombre_receptor: draft.nombre, correo_receptor: draft.correo, telefono_receptor: draft.telefono, direccion_instalacion: bookingAddressLine(draft), distrito_instalacion: draft.localidad || draft.zone, provincia_instalacion: 'Colombia', zona_cliente: draft.zone }, appointment: created.appointment, dateLabel: chosen.dateLabel, hourLabel: chosen.hourLabel });
            } catch (error) {
              console.error('publishTechVisit failed:', error);
            }
            await this.patchProfile(conversation.id_conversacion, { estado_perfil: 'scheduled' });
            return this.reply(conversation, finalConfirmation({ ticket: created.appointment.codigo_cita, dateLabel: chosen.dateLabel, hourLabel: chosen.hourLabel, address: finalAddress, country: 'CO' }), { paso_actual: 'cita_confirmada', subestado_flujo: 'agenda_confirmada', estado_conversacion: 'closed', accion_ticket_actual: 'confirm', codigo_ticket_solicitado: created.appointment.codigo_cita, cerrada_en: new Date().toISOString() });
          } catch (error) {
            console.error('createManagedColombiaBooking from selected slot failed:', error);
            if (error?.reason === 'slot_unavailable') {
              const refreshed = await this.buildManagedColombiaSlots(draft.zone, { limit: 20 });
              if (!refreshed.length) {
                return sendToAdvisor('Slot perdido sin reemplazo al confirmar datos en Bookings.', 'El horario elegido se perdió al momento de confirmar y ahora no veo opciones válidas.\n\nTe paso con un asesor de EVINKA Colombia para continuar.');
              }
              return this.reply(conversation, 'El horario elegido se ocupó justo antes de confirmar.\n\nTe muestro opciones nuevas para que elijas otra:', { paso_actual: 'seleccionando_bloque_horario', subestado_flujo: 'agenda_directa', resumen: JSON.stringify({ kind: 'booking_co', draft, invalidAttempts: 0, slotLossAttempts: 1, options: refreshed }) });
            }
            return sendToAdvisor('Falló la creación de la cita Bookings tras confirmar datos.', 'Tuve un problema al confirmar la visita con la agenda real.\n\nTe paso con un asesor de EVINKA Colombia para cerrar el proceso sin demoras.');
          }
        }
        const options = await this.availableDateHourOptionsForZone(draft.zone);
        if (!options.length) return this.reply(conversation, 'Por ahora no encontré horarios disponibles para esa zona.\n\nTe llevo al menú principal para seguir con el bot.', { paso_actual: 'menu_principal', subestado_flujo: 'sin_disponibilidad', estado_conversacion: 'open', requiere_handoff: false, motivo_handoff: null, resumen: null, intencion_principal: null });
        return this.reply(conversation, combinedSlotsPrompt(draft.zone, options), { paso_actual: 'seleccionando_bloque_horario', subestado_flujo: 'agenda_directa', resumen: JSON.stringify({ kind: 'booking_co', draft, invalidAttempts: 0, options }) });
      }
    }

    if (step === 'seleccionando_campo_booking_residencial') {
      const draft = (() => { try { return JSON.parse(conversation.resumen || '{}'); } catch { return {}; } })();
      if (!letter) return this.reply(conversation, bookingCorrectionMenu(draft), { paso_actual: 'seleccionando_campo_booking_residencial', subestado_flujo: 'booking_co', resumen: conversation.resumen || null });
      const map = { A: 'barrio', B: 'direccion', C: 'marca_vehiculo', D: 'nombre', E: 'tipo_documento', F: 'numero_documento', G: 'correo', H: 'telefono' };
      const field = map[letter];
      if (!field) return this.reply(conversation, bookingCorrectionMenu(draft), { paso_actual: 'seleccionando_campo_booking_residencial', subestado_flujo: 'booking_co', resumen: conversation.resumen || null });
      return this.reply(conversation, bookingFieldPrompt(field), { paso_actual: 'capturando_datos_booking_residencial', subestado_flujo: field, resumen: JSON.stringify(draft) });
    }

    if (step === 'gestion_ticket') {
      const ticket = extractTicketCode(text) || text.trim().toUpperCase();
      const rows = await this.sb.select('citas', `codigo_cita=eq.${encodeURIComponent(ticket)}&select=*`);
      if (!rows.length) return this.reply(conversation, 'No pude encontrar una cita con ese ticket.\n\nPor favor envíame solo tu documento para ayudarte a buscar tus citas registradas.', { paso_actual: 'busqueda_por_identidad', subestado_flujo: 'ticket_no_encontrado' });
      const cita = rows[0];
      return this.reply(conversation, `Encontré esta cita registrada:\n\nTicket: ${cita.codigo_cita}\nFecha: ${cita.fecha_cita}\nHora: ${cita.etiqueta_horario || cita.hora_inicio}\nDirección: ${cita.direccion_cita}\n\n¿Confirmas que esta es la cita que deseas gestionar?`, { paso_actual: 'confirmando_ticket', subestado_flujo: cita.codigo_cita });
    }

    if (step === 'busqueda_por_identidad') {
      const existing = (() => {
        try {
          const parsed = JSON.parse(conversation.resumen || '{}');
          return Array.isArray(parsed._draft_identidad) ? parsed._draft_identidad : [];
        } catch {
          return [];
        }
      })();
      const lines = mergeDraftLines(existing, text);
      const identity = parseIdentityInput(lines);
      if (!identity) {
        const compactDraft = lines.slice(-2).join(' | ').slice(0, 90);
        return this.reply(conversation, 'No pude encontrar una cita con ese ticket.\n\nPor favor envíame solo tu documento para ayudarte a buscar tus citas registradas.', { resumen: compactDraft || null });
      }
      const doc = cleanDoc(identity.doc);
      const citas = await this.sb.select('citas', `dni_cliente=eq.${encodeURIComponent(doc)}&select=*`);
      if (!citas.length) {
        return this.reply(conversation, 'No pude encontrar citas registradas con esos datos.\n\nSi deseas, puedes intentar nuevamente o volver al menú principal.', { paso_actual: 'sin_citas_encontradas', subestado_flujo: 'sin_resultados', resumen: null });
      }
      if (citas.length === 1) {
        const c = citas[0];
        return this.reply(conversation, `Encontré esta cita registrada a tu nombre:\n\n${c.codigo_cita} — ${c.fecha_cita} — ${c.etiqueta_horario || c.hora_inicio} — ${c.direccion_cita}\n\nElige esta cita para continuar.`, { paso_actual: 'seleccionando_cita_identidad', subestado_flujo: 'opciones_cita_identidad', resumen: encodeTicketOptions([{ code: 'A', ticket: c.codigo_cita }]) });
      }
      const options = citas.slice(0, 5).map((c, i) => ({ code: String.fromCharCode(65 + i), ticket: c.codigo_cita, label: `${String.fromCharCode(65 + i)}. ${c.codigo_cita} — ${c.fecha_cita} — ${c.etiqueta_horario || c.hora_inicio} — ${c.direccion_cita}` }));
      return this.reply(conversation, `Encontré estas citas registradas a tu nombre:\n\n${options.map(x => x.label).join('\n')}\n\nElige la cita que deseas gestionar.`, { paso_actual: 'seleccionando_cita_identidad', subestado_flujo: 'opciones_cita_identidad', resumen: encodeTicketOptions(options) });
    }

    if (step === 'sin_citas_encontradas') {
      if (!letter) return this.reply(conversation, 'Elige una de las opciones para continuar.');
      if (letter === 'A') return this.reply(conversation, ticketRequestPrompt(conversation.accion_ticket_actual || 'gestionar'), { paso_actual: 'gestion_ticket', subestado_flujo: 'esperando_ticket', accion_ticket_actual: conversation.accion_ticket_actual || null });
      if (letter === 'B') return this.reply(conversation, MENU, { paso_actual: 'menu_principal', subestado_flujo: 'sin_citas_menu', estado_conversacion: 'open', resumen: null, requiere_handoff: false, motivo_handoff: null, intencion_principal: null });
    }

    if (step === 'seleccionando_cita_identidad') {
      const options = decodeTicketOptions(conversation.resumen || '');
      const chosen = options.find(x => x.code === letter);
      if (!chosen) return this.reply(conversation, 'Elige una cita de la lista para continuar.');
      const rows = await this.sb.select('citas', `codigo_cita=eq.${encodeURIComponent(chosen.ticket)}&select=*`);
      if (!rows.length) return this.reply(conversation, 'No pude encontrar esa cita. Vuelve a intentarlo con tu ticket.', { paso_actual: 'gestion_ticket', subestado_flujo: 'esperando_ticket' });
      const cita = rows[0];
      return this.reply(conversation, `Encontré esta cita registrada:\n\nTicket: ${cita.codigo_cita}\nFecha: ${cita.fecha_cita}\nHora: ${cita.etiqueta_horario || cita.hora_inicio}\nDirección: ${cita.direccion_cita}\n\n¿Confirmas que esta es la cita que deseas gestionar?`, { paso_actual: 'confirmando_ticket', subestado_flujo: cita.codigo_cita });
    }

    if (step === 'confirmando_ticket') {
      if (!letter) return this.reply(conversation, 'Elige una de las opciones para continuar.');
      if (letter === 'A') {
        if (conversation.accion_ticket_actual === 'reschedule') {
          const ticket = conversation.subestado_flujo;
          const rows = await this.sb.select('citas', `codigo_cita=eq.${encodeURIComponent(ticket)}&select=*`);
          const cita = rows[0];
          if (this.bookingsEnabledForCountry(inferCountryFromZone(cita?.zona_cliente || cita?.provincia_cita || '') || selectedCountry)) return routeManagedColombiaAction('reschedule');
          if (!cita) return this.reply(conversation, 'No pude encontrar la cita a gestionar. Vuelve a ingresar tu ticket.', { paso_actual: 'gestion_ticket', subestado_flujo: 'esperando_ticket' });
          const zone = cita.zona_cliente || resolveProfileZone(profile, { phone: this.phoneForUserId(conversation.id_usuario), country: selectedCountry }) || defaultZoneForCountry(selectedCountry);
          const options = await this.availableDateHourOptionsForZone(zone, { includeToday: false, excludeEventId: cita?.microsoft_event_id || null, throughFriday: true });
          if (!options.length) return this.reply(conversation, 'Por ahora no encontré horarios disponibles en el calendario para reprogramar esa cita.\n\nTe llevo al menú principal para seguir con el bot.', { paso_actual: 'menu_principal', subestado_flujo: 'sin_disponibilidad_reprogramacion', estado_conversacion: 'open', requiere_handoff: false, motivo_handoff: null, resumen: null, intencion_principal: null });
          return this.reply(conversation, combinedSlotsPrompt(zone, options), { paso_actual: 'seleccionando_bloque_horario_reprogramacion', subestado_flujo: ticket, accion_ticket_actual: 'reschedule', codigo_ticket_solicitado: ticket, resumen: buildPagedSlotSummary(options, 0) });
        }
        if (conversation.accion_ticket_actual === 'cancel') {
          const ticket = conversation.subestado_flujo;
          const rows = await this.sb.select('citas', `codigo_cita=eq.${encodeURIComponent(ticket)}&select=*`);
          const cita = rows[0];
          if (this.bookingsEnabledForCountry(inferCountryFromZone(cita?.zona_cliente || cita?.provincia_cita || '') || selectedCountry)) {
            if (!cita) return routeManagedColombiaAction('cancel');
            await this.cancelManagedColombiaBooking({ conversation, cita, reason: 'Cancelada por cliente desde WhatsApp.' });
            return this.reply(conversation, 'Entendido 👍\n\nTu cita ha sido cancelada correctamente.\n\nLamentamos que no puedas continuar por ahora. Cuando lo desees, estaremos encantados de ayudarte a agendar una nueva visita.\n\n¡Gracias por confiar en EVINKA! ⚡', { paso_actual: 'ticket_cancelado', subestado_flujo: ticket, estado_conversacion: 'closed', cerrada_en: new Date().toISOString() });
          }
          if (!cita) return this.reply(conversation, 'No pude encontrar la cita a gestionar. Vuelve a ingresar tu ticket.', { paso_actual: 'gestion_ticket', subestado_flujo: 'esperando_ticket' });
          if (cita.microsoft_event_id && this.calendar) {
            await this.calendar.cancelEvent(cita.microsoft_event_id, 'Cancelada por cliente desde WhatsApp.');
            this.clearAvailabilityCache();
          }
          await this.sb.update('citas', `codigo_cita=eq.${encodeURIComponent(ticket)}`, { estado_cita: 'cancelada', motivo_cancelacion: 'Cancelada por cliente desde WhatsApp.', cancelada_en: new Date().toISOString() });
          return this.reply(conversation, 'Entendido 👍\n\nTu cita ha sido cancelada correctamente.\n\nLamentamos que no puedas continuar por ahora. Cuando lo desees, estaremos encantados de ayudarte a agendar una nueva visita.\n\n¡Gracias por confiar en EVINKA! ⚡', { paso_actual: 'ticket_cancelado', subestado_flujo: ticket, estado_conversacion: 'closed', cerrada_en: new Date().toISOString() });
        }
        return this.reply(conversation, ticketActionPrompt(), { paso_actual: 'accion_ticket', subestado_flujo: conversation.subestado_flujo });
      }
      if (letter === 'B') return this.reply(conversation, 'Entendido 👍\n\nEntonces vuelve a enviarme tu ticket de reserva para revisar otra cita.', { paso_actual: 'gestion_ticket', subestado_flujo: 'esperando_ticket', accion_ticket_actual: conversation.accion_ticket_actual || null });
    }

    if (step === 'accion_ticket') {
      if (!letter) return this.reply(conversation, ticketActionPrompt());
      const ticket = conversation.subestado_flujo;
      const rows = await this.sb.select('citas', `codigo_cita=eq.${encodeURIComponent(ticket)}&select=*`);
      const cita = rows[0];
      if (!cita) return this.reply(conversation, 'No pude encontrar la cita a gestionar. Vuelve a ingresar tu ticket.', { paso_actual: 'gestion_ticket', subestado_flujo: 'esperando_ticket' });
      if (letter === 'A') {
        if (this.bookingsEnabledForCountry(inferCountryFromZone(cita?.zona_cliente || cita?.provincia_cita || '') || selectedCountry)) return routeManagedColombiaAction('reschedule');
        const zone = cita.zona_cliente || resolveProfileZone(profile, { phone: this.phoneForUserId(conversation.id_usuario), country: selectedCountry }) || defaultZoneForCountry(selectedCountry);
        const options = await this.availableDateHourOptionsForZone(zone, { includeToday: false, excludeEventId: cita?.microsoft_event_id || null, throughFriday: true });
        if (!options.length) return this.reply(conversation, 'Por ahora no encontré horarios disponibles en el calendario para reprogramar esa cita.\n\nTe llevo al menú principal para seguir con el bot.', { paso_actual: 'menu_principal', subestado_flujo: 'sin_disponibilidad_reprogramacion', estado_conversacion: 'open', requiere_handoff: false, motivo_handoff: null, resumen: null, intencion_principal: null });
        return this.reply(conversation, combinedSlotsPrompt(zone, options), { paso_actual: 'seleccionando_bloque_horario_reprogramacion', subestado_flujo: ticket, accion_ticket_actual: 'reschedule', codigo_ticket_solicitado: ticket, resumen: buildPagedSlotSummary(options, 0) });
      }
      if (letter === 'B') {
        if (this.bookingsEnabledForCountry(inferCountryFromZone(cita?.zona_cliente || cita?.provincia_cita || '') || selectedCountry)) {
          await this.cancelManagedColombiaBooking({ conversation, cita, reason: 'Cancelada por cliente desde WhatsApp.' });
          return this.reply(conversation, 'Entendido 👍\n\nTu cita ha sido cancelada correctamente.\n\nLamentamos que no puedas continuar por ahora. Cuando lo desees, estaremos encantados de ayudarte a agendar una nueva visita.\n\n¡Gracias por confiar en EVINKA! ⚡', { paso_actual: 'ticket_cancelado', subestado_flujo: ticket, estado_conversacion: 'closed', cerrada_en: new Date().toISOString() });
        }
        if (cita.microsoft_event_id && this.calendar) {
          await this.calendar.cancelEvent(cita.microsoft_event_id, 'Cancelada por cliente desde WhatsApp.');
          this.clearAvailabilityCache();
        }
        await this.sb.update('citas', `codigo_cita=eq.${encodeURIComponent(ticket)}`, { estado_cita: 'cancelada', motivo_cancelacion: 'Cancelada por cliente desde WhatsApp.', cancelada_en: new Date().toISOString() });
        return this.reply(conversation, 'Entendido 👍\n\nTu cita ha sido cancelada correctamente.\n\nLamentamos que no puedas continuar por ahora. Cuando lo desees, estaremos encantados de ayudarte a agendar una nueva visita.\n\n¡Gracias por confiar en EVINKA! ⚡', { paso_actual: 'ticket_cancelado', subestado_flujo: ticket, estado_conversacion: 'closed', cerrada_en: new Date().toISOString() });
      }
    }

    if (step === 'seleccionando_dia_reprogramacion') {
      const rows = await this.sb.select('citas', `codigo_cita=eq.${encodeURIComponent(conversation.subestado_flujo)}&select=*`);
      const old = rows[0];
      const zone = old?.zona_cliente || profile.zona_cliente || resolveProfileZone(profile, { phone: this.phoneForUserId(conversation.id_usuario), country: selectedCountry }) || defaultZoneForCountry(selectedCountry);
      const options = await this.availableDateHourOptionsForZone(zone, { includeToday: false, excludeEventId: old?.microsoft_event_id || null });
      if (!options.length) return this.reply(conversation, 'Por ahora no encontré horarios disponibles en el calendario para reprogramar esa cita.\n\nTe llevo al menú principal para seguir con el bot.', { paso_actual: 'menu_principal', subestado_flujo: 'sin_disponibilidad_reprogramacion', estado_conversacion: 'open', requiere_handoff: false, motivo_handoff: null, resumen: null, intencion_principal: null });
      return this.reply(conversation, combinedSlotsPrompt(zone, options), { paso_actual: 'seleccionando_bloque_horario_reprogramacion', subestado_flujo: conversation.subestado_flujo, accion_ticket_actual: 'reschedule', codigo_ticket_solicitado: conversation.subestado_flujo, resumen: buildPagedSlotSummary(options, 0) });
    }

    if (step === 'seleccionando_bloque_horario_reprogramacion') {
      const rows = await this.sb.select('citas', `codigo_cita=eq.${encodeURIComponent(conversation.subestado_flujo)}&select=*`);
      const old = rows[0];
      const zone = old?.zona_cliente || profile.zona_cliente || resolveProfileZone(profile, { phone: this.phoneForUserId(conversation.id_usuario), country: selectedCountry }) || defaultZoneForCountry(selectedCountry);
      const summary = parsePagedSlotSummary(conversation.resumen || '[]');
      const options = summary.items;
      if (letter === 'NEXT') {
        return this.reply(conversation, combinedSlotsPrompt(zone, options), { paso_actual: 'seleccionando_bloque_horario_reprogramacion', subestado_flujo: conversation.subestado_flujo, accion_ticket_actual: 'reschedule', codigo_ticket_solicitado: conversation.subestado_flujo, resumen: buildPagedSlotSummary(options, summary.page + 1) });
      }
      if (letter === 'PREV') {
        return this.reply(conversation, combinedSlotsPrompt(zone, options), { paso_actual: 'seleccionando_bloque_horario_reprogramacion', subestado_flujo: conversation.subestado_flujo, accion_ticket_actual: 'reschedule', codigo_ticket_solicitado: conversation.subestado_flujo, resumen: buildPagedSlotSummary(options, Math.max(0, summary.page - 1)) });
      }
      const chosen = options.find(x => x.code === letter);
      if (!chosen) {
        if (this.bookingsEnabledForCountry(inferCountryFromZone(old?.zona_cliente || old?.provincia_cita || '') || selectedCountry) && Number(summary.invalidAttempts || 0) >= 1) {
          return sendToAdvisor('Dos selecciones no entendidas al reprogramar Bookings.', 'No logré entender tu elección de horario dos veces seguidas.\n\nTe paso con un asesor de EVINKA Colombia para continuar.');
        }
        const nextSummary = this.bookingsEnabledForCountry(inferCountryFromZone(old?.zona_cliente || old?.provincia_cita || '') || selectedCountry)
          ? buildPagedSlotSummary(options, summary.page || 0, { invalidAttempts: Number(summary.invalidAttempts || 0) + 1 })
          : (conversation.resumen || null);
        return this.reply(conversation, combinedSlotsPrompt(zone, options), { paso_actual: 'seleccionando_bloque_horario_reprogramacion', subestado_flujo: conversation.subestado_flujo, accion_ticket_actual: 'reschedule', codigo_ticket_solicitado: conversation.subestado_flujo, resumen: nextSummary });
      }
      if (!old) return this.reply(conversation, 'No pude encontrar la cita original. Vuelve a intentarlo con tu ticket.', { paso_actual: 'gestion_ticket', subestado_flujo: 'esperando_ticket' });
      if (this.bookingsEnabledForCountry(inferCountryFromZone(old?.zona_cliente || old?.provincia_cita || '') || selectedCountry)) {
        try {
          await this.rescheduleManagedColombiaBooking({ conversation, cita: old, chosen });
        } catch (error) {
          console.error('rescheduleManagedColombiaBooking failed:', error);
          if (error?.reason === 'slot_unavailable') {
            const refreshed = await this.buildManagedColombiaSlots(zone, { limit: 15 });
            const attempts = Number(summary.slotLossAttempts || 0) + 1;
            if (attempts >= 2 || !refreshed.length) {
              return sendToAdvisor('Dos pérdidas consecutivas de slot al reprogramar Bookings.', 'El horario elegido ya no estaba disponible más de una vez.\n\nTe paso con un asesor de EVINKA Colombia para terminar la reprogramación contigo.');
            }
            return this.reply(conversation, combinedSlotsPrompt(zone, refreshed), { paso_actual: 'seleccionando_bloque_horario_reprogramacion', subestado_flujo: conversation.subestado_flujo, accion_ticket_actual: 'reschedule', codigo_ticket_solicitado: conversation.subestado_flujo, resumen: buildPagedSlotSummary(refreshed, 0, { slotLossAttempts: attempts, invalidAttempts: 0 }) });
          }
          return sendToAdvisor('Falló la reprogramación de Bookings.', 'Tuve un problema al mover la cita con la agenda real.\n\nTe paso con un asesor de EVINKA Colombia para resolverlo por aquí.');
        }
      } else {
        await this.sb.update('citas', `id_cita=eq.${old.id_cita}`, {
          fecha_cita: chosen.date,
          hora_inicio: chosen.time,
          hora_fin: chosen.endTime,
          fecha_hora_inicio: `${chosen.date}T${chosen.time}-05:00`,
          fecha_hora_fin: `${chosen.date}T${chosen.endTime}-05:00`,
          etiqueta_horario: compactScheduleLabel(chosen.time, chosen.endTime),
          estado_cita: 'reprogramada',
          motivo_reprogramacion: 'Reprogramada por cliente desde WhatsApp.',
          confirmada_por_cliente: true,
          confirmada_en: new Date().toISOString(),
        });
        if (old.microsoft_event_id && this.calendar) {
          await this.calendar.updateEvent(old.microsoft_event_id, {
            start: { dateTime: `${chosen.date}T${chosen.time}`, timeZone: 'America/Lima' },
            end: { dateTime: `${chosen.date}T${chosen.endTime}`, timeZone: 'America/Lima' },
          });
          this.clearAvailabilityCache();
        }
      }
      try {
        await this.publishTechVisit({
          conversation,
          profile,
          appointment: {
            ...old,
            codigo_cita: old.codigo_cita,
            fecha_hora_inicio: `${chosen.date}T${chosen.time}-05:00`,
            nombre_cliente: profile.nombre_receptor || old.nombre_cliente,
            telefono_cliente: profile.telefono_receptor || old.telefono_cliente,
            correo_cliente: profile.correo_receptor || old.correo_cliente,
            direccion_cita: old.direccion_cita,
          },
          dateLabel: chosen.dateLabel,
          hourLabel: chosen.hourLabel,
        });
      } catch (error) {
        console.error('publishTechVisit failed after reschedule:', error);
      }
      return this.reply(conversation, finalConfirmation({ ticket: old.codigo_cita, dateLabel: chosen.dateLabel, hourLabel: chosen.hourLabel, address: `${old.direccion_cita} ${old.distrito_cita} ${old.provincia_cita}`, country: inferCountryFromZone(old.zona_cliente || old.provincia_cita || '') === 'CO' ? 'CO' : null, kind: 'rescheduled' }), { paso_actual: 'cita_reprogramada', subestado_flujo: old.codigo_cita, estado_conversacion: 'closed', cerrada_en: new Date().toISOString() });
    }

    if (step === 'seleccionando_hora_reprogramacion') {
      const data = JSON.parse(conversation.subestado_flujo || '{}');
      const hours = (() => { try { return JSON.parse(conversation.resumen || '[]'); } catch { return hoursForDate(data.date); } })();
      const chosen = hours.find(x => x.code === letter);
      if (!chosen) return this.reply(conversation, hoursPrompt(hours));
      const rows = await this.sb.select('citas', `codigo_cita=eq.${encodeURIComponent(data.ticket)}&select=*`);
      if (!rows.length) return this.reply(conversation, 'No pude encontrar la cita original. Vuelve a intentarlo con tu ticket.', { paso_actual: 'gestion_ticket', subestado_flujo: 'esperando_ticket' });
      const old = rows[0];
      const endTime = chosen.endTime;
      await this.sb.update('citas', `id_cita=eq.${old.id_cita}`, {
        fecha_cita: data.date,
        hora_inicio: chosen.time,
        hora_fin: endTime,
        fecha_hora_inicio: `${data.date}T${chosen.time}-05:00`,
        fecha_hora_fin: `${data.date}T${endTime}-05:00`,
        etiqueta_horario: compactScheduleLabel(chosen.time, endTime),
        estado_cita: 'reprogramada',
        motivo_reprogramacion: 'Reprogramada por cliente desde WhatsApp.',
        confirmada_por_cliente: true,
        confirmada_en: new Date().toISOString(),
      });
      if (old.microsoft_event_id && this.calendar) {
        await this.calendar.updateEvent(old.microsoft_event_id, {
          start: { dateTime: `${data.date}T${chosen.time}`, timeZone: 'America/Lima' },
          end: { dateTime: `${data.date}T${endTime}`, timeZone: 'America/Lima' },
        });
        this.clearAvailabilityCache();
      }
      try {
        await this.publishTechVisit({
          conversation,
          profile,
          appointment: {
            ...old,
            codigo_cita: old.codigo_cita,
            fecha_hora_inicio: `${data.date}T${chosen.time}-05:00`,
            nombre_cliente: profile.nombre_receptor || old.nombre_cliente,
            telefono_cliente: profile.telefono_receptor || old.telefono_cliente,
            correo_cliente: profile.correo_receptor || old.correo_cliente,
            direccion_cita: old.direccion_cita,
          },
          dateLabel: data.dateLabel,
          hourLabel: chosen.label,
        });
      } catch (error) {
        console.error('publishTechVisit failed after reschedule:', error);
      }
      return this.reply(conversation, finalConfirmation({ ticket: old.codigo_cita, dateLabel: data.dateLabel, hourLabel: chosen.label, address: `${old.direccion_cita} ${old.distrito_cita} ${old.provincia_cita}`, country: inferCountryFromZone(old.zona_cliente || old.provincia_cita || '') === 'CO' ? 'CO' : null, kind: 'rescheduled' }), { paso_actual: 'cita_reprogramada', subestado_flujo: old.codigo_cita, estado_conversacion: 'closed', cerrada_en: new Date().toISOString() });
    }

    return this.reply(conversation, MENU, { paso_actual: 'menu_principal', subestado_flujo: 'fallback' });
  }
}
