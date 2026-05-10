import 'package:flutter/material.dart';

import '../models/evinka_app_models.dart';
import 'tech_visits_screen.dart';
import 'technician_workboard_screen.dart';

class VisitsModuleScreen extends StatefulWidget {
  const VisitsModuleScreen(
      {super.key, required this.user, this.initialIndex = 0});

  final EvinkaUser user;
  final int initialIndex;

  @override
  State<VisitsModuleScreen> createState() => _VisitsModuleScreenState();
}

class _VisitsModuleScreenState extends State<VisitsModuleScreen> {
  late int _currentIndex;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex.clamp(0, 1);
  }

  @override
  Widget build(BuildContext context) {
    final screens = [
      TechVisitsScreen(user: widget.user),
      TechnicianWorkboardScreen(user: widget.user),
    ];
    return Scaffold(
      body: IndexedStack(index: _currentIndex, children: screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) => setState(() => _currentIndex = index),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.calendar_month_outlined),
            selectedIcon: Icon(Icons.calendar_month),
            label: 'Agenda',
          ),
          NavigationDestination(
            icon: Icon(Icons.assignment_late_outlined),
            selectedIcon: Icon(Icons.assignment_late),
            label: 'Pendientes',
          ),
        ],
      ),
    );
  }
}
