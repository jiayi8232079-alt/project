import 'enums.dart';
import 'parsing.dart';

/// 订单领域模型（对应后端 orders 接口）。
class AppOrder {
  const AppOrder({
    required this.id,
    required this.orderNumber,
    required this.serviceName,
    required this.statusRaw,
    required this.statusLabel,
    required this.statusBucket,
    required this.scheduledAt,
    required this.hospital,
    required this.attendantName,
    required this.targetName,
    required this.amountLabel,
  });

  final String id;
  final String orderNumber;
  final String serviceName;
  final String statusRaw;
  final String statusLabel;
  final OrderStatus statusBucket;
  final String scheduledAt;
  final String hospital;
  final String attendantName;
  final String targetName;
  final String amountLabel;

  factory AppOrder.fromJson(Map<String, dynamic> json) {
    final raw = pickString(json, ['status'], fallback: '');
    final attendant = asMap(json['attendant']);
    final target = asMap(json['serviceTarget'] ?? json['service_target']);
    final professional =
        asMap(json['professionalService'] ?? json['professional_service']);

    return AppOrder(
      id: pickString(json, ['id', 'orderId'], fallback: ''),
      orderNumber:
          pickString(json, ['orderNumber', 'order_number', 'orderNo'], fallback: ''),
      serviceName: asString(professional?['name']) ??
          pickString(json, ['serviceName', 'serviceType', 'service_type'],
              fallback: '陪护服务'),
      statusRaw: raw,
      statusLabel: _statusLabel(raw),
      statusBucket: _statusBucket(raw),
      scheduledAt: _formatDateTime(
        pick(json, ['serviceTime', 'service_time', 'appointmentTime', 'scheduledAt']),
      ),
      hospital: pickString(json, ['hospital', 'serviceAddress', 'service_address'],
          fallback: '—'),
      attendantName: asString(attendant?['name']) ??
          pickString(json, ['attendantName'], fallback: '待分配'),
      targetName: asString(target?['name']) ??
          pickString(json, ['targetName'], fallback: '—'),
      amountLabel: _formatYuan(pick(json, ['totalFee', 'total_fee', 'amount', 'baseFee'])),
    );
  }

  static String _statusLabel(String raw) {
    return const {
      'pending_dispatch': '待派单',
      'pending_accept': '待接单',
      'pending_grab': '待抢单',
      'pending_sign': '待签约',
      'pending_service': '待服务',
      'in_progress': '服务中',
      'pending_review': '待评价',
      'completed': '已完成',
      'canceled': '已取消',
      'cancelled': '已取消',
      'emergency': '紧急',
    }[raw] ??
        (raw.isEmpty ? '—' : raw);
  }

  static OrderStatus _statusBucket(String raw) {
    switch (raw) {
      case 'pending_dispatch':
      case 'pending_accept':
      case 'pending_grab':
      case 'pending_sign':
        return OrderStatus.pending;
      case 'pending_service':
        return OrderStatus.confirmed;
      case 'in_progress':
      case 'emergency':
        return OrderStatus.inService;
      case 'pending_review':
      case 'completed':
        return OrderStatus.completed;
      case 'canceled':
      case 'cancelled':
        return OrderStatus.cancelled;
      default:
        return OrderStatus.pending;
    }
  }

  /// 用于订单列表分组筛选（全部/待服务/进行中/已完成）。
  bool get isUpcoming =>
      statusBucket == OrderStatus.pending || statusBucket == OrderStatus.confirmed;
  bool get isInService => statusBucket == OrderStatus.inService;
  bool get isCompleted => statusBucket == OrderStatus.completed;
}

String _formatDateTime(Object? value) {
  final dt = asDateTime(value);
  if (dt == null) return asString(value) ?? '—';
  final local = dt.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  return '${local.year}-${two(local.month)}-${two(local.day)} '
      '${two(local.hour)}:${two(local.minute)}';
}

String _formatYuan(Object? value) {
  final amount = asDouble(value);
  if (amount == null) return '—';
  if (amount == amount.roundToDouble()) {
    return '¥${amount.toInt()}';
  }
  return '¥${amount.toStringAsFixed(2)}';
}
