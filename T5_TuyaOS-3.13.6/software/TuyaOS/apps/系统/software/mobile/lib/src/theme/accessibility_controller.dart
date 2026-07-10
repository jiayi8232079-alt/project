import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// 适老化偏好控制器。
///
/// 管理「老人模式」开关 + 字号倍率，全局生效。
/// 持久化到 `flutter_secure_storage`，下次启动自动恢复。
class AccessibilityController extends ChangeNotifier {
  AccessibilityController({this.storage = const FlutterSecureStorage()});

  final FlutterSecureStorage storage;

  bool _elderlyMode = false;
  double _textScale = 1.0;

  bool get elderlyMode => _elderlyMode;
  double get textScale => _textScale;

  /// 老人模式下字号统一放大到 1.25 倍，普通模式 1.0 倍。
  /// 业务页面可以读这个值决定按钮高度等。
  double get baseFontSize => _elderlyMode ? 20 : 16;
  double get buttonHeight => _elderlyMode ? 64 : 56;

  Future<void> bootstrap() async {
    final elderly = await storage.read(key: 'elderly_mode');
    final scale = await storage.read(key: 'text_scale');
    _elderlyMode = elderly == 'true';
    _textScale = double.tryParse(scale ?? '') ?? (_elderlyMode ? 1.25 : 1.0);
    notifyListeners();
  }

  Future<void> setElderlyMode(bool enabled) async {
    _elderlyMode = enabled;
    _textScale = enabled ? 1.25 : 1.0;
    await storage.write(key: 'elderly_mode', value: enabled.toString());
    await storage.write(key: 'text_scale', value: _textScale.toString());
    notifyListeners();
  }

  Future<void> setTextScale(double scale) async {
    _textScale = scale.clamp(0.85, 1.6);
    await storage.write(key: 'text_scale', value: _textScale.toString());
    notifyListeners();
  }
}
