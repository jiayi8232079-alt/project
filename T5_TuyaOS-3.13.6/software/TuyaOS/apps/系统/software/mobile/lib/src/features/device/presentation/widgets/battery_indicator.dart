import 'package:flutter/material.dart';

import '../../domain/device_state.dart';

class BatteryIndicator extends StatelessWidget {
  const BatteryIndicator({
    super.key,
    required this.battery,
    required this.chargeState,
  });

  final int battery;
  final ChargeState chargeState;

  IconData get _icon {
    if (chargeState == ChargeState.charging) return Icons.battery_charging_full;
    if (chargeState == ChargeState.full) return Icons.battery_full;
    if (battery <= 10) return Icons.battery_alert;
    if (battery <= 30) return Icons.battery_2_bar;
    if (battery <= 60) return Icons.battery_4_bar;
    return Icons.battery_6_bar;
  }

  Color _color(BuildContext context) {
    if (battery <= 10) return Theme.of(context).colorScheme.error;
    if (battery <= 30) return Colors.orange;
    return Theme.of(context).colorScheme.primary;
  }

  String get _label {
    switch (chargeState) {
      case ChargeState.charging:
        return '充电中 · $battery%';
      case ChargeState.full:
        return '已充满';
      case ChargeState.discharging:
        return '电量 $battery%';
      case ChargeState.unknown:
        return '电量 $battery%';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(_icon, color: _color(context)),
        const SizedBox(width: 6),
        Text(_label, style: const TextStyle(fontSize: 14)),
      ],
    );
  }
}
