import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/evinka_app_models.dart';
import '../services/evinka_api_service.dart';

class AdminPanelScreen extends StatefulWidget {
  const AdminPanelScreen({super.key, required this.user});

  final EvinkaUser user;

  @override
  State<AdminPanelScreen> createState() => _AdminPanelScreenState();
}

class _AdminPanelScreenState extends State<AdminPanelScreen> {
  final _api = EvinkaApiService.instance;
  final _companyCtrl = TextEditingController();
  final _taglineCtrl = TextEditingController();
  final _igvCtrl = TextEditingController();
  final _factorCostsCtrl = TextEditingController();
  final _divisorCtrl = TextEditingController();
  final _chargerFxCtrl = TextEditingController();
  final _miniboxPriceCtrl = TextEditingController();
  final _alienPriceCtrl = TextEditingController();
  final _max6Ctrl = TextEditingController();
  final _max10Ctrl = TextEditingController();
  final _metersCasaCtrl = TextEditingController();
  final _minimumCasaCtrl = TextEditingController();
  final _metersEdificioCtrl = TextEditingController();
  final _minimumEdificioCtrl = TextEditingController();

  final List<TextEditingController> _distanceUptoCtrls = [];
  final List<TextEditingController> _distanceFactorCtrls = [];

  bool _loading = true;
  bool _saving = false;
  EvinkaConfig? _config;
  final List<CommercialProfile> _profiles = [];
  final Map<String, TextEditingController> _costCtrls = {};

  Color get _panelColor => Colors.white;
  Color get _metricColor => const Color(0xFFF8F3EC);
  Color get _fieldFillColor => const Color(0xFFF9F6F1);
  Color get _mutedText => const Color(0xFF6F5B46);
  Color get _borderColor => const Color(0x1F5A4632);

  InputDecoration _inputDecoration(String label) {
    return InputDecoration(
      labelText: label,
      filled: true,
      fillColor: _fieldFillColor,
      labelStyle: const TextStyle(color: Color(0xFF6B5641)),
      hintStyle: const TextStyle(color: Color(0xFF8A7764)),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: Color(0x1F1E1A16)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: Color(0x1F1E1A16)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: Color(0xFF7A4B21)),
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _companyCtrl.dispose();
    _taglineCtrl.dispose();
    _igvCtrl.dispose();
    _factorCostsCtrl.dispose();
    _divisorCtrl.dispose();
    _chargerFxCtrl.dispose();
    _miniboxPriceCtrl.dispose();
    _alienPriceCtrl.dispose();
    _max6Ctrl.dispose();
    _max10Ctrl.dispose();
    _metersCasaCtrl.dispose();
    _minimumCasaCtrl.dispose();
    _metersEdificioCtrl.dispose();
    _minimumEdificioCtrl.dispose();
    for (final ctrl in _distanceUptoCtrls) {
      ctrl.dispose();
    }
    for (final ctrl in _distanceFactorCtrls) {
      ctrl.dispose();
    }
    for (final ctrl in _costCtrls.values) {
      ctrl.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final config = await _api.getCatalog();
      _config = config;
      _profiles
        ..clear()
        ..addAll(config.commercialProfiles.map((e) => e.copyWith()));
      _companyCtrl.text = config.companyName;
      _taglineCtrl.text = config.companyTagline;
      _igvCtrl.text = config.defaults.igv.toString();
      _factorCostsCtrl.text = config.defaults.factorGeneralCosts.toString();
      _divisorCtrl.text = config.defaults.divisorMargin.toString();
      _chargerFxCtrl.text = config.defaults.chargerExchangeRate.toString();
      _miniboxPriceCtrl.text = config.defaults.miniboxPriceUsd.toString();
      _alienPriceCtrl.text = config.defaults.alienPriceUsd.toString();
      _max6Ctrl.text = config.defaults.max6mm.toString();
      _max10Ctrl.text = config.defaults.max10mm.toString();
      _metersCasaCtrl.text = config.defaults.includedMetersCasa.toString();
      _minimumCasaCtrl.text = config.defaults.minimumCasa.toString();
      _metersEdificioCtrl.text =
          config.defaults.includedMetersEdificio.toString();
      _minimumEdificioCtrl.text = config.defaults.minimumEdificio.toString();

      for (final ctrl in _distanceUptoCtrls) {
        ctrl.dispose();
      }
      for (final ctrl in _distanceFactorCtrls) {
        ctrl.dispose();
      }
      _distanceUptoCtrls
        ..clear()
        ..addAll(config.defaults.distanceFactors.map((e) =>
            TextEditingController(
                text: e.upto.isInfinite ? '>50' : e.upto.toString())));
      _distanceFactorCtrls
        ..clear()
        ..addAll(config.defaults.distanceFactors
            .map((e) => TextEditingController(text: e.factor.toString())));

      for (final ctrl in _costCtrls.values) {
        ctrl.dispose();
      }
      _costCtrls.clear();
      for (final item in config.catalog.items) {
        _costCtrls[item.code] =
            TextEditingController(text: item.costBase.toString());
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('No pude cargar la configuración: $e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    final config = _config;
    if (config == null) return;
    setState(() => _saving = true);
    try {
      final distanceFactors =
          List.generate(_distanceFactorCtrls.length, (index) {
        final uptoRaw = _distanceUptoCtrls[index].text.trim();
        return DistanceFactor(
          upto: uptoRaw.contains('>')
              ? double.infinity
              : (double.tryParse(uptoRaw) ?? 0),
          factor: double.tryParse(_distanceFactorCtrls[index].text.trim()) ?? 0,
        );
      });

      final updatedItems = config.catalog.items.map((item) {
        final cost =
            double.tryParse(_costCtrls[item.code]?.text.trim() ?? '') ??
                item.costBase;
        return item.copyWith(costBase: cost);
      }).toList();

      final nextConfig = config.copyWith(
        companyName: _companyCtrl.text.trim(),
        companyTagline: _taglineCtrl.text.trim(),
        defaults: config.defaults.copyWith(
          igv: double.tryParse(_igvCtrl.text.trim()) ?? config.defaults.igv,
          factorGeneralCosts: double.tryParse(_factorCostsCtrl.text.trim()) ??
              config.defaults.factorGeneralCosts,
          divisorMargin: double.tryParse(_divisorCtrl.text.trim()) ??
              config.defaults.divisorMargin,
          chargerExchangeRate: double.tryParse(_chargerFxCtrl.text.trim()) ??
              config.defaults.chargerExchangeRate,
          miniboxPriceUsd: double.tryParse(_miniboxPriceCtrl.text.trim()) ??
              config.defaults.miniboxPriceUsd,
          alienPriceUsd: double.tryParse(_alienPriceCtrl.text.trim()) ??
              config.defaults.alienPriceUsd,
          max6mm:
              double.tryParse(_max6Ctrl.text.trim()) ?? config.defaults.max6mm,
          max10mm: double.tryParse(_max10Ctrl.text.trim()) ??
              config.defaults.max10mm,
          includedMetersCasa: double.tryParse(_metersCasaCtrl.text.trim()) ??
              config.defaults.includedMetersCasa,
          minimumCasa: double.tryParse(_minimumCasaCtrl.text.trim()) ??
              config.defaults.minimumCasa,
          includedMetersEdificio:
              double.tryParse(_metersEdificioCtrl.text.trim()) ??
                  config.defaults.includedMetersEdificio,
          minimumEdificio: double.tryParse(_minimumEdificioCtrl.text.trim()) ??
              config.defaults.minimumEdificio,
          distanceFactors: distanceFactors,
        ),
        commercialProfiles: _profiles
            .asMap()
            .entries
            .map((entry) => entry.value.copyWith(isDefault: entry.key == 0))
            .toList(),
        catalog: config.catalog.copyWith(items: updatedItems),
      );

      final saved = await _api.updateCatalog(nextConfig);
      _config = saved;
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Cambios guardados.')));
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('No pude guardar: $e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _addProfile() {
    setState(() {
      _profiles.add(CommercialProfile(
        id: 'perfil-${DateTime.now().millisecondsSinceEpoch}',
        name: 'NUEVO PERFIL',
        marginPercent: 25,
        isDefault: false,
      ));
    });
  }

  void _removeProfile(int index) {
    if (_profiles.length <= 1) return;
    setState(() => _profiles.removeAt(index));
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.user.hasFullAccess) {
      return const Scaffold(
          body: Center(child: Text('Solo admin o supervisor.')));
    }
    return Scaffold(
      appBar: AppBar(
        title: const Text('Admin comercial'),
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh))
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _config == null
              ? const Center(child: Text('No hay configuración disponible.'))
              : SafeArea(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(16),
                    child: Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 1200),
                        child: Column(
                          children: [
                            _card(
                              'Empresa',
                              Icons.apartment_outlined,
                              _wrapFields([
                                _field(_companyCtrl, 'Empresa'),
                                _field(_taglineCtrl, 'Tagline'),
                                _field(_igvCtrl, 'IGV', number: true),
                              ]),
                            ),
                            const SizedBox(height: 16),
                            _card(
                              'Parámetros del cotizador',
                              Icons.tune,
                              Column(
                                children: [
                                  _wrapFields([
                                    _field(_factorCostsCtrl, 'Factor de costos',
                                        number: true),
                                    _field(_divisorCtrl, 'Divisor con margen',
                                        number: true),
                                    _field(_max6Ctrl, 'Máx. 6 mm',
                                        number: true),
                                    _field(_max10Ctrl, 'Máx. 10 mm',
                                        number: true),
                                    _field(_metersCasaCtrl,
                                        'Casa · metros incluidos',
                                        number: true),
                                    _field(_minimumCasaCtrl, 'Casa · mínimo',
                                        number: true),
                                    _field(_metersEdificioCtrl,
                                        'Edificio · metros incluidos',
                                        number: true),
                                    _field(_minimumEdificioCtrl,
                                        'Edificio · mínimo',
                                        number: true),
                                  ]),
                                  const SizedBox(height: 16),
                                  Align(
                                    alignment: Alignment.centerLeft,
                                    child: Text('Factores por distancia',
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleMedium
                                            ?.copyWith(
                                                fontWeight: FontWeight.w700)),
                                  ),
                                  const SizedBox(height: 10),
                                  ...List.generate(_distanceFactorCtrls.length,
                                      (index) {
                                    return Padding(
                                      padding:
                                          const EdgeInsets.only(bottom: 10),
                                      child: Row(
                                        children: [
                                          Expanded(
                                            child: _field(
                                                _distanceUptoCtrls[index],
                                                'Hasta (m)'),
                                          ),
                                          const SizedBox(width: 10),
                                          Expanded(
                                              child: _field(
                                                  _distanceFactorCtrls[index],
                                                  'Factor',
                                                  number: true)),
                                        ],
                                      ),
                                    );
                                  }),
                                ],
                              ),
                            ),
                            const SizedBox(height: 16),
                            _card(
                              'Cargadores y tipo de cambio',
                              Icons.ev_station_outlined,
                              _wrapFields([
                                _field(_chargerFxCtrl,
                                    'Tipo de cambio por defecto',
                                    number: true),
                                _field(_miniboxPriceCtrl,
                                    'EVINKA MiniBox · precio US\$',
                                    number: true),
                                _field(_alienPriceCtrl,
                                    'EVINKA Alien X · precio US\$',
                                    number: true),
                              ]),
                            ),
                            const SizedBox(height: 16),
                            _card(
                              'Perfiles comerciales',
                              Icons.badge_outlined,
                              Column(
                                children: [
                                  Align(
                                    alignment: Alignment.centerLeft,
                                    child: Text(
                                        'La primera fila queda como perfil general por defecto.',
                                        style: Theme.of(context)
                                            .textTheme
                                            .bodyMedium),
                                  ),
                                  const SizedBox(height: 12),
                                  ..._profiles.asMap().entries.map((entry) {
                                    final index = entry.key;
                                    final profile = entry.value;
                                    return Container(
                                      margin: const EdgeInsets.only(bottom: 10),
                                      padding: const EdgeInsets.all(14),
                                      decoration: BoxDecoration(
                                        color: _panelColor,
                                        borderRadius: BorderRadius.circular(18),
                                        border: Border.all(color: _borderColor),
                                      ),
                                      child: Column(
                                        children: [
                                          Row(
                                            children: [
                                              Expanded(
                                                child: Text(
                                                  'Perfil ${index + 1}',
                                                  style: TextStyle(
                                                    fontSize: 12,
                                                    fontWeight: FontWeight.w700,
                                                    color: _mutedText,
                                                  ),
                                                ),
                                              ),
                                              if (index == 0)
                                                Container(
                                                  padding: const EdgeInsets
                                                      .symmetric(
                                                      horizontal: 10,
                                                      vertical: 5),
                                                  decoration: BoxDecoration(
                                                    color:
                                                        const Color(0xFFEDE3D3),
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                            999),
                                                  ),
                                                  child: const Text(
                                                    'Default',
                                                    style: TextStyle(
                                                      fontSize: 11,
                                                      fontWeight:
                                                          FontWeight.w700,
                                                      color: Color(0xFF6B533B),
                                                    ),
                                                  ),
                                                )
                                              else
                                                IconButton(
                                                  onPressed: () =>
                                                      _removeProfile(index),
                                                  icon: const Icon(
                                                    Icons.delete_outline,
                                                    color: Color(0xFF7A4B21),
                                                  ),
                                                ),
                                            ],
                                          ),
                                          const SizedBox(height: 10),
                                          Row(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Expanded(
                                                child: TextFormField(
                                                  initialValue: profile.name,
                                                  style: const TextStyle(
                                                      color: Color(0xFF241A12)),
                                                  decoration: _inputDecoration(
                                                      'Nombre del perfil'),
                                                  onChanged: (value) =>
                                                      _profiles[index] =
                                                          _profiles[index]
                                                              .copyWith(
                                                                  name: value),
                                                ),
                                              ),
                                              const SizedBox(width: 12),
                                              SizedBox(
                                                width: 150,
                                                child: TextFormField(
                                                  initialValue: profile
                                                      .marginPercent
                                                      .toString(),
                                                  style: const TextStyle(
                                                      color: Color(0xFF241A12)),
                                                  keyboardType:
                                                      const TextInputType
                                                          .numberWithOptions(
                                                          decimal: true),
                                                  decoration: _inputDecoration(
                                                      'Margen %'),
                                                  onChanged: (value) =>
                                                      _profiles[index] =
                                                          _profiles[index]
                                                              .copyWith(
                                                    marginPercent: double
                                                            .tryParse(value) ??
                                                        profile.marginPercent,
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ],
                                      ),
                                    );
                                  }),
                                  Align(
                                    alignment: Alignment.centerLeft,
                                    child: OutlinedButton.icon(
                                        onPressed: _addProfile,
                                        icon: const Icon(Icons.add),
                                        label: const Text('Agregar perfil')),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 16),
                            _card(
                              'Catálogo maestro',
                              Icons.inventory_2_outlined,
                              Column(
                                children: _config!.catalog.items.map((item) {
                                  return Card(
                                    margin: const EdgeInsets.only(bottom: 10),
                                    color: _panelColor,
                                    child: Padding(
                                      padding: const EdgeInsets.all(14),
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                              '${item.code} · ${item.description}',
                                              style: const TextStyle(
                                                  fontWeight: FontWeight.w700)),
                                          const SizedBox(height: 4),
                                          Text(
                                              '${item.section} · ${item.unit} · ${item.rule}',
                                              style:
                                                  TextStyle(color: _mutedText)),
                                          const SizedBox(height: 10),
                                          Row(
                                            children: [
                                              Expanded(
                                                  child: _field(
                                                      _costCtrls[item.code]!,
                                                      'Costo base',
                                                      number: true)),
                                              const SizedBox(width: 12),
                                              Expanded(
                                                  child: _staticMetric(
                                                      'Ajustado',
                                                      _money(
                                                          item.costAdjusted))),
                                              const SizedBox(width: 12),
                                              Expanded(
                                                  child: _staticMetric(
                                                      'Precio actual',
                                                      _money(item
                                                          .priceWithMargin))),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                  );
                                }).toList(),
                              ),
                            ),
                            const SizedBox(height: 18),
                            SizedBox(
                              width: double.infinity,
                              child: FilledButton.icon(
                                onPressed: _saving ? null : _save,
                                icon: _saving
                                    ? const SizedBox(
                                        width: 18,
                                        height: 18,
                                        child: CircularProgressIndicator(
                                            strokeWidth: 2))
                                    : const Icon(Icons.save_outlined),
                                label: Text(_saving
                                    ? 'Guardando...'
                                    : 'Guardar cambios'),
                              ),
                            ),
                            const SizedBox(height: 12),
                            Text(
                              'Todo sigue el mismo backend del cotizador actual. Aquí estás editando exactamente la configuración comercial usada por la web.',
                              style: Theme.of(context).textTheme.bodySmall,
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
    );
  }

  Widget _card(String title, IconData icon, Widget child) {
    return Card(
      color: Colors.white,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Icon(icon),
              const SizedBox(width: 10),
              Text(title,
                  style: const TextStyle(
                      fontSize: 18, fontWeight: FontWeight.w800))
            ]),
            const SizedBox(height: 16),
            child,
          ],
        ),
      ),
    );
  }

  Widget _wrapFields(List<Widget> children) {
    final width = MediaQuery.of(context).size.width;
    final columns = width >= 1100
        ? 4
        : width >= 760
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
      {bool number = false}) {
    return TextFormField(
      controller: controller,
      keyboardType: number
          ? const TextInputType.numberWithOptions(decimal: true)
          : TextInputType.text,
      style: const TextStyle(color: Color(0xFF241A12)),
      decoration: _inputDecoration(label),
    );
  }

  Widget _staticMetric(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
      decoration: BoxDecoration(
        color: _metricColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(color: _mutedText, fontSize: 12)),
          const SizedBox(height: 6),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }

  String _money(double value) =>
      NumberFormat.currency(locale: 'es_PE', symbol: 'S/ ').format(value);
}
