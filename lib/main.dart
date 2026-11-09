import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:webview_flutter/webview_flutter.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations(const [
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  runApp(const WallGuardApp());
}

class WallGuardApp extends StatelessWidget {
  const WallGuardApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'هجوم الكوابيس',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(useMaterial3: true),
      home: const GameScreen(),
    );
  }
}

class GameScreen extends StatefulWidget {
  const GameScreen({super.key});

  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> with WidgetsBindingObserver {
  late final WebViewController _controller;
  SharedPreferences? _prefs;
  String? _error;
  static const _saveKey = 'nm_v1';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.black)
      // نسخة احتياطية للحفظ على الجهاز إن تعذّر تخزين الصفحة نفسها
      ..addJavaScriptChannel('NMStore', onMessageReceived: (m) {
        _prefs?.setString(_saveKey, m.message);
      })
      ..setNavigationDelegate(NavigationDelegate(
        onPageStarted: (_) async {
          final saved = _prefs?.getString(_saveKey);
          if (saved != null) {
            await _controller.runJavaScript('window.__nmSaved=${jsonEncode(saved)};');
          }
        },
        onWebResourceError: (e) {
          if (mounted) setState(() => _error = e.description);
        },
      ));
    SharedPreferences.getInstance().then((p) {
      _prefs = p;
      _controller.loadFlutterAsset('assets/game/index.html');
    }).catchError((_) {
      _controller.loadFlutterAsset('assets/game/index.html');
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  // زر الرجوع في أندرويد: يمرّره إلى اللعبة (إيقاف/رجوع)، ويخرج فقط من القائمة الرئيسية
  Future<void> _onBack() async {
    try {
      final r = await _controller.runJavaScriptReturningResult(
          "window.__back ? window.__back() : 'exit'");
      if (r.toString().contains('exit')) {
        await SystemNavigator.pop();
      }
    } catch (_) {
      await SystemNavigator.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) _onBack();
      },
      child: _buildBody(),
    );
  }

  Widget _buildBody() {
    return Scaffold(
      backgroundColor: Colors.black,
      body: _error != null
          ? Center(
              child: Text(
                'تعذّر تحميل اللعبة\n$_error',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white),
              ),
            )
          : WebViewWidget(
              controller: _controller,
              gestureRecognizers: <Factory<OneSequenceGestureRecognizer>>{
                Factory<OneSequenceGestureRecognizer>(() => EagerGestureRecognizer()),
              },
            ),
    );
  }
}
