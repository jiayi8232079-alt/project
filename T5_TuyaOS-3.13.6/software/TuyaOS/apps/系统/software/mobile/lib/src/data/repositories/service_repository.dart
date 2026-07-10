import '../../core/network/api_client.dart';
import '../../features/services/domain/service_offer.dart';
import '../models/parsing.dart';

class ServiceRepository {
  ServiceRepository(this._api);

  final ApiClient _api;

  Future<List<ServiceOffer>> listPublic() async {
    final body = await _api.getRaw('/professional-services/public');
    return extractList(body).map(ServiceOffer.fromJson).toList();
  }

  Future<ServiceOffer> detailByCode(String code) async {
    final body = await _api.getObject('/professional-services/public/code/$code');
    final data = asMap(body['data']) ?? body;
    return ServiceOffer.fromJson(data);
  }
}
