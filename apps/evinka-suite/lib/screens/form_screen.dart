import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:printing/printing.dart';
import '../models/installation_order_model.dart';
import '../models/protocolo_model.dart';
import '../services/cotizador_service.dart';
import '../services/firebase_service.dart';
import '../services/historial_service.dart';
import '../services/pdf_service.dart';
import '../widgets/firma_widget.dart';
import 'scanner_screen.dart';

class FormScreen extends StatefulWidget {
  const FormScreen({super.key, this.initialOrderCode, this.initialDraftId});

  final String? initialOrderCode;
  final String? initialDraftId;

  @override
  State<FormScreen> createState() => _FormScreenState();
}

class _FormScreenState extends State<FormScreen> {
  final _formKey = GlobalKey<FormState>();
  final ProtocoloModel _data = ProtocoloModel();

  final _ordenCtrl = TextEditingController();
  final _clienteCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _rucCtrl = TextEditingController();
  final _direccionCtrl = TextEditingController();
  final _obsCtrl = TextEditingController();
  final _marcaCtrl = TextEditingController();
  final _nsCtrl = TextEditingController();
  final _voltCtrl = TextEditingController();
  final _ampCtrl = TextEditingController();
  final _otroCtrl = TextEditingController();
  final _kwCtrl = TextEditingController();
  final _adicionalDescCtrl = TextEditingController();

  bool _firmaInstaladorOk = false;
  bool _firmaClienteOk = false;
  bool _generando = false;
  bool _cargandoOrden = false;
  String _estadoSync = '';
  String? _draftEntryId;
  InstallationOrderModel? _ordenActual;
  Uint8List? _foto1;
  Uint8List? _foto2;
  final _picker = ImagePicker();
  final _scrollCtrl = ScrollController();

  bool get _isDark => Theme.of(context).brightness == Brightness.dark;
  Color get _accent =>
      _isDark ? const Color(0xFFD3AA74) : const Color(0xFF1565C0);
  Color get _pageBg =>
      _isDark ? const Color(0xFF0F0F0F) : const Color(0xFFF5F5F5);
  Color get _softBg => _isDark ? const Color(0xFF171717) : Colors.white;
  Color get _mutedText => _isDark ? Colors.white70 : const Color(0xFF4A4A4A);

  @override
  void initState() {
    super.initState();
    _data.fecha = DateFormat('dd/MM/yyyy').format(DateTime.now());
    final initialDraftId = widget.initialDraftId?.trim() ?? '';
    if (initialDraftId.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _cargarBorrador(initialDraftId);
        }
      });
    } else {
      final initialOrderCode = widget.initialOrderCode?.trim() ?? '';
      if (initialOrderCode.isNotEmpty) {
        _ordenCtrl.text = initialOrderCode;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) {
            _cargarOrden(silent: true);
          }
        });
      }
    }
  }

  @override
  void didUpdateWidget(covariant FormScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    final newDraftId = widget.initialDraftId?.trim() ?? '';
    final oldDraftId = oldWidget.initialDraftId?.trim() ?? '';
    if (newDraftId.isNotEmpty && newDraftId != oldDraftId) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _cargarBorrador(newDraftId);
        }
      });
    }
  }

  @override
  void dispose() {
    for (final c in [
      _ordenCtrl,
      _clienteCtrl,
      _emailCtrl,
      _rucCtrl,
      _direccionCtrl,
      _obsCtrl,
      _marcaCtrl,
      _nsCtrl,
      _voltCtrl,
      _ampCtrl,
      _otroCtrl,
      _kwCtrl,
      _adicionalDescCtrl,
    ]) {
      c.dispose();
    }
    _scrollCtrl.dispose();
    super.dispose();
  }

  Future<void> _cargarOrden({bool silent = false}) async {
    final code = _ordenCtrl.text.trim();
    if (code.isEmpty) {
      if (!silent) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Ingresa el código de orden o cotización.')),
        );
      }
      return;
    }
    setState(() => _cargandoOrden = true);
    try {
      final order = await CotizadorService.cargarOrden(code);
      _aplicarOrden(order);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(silent
                ? 'Conformidad lista para la orden ${order.id}.'
                : 'Orden ${order.id} cargada correctamente.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No se pudo cargar la orden: $e')),
      );
    } finally {
      if (mounted) setState(() => _cargandoOrden = false);
    }
  }

  void _aplicarOrden(InstallationOrderModel order) {
    setState(() {
      _ordenActual = order;
      _ordenCtrl.text = order.id;
      _clienteCtrl.text = order.clientName;
      _emailCtrl.text = order.clientEmail;
      _rucCtrl.text = order.clientDocument;
      _direccionCtrl.text =
          order.address.isNotEmpty ? order.address : order.city;
      _marcaCtrl.text = order.chargerBrand.isNotEmpty
          ? order.chargerBrand
          : order.commercialProfileName;
      _voltCtrl.text = order.voltage;
      _ampCtrl.text = order.amperage;
      _kwCtrl.text = order.powerKw;
      _data.quoteId = order.quoteId;
      _data.installationOrderId = order.id;
      _data.commercialProfileName = order.commercialProfileName;
      _estadoSync = 'Orden vinculada: ${order.id}';
    });
  }

  InstallationOrderModel _ordenDesdeData(ProtocoloModel data) {
    return InstallationOrderModel(
      id: data.installationOrderId,
      quoteId: data.quoteId,
      quoteNumber: data.quoteId,
      clientName: data.cliente,
      clientEmail: data.clientEmail,
      clientPhone: '',
      clientDocument: data.ruc,
      city: data.direccion,
      address: data.direccion,
      installationType: '',
      propertyType: '',
      commercialProfileName: data.commercialProfileName,
      advisorName: '',
      assignedTechnician: '',
      quotePdfUrl: '',
      chargerBrand: data.marca,
      voltage: data.voltaje,
      amperage: data.amperaje,
      powerKw: data.potenciaKw,
      status: 'borrador',
    );
  }

  void _aplicarDataAlFormulario(ProtocoloModel data) {
    _ordenCtrl.text = data.installationOrderId;
    _clienteCtrl.text = data.cliente;
    _emailCtrl.text = data.clientEmail;
    _rucCtrl.text = data.ruc;
    _direccionCtrl.text = data.direccion;
    _obsCtrl.text = data.observaciones;
    _marcaCtrl.text = data.marca;
    _nsCtrl.text = data.numeroSerie;
    _voltCtrl.text = data.voltaje;
    _ampCtrl.text = data.amperaje;
    _otroCtrl.text = data.otro;
    _kwCtrl.text = data.potenciaKw;
    _adicionalDescCtrl.text = data.adicionalDesc;
    _data.fecha = data.fecha.isNotEmpty
        ? data.fecha
        : DateFormat('dd/MM/yyyy').format(DateTime.now());
    _data.quoteId = data.quoteId;
    _data.installationOrderId = data.installationOrderId;
    _data.commercialProfileName = data.commercialProfileName;
    _data.cliente = data.cliente;
    _data.clientEmail = data.clientEmail;
    _data.ruc = data.ruc;
    _data.direccion = data.direccion;
    _data.observaciones = data.observaciones;
    _data.marca = data.marca;
    _data.numeroSerie = data.numeroSerie;
    _data.voltaje = data.voltaje;
    _data.amperaje = data.amperaje;
    _data.otro = data.otro;
    _data.potenciaKw = data.potenciaKw;
    _data.cajaCargador = data.cajaCargador;
    _data.cargadorEvinka = data.cargadorEvinka;
    _data.manualCargador = data.manualCargador;
    _data.tarjetasCargador = data.tarjetasCargador;
    _data.adicional = data.adicional;
    _data.adicionalDesc = data.adicionalDesc;
    _data.firmaInstalador = data.firmaInstalador;
    _data.firmaCliente = data.firmaCliente;
    _data.foto1 = data.foto1;
    _data.foto2 = data.foto2;
    _firmaInstaladorOk = data.firmaInstalador != null;
    _firmaClienteOk = data.firmaCliente != null;
    _foto1 = data.foto1 != null ? Uint8List.fromList(data.foto1!) : null;
    _foto2 = data.foto2 != null ? Uint8List.fromList(data.foto2!) : null;
  }

  Future<void> _cargarBorrador(String draftId) async {
    setState(() => _cargandoOrden = true);
    try {
      final entry = await HistorialService.cargarPorId(draftId);
      if (entry == null) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No encontré ese borrador.')),
        );
        return;
      }
      final payloadRaw = entry.syncPayload.trim();
      if (payloadRaw.isEmpty) {
        throw Exception('El borrador no tiene datos guardados.');
      }
      final payload = jsonDecode(payloadRaw) as Map<String, dynamic>;
      final protocolo = ProtocoloModel.fromJson(
        Map<String, dynamic>.from(payload['protocolo'] as Map? ?? {}),
      );
      if (!mounted) return;
      setState(() {
        _draftEntryId = entry.id;
        _ordenActual = protocolo.installationOrderId.isNotEmpty
            ? _ordenDesdeData(protocolo)
            : null;
        _aplicarDataAlFormulario(protocolo);
        _estadoSync = 'Borrador cargado: ${entry.cliente}';
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No pude abrir el borrador: $e')),
      );
    } finally {
      if (mounted) setState(() => _cargandoOrden = false);
    }
  }

  Future<void> _tomarFoto(int numero) async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt),
              title: const Text('Tomar foto'),
              onTap: () => Navigator.pop(context, ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library),
              title: const Text('Elegir de galería'),
              onTap: () => Navigator.pop(context, ImageSource.gallery),
            ),
          ],
        ),
      ),
    );
    if (source == null) return;
    final xfile = await _picker.pickImage(source: source, imageQuality: 85);
    if (xfile == null) return;
    final bytes = await xfile.readAsBytes();
    setState(() {
      if (numero == 1) {
        _foto1 = bytes;
      } else {
        _foto2 = bytes;
      }
    });
  }

  Future<void> _abrirScanner() async {
    final result = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const ScannerScreen()),
    );
    if (result != null) {
      setState(() {
        _nsCtrl.text = result;
        _data.numeroSerie = result;
      });
    }
  }

  Future<void> _seleccionarFecha() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
    );
    if (picked != null) {
      setState(() {
        _data.fecha = DateFormat('dd/MM/yyyy').format(picked);
      });
    }
  }

  void _mostrarFirma(bool esInstalador) {
    showDialog(
      context: context,
      builder: (_) => FirmaWidget(
        titulo: esInstalador
            ? 'Firma del Instalador'
            : 'Firma del Cliente/Representante',
        onFirmaCapturada: (bytes) {
          setState(() {
            if (esInstalador) {
              _data.firmaInstalador = bytes;
              _firmaInstaladorOk = true;
            } else {
              _data.firmaCliente = bytes;
              _firmaClienteOk = true;
            }
          });
        },
      ),
    );
  }

  String? _validationError() {
    if (_clienteCtrl.text.trim().isEmpty) return 'Falta el cliente.';
    final email = _emailCtrl.text.trim();
    if (email.isEmpty) return 'Falta el correo del cliente.';
    final emailOk = email.contains('@') &&
        email.contains('.') &&
        !email.startsWith('@') &&
        !email.endsWith('@') &&
        !email.endsWith('.');
    if (!emailOk) {
      return 'El correo del cliente no es válido.';
    }
    if (_marcaCtrl.text.trim().isEmpty) return 'Falta la marca del cargador.';
    return null;
  }

  void _cargarDataDesdeFormulario() {
    _data.cliente = _clienteCtrl.text;
    _data.clientEmail = _emailCtrl.text.trim();
    _data.ruc = _rucCtrl.text;
    _data.direccion = _direccionCtrl.text;
    _data.observaciones = _obsCtrl.text;
    _data.marca = _marcaCtrl.text;
    _data.numeroSerie = _nsCtrl.text;
    _data.voltaje = _voltCtrl.text;
    _data.amperaje = _ampCtrl.text;
    _data.otro = _otroCtrl.text;
    _data.potenciaKw = _kwCtrl.text;
    _data.adicionalDesc = _adicionalDescCtrl.text;
    _data.foto1 = _foto1 != null ? List<int>.from(_foto1!) : null;
    _data.foto2 = _foto2 != null ? List<int>.from(_foto2!) : null;
  }

  Future<void> _guardarBorrador() async {
    _cargarDataDesdeFormulario();
    final id = _draftEntryId ??
        'BOR-${DateTime.now().millisecondsSinceEpoch}-${_data.installationOrderId.isNotEmpty ? _data.installationOrderId : 'local'}';
    final nombreArchivo = 'Borrador_$id.json';
    final entry = HistorialEntry(
      id: id,
      cliente: _data.cliente.isNotEmpty ? _data.cliente : 'Borrador sin nombre',
      ruc: _data.ruc,
      fecha: _data.fecha,
      fechaGenerado: DateFormat('dd/MM/yyyy HH:mm').format(DateTime.now()),
      archivo: nombreArchivo,
      installationOrderId: _data.installationOrderId,
      quoteId: _data.quoteId,
      clientEmail: _data.clientEmail,
      documentType: 'conformity',
      documentState: 'draft',
      syncPayload: jsonEncode({
        'documentType': 'draft',
        'protocolo': _data.toJson(),
      }),
      syncStatus: 'local',
      syncMessage: 'Borrador guardado. Puedes reabrirlo para completarlo.',
    );

    setState(() {
      _draftEntryId = id;
      _estadoSync = 'Borrador guardado.';
    });
    await HistorialService.guardarBorrador(entry);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Borrador guardado correctamente.')),
    );
  }

  Future<void> _generarPdf() async {
    String etapa = 'validación del formulario';
    String? advertenciaFirebase;
    if (!_formKey.currentState!.validate()) {
      final message = _validationError() ?? 'Revisa los campos obligatorios.';
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(message)),
        );
      }
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          0,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
      return;
    }
    _formKey.currentState!.save();

    _cargarDataDesdeFormulario();

    setState(() {
      _generando = true;
      _estadoSync = 'Generando PDF...';
    });

    try {
      etapa = 'generación del PDF';
      final pdfBytes = await PdfService.generarPdf(_data);
      if (!mounted) return;

      final idBase = _data.installationOrderId.isNotEmpty
          ? _data.installationOrderId
          : DateTime.now().millisecondsSinceEpoch.toString();
      final id =
          _draftEntryId ?? '$idBase-${DateTime.now().millisecondsSinceEpoch}';
      final nombreArchivo = _data.installationOrderId.isNotEmpty
          ? 'Conformidad_${_data.installationOrderId}.pdf'
          : 'Protocolo_${_data.cliente.replaceAll(' ', '_')}_${_data.fecha.replaceAll('/', '-')}.pdf';
      final entry = HistorialEntry(
        id: id,
        cliente: _data.cliente,
        ruc: _data.ruc,
        fecha: _data.fecha,
        fechaGenerado: DateFormat('dd/MM/yyyy HH:mm').format(DateTime.now()),
        archivo: nombreArchivo,
        installationOrderId: _data.installationOrderId,
        quoteId: _data.quoteId,
        clientEmail: _data.clientEmail,
        documentType: 'conformity',
        documentState: 'final',
        syncPayload: jsonEncode({
          'documentType': 'conformity',
          'protocolo': _data.toJson(),
        }),
        syncStatus:
            (_data.installationOrderId.isNotEmpty && _data.quoteId.isNotEmpty)
                ? 'pending'
                : 'local',
        syncMessage:
            (_data.installationOrderId.isNotEmpty && _data.quoteId.isNotEmpty)
                ? 'Sincronización pendiente.'
                : 'Documento generado solo en local.',
      );

      etapa = 'guardado local del historial';
      await HistorialService.guardar(pdfBytes, entry);

      _estadoSync =
          _data.installationOrderId.isNotEmpty && _data.quoteId.isNotEmpty
              ? 'PDF generado. Sincronizando conformidad...'
              : 'PDF generado en modo local.';

      if (_data.installationOrderId.isNotEmpty && _data.quoteId.isNotEmpty) {
        await _sincronizarConformidadEnSegundoPlano(
          id: id,
          pdfBytes: pdfBytes,
          warnContext: advertenciaFirebase,
        );
      } else {
        await HistorialService.actualizarEstadoSync(
          id,
          syncStatus: 'local',
          syncMessage: _estadoSync,
        );
      }

      etapa = 'compartir el PDF';
      await Printing.sharePdf(bytes: pdfBytes, filename: nombreArchivo)
          .timeout(const Duration(seconds: 20), onTimeout: () {
        throw TimeoutException(
            'Tiempo agotado al abrir el diálogo para compartir el PDF.');
      });

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_estadoSync)),
      );
    } on TimeoutException catch (e) {
      _estadoSync = 'Falló en $etapa por tiempo de espera: $e';
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_estadoSync)),
        );
      }
    } catch (e) {
      _estadoSync = 'Falló en $etapa: $e';
      debugPrint('Conformidad: error en etapa "$etapa": $e');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_estadoSync)),
      );
    } finally {
      if (mounted) setState(() => _generando = false);
    }
  }

  DateTime _parseFechaGarantia(String value) {
    try {
      return DateFormat('dd/MM/yyyy').parseStrict(value);
    } catch (_) {
      return DateTime.now();
    }
  }

  String _warrantyCodeForData(String id) {
    final raw = id.replaceAll(RegExp(r'[^A-Za-z0-9]'), '').toUpperCase();
    final tail = raw.length > 8 ? raw.substring(raw.length - 8) : raw;
    return 'EVK-GAR-${DateTime.now().year}-$tail';
  }

  Future<void> _generarGarantia() async {
    String etapa = 'validación del formulario';
    String? advertenciaFirebase;
    if (!_formKey.currentState!.validate()) {
      final message = _validationError() ?? 'Revisa los campos obligatorios.';
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(message)),
        );
      }
      return;
    }
    _formKey.currentState!.save();
    _cargarDataDesdeFormulario();

    setState(() {
      _generando = true;
      _estadoSync = 'Generando garantía de 2 años...';
    });

    try {
      etapa = 'generación de la garantía';
      final pdfBytes = await PdfService.generarGarantiaPdf(
        _data,
        order: _ordenActual,
      );
      if (!mounted) return;

      final baseId = _data.installationOrderId.isNotEmpty
          ? _data.installationOrderId
          : DateTime.now().millisecondsSinceEpoch.toString();
      final id = 'GAR-$baseId-${DateTime.now().millisecondsSinceEpoch}';
      final warrantyCode = _warrantyCodeForData(id);
      final validUntil = DateFormat('dd/MM/yyyy').format(DateTime(
        _parseFechaGarantia(_data.fecha).year + 2,
        _parseFechaGarantia(_data.fecha).month,
        _parseFechaGarantia(_data.fecha).day,
      ));
      final nombreArchivo = _data.installationOrderId.isNotEmpty
          ? 'Garantia_${_data.installationOrderId}_2_anios.pdf'
          : 'Garantia_${_data.cliente.replaceAll(' ', '_')}_2_anios.pdf';
      final entry = HistorialEntry(
        id: id,
        cliente: _data.cliente,
        ruc: _data.ruc,
        fecha: _data.fecha,
        fechaGenerado: DateFormat('dd/MM/yyyy HH:mm').format(DateTime.now()),
        archivo: nombreArchivo,
        installationOrderId: _data.installationOrderId,
        quoteId: _data.quoteId,
        clientEmail: _data.clientEmail,
        documentType: 'warranty',
        syncPayload: jsonEncode({
          'documentType': 'warranty',
          'warrantyCode': warrantyCode,
          'validUntil': validUntil,
          'protocolo': _data.toJson(),
        }),
        syncStatus:
            (_data.installationOrderId.isNotEmpty && _data.quoteId.isNotEmpty)
                ? 'pending'
                : 'local',
        syncMessage:
            (_data.installationOrderId.isNotEmpty && _data.quoteId.isNotEmpty)
                ? 'Garantía generada. Sincronización pendiente.'
                : 'Garantía EVINKA de 2 años generada localmente.',
      );

      await HistorialService.guardar(pdfBytes, entry);

      _estadoSync =
          _data.installationOrderId.isNotEmpty && _data.quoteId.isNotEmpty
              ? 'Garantía generada. Sincronizando documento...'
              : 'Garantía EVINKA de 2 años generada en modo local.';

      if (_data.installationOrderId.isNotEmpty && _data.quoteId.isNotEmpty) {
        try {
          final upload = await FirebaseService.subirGarantia(
            id: id,
            data: _data,
            pdfBytes: pdfBytes,
            warrantyCode: warrantyCode,
            validUntil: validUntil,
          );
          await CotizadorService.sincronizarGarantia(
            data: _data,
            upload: upload,
            id: id,
            warrantyCode: warrantyCode,
            validUntil: validUntil,
            pdfBytes: pdfBytes,
          );
          _estadoSync =
              'Garantía sincronizada correctamente con respaldo documental de 2 años.';
          await HistorialService.actualizarEstadoSync(
            id,
            syncStatus: 'synced',
            syncMessage: _estadoSync,
          );
        } catch (e) {
          advertenciaFirebase =
              'Garantía generada, pero falló la sincronización: $e';
          _estadoSync = advertenciaFirebase;
          await HistorialService.actualizarEstadoSync(
            id,
            syncStatus: 'error',
            syncMessage: _estadoSync,
          );
        }
      } else {
        await HistorialService.actualizarEstadoSync(
          id,
          syncStatus: 'local',
          syncMessage: _estadoSync,
        );
      }

      etapa = 'compartir la garantía';
      await Printing.sharePdf(bytes: pdfBytes, filename: nombreArchivo)
          .timeout(const Duration(seconds: 20), onTimeout: () {
        throw TimeoutException(
            'Tiempo agotado al abrir el diálogo para compartir la garantía.');
      });

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_estadoSync)),
      );
    } on TimeoutException catch (e) {
      _estadoSync = 'Falló en $etapa por tiempo de espera: $e';
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_estadoSync)),
        );
      }
    } catch (e) {
      _estadoSync = 'Falló en $etapa: $e';
      debugPrint('Garantía: error en etapa "$etapa": $e');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_estadoSync)),
      );
    } finally {
      if (mounted) setState(() => _generando = false);
    }
  }

  Future<void> _sincronizarConformidadEnSegundoPlano({
    required String id,
    required Uint8List pdfBytes,
    String? warnContext,
  }) async {
    String? advertenciaFirebase = warnContext;
    FirebaseUploadResult? upload;
    try {
      upload = await FirebaseService.subirProtocolo(
        id: id,
        data: _data,
        pdfBytes: pdfBytes,
      );
    } catch (e) {
      debugPrint('Conformidad: falló Firebase en segundo plano: $e');
      upload = null;
      advertenciaFirebase =
          'Se generó el PDF, pero falló la subida a Firebase: $e';
    }

    if (_data.installationOrderId.isNotEmpty && _data.quoteId.isNotEmpty) {
      try {
        await CotizadorService.sincronizarConformidad(
          data: _data,
          upload: upload,
          id: id,
          pdfBytes: pdfBytes,
        );
        _estadoSync = upload != null
            ? 'Conformidad sincronizada con el cotizador y enviada por correo. Vuelve a la visita para cerrarla.'
            : 'Conformidad sincronizada con el cotizador con respaldo local del PDF. Vuelve a la visita para cerrarla.';
        if (advertenciaFirebase != null) {
          _estadoSync = '$_estadoSync. $advertenciaFirebase';
        }
        await HistorialService.actualizarEstadoSync(
          id,
          syncStatus: 'synced',
          syncMessage: _estadoSync,
        );
      } catch (e) {
        debugPrint('Conformidad: falló cotizador en segundo plano: $e');
        _estadoSync =
            'PDF generado, pero falló la sincronización con el cotizador: $e';
        if (advertenciaFirebase != null) {
          _estadoSync = '$_estadoSync. $advertenciaFirebase';
        }
        await HistorialService.actualizarEstadoSync(
          id,
          syncStatus: 'error',
          syncMessage: _estadoSync,
        );
      }
    }

    if (mounted) {
      setState(() {});
    }
  }

  void _limpiarFormulario() {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('¿Limpiar formulario?'),
        content: const Text('Se borrarán todos los datos ingresados.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              setState(() {
                for (final c in [
                  _ordenCtrl,
                  _clienteCtrl,
                  _emailCtrl,
                  _rucCtrl,
                  _direccionCtrl,
                  _obsCtrl,
                  _marcaCtrl,
                  _nsCtrl,
                  _voltCtrl,
                  _ampCtrl,
                  _otroCtrl,
                  _kwCtrl,
                  _adicionalDescCtrl,
                ]) {
                  c.clear();
                }
                _ordenActual = null;
                _estadoSync = '';
                _data.fecha = DateFormat('dd/MM/yyyy').format(DateTime.now());
                _data.quoteId = '';
                _data.installationOrderId = '';
                _data.commercialProfileName = '';
                _data.cajaCargador = false;
                _data.cargadorEvinka = false;
                _data.manualCargador = false;
                _data.tarjetasCargador = false;
                _data.adicional = false;
                _data.firmaInstalador = null;
                _data.firmaCliente = null;
                _firmaInstaladorOk = false;
                _firmaClienteOk = false;
                _foto1 = null;
                _foto2 = null;
              });
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Limpiar', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _pageBg,
      appBar: AppBar(
        title: const Text(
          'Conformidad de Instalación',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _limpiarFormulario,
            tooltip: 'Limpiar',
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          controller: _scrollCtrl,
          padding: const EdgeInsets.all(16),
          children: [
            _resumenSuperior(),
            const SizedBox(height: 12),
            _pasoSection(
              1,
              'ORDEN EVINKA',
              Icons.link,
              'Vincula la orden primero para que todo se precargue y no tengas que escribir de más.',
              initiallyExpanded: _ordenActual == null,
              [
                TextFormField(
                  controller: _ordenCtrl,
                  decoration:
                      _inputDecoration('Código de orden o cotización').copyWith(
                    hintText: 'Ej.: ORD-20260502-000123 o COT-...',
                    suffixIcon: _cargandoOrden
                        ? const Padding(
                            padding: EdgeInsets.all(12),
                            child: SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                          )
                        : IconButton(
                            icon: Icon(Icons.cloud_download_outlined,
                                color: _accent),
                            onPressed: () => _cargarOrden(),
                          ),
                  ),
                ),
                const SizedBox(height: 12),
                if (_ordenActual != null)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: _accent.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(10),
                      border:
                          Border.all(color: _accent.withValues(alpha: 0.18)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Orden: ${_ordenActual!.id}',
                            style: TextStyle(
                                fontWeight: FontWeight.bold, color: _accent)),
                        const SizedBox(height: 4),
                        Text('Cotización: ${_ordenActual!.quoteId}'),
                        Text(
                            'Perfil comercial: ${_ordenActual!.commercialProfileName}'),
                        Text('Cliente: ${_ordenActual!.clientName}'),
                        if (_ordenActual!.clientEmail.isNotEmpty)
                          Text('Correo: ${_ordenActual!.clientEmail}'),
                      ],
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            _pasoSection(
              2,
              'DATOS DEL CLIENTE / REPRESENTANTE',
              Icons.person,
              'Solo deja visible los datos clave del cliente para terminar la conformidad.',
              [
                _fechaSelector(),
                const SizedBox(height: 12),
                _campo('Cliente *', _clienteCtrl, requerido: true),
                const SizedBox(height: 12),
                _campo(
                  'Correo del cliente *',
                  _emailCtrl,
                  requerido: true,
                  teclado: TextInputType.emailAddress,
                  validator: (v) {
                    final value = (v ?? '').trim();
                    if (value.isEmpty) return 'Campo requerido';
                    final ok =
                        RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(value);
                    return ok ? null : 'Correo inválido';
                  },
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                        child: _campo('RUC o DNI', _rucCtrl,
                            teclado: TextInputType.text)),
                    const SizedBox(width: 12),
                    Expanded(child: _campo('Dirección', _direccionCtrl)),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),
            _pasoSection(
              3,
              'OBSERVACIONES / RECOMENDACIONES',
              Icons.notes,
              'Anota solo lo importante para el cierre técnico.',
              [
                TextFormField(
                  controller: _obsCtrl,
                  maxLines: 4,
                  decoration:
                      _inputDecoration('Observaciones y recomendaciones...'),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _pasoSection(
              4,
              'PARÁMETROS DE INSTALACIÓN',
              Icons.settings,
              'Marca, serie y datos eléctricos del cargador instalado.',
              [
                _campo('Marca *', _marcaCtrl, requerido: true),
                const SizedBox(height: 12),
                _campoNS(),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                        child: _campo('Volt.', _voltCtrl,
                            teclado: TextInputType.number)),
                    const SizedBox(width: 8),
                    Expanded(
                        child: _campo('Amp.', _ampCtrl,
                            teclado: TextInputType.number)),
                    const SizedBox(width: 8),
                    Expanded(child: _campo('Otro', _otroCtrl)),
                    const SizedBox(width: 8),
                    Expanded(
                        child: _campo('Potencia kW', _kwCtrl,
                            teclado: TextInputType.number)),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),
            _pasoSection(
              5,
              'IMPLEMENTOS ENTREGADOS',
              Icons.inventory,
              'Confirma lo que se entrega para que el cierre quede consistente.',
              [
                _checkItem('Caja del cargador', _data.cajaCargador,
                    (v) => setState(() => _data.cajaCargador = v ?? false)),
                _checkItem('Cargador Evinka', _data.cargadorEvinka,
                    (v) => setState(() => _data.cargadorEvinka = v ?? false)),
                _checkItem('Manual del cargador', _data.manualCargador,
                    (v) => setState(() => _data.manualCargador = v ?? false)),
                _checkItem('Tarjetas del cargador', _data.tarjetasCargador,
                    (v) => setState(() => _data.tarjetasCargador = v ?? false)),
                _checkItemConTexto(),
              ],
            ),
            const SizedBox(height: 12),
            _pasoSection(
              6,
              'FIRMAS',
              Icons.draw,
              'Captura las dos firmas antes de compartir el PDF final.',
              [
                Row(
                  children: [
                    Expanded(
                        child: _botonFirma('Firma Instalador',
                            _firmaInstaladorOk, () => _mostrarFirma(true))),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _botonFirma('Firma Cliente', _firmaClienteOk,
                            () => _mostrarFirma(false))),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),
            _pasoSection(
              7,
              'FOTOS DE INSTALACIÓN (pág. 2 del PDF)',
              Icons.camera_alt,
              'Dos fotos bastan para dejar respaldo visual claro.',
              [
                Row(
                  children: [
                    Expanded(child: _botonFoto(1, _foto1)),
                    const SizedBox(width: 12),
                    Expanded(child: _botonFoto(2, _foto2)),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (_estadoSync.isNotEmpty)
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _softBg,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: _accent.withValues(alpha: 0.18)),
                ),
                child: Text(_estadoSync,
                    style: TextStyle(fontSize: 13, color: _accent)),
              ),
            SizedBox(
              height: 56,
              child: OutlinedButton.icon(
                onPressed: _generando ? null : _guardarBorrador,
                icon: const Icon(Icons.save_outlined),
                label: Text(
                  _draftEntryId == null
                      ? 'GUARDAR BORRADOR'
                      : 'ACTUALIZAR BORRADOR',
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.bold),
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: _accent,
                  side: BorderSide(color: _accent, width: 1.5),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 56,
              child: ElevatedButton.icon(
                onPressed: _generando ? null : _generarPdf,
                icon: _generando
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.picture_as_pdf),
                label: Text(
                  _generando
                      ? 'GENERANDO...'
                      : (_draftEntryId == null
                          ? 'GENERAR Y COMPARTIR CONFORMIDAD'
                          : 'FINALIZAR Y COMPARTIR CONFORMIDAD'),
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.bold),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _accent,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 56,
              child: OutlinedButton.icon(
                onPressed: _generando ? null : _generarGarantia,
                icon: const Icon(Icons.verified_outlined),
                label: const Text(
                  'GENERAR Y COMPARTIR GARANTÍA (2 AÑOS)',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: _accent,
                  side: BorderSide(color: _accent, width: 1.5),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _resumenSuperior() {
    final linked = _ordenActual != null;
    final missing = <String>[
      if (_clienteCtrl.text.trim().isEmpty) 'Cliente',
      if (_emailCtrl.text.trim().isEmpty) 'Correo',
      if (_marcaCtrl.text.trim().isEmpty) 'Marca',
      if (_nsCtrl.text.trim().isEmpty) 'Serie',
      if (!_firmaInstaladorOk) 'Firma instalador',
      if (!_firmaClienteOk) 'Firma cliente',
    ];
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Flujo guiado de conformidad',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
            ),
            const SizedBox(height: 6),
            Text(
              _draftEntryId != null
                  ? 'Borrador cargado. Completa lo que falta y luego genera el PDF final.'
                  : linked
                      ? 'Orden vinculada. Completa los pasos y luego genera el PDF.'
                      : 'Primero vincula la orden y luego completa los pasos en orden.',
              style: TextStyle(color: _mutedText),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _estadoChip(linked ? 'Orden lista' : 'Falta orden', linked),
                _estadoChip(
                    _firmaInstaladorOk
                        ? 'Firma instalador OK'
                        : 'Falta firma instalador',
                    _firmaInstaladorOk),
                _estadoChip(
                    _firmaClienteOk
                        ? 'Firma cliente OK'
                        : 'Falta firma cliente',
                    _firmaClienteOk),
                if (_draftEntryId != null) _estadoChip('Borrador', true),
                _estadoChip(
                    missing.isEmpty
                        ? 'Listo para generar'
                        : 'Pendientes: ${missing.take(3).join(', ')}${missing.length > 3 ? '...' : ''}',
                    missing.isEmpty),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _estadoChip(String text, bool ok) {
    final bg = ok
        ? (_isDark ? const Color(0xFF163120) : const Color(0xFFE8F5E9))
        : (_isDark ? const Color(0xFF3B2813) : const Color(0xFFFFF3E0));
    final border = ok ? const Color(0xFF81C784) : const Color(0xFFFFB74D);
    final textColor = ok ? const Color(0xFF81C784) : const Color(0xFFFFC46B);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: border),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: textColor,
        ),
      ),
    );
  }

  Widget _pasoSection(
    int step,
    String titulo,
    IconData icon,
    String summary,
    List<Widget> children, {
    bool initiallyExpanded = false,
  }) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          initiallyExpanded: initiallyExpanded,
          tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          leading: CircleAvatar(
            radius: 16,
            backgroundColor: _accent,
            child: Text('$step', style: const TextStyle(color: Colors.white)),
          ),
          title: Row(
            children: [
              Icon(icon, size: 18, color: _accent),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  titulo,
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                    color: _accent,
                  ),
                ),
              ),
            ],
          ),
          subtitle: Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(summary, style: const TextStyle(fontSize: 12)),
          ),
          children: children,
        ),
      ),
    );
  }

  Widget _fechaSelector() {
    return InkWell(
      onTap: _seleccionarFecha,
      child: InputDecorator(
        decoration: _inputDecoration('Fecha').copyWith(
          suffixIcon: const Icon(Icons.calendar_today, size: 20),
        ),
        child: Text(_data.fecha),
      ),
    );
  }

  Widget _campo(
    String label,
    TextEditingController ctrl, {
    bool requerido = false,
    TextInputType teclado = TextInputType.text,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: ctrl,
      keyboardType: teclado,
      decoration: _inputDecoration(label),
      validator: validator ??
          (requerido
              ? (v) =>
                  (v == null || v.trim().isEmpty) ? 'Campo requerido' : null
              : null),
    );
  }

  Widget _campoNS() {
    return TextFormField(
      controller: _nsCtrl,
      decoration: _inputDecoration('N/S (Número de Serie)').copyWith(
        suffixIcon: IconButton(
          icon: Icon(Icons.qr_code_scanner, color: _accent),
          tooltip: 'Escanear código',
          onPressed: _abrirScanner,
        ),
      ),
      validator: (v) =>
          (v == null || v.trim().isEmpty) ? 'Campo requerido' : null,
    );
  }

  Widget _checkItem(String label, bool value, Function(bool?) onChanged) {
    return CheckboxListTile(
      title: Text(label, style: const TextStyle(fontSize: 14)),
      value: value,
      onChanged: onChanged,
      controlAffinity: ListTileControlAffinity.leading,
      dense: true,
      contentPadding: EdgeInsets.zero,
      activeColor: _accent,
    );
  }

  Widget _checkItemConTexto() {
    return Row(
      children: [
        Checkbox(
          value: _data.adicional,
          onChanged: (v) => setState(() => _data.adicional = v ?? false),
          activeColor: _accent,
        ),
        const Text('Adicional:', style: TextStyle(fontSize: 14)),
        const SizedBox(width: 8),
        Expanded(
          child: TextFormField(
            controller: _adicionalDescCtrl,
            decoration: const InputDecoration(
              hintText: 'Descripción...',
              isDense: true,
              border: UnderlineInputBorder(),
            ),
          ),
        ),
      ],
    );
  }

  Widget _botonFirma(String label, bool firmado, VoidCallback onTap) {
    return OutlinedButton.icon(
      onPressed: onTap,
      icon: Icon(
        firmado ? Icons.check_circle : Icons.draw_outlined,
        color: firmado ? Colors.green : _accent,
      ),
      label: Text(
        label,
        style: TextStyle(
          color: firmado ? Colors.green : _accent,
          fontSize: 13,
        ),
      ),
      style: OutlinedButton.styleFrom(
        side: BorderSide(color: firmado ? Colors.green : _accent),
        padding: const EdgeInsets.symmetric(vertical: 12),
      ),
    );
  }

  Widget _botonFoto(int numero, Uint8List? foto) {
    return GestureDetector(
      onTap: () => _tomarFoto(numero),
      child: Container(
        height: 110,
        decoration: BoxDecoration(
          border: Border.all(
            color: foto != null ? _accent : Colors.grey,
            width: foto != null ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(8),
          color: _isDark ? const Color(0xFF111111) : const Color(0xFFF5F5F5),
        ),
        child: foto != null
            ? ClipRRect(
                borderRadius: BorderRadius.circular(7),
                child: Image.memory(foto,
                    fit: BoxFit.cover, width: double.infinity),
              )
            : Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.add_a_photo_outlined,
                      size: 32, color: Colors.grey[500]),
                  const SizedBox(height: 6),
                  Text('Foto $numero',
                      style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                ],
              ),
      ),
    );
  }

  InputDecoration _inputDecoration(String label) {
    return InputDecoration(
      labelText: label,
      labelStyle: TextStyle(fontSize: 13, color: _mutedText),
      isDense: true,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
    );
  }
}
