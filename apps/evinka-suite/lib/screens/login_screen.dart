import 'package:flutter/material.dart';

import '../services/app_settings_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({
    super.key,
    required this.onLogin,
    required this.onRequestAccess,
    this.initialEmail = '',
  });

  final Future<void> Function(String email, String password) onLogin;
  final Future<String> Function(String name, String email, String password)
      onRequestAccess;
  final String initialEmail;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _emailCtrl;
  final _passwordCtrl = TextEditingController();
  final _requestNameCtrl = TextEditingController();
  final _requestEmailCtrl = TextEditingController();
  final _requestPasswordCtrl = TextEditingController();
  bool _loading = false;
  bool _obscure = true;
  bool _showRequest = false;
  bool _requestObscure = true;

  @override
  void initState() {
    super.initState();
    _emailCtrl = TextEditingController(text: widget.initialEmail);
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _requestNameCtrl.dispose();
    _requestEmailCtrl.dispose();
    _requestPasswordCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      await widget.onLogin(_emailCtrl.text.trim(), _passwordCtrl.text);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submitRequest() async {
    if ((_requestNameCtrl.text).trim().isEmpty) {
      _showMessage('Ingresa tu nombre.');
      return;
    }
    final email = _requestEmailCtrl.text.trim();
    if (email.isEmpty || !email.contains('@')) {
      _showMessage('Ingresa un correo válido.');
      return;
    }
    if (_requestPasswordCtrl.text.length < 10) {
      _showMessage('La contraseña debe tener al menos 10 caracteres.');
      return;
    }
    setState(() => _loading = true);
    try {
      final message = await widget.onRequestAccess(
        _requestNameCtrl.text,
        email,
        _requestPasswordCtrl.text,
      );
      if (!mounted) return;
      _showMessage(message);
      setState(() => _showRequest = false);
      _requestNameCtrl.clear();
      _requestEmailCtrl.clear();
      _requestPasswordCtrl.clear();
    } catch (e) {
      _showMessage(e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: isDark
                ? const [
                    Color(0xFF090909),
                    Color(0xFF111111),
                    Color(0xFF17120D)
                  ]
                : const [
                    Color(0xFFF8F3EC),
                    Color(0xFFF2E7D9),
                    Color(0xFFEAD8BF)
                  ],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 460),
                child: Card(
                  elevation: 18,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(28)),
                  child: Padding(
                    padding: const EdgeInsets.all(28),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(18),
                                child: Image.asset('assets/logo.png',
                                    width: 64, height: 64, fit: BoxFit.cover),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('EVINKA Suite',
                                        style: theme.textTheme.headlineSmall
                                            ?.copyWith(
                                                fontWeight: FontWeight.w800)),
                                    const SizedBox(height: 4),
                                    Text(
                                        'Cotizador + conformidad + control comercial',
                                        style: theme.textTheme.bodyMedium),
                                  ],
                                ),
                              ),
                              IconButton(
                                tooltip: 'Cambiar tema',
                                onPressed: () =>
                                    AppSettingsService.instance.toggleTheme(),
                                icon: Icon(
                                  Theme.of(context).brightness ==
                                          Brightness.dark
                                      ? Icons.light_mode_outlined
                                      : Icons.dark_mode_outlined,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 28),
                          TextFormField(
                            controller: _emailCtrl,
                            keyboardType: TextInputType.emailAddress,
                            decoration:
                                const InputDecoration(labelText: 'Correo'),
                            validator: (value) =>
                                (value == null || value.trim().isEmpty)
                                    ? 'Ingresa tu correo'
                                    : null,
                          ),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: _passwordCtrl,
                            obscureText: _obscure,
                            decoration: InputDecoration(
                              labelText: 'Contraseña',
                              suffixIcon: IconButton(
                                onPressed: () =>
                                    setState(() => _obscure = !_obscure),
                                icon: Icon(_obscure
                                    ? Icons.visibility_outlined
                                    : Icons.visibility_off_outlined),
                              ),
                            ),
                            validator: (value) =>
                                (value == null || value.isEmpty)
                                    ? 'Ingresa tu contraseña'
                                    : null,
                            onFieldSubmitted: (_) => _submit(),
                          ),
                          const SizedBox(height: 24),
                          FilledButton.icon(
                            onPressed: _loading ? null : _submit,
                            icon: _loading
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2),
                                  )
                                : const Icon(Icons.login),
                            label: Text(_loading ? 'Entrando...' : 'Entrar'),
                          ),
                          const SizedBox(height: 12),
                          OutlinedButton.icon(
                            onPressed: _loading
                                ? null
                                : () => setState(
                                    () => _showRequest = !_showRequest),
                            icon: const Icon(Icons.verified_user_outlined),
                            label: Text(_showRequest
                                ? 'Ocultar solicitud'
                                : 'Solicitar acceso corporativo'),
                          ),
                          if (_showRequest) ...[
                            const SizedBox(height: 18),
                            Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: isDark
                                    ? const Color(0xFF1C1916)
                                    : const Color(0xFFF5F0E8),
                                borderRadius: BorderRadius.circular(20),
                                border:
                                    Border.all(color: const Color(0x22C7A06A)),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  Text(
                                    'Acceso para personal EVINKA',
                                    style: theme.textTheme.titleMedium
                                        ?.copyWith(fontWeight: FontWeight.w800),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    'Solo para correos @evinka.tech. La cuenta queda pendiente hasta aprobación del admin.',
                                    style: theme.textTheme.bodySmall,
                                  ),
                                  const SizedBox(height: 14),
                                  TextField(
                                    controller: _requestNameCtrl,
                                    decoration: const InputDecoration(
                                        labelText: 'Nombre completo'),
                                  ),
                                  const SizedBox(height: 12),
                                  TextField(
                                    controller: _requestEmailCtrl,
                                    keyboardType: TextInputType.emailAddress,
                                    decoration: const InputDecoration(
                                        labelText: 'Correo corporativo'),
                                  ),
                                  const SizedBox(height: 12),
                                  TextField(
                                    controller: _requestPasswordCtrl,
                                    obscureText: _requestObscure,
                                    decoration: InputDecoration(
                                      labelText: 'Contraseña',
                                      suffixIcon: IconButton(
                                        onPressed: () => setState(() =>
                                            _requestObscure = !_requestObscure),
                                        icon: Icon(_requestObscure
                                            ? Icons.visibility_outlined
                                            : Icons.visibility_off_outlined),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 14),
                                  FilledButton(
                                    onPressed: _loading ? null : _submitRequest,
                                    child: Text(_loading
                                        ? 'Enviando...'
                                        : 'Enviar solicitud'),
                                  ),
                                ],
                              ),
                            ),
                          ],
                          const SizedBox(height: 14),
                          Text(
                            'Login técnico/admin conectado al backend actual. Las cuentas nuevas @evinka.tech ahora pasan por aprobación manual.',
                            style: theme.textTheme.bodySmall,
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
