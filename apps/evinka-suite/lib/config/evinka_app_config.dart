import 'package:flutter/services.dart';

class EvinkaAppConfig {
  EvinkaAppConfig._();

  static const MethodChannel _channel = MethodChannel('evinka/config');

  static String _countryCode = const String.fromEnvironment(
    'EVINKA_COUNTRY',
    defaultValue: 'PE',
  );

  static String _appName = const String.fromEnvironment(
    'EVINKA_APP_NAME',
    defaultValue: 'EVINKA Suite PE',
  );

  static String _baseUrl = const String.fromEnvironment(
    'EVINKA_BASE_URL',
    defaultValue: 'https://pe-suite.evinka.net',
  );

  static String _advisorInboxUrl = const String.fromEnvironment(
    'EVINKA_ADVISOR_URL',
    defaultValue: 'https://asesor.evinka.net',
  );

  static Future<void> init() async {
    try {
      final raw = await _channel.invokeMethod<dynamic>('getConfig');
      final data = raw is Map ? raw.map((key, value) => MapEntry('$key', '$value')) : const <String, String>{};
      final country = (data['countryCode'] ?? '').trim().toUpperCase();
      if (country == 'CO' || country == 'PE') {
        _countryCode = country;
      }
      final appName = (data['appName'] ?? '').trim();
      if (appName.isNotEmpty) _appName = appName;
      final baseUrl = (data['baseUrl'] ?? '').trim();
      if (baseUrl.isNotEmpty) _baseUrl = baseUrl;
      final advisorInboxUrl = (data['advisorInboxUrl'] ?? '').trim();
      if (advisorInboxUrl.isNotEmpty) _advisorInboxUrl = advisorInboxUrl;
    } catch (_) {
      // Fallback a los valores compilados por defecto.
    }
  }

  static String get countryCode => _countryCode == 'CO' ? 'CO' : 'PE';
  static bool get isColombia => countryCode == 'CO';
  static bool get isPeru => !isColombia;

  static String get appName => _appName;
  static String get baseUrl => _baseUrl;
  static String get advisorInboxUrl => _advisorInboxUrl;
  static String get countryLabel => isColombia ? 'Colombia' : 'Perú';
  static String get defaultCity => isColombia ? 'Bogotá, Colombia' : 'Lima, Perú';
  static String get documentLabel => isColombia ? 'NIT o CC' : 'RUC o DNI';
  static String get documentCompactLabel => isColombia ? 'NIT / CC' : 'RUC / DNI';
  static String get phonePlaceholder => isColombia ? '3001234567' : '999123456';
}
