import 'package:flutter/material.dart';

import 'form_screen.dart';
import 'historial_screen.dart';

class ConformidadModuleScreen extends StatefulWidget {
  const ConformidadModuleScreen({
    super.key,
    this.initialOrderCode,
    this.initialIndex = 0,
  });

  final String? initialOrderCode;
  final int initialIndex;

  @override
  State<ConformidadModuleScreen> createState() =>
      _ConformidadModuleScreenState();
}

class _ConformidadModuleScreenState extends State<ConformidadModuleScreen> {
  late int _currentIndex;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex.clamp(0, 1);
  }

  @override
  Widget build(BuildContext context) {
    final screens = [
      FormScreen(initialOrderCode: widget.initialOrderCode),
      const HistorialScreen(),
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
