import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/evinka_app_models.dart';
import '../services/evinka_api_service.dart';
import 'conformidad_module_screen.dart';

class QuotesHistoryScreen extends StatefulWidget {
  const QuotesHistoryScreen({super.key, required this.user});

  final EvinkaUser user;

  @override
  State<QuotesHistoryScreen> createState() => _QuotesHistoryScreenState();
}

class _QuotesHistoryScreenState extends State<QuotesHistoryScreen> {
  final _api = EvinkaApiService.instance;
  bool _loading = true;
  String _busyQuoteId = '';
  List<QuoteRecord> _quotes = const [];

  Color get _mutedText => Theme.of(context).brightness == Brightness.dark
      ? Colors.white70
      : const Color(0xFF6F5B46);

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final quotes = await _api.getQuotes();
      setState(() => _quotes = quotes);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('No pude cargar el historial: $e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openPdf(QuoteRecord quote) async {
    setState(() => _busyQuoteId = quote.id);
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
      if (mounted) setState(() => _busyQuoteId = '');
    }
  }

  Future<void> _openConformidad(QuoteRecord quote) async {
    if (quote.installationOrderId.isEmpty) return;
    try {
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => ConformidadModuleScreen(
              initialOrderCode: quote.installationOrderId),
        ),
      );
      if (mounted) {
        await _load();
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No pude abrir conformidad: $e')),
      );
    }
  }

  Future<void> _confirmQuote(QuoteRecord quote) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Confirmar cotización'),
        content: Text(
            'Esto dejará la cotización lista para enviarse al cliente de ${quote.clientName}. ¿Continuar?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancelar')),
          FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Confirmar')),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _busyQuoteId = quote.id);
    try {
      final updated =
          await _api.updateQuoteStatus(quote.id, status: 'lista_envio');
      if (!mounted) return;
      _replaceQuote(updated);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Cotización confirmada. Ya quedó lista para envío.')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('No pude confirmar la cotización: $e')));
    } finally {
      if (mounted) setState(() => _busyQuoteId = '');
    }
  }

  Future<void> _markClientAccepted(QuoteRecord quote) async {
    final payment = await _promptPaymentCapture(
      title: 'Registrar abono 50%',
      clientName: quote.clientName,
      suggestedAmount: quote.total * 0.5,
      suggestedObservation: 'Abono 50% confirmado por KAM desde EVINKA Suite.',
    );
    if (payment == null) return;
    await _updateQuoteStatus(
      quote,
      status: 'aceptada_cliente',
      successMessage:
          'Abono inicial registrado. Ahora ya puedes agendar la instalación.',
      paymentAmount: payment.amount,
      paymentObservation: payment.observation,
    );
  }

  Future<void> _markFullPayment(QuoteRecord quote) async {
    final payment = await _promptPaymentCapture(
      title: 'Registrar abono 100%',
      clientName: quote.clientName,
      suggestedAmount: quote.total,
      suggestedObservation: 'Abono 100% confirmado por KAM desde EVINKA Suite.',
    );
    if (payment == null) return;
    await _updateQuoteStatus(
      quote,
      status: 'abono_100_confirmado',
      successMessage: 'Abono 100% registrado. El proyecto quedó cerrado.',
      paymentAmount: payment.amount,
      paymentObservation: payment.observation,
    );
  }

  Future<void> _requestRecotizar(QuoteRecord quote) async {
    final ok = await _confirmAction(
      title: 'Marcar para recotizar',
      message:
          'La cotización de ${quote.clientName} volverá a estado recotizar. ¿Continuar?',
    );
    if (!ok) return;
    await _updateQuoteStatus(
      quote,
      status: 'recotizar',
      successMessage: 'La cotización quedó marcada para recotizar.',
    );
  }

  Future<void> _cancelQuote(QuoteRecord quote) async {
    final ok = await _confirmAction(
      title: 'Cancelar cotización',
      message:
          'La cotización de ${quote.clientName} quedará cancelada. ¿Continuar?',
    );
    if (!ok) return;
    await _updateQuoteStatus(
      quote,
      status: 'cancelada',
      successMessage: 'La cotización quedó cancelada.',
    );
  }

  Future<void> _updateQuoteStatus(
    QuoteRecord quote, {
    required String status,
    required String successMessage,
    double? paymentAmount,
    String? paymentObservation,
  }) async {
    setState(() => _busyQuoteId = quote.id);
    try {
      final updated = await _api.updateQuoteStatus(
        quote.id,
        status: status,
        paymentAmount: paymentAmount,
        paymentObservation: paymentObservation,
        paymentDate: DateTime.now().toIso8601String(),
      );
      if (!mounted) return;
      _replaceQuote(updated);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(successMessage)));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No pude actualizar la cotización: $e')),
      );
    } finally {
      if (mounted) setState(() => _busyQuoteId = '');
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

  void _replaceQuote(QuoteRecord updated) {
    setState(() {
      _quotes = _quotes
          .map((item) => item.id == updated.id ? updated : item)
          .toList(growable: false);
    });
  }

  Future<void> _scheduleInstallation(QuoteRecord quote) async {
    final initialDate = DateTime.now();
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

    final addressCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final notesCtrl = TextEditingController();
    final techEmailCtrl = TextEditingController(text: widget.user.email);
    final timeLabel = MaterialLocalizations.of(context).formatTimeOfDay(
      pickedTime,
      alwaysUse24HourFormat: false,
    );
    final timeWindowCtrl = TextEditingController(text: timeLabel);

    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Agendar instalación'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Fecha: ${DateFormat('dd/MM/yyyy').format(pickedDate)}'),
              const SizedBox(height: 8),
              Text('Hora: $timeLabel'),
              const SizedBox(height: 12),
              TextField(
                controller: timeWindowCtrl,
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
              const SizedBox(height: 12),
              TextField(
                controller: techEmailCtrl,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(
                  labelText: 'Correo del técnico asignado',
                ),
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
            child: const Text('Agendar'),
          ),
        ],
      ),
    );
    if (ok != true) return;

    final assignedTechEmail = techEmailCtrl.text.trim();
    if (assignedTechEmail.isEmpty || !assignedTechEmail.contains('@')) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Ingresa el correo del técnico asignado.')),
      );
      return;
    }

    final scheduledAt = DateTime(
      pickedDate.year,
      pickedDate.month,
      pickedDate.day,
      pickedTime.hour,
      pickedTime.minute,
    ).toUtc().toIso8601String();

    setState(() => _busyQuoteId = quote.id);
    try {
      await _api.scheduleInstallation(
        quote.id,
        scheduledAt: scheduledAt,
        timeWindow: timeWindowCtrl.text.trim().isEmpty
            ? timeLabel
            : timeWindowCtrl.text.trim(),
        clientPhone: phoneCtrl.text.trim(),
        clientAddress: addressCtrl.text.trim(),
        notes: notesCtrl.text.trim(),
        assignedTechEmail: assignedTechEmail,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Visita agendada correctamente.')),
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No pude agendar la instalación: $e')),
      );
    } finally {
      if (mounted) setState(() => _busyQuoteId = '');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Cotizaciones'),
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh))
        ],
      ),
      body: !widget.user.canViewQuotes
          ? Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 720),
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Card(
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(24)),
                    child: const Padding(
                      padding: EdgeInsets.all(24),
                      child: Text(
                        'Este rol no tiene acceso al historial de cotizaciones en la app.',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                ),
              ),
            )
          : _loading
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _quotes.length,
                    itemBuilder: (context, index) {
                      final quote = _quotes[index];
                      final isBusy = _busyQuoteId == quote.id;
                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(20)),
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      _displayQuoteLabel(quote),
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w800,
                                          fontSize: 16),
                                    ),
                                  ),
                                  _pill(quote.statusLabel),
                                ],
                              ),
                              const SizedBox(height: 10),
                              Wrap(
                                spacing: 16,
                                runSpacing: 10,
                                children: [
                                  _info('Cliente', quote.clientName),
                                  _info('Correo',
                                      quote.email.isEmpty ? '-' : quote.email),
                                  _info('Perfil', quote.profileName),
                                  _info('Instalación',
                                      '${quote.installationType} · ${quote.propertyType}'),
                                  _info(
                                      'Total',
                                      NumberFormat.currency(
                                              locale: 'es_PE', symbol: 'S/ ')
                                          .format(quote.total)),
                                  _info('Fecha', _formatDate(quote.createdAt)),
                                  _info(
                                      'Orden',
                                      quote.installationOrderId.isEmpty
                                          ? 'Sin orden'
                                          : quote.installationOrderId),
                                ],
                              ),
                              const SizedBox(height: 14),
                              Wrap(
                                spacing: 10,
                                runSpacing: 10,
                                children: [
                                  FilledButton.icon(
                                    onPressed: isBusy || quote.pdfPath.isEmpty
                                        ? null
                                        : () => _openPdf(quote),
                                    icon: const Icon(
                                        Icons.picture_as_pdf_outlined),
                                    label: const Text('PDF'),
                                  ),
                                  if (widget.user.canConfirmQuoteForSend &&
                                      quote.canConfirmForSend)
                                    OutlinedButton.icon(
                                      onPressed: isBusy
                                          ? null
                                          : () => _confirmQuote(quote),
                                      icon: const Icon(
                                          Icons.check_circle_outline),
                                      label: const Text('Confirmar cotización'),
                                    ),
                                  if (widget.user.canMarkInitialPayment &&
                                      quote.canMarkClientAccepted)
                                    FilledButton.tonalIcon(
                                      onPressed: isBusy
                                          ? null
                                          : () => _markClientAccepted(quote),
                                      icon: const Icon(
                                          Icons.thumb_up_alt_outlined),
                                      label: const Text('Abono 50%'),
                                    ),
                                  if (widget.user.canEditCommercialFlow &&
                                      quote.canRequestRecotizar)
                                    OutlinedButton.icon(
                                      onPressed: isBusy
                                          ? null
                                          : () => _requestRecotizar(quote),
                                      icon: const Icon(Icons.refresh_outlined),
                                      label: const Text('Recotizar'),
                                    ),
                                  if (widget.user.canEditCommercialFlow &&
                                      quote.canCancel)
                                    OutlinedButton.icon(
                                      onPressed: isBusy
                                          ? null
                                          : () => _cancelQuote(quote),
                                      icon: const Icon(Icons.cancel_outlined),
                                      label: const Text('Cotización cancelada'),
                                    ),
                                  if (widget.user.canScheduleInstallationFlow &&
                                      quote.canScheduleInstallation)
                                    FilledButton.icon(
                                      onPressed: isBusy
                                          ? null
                                          : () => _scheduleInstallation(quote),
                                      icon: const Icon(
                                          Icons.event_available_outlined),
                                      label: const Text('Agendar instalación'),
                                    ),
                                  if (widget.user.canMarkFullPayment &&
                                      quote.canMarkFullPayment)
                                    FilledButton.tonalIcon(
                                      onPressed: isBusy
                                          ? null
                                          : () => _markFullPayment(quote),
                                      icon: const Icon(Icons.payments_outlined),
                                      label: const Text('Abono 100%'),
                                    ),
                                  if (widget.user.canReviewConformityFlow &&
                                      quote.canOpenConformity)
                                    OutlinedButton.icon(
                                      onPressed: isBusy
                                          ? null
                                          : () => _openConformidad(quote),
                                      icon:
                                          const Icon(Icons.fact_check_outlined),
                                      label: const Text('Abrir conformidad'),
                                    ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }

  Widget _pill(String text) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: isDark ? const Color(0x332B4D73) : const Color(0x1455331A),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: isDark ? const Color(0x557DA2FF) : const Color(0x3355331A),
        ),
      ),
      child: Text(
        text,
        style: const TextStyle(fontWeight: FontWeight.w700),
      ),
    );
  }

  Widget _info(String label, String value) {
    return SizedBox(
      width: 170,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 12, color: _mutedText)),
          const SizedBox(height: 3),
          Text(value,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  String _displayQuoteLabel(QuoteRecord quote) {
    return quote.pdfFilename.isNotEmpty
        ? quote.pdfFilename.replaceAll('.pdf', '')
        : quote.id;
  }

  String _formatDate(String iso) {
    final date = DateTime.tryParse(iso);
    if (date == null) return iso;
    return DateFormat('dd/MM/yyyy HH:mm').format(date.toLocal());
  }
}

class _PaymentCapture {
  const _PaymentCapture({required this.amount, required this.observation});

  final double amount;
  final String observation;
}
