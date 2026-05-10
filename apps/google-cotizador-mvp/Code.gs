const CONFIG = {
  spreadsheetId: '1XMksioNHwpo32wIHmEW-N3oD1QRZp4dgi_OkotEMjvM',
  driveFolderId: '1WLDzC5XpC7C2xK5y6ESu12cba8Zp4pfX',
  reviewEmail: 'raul@evinka.tech',
  ownerEmail: 'luis.campos@evinka.tech',
  formTitle: 'EVINKA - Visita técnica para cotización',
  sheets: {
    raw: 'FORM_RESPONSES_RAW',
    catalog: 'CATALOGO_PRECIOS',
    quotes: 'COTIZACIONES',
    config: 'CONFIG',
  },
  technicians: ['MIRKO MORENO', 'LUIGGI MANAY', 'JUAN SANCHEZ'],
  pdf: {
    companyName: 'EVINKA TECHNOLOGY S.A.C.',
    companyShort: 'evinka',
    issueCity: 'LIMA',
    currency: 'SOLES',
    validityDays: 30,
    deliveryPlaceDefault: 'LIMA-LIMA-SAN BORJA',
    deliveryTimeDefault: '5 días',
    paymentTermsDefault: '50% ADELANTO - 50% AL TERMINAR FABRICACION',
    footerAddress: 'AV. FELIPE PARDO Y ALIAGA NRO. 220 URB. SANTA CRUZ (DP 3 PISO 3) LIMA - LIMA - SAN ISIDRO',
    footerPhone: '945 149 285',
    footerEmail: 'contacto@evinka.tech',
    footerWeb: 'evinka.tech',
    bankRows: [
      ['BCP', 'SOLES', '1949917309036', '00219400991730906398'],
      ['BCP', 'DÓLAR', '1949897105165', '00219400989710516595'],
    ],
    bankFooter1: 'BANCO DE CRÉDITO DEL PERÚ',
    bankFooter2: 'DOMICILIO: CALLE LAS CAMELIAS 750 INT. BANKING AND LEASING AREA SAN ISIDRO, LIMA',
    bankFooter3: 'CODIGO SWIFT: BCPLPEPL',
    detracciones: 'CUENTA DE DETRACCIONES BANCO DE LA NACION: 00-003-338576',
  },
  additionalItems: [],
};

const FORM_FIELDS = [
  'timestamp',
  'nombre_cliente',
  'documento',
  'telefono',
  'correo',
  'direccion',
  'distrito',
  'provincia',
  'departamento',
  'fecha_visita',
  'tecnico',
  'tipo_cliente',
  'marca_vehiculo',
  'modelo_vehiculo',
  'referencia_cargador',
  'tipo_instalacion',
  'voltaje',
  'corriente',
  'distancia_acometida_m',
  'tipo_tuberia',
  'puesta_tierra_real',
  'descripcion_tecnica',
  'observaciones_adicionales',
];

const QUOTE_COLUMNS = [
  'quote_id',
  'created_at',
  'cliente',
  'documento',
  'correo',
  'telefono',
  'tecnico',
  'tipo_instalacion',
  'distancia_acometida_m',
  'factor_aplicado',
  'mano_obra',
  'visita_tecnica',
  'transporte_herramientas',
  'subtotal',
  'igv',
  'total',
  'pdf_url',
  'estado_revision',
];

function bootstrapMvp() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  ensureConfigSheet_(ss);
  ensureCatalogSheet_(ss);
  ensureQuotesSheet_(ss);
  const form = ensureForm_(ss);
  applySheetDesign_();
  SpreadsheetApp.getActive().toast(`MVP listo. Form: ${form.getPublishedUrl()}`, 'EVINKA');
}

function resetMvpFromScratch() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === 'handleFormSubmit') ScriptApp.deleteTrigger(trigger);
  });
  const configSheet = getOrCreateSheet_(ss, CONFIG.sheets.config);
  const previousConfig = getConfig_();
  ensureConfigSheet_(ss);
  ensureCatalogSheet_(ss);
  ensureQuotesSheet_(ss);
  const oldFormCandidates = [previousConfig.FORM_ID, previousConfig.FORM_EDIT_URL, previousConfig.FORM_PUBLISHED_URL]
    .map((value) => extractGoogleId_(value || ''))
    .filter(Boolean);
  oldFormCandidates.forEach((id) => {
    try {
      const form = FormApp.openById(id);
      DriveApp.getFileById(form.getId()).setTrashed(true);
    } catch (error) {}
  });
  setConfigValue_(configSheet, 'FORM_ID', '');
  setConfigValue_(configSheet, 'FORM_EDIT_URL', '');
  setConfigValue_(configSheet, 'FORM_PUBLISHED_URL', '');
  const form = ensureForm_(ss);
  repairFormLinks();
  applySheetDesign_();
  SpreadsheetApp.getActive().toast(`MVP reiniciado. Form: ${form.getPublishedUrl()}`, 'EVINKA');
}

function repairFormLinks() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const configSheet = ss.getSheetByName(CONFIG.sheets.config);
  let formId = resolveFormIdFromConfig_(ss);
  if (!formId) {
    const rawSheet = ss.getSheets().find((sheet) => sheet.getFormUrl && sheet.getFormUrl());
    if (rawSheet) formId = extractGoogleId_(rawSheet.getFormUrl());
  }
  if (!formId) throw new Error('No pude encontrar el Form para reparar links.');
  const form = FormApp.openById(formId);
  setConfigValue_(configSheet, 'FORM_ID', form.getId());
  setConfigValue_(configSheet, 'FORM_EDIT_URL', form.getEditUrl());
  setConfigValue_(configSheet, 'FORM_PUBLISHED_URL', form.getPublishedUrl());
  return form.getPublishedUrl();
}

function refreshMvpDesign() {
  applySheetDesign_();
}

function syncMvpForm() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const formId = resolveFormIdFromConfig_(ss);
  if (!formId) throw new Error('No encontré un Form válido en CONFIG. Revisa FORM_ID / FORM_EDIT_URL / FORM_PUBLISHED_URL.');
  const form = FormApp.openById(formId);
  buildForm_(form);
}

function ensureForm_(ss) {
  const configSheet = ss.getSheetByName(CONFIG.sheets.config);
  let formId = resolveFormIdFromConfig_(ss);
  let form;
  if (formId) {
    try {
      form = FormApp.openById(formId);
    } catch (error) {
      formId = '';
    }
  }
  if (!formId) {
    form = FormApp.create(CONFIG.formTitle);
    form.setCollectEmail(false);
    form.setDescription('Formulario MVP para visitas técnicas EVINKA y cotización de instalación.');
    form.setDestination(FormApp.DestinationType.SPREADSHEET, CONFIG.spreadsheetId);
    setConfigValue_(configSheet, 'FORM_ID', form.getId());
    setConfigValue_(configSheet, 'FORM_EDIT_URL', form.getEditUrl());
    setConfigValue_(configSheet, 'FORM_PUBLISHED_URL', form.getPublishedUrl());
    buildForm_(form);
  }
  const rawSheet = ss.getSheets().find((sheet) => sheet.getFormUrl());
  if (rawSheet && rawSheet.getName() !== CONFIG.sheets.raw) rawSheet.setName(CONFIG.sheets.raw);
  installTriggers_(ss, form);
  return form;
}

function buildForm_(form) {
  form.deleteAllResponses();
  const items = form.getItems();
  items.forEach((item) => form.deleteItem(item));

  form.addSectionHeaderItem().setTitle('Datos del cliente');
  form.addTextItem().setTitle('Nombre completo / Razón social').setRequired(true);
  form.addTextItem().setTitle('DNI / RUC').setRequired(true);
  form.addTextItem().setTitle('Teléfono').setRequired(true);
  form.addTextItem().setTitle('Correo electrónico').setRequired(true);
  form.addParagraphTextItem().setTitle('Dirección del proyecto').setRequired(true);
  form.addTextItem().setTitle('Distrito').setRequired(true);
  form.addTextItem().setTitle('Provincia').setRequired(true);
  form.addListItem().setTitle('Departamento').setChoiceValues(['Amazonas','Áncash','Apurímac','Arequipa','Ayacucho','Cajamarca','Callao','Cusco','Huancavelica','Huánuco','Ica','Junín','La Libertad','Lambayeque','Lima','Loreto','Madre de Dios','Moquegua','Pasco','Piura','Puno','San Martín','Tacna','Tumbes','Ucayali']).setRequired(true);

  form.addSectionHeaderItem().setTitle('Datos de la visita');
  form.addDateItem().setTitle('Fecha de visita').setRequired(true);
  form.addListItem().setTitle('Técnico responsable').setChoiceValues(CONFIG.technicians).setRequired(true);
  form.addMultipleChoiceItem().setTitle('Tipo de cliente').setChoiceValues(['Persona natural','Empresa']).setRequired(true);
  form.addMultipleChoiceItem().setTitle('Tipo de inmueble').setChoiceValues(['Casa','Edificio']).setRequired(true);
  form.addTextItem().setTitle('Marca del vehículo');
  form.addTextItem().setTitle('Modelo del vehículo');
  form.addTextItem().setTitle('Referencia del cargador (solo informativo)');
  form.addMultipleChoiceItem().setTitle('Tipo de instalación').setChoiceValues(['Monofásico','Trifásico']).setRequired(true);
  form.addTextItem().setTitle('Voltaje (V)').setRequired(true);
  form.addTextItem().setTitle('Corriente (A)').setRequired(true);
  form.addTextItem().setTitle('Distancia de acometida (m)').setRequired(true);
  form.addMultipleChoiceItem().setTitle('Tipo de tubería').setChoiceValues(['EMT','PVC']).setRequired(true);
  form.addMultipleChoiceItem().setTitle('¿Existe puesta a tierra real?').setChoiceValues(['Sí','No']).setRequired(true);
  form.addParagraphTextItem().setTitle('Descripción técnica de la instalación').setRequired(false);
  form.addParagraphTextItem().setTitle('Observaciones adicionales').setRequired(false);
}

function ensureConfigSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, CONFIG.sheets.config);
  sheet.clear();
  const rows = [
    ['Clave', 'Valor'],
    ['IGV', 0.18],
    ['VALIDEZ_DIAS', 7],
    ['VISITA_TECNICA', 110],
    ['REVIEW_EMAIL', CONFIG.reviewEmail],
    ['OWNER_EMAIL', CONFIG.ownerEmail],
    ['FORM_ID', ''],
    ['FORM_EDIT_URL', ''],
    ['FORM_PUBLISHED_URL', ''],
    ['DRIVE_FOLDER_ID', CONFIG.driveFolderId],
  ];
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 2);
}

function ensureCatalogSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, CONFIG.sheets.catalog);
  const rows = [
    ['concepto', 'unidad', 'costo_base', 'precio_referencial', 'nota'],
    ['Mano de obra 0-24.9m', 'GL', 525, 700, 'Base para factor 1 / 1.4 / 2'],
    ['Trabajo de altura', 'día', 600, 800, 'Opcional'],
    ['Técnico certificado altura', 'día', 50, 66.7, 'Opcional'],
    ['SSOMA', 'día', 350, 466.7, 'Opcional'],
    ['Obra civil por día', 'día', 170, 226.7, 'Opcional'],
    ['Materiales obra civil', 'día', 68, 90.7, 'Opcional'],
    ['Transporte Lima 0-24.9m', 'GL', 120, 160, 'Base para factor 1 / 1.4 / 2'],
  ];
  sheet.clear();
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 5);
}

function ensureQuotesSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, CONFIG.sheets.quotes);
  sheet.clear();
  sheet.getRange(1, 1, 1, QUOTE_COLUMNS.length).setValues([QUOTE_COLUMNS]);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, QUOTE_COLUMNS.length);
}

function installTriggers_(ss, form) {
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === 'handleFormSubmit') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('handleFormSubmit').forSpreadsheet(ss).onFormSubmit().create();
}

function handleFormSubmit(e) {
  const row = normalizeFormRow_(e.namedValues || {});
  const quote = calculateQuote_(row);
  const pdf = generateQuotePdf_(quote, row);
  saveQuote_(quote, pdf.url);
  notifyReview_(quote, pdf.url);
}

function normalizeFormRow_(namedValues) {
  const source = {};
  Object.keys(namedValues).forEach((key) => {
    source[slug_(key)] = Array.isArray(namedValues[key]) ? namedValues[key][0] : namedValues[key];
  });
  return {
    timestamp: new Date(),
    nombre_cliente: source.nombre_completo_razon_social || '',
    documento: source.dni_ruc || '',
    telefono: source.telefono || '',
    correo: source.correo_electronico || '',
    direccion: source.direccion_del_proyecto || '',
    distrito: source.distrito || '',
    provincia: source.provincia || '',
    departamento: source.departamento || '',
    fecha_visita: source.fecha_de_visita || '',
    tecnico: source.tecnico_responsable || '',
    tipo_cliente: source.tipo_de_cliente || '',
    tipo_inmueble: source.tipo_de_inmueble || 'Casa',
    marca_vehiculo: source.marca_del_vehiculo || '',
    modelo_vehiculo: source.modelo_del_vehiculo || '',
    referencia_cargador: source.referencia_del_cargador_solo_informativo || '',
    tipo_instalacion: source.tipo_de_instalacion || '',
    voltaje: number_(source.voltaje_v),
    corriente: number_(source.corriente_a),
    distancia_acometida_m: number_(source.distancia_de_acometida_m),
    tipo_tuberia: source.tipo_de_tuberia || '',
    puesta_tierra_real: source.existe_puesta_a_tierra_real || '',
    descripcion_tecnica: source.descripcion_tecnica_de_la_instalacion || '',
    observaciones_adicionales: source.observaciones_adicionales || '',
  };
}

function calculateQuote_(row) {
  const config = getConfig_();
  const catalog = getCatalogMap_();
  const factor = row.distancia_acometida_m < 25 ? 1 : row.distancia_acometida_m < 40 ? 1.4 : 2;
  const manoObra = number_(catalog['Mano de obra 0-24.9m']) * factor;
  const transporte = number_(catalog['Transporte Lima 0-24.9m']) * factor;
  const visita = number_(config.VISITA_TECNICA || 110);
  const materials = calculateMaterialBreakdown_(row, catalog);
  const subtotal = manoObra + transporte + visita + materials.total;
  const igv = subtotal * number_(config.IGV || 0.18);
  const total = subtotal + igv;
  return {
    quoteId: nextQuoteId_(),
    createdAt: new Date(),
    cliente: row.nombre_cliente,
    documento: row.documento,
    correo: row.correo,
    telefono: row.telefono,
    tecnico: row.tecnico,
    tipoInstalacion: row.tipo_instalacion,
    tipoInmueble: row.tipo_inmueble || 'Casa',
    distancia: row.distancia_acometida_m,
    factor,
    manoObra,
    visita,
    transporte,
    materiales: materials.total,
    materialesTuberia: materials.tuberia,
    materialesDetalle: materials,
    subtotal,
    igv,
    total,
    row,
  };
}

function generateQuotePdf_(quote, row) {
  const folder = DriveApp.getFolderById(CONFIG.driveFolderId);
  const html = HtmlService.createHtmlOutput(buildQuoteHtml_(quote, row)).getBlob().getAs(MimeType.PDF);
  html.setName(`${quote.quoteId} - ${quote.cliente || 'Cliente'}.pdf`);
  const file = folder.createFile(html);
  return { id: file.getId(), url: file.getUrl() };
}

function buildQuoteHtml_(quote, row) {
  const money = (value) => Number(value || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cfg = CONFIG.pdf;
  const issueDate = formatDateEs_(quote.createdAt || new Date());
  const deliveryPlace = [cfg.issueCity, row.departamento || '', row.provincia || '', row.distrito || ''].filter(Boolean).join('-') || cfg.deliveryPlaceDefault;
  const quoteNumber = displayQuoteNumber_(quote);
  const customerCode = String(row.documento || '').trim() || quoteNumber;
  const items = buildQuoteItems_(quote, row);
  const itemsHtml = items.map((item, index) => `
    <tr>
      <td class="c">${index + 1}</td>
      <td class="c">${item.quantity}</td>
      <td class="c">${escapeHtmlHtml_(item.unit)}</td>
      <td class="c">${escapeHtmlHtml_(item.code)}</td>
      <td>${escapeHtmlHtml_(item.description)}</td>
      <td class="r">${money(item.unitPrice)}</td>
      <td class="r">${money(item.total)}</td>
    </tr>`).join('');
  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { size: A4; margin: 16mm 12mm 18mm; }
          body { font-family: Arial, Helvetica, sans-serif; color:#111; font-size:12px; line-height:1.25; }
          .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; }
          .brand { display:flex; align-items:center; gap:10px; }
          .logo-ring { width:34px; height:34px; border:5px solid #caa15e; border-radius:50%; box-sizing:border-box; opacity:.9; }
          .logo-text { font-size:26px; font-weight:700; color:#b68845; letter-spacing:.2px; }
          .quote-title { text-align:center; font-size:24px; font-weight:700; margin:6px 0 10px; }
          .top-grid { width:100%; border-collapse:collapse; margin-bottom:10px; }
          .top-grid td { vertical-align:top; padding:2px 0; }
          .label { width:72px; }
          .colon { width:10px; }
          .value { font-weight:700; }
          .right-info { width:230px; }
          .intro { margin:10px 0 8px; }
          table { width:100%; border-collapse:collapse; }
          .items th, .items td { border:1px solid #000; padding:4px 6px; }
          .items th { background:#fff; font-weight:700; }
          .c { text-align:center; }
          .r { text-align:right; }
          .summary-wrap { display:flex; justify-content:space-between; align-items:flex-start; margin-top:8px; gap:12px; }
          .terms { flex:1; }
          .terms div { margin-bottom:3px; }
          .summary { width:220px; border-collapse:collapse; }
          .summary td { border:1px solid #000; padding:5px 6px; font-weight:700; }
          .summary .grand td { font-size:16px; }
          .section-title { font-weight:700; margin:10px 0 4px; }
          .paragraph { text-align:justify; margin:0 0 8px; }
          .bank { margin-top:12px; width:100%; border-collapse:collapse; }
          .bank th, .bank td { border:1px solid #000; padding:4px 6px; }
          .bank th { background:#fff; }
          .bank-note { border:1px solid #000; border-top:none; padding:4px 6px; font-weight:700; }
          .footer { margin-top:28px; border-top:2px solid #111; padding-top:8px; font-size:11px; }
          .footer strong { display:block; margin-bottom:4px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">
            <div class="logo-ring"></div>
            <div class="logo-text">${escapeHtmlHtml_(cfg.companyShort)}</div>
          </div>
        </div>

        <div class="quote-title">COTIZACION N° : ${escapeHtmlHtml_(quoteNumber)}</div>

        <table class="top-grid">
          <tr>
            <td>
              <table class="top-grid">
                <tr><td class="label">Señores</td><td class="colon">:</td><td class="value">${escapeHtmlHtml_(quote.cliente || '-')}</td></tr>
                <tr><td class="label">Ruc</td><td class="colon">:</td><td class="value">${escapeHtmlHtml_(row.documento || '-')}</td></tr>
                <tr><td class="label">Inmueble</td><td class="colon">:</td><td class="value">${escapeHtmlHtml_(row.tipo_inmueble || 'Casa')}</td></tr>
                <tr><td class="label">Teléfono</td><td class="colon">:</td><td class="value">${escapeHtmlHtml_(row.telefono || '-')}</td></tr>
                <tr><td class="label">Dirección</td><td class="colon">:</td><td class="value">${escapeHtmlHtml_(row.direccion || '-')}</td></tr>
                <tr><td class="label">Atención</td><td class="colon">:</td><td class="value">${escapeHtmlHtml_(quote.cliente || '-')}</td></tr>
              </table>
            </td>
            <td class="right-info">
              <table class="top-grid">
                <tr><td class="label">Fecha</td><td class="colon">:</td><td class="value">${escapeHtmlHtml_(issueDate)}</td></tr>
                <tr><td class="label">Cod. cliente</td><td class="colon">:</td><td class="value">${escapeHtmlHtml_(customerCode)}</td></tr>
                <tr><td class="label">Moneda</td><td class="colon">:</td><td class="value">${escapeHtmlHtml_(cfg.currency)}</td></tr>
              </table>
            </td>
          </tr>
        </table>

        <div class="intro">Estimados Señores<br>Por medio de la presente nos es grato hacerles llegar nuestros saludos a la vez Cotizarles lo siguiente :</div>

        <table class="items">
          <thead>
            <tr>
              <th style="width:36px">It.</th>
              <th style="width:46px">Cant.</th>
              <th style="width:44px">Unid</th>
              <th style="width:70px">Código</th>
              <th>Descripción</th>
              <th style="width:92px">Precio Unit. S/</th>
              <th style="width:86px">Total S/</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>

        <div class="summary-wrap">
          <div class="terms">
            <div><strong>Lugar de Entrega</strong> : ${escapeHtmlHtml_(deliveryPlace)}</div>
            <div><strong>Tiempo de Entrega</strong> : ${escapeHtmlHtml_(cfg.deliveryTimeDefault)}</div>
            <div><strong>Validez de Cotizac.</strong> : ${escapeHtmlHtml_(String(cfg.validityDays))} días</div>
            <div><strong>Forma de Pago</strong> : ${escapeHtmlHtml_(cfg.paymentTermsDefault)}</div>
            <div><strong>Observ.</strong> :</div>
          </div>
          <table class="summary">
            <tr><td>SUB TOTAL</td><td class="r">S/</td><td class="r">${money(quote.subtotal)}</td></tr>
            <tr><td>IGV</td><td class="r">S/</td><td class="r">${money(quote.igv)}</td></tr>
            <tr class="grand"><td>TOTAL INC. IGV</td><td class="r">S/</td><td class="r">${money(quote.total)}</td></tr>
          </table>
        </div>

        <div class="section-title">${escapeHtmlHtml_(items[0]?.description || 'Servicio de instalación')}</div>
        <p class="paragraph">${escapeHtmlHtml_(row.descripcion_tecnica || 'Servicio de instalación eléctrica desde el punto de alimentación hasta la ubicación definida para el cargador, considerando materiales, maniobras, protecciones y pruebas funcionales para una operación segura y ordenada.')}</p>
        <p class="paragraph"><strong>Nota:</strong> La garantía de la instalación tiene una duración de 12 meses desde entregado el proyecto. Se considera la desenergización de la vivienda durante el día de instalación y se solicita que los estacionamientos involucrados se encuentren despejados.</p>
        <p class="paragraph">Agradeciendo su gentil Atención, Quedamos de Ud.<br><br>Atentamente :</p>

        <table class="bank">
          <thead>
            <tr><th>BANCO</th><th>MONEDA</th><th>N° CUENTA</th><th>N° CCI</th></tr>
          </thead>
          <tbody>
            ${cfg.bankRows.map((row) => `<tr><td>${escapeHtmlHtml_(row[0])}</td><td>${escapeHtmlHtml_(row[1])}</td><td>${escapeHtmlHtml_(row[2])}</td><td>${escapeHtmlHtml_(row[3])}</td></tr>`).join('')}
          </tbody>
        </table>
        <div class="bank-note">${escapeHtmlHtml_(cfg.bankFooter1)}</div>
        <div class="bank-note">${escapeHtmlHtml_(cfg.bankFooter2)}</div>
        <div class="bank-note">${escapeHtmlHtml_(cfg.bankFooter3)}</div>
        <div class="bank-note">${escapeHtmlHtml_(cfg.detracciones)}</div>

        <div class="footer">
          <strong>${escapeHtmlHtml_(cfg.companyName)}</strong>
          ${escapeHtmlHtml_(cfg.footerAddress)}<br>
          Teleef : ${escapeHtmlHtml_(cfg.footerPhone)}<br>
          E-Mail : ${escapeHtmlHtml_(cfg.footerEmail)}<br>
          Pag.Web : ${escapeHtmlHtml_(cfg.footerWeb)}
        </div>
      </body>
    </html>`;
}

function buildQuoteItems_(quote, row) {
  const items = [
    {
      quantity: 1,
      unit: 'ZZ',
      code: '0060001',
      description: `Servicio de instalación estándar (${row.tipo_instalacion || 'Instalación'})`,
      unitPrice: quote.manoObra,
      total: quote.manoObra,
    },
    {
      quantity: 1,
      unit: 'ZZ',
      code: '0060002',
      description: 'Visita técnica e ingeniería',
      unitPrice: quote.visita,
      total: quote.visita,
    },
    {
      quantity: 1,
      unit: 'ZZ',
      code: '0060003',
      description: `Transporte y herramientas (${quote.factor}x por ${quote.distancia} m)`,
      unitPrice: quote.transporte,
      total: quote.transporte,
    },
  ];

  if (quote.materialesTuberia > 0) {
    items.push({
      quantity: quote.distancia,
      unit: 'M',
      code: '0060004',
      description: `Tubería ${row.tipo_tuberia || 'EMT/PVC'} para ${quote.distancia} m`,
      unitPrice: quote.materialesDetalle.unitTuberia,
      total: quote.materialesTuberia,
    });
  }

  return items;
}

function calculateMaterialBreakdown_(row, catalog) {
  const distance = Math.max(0, number_(row.distancia_acometida_m));
  const tubeType = String(row.tipo_tuberia || 'EMT').toUpperCase();
  const unitTuberia = tubeType === 'PVC'
    ? number_(catalog['Tubería PVC para empotrado'] || 18.5)
    : number_(catalog['Tubería Conduit EMT'] || 13.1) / 3;
  const tuberia = distance * unitTuberia;

  return {
    tuberia,
    total: tuberia,
    unitTuberia,
  };
}

function displayQuoteNumber_(quote) {
  return String(quote.quoteId || '').replace(/^COT-/, '').padStart(6, '0');
}

function nextQuoteId_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.spreadsheetId).getSheetByName(CONFIG.sheets.quotes);
    const lastRow = sheet.getLastRow();
    let max = 0;
    if (lastRow > 1) {
      const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
      values.forEach((value) => {
        const match = String(value || '').match(/(\d+)/);
        if (match) max = Math.max(max, Number(match[1]) || 0);
      });
    }
    return `COT-${String(max + 1).padStart(6, '0')}`;
  } finally {
    lock.releaseLock();
  }
}

function formatDateEs_(value) {
  const date = value instanceof Date ? value : new Date(value || new Date());
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd/MM/yyyy');
}

function saveQuote_(quote, pdfUrl) {
  const sheet = SpreadsheetApp.openById(CONFIG.spreadsheetId).getSheetByName(CONFIG.sheets.quotes);
  sheet.appendRow([
    quote.quoteId,
    quote.createdAt,
    quote.cliente,
    quote.documento,
    quote.correo,
    quote.telefono,
    quote.tecnico,
    quote.tipoInstalacion,
    quote.distancia,
    quote.factor,
    quote.manoObra,
    quote.visita,
    quote.transporte,
    quote.adicionales,
    quote.adicionalFueraLima,
    quote.subtotal,
    quote.igv,
    quote.total,
    pdfUrl,
    'PENDIENTE_RAUL',
  ]);
  applySheetDesign_();
}

function applySheetDesign_() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  styleConfigSheet_(ss.getSheetByName(CONFIG.sheets.config));
  styleCatalogSheet_(ss.getSheetByName(CONFIG.sheets.catalog));
  styleQuotesSheet_(ss.getSheetByName(CONFIG.sheets.quotes));
}

function styleConfigSheet_(sheet) {
  if (!sheet) return;
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const lastColumn = Math.max(sheet.getLastColumn(), 2);
  sheet.getRange(1, 1, lastRow, lastColumn).setFontFamily('Arial').setVerticalAlignment('middle');
  sheet.getRange(1, 1, 1, lastColumn)
    .setBackground('#111111')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
  sheet.getRange(2, 1, lastRow - 1, 1)
    .setBackground('#f5e8d4')
    .setFontWeight('bold');
  sheet.getRange('B2').setNumberFormat('0.00%');
  sheet.setColumnWidths(1, 2, 220);
  sheet.setFrozenRows(1);
}

function styleCatalogSheet_(sheet) {
  if (!sheet) return;
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const lastColumn = Math.max(sheet.getLastColumn(), 5);
  sheet.getRange(1, 1, lastRow, lastColumn).setFontFamily('Arial').setVerticalAlignment('middle');
  sheet.getRange(1, 1, 1, lastColumn)
    .setBackground('#111111')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, lastColumn).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
    sheet.getRange(2, 3, lastRow - 1, 2).setNumberFormat('"S/" #,##0.00');
  }
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, 1, 260);
  sheet.setColumnWidths(2, 1, 100);
  sheet.setColumnWidths(3, 2, 130);
  sheet.setColumnWidths(5, 1, 280);
  if (!sheet.getFilter() && lastRow > 1) sheet.getRange(1, 1, lastRow, lastColumn).createFilter();
}

function styleQuotesSheet_(sheet) {
  if (!sheet) return;
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const lastColumn = Math.max(sheet.getLastColumn(), QUOTE_COLUMNS.length);
  sheet.getRange(1, 1, lastRow, lastColumn).setFontFamily('Arial').setVerticalAlignment('middle');
  sheet.getRange(1, 1, 1, lastColumn)
    .setBackground('#111111')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setWrap(true);
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 36);
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, lastColumn).setWrap(true);
    sheet.getRange(2, 2, lastRow - 1, 1).setNumberFormat('dd/mm/yyyy hh:mm');
    sheet.getRange(2, 9, lastRow - 1, 1).setNumberFormat('0.0');
    sheet.getRange(2, 10, lastRow - 1, 1).setNumberFormat('0.0x');
    sheet.getRange(2, 11, lastRow - 1, 8).setNumberFormat('"S/" #,##0.00');
    sheet.getRange(2, 19, lastRow - 1, 1).setFontColor('#1155cc').setUnderline(true);
    const statusRange = sheet.getRange(2, 20, lastRow - 1, 1);
    const statuses = statusRange.getValues();
    const backgrounds = statuses.map(([value]) => {
      if (String(value || '').toUpperCase() === 'PENDIENTE_RAUL') return ['#fce8b2'];
      if (String(value || '').toUpperCase() === 'APROBADO') return ['#c8ead6'];
      if (String(value || '').toUpperCase() === 'OBSERVADO') return ['#f4c7c3'];
      return ['#e8eaed'];
    });
    statusRange.setBackgrounds(backgrounds).setFontWeight('bold');
    sheet.getRange(2, 18, lastRow - 1, 1).setBackground('#eef7ea').setFontWeight('bold');
  }
  const widths = [150,140,220,120,220,120,140,130,130,110,120,120,150,120,140,120,90,120,200,140];
  widths.forEach((width, index) => sheet.setColumnWidth(index + 1, width));
  if (!sheet.getFilter() && lastRow > 1) sheet.getRange(1, 1, lastRow, lastColumn).createFilter();
}

function notifyReview_(quote, pdfUrl) {
  const subject = `MVP cotización instalación EVINKA - ${quote.cliente}`;
  const body = [
    `Hola Raúl,`,
    '',
    `Se generó una nueva cotización MVP para revisión.`,
    '',
    `Cliente: ${quote.cliente}`,
    `Técnico: ${quote.tecnico}`,
    `Total: S/ ${Number(quote.total || 0).toFixed(2)}`,
    `PDF: ${pdfUrl}`,
    '',
    'Revisar antes de envío al cliente.',
  ].join('\n');
  MailApp.sendEmail({ to: CONFIG.reviewEmail, cc: CONFIG.ownerEmail, subject, body });
}

function getConfig_() {
  const sheet = SpreadsheetApp.openById(CONFIG.spreadsheetId).getSheetByName(CONFIG.sheets.config);
  const values = sheet.getDataRange().getValues().slice(1);
  return values.reduce((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
}

function getCatalogMap_() {
  const sheet = SpreadsheetApp.openById(CONFIG.spreadsheetId).getSheetByName(CONFIG.sheets.catalog);
  const values = sheet.getDataRange().getValues().slice(1);
  return values.reduce((acc, row) => {
    acc[row[0]] = row[2];
    return acc;
  }, {});
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function number_(value) {
  if (typeof value === 'number') return value;
  const normalized = String(value || '').replace(/[^0-9.,-]/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function slug_(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function escapeHtmlHtml_(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function extractGoogleId_(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const match = raw.match(/\/d\/([a-zA-Z0-9-_]+)/) || raw.match(/\/forms\/d\/e\/([a-zA-Z0-9-_]+)/) || raw.match(/^([a-zA-Z0-9-_]{20,})$/);
  return match ? match[1] : raw;
}

function setConfigValue_(sheet, key, value) {
  const values = sheet.getRange(1, 1, sheet.getLastRow(), 2).getValues();
  const idx = values.findIndex((row, i) => i > 0 && String(row[0] || '').trim() === key);
  if (idx === -1) throw new Error(`No encontré la clave ${key} en CONFIG.`);
  sheet.getRange(idx + 1, 2).setValue(value);
}

function resolveFormIdFromConfig_(ss) {
  const config = getConfig_();
  const candidates = [config.FORM_ID, config.FORM_EDIT_URL, config.FORM_PUBLISHED_URL]
    .map((value) => extractGoogleId_(value || ''))
    .filter(Boolean);
  for (const candidate of candidates) {
    try {
      FormApp.openById(candidate);
      return candidate;
    } catch (error) {}
  }
  const rawSheet = ss.getSheets().find((sheet) => sheet.getFormUrl && sheet.getFormUrl());
  if (rawSheet) {
    const fallbackId = extractGoogleId_(rawSheet.getFormUrl());
    if (fallbackId) return fallbackId;
  }
  return '';
}
