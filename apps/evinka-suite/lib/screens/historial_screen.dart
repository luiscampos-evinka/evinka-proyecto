import 'dart:async';
import 'package:flutter/material.dart';
import 'package:printing/printing.dart';
import '../services/historial_service.dart';

class HistorialScreen extends StatefulWidget {
  const HistorialScreen({super.key});

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
        onTimeout: () => throw TimeoutException('Tiempo agotado al abrir el PDF compartido.'),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No pude abrir el PDF: $e')),
      );
    }
  }

  Future<void> _confirmarEliminar(HistorialEntry entry) async {
    final confirmar = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('¿Eliminar conformidad?'),
        content: Text('Se eliminará la conformidad de "${entry.cliente}".'),
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
              'Conformidades generadas',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            if (!_cargando)
              Text(
                '${_historial.length} conformidad${_historial.length != 1 ? 'es' : ''}',
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
            'Sin conformidades aún',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: _mutedText,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Las conformidades generadas aparecerán aquí',
            style: TextStyle(fontSize: 14, color: _faintText),
          ),
        ],
      ),
    );
  }

  Widget _lista() {
    return RefreshIndicator(
      onRefresh: _cargar,
      color: _accent,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _historial.length,
        itemBuilder: (_, i) => _tarjeta(_historial[i], i),
      ),
    );
  }

  Widget _tarjeta(HistorialEntry entry, int index) {
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
          onTap: () => _abrirPdf(entry),
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                _iconoPdf(),
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

  Widget _iconoPdf() {
    return Container(
      width: 50,
      height: 50,
      decoration: BoxDecoration(
        color: _accent.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Icon(Icons.picture_as_pdf, color: _accent, size: 28),
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
