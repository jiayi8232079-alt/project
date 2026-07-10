import 'device.dart';
import 'device_state.dart';

/// Abstract repository for device IO.
///
/// Real implementation will wrap Tuya IoT App SDK (`DeviceManager.publishDps`,
/// `DeviceListener`, etc.). For now we ship a [MockDeviceRepository] so all UI
/// and business flows can be developed and demoed without hardware.
abstract class DeviceRepository {
  Stream<List<Device>> watchDevices();
  Future<Device?> getDevice(String deviceId);

  Stream<DeviceState> watchDeviceState(String deviceId);
  DeviceState currentState(String deviceId);

  Future<void> setVolume(String deviceId, int value);
  Future<void> setMute(String deviceId, bool mute);
  Future<void> setDoNotDisturb(String deviceId, bool enabled);

  /// Standard Tuya DP `ptz_control` enum: up/down/left/right.
  Future<void> ptzMove(String deviceId, PtzDirection direction);
  Future<void> ptzStop(String deviceId);
  Future<void> ptzReturnCenter(String deviceId);

  Future<void> sendExpression(String deviceId, DeviceExpression expression);
  Future<void> sendActionNod(String deviceId);
  Future<void> sendActionShake(String deviceId);
  Future<void> setFaceTracking(String deviceId, bool enabled);

  Future<void> triggerSosTest(String deviceId);
}
