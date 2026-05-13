import 'package:flutter/material.dart';

import '../services/app_settings_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({
    super.key,
    required this.onLogin,
    this.initialIdentifier = '',
  });

  final Future<void> Function(String identifier, String secret) onLogin;
  final String initialIdentifier;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _identifierCtrl;
  final _secretCtrl = TextEditingController();
  bool _loading = false;
  bool _obscure = true;

  @override
  void initState() {
    super.initState();
    _identifierCtrl = TextEditingController(text: widget.initialIdentifier);
  }

  @override
  void dispose() {
    _identifierCtrl.dispose();
    _secretCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      await widget.onLogin(_identifierCtrl.text.trim(), _secretCtrl.text);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final brandAsset =
        isDark ? 'assets/logo_dark.png' : 'assets/logo_light.png';
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
                    borderRadius: BorderRadius.circular(28),
                  ),
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
                                child: Image.asset(
                                  brandAsset,
                                  width: 64,
                                  height: 64,
                                  fit: BoxFit.cover,
                                ),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'EVINKA Suite',
                                      style: theme.textTheme.headlineSmall
                                          ?.copyWith(
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      'Ingreso rápido por código + PIN',
                                      style: theme.textTheme.bodyMedium,
                                    ),
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
                            controller: _identifierCtrl,
                            textCapitalization: TextCapitalization.characters,
                            decoration: const InputDecoration(
                              labelText: 'Código',
                              hintText: 'Ej. TEC014',
                            ),
                            validator: (value) =>
                                (value == null || value.trim().isEmpty)
                                    ? 'Ingresa tu código'
                                    : null,
                          ),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: _secretCtrl,
                            keyboardType: TextInputType.number,
                            obscureText: _obscure,
                            decoration: InputDecoration(
                              labelText: 'PIN',
                              hintText: '4 a 8 dígitos',
                              suffixIcon: IconButton(
                                onPressed: () =>
                                    setState(() => _obscure = !_obscure),
                                icon: Icon(
                                  _obscure
                                      ? Icons.visibility_outlined
                                      : Icons.visibility_off_outlined,
                                ),
                              ),
                            ),
                            validator: (value) =>
                                (value == null || value.isEmpty)
                                    ? 'Ingresa tu PIN'
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
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Icon(Icons.login),
                            label: Text(_loading ? 'Entrando...' : 'Entrar'),
                          ),
                          const SizedBox(height: 16),
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: isDark
                                  ? const Color(0xFF1C1916)
                                  : const Color(0xFFF5F0E8),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: const Color(0x22C7A06A),
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '¿No tienes código o PIN?',
                                  style: theme.textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  'El administrador crea la cuenta y te asigna el código y el PIN. Después del primer ingreso online, la app puede volver a abrir sin internet.',
                                  style: theme.textTheme.bodySmall,
                                ),
                              ],
                            ),
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
