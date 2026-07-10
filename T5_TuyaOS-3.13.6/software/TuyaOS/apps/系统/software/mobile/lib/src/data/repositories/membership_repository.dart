import '../../core/network/api_client.dart';
import '../models/membership_info.dart';
import '../models/parsing.dart';

class MembershipRepository {
  MembershipRepository(this._api);

  final ApiClient _api;

  Future<MembershipInfo> me() async {
    final body = await _api.getObject('/membership/me');
    final data = asMap(body['data']) ?? body;
    return MembershipInfo.fromJson(data);
  }
}
