import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'config/evinka_app_config.dart';
import 'models/evinka_app_models.dart';
import 'screens/login_screen.dart';
import 'screens/suite_dashboard_screen.dart';
import 'services/app_settings_service.dart';
import 'services/evinka_api_service.dart';
import 'services/historial_service.dart';
import 'services/network_status_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await initializeDateFormatting('es');
  } catch (_) {
    // Si falla locale ES, la app igual debe iniciar.
  }
  try {
    await Firebase.initializeApp();
  } catch (_) {
    // La app igual puede operar en módulo cotizador aunque Firebase no esté disponible.
  }
  await EvinkaAppConfig.init();
  await EvinkaApiService.instance.init();
  await NetworkStatusService.instance.init();
  await HistorialService.startAutoQueueRunner();
  await AppSettingsService.instance.init();
  runApp(const EvinkaSuiteApp());
}

class EvinkaSuiteApp extends StatelessWidget {
  const EvinkaSuiteApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: AppSettingsService.instance.themeMode,
      builder: (context, mode, _) => MaterialApp(
        title: EvinkaAppConfig.appName,
        debugShowCheckedModeBanner: false,
        themeMode: mode,
        theme: _buildLightTheme(),
        darkTheme: _buildDarkTheme(),
        home: const _BootstrapScreen(),
      ),
    );
  }

  ThemeData _buildDarkTheme() {
    final scheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFF8C5A2B),
      brightness: Brightness.dark,
      primary: const Color(0xFFF3E9DC),
      secondary: const Color(0xFFD7B48A),
      surface: const Color(0xFF141414),
    );
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: const Color(0xFF0B0B0B),
      colorScheme: scheme,
      canvasColor: const Color(0xFF161616),
      dividerColor: const Color(0x22FFFFFF),
      textTheme: ThemeData.dark(useMaterial3: true).textTheme.apply(
            bodyColor: Colors.white,
            displayColor: Colors.white,
          ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Color(0xFF0E0E0E),
        foregroundColor: Colors.white,
        centerTitle: false,
      ),
      cardTheme: CardThemeData(
        color: const Color(0xFF141414),
        elevation: 8,
        shadowColor: Colors.black54,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      ),
      navigationBarTheme: const NavigationBarThemeData(
        backgroundColor: Color(0xFF1A140E),
        indicatorColor: Color(0x33D3AA74),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: const Color(0xFF171717),
        titleTextStyle: const TextStyle(
            color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700),
        contentTextStyle: const TextStyle(color: Colors.white70),
      ),
      popupMenuTheme: PopupMenuThemeData(
        color: const Color(0xFF171717),
        textStyle: const TextStyle(color: Colors.white),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: const Color(0xFF111111),
        labelStyle: const TextStyle(color: Colors.white70),
        hintStyle: const TextStyle(color: Colors.white54),
        border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: Color(0x22FFFFFF))),
        enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: Color(0x22FFFFFF))),
        focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: Color(0xFFD7B48A))),
      ),
    );
  }

  ThemeData _buildLightTheme() {
    final scheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFF7A4B21),
      brightness: Brightness.light,
      primary: const Color(0xFF55331A),
      secondary: const Color(0xFF8C5A2B),
      surface: Colors.white,
    );
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: const Color(0xFFF6F1EA),
      colorScheme: scheme,
      canvasColor: Colors.white,
      dividerColor: const Color(0x141E1A16),
      textTheme: ThemeData.light(useMaterial3: true).textTheme.apply(
            bodyColor: const Color(0xFF241A12),
            displayColor: const Color(0xFF241A12),
          ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: Color(0xFF1E1A16),
        centerTitle: false,
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        elevation: 4,
        shadowColor: Color(0x14000000),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      ),
      navigationBarTheme: const NavigationBarThemeData(
        backgroundColor: Colors.white,
        indicatorColor: Color(0x22D3AA74),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: Colors.white,
        titleTextStyle: const TextStyle(
            color: Color(0xFF241A12),
            fontSize: 20,
            fontWeight: FontWeight.w700),
        contentTextStyle: const TextStyle(color: Color(0xFF6B5641)),
      ),
      popupMenuTheme: PopupMenuThemeData(
        color: Colors.white,
        textStyle: const TextStyle(color: Color(0xFF241A12)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: const Color(0xFFF9F6F1),
        labelStyle: const TextStyle(color: Color(0xFF6B5641)),
        hintStyle: const TextStyle(color: Color(0xFF8A7764)),
        border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: Color(0x1F1E1A16))),
        enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: Color(0x1F1E1A16))),
        focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: Color(0xFF7A4B21))),
      ),
    );
  }
}

class _BootstrapScreen extends StatefulWidget {
  const _BootstrapScreen();

  @override
  State<_BootstrapScreen> createState() => _BootstrapScreenState();
}

class _BootstrapScreenState extends State<_BootstrapScreen> {
  EvinkaUser? _user;
  bool _checking = true;
  bool _syncingPending = false;

  @override
  void initState() {
    super.initState();
    NetworkStatusService.instance.state.addListener(_onNetworkStateChanged);
    _restore();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _syncIfOnline();
    });
  }

  @override
  void dispose() {
    NetworkStatusService.instance.state.removeListener(_onNetworkStateChanged);
    super.dispose();
  }

  void _onNetworkStateChanged() {
    if (NetworkStatusService.instance.state.value == NetworkState.online) {
      _syncIfOnline();
    }
  }

  Future<void> _syncIfOnline() async {
    if (_syncingPending) return;
    if (NetworkStatusService.instance.state.value != NetworkState.online)
      return;
    _syncingPending = true;
    try {
      await HistorialService.runAutomaticQueue();
    } finally {
      _syncingPending = false;
    }
  }

  Future<void> _restore() async {
    try {
      final user = await EvinkaApiService.instance.restoreSession();
      if (mounted) setState(() => _user = user);
    } catch (_) {
      // Sesión inválida o caída del backend.
    } finally {
      if (mounted) setState(() => _checking = false);
    }
  }

  Future<void> _login(String identifier, String secret) async {
    final user = await EvinkaApiService.instance.login(identifier, secret);
    if (!mounted) return;
    setState(() => _user = user);
  }

  Future<void> _logout() async {
    await EvinkaApiService.instance.logout();
    if (!mounted) return;
    setState(() => _user = null);
  }

  @override
  Widget build(BuildContext context) {
    if (_checking) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_user == null) {
      return LoginScreen(onLogin: _login);
    }
    return SuiteDashboardScreen(user: _user!, onLogout: _logout);
  }
}
