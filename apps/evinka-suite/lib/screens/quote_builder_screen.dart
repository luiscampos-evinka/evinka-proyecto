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
  final _cityCtrl = TextEditingController(text: EvinkaAppConfig.isColombia ? 'Bogotá' : 'Lima');
  final _distanceCtrl = TextEditingController(text: '0');
  final _voltageCtrl = TextEditingController(text: '220');
  final _currentCtrl = TextEditingController(text: '32');
  final _notesCtrl = TextEditingController();
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
  String _chargerIncluded = 'no';
  String? _chargerModel;

  static const Map<String, String> _chargerModelLabels = {
    'minibox': 'EVINKA MiniBox',
    'alien': 'EVINKA Alien X',
  };

  final Map<String, bool> _activeConditionals = {};
  final Map<String, TextEditingController> _conditionalQtyCtrls = {};
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
    _distanceCtrl.dispose();
    _voltageCtrl.dispose();
    _currentCtrl.dispose();
    _notesCtrl.dispose();
    _exchangeRateCtrl.dispose();
    _chargerPriceCtrl.dispose();
    for (final ctrl in _conditionalQtyCtrls.values) {
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
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('No pude cargar el cotizador: $e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickPhotos() async {
    final files = await _picker.pickMultiImage(imageQuality: 82);
    if (files.isEmpty) return;
    final slots = 6 - _photos.length;
    if (slots <= 0) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Máximo 6 imágenes.')));
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
      final payload = {
        'clientName': _clientCtrl.text.trim(),
        'email': _emailCtrl.text.trim(),
        'clientDocument': _documentCtrl.text.trim(),
        if (widget.initialVisit != null) 'visitId': widget.initialVisit!.id,
        if (widget.initialVisit != null)
          'reference': widget.initialVisit!.reference,
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
        'chargerPriceUsd': _showAdminPricing
            ? double.tryParse(_chargerPriceCtrl.text.trim())
            : null,
        'exchangeRate': _showAdminPricing
            ? (double.tryParse(_exchangeRateCtrl.text.trim()) ?? 3.75)
            : null,
        'technicianNotes': _notesCtrl.text.trim(),
        'conditionals': config.catalog.conditionals.map((item) {
          return {
            'code': item.code,
            'active': _activeConditionals[item.code] == true,
            'quantity': double.tryParse(
                    _conditionalQtyCtrls[item.code]?.text.trim() ?? '0') ??
                0,
          };
        }).toList(),
        'photos': _photos
            .map((photo) => {
                  'name': photo.name,
                  'contentType': photo.mimeType,
                  'title': photo.title.trim(),
                  'comment': photo.comment.trim(),
                  'dataUrl':
                      'data:${photo.mimeType};base64,${base64Encode(photo.bytes)}',
                })
            .toList(),
      };
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
    await _setQuoteStatus(
      'aceptada_cliente',
      successMessage:
          'Cliente aceptó la cotización. Ahora toca agendar la instalación.',
      visitStatus: 'aceptada_cliente',
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
      body: !widget.user.canEditCommercialFlow
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
                                Form(
                                  key: _formKey,
                                  child: Column(
                                    children: [
                                      _sectionCard(
                                        title: 'Datos comerciales',
                                        icon: Icons.business_center_outlined,
                                        child: _responsiveWrap(
                                          context,
                                          children: [
                                            _field(_clientCtrl, 'Cliente',
                                                required: true),
                                            _field(_emailCtrl, 'Correo',
                                                required: true,
                                                keyboardType:
                                                    TextInputType.emailAddress),
                                            _field(_documentCtrl, EvinkaAppConfig.documentLabel),
                                            _field(_cityCtrl, 'Ciudad'),
                                            _dateField(context),
                                            _dropdown(
                                                'Tipo instalación',
                                                _installationType,
                                                const [
                                                  'Monofásico',
                                                  'Trifásico'
                                                ],
                                                (v) => setState(() =>
                                                    _installationType = v!)),
                                            _dropdown(
                                                'Tipo cliente',
                                                _clientType,
                                                const ['B2C', 'B2B'],
                                                (v) => setState(
                                                    () => _clientType = v!)),
                                            _dropdown(
                                                'Cargador incluido',
                                                _chargerIncluded,
                                                const ['no', 'si'],
                                                (v) => setState(() {
                                                      _chargerIncluded =
                                                          v ?? 'no';
                                                      if (_chargerIncluded ==
                                                          'si') {
                                                        _chargerModel ??=
                                                            'minibox';
                                                      } else {
                                                        _chargerModel = null;
                                                        _chargerPriceCtrl
                                                            .clear();
                                                      }
                                                    }),
                                                labels: {
                                                  'no': 'No',
                                                  'si': 'Sí',
                                                }),
                                            _dropdown(
                                                'Perfil comercial',
                                                _selectedProfileId,
                                                _profiles
                                                    .map((e) => e.id)
                                                    .toList(),
                                                (v) => setState(() =>
                                                    _selectedProfileId = v),
                                                labels: {
                                                  for (final p in _profiles)
                                                    p.id: _showAdminPricing
                                                        ? '${p.name} · ${p.marginPercent.toStringAsFixed(0)}%'
                                                        : p.name
                                                }),
                                            if (_chargerIncluded == 'si')
                                              _dropdown(
                                                'Modelo de cargador',
                                                _chargerModel,
                                                const ['minibox', 'alien'],
                                                (v) => setState(
                                                    () => _chargerModel = v),
                                                labels: _chargerModelLabels,
                                              ),
                                            if (_showAdminPricing)
                                              _field(
                                                  _exchangeRateCtrl,
                                                  _chargerIncluded == 'si' &&
                                                          _chargerPriceCtrl.text
                                                              .trim()
                                                              .isNotEmpty
                                                      ? 'Tipo de cambio referencial'
                                                      : 'Tipo de cambio referencial (solo si cargas precio)',
                                                  keyboardType:
                                                      const TextInputType
                                                          .numberWithOptions(
                                                          decimal: true)),
                                            if (_chargerIncluded == 'si' &&
                                                _showAdminPricing)
                                              _field(
                                                _chargerPriceCtrl,
                                                'Precio referencial US\$ (opcional)',
                                                keyboardType:
                                                    const TextInputType
                                                        .numberWithOptions(
                                                        decimal: true),
                                                hint:
                                                    'Déjalo vacío si no quieres mostrar precio',
                                              ),
                                            _dropdown(
                                                'Tipo inmueble',
                                                _propertyType,
                                                const ['Casa', 'Edificio'],
                                                (v) => setState(
                                                    () => _propertyType = v!)),
                                          ],
                                        ),
                                      ),
                                      const SizedBox(height: 16),
                                      _sectionCard(
                                        title: 'Datos técnicos',
                                        icon:
                                            Icons.electrical_services_outlined,
                                        child: _responsiveWrap(
                                          context,
                                          children: [
                                            _readOnlyField(
                                                'Técnico', widget.user.name),
                                            _field(_distanceCtrl,
                                                'Distancia instalación (m)',
                                                keyboardType:
                                                    const TextInputType
                                                        .numberWithOptions(
                                                        decimal: true)),
                                            _dropdown(
                                                'Tipo cable',
                                                _selectedCableId,
                                                _cables
                                                    .map((e) => e.id)
                                                    .toList(),
                                                (v) => setState(
                                                    () => _selectedCableId = v),
                                                labels: {
                                                  for (final c in _cables)
                                                    c.id: _showAdminPricing
                                                        ? '${c.label} · ${_money(c.pricePerMeter)}/m'
                                                        : c.label
                                                }),
                                            _dropdown(
                                                'Tipo tubería',
                                                _tubeType,
                                                const ['EMT', 'PVC'],
                                                (v) => setState(
                                                    () => _tubeType = v!)),
                                            _field(_voltageCtrl, 'Voltaje (V)',
                                                keyboardType:
                                                    TextInputType.number),
                                            _field(
                                                _currentCtrl, 'Corriente (A)',
                                                keyboardType:
                                                    TextInputType.number),
                                            _dropdown(
                                                'Puesta a tierra real',
                                                _grounding,
                                                const ['SI', 'NO'],
                                                (v) => setState(
                                                    () => _grounding = v!)),
                                            _dropdown(
                                                'Fuera de la ciudad',
                                                _outOfCity,
                                                const ['NO', 'SI'],
                                                (v) => setState(
                                                    () => _outOfCity = v!)),
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
                                              width: MediaQuery.of(context)
                                                          .size
                                                          .width >
                                                      900
                                                  ? 360
                                                  : double.infinity,
                                              child: Card(
                                                margin: EdgeInsets.zero,
                                                color: _panelColor,
                                                child: Padding(
                                                  padding:
                                                      const EdgeInsets.all(12),
                                                  child: Column(
                                                    crossAxisAlignment:
                                                        CrossAxisAlignment
                                                            .start,
                                                    children: [
                                                      SwitchListTile(
                                                        value:
                                                            _activeConditionals[
                                                                    item.code] ==
                                                                true,
                                                        onChanged: (value) =>
                                                            setState(() =>
                                                                _activeConditionals[
                                                                        item.code] =
                                                                    value),
                                                        contentPadding:
                                                            EdgeInsets.zero,
                                                        title: Text(
                                                            item.description),
                                                        subtitle: Text(_showAdminPricing
                                                            ? '${item.section} · ${item.unit} · ${_money(item.price)}'
                                                            : '${item.section} · ${item.unit}'),
                                                      ),
                                                      TextFormField(
                                                        controller:
                                                            _conditionalQtyCtrls[
                                                                item.code],
                                                        keyboardType:
                                                            const TextInputType
                                                                .numberWithOptions(
                                                                decimal: true),
                                                        decoration:
                                                            const InputDecoration(
                                                                labelText:
                                                                    'Cantidad'),
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
                                      _sectionCard(
                                        title: 'Informe fotográfico',
                                        icon: Icons.photo_camera_back_outlined,
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              children: [
                                                FilledButton.icon(
                                                  onPressed: _photos.length >= 6
                                                      ? null
                                                      : _pickPhotos,
                                                  icon: const Icon(Icons
                                                      .add_photo_alternate_outlined),
                                                  label: Text(_photos.isEmpty
                                                      ? 'Agregar imágenes'
                                                      : 'Agregar más'),
                                                ),
                                                const SizedBox(width: 12),
                                                Expanded(
                                                    child: Text(
                                                        '${_photos.length}/6 cargadas. Se incluirán en el PDF como anexo técnico.')),
                                              ],
                                            ),
                                            const SizedBox(height: 16),
                                            Wrap(
                                              spacing: 12,
                                              runSpacing: 12,
                                              children: _photos.map((photo) {
                                                return SizedBox(
                                                  width: MediaQuery.of(context)
                                                              .size
                                                              .width >
                                                          900
                                                      ? 350
                                                      : double.infinity,
                                                  child: Card(
                                                    margin: EdgeInsets.zero,
                                                    color: _panelColor,
                                                    child: Padding(
                                                      padding:
                                                          const EdgeInsets.all(
                                                              12),
                                                      child: Column(
                                                        crossAxisAlignment:
                                                            CrossAxisAlignment
                                                                .start,
                                                        children: [
                                                          Text(photo.name,
                                                              maxLines: 2,
                                                              overflow:
                                                                  TextOverflow
                                                                      .ellipsis,
                                                              style: theme
                                                                  .textTheme
                                                                  .titleSmall
                                                                  ?.copyWith(
                                                                      fontWeight:
                                                                          FontWeight
                                                                              .w700)),
                                                          const SizedBox(
                                                              height: 10),
                                                          ClipRRect(
                                                            borderRadius:
                                                                BorderRadius
                                                                    .circular(
                                                                        12),
                                                            child: Image.memory(
                                                                Uint8List.fromList(
                                                                    photo
                                                                        .bytes),
                                                                height: 160,
                                                                width: double
                                                                    .infinity,
                                                                fit: BoxFit
                                                                    .cover),
                                                          ),
                                                          const SizedBox(
                                                              height: 10),
                                                          TextFormField(
                                                            initialValue:
                                                                photo.title,
                                                            decoration:
                                                                const InputDecoration(
                                                                    labelText:
                                                                        'Título'),
                                                            onChanged: (value) =>
                                                                _updatePhoto(
                                                                    photo.id,
                                                                    title:
                                                                        value),
                                                          ),
                                                          const SizedBox(
                                                              height: 10),
                                                          TextFormField(
                                                            initialValue:
                                                                photo.comment,
                                                            minLines: 2,
                                                            maxLines: 4,
                                                            decoration:
                                                                const InputDecoration(
                                                                    labelText:
                                                                        'Comentario'),
                                                            onChanged: (value) =>
                                                                _updatePhoto(
                                                                    photo.id,
                                                                    comment:
                                                                        value),
                                                          ),
                                                          const SizedBox(
                                                              height: 10),
                                                          Align(
                                                            alignment: Alignment
                                                                .centerRight,
                                                            child:
                                                                TextButton.icon(
                                                              onPressed: () =>
                                                                  _removePhoto(
                                                                      photo.id),
                                                              icon: const Icon(Icons
                                                                  .delete_outline),
                                                              label: const Text(
                                                                  'Quitar'),
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
                                      ),
                                      const SizedBox(height: 16),
                                      _sectionCard(
                                        title: 'Observación técnica',
                                        icon: Icons.note_alt_outlined,
                                        child: TextFormField(
                                          controller: _notesCtrl,
                                          minLines: 4,
                                          maxLines: 8,
                                          decoration: const InputDecoration(
                                              hintText:
                                                  'Completar con observaciones y validaciones del sitio.'),
                                        ),
                                      ),
                                      const SizedBox(height: 18),
                                      Row(
                                        children: [
                                          Expanded(
                                            child: FilledButton.icon(
                                              onPressed:
                                                  _saving ? null : _submit,
                                              icon: _saving
                                                  ? const SizedBox(
                                                      width: 18,
                                                      height: 18,
                                                      child:
                                                          CircularProgressIndicator(
                                                              strokeWidth: 2))
                                                  : const Icon(Icons
                                                      .description_outlined),
                                              label: Text(_saving
                                                  ? 'Generando...'
                                                  : 'Generar cotización'),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
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
                    'Este módulo queda reservado para Admin y Comercial. El técnico no puede ver precios, márgenes ni ejecutar acciones comerciales desde la app.',
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
                if (quote.canConfirmForSend)
                  FilledButton.tonalIcon(
                    onPressed: _saving ? null : _confirmQuoteOnly,
                    icon: const Icon(Icons.verified_outlined),
                    label: const Text('Confirmar cotización'),
                  ),
                if (quote.canMarkClientAccepted)
                  FilledButton.icon(
                    onPressed: _saving ? null : _markClientAccepted,
                    icon: const Icon(Icons.thumb_up_alt_outlined),
                    label: const Text('Cliente acepta'),
                  ),
                if (quote.canRequestRecotizar)
                  OutlinedButton.icon(
                    onPressed: _saving ? null : _requestRecotizar,
                    icon: const Icon(Icons.refresh_outlined),
                    label: const Text('Recotizar'),
                  ),
                if (quote.canCancel)
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
                if (quote.canScheduleInstallation)
                  Text(
                    'Aceptada por cliente. Agenda la cita desde el detalle de visita.',
                    style: TextStyle(color: _mutedText),
                  ),
                if ((quote.installationOrderId.isNotEmpty ||
                        _acceptedOrderId.isNotEmpty) &&
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

  String _money(double value) =>
      NumberFormat.currency(locale: 'es_PE', symbol: 'S/ ').format(value);

  String _displayQuoteLabel(QuoteRecord quote) {
    if (quote.pdfFilename.isNotEmpty)
      return quote.pdfFilename.replaceAll('.pdf', '');
    return quote.id;
  }
}
