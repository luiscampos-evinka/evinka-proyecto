import 'dart:async';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/advisor_inbox_models.dart';
import '../models/evinka_app_models.dart';
import '../services/advisor_inbox_service.dart';
import '../services/evinka_api_service.dart';

class AdvisorInboxScreen extends StatefulWidget {
  const AdvisorInboxScreen({super.key, required this.user});

  final EvinkaUser user;

  @override
  State<AdvisorInboxScreen> createState() => _AdvisorInboxScreenState();
}

class _AdvisorInboxScreenState extends State<AdvisorInboxScreen> {
  final _service = AdvisorInboxService.instance;
  final _searchController = TextEditingController();

  bool _loading = true;
  bool _refreshing = false;
  String? _error;
  EvinkaUser? _advisorUser;
  List<AdvisorInboxSummary> _conversations = const [];
  String _status = 'all';
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _searchController.addListener(() {
      if (mounted) setState(() {});
    });
    _bootstrap();
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (!_loading && mounted) {
        _loadConversations(silent: true);
      }
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final advisorUser = await _service.ensureSession();
      final items = await _service.getConversations(status: _status);
      if (!mounted) return;
      setState(() {
        _advisorUser = advisorUser;
        _conversations = items;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadConversations({bool silent = false}) async {
    if (!silent && mounted) {
      setState(() {
        _refreshing = true;
        _error = null;
      });
    }
    try {
      final items = await _service.getConversations(status: _status);
      if (!mounted) return;
      setState(() => _conversations = items);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (!mounted) return;
      setState(() => _refreshing = false);
    }
  }

  List<AdvisorInboxSummary> get _filteredConversations {
    final query = _searchController.text.trim().toLowerCase();
    if (query.isEmpty) return _conversations;
    return _conversations.where((item) {
      final bag = [
        item.customerName,
        item.phonePretty,
        item.phone,
        item.email,
        item.handoffReason,
        item.internalNote,
        item.nextAction,
        item.lastMessageText,
      ].join(' ').toLowerCase();
      return bag.contains(query);
    }).toList();
  }

  Future<void> _openConversation(AdvisorInboxSummary item) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => _AdvisorConversationScreen(summary: item),
      ),
    );
    if (!mounted) return;
    await _loadConversations();
  }

  Future<void> _openExternal() async {
    await launchUrl(
      Uri.parse(_service.baseUrl),
      mode: LaunchMode.externalApplication,
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredConversations;
    final active = _conversations.where((item) => item.status != 'resolved');
    final urgent = active.where((item) => _priorityOf(item) == 'urgent');
    final resolved = _conversations.where((item) => item.status == 'resolved');
    final pageBackground = const Color(0xFFF6F1EA);
    final panelColor = Theme.of(context).colorScheme.surface;

    return Scaffold(
      backgroundColor: pageBackground,
      appBar: AppBar(
        backgroundColor: pageBackground,
        surfaceTintColor: Colors.transparent,
        scrolledUnderElevation: 0,
        title: const Text('Inbox asesor'),
        actions: [
          IconButton(
            tooltip: 'Abrir web',
            onPressed: _openExternal,
            icon: const Icon(Icons.open_in_browser_outlined),
          ),
          IconButton(
            tooltip: 'Recargar',
            onPressed: _loading ? null : _loadConversations,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: panelColor,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(
                    color:
                        Theme.of(context).dividerColor.withValues(alpha: 0.8),
                  ),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x14000000),
                      blurRadius: 18,
                      offset: Offset(0, 8),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _advisorUser == null
                          ? 'Conectando con el inbox…'
                          : 'Atendiendo como ${_advisorUser!.name}',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Versión nativa dentro de EVINKA Suite. Scroll real, historial completo y acciones directas.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _searchController,
                      decoration: const InputDecoration(
                        prefixIcon: Icon(Icons.search),
                        hintText: 'Buscar cliente, teléfono, nota o motivo',
                      ),
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final entry in const [
                          ('all', 'Todos'),
                          ('active', 'Activos'),
                          ('resolved', 'Resueltos'),
                        ])
                          ChoiceChip(
                            label: Text(entry.$2),
                            selected: _status == entry.$1,
                            onSelected: (selected) {
                              if (!selected) return;
                              setState(() => _status = entry.$1);
                              _loadConversations();
                            },
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: _MiniStatCard(
                            label: 'Activos',
                            value: active.length.toString(),
                            icon: Icons.mark_chat_unread_outlined,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _MiniStatCard(
                            label: 'Urgentes',
                            value: urgent.length.toString(),
                            icon: Icons.priority_high_rounded,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _MiniStatCard(
                            label: 'Resueltos',
                            value: resolved.length.toString(),
                            icon: Icons.task_alt_rounded,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            if (_loading) const LinearProgressIndicator(minHeight: 2),
            if (_refreshing && !_loading)
              const LinearProgressIndicator(minHeight: 2),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: Material(
                  color: Colors.red.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(16),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline_rounded,
                            color: Colors.red),
                        const SizedBox(width: 10),
                        Expanded(child: Text(_error!)),
                      ],
                    ),
                  ),
                ),
              ),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : RefreshIndicator(
                      onRefresh: _loadConversations,
                      child: filtered.isEmpty
                          ? ListView(
                              physics: const AlwaysScrollableScrollPhysics(),
                              children: const [
                                SizedBox(height: 120),
                                Center(
                                  child: Padding(
                                    padding:
                                        EdgeInsets.symmetric(horizontal: 28),
                                    child: Text(
                                      'No hay conversaciones para este filtro.',
                                      textAlign: TextAlign.center,
                                    ),
                                  ),
                                ),
                              ],
                            )
                          : ListView.separated(
                              physics: const AlwaysScrollableScrollPhysics(),
                              padding:
                                  const EdgeInsets.fromLTRB(16, 12, 16, 24),
                              itemCount: filtered.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: 10),
                              itemBuilder: (context, index) {
                                final item = filtered[index];
                                final priority = _priorityOf(item);
                                final wait = _waitLabel(
                                    item.lastIncomingAt ?? item.lastMessageAt);
                                final subtitle = item.internalNote.isNotEmpty
                                    ? item.internalNote
                                    : item.lastMessageText.isNotEmpty
                                        ? item.lastMessageText
                                        : item.handoffReason;
                                return InkWell(
                                  borderRadius: BorderRadius.circular(22),
                                  onTap: () => _openConversation(item),
                                  child: Ink(
                                    padding: const EdgeInsets.all(14),
                                    decoration: BoxDecoration(
                                      color: Theme.of(context).cardColor,
                                      borderRadius: BorderRadius.circular(22),
                                      border: Border.all(
                                        color: Theme.of(context)
                                            .dividerColor
                                            .withValues(alpha: 0.8),
                                      ),
                                    ),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            _AvatarBadge(
                                                label: item.customerName),
                                            const SizedBox(width: 12),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    item.customerName,
                                                    maxLines: 1,
                                                    overflow:
                                                        TextOverflow.ellipsis,
                                                    style: Theme.of(context)
                                                        .textTheme
                                                        .titleSmall
                                                        ?.copyWith(
                                                          fontWeight:
                                                              FontWeight.w800,
                                                        ),
                                                  ),
                                                  const SizedBox(height: 2),
                                                  Text(
                                                    item.phonePretty.isNotEmpty
                                                        ? item.phonePretty
                                                        : item.phone,
                                                    style: Theme.of(context)
                                                        .textTheme
                                                        .bodySmall,
                                                  ),
                                                ],
                                              ),
                                            ),
                                            Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.end,
                                              children: [
                                                _Pill(
                                                  text: wait,
                                                  background: _waitToneColor(
                                                          context, item)
                                                      .withValues(alpha: 0.12),
                                                  foreground: _waitToneColor(
                                                      context, item),
                                                ),
                                                if (item.unreadCount > 0) ...[
                                                  const SizedBox(height: 6),
                                                  CircleAvatar(
                                                    radius: 11,
                                                    backgroundColor:
                                                        Theme.of(context)
                                                            .colorScheme
                                                            .primary,
                                                    child: Text(
                                                      item.unreadCount
                                                          .toString(),
                                                      style: TextStyle(
                                                        fontSize: 11,
                                                        fontWeight:
                                                            FontWeight.w800,
                                                        color: Theme.of(context)
                                                            .colorScheme
                                                            .onPrimary,
                                                      ),
                                                    ),
                                                  ),
                                                ],
                                              ],
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 10),
                                        Wrap(
                                          spacing: 6,
                                          runSpacing: 6,
                                          children: [
                                            _Pill(
                                              text: _statusLabel(item.status),
                                              background: _statusColor(
                                                      context, item.status)
                                                  .withValues(alpha: 0.12),
                                              foreground: _statusColor(
                                                  context, item.status),
                                            ),
                                            _Pill(
                                              text: _priorityLabel(priority),
                                              background: _priorityColor(
                                                      context, priority)
                                                  .withValues(alpha: 0.12),
                                              foreground: _priorityColor(
                                                  context, priority),
                                            ),
                                            if ((item.assignedToLabel ?? '')
                                                .isNotEmpty)
                                              _Pill(
                                                text: item.assignedToLabel!,
                                                background: Theme.of(context)
                                                    .dividerColor
                                                    .withValues(alpha: 0.2),
                                                foreground: Theme.of(context)
                                                        .textTheme
                                                        .bodyMedium
                                                        ?.color ??
                                                    Colors.white,
                                              ),
                                          ],
                                        ),
                                        if (subtitle.isNotEmpty) ...[
                                          const SizedBox(height: 10),
                                          Text(
                                            subtitle,
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                            style: Theme.of(context)
                                                .textTheme
                                                .bodyMedium,
                                          ),
                                        ],
                                        if (item.nextAction.isNotEmpty ||
                                            item.handoffReason.isNotEmpty) ...[
                                          const SizedBox(height: 10),
                                          Text(
                                            item.nextAction.isNotEmpty
                                                ? 'Próximo paso: ${_nextActionLabel(item.nextAction)}'
                                                : item.handoffReason,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: Theme.of(context)
                                                .textTheme
                                                .bodySmall,
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AdvisorConversationScreen extends StatefulWidget {
  const _AdvisorConversationScreen({required this.summary});

  final AdvisorInboxSummary summary;

  @override
  State<_AdvisorConversationScreen> createState() =>
      _AdvisorConversationScreenState();
}

class _AdvisorConversationScreenState
    extends State<_AdvisorConversationScreen> {
  final _service = AdvisorInboxService.instance;
  final _messageController = TextEditingController();
  final _noteController = TextEditingController();
  final _scrollController = ScrollController();
  final _imagePicker = ImagePicker();

  AdvisorInboxDetail? _detail;
  bool _loading = true;
  bool _sending = false;
  bool _savingMeta = false;
  String? _error;
  String _nextAction = '';
  String _priority = '';
  Timer? _pollTimer;

  static const double _autoScrollSlack = 72;

  static const _quickReplies = [
    '¡Gracias! Para ayudarte mejor, compárteme por favor tu ubicación o la dirección exacta de instalación.',
    'Perfecto. Podemos coordinar una visita técnica para validar la instalación. ¿Qué día y rango horario te acomoda mejor?',
    'Para avanzar, por favor envíame una foto clara de tu recibo de luz y, si tienes, del tablero eléctrico.',
    'Antes de cotizarte con precisión, necesito confirmar la potencia requerida y el tipo de vehículo. ¿Me compartes ese dato?',
    'Te escribo para dar seguimiento a tu solicitud. Si quieres, hoy mismo dejamos listo el siguiente paso para tu instalación.',
  ];

  @override
  void initState() {
    super.initState();
    _loadDetail(forceBottom: true);
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (mounted && !_loading && !_sending && !_savingMeta) {
        _loadDetail(silent: true);
      }
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _messageController.dispose();
    _noteController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  bool _shouldStickToBottom() {
    if (!_scrollController.hasClients) return true;
    final position = _scrollController.position;
    final distanceFromBottom = position.maxScrollExtent - position.pixels;
    return distanceFromBottom <= _autoScrollSlack;
  }

  void _scrollToBottom({bool animated = true}) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      final target = _scrollController.position.maxScrollExtent;
      if (animated) {
        _scrollController.animateTo(
          target,
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOut,
        );
      } else {
        _scrollController.jumpTo(target);
      }
    });
  }

  Future<void> _loadDetail(
      {bool silent = false, bool forceBottom = false}) async {
    if (!silent && mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    final stickToBottom =
        forceBottom || _detail == null || _shouldStickToBottom();
    try {
      final detail = await _service.getConversationDetail(widget.summary.id);
      if (!mounted) return;
      final shouldSeedMeta = _detail == null || (!_savingMeta && !_sending);
      setState(() {
        _detail = detail;
        if (shouldSeedMeta) {
          _noteController.text = detail.conversation.internalNote;
          _nextAction = detail.conversation.nextAction;
          _priority = detail.conversation.manualPriority;
        }
      });
      if (stickToBottom) {
        _scrollToBottom(animated: !forceBottom);
      }
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _sendMessage() async {
    final detail = _detail;
    final text = _messageController.text.trim();
    if (detail == null || text.isEmpty) return;
    setState(() => _sending = true);
    try {
      await _service.sendMessage(detail.conversation.id, text);
      _messageController.clear();
      await _loadDetail(forceBottom: true);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', ''))),
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _sendImage(ImageSource source) async {
    final detail = _detail;
    if (detail == null) return;
    final file = await _imagePicker.pickImage(source: source, imageQuality: 88);
    if (file == null) return;
    final bytes = await file.readAsBytes();
    final caption = _messageController.text.trim();
    setState(() => _sending = true);
    try {
      await _service.sendMedia(
        detail.conversation.id,
        bytes: bytes,
        fileName: file.name,
        mimeType: 'image/jpeg',
        caption: caption,
      );
      _messageController.clear();
      await _loadDetail(forceBottom: true);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', ''))),
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _confirmAction(String action, String label) async {
    final detail = _detail;
    if (detail == null) return;
    final ok = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: Text(label),
            content: Text('¿Confirmas la acción "${label.toLowerCase()}"?'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancelar'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Confirmar'),
              ),
            ],
          ),
        ) ??
        false;
    if (!ok) return;
    try {
      await _service.performAction(detail.conversation.id, action);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$label completado.')),
      );
      await _loadDetail();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', ''))),
      );
    }
  }

  Future<void> _saveMeta() async {
    final detail = _detail;
    if (detail == null) return;
    setState(() => _savingMeta = true);
    try {
      await _service.saveMeta(
        detail.conversation.id,
        internalNote: _noteController.text.trim(),
        nextAction: _nextAction,
        manualPriority: _priority,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Ficha guardada.')),
      );
      await _loadDetail();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', ''))),
      );
    } finally {
      if (mounted) setState(() => _savingMeta = false);
    }
  }

  Future<void> _markReadyClose() async {
    final detail = _detail;
    if (detail == null) return;
    try {
      await _service.markReadyClose(detail.conversation.id);
      setState(() {
        _nextAction = 'cerrar';
        _priority = _priority.isEmpty ? 'high' : _priority;
      });
      await _saveMeta();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', ''))),
      );
    }
  }

  Future<void> _createVisit() async {
    final detail = _detail;
    if (detail == null) return;
    final result = await showDialog<bool>(
          context: context,
          builder: (context) => _CreateAdvisorVisitDialog(
            service: _service,
            detail: detail,
            advisorNote: _noteController.text.trim(),
          ),
        ) ??
        false;
    if (!result) return;
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Visita creada o actualizada.')),
    );
    await _loadDetail();
  }

  Future<void> _forwardToJeny(AdvisorInboxMessage message) async {
    final detail = _detail;
    if (detail == null) return;
    try {
      await _service.forwardToJeny(detail.conversation.id, message.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Reenviado a Jeny.')),
      );
      await _loadDetail();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', ''))),
      );
    }
  }

  Future<void> _openQuote() async {
    final detail = _detail;
    if (detail == null) return;
    final conversation = detail.conversation;
    final params = <String, String>{
      'source': 'advisor',
      if (conversation.customerName.isNotEmpty)
        'clientName': conversation.customerName,
      if (conversation.email.isNotEmpty) 'email': conversation.email,
      if (conversation.district.isNotEmpty || conversation.province.isNotEmpty)
        'city': [conversation.district, conversation.province]
            .where((item) => item.isNotEmpty)
            .join(' - '),
      if (conversation.id.isNotEmpty) 'reference': conversation.id,
      if (conversation.createdAt.isNotEmpty)
        'visitDate': conversation.createdAt.substring(0, 10),
      'technicianNotes': [
        if (conversation.installationAddress.isNotEmpty)
          'Dirección: ${conversation.installationAddress}',
        if (conversation.phonePretty.isNotEmpty)
          'Teléfono: ${conversation.phonePretty}',
        if (conversation.ticketContext.isNotEmpty)
          'Ticket: ${conversation.ticketContext}',
        if (conversation.handoffReason.isNotEmpty)
          'Motivo: ${conversation.handoffReason}',
        if (_noteController.text.trim().isNotEmpty)
          'Nota asesor: ${_noteController.text.trim()}',
      ].join('\n'),
    };
    final baseUri = Uri.parse(EvinkaApiService.instance.baseUrl);
    await launchUrl(
      baseUri.replace(path: '/', queryParameters: params),
      mode: LaunchMode.externalApplication,
    );
  }

  void _applyQuickReply(String text) {
    final current = _messageController.text.trim();
    _messageController.text = current.isEmpty ? text : '$current\n\n$text';
    _messageController.selection = TextSelection.fromPosition(
      TextPosition(offset: _messageController.text.length),
    );
  }

  Future<void> _showAttachmentMenu() async {
    await showModalBottomSheet<void>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Enviar imagen desde galería'),
              onTap: () async {
                Navigator.pop(context);
                await _sendImage(ImageSource.gallery);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Tomar foto'),
              onTap: () async {
                Navigator.pop(context);
                await _sendImage(ImageSource.camera);
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showProfileSheet() async {
    final detail = _detail;
    if (detail == null) return;
    final conversation = detail.conversation;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.82,
          minChildSize: 0.5,
          maxChildSize: 0.95,
          builder: (context, scrollController) => ListView(
            controller: scrollController,
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
            children: [
              Row(
                children: [
                  _AvatarBadge(label: conversation.customerName, radius: 26),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          conversation.customerName,
                          style: Theme.of(context)
                              .textTheme
                              .titleLarge
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          conversation.phonePretty.isNotEmpty
                              ? conversation.phonePretty
                              : conversation.phone,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _Pill(
                    text: _statusLabel(conversation.status),
                    background: _statusColor(context, conversation.status)
                        .withValues(alpha: 0.12),
                    foreground: _statusColor(context, conversation.status),
                  ),
                  if (conversation.assignedToLabel?.isNotEmpty == true)
                    _Pill(
                      text: conversation.assignedToLabel!,
                      background:
                          Theme.of(context).dividerColor.withValues(alpha: 0.2),
                      foreground:
                          Theme.of(context).textTheme.bodyMedium?.color ??
                              Colors.white,
                    ),
                ],
              ),
              const SizedBox(height: 18),
              _InfoTile(label: 'Motivo', value: conversation.handoffReason),
              _InfoTile(
                label: 'Ubicación',
                value: [conversation.district, conversation.province]
                    .where((item) => item.isNotEmpty)
                    .join(', '),
              ),
              _InfoTile(
                label: 'Dirección',
                value: conversation.installationAddress.isNotEmpty
                    ? conversation.installationAddress
                    : conversation.receiptAddress,
              ),
              _InfoTile(label: 'Email', value: conversation.email),
              _InfoTile(label: 'Ticket', value: conversation.ticketContext),
              _InfoTile(
                label: 'Historial',
                value:
                    '${conversation.historyMessageCount} mensajes · ${conversation.historyConversationCount} casos',
              ),
              const SizedBox(height: 16),
              Text(
                'Ficha interna',
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _noteController,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: 'Nota interna',
                  hintText:
                      'Qué pasó, qué falta y qué no debemos perder de vista',
                ),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _nextAction.isEmpty ? null : _nextAction,
                decoration: const InputDecoration(labelText: 'Próximo paso'),
                items: const [
                  DropdownMenuItem(
                      value: 'contactar_cliente',
                      child: Text('Contactar cliente')),
                  DropdownMenuItem(
                      value: 'pedir_datos', child: Text('Pedir datos')),
                  DropdownMenuItem(
                      value: 'agendar_visita', child: Text('Agendar visita')),
                  DropdownMenuItem(
                      value: 'enviar_cotizacion',
                      child: Text('Enviar cotización')),
                  DropdownMenuItem(
                      value: 'seguimiento', child: Text('Seguimiento')),
                  DropdownMenuItem(value: 'cerrar', child: Text('Cerrar')),
                ],
                onChanged: (value) => setState(() => _nextAction = value ?? ''),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _priority.isEmpty ? null : _priority,
                decoration: const InputDecoration(labelText: 'Prioridad'),
                items: const [
                  DropdownMenuItem(value: 'normal', child: Text('Normal')),
                  DropdownMenuItem(value: 'high', child: Text('Alta')),
                  DropdownMenuItem(value: 'urgent', child: Text('Urgente')),
                ],
                onChanged: (value) => setState(() => _priority = value ?? ''),
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: _savingMeta ? null : _saveMeta,
                icon: const Icon(Icons.save_outlined),
                label: Text(_savingMeta ? 'Guardando…' : 'Guardar ficha'),
              ),
              if (detail.files.isNotEmpty) ...[
                const SizedBox(height: 24),
                Text(
                  'Archivos del caso',
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 10),
                ...detail.files.map(
                  (file) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.insert_drive_file_outlined),
                    title: Text(
                        file.fileName.isNotEmpty ? file.fileName : 'Archivo'),
                    subtitle: Text(_formatDate(file.createdAt)),
                  ),
                ),
              ],
              if (detail.artifacts.isNotEmpty) ...[
                const SizedBox(height: 18),
                Text(
                  'Artefactos',
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 10),
                ...detail.artifacts.map(
                  (artifact) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.inventory_2_outlined),
                    title: Text(artifact.title.isNotEmpty
                        ? artifact.title
                        : artifact.artifactType),
                    subtitle: Text(artifact.summary.isNotEmpty
                        ? artifact.summary
                        : _formatDate(artifact.createdAt)),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _showActionsMenu() async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.pan_tool_alt_outlined),
              title: const Text('Tomar caso'),
              onTap: () async {
                Navigator.pop(context);
                await _confirmAction('claim', 'Tomar caso');
              },
            ),
            ListTile(
              leading: const Icon(Icons.restart_alt_rounded),
              title: const Text('Retomar caso'),
              onTap: () async {
                Navigator.pop(context);
                await _confirmAction('retake', 'Retomar caso');
              },
            ),
            ListTile(
              leading: const Icon(Icons.task_alt_outlined),
              title: const Text('Marcar resuelto'),
              onTap: () async {
                Navigator.pop(context);
                await _confirmAction('resolve', 'Marcar resuelto');
              },
            ),
            ListTile(
              leading: const Icon(Icons.smart_toy_outlined),
              title: const Text('Devolver al bot'),
              onTap: () async {
                Navigator.pop(context);
                await _confirmAction('return_to_bot', 'Devolver al bot');
              },
            ),
            ListTile(
              leading: const Icon(Icons.event_available_outlined),
              title: const Text('Crear visita'),
              onTap: () async {
                Navigator.pop(context);
                await _createVisit();
              },
            ),
            ListTile(
              leading: const Icon(Icons.request_quote_outlined),
              title: const Text('Abrir cotización'),
              onTap: () async {
                Navigator.pop(context);
                await _openQuote();
              },
            ),
            ListTile(
              leading: const Icon(Icons.check_circle_outline),
              title: const Text('Listo para cierre'),
              onTap: () async {
                Navigator.pop(context);
                await _markReadyClose();
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final detail = _detail;
    final conversation = detail?.conversation;

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: conversation == null
            ? const Text('Caso')
            : Row(
                children: [
                  _AvatarBadge(label: conversation.customerName, radius: 18),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          conversation.customerName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 16),
                        ),
                        Text(
                          conversation.phonePretty.isNotEmpty
                              ? conversation.phonePretty
                              : conversation.phone,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
        actions: [
          IconButton(
            tooltip: 'Ficha',
            onPressed: detail == null ? null : _showProfileSheet,
            icon: const Icon(Icons.badge_outlined),
          ),
          IconButton(
            tooltip: 'Acciones',
            onPressed: detail == null ? null : _showActionsMenu,
            icon: const Icon(Icons.more_vert),
          ),
        ],
      ),
      body: Column(
        children: [
          if (_loading) const LinearProgressIndicator(minHeight: 2),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
              child: Material(
                color: Colors.red.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(16),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline_rounded,
                          color: Colors.red),
                      const SizedBox(width: 10),
                      Expanded(child: Text(_error!)),
                    ],
                  ),
                ),
              ),
            ),
          if (conversation != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _Pill(
                      text: _statusLabel(conversation.status),
                      background: _statusColor(context, conversation.status)
                          .withValues(alpha: 0.12),
                      foreground: _statusColor(context, conversation.status),
                    ),
                    const SizedBox(width: 8),
                    _Pill(
                      text:
                          _priorityLabel(_priorityOfConversation(conversation)),
                      background: _priorityColor(
                        context,
                        _priorityOfConversation(conversation),
                      ).withValues(alpha: 0.12),
                      foreground: _priorityColor(
                          context, _priorityOfConversation(conversation)),
                    ),
                    if (conversation.handoffReason.isNotEmpty) ...[
                      const SizedBox(width: 8),
                      _Pill(
                        text: conversation.handoffReason,
                        background: Theme.of(context)
                            .dividerColor
                            .withValues(alpha: 0.18),
                        foreground:
                            Theme.of(context).textTheme.bodyMedium?.color ??
                                Colors.white,
                      ),
                    ],
                  ],
                ),
              ),
            ),
          Expanded(
            child: detail == null && _loading
                ? const Center(child: CircularProgressIndicator())
                : detail == null
                    ? Center(
                        child: FilledButton.icon(
                          onPressed: _loadDetail,
                          icon: const Icon(Icons.refresh),
                          label: const Text('Reintentar'),
                        ),
                      )
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.fromLTRB(12, 8, 12, 18),
                        itemCount: detail.messages.length,
                        itemBuilder: (context, index) {
                          final message = detail.messages[index];
                          return _MessageBubble(
                            message: message,
                            mediaHeaders: _service.mediaHeaders,
                            baseUrl: _service.baseUrl,
                            onForwardToJeny: message.hasMedia &&
                                    message.source != 'advisor_forward_jeny' &&
                                    !message.isSystem
                                ? () => _forwardToJeny(message)
                                : null,
                          );
                        },
                      ),
          ),
          if (detail != null)
            SizedBox(
              height: 44,
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 6),
                scrollDirection: Axis.horizontal,
                itemCount: _quickReplies.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) => ActionChip(
                  label: Text(
                    _quickReplyLabel(_quickReplies[index]),
                    overflow: TextOverflow.ellipsis,
                  ),
                  onPressed: () => _applyQuickReply(_quickReplies[index]),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
            child: Row(
              children: [
                IconButton(
                  tooltip: 'Enviar imagen',
                  onPressed:
                      detail == null || _sending ? null : _showAttachmentMenu,
                  icon: const Icon(Icons.add_photo_alternate_outlined),
                ),
                Expanded(
                  child: TextField(
                    controller: _messageController,
                    minLines: 1,
                    maxLines: 5,
                    textInputAction: TextInputAction.newline,
                    decoration: const InputDecoration(
                      hintText: 'Escribe tu respuesta…',
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: detail == null || _sending ? null : _sendMessage,
                  child: _sending
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.send_rounded),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    required this.message,
    required this.mediaHeaders,
    required this.baseUrl,
    this.onForwardToJeny,
  });

  final AdvisorInboxMessage message;
  final Map<String, String> mediaHeaders;
  final String baseUrl;
  final VoidCallback? onForwardToJeny;

  @override
  Widget build(BuildContext context) {
    final isAdvisor = message.isAdvisor;
    final align = isAdvisor ? CrossAxisAlignment.end : CrossAxisAlignment.start;
    final bubbleColor = message.isSystem
        ? Theme.of(context).dividerColor.withValues(alpha: 0.18)
        : isAdvisor
            ? Theme.of(context).colorScheme.primaryContainer
            : Theme.of(context).cardColor;
    final borderColor = message.isSystem
        ? Colors.transparent
        : Theme.of(context).dividerColor.withValues(alpha: 0.6);
    final textColor = isAdvisor
        ? Theme.of(context).colorScheme.onPrimaryContainer
        : Theme.of(context).textTheme.bodyLarge?.color;

    Widget content;
    if (message.type == 'location') {
      content = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            message.locationName?.isNotEmpty == true
                ? message.locationName!
                : 'Ubicación compartida',
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          if (message.locationAddress?.isNotEmpty == true)
            Text(message.locationAddress!),
        ],
      );
    } else if (message.type == 'contacts') {
      content = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            message.contactName?.isNotEmpty == true
                ? message.contactName!
                : 'Contacto compartido',
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          if (message.contactPhone?.isNotEmpty == true)
            Text(message.contactPhone!),
        ],
      );
    } else if (message.hasMedia && message.isImage) {
      final url = message.mediaUrl!.startsWith('http')
          ? message.mediaUrl!
          : '$baseUrl${message.mediaUrl!}';
      content = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Image.network(
              url,
              headers: mediaHeaders,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(
                height: 180,
                alignment: Alignment.center,
                color: Colors.black12,
                child: const Text('No pude cargar la imagen.'),
              ),
            ),
          ),
          if (message.text.trim().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(message.text.trim()),
          ],
        ],
      );
    } else if (message.hasMedia) {
      content = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.insert_drive_file_outlined, size: 18),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  message.fileName?.isNotEmpty == true
                      ? message.fileName!
                      : 'Archivo adjunto',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          if (message.text.trim().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(message.text.trim()),
          ],
        ],
      );
    } else {
      final text = [
        if (message.source == 'advisor_forward_jeny')
          'Reenviado a ${message.forwardedToLabel ?? 'Jeny'}',
        if (message.interactiveTitle?.isNotEmpty == true)
          message.interactiveTitle!,
        if (message.text.trim().isNotEmpty) message.text.trim(),
      ].join('\n');
      content = Text(text.isEmpty ? 'Mensaje sin texto' : text);
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment: align,
        children: [
          Container(
            constraints: const BoxConstraints(maxWidth: 340),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: bubbleColor,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: borderColor),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (message.isSystem)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Text(
                      'Evento del sistema',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                  ),
                DefaultTextStyle.merge(
                  style: TextStyle(color: textColor),
                  child: content,
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _formatTime(message.createdAt),
                      style: Theme.of(context).textTheme.labelSmall,
                    ),
                    if (message.advisorName?.isNotEmpty == true) ...[
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          message.advisorName!,
                          style: Theme.of(context).textTheme.labelSmall,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ],
                ),
                if (onForwardToJeny != null) ...[
                  const SizedBox(height: 10),
                  OutlinedButton.icon(
                    onPressed: onForwardToJeny,
                    icon: const Icon(Icons.forward_to_inbox_outlined, size: 18),
                    label: const Text('Reenviar a Jeny'),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AvatarBadge extends StatelessWidget {
  const _AvatarBadge({required this.label, this.radius = 22});

  final String label;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return CircleAvatar(
      radius: radius,
      backgroundColor:
          Theme.of(context).colorScheme.primary.withValues(alpha: 0.16),
      child: Text(
        _initials(label),
        style: TextStyle(
          fontWeight: FontWeight.w800,
          color: Theme.of(context).colorScheme.primary,
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({
    required this.text,
    required this.background,
    required this.foreground,
  });

  final String text;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: foreground,
          fontWeight: FontWeight.w700,
          fontSize: 12,
        ),
      ),
    );
  }
}

class _MiniStatCard extends StatelessWidget {
  const _MiniStatCard({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
            color: Theme.of(context).dividerColor.withValues(alpha: 0.8)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18),
          const SizedBox(height: 10),
          Text(
            value,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 2),
          Text(label, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  const _InfoTile({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    if (value.trim().isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(context)
                .textTheme
                .labelLarge
                ?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          Text(value),
        ],
      ),
    );
  }
}

String _initials(String text) {
  final parts = text
      .trim()
      .split(RegExp(r'\s+'))
      .where((item) => item.isNotEmpty)
      .toList();
  if (parts.isEmpty) return 'EV';
  return parts.take(2).map((item) => item[0]).join().toUpperCase();
}

String _formatDate(String value) {
  if (value.trim().isEmpty) return '';
  final parsed = DateTime.tryParse(value)?.toLocal();
  if (parsed == null) return value;
  return DateFormat('dd/MM/yyyy HH:mm', 'es').format(parsed);
}

String _formatTime(String value) {
  if (value.trim().isEmpty) return '';
  final parsed = DateTime.tryParse(value)?.toLocal();
  if (parsed == null) return value;
  return DateFormat('HH:mm', 'es').format(parsed);
}

String _statusLabel(String status) {
  switch (status) {
    case 'resolved':
      return 'Resuelto';
    case 'new':
      return 'Nuevo';
    default:
      return 'Abierto';
  }
}

String _priorityLabel(String value) {
  switch (value) {
    case 'urgent':
      return 'Urgente';
    case 'high':
      return 'Alta';
    default:
      return 'Normal';
  }
}

String _nextActionLabel(String value) {
  switch (value) {
    case 'contactar_cliente':
      return 'Contactar cliente';
    case 'pedir_datos':
      return 'Pedir datos';
    case 'agendar_visita':
      return 'Agendar visita';
    case 'enviar_cotizacion':
      return 'Enviar cotización';
    case 'seguimiento':
      return 'Seguimiento';
    case 'cerrar':
      return 'Cerrar';
    default:
      return value.replaceAll('_', ' ');
  }
}

String _quickReplyLabel(String text) {
  if (text.startsWith('¡Gracias!')) return 'Pedir ubicación';
  if (text.startsWith('Perfecto.')) return 'Agendar visita';
  if (text.startsWith('Para avanzar')) return 'Pedir recibo';
  if (text.startsWith('Antes de cotizarte')) return 'Confirmar potencia';
  return 'Seguimiento';
}

int _minutesSince(String value) {
  final parsed = DateTime.tryParse(value)?.toUtc();
  if (parsed == null) return 0;
  final diff = DateTime.now().toUtc().difference(parsed).inMinutes;
  return diff < 0 ? 0 : diff;
}

String _waitLabel(String value) {
  final mins = _minutesSince(value);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return '${mins} min';
  final hours = mins ~/ 60;
  final rest = mins % 60;
  return rest == 0 ? '${hours} h' : '${hours} h ${rest} min';
}

String _priorityOf(AdvisorInboxSummary item) {
  if (item.manualPriority == 'urgent' ||
      item.manualPriority == 'high' ||
      item.manualPriority == 'normal') {
    return item.manualPriority;
  }
  final text = '${item.handoffReason} ${item.lastMessageText}'.toLowerCase();
  final mins = _minutesSince(item.lastIncomingAt ?? item.lastMessageAt);
  const urgentSignals = [
    'urgente',
    'hoy',
    'ahora',
    'llamar',
    'caído',
    'problema'
  ];
  if (item.status == 'new' && (mins >= 20 || item.unreadCount >= 3))
    return 'urgent';
  if (urgentSignals.any(text.contains)) return 'urgent';
  if (item.status == 'new' || mins >= 8 || item.unreadCount > 0) return 'high';
  return 'normal';
}

String _priorityOfConversation(AdvisorInboxConversation item) {
  if (item.manualPriority == 'urgent' ||
      item.manualPriority == 'high' ||
      item.manualPriority == 'normal') {
    return item.manualPriority;
  }
  if (item.status == 'resolved') return 'normal';
  if (item.unreadCount > 0) return 'high';
  return 'normal';
}

Color _statusColor(BuildContext context, String status) {
  switch (status) {
    case 'resolved':
      return Colors.green;
    case 'new':
      return Colors.orange;
    default:
      return Theme.of(context).colorScheme.primary;
  }
}

Color _priorityColor(BuildContext context, String priority) {
  switch (priority) {
    case 'urgent':
      return Colors.red;
    case 'high':
      return Colors.orange;
    default:
      return Theme.of(context).colorScheme.primary;
  }
}

Color _waitToneColor(BuildContext context, AdvisorInboxSummary item) {
  if (item.status == 'resolved') return Colors.green;
  final mins = _minutesSince(item.lastIncomingAt ?? item.lastMessageAt);
  final threshold = item.status == 'new' ? 5 : 15;
  if (mins >= threshold * 2) return Colors.red;
  if (mins >= threshold) return Colors.orange;
  return Theme.of(context).colorScheme.primary;
}

class _CreateAdvisorVisitDialog extends StatefulWidget {
  const _CreateAdvisorVisitDialog({
    required this.service,
    required this.detail,
    required this.advisorNote,
  });

  final AdvisorInboxService service;
  final AdvisorInboxDetail detail;
  final String advisorNote;

  @override
  State<_CreateAdvisorVisitDialog> createState() =>
      _CreateAdvisorVisitDialogState();
}

class _CreateAdvisorVisitDialogState extends State<_CreateAdvisorVisitDialog> {
  Timer? _debounce;
  late final TextEditingController _receiptAddressController;
  late final TextEditingController _receiptDistrictController;
  late final TextEditingController _receiptProvinceController;
  late final TextEditingController _receiptPowerController;
  late final TextEditingController _receiverNameController;
  late final TextEditingController _receiverDocumentController;
  late final TextEditingController _receiverPhoneController;
  late final TextEditingController _receiverEmailController;
  late final TextEditingController _addressController;
  late final TextEditingController _vehicleBrandController;
  late final TextEditingController _vehicleModelController;
  late final TextEditingController _notesController;

  String _receiverRole = 'self';
  String _vehicleType = '';
  String _zone = '';
  String _selectedDate = '';
  String _selectedTime = '';
  String _selectedWindow = '';
  bool _loadingDays = false;
  bool _loadingSlots = false;
  bool _submitting = false;
  String _daysHelp =
      'Completa la dirección exacta para cargar los días disponibles.';
  String _slotsHelp = 'Primero elige un día disponible del chatbot.';
  List<AdvisorVisitOptionDay> _days = const [];
  List<AdvisorVisitOptionSlot> _slots = const [];

  AdvisorInboxConversation get _conversation => widget.detail.conversation;
  AdvisorInboxProfile get _profile => widget.detail.profile;

  @override
  void initState() {
    super.initState();
    _receiptAddressController = TextEditingController(
      text: _profile.receiptAddress.isNotEmpty
          ? _profile.receiptAddress
          : _conversation.receiptAddress,
    );
    _receiptDistrictController = TextEditingController(
      text: _profile.receiptDistrict.isNotEmpty
          ? _profile.receiptDistrict
          : _conversation.district,
    );
    _receiptProvinceController = TextEditingController(
      text: _profile.receiptProvince.isNotEmpty
          ? _profile.receiptProvince
          : _conversation.province,
    );
    _receiptPowerController =
        TextEditingController(text: _profile.receiptPower);
    _receiverNameController = TextEditingController(
      text: _profile.receiverName.isNotEmpty
          ? _profile.receiverName
          : _conversation.customerName,
    );
    _receiverDocumentController =
        TextEditingController(text: _profile.receiverDocument);
    _receiverPhoneController = TextEditingController(
      text: _profile.receiverPhone.isNotEmpty
          ? _profile.receiverPhone
          : (_conversation.phone.isNotEmpty
              ? _conversation.phone
              : _conversation.phonePretty),
    );
    _receiverEmailController = TextEditingController(
      text: _profile.receiverEmail.isNotEmpty
          ? _profile.receiverEmail
          : _conversation.email,
    );
    _addressController = TextEditingController(
      text: _profile.installationAddress.isNotEmpty
          ? _profile.installationAddress
          : (_conversation.installationAddress.isNotEmpty
              ? _conversation.installationAddress
              : _conversation.receiptAddress),
    );
    _vehicleBrandController =
        TextEditingController(text: _profile.vehicleBrand);
    _vehicleModelController =
        TextEditingController(text: _profile.vehicleModel);
    _notesController = TextEditingController(
      text: [
        _conversation.handoffReason,
        widget.advisorNote,
      ].where((item) => item.trim().isNotEmpty).join(' | '),
    );
    _vehicleType = _profile.vehicleType;

    for (final controller in [
      _addressController,
      _receiptDistrictController,
      _receiptProvinceController,
    ]) {
      controller.addListener(_scheduleVisitOptionsReload);
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadDays();
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _receiptAddressController.dispose();
    _receiptDistrictController.dispose();
    _receiptProvinceController.dispose();
    _receiptPowerController.dispose();
    _receiverNameController.dispose();
    _receiverDocumentController.dispose();
    _receiverPhoneController.dispose();
    _receiverEmailController.dispose();
    _addressController.dispose();
    _vehicleBrandController.dispose();
    _vehicleModelController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  void _scheduleVisitOptionsReload() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 500), () {
      if (mounted) _loadDays(preserveDate: true);
    });
  }

  void _applyReceiverPreset() {
    if (_receiverRole != 'self') return;
    _receiverNameController.text = _profile.receiverName.isNotEmpty
        ? _profile.receiverName
        : _conversation.customerName;
    _receiverDocumentController.text = _profile.receiverDocument;
    _receiverPhoneController.text = _profile.receiverPhone.isNotEmpty
        ? _profile.receiverPhone
        : (_conversation.phone.isNotEmpty
            ? _conversation.phone
            : _conversation.phonePretty);
    _receiverEmailController.text = _profile.receiverEmail.isNotEmpty
        ? _profile.receiverEmail
        : _conversation.email;
  }

  Future<void> _loadDays({bool preserveDate = false}) async {
    final clientAddress = _addressController.text.trim();
    if (clientAddress.isEmpty) {
      if (!mounted) return;
      setState(() {
        _days = const [];
        _slots = const [];
        _selectedDate = '';
        _selectedTime = '';
        _selectedWindow = '';
        _daysHelp =
            'Completa la dirección exacta para cargar los días disponibles.';
        _slotsHelp = 'Primero elige un día disponible del chatbot.';
      });
      return;
    }

    final previousDate = preserveDate ? _selectedDate : '';
    setState(() => _loadingDays = true);
    try {
      final options = await widget.service.getVisitOptions(
        _conversation.id,
        clientAddress: clientAddress,
        district: _receiptDistrictController.text.trim(),
        province: _receiptProvinceController.text.trim(),
      );
      if (!mounted) return;
      setState(() {
        _zone = options.zone;
        _days = options.days;
        _daysHelp = options.days.isEmpty
            ? 'No encontré días disponibles con la lógica real del chatbot.'
            : options.zone.isNotEmpty
                ? 'Zona detectada: ${options.zone}'
                : 'Días cargados desde la lógica real del chatbot.';
      });

      final stillAvailable = previousDate.isNotEmpty &&
          options.days.any((item) => item.date == previousDate);
      if (stillAvailable) {
        _selectedDate = previousDate;
        await _loadSlots(previousDate, preserveSelection: true);
      } else {
        setState(() {
          _selectedDate = '';
          _selectedTime = '';
          _selectedWindow = '';
          _slots = const [];
          _slotsHelp = 'Primero elige un día disponible del chatbot.';
        });
      }
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _days = const [];
        _slots = const [];
        _selectedDate = '';
        _selectedTime = '';
        _selectedWindow = '';
        _daysHelp = error.toString().replaceFirst('Exception: ', '');
        _slotsHelp = 'No pude consultar los horarios del chatbot.';
      });
    } finally {
      if (mounted) setState(() => _loadingDays = false);
    }
  }

  Future<void> _loadSlots(String date, {bool preserveSelection = false}) async {
    if (date.trim().isEmpty) return;
    final selectedWindow = preserveSelection ? _selectedWindow : '';
    setState(() => _loadingSlots = true);
    try {
      final options = await widget.service.getVisitOptions(
        _conversation.id,
        clientAddress: _addressController.text.trim(),
        district: _receiptDistrictController.text.trim(),
        province: _receiptProvinceController.text.trim(),
        scheduledDate: date,
      );
      if (!mounted) return;
      final slots = options.slots;
      final matched = selectedWindow.isNotEmpty
          ? slots.where((item) => item.label == selectedWindow).toList()
          : const <AdvisorVisitOptionSlot>[];
      setState(() {
        _selectedDate = date;
        _slots = slots;
        _slotsHelp = slots.isEmpty
            ? 'No encontré horarios libres para ese día.'
            : 'Horarios cargados desde la lógica real del chatbot.';
        if (matched.isNotEmpty) {
          _selectedWindow = matched.first.label;
          _selectedTime = matched.first.time;
        } else {
          _selectedWindow = '';
          _selectedTime = '';
        }
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _slots = const [];
        _selectedWindow = '';
        _selectedTime = '';
        _slotsHelp = error.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) setState(() => _loadingSlots = false);
    }
  }

  Future<void> _submit() async {
    final clientAddress = _addressController.text.trim();
    if (clientAddress.isEmpty) {
      _showError('Completa la dirección exacta de instalación.');
      return;
    }
    if (_receiptAddressController.text.trim().isEmpty ||
        _receiptDistrictController.text.trim().isEmpty ||
        _receiptProvinceController.text.trim().isEmpty ||
        _receiptPowerController.text.trim().isEmpty) {
      _showError(
          'Completa los datos manuales del recibo como lo hace el bot de Perú.');
      return;
    }
    if (_receiverNameController.text.trim().isEmpty ||
        _receiverDocumentController.text.trim().isEmpty ||
        _receiverPhoneController.text.trim().isEmpty ||
        _receiverEmailController.text.trim().isEmpty) {
      _showError('Completa los datos de la persona que recibirá la visita.');
      return;
    }
    if (_vehicleBrandController.text.trim().isEmpty ||
        _vehicleModelController.text.trim().isEmpty ||
        _vehicleType.trim().isEmpty) {
      _showError('Completa los datos del vehículo antes de crear la visita.');
      return;
    }
    if (_selectedDate.isEmpty ||
        _selectedTime.isEmpty ||
        _selectedWindow.isEmpty) {
      _showError('Selecciona un día y un horario real del chatbot.');
      return;
    }

    setState(() => _submitting = true);
    try {
      final parts = _selectedTime.split(':');
      final hour = int.tryParse(parts.first) ?? 0;
      final minute = int.tryParse(parts.length > 1 ? parts[1] : '0') ?? 0;
      final date = DateTime.parse(_selectedDate);
      final scheduledAt = DateTime(
        date.year,
        date.month,
        date.day,
        hour,
        minute,
      );
      await widget.service.createVisit(
        _conversation.id,
        clientAddress: clientAddress,
        receiptAddress: _receiptAddressController.text.trim(),
        receiptDistrict: _receiptDistrictController.text.trim(),
        receiptProvince: _receiptProvinceController.text.trim(),
        receiptPower: _receiptPowerController.text.trim(),
        receiverRole: _receiverRole,
        receiverName: _receiverNameController.text.trim(),
        receiverDocument: _receiverDocumentController.text.trim(),
        receiverPhone: _receiverPhoneController.text.trim(),
        receiverEmail: _receiverEmailController.text.trim(),
        vehicleBrand: _vehicleBrandController.text.trim(),
        vehicleModel: _vehicleModelController.text.trim(),
        vehicleType: _vehicleType.trim(),
        scheduledAt: scheduledAt.toUtc().toIso8601String(),
        scheduledDate: _selectedDate,
        exactTime: _selectedTime,
        timeWindow: _selectedWindow,
        notes: _notesController.text.trim(),
      );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (error) {
      _showError(error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final vehicleTypes = const [
      '100% eléctrico',
      'Híbrido enchufable',
      'No estoy seguro',
    ];
    return AlertDialog(
      titlePadding: const EdgeInsets.fromLTRB(24, 20, 24, 8),
      contentPadding: const EdgeInsets.fromLTRB(24, 0, 24, 12),
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Coordinar visita técnica'),
          const SizedBox(height: 6),
          Text(
            'Fase actual: alineación móvil del flujo PE. Objetivo: crear la visita exactamente como el bot. Falta: escoger un día y horario reales y completar los mismos campos que pide el chatbot.',
            style: theme.textTheme.bodySmall,
          ),
        ],
      ),
      content: SizedBox(
        width: 720,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: theme.colorScheme.surfaceContainerHighest
                      .withValues(alpha: 0.35),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color:
                        theme.colorScheme.outlineVariant.withValues(alpha: 0.5),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _conversation.customerName.isNotEmpty
                          ? _conversation.customerName
                          : 'Cliente sin nombre',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    if (_conversation.phonePretty.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(_conversation.phonePretty),
                    ],
                    if (_conversation.ticketContext.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text('Ticket: ${_conversation.ticketContext}'),
                    ],
                    if (_zone.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text('Zona detectada: $_zone'),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Text('Datos del recibo', style: theme.textTheme.titleMedium),
              const SizedBox(height: 10),
              TextField(
                controller: _receiptAddressController,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Dirección del suministro',
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _receiptDistrictController,
                      decoration: const InputDecoration(
                        labelText: 'Distrito',
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: _receiptProvinceController,
                      decoration: const InputDecoration(
                        labelText: 'Provincia',
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _receiptPowerController,
                decoration: const InputDecoration(
                  labelText: 'Potencia contratada',
                ),
              ),
              const SizedBox(height: 18),
              Text('Persona que recibirá la visita',
                  style: theme.textTheme.titleMedium),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: _receiverRole,
                decoration: const InputDecoration(labelText: 'Quién recibe'),
                items: const [
                  DropdownMenuItem(
                      value: 'self', child: Text('Cliente / titular del chat')),
                  DropdownMenuItem(value: 'other', child: Text('Otra persona')),
                ],
                onChanged: _submitting
                    ? null
                    : (value) {
                        setState(() => _receiverRole = value ?? 'self');
                        _applyReceiverPreset();
                      },
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _receiverNameController,
                decoration: const InputDecoration(labelText: 'Nombre completo'),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _receiverDocumentController,
                      decoration: const InputDecoration(labelText: 'Documento'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: _receiverPhoneController,
                      decoration: const InputDecoration(labelText: 'Teléfono'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _receiverEmailController,
                decoration: const InputDecoration(labelText: 'Correo'),
              ),
              const SizedBox(height: 18),
              Text('Instalación y agenda', style: theme.textTheme.titleMedium),
              const SizedBox(height: 10),
              TextField(
                controller: _addressController,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Dirección exacta de instalación',
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      _daysHelp,
                      style: theme.textTheme.bodySmall,
                    ),
                  ),
                  TextButton.icon(
                    onPressed: _loadingDays || _submitting ? null : _loadDays,
                    icon: _loadingDays
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.refresh_outlined),
                    label: const Text('Consultar'),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _days
                    .map(
                      (day) => ChoiceChip(
                        label:
                            Text(day.label.isNotEmpty ? day.label : day.date),
                        selected: _selectedDate == day.date,
                        onSelected: _submitting || _loadingSlots
                            ? null
                            : (_) => _loadSlots(day.date),
                      ),
                    )
                    .toList(),
              ),
              const SizedBox(height: 10),
              Text(
                _slotsHelp,
                style: theme.textTheme.bodySmall,
              ),
              const SizedBox(height: 8),
              if (_loadingSlots)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: LinearProgressIndicator(),
                ),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _slots
                    .map(
                      (slot) => ChoiceChip(
                        label: Text(slot.label),
                        selected: _selectedWindow == slot.label,
                        onSelected: _submitting
                            ? null
                            : (_) {
                                setState(() {
                                  _selectedWindow = slot.label;
                                  _selectedTime = slot.time;
                                });
                              },
                      ),
                    )
                    .toList(),
              ),
              const SizedBox(height: 18),
              Text('Vehículo', style: theme.textTheme.titleMedium),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _vehicleBrandController,
                      decoration: const InputDecoration(labelText: 'Marca'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: _vehicleModelController,
                      decoration: const InputDecoration(labelText: 'Modelo'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: _vehicleType.isNotEmpty ? _vehicleType : null,
                decoration:
                    const InputDecoration(labelText: 'Tipo de vehículo'),
                items: vehicleTypes
                    .map(
                      (item) =>
                          DropdownMenuItem(value: item, child: Text(item)),
                    )
                    .toList(),
                onChanged: _submitting
                    ? null
                    : (value) => setState(() => _vehicleType = value ?? ''),
              ),
              const SizedBox(height: 18),
              TextField(
                controller: _notesController,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Notas adicionales',
                ),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.pop(context, false),
          child: const Text('Cancelar'),
        ),
        FilledButton.icon(
          onPressed: _submitting ? null : _submit,
          icon: _submitting
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.event_available_outlined),
          label: const Text('Crear visita'),
        ),
      ],
    );
  }
}
