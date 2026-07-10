import '../../core/network/api_client.dart';
import '../models/app_order.dart';
import '../models/parsing.dart';

class OrderRepository {
  OrderRepository(this._api);

  final ApiClient _api;

  Future<List<AppOrder>> list() async {
    final body = await _api.getRaw('/orders');
    return extractList(body).map(AppOrder.fromJson).toList();
  }

  Future<AppOrder> detail(String id) async {
    final body = await _api.getObject('/orders/$id');
    // 详情可能是 { data: {...} } 或裸对象
    final data = asMap(body['data']) ?? body;
    return AppOrder.fromJson(data);
  }

  /// 创建订单（用户自助下单）。
  Future<Map<String, dynamic>> create({
    required int serviceTargetId,
    required String serviceType,
    required String serviceTime,
    String? professionalServiceCode,
    String? hospital,
    String? notes,
  }) {
    return _api.postObject('/orders', data: {
      'serviceTargetId': serviceTargetId,
      'serviceType': serviceType,
      'serviceTime': serviceTime,
      'professionalServiceCode': ?professionalServiceCode,
      if (hospital != null && hospital.isNotEmpty) 'hospital': hospital,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    });
  }

  Future<void> cancel(String id, {String? reason}) async {
    await _api.putObject('/orders/$id/cancel', data: {
      if (reason != null && reason.isNotEmpty) 'cancelReason': reason,
    });
  }

  Future<void> review(String id, {required int rating, String? content}) async {
    await _api.postObject('/orders/$id/review', data: {
      'rating': rating,
      if (content != null && content.isNotEmpty) 'content': content,
    });
  }
}
