enum DeviceExpression {
  idle,
  happy,
  thinking,
  listening,
  sleepy,
  worried;

  String get label {
    switch (this) {
      case DeviceExpression.idle:
        return '待机';
      case DeviceExpression.happy:
        return '开心';
      case DeviceExpression.thinking:
        return '思考';
      case DeviceExpression.listening:
        return '聆听';
      case DeviceExpression.sleepy:
        return '困了';
      case DeviceExpression.worried:
        return '担心';
    }
  }

  String get cmdValue {
    switch (this) {
      case DeviceExpression.idle:
        return 'blink';
      case DeviceExpression.happy:
        return 'happy';
      case DeviceExpression.thinking:
        return 'thinking';
      case DeviceExpression.listening:
        return 'listening';
      case DeviceExpression.sleepy:
        return 'sleepy';
      case DeviceExpression.worried:
        return 'worried';
    }
  }
}

enum PtzDirection { up, down, left, right }

extension PtzDirectionX on PtzDirection {
  String get dpValue {
    switch (this) {
      case PtzDirection.up:
        return 'up';
      case PtzDirection.down:
        return 'down';
      case PtzDirection.left:
        return 'left';
      case PtzDirection.right:
        return 'right';
    }
  }
}

enum ChargeState { discharging, charging, full, unknown }

class DeviceState {
  const DeviceState({
    required this.volume,
    required this.mute,
    required this.doNotDisturb,
    required this.battery,
    required this.chargeState,
    required this.expression,
    required this.faceTracking,
    this.fault,
  });

  final int volume;
  final bool mute;
  final bool doNotDisturb;
  final int battery;
  final ChargeState chargeState;
  final DeviceExpression expression;
  final bool faceTracking;
  final String? fault;

  static const initial = DeviceState(
    volume: 60,
    mute: false,
    doNotDisturb: false,
    battery: 78,
    chargeState: ChargeState.discharging,
    expression: DeviceExpression.idle,
    faceTracking: false,
  );

  DeviceState copyWith({
    int? volume,
    bool? mute,
    bool? doNotDisturb,
    int? battery,
    ChargeState? chargeState,
    DeviceExpression? expression,
    bool? faceTracking,
    String? fault,
  }) => DeviceState(
    volume: volume ?? this.volume,
    mute: mute ?? this.mute,
    doNotDisturb: doNotDisturb ?? this.doNotDisturb,
    battery: battery ?? this.battery,
    chargeState: chargeState ?? this.chargeState,
    expression: expression ?? this.expression,
    faceTracking: faceTracking ?? this.faceTracking,
    fault: fault ?? this.fault,
  );
}
