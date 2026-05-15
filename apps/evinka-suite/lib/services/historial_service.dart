import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';

import 'package:path_provider/path_provider.dart';

import '../models/protocolo_model.dart';
import 'cotizador_service.dart';
import 'firebase_service.dart';
import 'network_status_service.dart';

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
  final String documentState;
  final String syncPayload;
  final String syncStatus;
  final String syncMessage;
  final int syncRetryCount;
  final String syncLastAttemptAt;
  final String syncNextAttemptAt;
  final String syncLastError;

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
    this.documentState = 'final',
    this.syncPayload = '',
    this.syncStatus = 'local',
    this.syncMessage = '',
    this.syncRetryCount = 0,
    this.syncLastAttemptAt = '',
    this.syncNextAttemptAt = '',
    this.syncLastError = '',
  });

  bool get needsSync => syncStatus == 'pending' || syncStatus == 'error';

  bool get isDraft => documentState == 'draft';

  DateTime? get syncNextAttemptDate =>
      syncNextAttemptAt.isEmpty ? null : DateTime.tryParse(syncNextAttemptAt);

  bool get isSyncDue {
    final next = syncNextAttemptDate;
    return !needsSync || next == null || !next.isAfter(DateTime.now());
  }

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
        'documentState': documentState,
        'syncPayload': syncPayload,
        'syncStatus': syncStatus,
        'syncMessage': syncMessage,
        'syncRetryCount': syncRetryCount,
        'syncLastAttemptAt': syncLastAttemptAt,
        'syncNextAttemptAt': syncNextAttemptAt,
        'syncLastError': syncLastError,
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
        documentState: json['documentState'] as String? ?? 'final',
        syncPayload: json['syncPayload'] as String? ?? '',
        syncStatus: json['syncStatus'] as String? ?? 'local',
        syncMessage: json['syncMessage'] as String? ?? '',
        syncRetryCount: json['syncRetryCount'] is int
            ? json['syncRetryCount'] as int
            : int.tryParse(json['syncRetryCount']?.toString() ?? '') ?? 0,
        syncLastAttemptAt: json['syncLastAttemptAt'] as String? ?? '',
        syncNextAttemptAt: json['syncNextAttemptAt'] as String? ?? '',
        syncLastError: json['syncLastError'] as String? ?? '',
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
  final int due;
  final String message;

  const SyncQueueStatus({
    required this.running,
    required this.total,
    required this.synced,
    required this.failed,
    required this.due,
    required this.message,
  });

  factory SyncQueueStatus.idle() => const SyncQueueStatus(
        running: false,
        total: 0,
        synced: 0,
        failed: 0,
        due: 0,
        message: 'Sincronización en reposo',
      );
}

class HistorialService {
  static bool _syncingAll = false;
  static final Set<String> _syncingIds = <String>{};
  static Timer? _queueTimer;
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
    await _upsertEntry(entry);
  }

  static Future<void> guardarBorrador(HistorialEntry entry) async {
    await _upsertEntry(entry);
  }

  static Future<void> startAutoQueueRunner(
      {Duration interval = const Duration(minutes: 2)}) async {
    _queueTimer ??= Timer.periodic(interval, (_) {
      unawaited(runAutomaticQueue());
    });
  }

  static Future<void> stopAutoQueueRunner() async {
    _queueTimer?.cancel();
    _queueTimer = null;
  }

  static const List<Duration> _backoffSchedule = [
    Duration(minutes: 5),
    Duration(minutes: 15),
    Duration(minutes: 30),
    Duration(hours: 1),
    Duration(hours: 2),
    Duration(hours: 4),
    Duration(hours: 12),
  ];

  static Duration _backoffForAttempts(int attempts) {
    if (attempts <= 0) return Duration.zero;
    final index = attempts - 1;
    if (index >= _backoffSchedule.length) return _backoffSchedule.last;
    return _backoffSchedule[index];
  }

  static HistorialEntry _withSyncState(
    HistorialEntry current, {
    String? syncStatus,
    String? syncMessage,
    int? syncRetryCount,
    String? syncLastAttemptAt,
    String? syncNextAttemptAt,
    String? syncLastError,
  }) {
    return HistorialEntry(
      id: current.id,
      cliente: current.cliente,
      ruc: current.ruc,
      fecha: current.fecha,
      fechaGenerado: current.fechaGenerado,
      archivo: current.archivo,
      installationOrderId: current.installationOrderId,
      quoteId: current.quoteId,
      clientEmail: current.clientEmail,
      documentType: current.documentType,
      documentState: current.documentState,
      syncPayload: current.syncPayload,
      syncStatus: syncStatus ?? current.syncStatus,
      syncMessage: syncMessage ?? current.syncMessage,
      syncRetryCount: syncRetryCount ?? current.syncRetryCount,
      syncLastAttemptAt: syncLastAttemptAt ?? current.syncLastAttemptAt,
      syncNextAttemptAt: syncNextAttemptAt ?? current.syncNextAttemptAt,
      syncLastError: syncLastError ?? current.syncLastError,
    );
  }

  static Future<void> _persistEntry(HistorialEntry updated) async {
    await _upsertEntry(updated);
  }

  static Future<void> _upsertEntry(HistorialEntry entry) async {
    final lista = await _cargarLista();
    final index = lista.indexWhere((item) => item.id == entry.id);
    if (index >= 0) {
      lista[index] = entry;
    } else {
      lista.add(entry);
    }
    final file = await _indexFile;
    await file.writeAsString(jsonEncode(lista.map((e) => e.toJson()).toList()));
  }

  static Future<HistorialEntry?> cargarPorId(String id) async {
    final lista = await _cargarLista();
    try {
      return lista.firstWhere((e) => e.id == id);
    } catch (_) {
      return null;
    }
  }

  static Future<void> actualizarEstadoSync(
    String id, {
    required String syncStatus,
    required String syncMessage,
  }) async {
    final lista = await _cargarLista();
    final index = lista.indexWhere((e) => e.id == id);
    if (index < 0) return;
    lista[index] = _withSyncState(
      lista[index],
      syncStatus: syncStatus,
      syncMessage: syncMessage,
    );
    final file = await _indexFile;
    await file.writeAsString(jsonEncode(lista.map((e) => e.toJson()).toList()));
  }

  static Future<List<HistorialEntry>> cargarPendientesSync() async {
    final items = await cargarHistorial();
    final pending = items.where((item) => item.needsSync).toList();
    pending.sort((a, b) {
      final aDue = a.isSyncDue;
      final bDue = b.isSyncDue;
      if (aDue != bDue) return aDue ? -1 : 1;
      final aNext =
          a.syncNextAttemptDate ?? DateTime.fromMillisecondsSinceEpoch(0);
      final bNext =
          b.syncNextAttemptDate ?? DateTime.fromMillisecondsSinceEpoch(0);
      final nextCompare = aNext.compareTo(bNext);
      if (nextCompare != 0) return nextCompare;
      return a.syncRetryCount.compareTo(b.syncRetryCount);
    });
    return pending;
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
    if (_syncingIds.contains(entry.id)) return;
    _syncingIds.add(entry.id);
    final startedAt = DateTime.now().toIso8601String();
    await _persistEntry(_withSyncState(
      entry,
      syncStatus: 'pending',
      syncMessage: 'Intentando sincronización...',
      syncLastAttemptAt: startedAt,
    ));
    try {
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
        await _persistEntry(_withSyncState(
          entry,
          syncStatus: 'synced',
          syncMessage: 'Garantía sincronizada correctamente.',
          syncRetryCount: 0,
          syncNextAttemptAt: '',
          syncLastError: '',
          syncLastAttemptAt: startedAt,
        ));
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
      await _persistEntry(_withSyncState(
        entry,
        syncStatus: 'synced',
        syncMessage: 'Conformidad sincronizada correctamente.',
        syncRetryCount: 0,
        syncNextAttemptAt: '',
        syncLastError: '',
        syncLastAttemptAt: startedAt,
      ));
    } catch (e) {
      final attempts = entry.syncRetryCount + 1;
      final backoff = _backoffForAttempts(attempts);
      final nextAttempt = DateTime.now().add(backoff).toIso8601String();
      await _persistEntry(_withSyncState(
        entry,
        syncStatus: 'error',
        syncMessage: 'Sync falló. Próximo intento en ${backoff.inMinutes} min.',
        syncRetryCount: attempts,
        syncLastAttemptAt: startedAt,
        syncNextAttemptAt: nextAttempt,
        syncLastError: e.toString(),
      ));
      rethrow;
    } finally {
      _syncingIds.remove(entry.id);
    }
  }

  static Future<HistorialSyncReport> runAutomaticQueue() async {
    if (NetworkStatusService.instance.state.value != NetworkState.online) {
      final pending = await cargarPendientesSync();
      final due = pending.where((e) => e.isSyncDue).length;
      syncQueueStatus.value = SyncQueueStatus(
        running: false,
        total: pending.length,
        synced: 0,
        failed: 0,
        due: due,
        message: due > 0
            ? 'Sin internet, sync automática en espera.'
            : 'Sin internet y pendientes en backoff.',
      );
      return const HistorialSyncReport(total: 0, synced: 0, failed: 0);
    }
    return _processQueue(force: false);
  }

  static Future<HistorialSyncReport> retryPendingSyncs() async {
    return _processQueue(force: true);
  }

  static Future<HistorialSyncReport> _processQueue(
      {required bool force}) async {
    if (_syncingAll) {
      return const HistorialSyncReport(total: 0, synced: 0, failed: 0);
    }
    _syncingAll = true;
    try {
      final items = await cargarPendientesSync();
      final dueItems = force ? items : items.where((e) => e.isSyncDue).toList();
      syncQueueStatus.value = SyncQueueStatus(
        running: true,
        total: items.length,
        synced: 0,
        failed: 0,
        due: dueItems.length,
        message: dueItems.isEmpty
            ? (items.isEmpty
                ? 'No hay pendientes para sincronizar.'
                : 'Hay pendientes en espera de backoff.')
            : force
                ? 'Sincronizando ${dueItems.length} documentos...'
                : 'Sincronizando ${dueItems.length} documentos vencidos...',
      );
      var synced = 0;
      var failed = 0;
      for (final entry in dueItems) {
        syncQueueStatus.value = SyncQueueStatus(
          running: true,
          total: items.length,
          synced: synced,
          failed: failed,
          due: dueItems.length - synced - failed,
          message: 'Sincronizando ${entry.cliente}...',
        );
        try {
          await retrySync(entry);
          synced += 1;
        } catch (_) {
          failed += 1;
        }
      }
      final pendingAfter = await cargarPendientesSync();
      final dueAfter = pendingAfter.where((e) => e.isSyncDue).length;
      syncQueueStatus.value = SyncQueueStatus(
        running: false,
        total: pendingAfter.length,
        synced: synced,
        failed: failed,
        due: dueAfter,
        message: pendingAfter.isEmpty
            ? 'No había pendientes.'
            : failed > 0
                ? 'Sync completada con fallos.'
                : dueAfter > 0
                    ? 'Sync completada; quedan pendientes en backoff.'
                    : 'Sync completada correctamente.',
      );
      return HistorialSyncReport(
        total: dueItems.length,
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
