import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/evinka_app_models.dart';
import '../services/evinka_api_service.dart';
import '../services/historial_service.dart';
import 'conformidad_module_screen.dart';
import 'tech_visit_detail_screen.dart';

class TechnicianWorkboardScreen extends StatefulWidget {
  const TechnicianWorkboardScreen({super.key, required this.user});

  final EvinkaUser user;

  @override
  State<TechnicianWorkboardScreen> createState() =>
      _TechnicianWorkboardScreenState();
}

class _TechnicianWorkboardScreenState extends State<TechnicianWorkboardScreen> {
  final _api = EvinkaApiService.instance;
  bool _loading = true;
  List<QuoteRecord> _pendingOrders = const [];
  List<HistorialEntry> _syncPending = const [];
  List<TechVisit> _visits = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final quotes = await _api.getQuotes();
      final pendingSync = await HistorialService.cargarPendientesSync();
      final visits = await _api.getTechVisits();
      final pendingOrders = quotes.where((quote) {
        return quote.installationOrderId.isNotEmpty &&
            quote.conformityStatus.toLowerCase() != 'pdf_generated';
      }).toList()
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
      visits.sort((a, b) {
        final ad =
            a.scheduledDate ?? DateTime.tryParse(a.createdAt) ?? DateTime(2100);
        final bd =
            b.scheduledDate ?? DateTime.tryParse(b.createdAt) ?? DateTime(2100);
        return ad.compareTo(bd);
      });
      if (!mounted) return;
      setState(() {
        _pendingOrders = pendingOrders;
        _syncPending = pendingSync;
        _visits = visits;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No pude cargar el tablero técnico: $e')),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<TechVisit> get _quotePending =>
      _visits.where((item) => item.needsQuote && !item.isClosed).toList();
  List<TechVisit> get _conformityPending =>
      _visits.where((item) => item.needsConformity && !item.isClosed).toList();
  List<TechVisit> get _todayOpen =>
      _visits.where((item) => item.isToday && !item.isClosed).toList();

  Color get _mutedText => Theme.of(context).brightness == Brightness.dark
      ? Colors.white70
      : const Color(0xFF6F5B46);

  Future<void> _openConformidad(String orderId) async {
    try {
      await Navigator.of(context).push(
        MaterialPageRoute(
            builder: (_) => ConformidadModuleScreen(initialOrderCode: orderId)),
      );
      if (mounted) await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No pude abrir conformidad: $e')),
      );
    }
  }

  Future<void> _openVisit(TechVisit visit) async {
    try {
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) =>
              TechVisitDetailScreen(user: widget.user, visit: visit),
        ),
      );
      if (mounted) await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No pude abrir la visita: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Pendientes'),
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh))
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _summaryRow(),
                  const SizedBox(height: 16),
                  _sectionTitle(
                      'Para hoy', '${_todayOpen.length} visitas abiertas'),
                  const SizedBox(height: 10),
                  if (_todayOpen.isEmpty)
                    _emptyCard('No tienes pendientes de hoy.')
                  else
                    ..._todayOpen
                        .map((visit) => _visitCard(visit, compact: true)),
                  const SizedBox(height: 20),
                  _sectionTitle('Pendientes de cotización comercial',
                      '${_quotePending.length} por atender'),
                  const SizedBox(height: 10),
                  if (_quotePending.isEmpty)
                    _emptyCard(
                        'No tienes visitas pendientes de revisión comercial.')
                  else
                    ..._quotePending.map((visit) => _visitCard(visit)),
                  const SizedBox(height: 20),
                  _sectionTitle('Por conformidad',
                      '${_conformityPending.length} por cerrar'),
                  const SizedBox(height: 10),
                  if (_conformityPending.isEmpty)
                    _emptyCard('No tienes visitas listas para conformidad.')
                  else
                    ..._conformityPending.map((visit) =>
                        _visitCard(visit, showConformityButton: true)),
                  const SizedBox(height: 20),
                  _sectionTitle('Órdenes pendientes de conformidad',
                      '${_pendingOrders.length} activas'),
                  const SizedBox(height: 10),
                  if (_pendingOrders.isEmpty)
                    _emptyCard('No tienes órdenes pendientes de conformidad.')
                  else
                    ..._pendingOrders.map(_orderCard),
                  const SizedBox(height: 20),
                  _sectionTitle('Pendientes de sincronización',
                      '${_syncPending.length} por revisar'),
                  const SizedBox(height: 10),
                  if (_syncPending.isEmpty)
                    _emptyCard(
                        'Todo lo generado localmente ya quedó sincronizado o no requiere envío.')
                  else
                    ..._syncPending.map(_syncCard),
                ],
              ),
            ),
    );
  }

  Widget _summaryRow() {
    return Row(
      children: [
        Expanded(
            child: _metricCard(
                'Hoy', _todayOpen.length.toString(), Icons.today_outlined)),
        const SizedBox(width: 12),
        Expanded(
            child: _metricCard('Cotizar', _quotePending.length.toString(),
                Icons.request_quote_outlined)),
        const SizedBox(width: 12),
        Expanded(
            child: _metricCard(
                'Conformidad',
                _conformityPending.length.toString(),
                Icons.fact_check_outlined)),
      ],
    );
  }

  Widget _metricCard(String label, String value, IconData icon) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: const Color(0x26D3AA74),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value,
                    style: const TextStyle(
                        fontSize: 22, fontWeight: FontWeight.w800)),
                Text(label, style: TextStyle(color: _mutedText)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionTitle(String title, String subtitle) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style: const TextStyle(
                      fontSize: 18, fontWeight: FontWeight.w800)),
              const SizedBox(height: 2),
              Text(subtitle, style: TextStyle(color: _mutedText)),
            ],
          ),
        ),
      ],
    );
  }

  Widget _emptyCard(String text) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Text(text, style: TextStyle(color: _mutedText)),
      ),
    );
  }

  Widget _visitCard(TechVisit visit,
      {bool compact = false, bool showConformityButton = false}) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    visit.clientName.isEmpty ? visit.id : visit.clientName,
                    style: const TextStyle(
                        fontWeight: FontWeight.w800, fontSize: 16),
                  ),
                ),
                _pill(visit.statusLabel),
              ],
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 16,
              runSpacing: 8,
              children: [
                _info('Horario',
                    _formatDate(visit.scheduledAt, fallback: visit.timeWindow)),
                _info('Dirección', visit.clientAddress),
                if (visit.quoteId.isNotEmpty)
                  _info('Cotización', visit.quoteId),
                if (visit.installationOrderId.isNotEmpty)
                  _info('Orden', visit.installationOrderId),
              ],
            ),
            if (!compact && visit.notes.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(visit.notes, style: TextStyle(color: _mutedText)),
            ],
            const SizedBox(height: 14),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                FilledButton.icon(
                  onPressed: () => _openVisit(visit),
                  icon: const Icon(Icons.open_in_new_outlined),
                  label: const Text('Abrir visita'),
                ),
                if (showConformityButton &&
                    visit.installationOrderId.isNotEmpty)
                  OutlinedButton.icon(
                    onPressed: () =>
                        _openConformidad(visit.installationOrderId),
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

  Widget _orderCard(QuoteRecord quote) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    quote.clientName.isEmpty ? quote.id : quote.clientName,
                    style: const TextStyle(
                        fontWeight: FontWeight.w800, fontSize: 16),
                  ),
                ),
                _pill('Orden ${quote.installationOrderId}'),
              ],
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 16,
              runSpacing: 8,
              children: [
                _info('Correo', quote.email.isEmpty ? '-' : quote.email),
                _info('Instalación',
                    '${quote.installationType} · ${quote.propertyType}'),
                _info('Fecha', _formatDate(quote.createdAt)),
              ],
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                FilledButton.icon(
                  onPressed: () => _openConformidad(quote.installationOrderId),
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

  Widget _syncCard(HistorialEntry entry) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(entry.cliente,
                      style: const TextStyle(
                          fontWeight: FontWeight.w800, fontSize: 16)),
                ),
                _syncPill(entry.syncStatus),
              ],
            ),
            const SizedBox(height: 10),
            Text(entry.syncMessage.isEmpty
                ? 'Pendiente de revisar.'
                : entry.syncMessage),
            const SizedBox(height: 10),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                if (entry.installationOrderId.isNotEmpty)
                  OutlinedButton.icon(
                    onPressed: () =>
                        _openConformidad(entry.installationOrderId),
                    icon: const Icon(Icons.restore_outlined),
                    label: const Text('Reabrir conformidad'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _pill(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0x26D3AA74),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(text, style: const TextStyle(fontWeight: FontWeight.w700)),
    );
  }

  Widget _syncPill(String status) {
    final color = switch (status) {
      'synced' => Colors.green,
      'pending' => Colors.orange,
      'error' => Colors.redAccent,
      _ => Colors.blueGrey,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(status.toUpperCase(),
          style: const TextStyle(fontWeight: FontWeight.w700)),
    );
  }

  Widget _info(String label, String value) {
    return SizedBox(
      width: 180,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(color: _mutedText)),
          const SizedBox(height: 2),
          Text(value.isEmpty ? '-' : value,
              style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }

  String _formatDate(String value, {String fallback = '-'}) {
    final parsed = DateTime.tryParse(value);
    if (parsed == null) return fallback;
    return DateFormat('dd/MM/yyyy HH:mm', 'es').format(parsed.toLocal());
  }
}
