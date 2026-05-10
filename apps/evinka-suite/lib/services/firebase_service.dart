import 'dart:async';
import 'dart:typed_data';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import '../models/protocolo_model.dart';

class FirebaseUploadResult {
  final String pdfUrl;
  final List<String> photoUrls;
  final String installerSignatureUrl;
  final String clientSignatureUrl;

  const FirebaseUploadResult({
    required this.pdfUrl,
    required this.photoUrls,
    this.installerSignatureUrl = '',
    this.clientSignatureUrl = '',
  });
}

class FirebaseService {
  static final _firestore = FirebaseFirestore.instance;
  static final _storage = FirebaseStorage.instance;
  static const Duration _timeout = Duration(seconds: 35);

  static Future<void> _putData(
    Reference ref,
    Uint8List bytes,
    String contentType,
    String label,
  ) async {
    await ref
        .putData(bytes, SettableMetadata(contentType: contentType))
        .timeout(_timeout, onTimeout: () {
      throw TimeoutException('Tiempo agotado al subir $label a Firebase.');
    });
  }

  static Future<String> _downloadUrl(Reference ref, String label) async {
    return ref.getDownloadURL().timeout(_timeout, onTimeout: () {
      throw TimeoutException('Tiempo agotado al obtener la URL de $label en Firebase.');
    });
  }

  static Future<FirebaseUploadResult> subirProtocolo({
    required String id,
    required ProtocoloModel data,
    required Uint8List pdfBytes,
  }) async {
    final pdfRef = _storage.ref('protocolos/$id/protocolo.pdf');
    await _putData(pdfRef, pdfBytes, 'application/pdf', 'el PDF');
    final pdfUrl = await _downloadUrl(pdfRef, 'el PDF');

    final photoUrls = <String>[];
    if (data.foto1 != null && data.foto1!.isNotEmpty) {
      final ref = _storage.ref('protocolos/$id/foto1.jpg');
      await _putData(ref, Uint8List.fromList(data.foto1!), 'image/jpeg', 'la foto 1');
      photoUrls.add(await _downloadUrl(ref, 'la foto 1'));
    }
    if (data.foto2 != null && data.foto2!.isNotEmpty) {
      final ref = _storage.ref('protocolos/$id/foto2.jpg');
      await _putData(ref, Uint8List.fromList(data.foto2!), 'image/jpeg', 'la foto 2');
      photoUrls.add(await _downloadUrl(ref, 'la foto 2'));
    }

    String installerSignatureUrl = '';
    if (data.firmaInstalador != null && data.firmaInstalador!.isNotEmpty) {
      final ref = _storage.ref('protocolos/$id/firma_instalador.png');
      await _putData(ref, Uint8List.fromList(data.firmaInstalador!), 'image/png', 'la firma del instalador');
      installerSignatureUrl = await _downloadUrl(ref, 'la firma del instalador');
    }

    String clientSignatureUrl = '';
    if (data.firmaCliente != null && data.firmaCliente!.isNotEmpty) {
      final ref = _storage.ref('protocolos/$id/firma_cliente.png');
      await _putData(ref, Uint8List.fromList(data.firmaCliente!), 'image/png', 'la firma del cliente');
      clientSignatureUrl = await _downloadUrl(ref, 'la firma del cliente');
    }

    await _firestore.collection('protocolos').doc(id).set({
      'id': id,
      'quoteId': data.quoteId,
      'installationOrderId': data.installationOrderId,
      'commercialProfileName': data.commercialProfileName,
      'fecha': data.fecha,
      'cliente': data.cliente,
      'clientEmail': data.clientEmail,
      'ruc': data.ruc,
      'direccion': data.direccion,
      'observaciones': data.observaciones,
      'marca': data.marca,
      'numeroSerie': data.numeroSerie,
      'voltaje': data.voltaje,
      'amperaje': data.amperaje,
      'otro': data.otro,
      'potenciaKw': data.potenciaKw,
      'cajaCargador': data.cajaCargador,
      'cargadorEvinka': data.cargadorEvinka,
      'manualCargador': data.manualCargador,
      'tarjetasCargador': data.tarjetasCargador,
      'adicional': data.adicional,
      'adicionalDesc': data.adicionalDesc,
      'pdfUrl': pdfUrl,
      'photoUrls': photoUrls,
      'installerSignatureUrl': installerSignatureUrl,
      'clientSignatureUrl': clientSignatureUrl,
      'creadoEn': FieldValue.serverTimestamp(),
    }).timeout(_timeout, onTimeout: () {
      throw TimeoutException('Tiempo agotado al guardar la conformidad en Firestore.');
    });

    return FirebaseUploadResult(
      pdfUrl: pdfUrl,
      photoUrls: photoUrls,
      installerSignatureUrl: installerSignatureUrl,
      clientSignatureUrl: clientSignatureUrl,
    );
  }

  static Future<FirebaseUploadResult> subirGarantia({
    required String id,
    required ProtocoloModel data,
    required Uint8List pdfBytes,
    required String warrantyCode,
    required String validUntil,
  }) async {
    final pdfRef = _storage.ref('garantias/$id/garantia.pdf');
    await _putData(pdfRef, pdfBytes, 'application/pdf', 'la garantía');
    final pdfUrl = await _downloadUrl(pdfRef, 'la garantía');

    String installerSignatureUrl = '';
    if (data.firmaInstalador != null && data.firmaInstalador!.isNotEmpty) {
      final ref = _storage.ref('garantias/$id/firma_instalador.png');
      await _putData(ref, Uint8List.fromList(data.firmaInstalador!), 'image/png', 'la firma del instalador');
      installerSignatureUrl = await _downloadUrl(ref, 'la firma del instalador');
    }

    String clientSignatureUrl = '';
    if (data.firmaCliente != null && data.firmaCliente!.isNotEmpty) {
      final ref = _storage.ref('garantias/$id/firma_cliente.png');
      await _putData(ref, Uint8List.fromList(data.firmaCliente!), 'image/png', 'la firma del cliente');
      clientSignatureUrl = await _downloadUrl(ref, 'la firma del cliente');
    }

    await _firestore.collection('garantias').doc(id).set({
      'id': id,
      'warrantyCode': warrantyCode,
      'validUntil': validUntil,
      'quoteId': data.quoteId,
      'installationOrderId': data.installationOrderId,
      'commercialProfileName': data.commercialProfileName,
      'fecha': data.fecha,
      'cliente': data.cliente,
      'clientEmail': data.clientEmail,
      'ruc': data.ruc,
      'direccion': data.direccion,
      'marca': data.marca,
      'numeroSerie': data.numeroSerie,
      'voltaje': data.voltaje,
      'amperaje': data.amperaje,
      'potenciaKw': data.potenciaKw,
      'pdfUrl': pdfUrl,
      'installerSignatureUrl': installerSignatureUrl,
      'clientSignatureUrl': clientSignatureUrl,
      'creadoEn': FieldValue.serverTimestamp(),
    }).timeout(_timeout, onTimeout: () {
      throw TimeoutException('Tiempo agotado al guardar la garantía en Firestore.');
    });

    return FirebaseUploadResult(
      pdfUrl: pdfUrl,
      photoUrls: const [],
      installerSignatureUrl: installerSignatureUrl,
      clientSignatureUrl: clientSignatureUrl,
    );
  }
}
