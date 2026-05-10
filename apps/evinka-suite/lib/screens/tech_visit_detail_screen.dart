import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/evinka_app_models.dart';
import '../models/installation_order_model.dart';
import '../services/cotizador_service.dart';
import '../services/evinka_api_service.dart';
import 'conformidad_module_screen.dart';
import 'quote_builder_screen.dart';

class TechVisitDetailScreen extends StatefulWidget {
  const TechVisitDetailScreen({
    super.key,
    required this.user,
    required this.visit,
  });

  final EvinkaUser user;
  final TechVisit visit;

  @override
  State<TechVisitDetailScreen> createState() => _TechVisitDetailScreenState();
}

class _TechVisitDetailScreenState extends State<TechVisitDetailScreen> {
  final _api = EvinkaApiService.instance;
  late TechVisit _visit;
  QuoteRecord? _quote;
  InstallationOrderModel? _order;
  bool _busy = false;

  bool get _isDark => Theme.of(context).brightness == Brightness.dark;
  Color get _panelColor => _isDark ? const Color(0xFF151515) : Colors.white;
  Color get _borderColor =>
      _isDark ? const Color(0x1FFFFFFF) : const Color(0x1F5A4632);
  Color get _mutedText => _isDark ? Colors.white70 : const Color(0xFF6F5B46);
  Color get _strongText => _isDark ? Colors.white : const Color(0xFF241A12);

  bool get _hasGeneratedConformity => _quote?.hasGeneratedConformity == true;
  bool get _canOpenConformidad =>
      _visit.installationOrderId.isNotEmpty && !_hasGeneratedConformity;
  bool get _canCloseVisitNow =>
      !_visit.isClosed &&
      (_visit.isPendingClose || _visit.status == 'visitada');
  bool get _canManageCommercialFlow => widget.user.canEditCommercialFlow;

  @override
  void initState() {
    super.initState();
    _visit = widget.visit;
    _loadLinkedQuote();
    _loadLinkedOrder();
  }

  Future<void> _loadLinkedQuote() async {
    final quoteId = _visit.quoteId.trim();
    if (quoteId.isEmpty) {
      if (mounted) setState(() => _quote = null);
      return;
    }
    try {
      final quote = await _api.getQuote(quoteId);
      if (!mounted) return;
      setState(() => _quote = quote);
    } catch (e) {
      if (!mounted) return;
      setState(() => _quote = null);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No pude cargar la cotización vinculada: $e')),
      );
    }
  }

  Future<void> _loadLinkedOrder() async {
    final orderId = _visit.installationOrderId.trim();
    if (orderId.isEmpty) {
      if (mounted) setState(() => _order = null);
      return;
    }
    try {
      final order = await CotizadorService.cargarOrden(orderId);
      if (!mounted) return;
      setState(() => _order = order);
    } catch (_) {
      if (!mounted) return;
      setState(() => _order = null);
    }
  }

  String get _districtLabel {
    final city = _order?.city.trim() ?? '';
    if (city.isNotEmpty) return city;
    final address = _visit.clientAddress.trim();
    if (address.isEmpty) return '';
    final parts = address
        .split(',')
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toList();
    if (parts.length >= 2) return parts[parts.length - 2];
    if (parts.isNotEmpty) return parts.last;
    return '';
  }

  String get _navigationTarget {
    final address = ((_order?.address.trim().isNotEmpty ?? false)
            ? _order!.address.trim()
            : _visit.clientAddress.trim())
        .trim();
    final district = _districtLabel;
    if (address.isEmpty) return district;
    if (district.isEmpty) return address;
    if (address.toLowerCase().contains(district.toLowerCase())) return address;
    return '$address, $district';
  }

  Future<void> _openGoogleMapsRoute() async {
    final target = _navigationTarget;
    if (target.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Falta dirección o distrito para abrir la ruta.'),
        ),
      );
      return;
    }
    final uri = Uri.parse(
      'https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(target)}',
    );
    try {
      final opened = await launchUrl(uri, mode: LaunchMode.externalApplication)
          .timeout(const Duration(seconds: 12), onTimeout: () {
        throw TimeoutException('Tiempo agotado al abrir Google Maps.');
      });
      if (!opened) {
        throw Exception('No se pudo abrir Google Maps en este dispositivo.');
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No pude abrir Google Maps: $e')),
      );
    }
  }

  Future<void> _openWazeRoute() async {
    final target = _navigationTarget;
    if (target.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Falta dirección o distrito para abrir la ruta.'),
        ),
      );
      return;
    }
    final uri = Uri.parse(
      'https://waze.com/ul?q=${Uri.encodeComponent(target)}&navigate=yes',
    );
    try {
      final opened = await launchUrl(uri, mode: LaunchMode.externalApplication)
          .timeout(const Duration(seconds: 12), onTimeout: () {
        throw TimeoutException('Tiempo agotado al abrir Waze.');
      });
      if (!opened) {
        throw Exception('No se pudo abrir Waze en este dispositivo.');
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No pude abrir Waze: $e')),
      );
    }
  }

  Future<void> _openRouteChooser() async {
    final target = _navigationTarget;
    final district = _districtLabel;
    if (target.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content:
              Text('Esta visita aún no tiene dirección utilizable para ruta.'),
        ),
      );
      return;
    }
    await showModalBottomSheet<void>(
      context: context,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Cómo llegar',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 8),
              Text(target),
              if (district.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  'Distrito: $district',
                  style:
                      TextStyle(color: _mutedText, fontWeight: FontWeight.w600),
                ),
              ],
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () {
                    Navigator.pop(context);
                    _openGoogleMapsRoute();
                  },
                  icon: const Icon(Icons.map_outlined),
                  label: const Text('Abrir en Google Maps'),
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () {
                    Navigator.pop(context);
                    _openWazeRoute();
                  },
                  icon: const Icon(Icons.route_outlined),
                  label: const Text('Abrir en Waze'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _markEnRutaAndNavigate() async {
    final ok = await _updateVisit('en_ruta');
    if (!ok || !mounted) return;
    await _openRouteChooser();
  }

  Future<void> _reloadVisit() async {
    try {
      final visits = await _api.getTechVisits();
      final fresh = visits.where((item) => item.id == _visit.id).firstOrNull;
      if (fresh != null && mounted) {
        setState(() => _visit = fresh);
        await _loadLinkedQuote();
        await _loadLinkedOrder();
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No pude recargar la visita: $e')),
      );
    }
  }

  Future<bool> _updateVisit(
    String status, {
    String? notes,
    String? resolution,
    String? quoteId,
    String? installationOrderId,
  }) async {
    setState(() => _busy = true);
    try {
      final updated = await _api.updateTechVisit(
        _visit.id,
        status: status,
        notes: notes,
        resolution: resolution,
        quoteId: quoteId,
        installationOrderId: installationOrderId,
        checklist: _visit.checklist,
      );
      if (!mounted) return false;
      setState(() => _visit = updated);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Visita actualizada: ${updated.statusLabel}')),
      );
      return true;
    } catch (e) {
      if (!mounted) return false;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No pude actualizar la visita: $e')),
      );
      return false;
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _closeVisit() async {
    final controller = TextEditingController(text: _visit.resolution);
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Cerrar visita'),
        content: TextField(
          controller: controller,
          maxLines: 4,
          decoration: const InputDecoration(
            labelText: 'Resultado / observaciones finales',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Cerrar visita'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    await _updateVisit('cerrada', resolution: controller.text.trim());
  }

  Future<void> _openConformidad() async {
    if (_visit.installationOrderId.isEmpty) return;
    try {
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => ConformidadModuleScreen(
            initialOrderCode: _visit.installationOrderId,
          ),
        ),
      );
      await _reloadVisit();
      await _loadLinkedQuote();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No pude abrir conformidad: $e')),
      );
    }
  }

  Future<void> _confirmQuote() async {
    if (_visit.quoteId.isEmpty) return;
    setState(() => _busy = true);
    try {
      final updatedQuote = await _api.updateQuoteStatus(
        _visit.quoteId,
        status: 'lista_envio',
        visitId: _visit.id,
        reference: _visit.reference,
      );
      final updated = await _api.updateTechVisit(
        _visit.id,
        status: 'lista_envio',
        quoteId: updatedQuote.id,
        installationOrderId: updatedQuote.installationOrderId,
        notes: _visit.notes,
        checklist: _visit.checklist,
      );
      if (!mounted) return;
      setState(() {
        _visit = updated;
        _quote = updatedQuote;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Cotización validada. Ya quedó lista para enviar.'),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No pude confirmar la cotización: $e')),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _markClientAccepted() async {
    final quote = _quote;
    if (quote == null) return;
    setState(() => _busy = true);
    try {
      final updatedQuote = await _api.updateQuoteStatus(
        quote.id,
        status: 'aceptada_cliente',
        visitId: _visit.id,
        reference: _visit.reference,
      );
      final updatedVisit = await _api.updateTechVisit(
        _visit.id,
        status: 'aceptada_cliente',
        quoteId: updatedQuote.id,
        installationOrderId: updatedQuote.installationOrderId,
        notes: _visit.notes,
        checklist: _visit.checklist,
      );
      if (!mounted) return;
      setState(() {
        _quote = updatedQuote;
        _visit = updatedVisit;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
              'Cliente marcado como aceptado. Falta agendar la instalación.'),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No pude registrar la aceptación: $e')),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _requestRecotizar() async {
    final quote = _quote;
    if (quote == null) return;
    final ok = await _confirmAction(
      title: 'Marcar para recotizar',
      message:
          'La cotización de ${quote.clientName} volverá a estado recotizar. ¿Continuar?',
    );
    if (!ok) return;
    setState(() => _busy = true);
    try {
      final updatedQuote = await _api.updateQuoteStatus(
        quote.id,
        status: 'recotizar',
        visitId: _visit.id,
        reference: _visit.reference,
      );
      final updatedVisit = await _api.updateTechVisit(
        _visit.id,
        status: 'recotizar',
        quoteId: updatedQuote.id,
        installationOrderId: updatedQuote.installationOrderId,
        notes: _visit.notes,
        checklist: _visit.checklist,
      );
      if (!mounted) return;
      setState(() {
        _quote = updatedQuote;
        _visit = updatedVisit;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('La visita volvió a estado recotizar.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No pude marcar recotizar: $e')),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancelQuote() async {
    final quote = _quote;
    if (quote == null) return;
    final ok = await _confirmAction(
      title: 'Cancelar cotización',
      message:
          'La cotización de ${quote.clientName} quedará cancelada. ¿Continuar?',
    );
    if (!ok) return;
    setState(() => _busy = true);
    try {
      final updatedQuote = await _api.updateQuoteStatus(
        quote.id,
        status: 'cancelada',
        visitId: _visit.id,
        reference: _visit.reference,
      );
      final updatedVisit = await _api.updateTechVisit(
        _visit.id,
        status: 'cancelada',
        quoteId: updatedQuote.id,
        installationOrderId: updatedQuote.installationOrderId,
        notes: _visit.notes,
        checklist: _visit.checklist,
      );
      if (!mounted) return;
      setState(() {
        _quote = updatedQuote;
        _visit = updatedVisit;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cotización cancelada correctamente.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No pude cancelar la cotización: $e')),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _scheduleInstallation() async {
    final quote = _quote;
    if (quote == null) return;
    final initialDate = _visit.scheduledDate ?? DateTime.now();
    final pickedDate = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 120)),
    );
    if (pickedDate == null || !mounted) return;

    final pickedTime = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(initialDate),
    );
    if (pickedTime == null || !mounted) return;

    final timeLabel = MaterialLocalizations.of(context).formatTimeOfDay(
      pickedTime,
      alwaysUse24HourFormat: false,
    );
    final timeCtrl = TextEditingController(
      text: timeLabel,
    );
    final addressCtrl = TextEditingController(text: _visit.clientAddress);
    final phoneCtrl = TextEditingController(text: _visit.clientPhone);
    final notesCtrl = TextEditingController(text: _visit.notes);

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Agendar instalación'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Fecha: ${DateFormat('dd/MM/yyyy').format(pickedDate)}',
              ),
              const SizedBox(height: 8),
              Text('Hora: $timeLabel'),
              const SizedBox(height: 12),
              TextField(
                controller: timeCtrl,
                decoration: const InputDecoration(
                  labelText: 'Hora / rango horario',
                  hintText: '10:00 a. m. - 12:00 p. m.',
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: addressCtrl,
                maxLines: 2,
                decoration: const InputDecoration(labelText: 'Dirección'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: phoneCtrl,
                decoration: const InputDecoration(labelText: 'Teléfono'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: notesCtrl,
                maxLines: 3,
                decoration: const InputDecoration(labelText: 'Notas'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Guardar cita'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    final scheduledAt = DateTime(
      pickedDate.year,
      pickedDate.month,
      pickedDate.day,
      pickedTime.hour,
      pickedTime.minute,
    ).toUtc().toIso8601String();

    setState(() => _busy = true);
    try {
      final result = await _api.scheduleInstallation(
        quote.id,
        scheduledAt: scheduledAt,
        timeWindow: timeCtrl.text.trim(),
        visitId: _visit.id,
        notes: notesCtrl.text.trim(),
        clientPhone: phoneCtrl.text.trim(),
        clientAddress: addressCtrl.text.trim(),
        assignedTechEmail: _visit.assignedTechEmail.isEmpty
            ? widget.user.email
            : _visit.assignedTechEmail,
      );
      final nextVisit = TechVisit.fromJson(
        Map<String, dynamic>.from(result['visit'] as Map? ?? {}),
      );
      final nextQuote = QuoteRecord.fromJson(
        Map<String, dynamic>.from(result['quote'] as Map? ?? {}),
      );
      if (!mounted) return;
      setState(() {
        _visit = nextVisit;
        _quote = nextQuote;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cita agendada correctamente.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No pude agendar la instalación: $e')),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openQuoteBuilder() async {
    try {
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => QuoteBuilderScreen(
            user: widget.user,
            initialVisit: _visit,
          ),
        ),
      );
      await _reloadVisit();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No pude abrir el cotizador: $e')),
      );
    }
  }

  Future<void> _openQuotePdf() async {
    final quote = _quote;
    if (quote == null || quote.pdfPath.isEmpty) return;
    setState(() => _busy = true);
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
      if (mounted) setState(() => _busy = false);
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

  Future<void> _launchExternal(String value, String scheme) async {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return;
    final uri = Uri.parse('$scheme$trimmed');
    try {
      final opened = await launchUrl(uri, mode: LaunchMode.externalApplication)
          .timeout(const Duration(seconds: 10), onTimeout: () {
        throw TimeoutException('Tiempo agotado al abrir la app externa.');
      });
      if (!opened) {
        throw Exception('No se pudo abrir la app externa.');
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No pude abrir la acción externa: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Detalle de visita'),
        actions: [
          IconButton(
              onPressed: _busy ? null : _reloadVisit,
              icon: const Icon(Icons.refresh)),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _reloadVisit,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _hero(theme),
              const SizedBox(height: 16),
              _actionNow(theme),
              const SizedBox(height: 16),
              _sectionCard(
                theme,
                title: 'Visita',
                subtitle:
                    'Marca el avance físico real: evaluación, instalación y cierre sin arrastrar pasos viejos.',
                initiallyExpanded: _visit.needsQuote ||
                    _visit.status == 'agendada' ||
                    _visit.status == 'en_ruta' ||
                    _visit.status == 'en_visita' ||
                    _canCloseVisitNow,
                child: _visitActionsBody(),
              ),
              const SizedBox(height: 12),
              _sectionCard(
                theme,
                title: 'Cotización',
                subtitle: _hasGeneratedConformity
                    ? 'La parte comercial ya quedó cerrada con conformidad emitida.'
                    : _visit.needsQuoteConfirmation
                        ? 'Ya está lista para confirmarse.'
                        : _visit.hasQuote
                            ? 'La cotización ya existe en el flujo.'
                            : 'Aquí debería pasar el paso comercial.',
                initiallyExpanded: !_hasGeneratedConformity &&
                    (_visit.needsQuote ||
                        _visit.needsQuoteConfirmation ||
                        _visit.needsClientDecision ||
                        _visit.needsScheduling),
                child: _quoteActionsBody(),
              ),
              const SizedBox(height: 12),
              _sectionCard(
                theme,
                title: 'Conformidad',
                subtitle: _hasGeneratedConformity
                    ? 'La conformidad ya fue emitida. Solo falta cerrar la visita.'
                    : 'Solo aparece como paso real cuando la instalación ya terminó y existe orden.',
                initiallyExpanded:
                    _visit.needsConformity || _hasGeneratedConformity,
                child: _conformidadBody(),
              ),
              const SizedBox(height: 12),
              _sectionCard(
                theme,
                title: 'Datos y contacto',
                subtitle:
                    'Resumen rápido del cliente, trazabilidad y contacto.',
                child: _detailsBody(),
              ),
              if (_visit.checklist.isNotEmpty) ...[
                const SizedBox(height: 12),
                _sectionCard(
                  theme,
                  title: 'Checklist',
                  subtitle: 'Recordatorios sugeridos para el técnico.',
                  child: _checklistBody(),
                ),
              ],
              if (_visit.notes.isNotEmpty || _visit.resolution.isNotEmpty) ...[
                const SizedBox(height: 12),
                _sectionCard(
                  theme,
                  title: 'Notas y cierre',
                  subtitle: 'Contexto de agenda y resultado final.',
                  child: _notesBody(),
                ),
              ],
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _hero(ThemeData theme) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: _isDark
            ? const LinearGradient(
                colors: [Color(0xFF171717), Color(0xFF0E0E0E)])
            : const LinearGradient(
                colors: [Color(0xFFFFFFFF), Color(0xFFF2ECE4)]),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(
          color: _isDark ? const Color(0x337DA2FF) : const Color(0x3355331A),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
              'Visita ${_visit.reference.isEmpty ? _visit.id : _visit.reference}',
              style: theme.textTheme.labelLarge?.copyWith(
                  color: _isDark
                      ? const Color(0xFF9FC2FF)
                      : const Color(0xFF55331A),
                  fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text(_visit.clientName.isEmpty ? 'Cliente EVINKA' : _visit.clientName,
              style: theme.textTheme.headlineSmall
                  ?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 10),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _pill(_visit.typeLabel, tone: _typeTone),
              _pill(_visit.statusLabel),
              if (_visit.source.isNotEmpty) _pill('Origen ${_visit.source}'),
              if (_visit.scheduledDate != null)
                _pill(_formatDateTime(_visit.scheduledAt)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _actionNow(ThemeData theme) {
    var primaryLabel = _visit.nextActionLabel;
    VoidCallback? primaryAction;
    IconData primaryIcon = Icons.open_in_new_outlined;
    String helperText = 'Aquí puedes avanzar el flujo paso a paso.';

    if (_visit.isHappeningNow) {
      helperText =
          'Esta es tu visita activa del momento. Te conviene abrirla y avanzar sin buscar nada más.';
    }
    if (_hasGeneratedConformity) {
      primaryLabel = 'Cerrar visita';
      primaryAction = _closeVisit;
      primaryIcon = Icons.task_alt_outlined;
      helperText =
          'La conformidad ya fue generada y compartida. Aquí ya solo corresponde cerrar la visita.';
    } else if (_visit.status == 'agendada') {
      primaryAction = _markEnRutaAndNavigate;
      primaryIcon = Icons.route_outlined;
      helperText = _visit.isInstallation
          ? 'La instalación ya está agendada. El siguiente paso operativo es salir en ruta.'
          : 'La visita de evaluación ya está agendada. El siguiente paso operativo es salir en ruta.';
    } else if (_visit.status == 'en_ruta') {
      primaryAction = () => _updateVisit('en_visita');
      primaryIcon = Icons.place_outlined;
      helperText = 'Ya vas en camino. Cuando llegues, marca en visita.';
    } else if (_visit.needsQuote) {
      if (!_canManageCommercialFlow) primaryLabel = 'Pendiente comercial';
      primaryAction = _canManageCommercialFlow ? _openQuoteBuilder : null;
      primaryIcon = Icons.request_quote_outlined;
      helperText = _canManageCommercialFlow
          ? (_visit.isInstallation
              ? 'Esta visita es de instalación, pero aún requiere cotización antes de seguir.'
              : 'El siguiente paso real es cotizar esta visita de evaluación.')
          : 'La visita ya quedó lista para diagnóstico. La cotización la continúa el área comercial.';
    } else if (_visit.needsQuoteConfirmation) {
      if (!_canManageCommercialFlow) primaryLabel = 'Pendiente comercial';
      primaryAction = _canManageCommercialFlow ? _confirmQuote : null;
      primaryIcon = Icons.verified_outlined;
      helperText = _canManageCommercialFlow
          ? 'La cotización ya está lista. Ahora toca validarla para envío.'
          : 'La cotización ya existe, pero su validación queda del lado comercial.';
    } else if (_visit.needsClientDecision) {
      if (!_canManageCommercialFlow) primaryLabel = 'Seguimiento comercial';
      primaryAction = null;
      primaryIcon = Icons.mark_email_read_outlined;
      helperText = _canManageCommercialFlow
          ? 'La cotización ya salió. Ahora registra si el cliente acepta, pide recotizar o cancela.'
          : 'La cotización ya salió. El seguimiento con el cliente lo lleva el área comercial.';
    } else if (_visit.needsScheduling) {
      if (!_canManageCommercialFlow) primaryLabel = 'Pendiente de agenda';
      primaryAction = _canManageCommercialFlow ? _scheduleInstallation : null;
      primaryIcon = Icons.event_available_outlined;
      helperText = _canManageCommercialFlow
          ? 'El cliente aceptó. Ahora sí toca agendar la instalación.'
          : 'La cotización ya fue aceptada. La agenda de instalación queda pendiente de coordinación.';
    } else if (_visit.canMarkInstallationCompleted) {
      primaryAction = () => _updateVisit('pendiente_conformidad');
      primaryIcon = Icons.home_repair_service_outlined;
      helperText =
          'La instalación ya terminó. Ahora márcala como instalada para pasar a conformidad.';
    } else if (_visit.canMarkVisitCompleted) {
      primaryAction = () => _updateVisit('visitada');
      primaryIcon = Icons.assignment_turned_in_outlined;
      helperText =
          'La evaluación ya terminó. Márcala como visitada para cerrar o cotizar.';
    } else if (_visit.needsConformity) {
      primaryAction = _openConformidad;
      primaryIcon = Icons.fact_check_outlined;
      helperText =
          'La instalación ya quedó terminada. Ahora corresponde abrir conformidad.';
    } else if (_canCloseVisitNow) {
      primaryAction = _closeVisit;
      primaryIcon = Icons.task_alt_outlined;
      helperText =
          'La visita ya fue atendida. Solo falta cerrarla correctamente.';
    }

    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Siguiente acción',
                style: theme.textTheme.titleLarge
                    ?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Text(helperText),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed:
                    _busy || primaryAction == null ? null : primaryAction,
                icon: Icon(primaryIcon),
                label: Text(primaryLabel),
              ),
            ),
            if (_visit.clientPhone.isNotEmpty) ...[
              const SizedBox(height: 10),
              Align(
                alignment: Alignment.centerLeft,
                child: OutlinedButton.icon(
                  onPressed: () => _launchExternal(_visit.clientPhone, 'tel:'),
                  icon: const Icon(Icons.call_outlined),
                  label: const Text('Llamar al cliente'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _sectionCard(
    ThemeData theme, {
    required String title,
    required String subtitle,
    required Widget child,
    bool initiallyExpanded = false,
  }) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Theme(
        data: theme.copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          initiallyExpanded: initiallyExpanded,
          tilePadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
          childrenPadding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
          title: Text(title,
              style: theme.textTheme.titleLarge
                  ?.copyWith(fontWeight: FontWeight.w800)),
          subtitle: Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(subtitle),
          ),
          children: [child],
        ),
      ),
    );
  }

  Widget _visitActionsBody() {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        OutlinedButton.icon(
          onPressed:
              _busy || !['agendada', 'aceptada_cliente'].contains(_visit.status)
                  ? null
                  : _markEnRutaAndNavigate,
          icon: const Icon(Icons.route_outlined),
          label: const Text('En ruta'),
        ),
        OutlinedButton.icon(
          onPressed: _busy || _visit.status != 'en_ruta'
              ? null
              : () => _updateVisit('en_visita'),
          icon: const Icon(Icons.place_outlined),
          label: const Text('En visita'),
        ),
        OutlinedButton.icon(
          onPressed: _busy || !_visit.canMarkVisitCompleted
              ? null
              : () => _updateVisit('visitada'),
          icon: const Icon(Icons.assignment_turned_in_outlined),
          label: const Text('Marcar visitada'),
        ),
        OutlinedButton.icon(
          onPressed: _busy || !_visit.canMarkInstallationCompleted
              ? null
              : () => _updateVisit('pendiente_conformidad'),
          icon: const Icon(Icons.home_repair_service_outlined),
          label: const Text('Marcar instalada'),
        ),
        if (_canCloseVisitNow)
          TextButton.icon(
            onPressed: _busy ? null : _closeVisit,
            icon: const Icon(Icons.task_alt_outlined),
            label: const Text('Cerrar visita'),
          ),
      ],
    );
  }

  Widget _quoteActionsBody() {
    final quote = _quote;
    if (_hasGeneratedConformity) {
      return Text(
        'La cotización ya completó su recorrido. No deberían quedar acciones comerciales activas en esta visita.',
        style: TextStyle(color: _mutedText),
      );
    }
    if (!widget.user.canSeeCommercialData) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'La cotización vinculada queda visible solo como trazabilidad. Los importes, márgenes y acciones comerciales están ocultos para este rol.',
            style: TextStyle(color: _mutedText),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              if (_visit.quoteId.isNotEmpty)
                _info('Cotización', _visit.quoteId),
              _info('Estado', quote?.statusLabel ?? 'Pendiente comercial'),
              if (_visit.installationOrderId.isNotEmpty)
                _info('Orden', _visit.installationOrderId),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            _visit.needsQuote
                ? 'Pendiente de cotización por el área comercial.'
                : _visit.needsQuoteConfirmation
                    ? 'Pendiente de validación comercial.'
                    : _visit.needsClientDecision
                        ? 'Pendiente de respuesta comercial del cliente.'
                        : _visit.needsScheduling
                            ? 'Pendiente de agenda de instalación.'
                            : 'Sin acciones comerciales disponibles para este rol.',
            style: TextStyle(color: _mutedText),
          ),
        ],
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_visit.quoteId.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _info('Cotización actual', _visit.quoteId),
          ),
        if (quote != null) ...[
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              _info('Cliente', quote.clientName),
              _info(
                  'Total',
                  NumberFormat.currency(locale: 'es_PE', symbol: 'S/ ')
                      .format(quote.total)),
              _info('Estado', quote.statusLabel),
              _info('Correo', quote.email.isEmpty ? '-' : quote.email),
            ],
          ),
          const SizedBox(height: 12),
        ],
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            FilledButton.icon(
              onPressed: _busy ? null : _openQuoteBuilder,
              icon: const Icon(Icons.request_quote_outlined),
              label: Text(
                  _visit.hasQuote ? 'Ver / revisar cotización' : 'Cotizar'),
            ),
            if (quote?.pdfPath.isNotEmpty == true)
              OutlinedButton.icon(
                onPressed: _busy ? null : _openQuotePdf,
                icon: const Icon(Icons.picture_as_pdf_outlined),
                label: const Text('Abrir PDF'),
              ),
            if (quote?.canConfirmForSend == true)
              FilledButton.tonalIcon(
                onPressed: _busy ? null : _confirmQuote,
                icon: const Icon(Icons.verified_outlined),
                label: const Text('Confirmar cotización'),
              ),
            if (quote?.canMarkClientAccepted == true)
              FilledButton.icon(
                onPressed: _busy ? null : _markClientAccepted,
                icon: const Icon(Icons.thumb_up_alt_outlined),
                label: const Text('Cliente acepta'),
              ),
            if (quote?.canRequestRecotizar == true)
              OutlinedButton.icon(
                onPressed: _busy ? null : _requestRecotizar,
                icon: const Icon(Icons.refresh_outlined),
                label: const Text('Recotizar'),
              ),
            if (quote?.canCancel == true)
              OutlinedButton.icon(
                onPressed: _busy ? null : _cancelQuote,
                icon: const Icon(Icons.cancel_outlined),
                label: const Text('Cotización cancelada'),
              ),
            if (quote?.canScheduleInstallation == true)
              FilledButton.icon(
                onPressed: _busy ? null : _scheduleInstallation,
                icon: const Icon(Icons.event_available_outlined),
                label: const Text('Agendar instalación'),
              ),
          ],
        ),
        if (quote != null && quote.canConfirmForSend)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(
              'Desde aquí comercial puede revisar la cotización, validarla para envío y registrar la respuesta del cliente.',
              style: TextStyle(color: _mutedText),
            ),
          ),
      ],
    );
  }

  Widget _conformidadBody() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_visit.installationOrderId.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _info('Orden lista', _visit.installationOrderId),
          ),
        Text(
          _hasGeneratedConformity
              ? 'La conformidad ya fue generada. Vuelve a la parte de visita para cerrarla.'
              : _visit.needsConformity
                  ? 'La instalación ya está lista. Desde aquí sí corresponde abrir conformidad.'
                  : 'Este bloque se activa cuando la instalación ya terminó y existe orden.',
        ),
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: _busy || !_canOpenConformidad ? null : _openConformidad,
          icon: const Icon(Icons.fact_check_outlined),
          label: Text(_hasGeneratedConformity
              ? 'Conformidad generada'
              : 'Abrir conformidad'),
        ),
      ],
    );
  }

  Widget _detailsBody() {
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: [
        _info('Cliente', _visit.clientName),
        _info(
            'Dirección',
            _navigationTarget.isEmpty
                ? _visit.clientAddress
                : _navigationTarget),
        if (_districtLabel.isNotEmpty) _info('Distrito', _districtLabel),
        _info('Horario',
            _formatDateTime(_visit.scheduledAt, fallback: _visit.timeWindow)),
        _info(
            'Técnico',
            _visit.assignedTechName.isEmpty
                ? widget.user.name
                : _visit.assignedTechName),
        if (_visit.clientPhone.isNotEmpty)
          _info('Teléfono', _visit.clientPhone),
        if (_visit.clientEmail.isNotEmpty) _info('Correo', _visit.clientEmail),
        if (_visit.quoteId.isNotEmpty) _info('Cotización', _visit.quoteId),
        if (_visit.installationOrderId.isNotEmpty)
          _info('Orden', _visit.installationOrderId),
      ],
    );
  }

  Widget _checklistBody() {
    return Column(
      children: _visit.checklist
          .map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.check_circle_outline, size: 18),
                  const SizedBox(width: 8),
                  Expanded(child: Text(item)),
                ],
              ),
            ),
          )
          .toList(),
    );
  }

  Widget _notesBody() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_visit.notes.isNotEmpty) ...[
          const Text('Notas de agenda',
              style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text(_visit.notes),
        ],
        if (_visit.resolution.isNotEmpty) ...[
          const SizedBox(height: 14),
          const Text('Resolución',
              style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text(_visit.resolution),
        ],
      ],
    );
  }

  Widget _info(String label, String value) {
    return Container(
      width: 250,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _panelColor,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(color: _mutedText, fontSize: 12)),
          const SizedBox(height: 6),
          Text(value.isEmpty ? '-' : value,
              style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }

  Color get _typeTone =>
      _visit.isInstallation ? const Color(0xFF7C3AED) : const Color(0xFF0F766E);

  Widget _pill(String text, {Color? tone}) {
    final color =
        tone ?? (_isDark ? const Color(0x557DA2FF) : const Color(0x3355331A));
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: tone != null
            ? color.withValues(alpha: _isDark ? 0.28 : 0.14)
            : (_isDark ? const Color(0x332B4D73) : const Color(0x1455331A)),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: tone != null
              ? color.withValues(alpha: 0.4)
              : (_isDark ? const Color(0x557DA2FF) : const Color(0x3355331A)),
        ),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontWeight: FontWeight.w700,
          color: tone != null && (_isDark || color.computeLuminance() < 0.45)
              ? Colors.white
              : _strongText,
        ),
      ),
    );
  }

  String _formatDateTime(String value, {String fallback = '-'}) {
    final parsed = DateTime.tryParse(value);
    if (parsed == null) return fallback;
    return DateFormat('EEE d MMM · hh:mm a', 'es').format(parsed.toLocal());
  }
}

extension<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
