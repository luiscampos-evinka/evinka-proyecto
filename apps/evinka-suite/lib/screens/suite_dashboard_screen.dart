import 'package:flutter/material.dart';

import '../models/evinka_app_models.dart';
import '../services/app_settings_service.dart';
import '../services/evinka_api_service.dart';
import '../services/historial_service.dart';
import '../services/network_status_service.dart';
import 'admin_panel_screen.dart';
import 'conformidad_module_screen.dart';
import 'historial_screen.dart';
import 'tech_visits_screen.dart';
import 'quotes_module_screen.dart';
import 'visits_module_screen.dart';

class SuiteDashboardScreen extends StatefulWidget {
  const SuiteDashboardScreen({
    super.key,
    required this.user,
    required this.onLogout,
  });

  final EvinkaUser user;
  final VoidCallback onLogout;

  @override
  State<SuiteDashboardScreen> createState() => _SuiteDashboardScreenState();
}

class _SuiteDashboardScreenState extends State<SuiteDashboardScreen> {
  final _api = EvinkaApiService.instance;
  bool _loadingSummary = true;
  int _pendingOrders = 0;
  int _pendingSync = 0;
  int _activeVisits = 0;
  TechVisit? _nextVisit;

  Color get _mutedText => Theme.of(context).brightness == Brightness.dark
      ? Colors.white70
      : const Color(0xFF6F5B46);
  Color get _panelColor => Theme.of(context).brightness == Brightness.dark
      ? const Color(0xFF151515)
      : Colors.white;
  Color get _borderColor => Theme.of(context).brightness == Brightness.dark
      ? const Color(0x1FFFFFFF)
      : const Color(0x1F5A4632);

  @override
  void initState() {
    super.initState();
    NetworkStatusService.instance.state.addListener(_onNetworkStateChanged);
    _loadSummary();
  }

  @override
  void dispose() {
    NetworkStatusService.instance.state.removeListener(_onNetworkStateChanged);
    super.dispose();
  }

  void _onNetworkStateChanged() {
    if (NetworkStatusService.instance.state.value == NetworkState.online) {
      _loadSummary();
    }
  }

  Future<void> _loadSummary() async {
    setState(() => _loadingSummary = true);
    try {
      final quotes = await _api.getQuotes();
      final pendingSync = await HistorialService.cargarPendientesSync();
      var activeVisits = 0;
      TechVisit? nextVisit;
      if (widget.user.isTech) {
        final visits = await _api.getTechVisits();
        activeVisits = visits.where((item) => !item.isClosed).length;
        visits.sort((a, b) {
          int score(TechVisit visit) {
            if (visit.status == 'pendiente_cierre') return 0;
            if (visit.needsQuote) return 1;
            if (visit.needsQuoteConfirmation) return 2;
            if (visit.needsClientDecision) return 3;
            if (visit.needsScheduling) return 4;
            if (visit.needsConformity) return 5;
            if (visit.isHappeningNow) return 6;
            if (visit.isUpcomingSoon) return 7;
            if (visit.status == 'en_visita') return 8;
            if (visit.status == 'en_ruta') return 9;
            return 10;
          }

          final byScore = score(a).compareTo(score(b));
          if (byScore != 0) return byScore;
          final ad = a.scheduledDate ??
              DateTime.tryParse(a.createdAt) ??
              DateTime(2100);
          final bd = b.scheduledDate ??
              DateTime.tryParse(b.createdAt) ??
              DateTime(2100);
          return ad.compareTo(bd);
        });
        nextVisit = visits.where((item) => !item.isClosed).isEmpty
            ? null
            : visits.where((item) => !item.isClosed).first;
      }
      if (!mounted) return;
      setState(() {
        _pendingOrders = quotes
            .where((quote) =>
                quote.installationOrderId.isNotEmpty &&
                quote.conformityStatus.toLowerCase() != 'pdf_generated')
            .length;
        _pendingSync = pendingSync.length;
        _activeVisits = activeVisits;
        _nextVisit = nextVisit;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('No pude cargar el resumen: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _loadingSummary = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cards = widget.user.hasFullAccess
        ? (widget.user.isTech ? _supervisorTechCards() : _adminCards())
        : widget.user.canSeeCommercialData
            ? _commercialCards()
            : _techCards();

    return Scaffold(
      appBar: AppBar(
        title: const Text('EVINKA Suite'),
        actions: [
          IconButton(
            tooltip: 'Cambiar tema',
            onPressed: () => AppSettingsService.instance.toggleTheme(),
            icon: Icon(
              Theme.of(context).brightness == Brightness.dark
                  ? Icons.light_mode_outlined
                  : Icons.dark_mode_outlined,
            ),
          ),
          IconButton(onPressed: _loadSummary, icon: const Icon(Icons.refresh)),
          IconButton(
              onPressed: widget.onLogout, icon: const Icon(Icons.logout)),
        ],
      ),
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: Theme.of(context).brightness == Brightness.dark
                ? const [Color(0xFF0B0B0B), Color(0xFF121212)]
                : const [Color(0xFFF6F1EA), Color(0xFFEEE5D8)],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 1240),
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _hero(user: widget.user),
                  const SizedBox(height: 18),
                  _connectivityBanner(),
                  const SizedBox(height: 18),
                  if (widget.user.isTech) ...[
                    _actionNowCard(),
                    const SizedBox(height: 18),
                  ],
                  _summaryCards(),
                  const SizedBox(height: 18),
                  LayoutBuilder(
                    builder: (context, constraints) {
                      final width = constraints.maxWidth;
                      final crossAxisCount = width >= 1100
                          ? 4
                          : width >= 760
                              ? 2
                              : 1;
                      return GridView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: cards.length,
                        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: crossAxisCount,
                          crossAxisSpacing: 14,
                          mainAxisSpacing: 14,
                          childAspectRatio: width >= 760 ? 1.12 : 1.34,
                        ),
                        itemBuilder: (context, index) =>
                            _ModuleCard(item: cards[index]),
                      );
                    },
                  ),
                  const SizedBox(height: 18),
                  Card(
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(24)),
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.user.canSeeCommercialData
                                ? 'Control centralizado del cotizador'
                                : 'App orientada a operación técnica',
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(height: 10),
                          Text(
                            widget.user.canSeeCommercialData
                                ? 'La web y la app comparten el mismo backend del cotizador. Los cambios comerciales que hagas aquí impactan también el flujo web.'
                                : 'La app ya quedó orientada a trabajo de campo: pendientes, visitas del chatbot, conformidad y seguimiento de sincronización local.',
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                          const SizedBox(height: 10),
                          Text(
                              'Sesión: ${widget.user.name} · ${widget.user.role.toUpperCase()} · ${EvinkaApiService.instance.baseUrl}'),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  List<_ModuleCardData> _techCards() {
    return [
      _ModuleCardData(
        title: 'Visitas',
        subtitle:
            'Agenda, ejecución y seguimiento del trabajo de campo en un solo módulo.',
        icon: Icons.calendar_month_outlined,
        builder: (_) => VisitsModuleScreen(user: widget.user),
      ),
      _ModuleCardData(
        title: 'Conformidad',
        subtitle:
            'Nueva conformidad e historial de cierres dentro del mismo módulo.',
        icon: Icons.fact_check_outlined,
        builder: (_) => const ConformidadModuleScreen(),
      ),
      _ModuleCardData(
        title: 'Sincronización',
        subtitle: 'Revisa documentos locales, pendientes y reintentos de sync.',
        icon: Icons.sync_outlined,
        builder: (_) => const HistorialScreen(),
      ),
    ];
  }

  List<_ModuleCardData> _supervisorTechCards() {
    return [
      _ModuleCardData(
        title: 'Visitas',
        subtitle:
            'Agenda, ejecución y seguimiento del trabajo de campo con acceso completo.',
        icon: Icons.calendar_month_outlined,
        builder: (_) => VisitsModuleScreen(user: widget.user),
      ),
      _ModuleCardData(
        title: 'Cotizaciones',
        subtitle:
            'Nueva cotización e historial comercial dentro del mismo módulo.',
        icon: Icons.request_quote_outlined,
        builder: (_) => QuotesModuleScreen(user: widget.user),
      ),
      _ModuleCardData(
        title: 'Conformidad',
        subtitle: 'Nueva conformidad e historial de cierres en un solo módulo.',
        icon: Icons.fact_check_outlined,
        builder: (_) => const ConformidadModuleScreen(),
      ),
      _ModuleCardData(
        title: 'Admin comercial',
        subtitle: 'Editar márgenes, perfiles, mínimos y costos base.',
        icon: Icons.admin_panel_settings_outlined,
        builder: (_) => AdminPanelScreen(user: widget.user),
      ),
      _ModuleCardData(
        title: 'Sincronización',
        subtitle: 'Revisa documentos locales, pendientes y reintentos de sync.',
        icon: Icons.sync_outlined,
        builder: (_) => const HistorialScreen(),
      ),
    ];
  }

  List<_ModuleCardData> _adminCards() {
    return [
      _ModuleCardData(
        title: 'Cotizaciones',
        subtitle:
            'Nueva cotización e historial comercial dentro del mismo módulo.',
        icon: Icons.request_quote_outlined,
        builder: (_) => QuotesModuleScreen(user: widget.user),
      ),
      _ModuleCardData(
        title: 'Conformidad',
        subtitle: 'Nueva conformidad e historial de cierres en un solo módulo.',
        icon: Icons.fact_check_outlined,
        builder: (_) => const ConformidadModuleScreen(),
      ),
      _ModuleCardData(
        title: 'Admin comercial',
        subtitle: 'Editar márgenes, perfiles, mínimos y costos base.',
        icon: Icons.admin_panel_settings_outlined,
        builder: (_) => AdminPanelScreen(user: widget.user),
      ),
      _ModuleCardData(
        title: 'Sincronización',
        subtitle: 'Revisa documentos locales, pendientes y reintentos de sync.',
        icon: Icons.sync_outlined,
        builder: (_) => const HistorialScreen(),
      ),
    ];
  }

  List<_ModuleCardData> _commercialCards() {
    return [
      _ModuleCardData(
        title: 'Cotizaciones',
        subtitle:
            'Nueva cotización e historial comercial dentro del mismo módulo.',
        icon: Icons.request_quote_outlined,
        builder: (_) => QuotesModuleScreen(user: widget.user),
      ),
      _ModuleCardData(
        title: 'Conformidad',
        subtitle: 'Consulta cierres y documentos sin entrar al panel admin.',
        icon: Icons.fact_check_outlined,
        builder: (_) => const ConformidadModuleScreen(),
      ),
      _ModuleCardData(
        title: 'Sincronización',
        subtitle: 'Revisa documentos locales, pendientes y reintentos de sync.',
        icon: Icons.sync_outlined,
        builder: (_) => const HistorialScreen(),
      ),
    ];
  }

  Widget _connectivityBanner() {
    return ValueListenableBuilder<NetworkState>(
      valueListenable: NetworkStatusService.instance.state,
      builder: (context, netState, _) {
        return ValueListenableBuilder<SyncQueueStatus>(
          valueListenable: HistorialService.syncQueueStatus,
          builder: (context, syncState, __) {
            final isOnline = netState == NetworkState.online;
            final bg =
                isOnline ? const Color(0x1F2E7D32) : const Color(0x22F9A825);
            final border =
                isOnline ? const Color(0x332E7D32) : const Color(0x33F9A825);
            final icon = syncState.running
                ? Icons.sync
                : isOnline
                    ? Icons.cloud_done
                    : Icons.cloud_off;
            final title = syncState.running
                ? 'Sincronizando'
                : isOnline
                    ? 'Conectado'
                    : 'Sin internet';
            final text = syncState.running
                ? syncState.message
                : isOnline
                    ? 'La app puede sincronizar pendientes ahora.'
                    : 'Puedes seguir trabajando local y sincronizar después.';
            return Card(
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(24)),
              color: bg,
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: border),
                ),
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Icon(icon, color: _mutedText),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(title,
                              style:
                                  const TextStyle(fontWeight: FontWeight.w800)),
                          const SizedBox(height: 4),
                          Text(text),
                        ],
                      ),
                    ),
                    TextButton(
                      onPressed: syncState.running
                          ? null
                          : () => NetworkStatusService.instance.checkNow(),
                      child: const Text('Revisar'),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _actionNowCard() {
    final visit = _nextVisit;
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Acción inmediata',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Text(
              visit == null
                  ? 'No tienes una acción urgente ahora mismo. Puedes revisar agenda y pendientes.'
                  : visit.status == 'pendiente_cierre'
                      ? 'La conformidad ya quedó emitida. Lo único pendiente es cerrar la visita.'
                      : visit.needsQuote
                          ? 'La visita ya quedó lista para diagnóstico. La cotización la continúa el área comercial.'
                          : visit.needsQuoteConfirmation
                              ? 'La cotización ya existe, pero su validación queda del lado comercial.'
                              : visit.needsClientDecision
                                  ? 'La cotización ya salió. El seguimiento de respuesta queda del lado comercial.'
                                  : visit.needsScheduling
                                      ? 'La cotización ya fue aceptada. La coordinación de instalación queda pendiente de agenda.'
                                      : visit.needsConformity
                                          ? 'La instalación ya terminó. Ahora sí toca abrir conformidad.'
                                          : 'Esta es tu siguiente visita prioritaria. La app la pone primero para que no pierdas tiempo.',
            ),
            const SizedBox(height: 14),
            if (visit == null)
              FilledButton.icon(
                onPressed: () async {
                  try {
                    await Navigator.of(context).push(MaterialPageRoute(
                        builder: (_) => TechVisitsScreen(user: widget.user)));
                  } catch (e) {
                    if (!mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('No pude abrir la agenda: $e')),
                    );
                  }
                },
                icon: const Icon(Icons.calendar_month_outlined),
                label: const Text('Abrir agenda'),
              )
            else
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: _panelColor,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: _borderColor),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(visit.clientName,
                              style: const TextStyle(
                                  fontWeight: FontWeight.w800, fontSize: 16)),
                          const SizedBox(height: 6),
                          Text(visit.clientAddress,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(color: _mutedText)),
                          const SizedBox(height: 6),
                          Text(visit.statusLabel,
                              style: TextStyle(color: _mutedText)),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    FilledButton(
                      onPressed: () async {
                        try {
                          await Navigator.of(context).push(MaterialPageRoute(
                              builder: (_) =>
                                  TechVisitsScreen(user: widget.user)));
                        } catch (e) {
                          if (!mounted) return;
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                                content: Text('No pude abrir la agenda: $e')),
                          );
                        }
                      },
                      child: Text(visit.nextActionLabel),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _summaryCards() {
    if (_loadingSummary) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 12),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    final items = [
      _SummaryCardData(
          label: 'Órdenes pendientes',
          value: _pendingOrders.toString(),
          icon: Icons.assignment_outlined,
          builder: (_) => const ConformidadModuleScreen(initialIndex: 1)),
      if (widget.user.isTech)
        _SummaryCardData(
            label: 'Visitas activas',
            value: _activeVisits.toString(),
            icon: Icons.support_agent_outlined,
            builder: (_) => VisitsModuleScreen(user: widget.user)),
      _SummaryCardData(
          label: 'Sync pendiente',
          value: _pendingSync.toString(),
          icon: Icons.sync_problem_outlined,
          builder: (_) => const HistorialScreen()),
    ];
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final columns = width >= 900 ? items.length : 1;
        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: items.length,
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: columns,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: width >= 900 ? 2.6 : 3.2,
          ),
          itemBuilder: (_, index) => _SummaryCard(item: items[index]),
        );
      },
    );
  }
}

class _hero extends StatelessWidget {
  const _hero({required this.user});

  final EvinkaUser user;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: Theme.of(context).brightness == Brightness.dark
              ? const [Color(0xFF171717), Color(0xFF0E0E0E)]
              : const [Color(0xFFFFFFFF), Color(0xFFF1E7D8)],
        ),
        borderRadius: BorderRadius.circular(30),
        border: Border.all(
          color: Theme.of(context).brightness == Brightness.dark
              ? const Color(0x337DA2FF)
              : const Color(0x3355331A),
        ),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final stacked = constraints.maxWidth < 760;
          final content = [
            Expanded(
              flex: 6,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('EVINKA Installation Suite',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                            letterSpacing: 1.4,
                            color:
                                Theme.of(context).brightness == Brightness.dark
                                    ? const Color(0xFF9FC2FF)
                                    : const Color(0xFF55331A),
                          )),
                  const SizedBox(height: 10),
                  Text('Hola, ${user.name}',
                      style: Theme.of(context)
                          .textTheme
                          .headlineMedium
                          ?.copyWith(fontWeight: FontWeight.w900)),
                  const SizedBox(height: 10),
                  Text(
                    user.hasFullAccess && user.isTech
                        ? 'Tienes modo supervisor técnico: mantienes la operación de campo y además ves el frente comercial completo.'
                        : user.canSeeCommercialData
                            ? 'Gestiona cotización, órdenes y conformidad desde la misma app con el backend real de EVINKA.'
                            : 'Aquí tienes una base operativa para técnicos: visitas, ejecución y conformidad con separación del frente comercial.',
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                ],
              ),
            ),
            if (!stacked)
              const SizedBox(width: 16)
            else
              const SizedBox(height: 16),
            Expanded(
              flex: 4,
              child: Container(
                height: stacked ? 160 : 220,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(24),
                  image: const DecorationImage(
                      image: AssetImage('assets/logo.png'),
                      fit: BoxFit.cover,
                      opacity: 0.35),
                  color: Theme.of(context).brightness == Brightness.dark
                      ? const Color(0xFF171717)
                      : const Color(0xFFEFE3D0),
                ),
                alignment: Alignment.bottomLeft,
                padding: const EdgeInsets.all(16),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: Theme.of(context).brightness == Brightness.dark
                        ? const Color(0xAA111111)
                        : const Color(0xCCFFFFFF),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Text(
                      user.hasFullAccess && user.isTech
                          ? 'Modo supervisor técnico'
                          : user.canSeeCommercialData
                              ? (user.isAdmin
                                  ? 'Modo admin activo'
                                  : 'Modo comercial activo')
                              : 'Modo técnico operativo',
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
            ),
          ];
          return stacked ? Column(children: content) : Row(children: content);
        },
      ),
    );
  }
}

class _ModuleCardData {
  const _ModuleCardData({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.builder,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final WidgetBuilder builder;
}

class _ModuleCard extends StatelessWidget {
  const _ModuleCard({required this.item});

  final _ModuleCardData item;

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: () => Navigator.of(context)
            .push(MaterialPageRoute(builder: item.builder)),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: Theme.of(context).brightness == Brightness.dark
                      ? const Color(0x332B4D73)
                      : const Color(0x1455331A),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(item.icon, size: 28),
              ),
              const SizedBox(height: 16),
              Text(item.title,
                  style: Theme.of(context)
                      .textTheme
                      .titleLarge
                      ?.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 10),
              Expanded(
                  child: Text(item.subtitle,
                      style: Theme.of(context).textTheme.bodyMedium)),
              const SizedBox(height: 12),
              const Row(
                children: [
                  Text('Abrir módulo',
                      style: TextStyle(fontWeight: FontWeight.w700)),
                  SizedBox(width: 8),
                  Icon(Icons.arrow_forward),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SummaryCardData {
  const _SummaryCardData({
    required this.label,
    required this.value,
    required this.icon,
    this.builder,
  });

  final String label;
  final String value;
  final IconData icon;
  final WidgetBuilder? builder;
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.item});

  final _SummaryCardData item;

  @override
  Widget build(BuildContext context) {
    final mutedText = Theme.of(context).brightness == Brightness.dark
        ? Colors.white70
        : const Color(0xFF6F5B46);
    final child = Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: Theme.of(context).brightness == Brightness.dark
                  ? const Color(0x332B4D73)
                  : const Color(0x1455331A),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(item.icon),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(item.value,
                  style: const TextStyle(
                      fontSize: 24, fontWeight: FontWeight.w800)),
              Text(item.label, style: TextStyle(color: mutedText)),
              if (item.builder != null)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    'Tocar para abrir',
                    style: TextStyle(
                      fontSize: 12,
                      color: Theme.of(context).brightness == Brightness.dark
                          ? const Color(0xFF9FC2FF)
                          : const Color(0xFF55331A),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
    return Card(
      child: item.builder == null
          ? child
          : InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () => Navigator.of(context)
                  .push(MaterialPageRoute(builder: item.builder!)),
              child: child,
            ),
    );
  }
}
