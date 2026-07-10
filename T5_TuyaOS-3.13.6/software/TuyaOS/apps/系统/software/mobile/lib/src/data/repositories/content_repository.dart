import '../../core/network/api_client.dart';
import '../models/parsing.dart';

/// 内容生态点播仓库（对接后端 content-library 模块）。
class ContentRepository {
  ContentRepository(this._api);

  final ApiClient _api;

  Future<List<Map<String, dynamic>>> list({String? category}) async {
    final body = await _api.getRaw('/content-library', query: {
      'category': category,
    });
    return extractList(body);
  }

  Future<Map<String, dynamic>> play(int id, {int? deviceId}) {
    final data = <String, dynamic>{};
    if (deviceId != null) data['deviceId'] = deviceId;
    return _api.postObject('/content-library/$id/play', data: data);
  }
}
