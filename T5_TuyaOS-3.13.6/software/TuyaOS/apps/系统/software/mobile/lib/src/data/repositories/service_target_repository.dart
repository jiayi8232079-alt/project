import '../../core/network/api_client.dart';
import '../models/parsing.dart';
import '../models/service_target.dart';

class ServiceTargetRepository {
  ServiceTargetRepository(this._api);

  final ApiClient _api;

  Future<List<ServiceTarget>> listMine() async {
    final body = await _api.getRaw('/users/me/service-targets');
    return extractList(body).map(ServiceTarget.fromJson).toList();
  }

  Future<ServiceTarget> detail(String id) async {
    final body = await _api.getObject('/users/service-targets/$id');
    final data = asMap(body['data']) ?? body;
    return ServiceTarget.fromJson(data);
  }
}
