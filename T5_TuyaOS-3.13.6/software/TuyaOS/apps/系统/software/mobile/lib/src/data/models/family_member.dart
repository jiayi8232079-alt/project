import 'parsing.dart';

/// 家属成员领域模型。
class FamilyMember {
  const FamilyMember({
    required this.id,
    required this.name,
    required this.relation,
    this.phone,
    this.role,
  });

  final String id;
  final String name;
  final String relation;
  final String? phone;
  final String? role;

  factory FamilyMember.fromJson(Map<String, dynamic> json) {
    final user = asMap(json['user']);
    return FamilyMember(
      id: pickString(json, ['id', 'memberId', 'userId'], fallback: ''),
      name: asString(user?['nickname']) ??
          asString(user?['name']) ??
          pickString(json, ['nickname', 'name', 'memberName'], fallback: '家属'),
      relation: pickString(json, ['relation', 'relationship'], fallback: '家属'),
      phone: asString(pick(json, ['phone'])) ?? asString(user?['phone']),
      role: asString(pick(json, ['role', 'memberRole', 'roleLabel'])),
    );
  }
}
