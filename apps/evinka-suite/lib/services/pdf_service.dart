import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import '../models/installation_order_model.dart';
import '../models/protocolo_model.dart';

class PdfService {
  static Future<Uint8List> generarPdf(ProtocoloModel data) async {
    final pdf = pw.Document();

    final watermarkData = await rootBundle.load('assets/watermark.jpeg');
    final watermarkImage = pw.MemoryImage(watermarkData.buffer.asUint8List());

    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(32),
        build: (pw.Context context) {
          return pw.Stack(
            children: [
              pw.Positioned(
                left: -32,
                top: -32,
                child: pw.Opacity(
                  opacity: 0.85,
                  child: pw.Image(watermarkImage,
                      width: 595, height: 842, fit: pw.BoxFit.fill),
                ),
              ),
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  _titulo(),
                  pw.SizedBox(height: 30),
                  _fechaRow(data.fecha),
                  pw.SizedBox(height: 6),
                  _metaOperacion(data),
                  pw.Divider(thickness: 1.5),
                  pw.SizedBox(height: 4),
                  _seccion('DATOS DEL CLIENTE / REPRESENTANTE'),
                  pw.SizedBox(height: 4),
                  _campoLinea('Cliente', data.cliente),
                  pw.SizedBox(height: 4),
                  _dosColumnas(
                      'RUC o DNI', data.ruc, 'Correo', data.clientEmail),
                  pw.SizedBox(height: 4),
                  _campoLinea('Dirección', data.direccion),
                  pw.SizedBox(height: 8),
                  pw.Divider(thickness: 0.8),
                  _seccion('OBSERVACIONES / RECOMENDACIONES'),
                  pw.SizedBox(height: 4),
                  _cuadroTexto(data.observaciones),
                  pw.SizedBox(height: 8),
                  pw.Divider(thickness: 0.8),
                  _seccion('PARÁMETROS DE INSTALACIÓN'),
                  pw.SizedBox(height: 4),
                  _dosColumnas('Marca', data.marca, 'N/S', data.numeroSerie),
                  pw.SizedBox(height: 4),
                  _parametrosRow(data),
                  pw.SizedBox(height: 8),
                  pw.Divider(thickness: 0.8),
                  _seccion('IMPLEMENTOS ENTREGADOS AL CLIENTE/REPRESENTANTE'),
                  pw.SizedBox(height: 4),
                  _implementos(data),
                  pw.SizedBox(height: 8),
                  pw.Divider(thickness: 0.8),
                  pw.SizedBox(height: 4),
                  _textoLegal(),
                  pw.SizedBox(height: 20),
                  _firmas(data),
                ],
              ),
            ],
          );
        },
      ),
    );

    final tieneFotos = (data.foto1 != null && data.foto1!.isNotEmpty) ||
        (data.foto2 != null && data.foto2!.isNotEmpty);

    if (tieneFotos) {
      pdf.addPage(
        pw.Page(
          pageFormat: PdfPageFormat.a4,
          margin: const pw.EdgeInsets.all(32),
          build: (pw.Context context) {
            return pw.Stack(
              children: [
                pw.Positioned(
                  left: -32,
                  top: -32,
                  child: pw.Opacity(
                    opacity: 0.85,
                    child: pw.Image(watermarkImage,
                        width: 595, height: 842, fit: pw.BoxFit.fill),
                  ),
                ),
                pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.center,
                  children: [
                    pw.Center(
                      child: pw.Text(
                        'REGISTRO FOTOGRÁFICO DE LA INSTALACIÓN',
                        style: pw.TextStyle(
                            fontSize: 13, fontWeight: pw.FontWeight.bold),
                      ),
                    ),
                    pw.SizedBox(height: 6),
                    pw.Divider(thickness: 1.5),
                    pw.SizedBox(height: 16),
                    if (data.foto1 != null && data.foto1!.isNotEmpty) ...[
                      pw.Text('Foto 1',
                          style: pw.TextStyle(
                              fontWeight: pw.FontWeight.bold, fontSize: 10)),
                      pw.SizedBox(height: 6),
                      pw.Center(
                        child: pw.ConstrainedBox(
                          constraints: const pw.BoxConstraints(
                              maxHeight: 300, maxWidth: 500),
                          child: pw.Image(
                            pw.MemoryImage(Uint8List.fromList(data.foto1!)),
                            fit: pw.BoxFit.contain,
                          ),
                        ),
                      ),
                      pw.SizedBox(height: 20),
                    ],
                    if (data.foto2 != null && data.foto2!.isNotEmpty) ...[
                      pw.Text('Foto 2',
                          style: pw.TextStyle(
                              fontWeight: pw.FontWeight.bold, fontSize: 10)),
                      pw.SizedBox(height: 6),
                      pw.Center(
                        child: pw.ConstrainedBox(
                          constraints: const pw.BoxConstraints(
                              maxHeight: 300, maxWidth: 500),
                          child: pw.Image(
                            pw.MemoryImage(Uint8List.fromList(data.foto2!)),
                            fit: pw.BoxFit.contain,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            );
          },
        ),
      );
    }

    return pdf.save();
  }

  static pw.Widget _titulo() {
    return pw.Center(
      child: pw.Text(
        'PROTOCOLO DE INSTALACIÓN DE CARGADOR',
        style: pw.TextStyle(
          fontSize: 14,
          fontWeight: pw.FontWeight.bold,
        ),
      ),
    );
  }

  static pw.Widget _fechaRow(String fecha) {
    return pw.Row(
      mainAxisAlignment: pw.MainAxisAlignment.end,
      children: [
        pw.Text('Fecha: ', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
        pw.Text(fecha),
      ],
    );
  }

  static pw.Widget _metaOperacion(ProtocoloModel data) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.end,
      children: [
        if (data.quoteId.isNotEmpty)
          pw.Text('Cotización: ${data.quoteId}',
              style: const pw.TextStyle(fontSize: 9)),
        if (data.installationOrderId.isNotEmpty)
          pw.Text('Orden: ${data.installationOrderId}',
              style: const pw.TextStyle(fontSize: 9)),
        if (data.commercialProfileName.isNotEmpty)
          pw.Text('Perfil comercial: ${data.commercialProfileName}',
              style: const pw.TextStyle(fontSize: 9)),
      ],
    );
  }

  static pw.Widget _seccion(String titulo) {
    return pw.Container(
      color: PdfColors.grey300,
      padding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      child: pw.Text(
        titulo,
        style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10),
      ),
    );
  }

  static pw.Widget _campoLinea(String label, String valor) {
    return pw.Row(
      children: [
        pw.Text('$label: ',
            style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10)),
        pw.Expanded(
          child: pw.Container(
            decoration: const pw.BoxDecoration(
              border: pw.Border(bottom: pw.BorderSide(width: 0.5)),
            ),
            child: pw.Text(valor, style: const pw.TextStyle(fontSize: 10)),
          ),
        ),
      ],
    );
  }

  static pw.Widget _dosColumnas(String l1, String v1, String l2, String v2) {
    return pw.Row(
      children: [
        pw.Expanded(child: _campoLinea(l1, v1)),
        pw.SizedBox(width: 12),
        pw.Expanded(child: _campoLinea(l2, v2)),
      ],
    );
  }

  static pw.Widget _cuadroTexto(String texto) {
    return pw.Container(
      width: double.infinity,
      height: 60,
      padding: const pw.EdgeInsets.all(4),
      decoration: pw.BoxDecoration(
        border: pw.Border.all(width: 0.5),
      ),
      child: pw.Text(texto, style: const pw.TextStyle(fontSize: 10)),
    );
  }

  static pw.Widget _parametrosRow(ProtocoloModel data) {
    return pw.Row(
      children: [
        pw.Expanded(child: _campoLinea('Volt.', data.voltaje)),
        pw.SizedBox(width: 8),
        pw.Expanded(child: _campoLinea('Amp.', data.amperaje)),
        pw.SizedBox(width: 8),
        pw.Expanded(child: _campoLinea('Otro', data.otro)),
        pw.SizedBox(width: 8),
        pw.Expanded(child: _campoLinea('Potencia kW', data.potenciaKw)),
      ],
    );
  }

  static pw.Widget _implementos(ProtocoloModel data) {
    final items = [
      ('Caja del cargador', data.cajaCargador),
      ('Cargador Evinka', data.cargadorEvinka),
      ('Manual del cargador', data.manualCargador),
      ('Tarjetas del cargador', data.tarjetasCargador),
      ('Adicional: ${data.adicionalDesc}', data.adicional),
    ];

    return pw.Column(
      children: items.map((item) {
        return pw.Padding(
          padding: const pw.EdgeInsets.symmetric(vertical: 2),
          child: pw.Row(
            children: [
              pw.Expanded(
                flex: 4,
                child:
                    pw.Text(item.$1, style: const pw.TextStyle(fontSize: 10)),
              ),
              _checkBox(item.$2, 'Sí'),
              pw.SizedBox(width: 8),
              _checkBox(!item.$2, 'No'),
            ],
          ),
        );
      }).toList(),
    );
  }

  static pw.Widget _checkBox(bool checked, String label) {
    return pw.Row(
      children: [
        pw.Container(
          width: 12,
          height: 12,
          decoration: pw.BoxDecoration(
            border: pw.Border.all(width: 0.8),
            color: checked ? PdfColors.black : PdfColors.white,
          ),
          child: checked
              ? pw.Center(
                  child: pw.Text('✓',
                      style: pw.TextStyle(
                          fontSize: 8,
                          color: PdfColors.white,
                          fontWeight: pw.FontWeight.bold)))
              : null,
        ),
        pw.SizedBox(width: 3),
        pw.Text(label, style: const pw.TextStyle(fontSize: 10)),
      ],
    );
  }

  static pw.Widget _textoLegal() {
    return pw.Text(
      'El Cliente/Responsable está de acuerdo con los puntos indicados en el documento, acepta estar conforme con la instalación, operación y entrega de implementos del cargador además da su consentimiento para el registro fotográfico de la instalación y entrega de implementos.',
      style: const pw.TextStyle(fontSize: 9),
      textAlign: pw.TextAlign.justify,
    );
  }

  static pw.Widget _firmas(ProtocoloModel data) {
    return pw.Row(
      mainAxisAlignment: pw.MainAxisAlignment.spaceAround,
      children: [
        _bloqueFirema(
            'Firma del responsable de la instalación', data.firmaInstalador),
        _bloqueFirema('Firma del Cliente/Representante', data.firmaCliente),
      ],
    );
  }

  static pw.Widget _bloqueFirema(String label, List<int>? firmaBytes) {
    return pw.Column(
      children: [
        if (firmaBytes != null && firmaBytes.isNotEmpty)
          pw.Container(
            width: 160,
            height: 60,
            child: pw.Image(pw.MemoryImage(Uint8List.fromList(firmaBytes))),
          )
        else
          pw.Container(
            width: 160,
            height: 60,
            decoration: const pw.BoxDecoration(
              border: pw.Border(bottom: pw.BorderSide(width: 0.8)),
            ),
          ),
        pw.SizedBox(height: 4),
        pw.Text(label, style: const pw.TextStyle(fontSize: 9)),
      ],
    );
  }

  static Future<Uint8List> generarGarantiaPdf(
    ProtocoloModel data, {
    InstallationOrderModel? order,
  }) async {
    final pdf = pw.Document();
    final logoData = await rootBundle.load('assets/logo.png');
    final watermarkData = await rootBundle.load('assets/watermark.jpeg');
    final logo = pw.MemoryImage(logoData.buffer.asUint8List());
    final watermark = pw.MemoryImage(watermarkData.buffer.asUint8List());

    final fechaInstalacion = _parseFecha(data.fecha);
    final fechaVigencia = DateTime(
      fechaInstalacion.year + 2,
      fechaInstalacion.month,
      fechaInstalacion.day,
    );
    final vigenciaTexto = DateFormat('dd/MM/yyyy').format(fechaVigencia);
    final codigoGarantia = _buildWarrantyCode(data, order);
    final producto = _productName(data, order);
    final modelo = _productModel(data, order);
    final soporteCorreo = 'soporte@evinka.tech';
    final soporteTelefono = '+51 999 999 999';
    final ciudad =
        (order?.city.isNotEmpty ?? false) ? order!.city : 'Lima, Perú';

    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        margin: pw.EdgeInsets.zero,
        build: (context) {
          return pw.Stack(
            children: [
              pw.Positioned.fill(
                child: pw.Opacity(
                  opacity: 0.045,
                  child: pw.Image(watermark, fit: pw.BoxFit.cover),
                ),
              ),
              pw.Container(
                color: PdfColors.white,
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    _garantiaHeader(
                      logo: logo,
                      codigoGarantia: codigoGarantia,
                      ciudad: ciudad,
                      vigencia: vigenciaTexto,
                    ),
                    pw.Padding(
                      padding: const pw.EdgeInsets.fromLTRB(36, 18, 36, 0),
                      child: pw.Row(
                        crossAxisAlignment: pw.CrossAxisAlignment.start,
                        children: [
                          pw.Expanded(
                            flex: 5,
                            child: _garantiaInfoEquipo(
                              producto: producto,
                              modelo: modelo,
                              serie: data.numeroSerie,
                              fechaInstalacion: data.fecha,
                              vigencia: vigenciaTexto,
                            ),
                          ),
                          pw.SizedBox(width: 16),
                          pw.Expanded(
                            flex: 4,
                            child: _garantiaProductCard(data, order),
                          ),
                        ],
                      ),
                    ),
                    pw.Padding(
                      padding: const pw.EdgeInsets.fromLTRB(36, 14, 36, 0),
                      child: _garantiaClienteBlock(data, order),
                    ),
                    pw.Padding(
                      padding: const pw.EdgeInsets.fromLTRB(36, 14, 36, 0),
                      child: pw.Row(
                        crossAxisAlignment: pw.CrossAxisAlignment.start,
                        children: [
                          pw.Expanded(
                            child: _legalCard(
                              number: '3',
                              title: 'Validación inicial de seguridad',
                              text:
                                  'Previo a la emisión de este certificado, EVINKA valida la identificación visible del equipo, la correspondencia de serie, el punto de instalación y la revisión visual inicial de energización, fijación, entorno y cableado accesible.',
                              fill: const PdfColor(0.97, 0.985, 1),
                              stroke: const PdfColor(0.86, 0.91, 0.96),
                            ),
                          ),
                          pw.SizedBox(width: 14),
                          pw.Expanded(
                            child: _legalCard(
                              number: '4',
                              title: 'Condiciones base de operación',
                              text:
                                  'La operación segura del equipo exige uso conforme a la capacidad instalada, área libre de manipulación indebida, ausencia de humedad directa, acceso razonable para mantenimiento y conservación del presente certificado para trazabilidad futura.',
                              fill: const PdfColor(1, 0.98, 0.95),
                              stroke: const PdfColor(0.95, 0.87, 0.78),
                            ),
                          ),
                        ],
                      ),
                    ),
                    pw.Spacer(),
                    pw.Padding(
                      padding: const pw.EdgeInsets.fromLTRB(36, 0, 36, 24),
                      child: pw.Center(
                        child: pw.Text(
                          'EVINKA · Documento emitido para control de garantía y trazabilidad del equipo instalado.',
                          style: pw.TextStyle(
                              fontSize: 8.5, color: PdfColors.grey700),
                          textAlign: pw.TextAlign.center,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );

    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        margin: pw.EdgeInsets.zero,
        build: (context) {
          return pw.Container(
            color: PdfColors.white,
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                _garantiaSubHeader(logo, 'ALCANCE Y SEGURIDAD', producto),
                pw.Padding(
                  padding: const pw.EdgeInsets.fromLTRB(36, 22, 36, 0),
                  child: _legalWideCard(
                    number: '5',
                    title: 'Alcance oficial de la garantía',
                    text:
                        'EVINKA certifica que el equipo identificado en este documento cuenta con cobertura de garantía comercial limitada por dos años, válida desde la fecha de instalación y sujeta al cumplimiento de las condiciones técnicas, eléctricas, operativas y de seguridad establecidas por la marca.',
                    fill: const PdfColor(1, 0.98, 0.95),
                    stroke: const PdfColor(0.95, 0.87, 0.78),
                  ),
                ),
                pw.Padding(
                  padding: const pw.EdgeInsets.fromLTRB(36, 14, 36, 0),
                  child: pw.Row(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Expanded(
                        child: _bulletCard(
                          title: 'Cobertura incluida',
                          color: PdfColors.green800,
                          fill: const PdfColor(0.95, 0.985, 0.97),
                          items: data.marca.toLowerCase().contains('alien')
                              ? [
                                  'Defectos de fabricación del cargador, tarjeta de control, pantalla e interfaz principal.',
                                  'Fallas de operación del equipo bajo uso normal conforme a la ficha técnica y protocolo de instalación EVINKA.',
                                  'Diagnóstico técnico, validación de serie y atención inicial de postventa dentro del periodo de vigencia.',
                                ]
                              : [
                                  'Defectos de fabricación del cargador y de sus componentes electrónicos principales.',
                                  'Fallas funcionales del equipo bajo uso normal y dentro de las condiciones eléctricas recomendadas por EVINKA.',
                                  'Evaluación técnica inicial y validación del diagnóstico durante la vigencia de la garantía.',
                                ],
                        ),
                      ),
                      pw.SizedBox(width: 14),
                      pw.Expanded(
                        child: _bulletCard(
                          title: 'Exclusiones principales',
                          color: PdfColors.red800,
                          fill: const PdfColor(1, 0.97, 0.96),
                          items: [
                            'Manipulación interna no autorizada, intervención de terceros o alteración posterior a la instalación.',
                            'Daños por sobretensión, acometida deficiente, humedad, inundación, incendio o agentes externos.',
                            'Uso indebido, ausencia de protecciones eléctricas o condiciones incompatibles con la instalación recomendada.',
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                pw.Padding(
                  padding: const pw.EdgeInsets.fromLTRB(36, 14, 36, 0),
                  child: _legalWideCard(
                    number: '6',
                    title: 'Condiciones específicas de seguridad',
                    text:
                        'Para preservar la cobertura, el equipo debe operar con protecciones eléctricas acordes a la instalación, puesta a tierra funcional, ausencia de humedad directa, ventilación razonable y sin intervención interna no autorizada. EVINKA podrá observar la integridad visible del gabinete, conectores, fijaciones, acometida, entorno inmediato de uso y evidencias de manipulación o sobrecarga.',
                    fill: const PdfColor(0.97, 0.985, 1),
                    stroke: const PdfColor(0.86, 0.91, 0.96),
                  ),
                ),
                pw.Padding(
                  padding: const pw.EdgeInsets.fromLTRB(36, 14, 36, 0),
                  child: _legalWideCard(
                    number: '7',
                    title: 'Condiciones de validez',
                    text:
                        'La presente garantía aplica únicamente al equipo cuyo número de serie figura en este certificado. Para su validez, el cargador debe conservar identificación legible, haber sido instalado por EVINKA o por personal autorizado y operar dentro de los parámetros eléctricos recomendados. La cobertura no sustituye daños causados por terceros, alteraciones posteriores de la instalación, uso inadecuado ni eventos externos fuera del control de la marca.',
                    fill: PdfColors.white,
                    stroke: const PdfColor(0.89, 0.92, 0.95),
                  ),
                ),
                pw.Spacer(),
                pw.Padding(
                  padding: const pw.EdgeInsets.fromLTRB(36, 0, 36, 24),
                  child: pw.Center(
                    child: pw.Text(
                      'EVINKA · Página de alcance, seguridad y condiciones técnicas de cobertura.',
                      style:
                          pw.TextStyle(fontSize: 8.5, color: PdfColors.grey700),
                      textAlign: pw.TextAlign.center,
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );

    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        margin: pw.EdgeInsets.zero,
        build: (context) {
          return pw.Container(
            color: PdfColors.white,
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                _garantiaSubHeader(logo, 'ATENCIÓN Y DISPOSICIONES', producto),
                pw.Padding(
                  padding: const pw.EdgeInsets.fromLTRB(36, 22, 36, 0),
                  child: _stepsCard(
                    number: '8',
                    title: 'Procedimiento de atención',
                    steps: [
                      'El cliente reporta la incidencia indicando el código de garantía, número de serie y descripción concreta del evento observado.',
                      'EVINKA valida antecedentes, evidencia fotográfica, condiciones de seguridad y consistencia entre equipo, dirección e instalación registrada.',
                      'De corresponder cobertura, se coordina diagnóstico, reparación, reposición de componente o solución técnica equivalente según evaluación.',
                    ],
                  ),
                ),
                pw.Padding(
                  padding: const pw.EdgeInsets.fromLTRB(36, 14, 36, 0),
                  child: _garantiaRegistroBlock(
                    data,
                    codigoGarantia,
                    ciudad,
                    soporteCorreo,
                    soporteTelefono,
                  ),
                ),
                pw.Padding(
                  padding: const pw.EdgeInsets.fromLTRB(36, 14, 36, 0),
                  child: _garantiaValidationBlock(data),
                ),
                pw.Padding(
                  padding: const pw.EdgeInsets.fromLTRB(36, 14, 36, 0),
                  child: pw.Row(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Expanded(
                        child: _legalCard(
                          number: '10',
                          title: 'Disposiciones complementarias',
                          text:
                              'La atención de garantía podrá requerir validación del código de garantía, número de serie legible, evidencia fotográfica y verificación de las condiciones de instalación.',
                          fill: const PdfColor(0.97, 0.985, 1),
                          stroke: const PdfColor(0.86, 0.91, 0.96),
                        ),
                      ),
                      pw.SizedBox(width: 14),
                      pw.Expanded(
                        child: _legalCard(
                          number: '11',
                          title: 'Protección del consumidor',
                          text:
                              'La garantía comercial EVINKA no limita los derechos reconocidos al consumidor por la normativa aplicable y excluye manipulación no autorizada, terceros y eventos externos ajenos al control de la marca.',
                          fill: const PdfColor(1, 0.98, 0.95),
                          stroke: const PdfColor(0.95, 0.87, 0.78),
                        ),
                      ),
                    ],
                  ),
                ),
                pw.Padding(
                  padding: const pw.EdgeInsets.fromLTRB(36, 14, 36, 0),
                  child: _legalWideCard(
                    number: '12',
                    title: 'Canales de atención sugeridos',
                    text:
                        'Soporte EVINKA, validación de serie, registro fotográfico del equipo, dirección de instalación, fecha de puesta en servicio y evidencia de la incidencia reportada por el titular.',
                    fill: const PdfColor(0.97, 0.98, 0.99),
                    stroke: const PdfColor(0.89, 0.92, 0.95),
                  ),
                ),
                pw.Spacer(),
                pw.Padding(
                  padding: const pw.EdgeInsets.fromLTRB(36, 0, 36, 24),
                  child: pw.Center(
                    child: pw.Text(
                      'EVINKA · Garantía corporativa de 2 años en 3 páginas con estructura documental estable.',
                      style:
                          pw.TextStyle(fontSize: 8.5, color: PdfColors.grey700),
                      textAlign: pw.TextAlign.center,
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );

    return pdf.save();
  }

  static DateTime _parseFecha(String value) {
    try {
      return DateFormat('dd/MM/yyyy').parseStrict(value);
    } catch (_) {
      return DateTime.now();
    }
  }

  static String _buildWarrantyCode(
    ProtocoloModel data,
    InstallationOrderModel? order,
  ) {
    final raw = (data.installationOrderId.isNotEmpty
            ? data.installationOrderId
            : order?.id ?? DateTime.now().millisecondsSinceEpoch.toString())
        .replaceAll(RegExp(r'[^A-Za-z0-9]'), '')
        .toUpperCase();
    final tail = raw.length > 8 ? raw.substring(raw.length - 8) : raw;
    return 'EVK-GAR-${DateTime.now().year}-$tail';
  }

  static String _productName(
      ProtocoloModel data, InstallationOrderModel? order) {
    final source = '${data.marca} ${order?.chargerBrand ?? ''}'.toLowerCase();
    return source.contains('alien') ? 'EVINKA Alien X' : 'EVINKA MiniBox';
  }

  static String _productModel(
      ProtocoloModel data, InstallationOrderModel? order) {
    final source = '${data.marca} ${order?.chargerBrand ?? ''}'.toLowerCase();
    return source.contains('alien')
        ? 'Alien X Smart AC ${data.potenciaKw.isNotEmpty ? data.potenciaKw : order?.powerKw ?? ''} kW'
        : 'MiniBox Smart AC ${data.potenciaKw.isNotEmpty ? data.potenciaKw : order?.powerKw ?? ''} kW';
  }

  static pw.Widget _garantiaHeader({
    required pw.MemoryImage logo,
    required String codigoGarantia,
    required String ciudad,
    required String vigencia,
  }) {
    return pw.Container(
      height: 126,
      decoration: const pw.BoxDecoration(
        color: PdfColor(0.07, 0.11, 0.21),
      ),
      child: pw.Stack(
        children: [
          pw.Positioned(
            left: 0,
            top: 0,
            right: 0,
            child: pw.Container(
                height: 12, color: const PdfColor(0.78, 0.60, 0.36)),
          ),
          pw.Padding(
            padding: const pw.EdgeInsets.fromLTRB(36, 34, 36, 0),
            child: pw.Row(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Container(
                  width: 56,
                  height: 56,
                  decoration: pw.BoxDecoration(
                    color: PdfColors.white,
                    borderRadius: pw.BorderRadius.circular(16),
                  ),
                  padding: const pw.EdgeInsets.all(10),
                  child: pw.Image(logo),
                ),
                pw.SizedBox(width: 16),
                pw.Expanded(
                  child: pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text(
                        'CERTIFICADO DE GARANTÍA',
                        style: pw.TextStyle(
                          color: PdfColors.white,
                          fontSize: 22,
                          fontWeight: pw.FontWeight.bold,
                        ),
                      ),
                      pw.SizedBox(height: 4),
                      pw.Text(
                        'Documento oficial de respaldo comercial y técnico EVINKA',
                        style: const pw.TextStyle(
                          color: PdfColor(0.84, 0.87, 0.91),
                          fontSize: 10.5,
                        ),
                      ),
                      pw.SizedBox(height: 8),
                      pw.Text(
                        'CÓDIGO $codigoGarantia',
                        style: pw.TextStyle(
                          color: const PdfColor(0.91, 0.82, 0.70),
                          fontSize: 10,
                          fontWeight: pw.FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
                pw.Container(
                  width: 176,
                  padding: const pw.EdgeInsets.all(12),
                  decoration: pw.BoxDecoration(
                    color: const PdfColor(0.11, 0.16, 0.30),
                    borderRadius: pw.BorderRadius.circular(14),
                    border:
                        pw.Border.all(color: const PdfColor(0.91, 0.82, 0.70)),
                  ),
                  child: pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text(
                        'EMISIÓN Y VIGENCIA',
                        style: pw.TextStyle(
                          color: const PdfColor(0.91, 0.82, 0.70),
                          fontSize: 8.2,
                          fontWeight: pw.FontWeight.bold,
                        ),
                      ),
                      pw.SizedBox(height: 6),
                      pw.Text('Emitido en $ciudad',
                          style: const pw.TextStyle(
                              color: PdfColors.white, fontSize: 9.6)),
                      pw.SizedBox(height: 3),
                      pw.Text('Vigencia hasta $vigencia',
                          style: const pw.TextStyle(
                              color: PdfColors.white, fontSize: 9.6)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _garantiaSubHeader(
    pw.MemoryImage logo,
    String title,
    String subtitle,
  ) {
    return pw.Container(
      height: 88,
      decoration: const pw.BoxDecoration(
        color: PdfColor(0.07, 0.11, 0.21),
      ),
      child: pw.Stack(
        children: [
          pw.Positioned(
            left: 0,
            top: 0,
            right: 0,
            child: pw.Container(
                height: 10, color: const PdfColor(0.78, 0.60, 0.36)),
          ),
          pw.Padding(
            padding: const pw.EdgeInsets.fromLTRB(36, 28, 36, 0),
            child: pw.Row(
              children: [
                pw.SizedBox(width: 30, height: 30, child: pw.Image(logo)),
                pw.SizedBox(width: 12),
                pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text(title,
                        style: pw.TextStyle(
                            color: PdfColors.white,
                            fontSize: 18,
                            fontWeight: pw.FontWeight.bold)),
                    pw.SizedBox(height: 4),
                    pw.Text(subtitle,
                        style: const pw.TextStyle(
                            color: PdfColor(0.84, 0.87, 0.91), fontSize: 9.6)),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _garantiaInfoEquipo({
    required String producto,
    required String modelo,
    required String serie,
    required String fechaInstalacion,
    required String vigencia,
  }) {
    return pw.Container(
      padding: const pw.EdgeInsets.all(18),
      decoration: pw.BoxDecoration(
        color: PdfColors.white,
        borderRadius: pw.BorderRadius.circular(18),
        border: pw.Border.all(color: const PdfColor(0.89, 0.92, 0.95)),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          _sectionCaption('1', 'Identificación del equipo'),
          pw.SizedBox(height: 14),
          _pairRow('Producto', producto, 'Modelo', modelo),
          pw.SizedBox(height: 10),
          _pairRow('Serie', serie.isNotEmpty ? serie : 'No registrada',
              'Instalación', fechaInstalacion),
          pw.SizedBox(height: 10),
          _singleLine('Vigencia', '2 años · hasta $vigencia'),
        ],
      ),
    );
  }

  static pw.Widget _garantiaProductCard(
      ProtocoloModel data, InstallationOrderModel? order) {
    final source = '${data.marca} ${order?.chargerBrand ?? ''}'.toLowerCase();
    return pw.Container(
      padding: const pw.EdgeInsets.all(16),
      decoration: pw.BoxDecoration(
        color: const PdfColor(0.95, 0.97, 0.99),
        borderRadius: pw.BorderRadius.circular(18),
        border: pw.Border.all(color: const PdfColor(0.86, 0.91, 0.96)),
      ),
      child: pw.Column(
        children: [
          pw.Container(
            height: 170,
            alignment: pw.Alignment.center,
            child: pw.Text(
              source.contains('alien') ? 'Alien X' : 'MiniBox',
              style: pw.TextStyle(
                  fontSize: 28,
                  fontWeight: pw.FontWeight.bold,
                  color: const PdfColor(0.07, 0.11, 0.21)),
            ),
          ),
          pw.Text('Equipo certificado EVINKA',
              style: pw.TextStyle(
                  fontSize: 10.2,
                  fontWeight: pw.FontWeight.bold,
                  color: const PdfColor(0.10, 0.16, 0.30))),
          pw.SizedBox(height: 4),
          pw.Text('Referencia visual validada para esta garantía',
              style: const pw.TextStyle(
                  fontSize: 8.5, color: PdfColor(0.40, 0.44, 0.50))),
        ],
      ),
    );
  }

  static pw.Widget _garantiaClienteBlock(
      ProtocoloModel data, InstallationOrderModel? order) {
    return pw.Container(
      padding: const pw.EdgeInsets.all(18),
      decoration: pw.BoxDecoration(
        color: PdfColors.white,
        borderRadius: pw.BorderRadius.circular(18),
        border: pw.Border.all(color: const PdfColor(0.89, 0.92, 0.95)),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          _sectionCaption('2', 'Titular y ubicación de instalación'),
          pw.SizedBox(height: 14),
          _tripleRow(
              'Titular',
              data.cliente,
              'Documento',
              data.ruc,
              'Instalado por',
              order?.assignedTechnician.isNotEmpty == true
                  ? order!.assignedTechnician
                  : 'EVINKA · Unidad técnica certificada'),
          pw.SizedBox(height: 10),
          _singleLine(
              'Dirección de instalación',
              data.direccion.isNotEmpty
                  ? data.direccion
                  : order?.address ?? ''),
        ],
      ),
    );
  }

  static pw.Widget _garantiaRegistroBlock(
    ProtocoloModel data,
    String codigoGarantia,
    String ciudad,
    String soporteCorreo,
    String soporteTelefono,
  ) {
    return pw.Container(
      padding: const pw.EdgeInsets.all(16),
      decoration: pw.BoxDecoration(
        color: const PdfColor(0.97, 0.98, 0.99),
        borderRadius: pw.BorderRadius.circular(18),
        border: pw.Border.all(color: const PdfColor(0.89, 0.92, 0.95)),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          _sectionCaption('Registro', 'Registro técnico resumido'),
          pw.SizedBox(height: 12),
          _tripleRow('Código', codigoGarantia, 'Serie', data.numeroSerie,
              'Ciudad', ciudad),
          pw.SizedBox(height: 10),
          _tripleRow('Titular', data.cliente, 'Correo', soporteCorreo,
              'Teléfono', soporteTelefono),
        ],
      ),
    );
  }

  static pw.Widget _garantiaValidationBlock(ProtocoloModel data) {
    return pw.Container(
      padding: const pw.EdgeInsets.all(16),
      decoration: pw.BoxDecoration(
        color: const PdfColor(1, 0.98, 0.95),
        borderRadius: pw.BorderRadius.circular(18),
        border: pw.Border.all(color: const PdfColor(0.95, 0.87, 0.78)),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          _sectionCaption('9', 'Validación y conformidad'),
          pw.SizedBox(height: 12),
          pw.Text(
            'Este certificado acredita la emisión de garantía del equipo descrito y forma parte del expediente documental de instalación EVINKA.',
            textAlign: pw.TextAlign.center,
            style: const pw.TextStyle(fontSize: 9.8),
          ),
          pw.SizedBox(height: 18),
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              _signatureMini(
                  'EVINKA · Sello y validación', data.firmaInstalador),
              _signatureMini('Cliente / titular', data.firmaCliente),
            ],
          ),
        ],
      ),
    );
  }

  static pw.Widget _legalCard({
    required String number,
    required String title,
    required String text,
    required PdfColor fill,
    required PdfColor stroke,
  }) {
    return pw.Container(
      padding: const pw.EdgeInsets.all(16),
      decoration: pw.BoxDecoration(
        color: fill,
        borderRadius: pw.BorderRadius.circular(18),
        border: pw.Border.all(color: stroke),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          _sectionCaption(number, title),
          pw.SizedBox(height: 12),
          pw.Text(text,
              style: const pw.TextStyle(fontSize: 9.2),
              textAlign: pw.TextAlign.justify),
        ],
      ),
    );
  }

  static pw.Widget _legalWideCard({
    required String number,
    required String title,
    required String text,
    required PdfColor fill,
    required PdfColor stroke,
  }) {
    return pw.Container(
      padding: const pw.EdgeInsets.all(16),
      decoration: pw.BoxDecoration(
        color: fill,
        borderRadius: pw.BorderRadius.circular(18),
        border: pw.Border.all(color: stroke),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          _sectionCaption(number, title),
          pw.SizedBox(height: 12),
          pw.Text(text,
              style: const pw.TextStyle(fontSize: 9.5),
              textAlign: pw.TextAlign.justify),
        ],
      ),
    );
  }

  static pw.Widget _bulletCard({
    required String title,
    required PdfColor color,
    required PdfColor fill,
    required List<String> items,
  }) {
    return pw.Container(
      padding: const pw.EdgeInsets.all(16),
      decoration: pw.BoxDecoration(
        color: fill,
        borderRadius: pw.BorderRadius.circular(18),
        border: pw.Border.all(color: const PdfColor(0.89, 0.92, 0.95)),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(title,
              style: pw.TextStyle(
                  fontSize: 12, fontWeight: pw.FontWeight.bold, color: color)),
          pw.SizedBox(height: 10),
          ...items.map(
            (item) => pw.Padding(
              padding: const pw.EdgeInsets.only(bottom: 8),
              child: pw.Row(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Container(
                    margin: const pw.EdgeInsets.only(top: 4),
                    width: 6,
                    height: 6,
                    decoration: pw.BoxDecoration(
                        color: color, shape: pw.BoxShape.circle),
                  ),
                  pw.SizedBox(width: 8),
                  pw.Expanded(
                      child: pw.Text(item,
                          style: const pw.TextStyle(fontSize: 9.4),
                          textAlign: pw.TextAlign.justify)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _stepsCard({
    required String number,
    required String title,
    required List<String> steps,
  }) {
    return pw.Container(
      padding: const pw.EdgeInsets.all(16),
      decoration: pw.BoxDecoration(
        color: const PdfColor(0.96, 0.98, 1),
        borderRadius: pw.BorderRadius.circular(18),
        border: pw.Border.all(color: const PdfColor(0.86, 0.91, 0.96)),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          _sectionCaption(number, title),
          pw.SizedBox(height: 12),
          for (var i = 0; i < steps.length; i++)
            pw.Padding(
              padding: const pw.EdgeInsets.only(bottom: 10),
              child: pw.Row(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Container(
                    width: 22,
                    height: 22,
                    decoration: pw.BoxDecoration(
                      color: const PdfColor(0.07, 0.11, 0.21),
                      borderRadius: pw.BorderRadius.circular(7),
                    ),
                    alignment: pw.Alignment.center,
                    child: pw.Text('${i + 1}',
                        style: pw.TextStyle(
                            color: PdfColors.white,
                            fontSize: 10,
                            fontWeight: pw.FontWeight.bold)),
                  ),
                  pw.SizedBox(width: 10),
                  pw.Expanded(
                      child: pw.Text(steps[i],
                          style: const pw.TextStyle(fontSize: 10),
                          textAlign: pw.TextAlign.justify)),
                ],
              ),
            ),
        ],
      ),
    );
  }

  static pw.Widget _sectionCaption(String number, String title) {
    final badgeWidth = number.length > 1 ? 30.0 : 22.0;
    final fontSize = number.length > 1 ? 10.0 : 11.0;
    return pw.Row(
      crossAxisAlignment: pw.CrossAxisAlignment.center,
      children: [
        pw.Container(
          width: badgeWidth,
          height: 22,
          decoration: pw.BoxDecoration(
            color: const PdfColor(0.78, 0.60, 0.36),
            borderRadius: pw.BorderRadius.circular(7),
          ),
          alignment: pw.Alignment.center,
          child: pw.Text(number,
              style: pw.TextStyle(
                  color: PdfColors.white,
                  fontSize: fontSize,
                  fontWeight: pw.FontWeight.bold)),
        ),
        pw.SizedBox(width: 8),
        pw.Expanded(
          child: pw.Text(
            title,
            style: pw.TextStyle(
                fontSize: 14,
                fontWeight: pw.FontWeight.bold,
                color: const PdfColor(0.07, 0.11, 0.21)),
          ),
        ),
      ],
    );
  }

  static pw.Widget _pairRow(String l1, String v1, String l2, String v2) {
    return pw.Row(
      children: [
        pw.Expanded(child: _infoLine(l1, v1)),
        pw.SizedBox(width: 12),
        pw.Expanded(child: _infoLine(l2, v2)),
      ],
    );
  }

  static pw.Widget _tripleRow(
      String l1, String v1, String l2, String v2, String l3, String v3) {
    return pw.Row(
      children: [
        pw.Expanded(child: _infoLine(l1, v1)),
        pw.SizedBox(width: 10),
        pw.Expanded(child: _infoLine(l2, v2)),
        pw.SizedBox(width: 10),
        pw.Expanded(child: _infoLine(l3, v3)),
      ],
    );
  }

  static pw.Widget _singleLine(String label, String value) =>
      _infoLine(label, value);

  static pw.Widget _infoLine(String label, String value) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text(label.toUpperCase(),
            style: pw.TextStyle(
                fontSize: 8.5,
                color: PdfColors.grey700,
                fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 4),
        pw.Text(value.isNotEmpty ? value : '-',
            style: const pw.TextStyle(fontSize: 11)),
      ],
    );
  }

  static pw.Widget _signatureMini(String label, List<int>? bytes) {
    return pw.Column(
      children: [
        if (bytes != null && bytes.isNotEmpty)
          pw.Container(
            width: 160,
            height: 48,
            child: pw.Image(pw.MemoryImage(Uint8List.fromList(bytes))),
          )
        else
          pw.Container(
            width: 160,
            height: 48,
            decoration: const pw.BoxDecoration(
              border: pw.Border(bottom: pw.BorderSide(width: 0.8)),
            ),
          ),
        pw.SizedBox(height: 4),
        pw.Text(label, style: const pw.TextStyle(fontSize: 8.8)),
      ],
    );
  }
}
