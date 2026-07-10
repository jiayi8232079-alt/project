import '../../core/network/api_client.dart';
import '../models/parsing.dart';

class WithKinRepository {
  WithKinRepository(this._api);

  final ApiClient _api;

  Future<List<Map<String, dynamic>>> communityContent() async {
    final body = await _api.getRaw('/community-content');
    return extractList(body);
  }

  Future<List<Map<String, dynamic>>> familyTasks(String familyId) async {
    final body = await _api.getRaw('/family/tasks', query: {'familyId': familyId});
    return extractList(body);
  }

  Future<List<Map<String, dynamic>>> voiceprints(String familyId) async {
    final body = await _api.getRaw('/voiceprints/family/$familyId');
    return extractList(body);
  }

  Future<List<Map<String, dynamic>>> hospitalPartnerships() async {
    final body = await _api.getRaw('/hospital-partnerships');
    return extractList(body);
  }

  Future<Map<String, dynamic>> sendFamilyMessage({
    required String familyId,
    required String elderId,
    required String message,
  }) {
    return _api.postObject('/family/family-messages', data: {
      'familyId': int.tryParse(familyId) ?? familyId,
      'elderId': int.tryParse(elderId) ?? elderId,
      'message': message,
    });
  }

  Future<Map<String, dynamic>> createFamilyTask({
    required String familyId,
    required String elderId,
    required String title,
    required String message,
  }) {
    return _api.postObject('/family/tasks', data: {
      'familyId': int.tryParse(familyId) ?? familyId,
      'elderId': int.tryParse(elderId) ?? elderId,
      'title': title,
      'type': 'family_reminder',
      'message': message,
    });
  }

  Future<Map<String, dynamic>> deviceSettings(String deviceId) {
    return _api.getObject('/device-settings/$deviceId');
  }

  Future<Map<String, dynamic>> saveDeviceSettings({
    required String deviceId,
    required int volume,
    required int screenBrightness,
    required bool communityContentEnabled,
  }) {
    return _api.putObject('/device-settings/$deviceId', data: {
      'volume': volume,
      'screenBrightness': screenBrightness,
      'communityContentEnabled': communityContentEnabled,
      'privacyVisibility': 'guardian_only',
    });
  }
}
