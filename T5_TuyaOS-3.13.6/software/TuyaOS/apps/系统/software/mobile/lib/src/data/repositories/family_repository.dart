import '../../core/network/api_client.dart';
import '../models/family_member.dart';
import '../models/parsing.dart';

/// 家属圈数据：先取当前用户的家庭群组，再取首个群组的成员。
class FamilyRepository {
  FamilyRepository(this._api);

  final ApiClient _api;

  Future<List<Map<String, dynamic>>> myFamilies() async {
    final body = await _api.getRaw('/family');
    return extractList(body);
  }

  Future<List<FamilyMember>> members() async {
    final families = await myFamilies();
    if (families.isEmpty) return const [];

    final first = families.first;
    // 群组里可能已内联 members；否则按 id 再查一次。
    final inline = pick(first, ['members']);
    if (inline is List) {
      return asMapList(inline).map(FamilyMember.fromJson).toList();
    }
    final id = pickString(first, ['id'], fallback: '');
    if (id.isEmpty) return const [];
    final body = await _api.getRaw('/family/$id/members');
    return extractList(body).map(FamilyMember.fromJson).toList();
  }

  Future<String?> inviteCode() async {
    final families = await myFamilies();
    if (families.isEmpty) return null;
    final id = pickString(families.first, ['id'], fallback: '');
    if (id.isEmpty) return null;
    final body = await _api.getObject('/family/$id/invite-code');
    return asString(pick(body, ['inviteCode', 'code', 'value']));
  }

  /// 当前用户首个家庭群组 id；没有家庭时返回 null。
  Future<String?> firstFamilyId() async {
    final families = await myFamilies();
    if (families.isEmpty) return null;
    final id = pickString(families.first, ['id'], fallback: '');
    return id.isEmpty ? null : id;
  }

  /// 创建家庭群组（创建者自动成为 guardian）。
  Future<Map<String, dynamic>> createFamily(String name) {
    return _api.postObject('/family', data: {'name': name});
  }

  /// 按邀请码预览家庭信息（公开接口，免登录）。返回 null 表示邀请码无效。
  Future<FamilyPreview?> previewByInviteCode(String code) async {
    final body = await _api.getObject('/public/family/by-invite-code/$code');
    final data = asMap(body['data']) ?? body;
    if (data.isEmpty) return null;
    final name = asString(pick(data, ['name', 'familyName', 'groupName']));
    if (name == null) return null;
    return FamilyPreview(
      name: name,
      memberCount: asInt(pick(data, ['memberCount', 'members', 'count'])),
    );
  }

  /// 通过邀请码加入家庭。
  Future<void> joinByInviteCode({
    required String code,
    required String relation,
    String? nickname,
  }) async {
    await _api.postObject('/family/join', data: {
      'inviteCode': code,
      'relation': relation,
      if (nickname != null && nickname.isNotEmpty) 'nickname': nickname,
    });
  }

  /// 家庭内代建老人（子女代建）。需要先有家庭群组。
  Future<void> createElder({
    required String groupId,
    required String name,
    required String relation,
    String delegatorRelation = 'child',
    String? gender,
    int? age,
    String? phone,
  }) async {
    await _api.postObject('/family/$groupId/elders', data: {
      'name': name,
      'relation': relation,
      'delegatorRelation': delegatorRelation,
      if (gender != null && gender.isNotEmpty) 'gender': gender,
      'age': ?age,
      if (phone != null && phone.isNotEmpty) 'phone': phone,
    });
  }
}

/// 邀请码预览结果。
class FamilyPreview {
  const FamilyPreview({required this.name, this.memberCount});

  final String name;
  final int? memberCount;
}
