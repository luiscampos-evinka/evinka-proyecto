import 'package:flutter/material.dart';

import '../models/evinka_app_models.dart';
import 'quote_builder_screen.dart';
import 'quotes_history_screen.dart';

class QuotesModuleScreen extends StatefulWidget {
  const QuotesModuleScreen({
    super.key,
    required this.user,
    this.initialIndex = 0,
  });

  final EvinkaUser user;
  final int initialIndex;

  @override
  State<QuotesModuleScreen> createState() => _QuotesModuleScreenState();
}

class _QuotesModuleScreenState extends State<QuotesModuleScreen> {
  late int _currentIndex;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex.clamp(0, 1);
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.user.canViewQuotes) {
      return Scaffold(
        appBar: AppBar(title: const Text('Cotizaciones')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'Este módulo comercial está restringido para este rol.',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
              textAlign: TextAlign.center,
            ),
          ),
        ),
      );
    }
    final screens = [
      if (widget.user.canCreateQuotes) QuoteBuilderScreen(user: widget.user),
      QuotesHistoryScreen(user: widget.user),
    ];
    final destinations = [
      if (widget.user.canCreateQuotes)
        const NavigationDestination(
          icon: Icon(Icons.request_quote_outlined),
          selectedIcon: Icon(Icons.request_quote),
          label: 'Nueva',
        ),
      const NavigationDestination(
        icon: Icon(Icons.folder_open_outlined),
        selectedIcon: Icon(Icons.folder_open),
        label: 'Cotizaciones',
      ),
    ];
    final safeIndex = _currentIndex.clamp(0, screens.length - 1);
    return Scaffold(
      body: IndexedStack(index: safeIndex, children: screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: safeIndex,
        onDestinationSelected: (index) => setState(() => _currentIndex = index),
        destinations: destinations,
      ),
    );
  }
}
