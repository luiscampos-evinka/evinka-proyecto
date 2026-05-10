import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:path_provider/path_provider.dart';

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
        syncStatus: json['syncStatus'] as String? ?? 'local',
        syncMessage: json['syncMessage'] as String? ?? '',
      );
}

class HistorialService {
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
