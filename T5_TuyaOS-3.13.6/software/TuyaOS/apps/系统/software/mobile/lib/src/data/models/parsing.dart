/// 后端响应解析辅助 —— 容错优先。
///
/// 后端不同接口字段命名/结构略有差异（驼峰/下划线、分页包络等），
/// 这里统一做空安全、多键名兼容的取值，避免某个字段缺失就让页面崩溃。
library;

/// 从 map 中按候选键依次取第一个非空值。
Object? pick(Map<String, dynamic> json, List<String> keys) {
  for (final key in keys) {
    final value = json[key];
    if (value != null) return value;
  }
  return null;
}

String? asString(Object? value) {
  if (value == null) return null;
  final str = value.toString().trim();
  return str.isEmpty ? null : str;
}

String pickString(
  Map<String, dynamic> json,
  List<String> keys, {
  String fallback = '',
}) {
  return asString(pick(json, keys)) ?? fallback;
}

int? asInt(Object? value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value.toString());
}

int pickInt(
  Map<String, dynamic> json,
  List<String> keys, {
  int fallback = 0,
}) {
  return asInt(pick(json, keys)) ?? fallback;
}

double? asDouble(Object? value) {
  if (value == null) return null;
  if (value is num) return value.toDouble();
  return double.tryParse(value.toString());
}

bool asBool(Object? value, {bool fallback = false}) {
  if (value == null) return fallback;
  if (value is bool) return value;
  if (value is num) return value != 0;
  final str = value.toString().toLowerCase();
  if (str == 'true' || str == '1' || str == 'yes') return true;
  if (str == 'false' || str == '0' || str == 'no') return false;
  return fallback;
}

Map<String, dynamic>? asMap(Object? value) {
  if (value is Map) return Map<String, dynamic>.from(value);
  return null;
}

List<Map<String, dynamic>> asMapList(Object? value) {
  if (value is List) {
    return value
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }
  return const [];
}

List<String> asStringList(Object? value) {
  if (value is List) {
    return value
        .map((e) => asString(e))
        .whereType<String>()
        .toList();
  }
  return const [];
}

/// 从后端分页/列表响应中提取数组。
///
/// 兼容：裸数组 / { items } / { list } / { data } / { records } / { rows } /
/// { data: { items } } 等常见包络。
List<Map<String, dynamic>> extractList(Object? body) {
  if (body is List) return asMapList(body);
  if (body is Map) {
    final map = Map<String, dynamic>.from(body);
    for (final key in ['items', 'list', 'records', 'rows', 'data', 'result']) {
      final value = map[key];
      if (value is List) return asMapList(value);
      if (value is Map) {
        // 形如 { data: { items: [] } }
        final nested = extractList(value);
        if (nested.isNotEmpty) return nested;
      }
    }
  }
  return const [];
}

/// 解析后端日期字段为 DateTime（容错）。
DateTime? asDateTime(Object? value) {
  if (value == null) return null;
  if (value is DateTime) return value;
  return DateTime.tryParse(value.toString());
}
