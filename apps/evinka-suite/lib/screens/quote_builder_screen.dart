import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config/evinka_app_config.dart';
import '../models/evinka_app_models.dart';
import '../services/evinka_api_service.dart';
import 'conformidad_module_screen.dart';

const List<String> _coCompanyOptions = [
  'BYD',
  'Chery',
  'Geely',
  'Jeep',
  'Kia',
];

const List<String> _coDocumentOptions = ['CC', 'CE', 'NIT', 'PASAPORTE'];
const List<String> _coCityOptions = [
  'Bogotá',
  'Medellín',
  'Cali',
  'Barranquilla',
  'Cartagena',
  'Bucaramanga',
  'Chía',
  'Cajicá',
];
const List<String> _coChargerOptions = [
  'Alien X',
  'Celsia',
  'Kia',
  'Minibox',
  'Otro',
];
const List<String> _coAcometidaOptions = [
  'BIFASICO',
  'MONOFASICO',
  'NA',
  'TRIFASICO',
];

const Map<String, List<CoRubricDefinition>> _coRubricSections = {
  'metalwork': [
    CoRubricDefinition(code: 'PDP', label: 'Pedestal interior', unitLabel: 'PDP COSTO X DIA', defaultQty: 0, defaultPrice: 400000),
    CoRubricDefinition(code: 'BPP', label: 'Pedestal exterior', unitLabel: 'BPP COSTO X DIA', defaultQty: 0, defaultPrice: 550000),
    CoRubricDefinition(code: 'PP', label: 'Platina pared protección', unitLabel: 'PP COSTO X DIA', defaultQty: 0, defaultPrice: 300000),
    CoRubricDefinition(code: 'CDP', label: 'Caja de protección metálica con chapa de seguridad', unitLabel: 'CDP COSTO X DIA', defaultQty: 0, defaultPrice: 80000),
    CoRubricDefinition(code: 'CAJA_PASO', label: 'Caja de paso', unitLabel: 'CAJA DE PASO X DIA', defaultQty: 0, defaultPrice: 30000),
    CoRubricDefinition(code: 'DADOS', label: 'Dados', unitLabel: 'DADOS X DIA', defaultQty: 0, defaultPrice: 50000),
    CoRubricDefinition(code: 'PEINE', label: 'Peine', unitLabel: 'PEINE X DIA', defaultQty: 0, defaultPrice: 65000),
  ],
  'civilWorks': [
    CoRubricDefinition(code: 'OCB', label: 'Obra civil básica interior: regata, resane, pintura o más de 2 pase placa', unitLabel: 'OCB COSTO X DIA', defaultQty: 0, defaultPrice: 150000),
    CoRubricDefinition(code: 'OCI', label: 'Obra civil intermedia interior regata resane pintura', unitLabel: 'OCI COSTO X DIA', defaultQty: 0, defaultPrice: 250000),
    CoRubricDefinition(code: 'OCE', label: 'Obra civil exterior excavación pasto', unitLabel: 'OCE COSTO X DIA', defaultQty: 0, defaultPrice: 350000),
    CoRubricDefinition(code: 'OCEE', label: 'Obra civil exterior adoquín excavación', unitLabel: 'OCEE COSTO X DIA', defaultQty: 0, defaultPrice: 400000),
    CoRubricDefinition(code: 'PAP', label: 'Pase placa', unitLabel: 'PAP COSTO X DIA', defaultQty: 0, defaultPrice: 135000),
    CoRubricDefinition(code: 'MBM', label: 'Medidor bifásico medida interna', unitLabel: 'MBM COSTO X DIA', defaultQty: 0, defaultPrice: 250000),
    CoRubricDefinition(code: 'PINTURA_TUBERIA', label: 'Pintura tubería', unitLabel: 'PINTURA TUBERIA X DIA', defaultQty: 0, defaultPrice: 200000),
    CoRubricDefinition(code: 'FC', label: 'Fuera de la ciudad', unitLabel: 'FC COSTO X DIA', defaultQty: 0, defaultPrice: 80000),
  ],
  'tubing': [
    CoRubricDefinition(code: 'PVC', label: 'Tubería PVC (Metros)', unitLabel: 'Tubería PVC (Metros) X DIA', defaultQty: 0, defaultPrice: 11500),
    CoRubricDefinition(code: 'EMT', label: 'Tubería Emt 3m 3/4 (Metros)', unitLabel: 'Tubería Emt 3m 3/4 (Metros) X DIA', defaultQty: 0, defaultPrice: 30582),
    CoRubricDefinition(code: 'SCH40', label: 'SCH 40 TUBERIA', unitLabel: 'SCH 40 TUBERIA X MTR', defaultQty: 0, defaultPrice: 18000),
    CoRubricDefinition(code: 'CORAZA', label: 'Coraza Liquid Tight Recubierta En PVC 3/4', unitLabel: 'Coraza Liquid Tight Recubierta En PVC 3/4 X UNIDAD', defaultQty: 0, defaultPrice: 10000),
    CoRubricDefinition(code: 'ACC_CORAZA', label: 'Accesorios coraza', unitLabel: 'Accesorios coraza X Valor', defaultQty: 0, defaultPrice: 9750),
  ],
  'cable': [
    CoRubricDefinition(code: 'CABLE_ENC', label: 'Cable encauchetado', unitLabel: 'Valor unitario (m)', defaultQty: 0, defaultPrice: 43950),
  ],
  'labor': [
    CoRubricDefinition(code: 'MO', label: 'Mano de obra técnicos (cuadrilla de 2)', unitLabel: 'MO COSTO X DIA', defaultQty: 1, defaultPrice: 400000),
    CoRubricDefinition(code: 'VTI', label: 'Visita técnica + ingeniería', unitLabel: 'VTI COSTO X DIA', defaultQty: 1, defaultPrice: 133333),
    CoRubricDefinition(code: 'TYH', label: 'Transporte y herramientas', unitLabel: 'TYH COSTO X DIA', defaultQty: 1, defaultPrice: 300000),
    CoRubricDefinition(code: 'POLIZA', label: 'Póliza', unitLabel: 'POLIZA X DIA', defaultQty: 1, defaultPrice: 50000),
  ],
  'materials': [
    CoRubricDefinition(code: 'TE', label: 'Tablero eléctrico 6P', unitLabel: 'TE COSTO X UN', defaultQty: 1, defaultPrice: 45600),
    CoRubricDefinition(code: 'CBL8', label: 'Cable 8 AWG 7 hilos individual', unitLabel: 'CBL8 COSTO X UN', defaultQty: 0, defaultPrice: 7546),
    CoRubricDefinition(code: 'CBL10', label: 'Cable 10 AWG 7 hilos', unitLabel: 'CBL10 COSTO X UN', defaultQty: 0, defaultPrice: 4651),
    CoRubricDefinition(code: 'TERMOMAGNETICO', label: 'Termomagnético', unitLabel: 'TERMOMAGNETICO X UN', defaultQty: 1, defaultPrice: 60750),
    CoRubricDefinition(code: 'DD', label: 'Disyuntor diferencial 40A 30mA', unitLabel: 'DD COSTO X UN', defaultQty: 1, defaultPrice: 168750),
    CoRubricDefinition(code: 'MOC', label: 'Materiales obra civil', unitLabel: 'MATERIALES OBRA CIVIL X UN', defaultQty: 1, defaultPrice: 0),
    CoRubricDefinition(code: 'AE', label: 'Accesorios EMT', unitLabel: 'AE COSTO X UN', defaultQty: 0, defaultPrice: 0),
  ],
};

class QuoteBuilderScreen extends StatefulWidget {
  const QuoteBuilderScreen({
    super.key,
    required this.user,
    this.initialVisit,
  });

  final EvinkaUser user;
  final TechVisit? initialVisit;

  @override
  State<QuoteBuilderScreen> createState() => _QuoteBuilderScreenState();
}

class _QuoteBuilderScreenState extends State<QuoteBuilderScreen> {
  final _formKey = GlobalKey<FormState>();
  final _api = EvinkaApiService.instance;
  final _picker = ImagePicker();

  final _clientCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _documentCtrl = TextEditingController();
  final _cityCtrl = TextEditingController(
      text: EvinkaAppConfig.isColombia ? 'Bogotá' : 'Lima');
  final _phoneCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _distanceCtrl = TextEditingController(text: '0');
  final _voltageCtrl = TextEditingController(text: '220');
  final _currentCtrl = TextEditingController(text: '32');
  final _notesCtrl = TextEditingController();
  final _coQuoteNumberCtrl = TextEditingController();
  final _coAppointmentIdCtrl = TextEditingController();
  final _coOtherReferenceCtrl = TextEditingController();
  final _coAcometidaCaliberCtrl = TextEditingController(text: '8 AWG');
  final _coPrimaryBreakerCtrl = TextEditingController(text: '50');
  final _coMarginCtrl = TextEditingController();
  final _coPdfLinkCtrl = TextEditingController();
  final _exchangeRateCtrl = TextEditingController(text: '3.75');
  final _chargerPriceCtrl = TextEditingController();

  EvinkaConfig? _config;
  QuoteRecord? _lastQuote;
  bool _loading = true;
  bool _saving = false;
  String _acceptedOrderId = '';

  String _visitDate = DateFormat('yyyy-MM-dd').format(DateTime.now());
  String _installationType = 'Monofásico';
  String _clientType = 'B2C';
  String _propertyType = 'Casa';
  String _tubeType = 'EMT';
  String _grounding = 'SI';
  String _outOfCity = 'NO';
  String? _selectedProfileId;
  String? _selectedCableId;
  String _coSendTemplate = 'NO';
  String _coRequiresReview = 'NO';
  String? _coCompanyName;
  String _coDocumentType = 'CC';
  String? _coChargerReference;
  String? _coAcometidaType;
  String _chargerIncluded = 'no';
  String? _chargerModel;

  static const Map<String, String> _chargerModelLabels = {
    'minibox': 'EVINKA MiniBox',
    'alien': 'EVINKA Alien X',
  };

  final Map<String, bool> _activeConditionals = {};
  final Map<String, TextEditingController> _conditionalQtyCtrls = {};
  final Map<String, TextEditingController> _coQtyCtrls = {};
  final Map<String, TextEditingController> _coPriceCtrls = {};
  final List<DraftSitePhoto> _photos = [];

  @override
  void initState() {
    super.initState();
    _prefillFromVisit();
    _loadLinkedQuote();
    _loadConfig();
  }

  @override
  void dispose() {
    _clientCtrl.dispose();
    _emailCtrl.dispose();
    _documentCtrl.dispose();
    _cityCtrl.dispose();
    _phoneCtrl.dispose();
    _addressCtrl.dispose();
    _distanceCtrl.dispose();
    _voltageCtrl.dispose();
    _currentCtrl.dispose();
    _notesCtrl.dispose();
    _coQuoteNumberCtrl.dispose();
    _coAppointmentIdCtrl.dispose();
    _coOtherReferenceCtrl.dispose();
    _coAcometidaCaliberCtrl.dispose();
    _coPrimaryBreakerCtrl.dispose();
    _coMarginCtrl.dispose();
    _coPdfLinkCtrl.dispose();
    _exchangeRateCtrl.dispose();
    _chargerPriceCtrl.dispose();
    for (final ctrl in _conditionalQtyCtrls.values) {
      ctrl.dispose();
    }
    for (final ctrl in _coQtyCtrls.values) {
      ctrl.dispose();
    }
    for (final ctrl in _coPriceCtrls.values) {
      ctrl.dispose();
    }
    super.dispose();
  }

  void _prefillFromVisit() {
    final visit = widget.initialVisit;
    if (visit == null) return;
    _clientCtrl.text = visit.clientName;
    _emailCtrl.text = visit.clientEmail;
    _documentCtrl.text = visit.clientDocument;
    _phoneCtrl.text = visit.clientPhone;
    _addressCtrl.text = visit.clientAddress;
    _visitDate = (visit.scheduledDate != null)
        ? DateFormat('yyyy-MM-dd').format(visit.scheduledDate!)
        : _visitDate;
    _notesCtrl.text = [
      if (visit.clientAddress.isNotEmpty)
        'Dirección visita: ${visit.clientAddress}',
      if (visit.reference.isNotEmpty) 'Referencia visita: ${visit.reference}',
      if (visit.notes.isNotEmpty) 'Notas previas: ${visit.notes}',
    ].join('\n');
    _acceptedOrderId = visit.installationOrderId;
  }

  Future<void> _loadLinkedQuote() async {
    final quoteId = widget.initialVisit?.quoteId ?? '';
    if (quoteId.isEmpty) return;
    try {
      final quote = await _api.getQuote(quoteId);
      if (!mounted) return;
      setState(() {
        _lastQuote = quote;
        if (_clientCtrl.text.trim().isEmpty) {
          _clientCtrl.text = quote.clientName;
        }
        if (_emailCtrl.text.trim().isEmpty) {
          _emailCtrl.text = quote.email;
        }
        if (_documentCtrl.text.trim().isEmpty) {
          _documentCtrl.text = quote.clientDocument;
        }
        if (_phoneCtrl.text.trim().isEmpty) {
          _phoneCtrl.text = widget.initialVisit?.clientPhone ?? '';
        }
        if (_addressCtrl.text.trim().isEmpty) {
          _addressCtrl.text = widget.initialVisit?.clientAddress ?? '';
        }
        if (_acceptedOrderId.isEmpty) {
          _acceptedOrderId = quote.installationOrderId;
        }
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No pude cargar la cotización vinculada: $e')),
      );
    }
  }

  Future<void> _loadConfig() async {
    setState(() => _loading = true);
    try {
      final config = await _api.getCatalog();
      for (final item in config.catalog.conditionals) {
        _activeConditionals.putIfAbsent(item.code, () => false);
        _conditionalQtyCtrls.putIfAbsent(
            item.code, () => TextEditingController(text: '1'));
      }
      setState(() {
        _config = config;
        _selectedProfileId = config.commercialProfiles
            .firstWhere((e) => e.isDefault,
                orElse: () => config.commercialProfiles.first)
            .id;
        _selectedCableId = config.catalog.cables.isNotEmpty
            ? config.catalog.cables.first.id
            : null;
        _exchangeRateCtrl.text =
            config.defaults.chargerExchangeRate.toStringAsFixed(2);
        _initCoDraft(config);
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('No pude cargar el cotizador: $e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _initCoDraft(EvinkaConfig config) {
    if (!EvinkaAppConfig.isColombia) return;
    _coCompanyName ??= _coCompanyOptions.first;
    _coChargerReference ??= _coChargerOptions.first;
    _coAcometidaType ??= _coAcometidaOptions.first;
    final profile = _selectedCommercialProfile;
    if (_coMarginCtrl.text.trim().isEmpty) {
      _coMarginCtrl.text = (profile?.marginPercent ?? 15).toStringAsFixed(0);
    }
    for (final entry in _coRubricSections.entries) {
      for (final item in entry.value) {
        final key = '${entry.key}:${item.code}';
        _coQtyCtrls.putIfAbsent(
          key,
          () => TextEditingController(text: item.defaultQty.toStringAsFixed(item.defaultQty % 1 == 0 ? 0 : 2)),
        );
        _coPriceCtrls.putIfAbsent(
          key,
          () => TextEditingController(text: item.defaultPrice.toStringAsFixed(item.defaultPrice % 1 == 0 ? 0 : 2)),
        );
      }
    }
  }

  CommercialProfile? get _selectedCommercialProfile {
    for (final profile in _profiles) {
      if (profile.id == _selectedProfileId) return profile;
    }
    return _profiles.isNotEmpty ? _profiles.first : null;
  }

  double _safeDouble(String? raw, [double fallback = 0]) {
    final value = raw?.trim().replaceAll(',', '.') ?? '';
    return double.tryParse(value) ?? fallback;
  }

  List<Map<String, dynamic>> _coRowsFor(String sectionKey) {
    final defs = _coRubricSections[sectionKey] ?? const <CoRubricDefinition>[];
    return defs.map((item) {
      final key = '$sectionKey:${item.code}';
      final qty = _safeDouble(_coQtyCtrls[key]?.text, item.defaultQty);
      final price = _safeDouble(_coPriceCtrls[key]?.text, item.defaultPrice);
      final total = qty * price;
      return {
        'code': item.code,
        'label': item.label,
        'unitLabel': item.unitLabel,
        'qty': qty,
        'unitPrice': price,
        'total': total,
      };
    }).toList();
  }

  double _coSectionTotal(String sectionKey) => _coRowsFor(sectionKey)
      .fold(0, (sum, row) => sum + ((row['total'] as num?)?.toDouble() ?? 0));

  double get _coLaborTotal => [
        'metalwork',
        'civilWorks',
        'tubing',
        'cable',
        'labor',
      ].fold(0, (sum, key) => sum + _coSectionTotal(key));

  double get _coMaterialsTotal => _coSectionTotal('materials');
  double get _coSubtotalBeforeMargin => _coLaborTotal + _coMaterialsTotal;
  double get _coMarginPercent => _safeDouble(_coMarginCtrl.text, _selectedCommercialProfile?.marginPercent ?? 15);
  double get _coSubtotalWithMargin => _coSubtotalBeforeMargin * (1 + (_coMarginPercent / 100));
  double get _coIva => _coSubtotalWithMargin * 0.19;
  double get _coTotal => _coSubtotalWithMargin + _coIva;

  Future<void> _pickPhotos() async {
    final files = await _picker.pickMultiImage(imageQuality: 82);
    if (files.isEmpty) return;
    final maxPhotos = EvinkaAppConfig.isColombia ? 4 : 6;
    final slots = maxPhotos - _photos.length;
    if (slots <= 0) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Máximo $maxPhotos imágenes.')));
      return;
    }
    for (final file in files.take(slots)) {
      final bytes = await file.readAsBytes();
      final name = file.name;
      _photos.add(DraftSitePhoto(
        id: '${DateTime.now().microsecondsSinceEpoch}-${_photos.length}',
        name: name,
        mimeType: _mimeFromFilename(name),
        bytes: bytes,
      ));
    }
    if (mounted) setState(() {});
  }

  String _mimeFromFilename(String name) {
    final lower = name.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final config = _config;
    if (config == null) return;
    setState(() => _saving = true);
    try {
      late final Map<String, dynamic> payload;
      if (EvinkaAppConfig.isColombia) {
        final sectionRows = {
          for (final key in _coRubricSections.keys) key: _coRowsFor(key),
        };
        payload = {
          'clientName': _clientCtrl.text.trim(),
          'email': _emailCtrl.text.trim(),
          'clientDocument': _documentCtrl.text.trim(),
          if (widget.initialVisit != null) 'visitId': widget.initialVisit!.id,
          if (widget.initialVisit != null) 'reference': widget.initialVisit!.reference,
          'documentType': _coDocumentType,
          'phone': _phoneCtrl.text.trim(),
          'address': _addressCtrl.text.trim(),
          'city': _cityCtrl.text.trim(),
          'visitDate': _visitDate,
          'commercialProfileId': _selectedProfileId,
          'companyName': _coCompanyName ?? '',
          'chargerReference': _coChargerReference ?? '',
          'otherReference': _coOtherReferenceCtrl.text.trim(),
          'distance': _safeDouble(_distanceCtrl.text),
          'acometidaType': _coAcometidaType ?? '',
          'voltage': _safeDouble(_voltageCtrl.text),
          'current': _safeDouble(_currentCtrl.text),
          'acometidaCaliber': _coAcometidaCaliberCtrl.text.trim(),
          'primaryBreaker': _coPrimaryBreakerCtrl.text.trim(),
          'grounding': _grounding,
          'outOfCity': _outOfCity,
          'requiresReview': _coRequiresReview,
          'installationDescription': _notesCtrl.text.trim(),
          'technicianNotes': _notesCtrl.text.trim(),
          'coQuote': {
            'general': {
              'sendTemplate': _coSendTemplate,
              'quoteNumber': _coQuoteNumberCtrl.text.trim(),
              'commercialProfileId': _selectedProfileId,
              'companyName': _coCompanyName ?? '',
              'documentType': _coDocumentType,
              'documentNumber': _documentCtrl.text.trim(),
              'phone': _phoneCtrl.text.trim(),
              'email': _emailCtrl.text.trim(),
              'clientName': _clientCtrl.text.trim(),
              'address': _addressCtrl.text.trim(),
              'city': _cityCtrl.text.trim(),
              'outOfCity': _outOfCity,
              'appointmentId': _coAppointmentIdCtrl.text.trim(),
              'visitDate': _visitDate,
              'chargerReference': _coChargerReference ?? '',
              'otherReference': _coOtherReferenceCtrl.text.trim(),
              'distance': _safeDouble(_distanceCtrl.text),
              'acometidaType': _coAcometidaType ?? '',
              'voltage': _safeDouble(_voltageCtrl.text),
              'current': _safeDouble(_currentCtrl.text),
              'acometidaCaliber': _coAcometidaCaliberCtrl.text.trim(),
              'primaryBreaker': _coPrimaryBreakerCtrl.text.trim(),
              'grounding': _grounding,
              'requiresReview': _coRequiresReview,
              'installationDescription': _notesCtrl.text.trim(),
              'pdfLink': _coPdfLinkCtrl.text.trim(),
            },
            'sections': sectionRows,
            'totals': {
              'laborTotal': _coLaborTotal,
              'materialsTotal': _coMaterialsTotal,
              'subtotalBeforeMargin': _coSubtotalBeforeMargin,
              'marginPercent': _coMarginPercent,
              'subtotalWithMargin': _coSubtotalWithMargin,
              'iva': _coIva,
              'total': _coTotal,
            },
          },
          'conditionals': const [],
          'photos': _photos.asMap().entries.map((entry) {
            final index = entry.key + 1;
            final photo = entry.value;
            return {
              'name': photo.name,
              'contentType': photo.mimeType,
              'title': 'IMAGEN$index',
              'comment': '',
              'dataUrl': 'data:${photo.mimeType};base64,${base64Encode(photo.bytes)}',
            };
          }).toList(),
        };
      } else {
        payload = {
          'clientName': _clientCtrl.text.trim(),
          'email': _emailCtrl.text.trim(),
          'clientDocument': _documentCtrl.text.trim(),
          if (widget.initialVisit != null) 'visitId': widget.initialVisit!.id,
          if (widget.initialVisit != null) 'reference': widget.initialVisit!.reference,
          'city': _cityCtrl.text.trim(),
          'visitDate': _visitDate,
          'installationType': _installationType,
          'clientType': _clientType,
          'commercialProfileId': _selectedProfileId,
          'propertyType': _propertyType,
          'distance': double.tryParse(_distanceCtrl.text.trim()) ?? 0,
          'cableId': _selectedCableId,
          'tubeType': _tubeType,
          'voltage': double.tryParse(_voltageCtrl.text.trim()) ?? 0,
          'current': double.tryParse(_currentCtrl.text.trim()) ?? 0,
          'grounding': _grounding,
          'outOfCity': _outOfCity,
          'chargerIncluded': _chargerIncluded == 'si',
          'chargerModel': _chargerIncluded == 'si' ? _chargerModel : null,
          'chargerLabel': _chargerIncluded == 'si' ? _selectedChargerLabel : '',
          'chargerPriceUsd': _showAdminPricing ? double.tryParse(_chargerPriceCtrl.text.trim()) : null,
          'exchangeRate': _showAdminPricing ? (double.tryParse(_exchangeRateCtrl.text.trim()) ?? 3.75) : null,
          'technicianNotes': _notesCtrl.text.trim(),
          'conditionals': config.catalog.conditionals.map((item) {
            return {
              'code': item.code,
              'active': _activeConditionals[item.code] == true,
              'quantity': double.tryParse(_conditionalQtyCtrls[item.code]?.text.trim() ?? '0') ?? 0,
            };
          }).toList(),
          'photos': _photos.map((photo) => {
                'name': photo.name,
                'contentType': photo.mimeType,
                'title': photo.title.trim(),
                'comment': photo.comment.trim(),
                'dataUrl': 'data:${photo.mimeType};base64,${base64Encode(photo.bytes)}',
              }).toList(),
        };
      }
      final quote = await _api.createQuote(payload);
      setState(() => _lastQuote = quote);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Cotización generada correctamente.')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('No pude generar la cotización: $e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _openConformidad() async {
    final quote = _lastQuote;
    final orderId = _acceptedOrderId.isNotEmpty
        ? _acceptedOrderId
        : quote?.installationOrderId ?? '';
    if (orderId.isEmpty) return;
    try {
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => ConformidadModuleScreen(initialOrderCode: orderId),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No pude abrir conformidad: $e')),
      );
    }
  }

  Future<void> _confirmQuoteOnly() async {
    await _setQuoteStatus(
      'lista_envio',
      successMessage:
          'Cotización validada. Ya quedó lista para enviarse al cliente.',
      visitStatus: 'lista_envio',
    );
  }

  Future<void> _markClientAccepted() async {
    final quote = _lastQuote;
    if (quote == null) return;
    final payment = await _promptPaymentCapture(
      title: 'Registrar abono 50%',
      clientName: quote.clientName,
      suggestedAmount: quote.total * 0.5,
      suggestedObservation: 'Abono 50% confirmado por KAM desde EVINKA Suite.',
    );
    if (payment == null) return;
    await _setQuoteStatus(
      'aceptada_cliente',
      successMessage:
          'Cliente aceptó la cotización. Ahora toca agendar la instalación.',
      visitStatus: 'aceptada_cliente',
      paymentAmount: payment.amount,
      paymentObservation: payment.observation,
    );
  }

  Future<void> _requestRecotizar() async {
    final ok = await _confirmAction(
      title: 'Marcar para recotizar',
      message: 'Esta cotización volverá a estado recotizar. ¿Continuar?',
    );
    if (!ok) return;
    await _setQuoteStatus(
      'recotizar',
      successMessage: 'La cotización quedó marcada para recotizar.',
      visitStatus: 'recotizar',
    );
  }

  Future<void> _cancelQuote() async {
    final ok = await _confirmAction(
      title: 'Cancelar cotización',
      message: 'Esta cotización quedará cancelada. ¿Continuar?',
    );
    if (!ok) return;
    await _setQuoteStatus(
      'cancelada',
      successMessage: 'La cotización quedó cancelada.',
      visitStatus: 'cancelada',
    );
  }

  Future<void> _setQuoteStatus(
    String status, {
    required String successMessage,
    String? visitStatus,
    double? paymentAmount,
    String? paymentObservation,
  }) async {
    final quote = _lastQuote;
    if (quote == null) return;
    setState(() => _saving = true);
    try {
      final updated = await _api.updateQuoteStatus(
        quote.id,
        status: status,
        visitId: widget.initialVisit?.id,
        reference: widget.initialVisit?.reference,
        paymentAmount: paymentAmount,
        paymentObservation: paymentObservation,
        paymentDate:
            paymentAmount != null ? DateTime.now().toIso8601String() : null,
      );
      if (widget.initialVisit != null && visitStatus != null) {
        await _api.updateTechVisit(
          widget.initialVisit!.id,
          status: visitStatus,
          quoteId: updated.id,
          installationOrderId: updated.installationOrderId,
          notes: _notesCtrl.text.trim(),
          checklist: widget.initialVisit!.checklist,
        );
      }
      if (!mounted) return;
      setState(() {
        _lastQuote = updated;
        _acceptedOrderId = updated.installationOrderId;
      });
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(successMessage)));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No pude actualizar la cotización: $e')),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  double? _parsePaymentAmount(String raw) {
    final normalized = raw.trim().replaceAll(',', '.');
    return double.tryParse(normalized);
  }

  Future<_PaymentCapture?> _promptPaymentCapture({
    required String title,
    required String clientName,
    required double suggestedAmount,
    required String suggestedObservation,
  }) async {
    final amountCtrl = TextEditingController(
      text: suggestedAmount.toStringAsFixed(2),
    );
    final observationCtrl = TextEditingController(text: suggestedObservation);
    String? errorText;
    final result = await showDialog<_PaymentCapture>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setStateDialog) => AlertDialog(
            title: Text(title),
            content: SizedBox(
              width: 420,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Cliente: $clientName'),
                  const SizedBox(height: 12),
                  TextField(
                    controller: amountCtrl,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(
                      labelText: 'Monto recibido',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: observationCtrl,
                    minLines: 2,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: 'Observación',
                    ),
                  ),
                  if (errorText != null) ...[
                    const SizedBox(height: 10),
                    Text(
                      errorText!,
                      style: const TextStyle(color: Colors.redAccent),
                    ),
                  ],
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext),
                child: const Text('Cancelar'),
              ),
              FilledButton(
                onPressed: () {
                  final amount = _parsePaymentAmount(amountCtrl.text);
                  final observation = observationCtrl.text.trim();
                  if (amount == null || amount < 0) {
                    setStateDialog(
                        () => errorText = 'Ingresa un monto válido.');
                    return;
                  }
                  if (observation.isEmpty) {
                    setStateDialog(
                        () => errorText = 'Escribe una observación.');
                    return;
                  }
                  Navigator.pop(
                    dialogContext,
                    _PaymentCapture(amount: amount, observation: observation),
                  );
                },
                child: const Text('Guardar'),
              ),
            ],
          ),
        );
      },
    );
    amountCtrl.dispose();
    observationCtrl.dispose();
    return result;
  }

  Future<void> _openPdf() async {
    final quote = _lastQuote;
    if (quote == null || quote.pdfPath.isEmpty) return;
    setState(() => _saving = true);
    try {
      final uri = Uri.parse('${_api.baseUrl}${quote.pdfPath}');
      final opened = await launchUrl(uri, mode: LaunchMode.platformDefault)
          .timeout(const Duration(seconds: 15), onTimeout: () {
        throw TimeoutException(
            'Tiempo agotado al abrir el PDF de la cotización.');
      });
      if (!opened) {
        throw Exception('No se pudo abrir el PDF en este dispositivo.');
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No pude abrir el PDF: $e')),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<bool> _confirmAction({
    required String title,
    required String message,
  }) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('No'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Sí, continuar'),
          ),
        ],
      ),
    );
    return ok == true;
  }

  void _removePhoto(String id) {
    _photos.removeWhere((photo) => photo.id == id);
    setState(() {});
  }

  void _updatePhoto(String id, {String? title, String? comment}) {
    final index = _photos.indexWhere((photo) => photo.id == id);
    if (index < 0) return;
    _photos[index] = _photos[index].copyWith(title: title, comment: comment);
  }

  List<CableOption> get _cables => _config?.catalog.cables ?? const [];
  List<CommercialProfile> get _profiles =>
      _config?.commercialProfiles ?? const [];
  List<ConditionalItem> get _conditionals =>
      _config?.catalog.conditionals ?? const [];

  bool get _showAdminPricing => widget.user.hasFullAccess;
  String get _selectedChargerLabel =>
      _chargerModelLabels[_chargerModel] ?? 'Cargador incluido';

  bool get _isDark => Theme.of(context).brightness == Brightness.dark;
  Color get _panelColor => _isDark ? const Color(0xFF161616) : Colors.white;
  Color get _softPanelColor =>
      _isDark ? const Color(0xFF151515) : const Color(0xFFF8F3EC);
  Color get _mutedText => _isDark ? Colors.white70 : const Color(0xFF6F5B46);
  Color get _strongText => _isDark ? Colors.white : const Color(0xFF241A12);
  Color get _borderColor =>
      _isDark ? const Color(0x1FFFFFFF) : const Color(0x1F5A4632);
  Color get _heroEnd =>
      _isDark ? const Color(0xFF111111) : const Color(0xFFF1E7D8);
  Color get _heroStart =>
      _isDark ? const Color(0xFF171717) : const Color(0xFFFFFFFF);
  Color get _heroBorder =>
      _isDark ? const Color(0x337DA2FF) : const Color(0x3355331A);
  Color get _heroLabel =>
      _isDark ? const Color(0xFF9FC2FF) : const Color(0xFF55331A);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Cotizar'),
        actions: [
          IconButton(onPressed: _loadConfig, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: !widget.user.canCreateQuotes
          ? _restrictedAccess(theme)
          : _loading
              ? const Center(child: CircularProgressIndicator())
              : _config == null
                  ? const Center(
                      child: Text('No hay configuración disponible.'))
                  : SafeArea(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.all(16),
                        child: Center(
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 1200),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                _hero(theme),
                                if (widget.initialVisit != null) ...[
                                  const SizedBox(height: 16),
                                  _visitContextCard(theme),
                                ],
                                const SizedBox(height: 16),
                                Form(key: _formKey, child: _quoteFormContent(theme)),
                                if (_lastQuote != null) ...[
                                  const SizedBox(height: 18),
                                  _resultCard(theme),
                                ],
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
    );
  }

  Widget _quoteFormContent(ThemeData theme) {
    return Column(
      children: [
        if (EvinkaAppConfig.isColombia) ..._buildColombiaQuoteForm(theme) else ..._buildPeruQuoteForm(theme),
        const SizedBox(height: 18),
        Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                onPressed: _saving ? null : _submit,
                icon: _saving
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.description_outlined),
                label: Text(_saving ? 'Generando...' : 'Generar cotización'),
              ),
            ),
          ],
        ),
      ],
    );
  }

  List<Widget> _buildPeruQuoteForm(ThemeData theme) {
    return [
      _sectionCard(
        title: 'Datos comerciales',
        icon: Icons.business_center_outlined,
        child: _responsiveWrap(
          context,
          children: [
            _field(_clientCtrl, 'Cliente', required: true),
            _field(_emailCtrl, 'Correo', required: true, keyboardType: TextInputType.emailAddress),
            _field(_documentCtrl, EvinkaAppConfig.documentLabel),
            _field(_cityCtrl, 'Ciudad'),
            _dateField(context),
            _dropdown('Tipo instalación', _installationType, const ['Monofásico', 'Trifásico'], (v) => setState(() => _installationType = v!)),
            _dropdown('Tipo cliente', _clientType, const ['B2C', 'B2B'], (v) => setState(() => _clientType = v!)),
            _dropdown('Cargador incluido', _chargerIncluded, const ['no', 'si'], (v) => setState(() {
                  _chargerIncluded = v ?? 'no';
                  if (_chargerIncluded == 'si') {
                    _chargerModel ??= 'minibox';
                  } else {
                    _chargerModel = null;
                    _chargerPriceCtrl.clear();
                  }
                }), labels: const {'no': 'No', 'si': 'Sí'}),
            _dropdown('Perfil comercial', _selectedProfileId, _profiles.map((e) => e.id).toList(), (v) => setState(() => _selectedProfileId = v), labels: {
              for (final p in _profiles) p.id: _showAdminPricing ? '${p.name} · ${p.marginPercent.toStringAsFixed(0)}%' : p.name,
            }),
            if (_chargerIncluded == 'si')
              _dropdown('Modelo de cargador', _chargerModel, const ['minibox', 'alien'], (v) => setState(() => _chargerModel = v), labels: _chargerModelLabels),
            if (_showAdminPricing)
              _field(
                _exchangeRateCtrl,
                _chargerIncluded == 'si' && _chargerPriceCtrl.text.trim().isNotEmpty
                    ? 'Tipo de cambio referencial'
                    : 'Tipo de cambio referencial (solo si cargas precio)',
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
              ),
            if (_chargerIncluded == 'si' && _showAdminPricing)
              _field(
                _chargerPriceCtrl,
                'Precio referencial US\$ (opcional)',
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                hint: 'Déjalo vacío si no quieres mostrar precio',
              ),
            _dropdown('Tipo inmueble', _propertyType, const ['Casa', 'Edificio'], (v) => setState(() => _propertyType = v!)),
          ],
        ),
      ),
      const SizedBox(height: 16),
      _sectionCard(
        title: 'Datos técnicos',
        icon: Icons.electrical_services_outlined,
        child: _responsiveWrap(
          context,
          children: [
            _readOnlyField('Técnico', widget.user.name),
            _field(_distanceCtrl, 'Distancia instalación (m)', keyboardType: const TextInputType.numberWithOptions(decimal: true)),
            _dropdown('Tipo cable', _selectedCableId, _cables.map((e) => e.id).toList(), (v) => setState(() => _selectedCableId = v), labels: {
              for (final c in _cables) c.id: _showAdminPricing ? '${c.label} · ${_money(c.pricePerMeter)}/m' : c.label,
            }),
            _dropdown('Tipo tubería', _tubeType, const ['EMT', 'PVC'], (v) => setState(() => _tubeType = v!)),
            _field(_voltageCtrl, 'Voltaje (V)', keyboardType: TextInputType.number),
            _field(_currentCtrl, 'Corriente (A)', keyboardType: TextInputType.number),
            _dropdown('Puesta a tierra real', _grounding, const ['SI', 'NO'], (v) => setState(() => _grounding = v!)),
            _dropdown('Fuera de la ciudad', _outOfCity, const ['NO', 'SI'], (v) => setState(() => _outOfCity = v!)),
          ],
        ),
      ),
      const SizedBox(height: 16),
      _sectionCard(
        title: 'Condicionales del técnico',
        icon: Icons.tune_outlined,
        child: Wrap(
          spacing: 12,
          runSpacing: 12,
          children: _conditionals.map((item) {
            return SizedBox(
              width: MediaQuery.of(context).size.width > 900 ? 360 : double.infinity,
              child: Card(
                margin: EdgeInsets.zero,
                color: _panelColor,
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SwitchListTile(
                        value: _activeConditionals[item.code] == true,
                        onChanged: (value) => setState(() => _activeConditionals[item.code] = value),
                        contentPadding: EdgeInsets.zero,
                        title: Text(item.description),
                        subtitle: Text(_showAdminPricing ? '${item.section} · ${item.unit} · ${_money(item.price)}' : '${item.section} · ${item.unit}'),
                      ),
                      TextFormField(
                        controller: _conditionalQtyCtrls[item.code],
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: const InputDecoration(labelText: 'Cantidad'),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ),
      const SizedBox(height: 16),
      _buildPeruPhotoSection(theme),
      const SizedBox(height: 16),
      _sectionCard(
        title: 'Observación técnica',
        icon: Icons.note_alt_outlined,
        child: TextFormField(
          controller: _notesCtrl,
          minLines: 4,
          maxLines: 8,
          decoration: const InputDecoration(hintText: 'Completar con observaciones y validaciones del sitio.'),
        ),
      ),
    ];
  }

  List<Widget> _buildColombiaQuoteForm(ThemeData theme) {
    return [
      _sectionCard(
        title: 'Crear cotización',
        icon: Icons.note_add_outlined,
        child: _responsiveWrap(
          context,
          children: [
            _field(_notesCtrl, 'Descripción de la instalación', required: true),
            _dropdown('¿Requiere revisión?', _coRequiresReview, const ['NO', 'SI'], (v) => setState(() => _coRequiresReview = v ?? 'NO')),
            _field(_coPdfLinkCtrl, 'Link PDF'),
          ],
        ),
      ),
      const SizedBox(height: 16),
      _sectionCard(
        title: 'Datos generales',
        icon: Icons.business_center_outlined,
        child: _responsiveWrap(
          context,
          children: [
            _dropdown('Enviar plantilla a cliente', _coSendTemplate, const ['NO', 'SI'], (v) => setState(() => _coSendTemplate = v ?? 'NO')),
            _field(_coQuoteNumberCtrl, 'ID Cotización'),
            _dropdown('Perfil comercial / PDF', _selectedProfileId, _profiles.map((e) => e.id).toList(), (v) => setState(() {
                  _selectedProfileId = v;
                  final margin = _selectedCommercialProfile?.marginPercent ?? 15;
                  _coMarginCtrl.text = margin.toStringAsFixed(0);
                }), labels: {
              for (final p in _profiles) p.id: '${p.name} · ${p.marginPercent.toStringAsFixed(0)}%',
            }),
            _dropdown('Empresa', _coCompanyName, _coCompanyOptions, (v) => setState(() => _coCompanyName = v)),
            _dropdown('Tipo de documento', _coDocumentType, _coDocumentOptions, (v) => setState(() => _coDocumentType = v ?? 'CC')),
            _field(_documentCtrl, 'Número de documento', required: true),
            _field(_phoneCtrl, 'Celular', required: true, keyboardType: TextInputType.phone),
            _field(_emailCtrl, 'Correo', required: true, keyboardType: TextInputType.emailAddress),
            _field(_clientCtrl, 'Nombre del cliente', required: true),
            _field(_addressCtrl, 'Dirección', required: true),
            _dropdown('Ciudad', _cityCtrl.text.trim().isEmpty ? null : _cityCtrl.text.trim(), _coCityOptions, (v) => setState(() => _cityCtrl.text = v ?? '')),
            _dropdown('Es fuera de la ciudad', _outOfCity, const ['NO', 'SI'], (v) => setState(() => _outOfCity = v ?? 'NO')),
            _field(_coAppointmentIdCtrl, 'ID Cita'),
            _dateField(context),
            _dropdown('Referencia cargador', _coChargerReference, _coChargerOptions, (v) => setState(() => _coChargerReference = v)),
            _field(_coOtherReferenceCtrl, 'Otra referencia'),
            _field(_distanceCtrl, 'Distancia acometida proyectada para cargador', keyboardType: const TextInputType.numberWithOptions(decimal: true)),
            _dropdown('Tipo de acometida existente', _coAcometidaType, _coAcometidaOptions, (v) => setState(() => _coAcometidaType = v)),
            _field(_voltageCtrl, 'Voltaje (V)', keyboardType: const TextInputType.numberWithOptions(decimal: true)),
            _field(_currentCtrl, 'Corriente (A)', keyboardType: const TextInputType.numberWithOptions(decimal: true)),
            _field(_coAcometidaCaliberCtrl, 'Calibre de la acometida existente (AWG)'),
            _field(_coPrimaryBreakerCtrl, 'Interruptor protección principal (A)', keyboardType: const TextInputType.numberWithOptions(decimal: true)),
            _dropdown('Cuenta con puesta a tierra real', _grounding, const ['NO', 'SI'], (v) => setState(() => _grounding = v ?? 'NO')),
          ],
        ),
      ),
      const SizedBox(height: 16),
      _buildCoRubricSection('Adicionales carpintería metálica', Icons.precision_manufacturing_outlined, 'metalwork'),
      const SizedBox(height: 16),
      _buildCoRubricSection('Obra civil', Icons.foundation_outlined, 'civilWorks'),
      const SizedBox(height: 16),
      _buildCoRubricSection('Tubería', Icons.construction_outlined, 'tubing'),
      const SizedBox(height: 16),
      _buildCoRubricSection('Cable', Icons.cable_outlined, 'cable'),
      const SizedBox(height: 16),
      _buildCoRubricSection('Mano de obra', Icons.engineering_outlined, 'labor'),
      const SizedBox(height: 16),
      _buildCoRubricSection('Materiales', Icons.inventory_2_outlined, 'materials'),
      const SizedBox(height: 16),
      _sectionCard(
        title: 'Totales',
        icon: Icons.calculate_outlined,
        child: _responsiveWrap(
          context,
          children: [
            _readOnlyField('Total mano de obra', _money(_coLaborTotal)),
            _readOnlyField('Total materiales', _money(_coMaterialsTotal)),
            _readOnlyField('Precio final sin IVA sin margen', _money(_coSubtotalBeforeMargin)),
            TextFormField(
              controller: _coMarginCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(labelText: 'Margen (%)'),
            ),
            _readOnlyField('Precio final sin IVA con margen', _money(_coSubtotalWithMargin)),
            _readOnlyField('IVA 19%', _money(_coIva)),
            _readOnlyField('Precio final (con IVA)', _money(_coTotal)),
            _readOnlyField('Total espejo', _money(_coTotal)),
          ],
        ),
      ),
      const SizedBox(height: 16),
      _buildCoPhotoSection(theme),
    ];
  }

  Widget _buildCoRubricSection(String title, IconData icon, String sectionKey) {
    final rows = _coRubricSections[sectionKey] ?? const <CoRubricDefinition>[];
    return _sectionCard(
      title: title,
      icon: icon,
      child: Column(
        children: [
          ...rows.map((item) {
            final key = '$sectionKey:${item.code}';
            final qtyCtrl = _coQtyCtrls[key]!;
            final priceCtrl = _coPriceCtrls[key]!;
            final total = _safeDouble(qtyCtrl.text, item.defaultQty) * _safeDouble(priceCtrl.text, item.defaultPrice);
            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: _softPanelColor,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: _borderColor),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${item.code} · ${item.label}', style: TextStyle(fontWeight: FontWeight.w700, color: _strongText)),
                  const SizedBox(height: 4),
                  Text(item.unitLabel, style: TextStyle(color: _mutedText, fontSize: 12)),
                  const SizedBox(height: 12),
                  _responsiveWrap(
                    context,
                    children: [
                      TextFormField(
                        controller: qtyCtrl,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        onChanged: (_) => setState(() {}),
                        decoration: const InputDecoration(labelText: 'Cantidad'),
                      ),
                      TextFormField(
                        controller: priceCtrl,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        onChanged: (_) => setState(() {}),
                        decoration: const InputDecoration(labelText: 'Precio base editable'),
                      ),
                      _readOnlyField('Total línea', _money(total)),
                    ],
                  ),
                ],
              ),
            );
          }),
          Align(
            alignment: Alignment.centerRight,
            child: Text('Total sección: ${_money(_coSectionTotal(sectionKey))}', style: TextStyle(fontWeight: FontWeight.w800, color: _strongText)),
          ),
        ],
      ),
    );
  }

  Widget _buildPeruPhotoSection(ThemeData theme) {
    return _sectionCard(
      title: 'Informe fotográfico',
      icon: Icons.photo_camera_back_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              FilledButton.icon(
                onPressed: _photos.length >= 6 ? null : _pickPhotos,
                icon: const Icon(Icons.add_photo_alternate_outlined),
                label: Text(_photos.isEmpty ? 'Agregar imágenes' : 'Agregar más'),
              ),
              const SizedBox(width: 12),
              Expanded(child: Text('${_photos.length}/6 cargadas. Se incluirán en el PDF como anexo técnico.')),
            ],
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: _photos.map((photo) {
              return SizedBox(
                width: MediaQuery.of(context).size.width > 900 ? 350 : double.infinity,
                child: Card(
                  margin: EdgeInsets.zero,
                  color: _panelColor,
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(photo.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 10),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: Image.memory(Uint8List.fromList(photo.bytes), height: 160, width: double.infinity, fit: BoxFit.cover),
                        ),
                        const SizedBox(height: 10),
                        TextFormField(
                          initialValue: photo.title,
                          decoration: const InputDecoration(labelText: 'Título'),
                          onChanged: (value) => _updatePhoto(photo.id, title: value),
                        ),
                        const SizedBox(height: 10),
                        TextFormField(
                          initialValue: photo.comment,
                          minLines: 2,
                          maxLines: 4,
                          decoration: const InputDecoration(labelText: 'Comentario'),
                          onChanged: (value) => _updatePhoto(photo.id, comment: value),
                        ),
                        const SizedBox(height: 10),
                        Align(
                          alignment: Alignment.centerRight,
                          child: TextButton.icon(
                            onPressed: () => _removePhoto(photo.id),
                            icon: const Icon(Icons.delete_outline),
                            label: const Text('Quitar'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildCoPhotoSection(ThemeData theme) {
    return _sectionCard(
      title: 'Registro fotográfico',
      icon: Icons.photo_library_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              FilledButton.icon(
                onPressed: _photos.length >= 4 ? null : _pickPhotos,
                icon: const Icon(Icons.add_photo_alternate_outlined),
                label: Text(_photos.isEmpty ? 'Agregar fotos' : 'Agregar más'),
              ),
              const SizedBox(width: 12),
              Expanded(child: Text('${_photos.length}/4 cargadas. Estas fotos alimentan el PDF CO sin anexo extra.')),
            ],
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: _photos.asMap().entries.map((entry) {
              final index = entry.key + 1;
              final photo = entry.value;
              return SizedBox(
                width: MediaQuery.of(context).size.width > 900 ? 260 : double.infinity,
                child: Card(
                  margin: EdgeInsets.zero,
                  color: _panelColor,
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('IMAGEN$index', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                        const SizedBox(height: 4),
                        Text(photo.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: _mutedText)),
                        const SizedBox(height: 10),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: Image.memory(Uint8List.fromList(photo.bytes), height: 150, width: double.infinity, fit: BoxFit.cover),
                        ),
                        const SizedBox(height: 10),
                        Align(
                          alignment: Alignment.centerRight,
                          child: TextButton.icon(
                            onPressed: () => _removePhoto(photo.id),
                            icon: const Icon(Icons.delete_outline),
                            label: const Text('Quitar'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _restrictedAccess(ThemeData theme) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 720),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Card(
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Acceso restringido',
                      style: theme.textTheme.headlineSmall
                          ?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 12),
                  Text(
                    'Este usuario no puede generar cotizaciones desde la app. El flujo comercial y de conformidad sigue restringido según el rol.',
                    style: theme.textTheme.bodyLarge,
                  ),
                  if (widget.initialVisit != null) ...[
                    const SizedBox(height: 16),
                    _visitContextCard(theme),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _hero(ThemeData theme) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [_heroStart, _heroEnd]),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: _heroBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Cotizador EVINKA',
              style: theme.textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w900,
                color: _strongText,
              )),
          const SizedBox(height: 4),
          Text(
            'Cotización técnica',
            style: theme.textTheme.labelLarge?.copyWith(
              fontWeight: FontWeight.w700,
              color: _heroLabel,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            widget.initialVisit == null
                ? 'Mismo criterio del cotizador actual: login por roles, perfiles comerciales, fotos en PDF y orden lista para pasar a conformidad.'
                : 'Cotización abierta desde una visita técnica. El cliente ya viene precargado para que el técnico no pierda tiempo buscando.',
            style: theme.textTheme.bodyMedium?.copyWith(color: _strongText),
          ),
        ],
      ),
    );
  }

  Widget _visitContextCard(ThemeData theme) {
    final visit = widget.initialVisit!;
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Visita activa',
                style: theme.textTheme.titleLarge
                    ?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                _metric('Referencia',
                    visit.reference.isEmpty ? visit.id : visit.reference),
                _metric(
                    'Horario',
                    visit.scheduledAt.isEmpty
                        ? visit.timeWindow
                        : _formatVisitDateTime(visit.scheduledAt,
                            fallback: visit.timeWindow)),
                _metric('Cliente',
                    visit.clientName.isEmpty ? '-' : visit.clientName),
                _metric('Teléfono',
                    visit.clientPhone.isEmpty ? '-' : visit.clientPhone),
                _metric('Correo',
                    visit.clientEmail.isEmpty ? '-' : visit.clientEmail),
                _metric(EvinkaAppConfig.documentLabel,
                    visit.clientDocument.isEmpty ? '-' : visit.clientDocument),
                _metric('Dirección',
                    visit.clientAddress.isEmpty ? '-' : visit.clientAddress),
                _metric('Estado', visit.statusLabel),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _resultCard(ThemeData theme) {
    final quote = _lastQuote!;
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Cotización lista',
                style: theme.textTheme.titleLarge
                    ?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 14),
            _responsiveWrap(
              context,
              children: [
                _metric('Código', _displayQuoteLabel(quote)),
                _metric('Perfil', quote.profileName),
                _metric('Estado', quote.statusLabel),
                if (_showAdminPricing) ...[
                  _metric('Subtotal', _money(quote.subtotal)),
                  _metric('IGV', _money(quote.igv)),
                  _metric('Total', _money(quote.total)),
                ],
                _metric(
                    'Correo',
                    quote.emailSent
                        ? 'Enviado'
                        : (quote.emailStatusMessage.isEmpty
                            ? 'Pendiente'
                            : quote.emailStatusMessage)),
              ],
            ),
            const SizedBox(height: 12),
            if (quote.includedScope.isNotEmpty) ...[
              Text('Incluye en el precio base',
                  style: theme.textTheme.titleMedium
                      ?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              ...quote.includedScope.map((item) => Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('• '),
                        Expanded(child: Text(item.toString())),
                      ],
                    ),
                  )),
              const SizedBox(height: 8),
            ],
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                if (_showAdminPricing)
                  FilledButton.icon(
                      onPressed: _openPdf,
                      icon: const Icon(Icons.picture_as_pdf_outlined),
                      label: const Text('Abrir PDF')),
                if (widget.user.canEditCommercialFlow &&
                    quote.canConfirmForSend)
                  FilledButton.tonalIcon(
                    onPressed: _saving ? null : _confirmQuoteOnly,
                    icon: const Icon(Icons.verified_outlined),
                    label: const Text('Confirmar cotización'),
                  ),
                if (widget.user.canEditCommercialFlow &&
                    quote.canMarkClientAccepted)
                  FilledButton.icon(
                    onPressed: _saving ? null : _markClientAccepted,
                    icon: const Icon(Icons.thumb_up_alt_outlined),
                    label: const Text('Abono 50%'),
                  ),
                if (widget.user.canEditCommercialFlow &&
                    quote.canRequestRecotizar)
                  OutlinedButton.icon(
                    onPressed: _saving ? null : _requestRecotizar,
                    icon: const Icon(Icons.refresh_outlined),
                    label: const Text('Recotizar'),
                  ),
                if (widget.user.canEditCommercialFlow && quote.canCancel)
                  OutlinedButton.icon(
                    onPressed: _saving ? null : _cancelQuote,
                    icon: const Icon(Icons.cancel_outlined),
                    label: const Text('Cotización cancelada'),
                  ),
                if ((quote.installationOrderId.isNotEmpty ||
                    _acceptedOrderId.isNotEmpty))
                  OutlinedButton.icon(
                    onPressed: null,
                    icon: const Icon(Icons.task_alt),
                    label: Text(
                        'Orden: ${quote.installationOrderId.isNotEmpty ? quote.installationOrderId : _acceptedOrderId}'),
                  ),
                if (widget.user.canEditCommercialFlow &&
                    quote.canScheduleInstallation)
                  Text(
                    'Abono inicial del 50% confirmado. Agenda la cita desde el detalle de visita.',
                    style: TextStyle(color: _mutedText),
                  ),
                if ((quote.installationOrderId.isNotEmpty ||
                        _acceptedOrderId.isNotEmpty) &&
                    widget.user.canReviewConformityFlow &&
                    widget.initialVisit == null)
                  FilledButton.icon(
                    onPressed: _saving ? null : _openConformidad,
                    icon: const Icon(Icons.fact_check_outlined),
                    label: const Text('Abrir conformidad'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _metric(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _softPanelColor,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(color: _mutedText, fontSize: 12)),
          const SizedBox(height: 6),
          Text(value,
              style:
                  TextStyle(fontWeight: FontWeight.w700, color: _strongText)),
        ],
      ),
    );
  }

  String _formatVisitDateTime(String value, {String fallback = '-'}) {
    final parsed = DateTime.tryParse(value);
    if (parsed == null) return fallback;
    return DateFormat('dd/MM/yyyy · hh:mm a', 'es').format(parsed.toLocal());
  }

  Widget _sectionCard(
      {required String title, required IconData icon, required Widget child}) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon),
                const SizedBox(width: 10),
                Expanded(
                    child: Text(title,
                        style: const TextStyle(
                            fontSize: 18, fontWeight: FontWeight.w800))),
              ],
            ),
            const SizedBox(height: 16),
            child,
          ],
        ),
      ),
    );
  }

  Widget _responsiveWrap(BuildContext context,
      {required List<Widget> children}) {
    final width = MediaQuery.of(context).size.width;
    final columns = width >= 1100
        ? 4
        : width >= 800
            ? 2
            : 1;
    final totalSpacing = (columns - 1) * 12;
    final itemWidth = columns == 1
        ? double.infinity
        : ((width.clamp(320.0, 1200.0) - 32 - totalSpacing) / columns);
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: children
          .map((child) => SizedBox(width: itemWidth, child: child))
          .toList(),
    );
  }

  Widget _field(TextEditingController controller, String label,
      {bool required = false, TextInputType? keyboardType, String? hint}) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      decoration: InputDecoration(labelText: label, hintText: hint),
      validator: required
          ? (value) =>
              (value == null || value.trim().isEmpty) ? 'Campo requerido' : null
          : null,
    );
  }

  Widget _readOnlyField(String label, String value) {
    return TextFormField(
      initialValue: value,
      readOnly: true,
      decoration: InputDecoration(labelText: label),
    );
  }

  Widget _dateField(BuildContext context) {
    return InkWell(
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: DateTime.tryParse(_visitDate) ?? DateTime.now(),
          firstDate: DateTime(2024),
          lastDate: DateTime(2032),
        );
        if (picked != null) {
          setState(() => _visitDate = DateFormat('yyyy-MM-dd').format(picked));
        }
      },
      borderRadius: BorderRadius.circular(14),
      child: InputDecorator(
        decoration: const InputDecoration(labelText: 'Fecha visita'),
        child: Text(_visitDate),
      ),
    );
  }

  Widget _dropdown(String label, String? value, List<String> options,
      ValueChanged<String?> onChanged,
      {Map<String, String>? labels}) {
    final theme = Theme.of(context);
    return DropdownButtonFormField<String>(
      initialValue: options.contains(value)
          ? value
          : (options.isNotEmpty ? options.first : null),
      decoration: InputDecoration(labelText: label),
      dropdownColor: theme.cardColor,
      iconEnabledColor: theme.colorScheme.primary,
      style: TextStyle(color: _strongText, fontWeight: FontWeight.w600),
      items: options
          .map((option) => DropdownMenuItem<String>(
                value: option,
                child: Text(
                  labels?[option] ?? option,
                  style: TextStyle(color: _strongText),
                ),
              ))
          .toList(),
      onChanged: onChanged,
    );
  }

  String _money(double value) => NumberFormat.currency(
        locale: EvinkaAppConfig.isColombia ? 'es_CO' : 'es_PE',
        symbol: EvinkaAppConfig.isColombia ? '\$ ' : 'S/ ',
        decimalDigits: EvinkaAppConfig.isColombia ? 0 : 2,
      ).format(value);

  String _displayQuoteLabel(QuoteRecord quote) {
    if (quote.pdfFilename.isNotEmpty)
      return quote.pdfFilename.replaceAll('.pdf', '');
    return quote.id;
  }
}

class _PaymentCapture {
  const _PaymentCapture({required this.amount, required this.observation});

  final double amount;
  final String observation;
}

class CoRubricDefinition {
  final String code;
  final String label;
  final String unitLabel;
  final double defaultQty;
  final double defaultPrice;

  const CoRubricDefinition({
    required this.code,
    required this.label,
    required this.unitLabel,
    required this.defaultQty,
    required this.defaultPrice,
  });
}
