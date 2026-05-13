import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../models/evinka_app_models.dart';

class EvinkaApiService {
  EvinkaApiService._();

  static final EvinkaApiService instance = EvinkaApiService._();

  static const String _baseUrl = 'https://cotizador.evinka.net';
  static const String _cookieKey = 'evinka_suite_cookie';
  static const String _cachedUserKey = 'evinka_suite_cached_user';

  String? _cookie;
  EvinkaUser? _cachedUser;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _cookie = prefs.getString(_cookieKey);
    final rawUser = prefs.getString(_cachedUserKey);
    if (rawUser != null && rawUser.isNotEmpty) {
      final parsed = _decodeJsonBody(rawUser);
      if (parsed is Map<String, dynamic>) {
        _cachedUser = EvinkaUser.fromJson(parsed);
      }
    }
  }

  String get baseUrl => _baseUrl;

  Future<void> _persistCookie() async {
    final prefs = await SharedPreferences.getInstance();
    if (_cookie == null || _cookie!.isEmpty) {
      await prefs.remove(_cookieKey);
    } else {
      await prefs.setString(_cookieKey, _cookie!);
    }
  }

  Future<void> _persistCachedUser(EvinkaUser? user) async {
    final prefs = await SharedPreferences.getInstance();
    _cachedUser = user;
    if (user == null) {
      await prefs.remove(_cachedUserKey);
    } else {
      await prefs.setString(_cachedUserKey, jsonEncode(user.toJson()));
    }
  }

  bool _isOfflineError(Object error) {
    return error is SocketException || error is TimeoutException;
  }

  Map<String, String> _headers({bool auth = true}) {
    return {
      HttpHeaders.acceptHeader: 'application/json',
      if (auth && _cookie != null && _cookie!.isNotEmpty)
        HttpHeaders.cookieHeader: _cookie!,
    };
  }

  dynamic _decodeJsonBody(String raw) {
    if (raw.isEmpty) return null;
    try {
      return jsonDecode(raw);
    } catch (_) {
      return null;
    }
  }

  Exception _responseException(
    http.Response response,
    dynamic parsed,
    String path,
  ) {
    if (parsed is Map<String, dynamic>) {
      final message = parsed['error']?.toString().trim();
      if (message != null && message.isNotEmpty) {
        return Exception(message);
      }
    }
    if (response.statusCode == 401) {
      return Exception('Sesión vencida. Vuelve a iniciar sesión.');
    }
    return Exception(
      'Respuesta inválida del servidor (${response.statusCode}) para $path.',
    );
  }

  Future<Map<String, dynamic>> _jsonRequest(
    String path, {
    String method = 'GET',
    Object? body,
    bool auth = true,
  }) async {
    final uri = Uri.parse('$_baseUrl$path');
    final request = http.Request(method, uri)
      ..headers.addAll({
        ..._headers(auth: auth),
        if (body != null) HttpHeaders.contentTypeHeader: 'application/json',
      });
    if (body != null) request.body = jsonEncode(body);

    final streamed = await request.send().timeout(const Duration(seconds: 40));
    final response = await http.Response.fromStream(streamed);

    final setCookie = response.headers['set-cookie'];
    if (setCookie != null && setCookie.isNotEmpty) {
      _cookie = setCookie.split(';').first.trim();
      await _persistCookie();
    }

    final raw = response.body.trim();
    final dynamic parsed = _decodeJsonBody(raw);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      if (response.statusCode == 401) {
        _cookie = null;
        await _persistCookie();
      }
      throw _responseException(response, parsed, path);
    }
    if (raw.isNotEmpty && parsed == null) {
      throw Exception('Respuesta inválida del servidor para $path.');
    }
    final data = parsed is Map<String, dynamic>
        ? parsed
        : <String, dynamic>{'data': parsed ?? <String, dynamic>{}};
    return data;
  }

  Future<List<dynamic>> _jsonListRequest(
    String path, {
    String method = 'GET',
    Object? body,
    bool auth = true,
  }) async {
    final uri = Uri.parse('$_baseUrl$path');
    final request = http.Request(method, uri)
      ..headers.addAll({
        ..._headers(auth: auth),
        if (body != null) HttpHeaders.contentTypeHeader: 'application/json',
      });
    if (body != null) request.body = jsonEncode(body);

    final streamed = await request.send().timeout(const Duration(seconds: 40));
    final response = await http.Response.fromStream(streamed);
    final setCookie = response.headers['set-cookie'];
    if (setCookie != null && setCookie.isNotEmpty) {
      _cookie = setCookie.split(';').first.trim();
      await _persistCookie();
    }

    final raw = response.body.trim();
    final dynamic parsed = _decodeJsonBody(raw);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      if (response.statusCode == 401) {
        _cookie = null;
        await _persistCookie();
      }
      throw _responseException(response, parsed, path);
    }
    if (raw.isNotEmpty && parsed == null) {
      throw Exception('Respuesta inválida del servidor para $path.');
    }
    if (parsed is! List<dynamic>) {
      throw Exception('Respuesta inválida del servidor para $path.');
    }
    return parsed;
  }

  Future<EvinkaUser?> restoreSession() async {
    if (_cookie == null || _cookie!.isEmpty) return _cachedUser;
    Map<String, dynamic> data;
    try {
      data = await _jsonRequest('/api/me');
    } catch (error) {
      if (_isOfflineError(error)) {
        return _cachedUser;
      }
      _cookie = null;
      await _persistCookie();
      await _persistCachedUser(null);
      return null;
    }
    final userMap = data['user'];
    if (userMap == null) return _cachedUser;
    final user = EvinkaUser.fromJson(Map<String, dynamic>.from(userMap as Map));
    await _persistCachedUser(user);
    return user;
  }

  Future<EvinkaUser> login(String identifier, String secret) async {
    final data = await _jsonRequest(
      '/api/login',
      method: 'POST',
      auth: false,
      body: {
        'identifier': identifier.trim(),
        'secret': secret,
      },
    );
    final user = EvinkaUser.fromJson(Map<String, dynamic>.from(data['user'] as Map));
    await _persistCachedUser(user);
    return user;
  }

  Future<String> registerAccessRequest({
    required String name,
    required String email,
    required String password,
  }) async {
    final data = await _jsonRequest(
      '/api/register-request',
      method: 'POST',
      auth: false,
      body: {
        'name': name.trim(),
        'email': email.trim(),
        'password': password,
      },
    );
    return data['message']?.toString() ?? 'Solicitud enviada.';
  }

  Future<void> logout() async {
    try {
      await _jsonRequest('/api/logout', method: 'POST');
    } catch (e) {
      // Logout is best-effort, but keep traceable.
      // ignore: avoid_print
      print('Logout warning: $e');
    }
    _cookie = null;
    await _persistCookie();
    await _persistCachedUser(null);
  }

  Future<EvinkaConfig> getCatalog() async {
    final data = await _jsonRequest('/api/catalog');
    return EvinkaConfig.fromJson(data);
  }

  Future<EvinkaConfig> updateCatalog(EvinkaConfig config) async {
    final data = await _jsonRequest('/api/catalog',
        method: 'PUT', body: config.toJson());
    return EvinkaConfig.fromJson(data);
  }

  Future<List<QuoteRecord>> getQuotes() async {
    final data = await _jsonListRequest('/api/quotes');
    return data
        .map((e) => QuoteRecord.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  Future<QuoteRecord> getQuote(String id) async {
    final data = await _jsonRequest('/api/quotes/${Uri.encodeComponent(id)}');
    return QuoteRecord.fromJson(data);
  }

  Future<QuoteRecord> createQuote(Map<String, dynamic> payload) async {
    final data =
        await _jsonRequest('/api/quotes', method: 'POST', body: payload);
    return QuoteRecord.fromJson(data);
  }

  Future<String> acceptQuote(String id) async {
    final data = await _jsonRequest(
        '/api/quotes/${Uri.encodeComponent(id)}/accept',
        method: 'POST');
    final order =
        Map<String, dynamic>.from(data['installationOrder'] as Map? ?? {});
    return order['id']?.toString() ?? '';
  }

  Future<QuoteRecord> updateQuoteStatus(
    String id, {
    required String status,
    String? visitId,
    String? reference,
  }) async {
    final data = await _jsonRequest(
      '/api/quotes/${Uri.encodeComponent(id)}/status',
      method: 'PATCH',
      body: {
        'status': status,
        if (visitId != null) 'visitId': visitId,
        if (reference != null) 'reference': reference,
      },
    );
    return QuoteRecord.fromJson(
      Map<String, dynamic>.from(data['quote'] as Map? ?? {}),
    );
  }

  Future<Map<String, dynamic>> scheduleInstallation(
    String quoteId, {
    required String scheduledAt,
    required String timeWindow,
    String? visitId,
    String? notes,
    String? clientPhone,
    String? clientAddress,
    String? assignedTechEmail,
  }) async {
    return _jsonRequest(
      '/api/quotes/${Uri.encodeComponent(quoteId)}/schedule-installation',
      method: 'POST',
      body: {
        'scheduledAt': scheduledAt,
        'timeWindow': timeWindow,
        if (visitId != null) 'visitId': visitId,
        if (notes != null) 'notes': notes,
        if (clientPhone != null) 'clientPhone': clientPhone,
        if (clientAddress != null) 'clientAddress': clientAddress,
        if (assignedTechEmail != null) 'assignedTechEmail': assignedTechEmail,
      },
    );
  }

  Future<List<TechVisit>> getTechVisits() async {
    final data = await _jsonListRequest('/api/tech/visits');
    return data
        .map((e) => TechVisit.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  Future<TechVisit> updateTechVisit(
    String id, {
    required String status,
    String? notes,
    String? resolution,
    String? quoteId,
    String? installationOrderId,
    List<String>? checklist,
  }) async {
    final data = await _jsonRequest(
      '/api/tech/visits/${Uri.encodeComponent(id)}',
      method: 'PATCH',
      body: {
        'status': status,
        if (notes != null) 'notes': notes,
        if (resolution != null) 'resolution': resolution,
        if (quoteId != null) 'quoteId': quoteId,
        if (installationOrderId != null)
          'installationOrderId': installationOrderId,
        if (checklist != null) 'checklist': checklist,
      },
    );
    return TechVisit.fromJson(data);
  }
}
