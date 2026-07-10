import 'parsing.dart';

/// 会员信息（对应 /membership/me）。
class MembershipInfo {
  const MembershipInfo({
    this.levelName,
    this.isAnnualMember = false,
    this.expireAt,
    this.points,
    this.benefits = const [],
  });

  final String? levelName;
  final bool isAnnualMember;
  final String? expireAt;
  final int? points;
  final List<String> benefits;

  /// 是否有任何有效会员信息。
  bool get hasMembership =>
      (levelName != null && levelName!.isNotEmpty) || isAnnualMember;

  factory MembershipInfo.fromJson(Map<String, dynamic> json) {
    final level = asMap(json['level']) ??
        asMap(json['membershipLevel']) ??
        asMap(json['currentLevel']);

    return MembershipInfo(
      levelName: asString(level?['name']) ??
          asString(pick(json, ['levelName', 'cardTypeName', 'cardType'])),
      isAnnualMember:
          asBool(pick(json, ['isAnnualMember', 'isAnnual', 'annual'])),
      expireAt: _formatDate(
        pick(json, ['expireAt', 'expiredAt', 'annualExpireAt', 'validUntil']),
      ),
      points: asInt(pick(json, ['points', 'balance', 'pointBalance'])),
      benefits: asStringList(pick(json, ['benefits', 'rights', 'privileges'])),
    );
  }
}

String? _formatDate(Object? value) {
  final dt = asDateTime(value);
  if (dt == null) return asString(value);
  final local = dt.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  return '${local.year}-${two(local.month)}-${two(local.day)}';
}
