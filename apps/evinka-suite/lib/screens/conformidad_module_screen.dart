import 'package:flutter/material.dart';

import 'form_screen.dart';
import 'historial_screen.dart';

class ConformidadModuleScreen extends StatefulWidget {
  const ConformidadModuleScreen({
    super.key,
    this.initialOrderCode,
    this.initialDraftId,
    this.initialIndex = 0,
  });

  final String? initialOrderCode;
  final String? initialDraftId;
  final int initialIndex;

  @override
  State<ConformidadModuleScreen> createState() =>
      _ConformidadModuleScreenState();
}

class _ConformidadModuleScreenState extends State<ConformidadModuleScreen> {
  late int _currentIndex;
  String? _activeDraftId;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex.clamp(0, 1);
    _activeDraftId = widget.initialDraftId;
  }

  void _abrirBorrador(String draftId) {
    setState(() {
      _activeDraftId = draftId;
      _currentIndex = 0;
    });
  }

  @override
  Widget build(BuildContext context) {
    final screens = [
      FormScreen(
        initialOrderCode: widget.initialOrderCode,
        initialDraftId: _activeDraftId,
      ),
      HistorialScreen(onResumeDraft: _abrirBorrador),
    ];
    return Scaffold(
      body: IndexedStack(index: _currentIndex, children: screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) => setState(() => _currentIndex = index),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.assignment_outlined),
            selectedIcon: Icon(Icons.assignment),
            label: 'Nueva',
          ),
          NavigationDestination(
            icon: Icon(Icons.folder_copy_outlined),
            selectedIcon: Icon(Icons.folder_copy),
            label: 'Historial',
          ),
        ],
      ),
    );
  }
}
