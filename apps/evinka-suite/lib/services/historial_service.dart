import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';

import 'package:path_provider/path_provider.dart';

import '../models/protocolo_model.dart';
import 'cotizador_service.dart';
import 'firebase_service.dart';

class HistorialEntry {
  final String id;
  final String cliente;
  final String ruc;
  final String fecha;
  final String fechaGenerado;
  final String archivo;
  final String installationOrderId;
  final String quoteId;
  final String clientEmail;
  final String documentType;
  final String syncPayload;
  final String syncStatus;
  final String syncMessage;

  const HistorialEntry({
    required this.id,
    required this.cliente,
    required this.ruc,
    required this.fecha,
    required this.fechaGenerado,
    required this.archivo,
    this.installationOrderId = '',
    this.quoteId = '',
    this.clientEmail = '',
    this.documentType = 'conformity',
    this.syncPayload = '',
    this.syncStatus = 'local',
    this.syncMessage = '',
  });

  bool get needsSync => syncStatus == 'pending' || syncStatus == 'error';

  Map<String, dynamic> toJson() => {
        'id': id,
        'cliente': cliente,
        'ruc': ruc,
        'fecha': fecha,
        'fechaGenerado': fechaGenerado,
        'archivo': archivo,
        'installationOrderId': installationOrderId,
        'quoteId': quoteId,
        'clientEmail': clientEmail,
        'documentType': documentType,
        'syncPayload': syncPayload,
        'syncStatus': syncStatus,
        'syncMessage': syncMessage,
      };

  factory HistorialEntry.fromJson(Map<String, dynamic> json) => HistorialEntry(
        id: json['id'] as String,
        cliente: json['cliente'] as String,
        ruc: json['ruc'] as String? ?? '',
        fecha: json['fecha'] as String,
        fechaGenerado: json['fechaGenerado'] as String,
        archivo: json['archivo'] as String,
        installationOrderId: json['installationOrderId'] as String? ?? '',
        quoteId: json['quoteId'] as String? ?? '',
        clientEmail: json['clientEmail'] as String? ?? '',
        documentType: json['documentType'] as String? ?? 'conformity',
        syncPayload: json['syncPayload'] as String? ?? '',
        syncStatus: json['syncStatus'] as String? ?? 'local',
        syncMessage: json['syncMessage'] as String? ?? '',
      );
}

class HistorialSyncReport {
  final int total;
  final int synced;
  final int failed;
  final bool running;

  const HistorialSyncReport({
    required this.total,
    required this.synced,
    required this.failed,
    this.running = false,
  });

  bool get hasChanges => total > 0;
}

class SyncQueueStatus {
  final bool running;
  final int total;
  final int synced;
  final int failed;
  final String message;

  const SyncQueueStatus({
    required this.running,
    required this.total,
    required this.synced,
    required this.failed,
    required this.message,
  });

  factory SyncQueueStatus.idle() => const SyncQueueStatus(
        running: false,
        total: 0,
        synced: 0,
        failed: 0,
        message: 'Sincronización en reposo',
      );
}

class HistorialService {
  static bool _syncingAll = false;
  static final ValueNotifier<SyncQueueStatus> syncQueueStatus =
      ValueNotifier<SyncQueueStatus>(SyncQueueStatus.idle());
  static Future<Directory> get _protocolosDir async {
    final base = await getApplicationDocumentsDirectory();
    final dir = Directory('${base.path}/protocolos');
    if (!await dir.exists()) await dir.create(recursive: true);
    return dir;
  }

  static Future<File> get _indexFile async {
    final dir = await _protocolosDir;
    return File('${dir.path}/historial.json');
  }

  static Future<List<HistorialEntry>> cargarHistorial() async {
    final file = await _indexFile;
    if (!await file.exists()) return [];
    final content = await file.readAsString();
    try {
      final List<dynamic> list = jsonDecode(content) as List<dynamic>;
      return list
          .map((e) => HistorialEntry.fromJson(e as Map<String, dynamic>))
          .toList()
          .reversed
          .toList();
    } catch (e) {
      throw Exception('El historial local está corrupto o no se pudo leer: $e');
    }
  }

  static Future<void> guardar(Uint8List pdfBytes, HistorialEntry entry) async {
    final dir = await _protocolosDir;
    await File('${dir.path}/${entry.archivo}').writeAsBytes(pdfBytes);
    final lista = await _cargarLista();
    lista.removeWhere((item) => item.id == entry.id);
    lista.add(entry);
    final file = await _indexFile;
    await file.writeAsString(jsonEncode(lista.map((e) => e.toJson()).toList()));
  }

  static Future<void> actualizarEstadoSync(
    String id, {
    required String syncStatus,
    required String syncMessage,
  }) async {
    final lista = await _cargarLista();
    final index = lista.indexWhere((e) => e.id == id);
    if (index < 0) return;
    final current = lista[index];
    lista[index] = HistorialEntry(
      id: current.id,
      cliente: current.cliente,
      ruc: current.ruc,
      fecha: current.fecha,
      fechaGenerado: current.fechaGenerado,
      archivo: current.archivo,
      installationOrderId: current.installationOrderId,
      quoteId: current.quoteId,
      clientEmail: current.clientEmail,
      syncStatus: syncStatus,
      syncMessage: syncMessage,
    );
    final file = await _indexFile;
    await file.writeAsString(jsonEncode(lista.map((e) => e.toJson()).toList()));
  }

  static Future<List<HistorialEntry>> cargarPendientesSync() async {
    final items = await cargarHistorial();
    return items.where((item) => item.needsSync).toList();
  }

  static Future<void> eliminar(String id) async {
    final lista = await _cargarLista();
    final entry = lista.firstWhere((e) => e.id == id,
        orElse: () => throw Exception('No encontrado'));
    final dir = await _protocolosDir;
    final pdfFile = File('${dir.path}/${entry.archivo}');
    if (await pdfFile.exists()) await pdfFile.delete();
    lista.removeWhere((e) => e.id == id);
    final file = await _indexFile;
    await file.writeAsString(jsonEncode(lista.map((e) => e.toJson()).toList()));
  }

  static Future<void> retrySync(HistorialEntry entry) async {
    final payloadRaw = entry.syncPayload.trim();
    if (payloadRaw.isEmpty) {
      throw Exception(
          'No hay payload local para reintentar esta sincronización.');
    }
    final payload = jsonDecode(payloadRaw) as Map<String, dynamic>;
    final data = ProtocoloModel.fromJson(
      Map<String, dynamic>.from(payload['protocolo'] as Map? ?? {}),
    );
    final pdfBytes = await leerPdf(entry.archivo);
    if (pdfBytes == null) {
      throw Exception('No se encontró el PDF local para reintentar.');
    }

    final documentType =
        (payload['documentType']?.toString() ?? entry.documentType)
            .trim()
            .toLowerCase();

    if (documentType == 'warranty') {
      final warrantyCode = payload['warrantyCode']?.toString().trim() ?? '';
      final validUntil = payload['validUntil']?.toString().trim() ?? '';
      if (warrantyCode.isEmpty || validUntil.isEmpty) {
        throw Exception('Faltan datos de garantía para reintentar la sync.');
      }
      FirebaseUploadResult? upload;
      try {
        upload = await FirebaseService.subirGarantia(
          id: entry.id,
          data: data,
          pdfBytes: pdfBytes,
          warrantyCode: warrantyCode,
          validUntil: validUntil,
        );
      } catch (_) {
        upload = null;
      }
      await CotizadorService.sincronizarGarantia(
        data: data,
        upload: upload,
        id: entry.id,
        warrantyCode: warrantyCode,
        validUntil: validUntil,
        pdfBytes: pdfBytes,
      );
      await actualizarEstadoSync(
        entry.id,
        syncStatus: 'synced',
        syncMessage: 'Garantía sincronizada correctamente.',
      );
      return;
    }

    FirebaseUploadResult? upload;
    try {
      upload = await FirebaseService.subirProtocolo(
        id: entry.id,
        data: data,
        pdfBytes: pdfBytes,
      );
    } catch (_) {
      upload = null;
    }
    await CotizadorService.sincronizarConformidad(
      data: data,
      upload: upload,
      id: entry.id,
      pdfBytes: pdfBytes,
    );
    await actualizarEstadoSync(
      entry.id,
      syncStatus: 'synced',
      syncMessage: 'Conformidad sincronizada correctamente.',
    );
  }

  static Future<HistorialSyncReport> retryPendingSyncs() async {
    if (_syncingAll) {
      return const HistorialSyncReport(total: 0, synced: 0, failed: 0);
    }
    _syncingAll = true;
    final items = await cargarPendientesSync();
    syncQueueStatus.value = SyncQueueStatus(
      running: true,
      total: items.length,
      synced: 0,
      failed: 0,
      message: items.isEmpty
          ? 'No hay pendientes para sincronizar.'
          : 'Sincronizando ${items.length} documentos...',
    );
    try {
      var synced = 0;
      var failed = 0;
      for (final entry in items) {
        syncQueueStatus.value = SyncQueueStatus(
          running: true,
          total: items.length,
          synced: synced,
          failed: failed,
          message: 'Sincronizando ${entry.cliente}...',
        );
        try {
          await retrySync(entry);
          synced += 1;
        } catch (e) {
          failed += 1;
          await actualizarEstadoSync(
            entry.id,
            syncStatus: 'error',
            syncMessage: 'Reintento automático falló: $e',
          );
        }
      }
      syncQueueStatus.value = SyncQueueStatus(
        running: false,
        total: items.length,
        synced: synced,
        failed: failed,
        message: items.isEmpty
            ? 'No había pendientes.'
            : failed > 0
                ? 'Sync automática completada con fallos.'
                : 'Sync automática completada correctamente.',
      );
      return HistorialSyncReport(
        total: items.length,
        synced: synced,
        failed: failed,
      );
    } finally {
      _syncingAll = false;
      if (syncQueueStatus.value.running) {
        syncQueueStatus.value = SyncQueueStatus.idle();
      }
    }
  }

  static Future<Uint8List?> leerPdf(String archivo) async {
    final dir = await _protocolosDir;
    final file = File('${dir.path}/$archivo');
    if (!await file.exists()) return null;
    return file.readAsBytes();
  }

  static Future<List<HistorialEntry>> _cargarLista() async {
    try {
      final file = await _indexFile;
      if (!await file.exists()) return [];
      final content = await file.readAsString();
      final List<dynamic> list = jsonDecode(content) as List<dynamic>;
      return list
          .map((e) => HistorialEntry.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (e) {
      throw Exception('El historial local está corrupto o no se pudo leer: $e');
    }
  }
}
