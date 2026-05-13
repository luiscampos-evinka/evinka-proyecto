import { MicrosoftGraphClient } from './microsoftGraph.mjs';

const MENU = `¡Hola! 👋
Bienvenido a EVINKA.

Te puedo ayudar con una de estas opciones:

A. Instalar un cargador
B. Reprogramar visita
C. Cancelar visita
D. Soporte humano
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
  { id: 'CO_ZONE_1', title: 'Suba-Usaquén', zone: 'ÁREA 1 — SUBA–USAQUÉN', locality: 'Suba / Usaquén', description: 'Para visitas en Suba o Usaquén' },
  { id: 'CO_ZONE_2', title: 'Chapinero-Barrios Unidos-Teusaquillo', zone: 'ÁREA 2 — CHAPINERO–BARRIOS UNIDOS–TEUSAQUILLO', locality: 'Chapinero / Barrios Unidos / Teusaquillo', description: 'Para visitas en este grupo de localidades' },
  { id: 'CO_ZONE_3', title: 'Engativá-Fontibón', zone: 'ÁREA 3 — ENGATIVÁ–FONTIBÓN', locality: 'Engativá / Fontibón', description: 'Para visitas en Engativá o Fontibón' },
  { id: 'CO_ZONE_4', title: 'Kennedy-Puente Aranda-Bosa', zone: 'ÁREA 4 — KENNEDY–PUENTE ARANDA–BOSA', locality: 'Kennedy / Puente Aranda / Bosa / Soacha / Sibaté', description: 'Incluye Kennedy, Puente Aranda, Bosa, Soacha y Sibaté' },
  { id: 'CO_ZONE_5', title: 'La Candelaria-Santa Fe-Los Mártires-Antonio Nariño-Rafael Uribe Uribe', zone: 'ÁREA 5 — LA CANDELARIA–SANTA FE–LOS MÁRTIRES–ANTONIO NARIÑO–RAFAEL URIBE URIBE', locality: 'La Candelaria / Santa Fe / Los Mártires / Antonio Nariño / Rafael Uribe Uribe', description: 'Para visitas en este grupo de localidades' },
  { id: 'CO_ZONE_6', title: 'Mosquera-Funza-Tenjo-Cota', zone: 'ÁREA 6 — MOSQUERA–FUNZA–TENJO–COTA', locality: 'Mosquera / Funza / Tenjo / Cota', description: 'Para visitas en Mosquera, Funza, Tenjo o Cota' },
  { id: 'CO_ZONE_7', title: 'Chía-Cajicá-Sopó', zone: 'ÁREA 7 — CHÍA–CAJICÁ–SOPÓ', locality: 'Chía / Cajicá / Sopó', description: 'Para visitas en Chía, Cajicá o Sopó' },
  { id: 'CO_ZONE_8', title: 'La Calera-Usme-San Cristóbal-Tunjuelito-Ciudad Bolívar', zone: 'ÁREA 8 — LA CALERA–USME–SAN CRISTÓBAL–TUNJUELITO–CIUDAD BOLÍVAR', locality: 'La Calera / Usme / San Cristóbal / Tunjuelito / Ciudad Bolívar', description: 'Para visitas en este grupo de localidades' },
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

const SLOT_TEMPLATES = {
  lunes: makeSlots(['10:00-11:00', '11:30-12:15', '14:00-14:45', '15:30-16:15']),
  martes: makeSlots(['10:00-11:00', '11:30-12:15']),
  miercoles: makeSlots(['10:00-11:00', '11:30-12:15', '14:00-14:45', '15:30-16:15']),
  jueves: makeSlots(['10:00-11:00', '11:30-12:15']),
  viernes: makeSlots(['10:00-11:00', '11:30-12:15', '14:00-14:45', '15:30-16:15']),
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

const STEP_INTERACTIVE_CODE_MAP = {
  menu_principal: { menu_install: 'A', menu_reschedule: 'B', menu_cancel: 'C', menu_human: 'D' },
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
  confirmando_datos_booking_residencial: { booking_confirm: 'A', booking_edit: 'B' },
  seleccionando_campo_booking_residencial: { booking_field_name: 'A', booking_field_phone: 'B', booking_field_email: 'C', booking_field_address: 'D' },
  confirmando_agendamiento: { schedule_yes: 'A', schedule_not_now: 'B' },
  sin_agenda_por_ahora: { menu_main: 'A', continue_later: 'B' },
  confirmando_ticket: { ticket_confirm: 'A', ticket_other: 'B' },
  accion_ticket: { ticket_reschedule: 'A', ticket_cancel: 'B' },
  sin_citas_encontradas: { retry_lookup: 'A', menu_main: 'B' },
  retomar_o_reiniciar: { resume_bot: 'A', menu_main: 'B' },
  handoff_asesor: { resume_bot: 'A', menu_main: 'B' },
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
    const mapped = STEP_INTERACTIVE_CODE_MAP[step]?.[interactiveId];
    if (mapped) return mapped;
    const prefix = DYNAMIC_STEP_ID_PREFIX[step] || '';
    if (prefix && interactiveId.startsWith(prefix)) {
      const code = interactiveId.slice(prefix.length).trim().toUpperCase();
      return code || null;
    }
    return null;
  }
  const v = normalize(text);
  return ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].includes(v) ? v.toUpperCase() : null;
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
  if (country === 'PE') return 'LIMA CENTRO';
  return 'SIN ZONA';
}

function countryFromIntent(value = '') {
  const match = String(value || '').match(/\|(PE|CO)$/);
  return match?.[1] || null;
}

function inferCountryFromZone(zone = '') {
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

function resolveProfileZone(profile = {}, options = {}) {
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

  return profile?.zona_cliente
    || inferZone(combinedLocation, countryHint)
    || inferZone(profile?.distrito_instalacion, countryHint)
    || inferZone(profile?.distrito_recibo, countryHint)
    || inferZone(profile?.direccion_instalacion, countryHint)
    || inferZone(profile?.direccion_recibo, countryHint)
    || null;
}

function nextDays(startDate = addDays(currentDateInLima(), 1)) {
  const out = [];
  let current = startDate;
  while (out.length < 10) {
    const weekday = weekdayForDate(current);
    if (SLOT_TEMPLATES[weekday]) {
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

function rescheduleDays() {
  return nextDays(currentDateInLima());
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

function eventZoneFromText(text = '') {
  const match = String(text || '').match(/zona\s*:\s*([^\n\r]+)/i);
  return match ? cleanTextValue(match[1]).toUpperCase() : null;
}

function overlaps(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
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
  if (field === 'direccion') return `${intro}\n\n${highlightedFieldRequest('Dirección del suministro')}`;
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
  return `Perfecto 👍\n\nIndícame qué dato deseas corregir del recibo:\n\nA. Dirección del suministro (${data.direccion || '(No identificada)'})\nB. Distrito (${data.distrito || '(No identificado)'})\nC. Provincia (${data.provincia || '(No identificada)'})\nD. Potencia contratada (${data.potencia ?? '(No identificada)'})\n\nPor favor responde con la letra de la opción que deseas.`;
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

const BOOKING_DATA_NOTICE_CO = '🔒 Tus datos se usan solo para gestionar tu visita, según la política de tratamiento de datos de EVINKA en Colombia.';

function bookingFieldPrompt(field, { includeNotice = false } = {}) {
  const intro = 'Ya casi 👌\n\nTengo el horario. Solo me faltan tus datos para cerrar la reserva.';
  const notice = includeNotice ? `\n\n${BOOKING_DATA_NOTICE_CO}` : '';
  if (field === 'nombre' && includeNotice) {
    return `Al continuar con este proceso, aceptas el tratamiento de tus datos personales conforme a la Política de Tratamiento de Datos de EVINKA, en cumplimiento de la normativa vigente en Colombia, incluyendo la Ley 1581 de 2012 y demás disposiciones aplicables.\n\nTu información será utilizada únicamente para gestionar tu solicitud y brindarte una mejor atención 😊\n\nAhora, escribe nombre y apellidos 👌`;
  }
  if (field === 'nombre') return `${intro}${notice}\n\n${highlightedFieldRequest('Nombre y apellidos')}`;
  if (field === 'telefono') return `${intro}${notice}\n\n${highlightedFieldRequest('Número de teléfono')}`;
  if (field === 'correo') return `${intro}${notice}\n\n${highlightedFieldRequest('Correo electrónico')}`;
  return `${intro}${notice}\n\n${highlightedFieldRequest('Dirección exacta')}`;
}

function parseSingleBookingField(field, text) {
  if (field === 'nombre') {
    const nombre = normalizeNameCandidate(text);
    return nombre && nombre.split(/\s+/).length >= 2 ? nombre : null;
  }
  if (field === 'telefono') {
    const telefono = normalizeContactPhone(text);
    return isValidContactPhone(telefono) ? telefono : null;
  }
  if (field === 'correo') {
    return String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase() || null;
  }
  const direccion = cleanTextValue(text);
  return direccion && direccion.length >= 6 ? direccion : null;
}

function invalidBookingFieldPrompt(field) {
  if (field === 'nombre') return 'Ups, no alcancé a leer bien tu nombre completo. Envíamelo otra vez.';
  if (field === 'telefono') return 'Ups, no pude leer bien tu número. Envíamelo otra vez.';
  if (field === 'correo') return 'Ups, no pude leer bien tu correo. Envíamelo otra vez.';
  return 'Ups, no pude leer bien la dirección. Envíamela otra vez.';
}

function bookingSummary(data = {}) {
  return `Así quedaría tu reserva 👌\n\n- Zona: ${data.zone || '-'}\n- Fecha: ${data.dateLabel || '-'}\n- Hora: ${data.hourLabel || '-'}\n- Nombre: ${data.nombre || '-'}\n- Teléfono: ${data.telefono || '-'}\n- Correo: ${data.correo || '-'}\n- Dirección: ${data.direccion || '-'}\n\n¿Todo bien?`;
}

function bookingCorrectionMenu(data = {}) {
  return `Claro ✨\n\n¿Qué quieres corregir?\n\nA. Nombre (${data.nombre || '-'})\nB. Teléfono (${data.telefono || '-'})\nC. Correo (${data.correo || '-'})\nD. Dirección (${data.direccion || '-'})\n\nElige una opción.`;
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

function isContinueRequest(text = '', letter = null, payloadCrudo = null) {
  return letter === 'A' || inputMatches(text, payloadCrudo, ['continuar', 'retomar', 'seguir', 'seguir esperando', 'resume_bot', 'retomar con bot']);
}

function isRestartRequest(text = '', letter = null, payloadCrudo = null) {
  return letter === 'B' || inputMatches(text, payloadCrudo, ['reiniciar', 'empezar otra vez', 'empezar de nuevo', 'menu', 'menú', 'menu principal', 'menú principal', 'menu_main']);
}

function isMainMenuRequest(text = '', payloadCrudo = null) {
  return inputMatches(text, payloadCrudo, ['menu', 'menú', 'menu principal', 'menú principal', 'menu_main', 'buy_menu', 'post_menu']);
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

function advisorInactiveText() {
  return `Por el momento no tenemos un asesor activo en este canal.\n\n¿Qué deseas hacer ahora?\n\nA. Retomar con el bot\nB. Ir al menú principal`;
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

function interactiveReplyForStep(step, text, { resumen, subestado } = {}) {
  switch (step) {
    case 'menu_principal':
      return makeStepList(step, text, [
        { id: 'A', title: 'Instalar cargador', description: 'Evaluar instalación y visita técnica' },
        { id: 'B', title: 'Reprogramar visita', description: 'Cambiar fecha u hora de una visita' },
        { id: 'C', title: 'Cancelar visita', description: 'Cancelar una cita existente' },
        { id: 'D', title: 'Soporte humano', description: 'Hablar con un asesor EVINKA' },
      ], { title: 'Elige una opción', buttonText: 'Abrir menú' });
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
      })), { title: 'Seleccionar un servicio', buttonText: 'Elegir zona' });
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
    case 'confirmando_datos_booking_residencial':
      return makeStepButtons(step, text, [
        { id: 'A', title: 'Sí, reservar' },
        { id: 'B', title: 'Corregir' },
      ]);
    case 'seleccionando_campo_booking_residencial':
      return makeStepButtons(step, text, [
        { id: 'A', title: 'Nombre' },
        { id: 'B', title: 'Teléfono' },
        { id: 'C', title: 'Correo' },
        { id: 'D', title: 'Dirección' },
      ]);
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
      const options = Array.isArray(parseReplySummary(resumen)) ? parseReplySummary(resumen) : [];
      if (!options.length) return null;
      return makeStepList(step, text, options.map((item) => ({
        id: item.code,
        title: clipLabel(item.dateLabel, 24),
        description: clipLabel(item.hourLabel, 48),
      })), { title: 'Horarios disponibles', buttonText: 'Elegir horario' });
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
        { id: 'A', title: 'Retomar con bot' },
        { id: 'B', title: 'Menú principal' },
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
    return `¡Listo! 🎉 Tu visita quedó confirmada.\n\nTicket: ${ticket}\nFecha: ${dateLabel}\nHora: ${hourLabel}\nDirección: ${address}\n\nGracias por elegir EVINKA.`;
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
    `Zona: ${profile.zona_cliente || appointment.zona_cliente || ''}`,
    `Vehículo: ${`${profile.marca_vehiculo || appointment.marca_vehiculo || ''} ${profile.modelo_vehiculo || appointment.modelo_vehiculo || ''}`.trim()}`,
  ].filter(Boolean).join('\n');
}

export class ChatbotEngine {
  constructor({ sb, calendar = null, reminderScheduler = null, visitPublisher = null }) {
    this.sb = sb;
    this.calendar = calendar;
    this.reminderScheduler = reminderScheduler;
    this.visitPublisher = visitPublisher;
  }

  async availableDaysForZone(zone, { includeToday = false } = {}) {
    const days = includeToday ? rescheduleDays() : nextDays();
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

  async availableDateHourOptionsForZone(zone, { includeToday = false, excludeEventId = null, limit = 10 } = {}) {
    const days = includeToday ? rescheduleDays() : nextDays();
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
        if (options.length >= limit) return options;
      }
    }
    return options;
  }

  async availableHoursForDate(date, { excludeEventId = null, clientZone = null } = {}) {
    const slots = hoursForDate(date, clientZone);
    if (!this.calendar || !slots.length) return slots;
    const events = await this.calendar.listEvents({
      startDateTime: `${date}T00:00:00-05:00`,
      endDateTime: `${date}T23:59:59-05:00`,
      top: 100,
    });
    const normalizedClientZone = String(clientZone || '').toUpperCase().trim();
    const sharedCapacity = inferCountryFromZone(clientZone) === 'CO' ? COLOMBIA_SHARED_TECH_CAPACITY : 1;
    const relevant = events.filter(event => {
      if (event.id === excludeEventId || event.isCancelled) return false;
      if (!normalizedClientZone) return true;
      const eventZone = eventZoneFromText(event.body?.content || event.bodyPreview || '');
      return !eventZone || eventZone === normalizedClientZone;
    });
    return slots.filter(slot => {
      const slotStart = new Date(`${date}T${slot.time}-05:00`);
      const slotEnd = new Date(`${date}T${slot.endTime}-05:00`);
      const overlapping = relevant.filter(event => {
        const start = parseCalendarDateTime(event.start?.dateTime || event.start, event.start?.timeZone);
        const end = parseCalendarDateTime(event.end?.dateTime || event.end, event.end?.timeZone);
        if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
        return overlaps(slotStart, slotEnd, start, end);
      });
      return overlapping.length < sharedCapacity;
    });
  }

  async ensureCalendarEvent({ appointment, profile, dateLabel, hourLabel, ticket }) {
    if (!this.calendar) return null;
    const subject = calendarShortName(profile.nombre_receptor || appointment.nombre_cliente || '');
    const body = calendarDescription({ ticket, appointment, profile, dateLabel, hourLabel });
    const location = `${appointment.direccion_cita || profile.direccion_instalacion || ''}`.trim();
    const attendeeEmail = profile.correo_receptor || appointment.correo_cliente || '';
    const attendees = attendeeEmail ? [{ emailAddress: { address: attendeeEmail, name: profile.nombre_receptor || appointment.nombre_cliente || attendeeEmail }, type: 'required' }] : [];

    if (appointment.microsoft_event_id) {
      await this.calendar.updateEvent(appointment.microsoft_event_id, {
        subject,
        start: { dateTime: appointment.fecha_hora_inicio, timeZone: 'America/Lima' },
        end: { dateTime: appointment.fecha_hora_fin, timeZone: 'America/Lima' },
        body: { contentType: 'text', content: body },
        location: { displayName: location },
        attendees,
      });
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
    });
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
      scheduledAt: appointment.fecha_hora_inicio,
      timeWindow: hourLabel,
      notes: `Visita creada automáticamente desde el chatbot. Ticket ${appointment.codigo_cita}.`,
      quoteId: '',
      installationOrderId: '',
      assignedTechEmail: process.env.TECH_VISITS_DEFAULT_EMAIL || 'luis.campos@evinka.tech',
      assignedTechName: process.env.TECH_VISITS_DEFAULT_NAME || 'Luis Campos',
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
    const rows = await this.sb.select('conversaciones', `id_usuario=eq.${encodeURIComponent(user.id_usuario)}&estado_conversacion=in.(open,paused)&order=creado_en.desc&limit=1`);
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
    await this.logMessage(conversation.id_conversacion, conversation.id_usuario, 'assistant', text);
    const nextStep = patch.paso_actual || conversation.paso_actual || 'menu_principal';
    const interactive = interactiveReplyForStep(nextStep, text, { resumen: patch.resumen ?? conversation.resumen ?? null, subestado: patch.subestado_flujo ?? conversation.subestado_flujo ?? null });
    if (interactive) return ensureAdvisorOption(interactive);
    return { kind: 'text', text: addAdvisorHint(text, nextStep) };
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

  async handleIncoming({ phone, text = '', media = null, payloadCrudo = null, defaultCountry = null, userScope = 'default' }) {
    const user = await this.ensureUser(phone, userScope);
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
    const sendToAdvisor = (reason = 'Soporte humano solicitado') => this.reply(
      conversation,
      advisorHandoffText(selectedCountry),
      {
        paso_actual: 'handoff_asesor',
        subestado_flujo: selectedCountry === 'CO' ? 'asesor_co' : 'asesor_pe',
        estado_conversacion: 'handoff',
        requiere_handoff: true,
        motivo_handoff: reason,
        intencion_principal: conversation.intencion_principal || 'otro',
      },
    );

    if (shouldForceReset) {
      return this.reply(conversation, timeoutResetText(), { paso_actual: 'menu_principal', subestado_flujo: 'reinicio_timeout_24h', estado_conversacion: 'open', resumen: null, intencion_principal: null });
    }

    if (isAdvisorRequest(text)) {
      return sendToAdvisor('Soporte humano solicitado por el cliente');
    }

    const step = conversation.paso_actual || 'menu_principal';
    const letter = pickLetter(text, payloadCrudo, step);

    if (conversation.estado_conversacion === 'handoff' || conversation.paso_actual === 'handoff_asesor') {
      if (letter === 'A' || isContinueRequest(text, letter, payloadCrudo)) {
        return this.reply(conversation, MENU, { paso_actual: 'menu_principal', subestado_flujo: 'bot_desde_handoff', estado_conversacion: 'open', requiere_handoff: false, motivo_handoff: null, intencion_principal: null, resumen: null });
      }
      if (letter === 'B' || isRestartRequest(text, letter, payloadCrudo)) {
        return this.reply(conversation, MENU, { paso_actual: 'menu_principal', subestado_flujo: 'reinicio_desde_handoff', estado_conversacion: 'open', requiere_handoff: false, motivo_handoff: null, intencion_principal: null, resumen: null });
      }
      return this.reply(conversation, advisorInactiveText(), { paso_actual: 'retomar_o_reiniciar', subestado_flujo: 'asesor_inactivo', estado_conversacion: 'paused', resumen: resumePromptPayload(conversation, { previousStep: 'menu_principal', previousSubstate: 'inicio' }), requiere_handoff: false, motivo_handoff: null, intencion_principal: null });
    }

    if (shouldResumePrompt && conversation.id_conversacion === latestConversation?.id_conversacion && conversation.paso_actual !== 'retomar_o_reiniciar') {
      const resumePayload = resumePromptPayload(conversation);
      return this.reply(conversation, resumePromptText(), { paso_actual: 'retomar_o_reiniciar', subestado_flujo: 'inactividad_15m', estado_conversacion: 'paused', resumen: resumePayload });
    }

    if (latestConversation && latestConversation.estado_conversacion === 'closed' && ['cita_confirmada', 'cita_reprogramada', 'ticket_cancelado'].includes(latestConversation.paso_actual || '') && letter) {
      if (letter === 'A') return this.reply(conversation, MENU, { paso_actual: 'menu_principal', subestado_flujo: 'post_cierre_menu', estado_conversacion: 'open' });
      if (letter === 'B') return this.reply(conversation, ticketRequestPrompt('reschedule'), { paso_actual: 'gestion_ticket', subestado_flujo: 'esperando_ticket', intencion_principal: 'otro', accion_ticket_actual: 'reschedule' });
    }
    const continueWithCountry = async (menuOption, country) => {
      const forcedZone = defaultZoneForCountry(country);
      if (profile?.id_perfil) {
        profile = await this.patchProfile(conversation.id_conversacion, { zona_cliente: forcedZone }) || profile;
      }
      if (menuOption === 'A' && country === 'CO') return this.reply(conversation, CO_LOCATION_PROMPT, { intencion_principal: 'instalacion_cargador', paso_actual: 'capturando_localidad_co', subestado_flujo: 'localidad_inicial' });
      if (menuOption === 'A') return this.reply(conversation, CONSENT, { intencion_principal: 'instalacion_cargador', paso_actual: 'consentimiento', subestado_flujo: 'instalacion' });
      if (menuOption === 'B') return this.reply(conversation, ticketRequestPrompt('reschedule'), { intencion_principal: 'otro', paso_actual: 'gestion_ticket', subestado_flujo: 'esperando_ticket', accion_ticket_actual: 'reschedule' });
      if (menuOption === 'C') return this.reply(conversation, ticketRequestPrompt('cancel'), { intencion_principal: 'otro', paso_actual: 'gestion_ticket', subestado_flujo: 'esperando_ticket', accion_ticket_actual: 'cancel' });
      if (menuOption === 'D') return sendToAdvisor('Soporte humano solicitado desde el menú principal');
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
        if (!cita) return this.reply(conversation, 'No pude encontrar la cita a gestionar. Vuelve a ingresar tu ticket.', { paso_actual: 'gestion_ticket', subestado_flujo: 'esperando_ticket', accion_ticket_actual: 'reschedule' });
        const zone = cita.zona_cliente || resolveProfileZone(profile, { phone: this.phoneForUserId(conversation.id_usuario), country: selectedCountry }) || defaultZoneForCountry(selectedCountry);
        if (inferCountryFromZone(zone) === 'CO') {
          const options = await this.availableDateHourOptionsForZone(zone, { includeToday: true, excludeEventId: cita?.microsoft_event_id || null });
          if (!options.length) return this.reply(conversation, 'Por ahora no encontré horarios disponibles en el calendario para reprogramar esa cita.\n\nTe llevo al menú principal para seguir con el bot.', { paso_actual: 'menu_principal', subestado_flujo: 'sin_disponibilidad_reprogramacion', estado_conversacion: 'open', requiere_handoff: false, motivo_handoff: null, resumen: null, intencion_principal: null });
          return this.reply(conversation, combinedSlotsPrompt(zone, options), { paso_actual: 'seleccionando_bloque_horario_reprogramacion', subestado_flujo: ticket, accion_ticket_actual: 'reschedule', codigo_ticket_solicitado: ticket, resumen: JSON.stringify(options) });
        }
        const days = await this.availableDaysForZone(zone, { includeToday: true });
        if (!days.length) return this.reply(conversation, 'Por ahora no encontré horarios disponibles en el calendario para reprogramar esa cita.\n\nTe llevo al menú principal para seguir con el bot.', { paso_actual: 'menu_principal', subestado_flujo: 'sin_disponibilidad_reprogramacion', estado_conversacion: 'open', requiere_handoff: false, motivo_handoff: null, resumen: null, intencion_principal: null });
        return this.reply(conversation, daysPrompt(zone, days), { paso_actual: 'seleccionando_dia_reprogramacion', subestado_flujo: ticket, accion_ticket_actual: 'reschedule', codigo_ticket_solicitado: ticket, resumen: JSON.stringify(days) });
      }
      if (action === 'cancel') {
        const rows = await this.sb.select('citas', `codigo_cita=eq.${encodeURIComponent(ticket)}&select=*`);
        const cita = rows[0];
        if (!cita) return this.reply(conversation, 'No pude encontrar la cita a gestionar. Vuelve a ingresar tu ticket.', { paso_actual: 'gestion_ticket', subestado_flujo: 'esperando_ticket', accion_ticket_actual: 'cancel' });
        if (cita.microsoft_event_id && this.calendar) {
          await this.calendar.cancelEvent(cita.microsoft_event_id, 'Cancelada por cliente desde recordatorio de WhatsApp.');
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

    if (isGreeting(text) && step !== 'menu_principal') {
      return this.reply(conversation, MENU, { paso_actual: 'menu_principal', subestado_flujo: 'reinicio_por_saludo', estado_conversacion: 'open' });
    }

    if (step === 'menu_principal') {
      if (!letter) return this.reply(conversation, MENU);
      if (['A','B','C','D'].includes(letter)) {
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
      const options = await this.availableDateHourOptionsForZone(zone);
      if (!options.length) return this.reply(conversation, 'Por ahora no encontré horarios disponibles para esa zona.\n\nTe llevo al menú principal para seguir con el bot.', { paso_actual: 'menu_principal', subestado_flujo: 'sin_disponibilidad', estado_conversacion: 'open', requiere_handoff: false, motivo_handoff: null, resumen: null, intencion_principal: null });
      return this.reply(conversation, combinedSlotsPrompt(zone, options), { paso_actual: 'seleccionando_bloque_horario', subestado_flujo: 'agenda_directa', resumen: JSON.stringify(options) });
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
        if (!zone) return this.reply(conversation, 'No pude identificar una zona válida para esta dirección.\n\nTe llevo al menú principal para seguir con el bot.', { paso_actual: 'menu_principal', subestado_flujo: 'zona_no_reconocida', estado_conversacion: 'open', requiere_handoff: false, motivo_handoff: null, resumen: null, intencion_principal: null });
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
      const days = (() => { try { return JSON.parse(conversation.resumen || '[]'); } catch { return nextDays(); } })();
      const chosen = days.find(x => x.code === letter);
      const zone = resolveProfileZone(profile, { phone: this.phoneForUserId(conversation.id_usuario), country: selectedCountry }) || defaultZoneForCountry(selectedCountry);
      if (!chosen) return this.reply(conversation, daysPrompt(zone, days));
      const hours = await this.availableHoursForDate(chosen.date, { clientZone: zone });
      if (!hours.length) return this.reply(conversation, 'Ese día ya no tiene horarios disponibles. Elige otro día, por favor.', { paso_actual: 'seleccionando_dia', subestado_flujo: 'agenda_dia', resumen: JSON.stringify(days) });
      return this.reply(conversation, hoursPrompt(hours), { paso_actual: 'seleccionando_hora', subestado_flujo: chosen.date, resumen: JSON.stringify({ day: chosen, hours }) });
    }

    if (step === 'seleccionando_bloque_horario') {
      const options = (() => { try { return JSON.parse(conversation.resumen || '[]'); } catch { return []; } })();
      const chosen = options.find(x => x.code === letter);
      const zone = resolveProfileZone(profile, { phone: this.phoneForUserId(conversation.id_usuario), country: selectedCountry }) || defaultZoneForCountry(selectedCountry);
      if (!chosen) return this.reply(conversation, combinedSlotsPrompt(zone, options), { paso_actual: 'seleccionando_bloque_horario', subestado_flujo: 'agenda_directa', resumen: conversation.resumen || null });
      profile = await this.getOrCreateProfile(conversation);
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
      const day = summary.day || nextDays().find(x => x.date === date);
      const availableHours = summary.hours || await this.availableHoursForDate(date, { clientZone: resolveProfileZone(profile, { phone: this.phoneForUserId(conversation.id_usuario), country: selectedCountry }) || null });
      const chosen = availableHours.find(x => x.code === letter);
      if (!chosen || !day) return this.reply(conversation, hoursPrompt(availableHours));
      profile = await this.getOrCreateProfile(conversation);
      if (selectedCountry === 'CO') {
        const zone = resolveProfileZone(profile, { phone: this.phoneForUserId(conversation.id_usuario), country: selectedCountry }) || defaultZoneForCountry(selectedCountry);
        const draft = {
          kind: 'booking_residencial_co',
          zone,
          date,
          dateLabel: day.label,
          hourLabel: chosen.label,
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
          await this.sb.update('citas', `id_cita=eq.${appointment.id_cita}`, { microsoft_event_id: microsoftEventId, observaciones: 'Sincronizada con Microsoft Calendar.' });
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
      const field = conversation.subestado_flujo || 'nombre';
      const value = parseSingleBookingField(field, text);
      if (!value) return this.reply(conversation, `${invalidBookingFieldPrompt(field)}\n\n${bookingFieldPrompt(field)}`, { paso_actual: 'capturando_datos_booking_residencial', subestado_flujo: field, resumen: conversation.resumen || null });
      draft[field] = value;
      if (!draft.nombre) return this.reply(conversation, bookingFieldPrompt('nombre'), { paso_actual: 'capturando_datos_booking_residencial', subestado_flujo: 'nombre', resumen: JSON.stringify(draft) });
      if (!draft.telefono) return this.reply(conversation, bookingFieldPrompt('telefono'), { paso_actual: 'capturando_datos_booking_residencial', subestado_flujo: 'telefono', resumen: JSON.stringify(draft) });
      if (!draft.correo) return this.reply(conversation, bookingFieldPrompt('correo'), { paso_actual: 'capturando_datos_booking_residencial', subestado_flujo: 'correo', resumen: JSON.stringify(draft) });
      if (!draft.direccion) return this.reply(conversation, bookingFieldPrompt('direccion'), { paso_actual: 'capturando_datos_booking_residencial', subestado_flujo: 'direccion', resumen: JSON.stringify(draft) });
      return this.reply(conversation, bookingSummary(draft), { paso_actual: 'confirmando_datos_booking_residencial', subestado_flujo: 'booking_co', resumen: JSON.stringify(draft) });
    }

    if (step === 'confirmando_datos_booking_residencial') {
      const draft = (() => { try { return JSON.parse(conversation.resumen || '{}'); } catch { return {}; } })();
      if (!letter) return this.reply(conversation, bookingSummary(draft), { paso_actual: 'confirmando_datos_booking_residencial', subestado_flujo: 'booking_co', resumen: conversation.resumen || null });
      if (letter === 'B') return this.reply(conversation, bookingCorrectionMenu(draft), { paso_actual: 'seleccionando_campo_booking_residencial', subestado_flujo: 'booking_co', resumen: JSON.stringify(draft) });
      if (letter === 'A') {
        await this.patchProfile(conversation.id_conversacion, {
          nombre_receptor: draft.nombre,
          telefono_receptor: draft.telefono,
          correo_receptor: draft.correo,
          direccion_instalacion: draft.direccion,
          distrito_instalacion: draft.localidad || draft.zone,
          provincia_instalacion: 'Colombia',
          zona_cliente: draft.zone,
          estado_perfil: 'scheduled',
        });
        try {
          await this.sb.update('usuarios', `id_usuario=eq.${conversation.id_usuario}`, { nombre_visible: draft.nombre, nombre_usuario: draft.nombre, correo_electronico: draft.correo, telefono_principal: draft.telefono });
        } catch (error) {
          const message = String(error?.message || '');
          if (!message.includes('usuarios_correo_key')) throw error;
          await this.sb.update('usuarios', `id_usuario=eq.${conversation.id_usuario}`, { nombre_visible: draft.nombre, nombre_usuario: draft.nombre, telefono_principal: draft.telefono });
        }
        profile = await this.getOrCreateProfile(conversation);
        const appointment = await this.createOrUpdateAppointment(conversation, profile, {
          codigo_cita: this.ticketFor(draft.date, conversation.id_conversacion),
          fecha_cita: draft.date,
          hora_inicio: draft.time,
          hora_fin: draft.endTime,
          fecha_hora_inicio: `${draft.date}T${draft.time}-05:00`,
          fecha_hora_fin: `${draft.date}T${draft.endTime}-05:00`,
          nombre_cliente: draft.nombre,
          telefono_cliente: draft.telefono,
          dni_cliente: null,
          correo_cliente: draft.correo,
          direccion_cita: draft.direccion,
          distrito_cita: draft.localidad || draft.zone,
          provincia_cita: 'Colombia',
          zona_cliente: draft.zone,
          zona_dia: draft.zone,
          control_zona: draft.zone,
          etiqueta_horario: compactScheduleLabel(draft.time, draft.endTime),
          marca_vehiculo: null,
          modelo_vehiculo: null,
          potencia_kw: null,
          fase_electrica: 'no_definido',
          validacion_recibo: false,
          estado_cita: 'confirmada',
          aprobacion: 'aprobada',
          confirmada_por_cliente: true,
          confirmada_en: new Date().toISOString(),
        });
        let microsoftEventId = null;
        try {
          microsoftEventId = await this.ensureCalendarEvent({ appointment, profile: { ...profile, nombre_receptor: draft.nombre, correo_receptor: draft.correo, telefono_receptor: draft.telefono, direccion_instalacion: draft.direccion, distrito_instalacion: draft.localidad || draft.zone, provincia_instalacion: 'Colombia', zona_cliente: draft.zone }, dateLabel: draft.dateLabel, hourLabel: draft.hourLabel, ticket: appointment.codigo_cita });
          if (microsoftEventId) {
            await this.sb.update('citas', `id_cita=eq.${appointment.id_cita}`, { microsoft_event_id: microsoftEventId, observaciones: 'Sincronizada con Microsoft Calendar.' });
          }
        } catch (error) {
          console.error('ensureCalendarEvent failed:', error);
        }
        const finalAddress = `${draft.direccion} ${draft.localidad || ''} Colombia`.trim();
        try {
          await this.scheduleBookingReminder({ userId: conversation.id_usuario, ticket: appointment.codigo_cita, dateLabel: draft.dateLabel, hourLabel: draft.hourLabel, address: finalAddress });
        } catch (error) {
          console.error('scheduleBookingReminder failed:', error);
        }
        try {
          await this.publishTechVisit({ conversation, profile: { ...profile, nombre_receptor: draft.nombre, correo_receptor: draft.correo, telefono_receptor: draft.telefono, direccion_instalacion: draft.direccion, distrito_instalacion: draft.localidad || draft.zone, provincia_instalacion: 'Colombia', zona_cliente: draft.zone }, appointment, dateLabel: draft.dateLabel, hourLabel: draft.hourLabel });
        } catch (error) {
          console.error('publishTechVisit failed:', error);
        }
        return this.reply(conversation, finalConfirmation({ ticket: appointment.codigo_cita, dateLabel: draft.dateLabel, hourLabel: draft.hourLabel, address: finalAddress, country: 'CO' }), { paso_actual: 'cita_confirmada', subestado_flujo: 'agenda_confirmada', estado_conversacion: 'closed', accion_ticket_actual: 'confirm', codigo_ticket_solicitado: appointment.codigo_cita, cerrada_en: new Date().toISOString() });
      }
    }

    if (step === 'seleccionando_campo_booking_residencial') {
      const draft = (() => { try { return JSON.parse(conversation.resumen || '{}'); } catch { return {}; } })();
      if (!letter) return this.reply(conversation, bookingCorrectionMenu(draft), { paso_actual: 'seleccionando_campo_booking_residencial', subestado_flujo: 'booking_co', resumen: conversation.resumen || null });
      const map = { A: 'nombre', B: 'telefono', C: 'correo', D: 'direccion' };
      const field = map[letter];
      if (!field) return this.reply(conversation, bookingCorrectionMenu(draft), { paso_actual: 'seleccionando_campo_booking_residencial', subestado_flujo: 'booking_co', resumen: conversation.resumen || null });
      return this.reply(conversation, bookingFieldPrompt(field), { paso_actual: 'capturando_datos_booking_residencial', subestado_flujo: field, resumen: JSON.stringify(draft) });
    }

    if (step === 'gestion_ticket') {
      const ticket = text.trim();
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
          if (!cita) return this.reply(conversation, 'No pude encontrar la cita a gestionar. Vuelve a ingresar tu ticket.', { paso_actual: 'gestion_ticket', subestado_flujo: 'esperando_ticket' });
          const zone = cita.zona_cliente || resolveProfileZone(profile, { phone: this.phoneForUserId(conversation.id_usuario), country: selectedCountry }) || defaultZoneForCountry(selectedCountry);
          if (inferCountryFromZone(zone) === 'CO') {
            const options = await this.availableDateHourOptionsForZone(zone, { includeToday: true, excludeEventId: cita?.microsoft_event_id || null });
            if (!options.length) return this.reply(conversation, 'Por ahora no encontré horarios disponibles en el calendario para reprogramar esa cita.\n\nTe llevo al menú principal para seguir con el bot.', { paso_actual: 'menu_principal', subestado_flujo: 'sin_disponibilidad_reprogramacion', estado_conversacion: 'open', requiere_handoff: false, motivo_handoff: null, resumen: null, intencion_principal: null });
            return this.reply(conversation, combinedSlotsPrompt(zone, options), { paso_actual: 'seleccionando_bloque_horario_reprogramacion', subestado_flujo: ticket, accion_ticket_actual: 'reschedule', codigo_ticket_solicitado: ticket, resumen: JSON.stringify(options) });
          }
          const days = await this.availableDaysForZone(zone, { includeToday: true });
          if (!days.length) return this.reply(conversation, 'Por ahora no encontré horarios disponibles en el calendario para reprogramar esa cita.\n\nTe llevo al menú principal para seguir con el bot.', { paso_actual: 'menu_principal', subestado_flujo: 'sin_disponibilidad_reprogramacion', estado_conversacion: 'open', requiere_handoff: false, motivo_handoff: null, resumen: null, intencion_principal: null });
          return this.reply(conversation, daysPrompt(zone, days), { paso_actual: 'seleccionando_dia_reprogramacion', subestado_flujo: ticket, accion_ticket_actual: 'reschedule', codigo_ticket_solicitado: ticket, resumen: JSON.stringify(days) });
        }
        if (conversation.accion_ticket_actual === 'cancel') {
          const ticket = conversation.subestado_flujo;
          const rows = await this.sb.select('citas', `codigo_cita=eq.${encodeURIComponent(ticket)}&select=*`);
          const cita = rows[0];
          if (!cita) return this.reply(conversation, 'No pude encontrar la cita a gestionar. Vuelve a ingresar tu ticket.', { paso_actual: 'gestion_ticket', subestado_flujo: 'esperando_ticket' });
          if (cita.microsoft_event_id && this.calendar) {
            await this.calendar.cancelEvent(cita.microsoft_event_id, 'Cancelada por cliente desde WhatsApp.');
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
        const zone = cita.zona_cliente || resolveProfileZone(profile, { phone: this.phoneForUserId(conversation.id_usuario), country: selectedCountry }) || defaultZoneForCountry(selectedCountry);
        if (inferCountryFromZone(zone) === 'CO') {
          const options = await this.availableDateHourOptionsForZone(zone, { includeToday: true, excludeEventId: cita?.microsoft_event_id || null });
          if (!options.length) return this.reply(conversation, 'Por ahora no encontré horarios disponibles en el calendario para reprogramar esa cita.\n\nTe llevo al menú principal para seguir con el bot.', { paso_actual: 'menu_principal', subestado_flujo: 'sin_disponibilidad_reprogramacion', estado_conversacion: 'open', requiere_handoff: false, motivo_handoff: null, resumen: null, intencion_principal: null });
          return this.reply(conversation, combinedSlotsPrompt(zone, options), { paso_actual: 'seleccionando_bloque_horario_reprogramacion', subestado_flujo: ticket, accion_ticket_actual: 'reschedule', codigo_ticket_solicitado: ticket, resumen: JSON.stringify(options) });
        }
        const days = await this.availableDaysForZone(zone, { includeToday: true });
        if (!days.length) return this.reply(conversation, 'Por ahora no encontré horarios disponibles en el calendario para reprogramar esa cita.\n\nTe llevo al menú principal para seguir con el bot.', { paso_actual: 'menu_principal', subestado_flujo: 'sin_disponibilidad_reprogramacion', estado_conversacion: 'open', requiere_handoff: false, motivo_handoff: null, resumen: null, intencion_principal: null });
        return this.reply(conversation, daysPrompt(zone, days), { paso_actual: 'seleccionando_dia_reprogramacion', subestado_flujo: ticket, accion_ticket_actual: 'reschedule', codigo_ticket_solicitado: ticket, resumen: JSON.stringify(days) });
      }
      if (letter === 'B') {
        if (cita.microsoft_event_id && this.calendar) {
          await this.calendar.cancelEvent(cita.microsoft_event_id, 'Cancelada por cliente desde WhatsApp.');
        }
        await this.sb.update('citas', `codigo_cita=eq.${encodeURIComponent(ticket)}`, { estado_cita: 'cancelada', motivo_cancelacion: 'Cancelada por cliente desde WhatsApp.', cancelada_en: new Date().toISOString() });
        return this.reply(conversation, 'Entendido 👍\n\nTu cita ha sido cancelada correctamente.\n\nLamentamos que no puedas continuar por ahora. Cuando lo desees, estaremos encantados de ayudarte a agendar una nueva visita.\n\n¡Gracias por confiar en EVINKA! ⚡', { paso_actual: 'ticket_cancelado', subestado_flujo: ticket, estado_conversacion: 'closed', cerrada_en: new Date().toISOString() });
      }
    }

    if (step === 'seleccionando_dia_reprogramacion') {
      const days = (() => { try { return JSON.parse(conversation.resumen || '[]'); } catch { return rescheduleDays(); } })();
      const chosenDay = days.find(x => x.code === letter);
      const zone = profile.zona_cliente || resolveProfileZone(profile, { phone: this.phoneForUserId(conversation.id_usuario), country: selectedCountry }) || defaultZoneForCountry(selectedCountry);
      if (!chosenDay) return this.reply(conversation, daysPrompt(zone, days));
      const rows = await this.sb.select('citas', `codigo_cita=eq.${encodeURIComponent(conversation.subestado_flujo)}&select=*`);
      const old = rows[0];
      const hours = await this.availableHoursForDate(chosenDay.date, { excludeEventId: old?.microsoft_event_id || null, clientZone: zone });
      if (!hours.length) return this.reply(conversation, 'Ese día ya no tiene horarios disponibles para reprogramar. Elige otro día, por favor.', { paso_actual: 'seleccionando_dia_reprogramacion', subestado_flujo: conversation.subestado_flujo, resumen: JSON.stringify(days) });
      return this.reply(conversation, hoursPrompt(hours), { paso_actual: 'seleccionando_hora_reprogramacion', subestado_flujo: JSON.stringify({ ticket: conversation.subestado_flujo, date: chosenDay.date, dateLabel: chosenDay.label }), accion_ticket_actual: 'reschedule', resumen: JSON.stringify(hours) });
    }

    if (step === 'seleccionando_bloque_horario_reprogramacion') {
      const options = (() => { try { return JSON.parse(conversation.resumen || '[]'); } catch { return []; } })();
      const chosen = options.find(x => x.code === letter);
      const rows = await this.sb.select('citas', `codigo_cita=eq.${encodeURIComponent(conversation.subestado_flujo)}&select=*`);
      const old = rows[0];
      const zone = old?.zona_cliente || profile.zona_cliente || resolveProfileZone(profile, { phone: this.phoneForUserId(conversation.id_usuario), country: selectedCountry }) || defaultZoneForCountry(selectedCountry);
      if (!chosen) return this.reply(conversation, combinedSlotsPrompt(zone, options), { paso_actual: 'seleccionando_bloque_horario_reprogramacion', subestado_flujo: conversation.subestado_flujo, accion_ticket_actual: 'reschedule', resumen: conversation.resumen || null });
      if (!old) return this.reply(conversation, 'No pude encontrar la cita original. Vuelve a intentarlo con tu ticket.', { paso_actual: 'gestion_ticket', subestado_flujo: 'esperando_ticket' });
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
