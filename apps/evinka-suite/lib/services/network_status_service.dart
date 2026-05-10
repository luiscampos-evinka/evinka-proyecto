import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';

import 'evinka_api_service.dart';

enum NetworkState { unknown, online, offline }

extension NetworkStateLabel on NetworkState {
  String get label {
    switch (this) {
      case NetworkState.online:
        return 'Online';
      case NetworkState.offline:
        return 'Sin internet';
      case NetworkState.unknown:
        return 'Verificando...';
    }
  }
}

class NetworkStatusService {
  NetworkStatusService._();

  static final NetworkStatusService instance = NetworkStatusService._();

  final ValueNotifier<NetworkState> state =
      ValueNotifier<NetworkState>(NetworkState.unknown);

  Timer? _timer;
  bool _checking = false;

  Future<void> init() async {
    await checkNow();
    _timer ??= Timer.periodic(const Duration(seconds: 20), (_) {
      checkNow();
    });
  }

  Future<void> checkNow() async {
    if (_checking) return;
    _checking = true;
    try {
      final host = Uri.parse(EvinkaApiService.instance.baseUrl).host;
      final result = await InternetAddress.lookup(host)
          .timeout(const Duration(seconds: 5));
      final online = result.isNotEmpty && result.first.rawAddress.isNotEmpty;
      state.value = online ? NetworkState.online : NetworkState.offline;
    } catch (_) {
      state.value = NetworkState.offline;
    } finally {
      _checking = false;
    }
  }

  void dispose() {
    _timer?.cancel();
    _timer = null;
    state.dispose();
  }
}
