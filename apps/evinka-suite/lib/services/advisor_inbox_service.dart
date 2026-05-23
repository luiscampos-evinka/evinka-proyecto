import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../config/evinka_app_config.dart';
import '../models/advisor_inbox_models.dart';
import '../models/evinka_app_models.dart';
import 'evinka_api_service.dart';

class AdvisorInboxService {
  AdvisorInboxService._();

  static final AdvisorInboxService instance = AdvisorInboxService._();

  static const String _cookieKey = 'evinka_advisor_cookie';
  static const String _cachedUserKey = 'evinka_advisor_cached_user';

  String? _cookie;
  bool _initialized = false;

  Future<void> init() async {
    if (_initialized) return;
    final prefs = await SharedPreferences.getInstance();
    _cookie = prefs.getString(_cookieKey);
    _initialized = true;
  }

  String get baseUrl => EvinkaAppConfig.advisorInboxUrl;

  Map<String, String> get mediaHeaders => {
        if (_cookie != null && _cookie!.isNotEmpty)
          HttpHeaders.cookieHeader: _cookie!,
      };

  String absoluteUrl(String path) {
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return '${baseUrl}$path';
  }

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
    if (user == null) {
      await prefs.remove(_cachedUserKey);
    } else {
      await prefs.setString(_cachedUserKey, jsonEncode(user.toJson()));
    }
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
      return Exception('Sesión del inbox vencida.');
    }
    return Exception(
      'Respuesta inválida del inbox (${response.statusCode}) para $path.',
    );
  }

  Map<String, String> _headers({bool auth = true, bool json = true}) {
    return {
      HttpHeaders.acceptHeader: 'application/json',
      if (json) HttpHeaders.contentTypeHeader: 'application/json',
      if (auth && _cookie != null && _cookie!.isNotEmpty)
        HttpHeaders.cookieHeader: _cookie!,
    };
  }

  Future<http.Response> _send(
    String path, {
    String method = 'GET',
    Object? body,
    bool auth = true,
    bool json = true,
  }) async {
    final request = http.Request(method, Uri.parse('${baseUrl}$path'))
      ..headers.addAll(_headers(auth: auth, json: json));
    if (body != null) {
      request.body = jsonEncode(body);
    }
    final streamed = await request.send().timeout(const Duration(seconds: 40));
    final response = await http.Response.fromStream(streamed);
    final setCookie = response.headers['set-cookie'];
    if (setCookie != null && setCookie.isNotEmpty) {
      _cookie = setCookie.split(';').first.trim();
      await _persistCookie();
    }
    if (response.statusCode == 401) {
      _cookie = null;
      await _persistCookie();
    }
    return response;
  }

  Future<Map<String, dynamic>> _jsonRequest(
    String path, {
    String method = 'GET',
    Object? body,
    bool auth = true,
  }) async {
    final response = await _send(path, method: method, body: body, auth: auth);
    final raw = response.body.trim();
    final parsed = _decodeJsonBody(raw);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw _responseException(response, parsed, path);
    }
    if (raw.isNotEmpty && parsed == null) {
      throw Exception('Respuesta inválida del inbox para $path.');
    }
    if (parsed is Map<String, dynamic>) return parsed;
    return {'data': parsed};
  }

  Future<List<dynamic>> _jsonListRequest(
    String path, {
    String method = 'GET',
    Object? body,
    bool auth = true,
  }) async {
    final response = await _send(path, method: method, body: body, auth: auth);
    final raw = response.body.trim();
    final parsed = _decodeJsonBody(raw);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw _responseException(response, parsed, path);
    }
    if (parsed is! List<dynamic>) {
      throw Exception('Respuesta inválida del inbox para $path.');
    }
    return parsed;
  }

  Future<EvinkaUser> ensureSession() async {
    await init();
    try {
      final me = await _jsonRequest('/api/me');
      final user = EvinkaUser.fromJson(
        Map<String, dynamic>.from(me['user'] as Map? ?? const {}),
      );
      await _persistCachedUser(user);
      return user;
    } catch (_) {
      final cotizadorToken = EvinkaApiService.instance.sessionToken;
      if (cotizadorToken == null || cotizadorToken.isEmpty) {
        throw Exception(
            'No encontré la sesión principal de EVINKA Suite para abrir el inbox.');
      }
      final data = await _jsonRequest(
        '/api/mobile/bootstrap',
        method: 'POST',
        auth: false,
        body: {'cotizadorSessionToken': cotizadorToken},
      );
      final user = EvinkaUser.fromJson(
        Map<String, dynamic>.from(data['user'] as Map? ?? const {}),
      );
      await _persistCachedUser(user);
      return user;
    }
  }

  Future<void> logout() async {
    try {
      await _jsonRequest('/api/logout', method: 'POST');
    } catch (_) {
      // best effort
    }
    _cookie = null;
    await _persistCookie();
    await _persistCachedUser(null);
  }

  Future<List<AdvisorInboxSummary>> getConversations(
      {String status = 'all'}) async {
    final data = await _jsonListRequest(
      '/api/inbox/conversations?status=${Uri.encodeQueryComponent(status)}',
    );
    return data
        .map((item) => AdvisorInboxSummary.fromJson(
              Map<String, dynamic>.from(item as Map),
            ))
        .toList();
  }

  Future<AdvisorInboxDetail> getConversationDetail(String id) async {
    final data = await _jsonRequest(
      '/api/inbox/conversations/${Uri.encodeComponent(id)}',
    );
    return AdvisorInboxDetail.fromJson(data);
  }

  Future<void> performAction(String id, String action) async {
    await _jsonRequest(
      '/api/inbox/conversations/${Uri.encodeComponent(id)}',
      method: 'PATCH',
      body: {'action': action},
    );
  }

  Future<void> saveMeta(
    String id, {
    required String internalNote,
    required String nextAction,
    required String manualPriority,
  }) async {
    await _jsonRequest(
      '/api/inbox/conversations/${Uri.encodeComponent(id)}/meta',
      method: 'PATCH',
      body: {
        'internalNote': internalNote,
        'nextAction': nextAction,
        'manualPriority': manualPriority,
      },
    );
  }

  Future<void> sendMessage(String id, String text) async {
    await _jsonRequest(
      '/api/inbox/conversations/${Uri.encodeComponent(id)}/messages',
      method: 'POST',
      body: {'text': text},
    );
  }

  Future<void> sendMedia(
    String id, {
    required Uint8List bytes,
    required String fileName,
    required String mimeType,
    String caption = '',
  }) async {
    await _jsonRequest(
      '/api/inbox/conversations/${Uri.encodeComponent(id)}/media',
      method: 'POST',
      body: {
        'fileName': fileName,
        'mimeType': mimeType,
        'caption': caption,
        'base64': base64Encode(bytes),
      },
    );
  }

  Future<void> forwardToJeny(String conversationId, String messageId) async {
    await _jsonRequest(
      '/api/inbox/conversations/${Uri.encodeComponent(conversationId)}/messages/${Uri.encodeComponent(messageId)}/forward-jeny',
      method: 'POST',
    );
  }

  Future<void> createVisit(
    String id, {
    required String clientAddress,
    required String receiptAddress,
    required String receiptDistrict,
    required String receiptProvince,
    required String receiptPower,
    required String receiverRole,
    required String receiverName,
    required String receiverDocument,
    required String receiverPhone,
    required String receiverEmail,
    required String vehicleBrand,
    required String vehicleModel,
    required String vehicleType,
    required String scheduledAt,
    required String scheduledDate,
    required String exactTime,
    String timeWindow = '',
    String notes = '',
  }) async {
    await _jsonRequest(
      '/api/inbox/conversations/${Uri.encodeComponent(id)}/actions/create-visit',
      method: 'POST',
      body: {
        'clientAddress': clientAddress,
        'receiptAddress': receiptAddress,
        'receiptDistrict': receiptDistrict,
        'receiptProvince': receiptProvince,
        'receiptPower': receiptPower,
        'receiverRole': receiverRole,
        'receiverName': receiverName,
        'receiverDocument': receiverDocument,
        'receiverPhone': receiverPhone,
        'receiverEmail': receiverEmail,
        'vehicleBrand': vehicleBrand,
        'vehicleModel': vehicleModel,
        'vehicleType': vehicleType,
        'scheduledAt': scheduledAt,
        'scheduledDate': scheduledDate,
        'exactTime': exactTime,
        'timeWindow': timeWindow,
        'notes': notes,
      },
    );
  }

  Future<AdvisorVisitOptions> getVisitOptions(
    String id, {
    required String clientAddress,
    required String district,
    required String province,
    String scheduledDate = '',
  }) async {
    final data = await _jsonRequest(
      '/api/inbox/conversations/${Uri.encodeComponent(id)}/visit-options',
      method: 'POST',
      body: {
        'clientAddress': clientAddress,
        'district': district,
        'province': province,
        'scheduledDate': scheduledDate,
      },
    );
    return AdvisorVisitOptions.fromJson(data);
  }

  Future<void> markReadyClose(String id) async {
    await _jsonRequest(
      '/api/inbox/conversations/${Uri.encodeComponent(id)}/actions/ready-close',
      method: 'POST',
      body: const {},
    );
  }

  Future<Uint8List> downloadBinary(String relativeOrAbsoluteUrl) async {
    final uri = Uri.parse(absoluteUrl(relativeOrAbsoluteUrl));
    final request = http.Request('GET', uri)
      ..headers.addAll({
        HttpHeaders.acceptHeader: '*/*',
        if (_cookie != null && _cookie!.isNotEmpty)
          HttpHeaders.cookieHeader: _cookie!,
      });
    final streamed = await request.send().timeout(const Duration(seconds: 40));
    final response = await http.Response.fromStream(streamed);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('No pude descargar el archivo.');
    }
    return response.bodyBytes;
  }
}
