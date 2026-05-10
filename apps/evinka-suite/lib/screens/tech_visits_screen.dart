import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/evinka_app_models.dart';
import '../services/evinka_api_service.dart';
import 'tech_visit_detail_screen.dart';

class TechVisitsScreen extends StatefulWidget {
  const TechVisitsScreen({super.key, required this.user});

  final EvinkaUser user;

  @override
  State<TechVisitsScreen> createState() => _TechVisitsScreenState();
}

class _TechVisitsScreenState extends State<TechVisitsScreen> {
  final _api = EvinkaApiService.instance;
  bool _loading = true;
  List<TechVisit> _visits = const [];
  DateTime _monthCursor = DateTime(DateTime.now().year, DateTime.now().month);
  DateTime _selectedMonthDay =
      DateTime(DateTime.now().year, DateTime.now().month, DateTime.now().day);

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final visits = await _api.getTechVisits();
      visits.sort((a, b) {
        final ad =
            a.scheduledDate ?? DateTime.tryParse(a.createdAt) ?? DateTime(2100);
        final bd =
            b.scheduledDate ?? DateTime.tryParse(b.createdAt) ?? DateTime(2100);
        return ad.compareTo(bd);
      });
      if (!mounted) return;
      setState(() => _visits = visits);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No pude cargar las visitas: $e')),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<TechVisit> get _todayVisits {
    final now = DateTime.now();
    final list = _visits.where((item) {
      final dt = item.scheduledDate;
      return dt != null &&
          dt.year == now.year &&
          dt.month == now.month &&
          dt.day == now.day;
    }).toList();
    list.sort(_prioritySort);
    return list;
  }

  List<TechVisit> get _weekVisits {
    final now = DateTime.now();
    final start = DateTime(now.year, now.month, now.day)
        .subtract(Duration(days: now.weekday - 1));
    final end = start.add(const Duration(days: 7));
    final list = _visits.where((item) {
      final dt = item.scheduledDate;
      return dt != null && !dt.isBefore(start) && dt.isBefore(end);
    }).toList();
    list.sort(_prioritySort);
    return list;
  }

  List<TechVisit> get _pendingVisits {
    final list = _visits.where((item) => !item.isClosed).toList();
    list.sort(_prioritySort);
    return list;
  }

  bool get _isDark => Theme.of(context).brightness == Brightness.dark;
  Color get _panelColor => _isDark ? const Color(0xFF151515) : Colors.white;
  Color get _borderColor =>
      _isDark ? const Color(0x1FFFFFFF) : const Color(0x1F5A4632);
  Color get _mutedText => _isDark ? Colors.white70 : const Color(0xFF6F5B46);
  Color get _faintText => _isDark ? Colors.white38 : const Color(0xFFB29D88);
  Color get _strongText => _isDark ? Colors.white : const Color(0xFF241A12);

  TechVisit? get _actionVisit {
    final candidates = _pendingVisits;
    if (candidates.isEmpty) return null;
    candidates.sort(_prioritySort);
    return candidates.first;
  }

  int _prioritySort(TechVisit a, TechVisit b) {
    int score(TechVisit visit) {
      if (visit.isHappeningNow) return 0;
      if (visit.status == 'pendiente_cierre') return 1;
      if (visit.status == 'en_ruta') return 2;
      if (visit.status == 'agendada') return 3;
      if (visit.status == 'en_visita') return 4;
      if (visit.needsConformity) return 5;
      if (visit.needsQuote) return 6;
      if (visit.needsQuoteConfirmation) return 7;
      if (visit.needsClientDecision) return 8;
      if (visit.needsScheduling) return 9;
      if (visit.isUpcomingSoon) return 10;
      return 10;
    }

    final byScore = score(a).compareTo(score(b));
    if (byScore != 0) return byScore;
    final ad =
        a.scheduledDate ?? DateTime.tryParse(a.createdAt) ?? DateTime(2100);
    final bd =
        b.scheduledDate ?? DateTime.tryParse(b.createdAt) ?? DateTime(2100);
    return ad.compareTo(bd);
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

  List<TechVisit> _visitsForDay(DateTime day) {
    return _visits.where((item) {
      final dt = item.scheduledDate;
      return dt != null &&
          dt.year == day.year &&
          dt.month == day.month &&
          dt.day == day.day;
    }).toList()
      ..sort(_prioritySort);
  }

  Future<void> _showDayVisits(DateTime day) async {
    final visits = _visitsForDay(day);
    if (!mounted) return;
    try {
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (context) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  DateFormat('EEEE d MMMM', 'es').format(day),
                  style: const TextStyle(
                      fontSize: 20, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 6),
                Text(
                  visits.isEmpty
                      ? 'No tienes visitas en este día.'
                      : '${visits.length} visita${visits.length == 1 ? '' : 's'} programada${visits.length == 1 ? '' : 's'}.',
                  style: TextStyle(color: _mutedText),
                ),
                const SizedBox(height: 14),
                if (visits.isEmpty)
                  _emptyCard('No tienes visitas en este día.')
                else
                  SizedBox(
                    height: MediaQuery.of(context).size.height * 0.6,
                    child: ListView(
                      children: visits
                          .map((visit) => Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: _visitCard(visit),
                              ))
                          .toList(),
                    ),
                  ),
              ],
            ),
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No pude abrir el día: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 4,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Agenda técnica'),
          actions: [
            IconButton(onPressed: _load, icon: const Icon(Icons.refresh)),
          ],
          bottom: const TabBar(
            isScrollable: true,
            tabs: [
              Tab(text: 'Hoy'),
              Tab(text: 'Semana'),
              Tab(text: 'Mes'),
              Tab(text: 'Pendientes'),
            ],
          ),
        ),
        body: _loading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: _load,
                child: TabBarView(
                  children: [
                    _buildTodayTab(),
                    _buildWeekTab(),
                    _buildMonthTab(),
                    _buildPendingTab(),
                  ],
                ),
              ),
      ),
    );
  }

  Widget _buildTodayTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _actionNowCard(),
        const SizedBox(height: 16),
        _sectionHeader(
            'Tus visitas de hoy', '${_todayVisits.length} programadas'),
        const SizedBox(height: 10),
        if (_todayVisits.isEmpty)
          _emptyCard(
              'No tienes visitas para hoy. Si entra algo del chatbot, aparecerá aquí primero.')
        else
          ..._todayVisits.map(_visitCard),
      ],
    );
  }

  Widget _buildWeekTab() {
    final groups = <DateTime, List<TechVisit>>{};
    for (final visit in _weekVisits) {
      final dt = visit.scheduledDate;
      if (dt == null) continue;
      final day = DateTime(dt.year, dt.month, dt.day);
      groups.putIfAbsent(day, () => []).add(visit);
    }
    final days = groups.keys.toList()..sort();
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _sectionHeader(
            'Semana', 'Vista semanal para que no tengas que buscar qué toca'),
        const SizedBox(height: 10),
        if (days.isEmpty)
          _emptyCard('No tienes visitas esta semana.')
        else
          ...days.map((day) => _daySection(day, groups[day]!)),
      ],
    );
  }

  Widget _buildMonthTab() {
    final firstDay = DateTime(_monthCursor.year, _monthCursor.month, 1);
    final offset = firstDay.weekday - 1;
    final startGrid = firstDay.subtract(Duration(days: offset));
    final days =
        List.generate(42, (index) => startGrid.add(Duration(days: index)));
    final selectedVisits = _visitsForDay(_selectedMonthDay);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                DateFormat('MMMM yyyy', 'es').format(_monthCursor),
                style:
                    const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
              ),
            ),
            IconButton(
              onPressed: () => setState(() {
                _monthCursor =
                    DateTime(_monthCursor.year, _monthCursor.month - 1);
              }),
              icon: const Icon(Icons.chevron_left),
            ),
            IconButton(
              onPressed: () => setState(() {
                _monthCursor =
                    DateTime(_monthCursor.year, _monthCursor.month + 1);
              }),
              icon: const Icon(Icons.chevron_right),
            ),
          ],
        ),
        const SizedBox(height: 10),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: days.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 7,
            crossAxisSpacing: 8,
            mainAxisSpacing: 8,
            childAspectRatio: 0.9,
          ),
          itemBuilder: (_, index) {
            final day = days[index];
            final count = _visitsForDay(day).length;
            final isCurrentMonth = day.month == _monthCursor.month;
            final isSelected = day.year == _selectedMonthDay.year &&
                day.month == _selectedMonthDay.month &&
                day.day == _selectedMonthDay.day;
            return InkWell(
              borderRadius: BorderRadius.circular(18),
              onTap: () {
                setState(() => _selectedMonthDay = day);
                _showDayVisits(day);
              },
              child: Container(
                decoration: BoxDecoration(
                  color: isSelected
                      ? (_isDark
                          ? const Color(0x332D5BFF)
                          : const Color(0x1A55331A))
                      : _panelColor,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                      color: isSelected
                          ? (_isDark
                              ? const Color(0xFF7DA2FF)
                              : const Color(0xFF55331A))
                          : _borderColor),
                ),
                padding: const EdgeInsets.all(8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${day.day}',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        color: isCurrentMonth ? null : _faintText,
                      ),
                    ),
                    const Spacer(),
                    if (count > 0)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: _isDark
                              ? const Color(0xFF21412A)
                              : const Color(0xFFE4F1E7),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          '$count visita${count == 1 ? '' : 's'}',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: _isDark
                                ? Colors.white
                                : const Color(0xFF1E4D2B),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            );
          },
        ),
        const SizedBox(height: 18),
        Text(
          'Toca un día para ver sus visitas.',
          style: TextStyle(color: _mutedText, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 10),
        _sectionHeader(
          'Detalle del día',
          DateFormat('EEEE d MMMM', 'es').format(_selectedMonthDay),
        ),
        const SizedBox(height: 10),
        if (selectedVisits.isEmpty)
          _emptyCard('No tienes visitas en este día.')
        else
          ...selectedVisits.map(_visitCard),
      ],
    );
  }

  Widget _buildPendingTab() {
    final quotePending =
        _pendingVisits.where((item) => item.needsQuote).toList();
    final clientDecisionPending =
        _pendingVisits.where((item) => item.needsClientDecision).toList();
    final schedulePending =
        _pendingVisits.where((item) => item.needsScheduling).toList();
    final conformityPending =
        _pendingVisits.where((item) => item.needsConformity).toList();
    final activeNow = _pendingVisits
        .where((item) =>
            item.isHappeningNow ||
            item.status == 'en_visita' ||
            item.status == 'en_ruta')
        .toList();
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _sectionHeader(
            'Pendientes', 'Separados por tipo para que no tengas que adivinar'),
        const SizedBox(height: 10),
        _pendingBlock('Ahora', activeNow,
            empty: 'No tienes una visita en curso ahora mismo.'),
        const SizedBox(height: 16),
        _pendingBlock('Pendientes de cotización comercial', quotePending,
            empty: 'No tienes visitas pendientes de revisión comercial.'),
        const SizedBox(height: 16),
        _pendingBlock('Esperando respuesta del cliente', clientDecisionPending,
            empty: 'No tienes cotizaciones pendientes de respuesta.'),
        const SizedBox(height: 16),
        _pendingBlock('Por agendar instalación', schedulePending,
            empty: 'No tienes instalaciones pendientes de agendar.'),
        const SizedBox(height: 16),
        _pendingBlock('Por conformidad', conformityPending,
            empty: 'No tienes conformidades pendientes.'),
      ],
    );
  }

  Widget _actionNowCard() {
    final visit = _actionVisit;
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Acción inmediata',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            if (visit == null)
              const Text(
                  'No tienes una acción urgente ahora mismo. Revisa tu agenda o pendientes.')
            else ...[
              Text(
                visit.needsConformity
                    ? 'Tienes una visita lista para cerrar con conformidad.'
                    : visit.needsClientDecision
                        ? 'La cotización ya está enviada. El seguimiento de respuesta queda del lado comercial.'
                        : visit.needsScheduling
                            ? 'La cotización ya fue aceptada. Falta coordinar la instalación.'
                            : visit.isHappeningNow
                                ? 'Esta visita está en tu horario actual. Ábrela y registra el avance técnico sin perder tiempo.'
                                : visit.needsQuoteConfirmation
                                    ? 'Ya existe una cotización, pero su validación queda del lado comercial.'
                                    : 'Esta es tu siguiente visita prioritaria.',
              ),
              const SizedBox(height: 14),
              _visitMiniCard(visit, highlight: true),
            ],
          ],
        ),
      ),
    );
  }

  Widget _daySection(DateTime day, List<TechVisit> visits) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          DateFormat('EEEE d MMM', 'es').format(day),
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 8),
        ...visits.map(_visitCard),
        const SizedBox(height: 14),
      ],
    );
  }

  Widget _pendingBlock(String title, List<TechVisit> visits,
      {required String empty}) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style:
                    const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),
            if (visits.isEmpty)
              Text(empty, style: TextStyle(color: _mutedText))
            else
              ...visits.map(_visitMiniCard),
          ],
        ),
      ),
    );
  }

  Widget _visitCard(TechVisit visit) {
    final typeTone = _typeTone(visit);
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: () => _openVisit(visit),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(visit.clientName,
                            style: const TextStyle(
                                fontWeight: FontWeight.w800, fontSize: 16)),
                        const SizedBox(height: 4),
                        _typePill(visit),
                        const SizedBox(height: 4),
                        Text(
                            _formatDateTime(visit.scheduledAt,
                                fallback: visit.timeWindow),
                            style: TextStyle(color: _mutedText)),
                      ],
                    ),
                  ),
                  _statusPill(visit),
                ],
              ),
              const SizedBox(height: 10),
              Text(visit.clientAddress.isEmpty ? '-' : visit.clientAddress),
              const SizedBox(height: 14),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  FilledButton.icon(
                    onPressed: () => _openVisit(visit),
                    icon: const Icon(Icons.open_in_new_outlined),
                    label: Text(visit.nextActionLabel),
                  ),
                  if (visit.clientPhone.isNotEmpty)
                    OutlinedButton.icon(
                      onPressed: () => _openVisit(visit),
                      icon: const Icon(Icons.assignment_outlined),
                      label: const Text('Ver detalle'),
                    ),
                ],
              ),
              const SizedBox(height: 4),
              Align(
                alignment: Alignment.centerRight,
                child: Container(
                  width: 44,
                  height: 4,
                  decoration: BoxDecoration(
                    color: typeTone,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _visitMiniCard(TechVisit visit, {bool highlight = false}) {
    final typeTone = _typeTone(visit);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: highlight
            ? typeTone.withValues(alpha: _isDark ? 0.28 : 0.14)
            : _panelColor,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
            color: highlight
                ? typeTone
                : _typeTone(visit).withValues(alpha: 0.38)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(visit.clientName,
                    style: const TextStyle(fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                _typePill(visit),
                const SizedBox(height: 4),
                Text(
                    _formatDateTime(visit.scheduledAt,
                        fallback: visit.timeWindow),
                    style: TextStyle(color: _mutedText)),
                const SizedBox(height: 4),
                Text(visit.clientAddress,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: _mutedText)),
              ],
            ),
          ),
          const SizedBox(width: 12),
          FilledButton(
            onPressed: () => _openVisit(visit),
            child: Text(visit.nextActionLabel),
          ),
        ],
      ),
    );
  }

  Color _typeTone(TechVisit visit) {
    return visit.isInstallation
        ? const Color(0xFF7C3AED)
        : const Color(0xFF0F766E);
  }

  Widget _typePill(TechVisit visit) {
    final tone = _typeTone(visit);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: _isDark ? 0.28 : 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: tone.withValues(alpha: 0.4)),
      ),
      child: Text(
        visit.typeLabel,
        style: TextStyle(
          color: _isDark || tone.computeLuminance() < 0.45
              ? Colors.white
              : _strongText,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  Widget _statusPill(TechVisit visit) {
    final tone = switch (visit.status) {
      'cerrada' => const Color(0xFF1E7D3B),
      'pendiente_cierre' => const Color(0xFF0F766E),
      'en_visita' => const Color(0xFFAD6800),
      'visitada' => const Color(0xFFA84300),
      'cotizada' => const Color(0xFF0E7490),
      'en_ruta' => const Color(0xFF1D4ED8),
      'pendiente_conformidad' => const Color(0xFF7C3AED),
      _ => const Color(0xFF55331A),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: _isDark ? 0.28 : 0.14),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: tone.withValues(alpha: 0.4)),
      ),
      child: Text(
        visit.statusLabel,
        style: TextStyle(
          fontWeight: FontWeight.w700,
          color: _isDark || tone.computeLuminance() < 0.45
              ? Colors.white
              : _strongText,
        ),
      ),
    );
  }

  Widget _sectionHeader(String title, String subtitle) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 4),
        Text(subtitle, style: TextStyle(color: _mutedText)),
      ],
    );
  }

  Widget _emptyCard(String text) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Text(text, style: TextStyle(color: _mutedText)),
      ),
    );
  }

  String _formatDateTime(String value, {String fallback = '-'}) {
    final parsed = DateTime.tryParse(value);
    if (parsed == null) return fallback;
    return DateFormat('EEE d MMM · hh:mm a', 'es').format(parsed.toLocal());
  }
}
