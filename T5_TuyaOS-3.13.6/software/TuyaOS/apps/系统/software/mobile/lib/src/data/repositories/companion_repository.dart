import '../../core/network/api_client.dart';
import '../models/parsing.dart';

/// 家庭长期记忆与机器人人格仓库（对接后端 companion 模块）。
class CompanionRepository {
  CompanionRepository(this._api);

  final ApiClient _api;

  /// 召回记忆。不传 memberId 时后端不会返回个人私密记忆。
  Future<List<Map<String, dynamic>>> recall(
    String familyId, {
    String? scope,
    String? memberId,
    String? keyword,
  }) async {
    final body = await _api.getRaw('/companion/memories', query: {
      'familyId': familyId,
      'scope': scope,
      'memberId': memberId,
      'keyword': keyword,
    });
    return extractList(body);
  }

  Future<Map<String, dynamic>> save({
    required String familyId,
    required String scope,
    String? memberId,
    String? memoryKey,
    required String content,
    String source = 'family_app',
  }) {
    return _api.postObject('/companion/memories', data: {
      'familyId': int.tryParse(familyId) ?? familyId,
      'scope': scope,
      if (memberId != null && memberId.isNotEmpty)
        'memberId': int.tryParse(memberId) ?? memberId,
      if (memoryKey != null && memoryKey.isNotEmpty) 'memoryKey': memoryKey,
      'content': content,
      'source': source,
    });
  }

  Future<Map<String, dynamic>> correct(int id, String content) {
    return _api.postObject('/companion/memories/$id/correct',
        data: {'content': content});
  }

  Future<Map<String, dynamic>> confirm(int id) {
    return _api.postObject('/companion/memories/$id/confirm');
  }

  Future<Map<String, dynamic>> forget(int id) {
    return _api.postObject('/companion/memories/$id/forget');
  }

  Future<Map<String, dynamic>> getPersona(String familyId) {
    return _api.getObject('/companion/persona/$familyId');
  }

  Future<Map<String, dynamic>> upsertPersona({
    required String familyId,
    String? nickname,
    String? personality,
    double? speechRate,
    String? catchphrase,
    Map<String, dynamic>? traits,
  }) {
    final data = <String, dynamic>{
      'familyId': int.tryParse(familyId) ?? familyId,
    };
    if (nickname != null) data['nickname'] = nickname;
    if (personality != null) data['personality'] = personality;
    if (speechRate != null) data['speechRate'] = speechRate;
    if (catchphrase != null && catchphrase.isNotEmpty) {
      data['catchphrase'] = catchphrase;
    }
    if (traits != null) data['traits'] = traits;
    return _api.putObject('/companion/persona', data: data);
  }
}
