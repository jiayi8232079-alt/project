import 'package:flutter/material.dart';

import '../../data/models/enums.dart';
import '../../theme/app_tokens.dart';

class OrderStatusChip extends StatelessWidget {
  const OrderStatusChip({super.key, required this.status, this.label});

  final OrderStatus status;

  /// 可选的精确文案（如后端的"待派单/待评价"），不传则用枚举默认文案。
  final String? label;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (status) {
      OrderStatus.pending => (AppColors.warningSoft, AppColors.warning),
      OrderStatus.confirmed => (AppColors.infoSoft, AppColors.info),
      OrderStatus.inService => (AppColors.primarySoft, AppColors.primary),
      OrderStatus.completed => (AppColors.successSoft, AppColors.success),
      OrderStatus.cancelled => (AppColors.surfaceVariant, AppColors.onSurfaceMuted),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadius.round),
      ),
      child: Text(
        label ?? status.label,
        style: TextStyle(color: fg, fontSize: 12, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class AlertSeverityChip extends StatelessWidget {
  const AlertSeverityChip({super.key, required this.severity});

  final AlertSeverity severity;

  @override
  Widget build(BuildContext context) {
    final (label, bg, fg) = switch (severity) {
      AlertSeverity.low => ('一般', AppColors.infoSoft, AppColors.info),
      AlertSeverity.medium => ('关注', AppColors.warningSoft, AppColors.warning),
      AlertSeverity.high => ('紧急', AppColors.dangerSoft, AppColors.danger),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadius.round),
      ),
      child: Text(
        label,
        style: TextStyle(color: fg, fontSize: 12, fontWeight: FontWeight.w600),
      ),
    );
  }
}
