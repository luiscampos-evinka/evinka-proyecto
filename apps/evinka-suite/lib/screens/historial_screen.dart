import 'dart:async';
import 'package:flutter/material.dart';
import 'package:printing/printing.dart';

import '../services/historial_service.dart';

class HistorialScreen extends StatefulWidget {
  const HistorialScreen({super.key, this.onResumeDraft});

  final ValueChanged<String>? onResumeDraft;

  @override
  State<HistorialScreen> createState() => _HistorialScreenState();
}

class _HistorialScreenState extends State<HistorialScreen> {
  List<HistorialEntry> _historial = [];
  bool _cargando = true;

  bool get _isDark => Theme.of(context).brightness == Brightness.dark;
  Color get _accent =>
      _isDark ? const Color(0xFFD3AA74) : const Color(0xFF9C6A33);
  Color get _pageBg =>
      _isDark ? const Color(0xFF0F0F0F) : const Color(0xFFF5F5F5);
  Color get _mutedText => _isDark ? Colors.white70 : const Color(0xFF6F5B46);
  Color get _faintText => _isDark ? Colors.white54 : const Color(0xFF8A7764);

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  Future<void> _cargar() async {
    setState(() => _cargando = true);
    try {
      final lista = await HistorialService.cargarHistorial();
      if (mounted) {
        setState(() {
          _historial = lista;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('No pude cargar el historial: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  Future<void> _abrirPdf(HistorialEntry entry) async {
    try {
      final bytes = await HistorialService.leerPdf(entry.archivo);
      if (bytes == null) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Archivo no encontrado')),
        );
        return;
      }
      await Printing.sharePdf(bytes: bytes, filename: entry.archivo).timeout(
        const Duration(seconds: 20),
        onTimeout: () => throw TimeoutException(
            'Tiempo agotado al abrir el PDF compartido.'),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No pude abrir el PDF: $e')),
      );
    }
  }

  Future<void> _reintentar(HistorialEntry entry) async {
    try {
      await HistorialService.retrySync(entry);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text('Sincronización reintentada para ${entry.cliente}.')),
      );
      _cargar();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No pude reintentar la sync: $e')),
      );
    }
  }

  Future<void> _confirmarEliminar(HistorialEntry entry) async {
    final confirmar = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('¿Eliminar documento?'),
        content: Text('Se eliminará el documento de "${entry.cliente}".'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child:
                const Text('Eliminar', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (confirmar == true) {
      try {
        await HistorialService.eliminar(entry.id);
        _cargar();
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('No pude eliminar la conformidad: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _pageBg,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Documentos y sincronización',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            if (!_cargando)
              Text(
                '${_historial.length} documento${_historial.length != 1 ? 's' : ''}',
                style: const TextStyle(
                    fontSize: 12, fontWeight: FontWeight.normal),
              ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _cargar,
            tooltip: 'Actualizar',
          ),
        ],
      ),
      body: _cargando
          ? Center(child: CircularProgressIndicator(color: _accent))
          : _historial.isEmpty
              ? _pantallaVacia()
              : _lista(),
    );
  }

  Widget _pantallaVacia() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 100,
            height: 100,
            decoration: BoxDecoration(
              color: _accent.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(50),
            ),
            child: Icon(Icons.folder_open, size: 52, color: Colors.grey[400]),
          ),
          const SizedBox(height: 20),
          Text(
            'Sin documentos aún',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: _mutedText,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Los documentos generados aparecerán aquí',
            style: TextStyle(fontSize: 14, color: _faintText),
          ),
        ],
      ),
    );
  }

  Future<void> _sincronizarTodo() async {
    try {
      await HistorialService.retryPendingSyncs();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(HistorialService.syncQueueStatus.value.message)),
      );
      _cargar();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No pude sincronizar todo: $e')),
      );
    }
  }

  Widget _lista() {
    return RefreshIndicator(
      onRefresh: _cargar,
      color: _accent,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _syncBanner(),
          const SizedBox(height: 12),
          ..._historial
              .asMap()
              .entries
              .map((entry) => _tarjeta(entry.value, entry.key)),
        ],
      ),
    );
  }

  Widget _tarjeta(HistorialEntry entry, int index) {
    final onTap = entry.isDraft
        ? (widget.onResumeDraft == null
            ? () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text(
                        'Este borrador se reanuda desde el módulo de conformidad.'),
                  ),
                );
              }
            : () => widget.onResumeDraft!(entry.id))
        : () => _abrirPdf(entry);
    return Dismissible(
      key: Key(entry.id),
      direction: DismissDirection.endToStart,
      confirmDismiss: (_) async {
        await _confirmarEliminar(entry);
        return false;
      },
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 24),
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: Colors.red.shade400,
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Icon(Icons.delete_forever, color: Colors.white, size: 30),
      ),
      child: Card(
        margin: const EdgeInsets.only(bottom: 12),
        elevation: 2,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                _iconoDocumento(entry),
                const SizedBox(width: 14),
                Expanded(child: _infoEntry(entry)),
                _botonesAccion(entry),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _syncBanner() {
    return ValueListenableBuilder<SyncQueueStatus>(
      valueListenable: HistorialService.syncQueueStatus,
      builder: (context, status, _) {
        final bg =
            status.running ? const Color(0x1A9C6A33) : const Color(0x101565C0);
        final border =
            status.running ? const Color(0x339C6A33) : const Color(0x221565C0);
        final icon = status.running ? Icons.sync : Icons.check_circle_outline;
        final buttonLabel =
            status.running ? 'Sincronizando...' : 'Sincronizar todo';
        return Card(
          color: bg,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: border),
            ),
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Icon(icon, color: _accent),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        status.message,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        status.running
                            ? 'Procesando ${status.synced}/${status.total} · ${status.due} vencidos'
                            : 'Puedes forzar la sincronización cuando tengas internet.',
                        style: TextStyle(color: _mutedText, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                FilledButton.tonal(
                  onPressed: status.running ? null : _sincronizarTodo,
                  child: Text(buttonLabel),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _iconoDocumento(HistorialEntry entry) {
    return Container(
      width: 50,
      height: 50,
      decoration: BoxDecoration(
        color: _accent.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Icon(
        entry.isDraft ? Icons.edit_note : Icons.picture_as_pdf,
        color: _accent,
        size: 28,
      ),
    );
  }

  Widget _infoEntry(HistorialEntry entry) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          entry.cliente,
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        if (entry.isDraft)
          Padding(
            padding: const EdgeInsets.only(bottom: 2),
            child: Text(
              'Borrador editable',
              style: TextStyle(fontSize: 12, color: Colors.orange[700]),
            ),
          ),
        const SizedBox(height: 3),
        if (entry.ruc.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 2),
            child: Text(
              'RUC / DNI: ${entry.ruc}',
              style: TextStyle(fontSize: 12, color: _mutedText),
            ),
          ),
        if (entry.syncMessage.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 2),
            child: Text(
              entry.syncMessage,
              style: TextStyle(
                fontSize: 12,
                color: entry.syncStatus == 'error'
                    ? Colors.orange[700]
                    : _mutedText,
              ),
            ),
          ),
        if (entry.syncStatus == 'pending' || entry.syncStatus == 'error')
          Padding(
            padding: const EdgeInsets.only(bottom: 2),
            child: Text(
              entry.syncNextAttemptAt.isNotEmpty
                  ? 'Pendiente · próximo intento: ${entry.syncNextAttemptAt}'
                  : 'Pendiente de sincronización',
              style: TextStyle(fontSize: 12, color: Colors.orange[700]),
            ),
          ),
        if (entry.syncRetryCount > 0)
          Padding(
            padding: const EdgeInsets.only(bottom: 2),
            child: Text(
              'Intentos: ${entry.syncRetryCount}',
              style: TextStyle(fontSize: 12, color: _faintText),
            ),
          ),
        if (entry.syncLastError.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 2),
            child: Text(
              entry.syncLastError,
              style: TextStyle(fontSize: 11, color: Colors.orange[700]),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        if (entry.syncStatus == 'synced')
          Padding(
            padding: const EdgeInsets.only(bottom: 2),
            child: Text(
              'Sincronizado',
              style: TextStyle(fontSize: 12, color: Colors.green[700]),
            ),
          ),
        _fila(Icons.event, 'Instalación: ${entry.fecha}', _mutedText),
        const SizedBox(height: 2),
        _fila(
            Icons.access_time, 'Generado: ${entry.fechaGenerado}', _faintText),
      ],
    );
  }

  Widget _fila(IconData icon, String texto, Color color) {
    return Row(
      children: [
        Icon(icon, size: 11, color: color),
        const SizedBox(width: 4),
        Text(texto, style: TextStyle(fontSize: 12, color: color)),
      ],
    );
  }

  Widget _botonesAccion(HistorialEntry entry) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (entry.isDraft)
          IconButton(
            icon:
                const Icon(Icons.edit_note, color: Color(0xFF9C6A33), size: 22),
            onPressed: widget.onResumeDraft == null
                ? null
                : () => widget.onResumeDraft!(entry.id),
            tooltip: 'Reanudar borrador',
            padding: const EdgeInsets.all(6),
            constraints: const BoxConstraints(),
          ),
        if (entry.isDraft) const SizedBox(height: 4),
        if (entry.needsSync)
          IconButton(
            icon: const Icon(Icons.sync, color: Color(0xFF9C6A33), size: 22),
            onPressed: () => _reintentar(entry),
            tooltip: 'Reintentar sync',
            padding: const EdgeInsets.all(6),
            constraints: const BoxConstraints(),
          ),
        if (entry.needsSync) const SizedBox(height: 4),
        IconButton(
          icon: const Icon(Icons.share, color: Color(0xFF1565C0), size: 22),
          onPressed: () => _abrirPdf(entry),
          tooltip: 'Compartir',
          padding: const EdgeInsets.all(6),
          constraints: const BoxConstraints(),
        ),
        const SizedBox(height: 4),
        IconButton(
          icon: Icon(Icons.delete_outline, color: Colors.red[400], size: 22),
          onPressed: () => _confirmarEliminar(entry),
          tooltip: 'Eliminar',
          padding: const EdgeInsets.all(6),
          constraints: const BoxConstraints(),
        ),
      ],
    );
  }
}
