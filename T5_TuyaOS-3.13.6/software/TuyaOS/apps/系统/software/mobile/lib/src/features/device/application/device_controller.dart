import 'dart:async';

import 'package:flutter/foundation.dart';

import '../domain/device.dart';
import '../domain/device_repository.dart';
import '../domain/device_state.dart';

class DeviceController extends ChangeNotifier {
  DeviceController({required this.repository, required this.deviceId}) {
    _stateSub = repository.watchDeviceState(deviceId).listen((state) {
      _state = state;
      notifyListeners();
    });
    repository.getDevice(deviceId).then((device) {
      _device = device;
      notifyListeners();
    });
  }

  final DeviceRepository repository;
  final String deviceId;

  Device? _device;
  DeviceState _state = DeviceState.initial;

  StreamSubscription<DeviceState>? _stateSub;

  Device? get device => _device;
  DeviceState get state => _state;

  Future<void> setVolume(int value) =>
      repository.setVolume(deviceId, value.clamp(0, 100));

  Future<void> toggleMute() =>
      repository.setMute(deviceId, !_state.mute);

  Future<void> toggleDoNotDisturb() =>
      repository.setDoNotDisturb(deviceId, !_state.doNotDisturb);

  Future<void> ptzMove(PtzDirection direction) =>
      repository.ptzMove(deviceId, direction);

  Future<void> ptzStop() => repository.ptzStop(deviceId);

  Future<void> ptzReturnCenter() => repository.ptzReturnCenter(deviceId);

  Future<void> sendExpression(DeviceExpression expression) =>
      repository.sendExpression(deviceId, expression);

  Future<void> nod() => repository.sendActionNod(deviceId);
  Future<void> shake() => repository.sendActionShake(deviceId);

  Future<void> toggleFaceTracking() =>
      repository.setFaceTracking(deviceId, !_state.faceTracking);

  Future<void> triggerSosTest() => repository.triggerSosTest(deviceId);

  @override
  void dispose() {
    _stateSub?.cancel();
    super.dispose();
  }
}
