import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:protocolo_cargador/models/protocolo_model.dart';
import 'package:protocolo_cargador/services/pdf_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('generate conformidad preview pdf', () async {
    final photo1 = await File('/root/.openclaw/workspace/apps/cotizador-web/storage/quote-assets/COT-MORA7UGP-DB0C/01-scaled-img-20260429-wa0009.jpg').readAsBytes();
    final photo2 = await File('/root/.openclaw/workspace/apps/cotizador-web/storage/quote-assets/COT-MORA7UGP-DB0C/02-scaled-img-20260501-wa0030.jpg').readAsBytes();

    final pdf = await PdfService.generarPdf(
      ProtocoloModel(
        fecha: '17/05/2026',
        quoteId: 'COT-DEMO-CONFORMIDAD-WEB',
        installationOrderId: 'ORD-DEMO-0001',
        commercialProfileName: 'EVINKA Suite PE',
        cliente: 'Cliente de ejemplo',
        clientEmail: 'oculto@evinka.invalid',
        ruc: '10456789012',
        direccion: 'Av. Ejemplo 123, Lima',
        observaciones: 'Vista previa web de la conformidad para validar footer, WhatsApp del bot y composición fotográfica.',
        marca: 'EVINKA',
        numeroSerie: 'SN-DEMO-20260517',
        voltaje: '220',
        amperaje: '32',
        otro: '—',
        potenciaKw: '7.4',
        cajaCargador: true,
        cargadorEvinka: true,
        manualCargador: true,
        tarjetasCargador: false,
        adicional: false,
        adicionalDesc: '',
        foto1: photo1,
        foto2: photo2,
      ),
    );

    final output = File('/var/www/pe-suite.evinka.net/previews/conformidad-demo.pdf');
    await output.parent.create(recursive: true);
    await output.writeAsBytes(pdf, flush: true);
  });
}
