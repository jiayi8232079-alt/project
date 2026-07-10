import '../../core/network/api_client.dart';
import '../models/dialog.dart';
import '../models/parsing.dart';

class DialogRepository {
  DialogRepository(this._api);

  final ApiClient _api;

  Future<List<DialogSession>> list({String? serviceTargetId}) async {
    final body = await _api.getRaw(
      '/ai-dialogs',
      query: {'serviceTargetId': serviceTargetId},
    );
    return extractList(body).map(DialogSession.fromJson).toList();
  }

  Future<DialogDetail> detail(String id) async {
    final body = await _api.getObject('/ai-dialogs/sessions/$id');
    final data = asMap(body['data']) ?? body;
    return DialogDetail.fromJson(data);
  }
}
