import '../../core/network/api_client.dart';

class UserRepository {
  UserRepository(this._api);

  final ApiClient _api;

  Future<void> updateMe({required String nickname}) async {
    await _api.putObject('/users/me', data: {'nickname': nickname});
  }
}
