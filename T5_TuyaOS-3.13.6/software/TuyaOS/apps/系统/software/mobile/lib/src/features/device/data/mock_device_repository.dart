import 'dart:async';

import '../domain/device.dart';
import '../domain/device_repository.dart';
import '../domain/device_state.dart';

class MockDeviceRepository implements DeviceRepository {
  MockDeviceRepository() {
    for (final d in _devices) {
      _stateControllers[d.deviceId] = StreamController<DeviceState>.broadcast();
      _states[d.deviceId] = DeviceState.initial;
    }
  }

  final List<Device> _devices = const [
    Device(
      deviceId: 'mock-robot-001',
      productId: 'hdmfmu2akvw4egia',
      name: '客厅小陪',
      online: true,
      firmwareVersion: '3.13.6',
    ),
    Device(
      deviceId: 'mock-robot-002',
      productId: 'hdmfmu2akvw4egia',
      name: '奶奶卧室',
      online: false,
      firmwareVersion: '3.13.6',
    ),
  ];

  final _deviceController = StreamController<List<Device>>.broadcast();
  final _stateControllers = <String, StreamController<DeviceState>>{};
  final _states = <String, DeviceState>{};

  void _emit(String deviceId, DeviceState next) {
    _states[deviceId] = next;
    _stateControllers[deviceId]?.add(next);
  }

  Future<void> _simulateLatency() =>
      Future<void>.delayed(const Duration(milliseconds: 200));

  @override
  Stream<List<Device>> watchDevices() {
    scheduleMicrotask(() => _deviceController.add(_devices));
    return _deviceController.stream;
  }

  @override
  Future<Device?> getDevice(String deviceId) async =>
      _devices.where((d) => d.deviceId == deviceId).firstOrNull;

  @override
  Stream<DeviceState> watchDeviceState(String deviceId) {
    final controller = _stateControllers[deviceId];
    if (controller == null) {
      return const Stream.empty();
    }
    scheduleMicrotask(() => controller.add(_states[deviceId]!));
    return controller.stream;
  }

  @override
  DeviceState currentState(String deviceId) =>
      _states[deviceId] ?? DeviceState.initial;

  @override
  Future<void> setVolume(String deviceId, int value) async {
    await _simulateLatency();
    _emit(deviceId, currentState(deviceId).copyWith(volume: value));
  }

  @override
  Future<void> setMute(String deviceId, bool mute) async {
    await _simulateLatency();
    _emit(deviceId, currentState(deviceId).copyWith(mute: mute));
  }

  @override
  Future<void> setDoNotDisturb(String deviceId, bool enabled) async {
    await _simulateLatency();
    _emit(deviceId, currentState(deviceId).copyWith(doNotDisturb: enabled));
  }

  @override
  Future<void> ptzMove(String deviceId, PtzDirection direction) async {
    await _simulateLatency();
  }

  @override
  Future<void> ptzStop(String deviceId) async {
    await _simulateLatency();
  }

  @override
  Future<void> ptzReturnCenter(String deviceId) async {
    await _simulateLatency();
  }

  @override
  Future<void> sendExpression(
    String deviceId,
    DeviceExpression expression,
  ) async {
    await _simulateLatency();
    _emit(deviceId, currentState(deviceId).copyWith(expression: expression));
  }

  @override
  Future<void> sendActionNod(String deviceId) async {
    await _simulateLatency();
  }

  @override
  Future<void> sendActionShake(String deviceId) async {
    await _simulateLatency();
  }

  @override
  Future<void> setFaceTracking(String deviceId, bool enabled) async {
    await _simulateLatency();
    _emit(deviceId, currentState(deviceId).copyWith(faceTracking: enabled));
  }

  @override
  Future<void> triggerSosTest(String deviceId) async {
    await _simulateLatency();
    _emit(
      deviceId,
      currentState(deviceId).copyWith(fault: 'SOS 演示触发（mock 数据）'),
    );
    Timer(const Duration(seconds: 3), () {
      _emit(deviceId, currentState(deviceId).copyWith(fault: null));
    });
  }

  void dispose() {
    _deviceController.close();
    for (final c in _stateControllers.values) {
      c.close();
    }
  }
}

extension _FirstOrNull<E> on Iterable<E> {
  E? get firstOrNull => isEmpty ? null : first;
}
