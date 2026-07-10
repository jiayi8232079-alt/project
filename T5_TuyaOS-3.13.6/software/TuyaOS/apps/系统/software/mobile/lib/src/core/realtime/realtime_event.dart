import '../../data/models/parsing.dart';

/// 后端 `realtime:event` 推送的统一事件模型（对应 RealtimeEvent）。
class RealtimeEvent {
  const RealtimeEvent({
    required this.type,
    required this.summary,
    this.alertId,
    this.serviceTargetId,
    this.level,
    required this.raw,
  });

  /// 形如 alert.fall / alert.sos / device.online / notification.new / ai.dialog.new
  final String type;
  final String summary;
  final int? alertId;
  final int? serviceTargetId;
  final String? level;
  final Map<String, dynamic> raw;

  bool get isAlert => type.startsWith('alert.');
  bool get isDevice => type.startsWith('device.');
  bool get isNotification => type == 'notification.new';
  bool get isAiDialog => type == 'ai.dialog.new';
  bool get isCritical => level == 'critical';

  factory RealtimeEvent.fromJson(Map<String, dynamic> json) {
    final type = pickString(json, ['type'], fallback: '');
    return RealtimeEvent(
      type: type,
      summary: pickString(
        json,
        ['summary', 'title', 'content', 'text'],
        fallback: _defaultSummary(type),
      ),
      alertId: asInt(pick(json, ['alertId', 'alert_id'])),
      serviceTargetId: asInt(pick(json, ['serviceTargetId', 'service_target_id'])),
      level: asString(pick(json, ['level', 'severity'])),
      raw: json,
    );
  }

  static String _defaultSummary(String type) {
    return const {
      'alert.fall': '检测到跌倒事件',
      'alert.sos': '收到 SOS 求助',
      'alert.vital_anomaly': '体征异常预警',
      'alert.heartbeat': '设备心跳异常',
      'device.online': '设备已上线',
      'device.offline': '设备已离线',
      'notification.new': '您有一条新通知',
      'ai.dialog.new': 'AI 陪护有新对话',
    }[type] ??
        '收到一条实时消息';
  }
}
