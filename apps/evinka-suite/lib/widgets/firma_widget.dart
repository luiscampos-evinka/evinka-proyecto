import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:signature/signature.dart';

class FirmaWidget extends StatefulWidget {
  final String titulo;
  final Function(Uint8List?) onFirmaCapturada;

  const FirmaWidget({
    super.key,
    required this.titulo,
    required this.onFirmaCapturada,
  });

  @override
  State<FirmaWidget> createState() => _FirmaWidgetState();
}

class _FirmaWidgetState extends State<FirmaWidget> {
  final SignatureController _controller = SignatureController(
    penStrokeWidth: 2,
    penColor: Colors.black,
    exportBackgroundColor: Colors.white,
  );
  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _guardarFirma() async {
    if (_controller.isNotEmpty) {
      final bytes = await _controller.toPngBytes();
      widget.onFirmaCapturada(bytes);
      if (mounted) Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.titulo, style: const TextStyle(fontSize: 14)),
      content: SizedBox(
        width: 300,
        height: 200,
        child: Column(
          children: [
            Container(
              decoration: BoxDecoration(
                border: Border.all(color: Colors.grey),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Signature(
                controller: _controller,
                height: 150,
                backgroundColor: Colors.white,
              ),
            ),
            const SizedBox(height: 8),
            const Text('Firme en el recuadro de arriba',
                style: TextStyle(fontSize: 12, color: Colors.grey)),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () {
            _controller.clear();
          },
          child: const Text('Limpiar'),
        ),
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancelar'),
        ),
        ElevatedButton(
          onPressed: _guardarFirma,
          child: const Text('Guardar Firma'),
        ),
      ],
    );
  }
}
