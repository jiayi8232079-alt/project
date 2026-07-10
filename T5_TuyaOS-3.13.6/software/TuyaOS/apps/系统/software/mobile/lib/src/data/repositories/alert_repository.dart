import '../../core/network/api_client.dart';
import '../models/alert_item.dart';
import '../models/parsing.dart';

class AlertRepository {
  AlertRepository(this._api);

  final ApiClient _api;

  Future<List<AlertItem>> list() async {
    final body = await _api.getRaw('/alerts');
    return extractList(body).map(AlertItem.fromJson).toList();
  }

  Future<int> pendingCount() async {
    final body = await _api.getRaw('/alerts/pending-count');
    if (body is num) return body.toInt();
    if (body is Map) {
      final map = Map<String, dynamic>.from(body);
      return asInt(pick(map, ['count', 'pending', 'total', 'value'])) ?? 0;
    }
    return asInt(body) ?? 0;
  }

  Future<AlertItem> detail(String id) async {
    final body = await _api.getObject('/alerts/$id');
    final data = asMap(body['data']) ?? body;
    return AlertItem.fromJson(data);
  }

  Future<void> acknowledge(String id, {String? note}) async {
    await _api.postObject('/alerts/$id/acknowledge', data: {
      if (note != null && note.isNotEmpty) 'note': note,
    });
  }

  Future<void> close(String id, {String? note}) async {
    await _api.postObject('/alerts/$id/close', data: {
      if (note != null && note.isNotEmpty) 'note': note,
    });
  }
}
