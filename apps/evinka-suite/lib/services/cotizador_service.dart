import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:http/http.dart' as http;

import '../config/evinka_app_config.dart';
import '../models/installation_order_model.dart';
import '../models/protocolo_model.dart';
import 'firebase_service.dart';

class CotizadorService {
  static String get baseUrl => EvinkaAppConfig.baseUrl;
  static const String appKey = 'EvinkaConformidad#2026';
  static const Duration _timeout = Duration(seconds: 35);

  static Future<InstallationOrderModel> cargarOrden(String code) async {
    final uri = Uri.parse(
        '$baseUrl/api/mobile/orders/${Uri.encodeComponent(code.trim())}');
    late final http.Response res;
    try {
      res = await http.get(uri, headers: {
        'x-evinka-app-key': appKey,
        'Accept': 'application/json',
      }).timeout(_timeout, onTimeout: () {
        throw TimeoutException(
            'Tiempo agotado al cargar la orden desde el cotizador.');
      });
    } on TimeoutException {
      rethrow;
    } catch (e) {
      throw Exception(
          'No se pudo conectar al cotizador para cargar la orden: $e');
    }
    final raw = res.body.trim();
    final data = raw.isEmpty
        ? <String, dynamic>{}
        : (() {
            try {
              return jsonDecode(raw);
            } catch (e) {
              throw Exception(
                  'El cotizador respondió un formato inválido al cargar la orden: $e');
            }
          })();
    if (res.statusCode < 200 || res.statusCode >= 300) {
      final message = data is Map<String, dynamic>
          ? (data['error']?.toString() ?? 'No se pudo cargar la orden')
          : 'No se pudo cargar la orden';
      throw Exception(message);
    }
    return InstallationOrderModel.fromJson(data as Map<String, dynamic>);
  }

  static Future<void> sincronizarConformidad({
    required ProtocoloModel data,
    FirebaseUploadResult? upload,
    required String id,
    Uint8List? pdfBytes,
  }) async {
    final uri = Uri.parse('$baseUrl/api/mobile/conformities');
    final deliveredItems = <String>[];
    if (data.cajaCargador) deliveredItems.add('Caja del cargador');
    if (data.cargadorEvinka) deliveredItems.add('Cargador Evinka');
    if (data.manualCargador) deliveredItems.add('Manual del cargador');
    if (data.tarjetasCargador) deliveredItems.add('Tarjetas del cargador');
    if (data.adicional && data.adicionalDesc.trim().isNotEmpty)
      deliveredItems.add(data.adicionalDesc.trim());

    final body = jsonEncode({
      'id': id,
      'installationOrderId': data.installationOrderId,
      'quoteId': data.quoteId,
      'clientName': data.cliente,
      'clientEmail': data.clientEmail,
      'ruc': data.ruc,
      'address': data.direccion,
      'chargerBrand': data.marca,
      'serialNumber': data.numeroSerie,
      'voltage': data.voltaje,
      'amperage': data.amperaje,
      'powerKw': data.potenciaKw,
      'observations': data.observaciones,
      'deliveredItems': deliveredItems,
      'photoUrls': upload?.photoUrls ?? const [],
      'installerSignatureUrl': upload?.installerSignatureUrl ?? '',
      'clientSignatureUrl': upload?.clientSignatureUrl ?? '',
      'pdfUrl': upload?.pdfUrl ?? '',
      'pdfBase64': pdfBytes != null ? base64Encode(pdfBytes) : '',
      'status': 'pdf_generated',
    });

    late final http.Response res;
    try {
      res = await http
          .post(uri,
              headers: {
                'x-evinka-app-key': appKey,
                'Content-Type': 'application/json',
              },
              body: body)
          .timeout(_timeout, onTimeout: () {
        throw TimeoutException(
            'Tiempo agotado al sincronizar la conformidad con el cotizador.');
      });
    } on TimeoutException {
      rethrow;
    } catch (e) {
      throw Exception(
          'No se pudo conectar al cotizador para sincronizar la conformidad: $e');
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      final raw = res.body.trim();
      var message = 'No se pudo sincronizar la conformidad con el cotizador.';
      if (raw.isNotEmpty) {
        try {
          final parsed = jsonDecode(raw);
          if (parsed is Map<String, dynamic> && parsed['error'] != null) {
            message =
                'No se pudo sincronizar la conformidad con el cotizador: ${parsed['error']}';
          }
        } catch (e) {
          message =
              'No se pudo sincronizar la conformidad con el cotizador: respuesta inválida ($e)';
        }
      }
      throw Exception(message);
    }
  }

  static Future<void> sincronizarGarantia({
    required ProtocoloModel data,
    FirebaseUploadResult? upload,
    required String id,
    required String warrantyCode,
    required String validUntil,
    Uint8List? pdfBytes,
  }) async {
    final uri = Uri.parse('$baseUrl/api/mobile/warranties');
    final body = jsonEncode({
      'id': id,
      'warrantyCode': warrantyCode,
      'validUntil': validUntil,
      'installationOrderId': data.installationOrderId,
      'quoteId': data.quoteId,
      'clientName': data.cliente,
      'clientEmail': data.clientEmail,
      'clientDocument': data.ruc,
      'address': data.direccion,
      'chargerBrand': data.marca,
      'serialNumber': data.numeroSerie,
      'voltage': data.voltaje,
      'amperage': data.amperaje,
      'powerKw': data.potenciaKw,
      'pdfUrl': upload?.pdfUrl ?? '',
      'pdfBase64': pdfBytes != null ? base64Encode(pdfBytes) : '',
      'installerSignatureUrl': upload?.installerSignatureUrl ?? '',
      'clientSignatureUrl': upload?.clientSignatureUrl ?? '',
      'status': 'warranty_generated',
    });

    late final http.Response res;
    try {
      res = await http
          .post(uri,
              headers: {
                'x-evinka-app-key': appKey,
                'Content-Type': 'application/json',
              },
              body: body)
          .timeout(_timeout, onTimeout: () {
        throw TimeoutException(
            'Tiempo agotado al sincronizar la garantía con el cotizador.');
      });
    } on TimeoutException {
      rethrow;
    } catch (e) {
      throw Exception(
          'No se pudo conectar al cotizador para sincronizar la garantía: $e');
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      final raw = res.body.trim();
      var message = 'No se pudo sincronizar la garantía con el cotizador.';
      if (raw.isNotEmpty) {
        try {
          final parsed = jsonDecode(raw);
          if (parsed is Map<String, dynamic> && parsed['error'] != null) {
            message =
                'No se pudo sincronizar la garantía con el cotizador: ${parsed['error']}';
          }
        } catch (e) {
          message =
              'No se pudo sincronizar la garantía con el cotizador: respuesta inválida ($e)';
        }
      }
      throw Exception(message);
    }
  }
}
