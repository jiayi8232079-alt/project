import 'parsing.dart';

/// 服务对象（老人）领域模型。
class ServiceTarget {
  const ServiceTarget({
    required this.id,
    required this.name,
    this.age,
    this.gender,
    this.relation,
    this.chronicTags = const [],
    this.allergy,
    this.emergencyContact,
  });

  final String id;
  final String name;
  final int? age;
  final String? gender;
  final String? relation;
  final List<String> chronicTags;
  final String? allergy;
  final String? emergencyContact;

  factory ServiceTarget.fromJson(Map<String, dynamic> json) {
    final health = asMap(json['healthProfile'] ?? json['health_profile']);

    // 慢病标签：优先 health_profile 内的字段，兼容多种命名。
    List<String> chronic = asStringList(
      pick(json, ['chronicTags', 'chronicDiseases']),
    );
    if (chronic.isEmpty && health != null) {
      chronic = asStringList(
        pick(health, ['chronicDiseases', 'chronic', 'diseases', 'tags']),
      );
    }

    String? allergy = asString(pick(json, ['allergy', 'allergyHistory']));
    if (allergy == null && health != null) {
      allergy = asString(pick(health, ['allergy', 'allergyHistory', 'allergies']));
    }

    final contact = asString(pick(json, ['emergencyContact', 'emergency_contact']));
    final contactPhone =
        asString(pick(json, ['emergencyPhone', 'emergency_phone']));

    return ServiceTarget(
      id: pickString(json, ['id'], fallback: ''),
      name: pickString(json, ['name'], fallback: '未命名'),
      age: asInt(pick(json, ['age'])),
      gender: asString(pick(json, ['gender'])),
      relation: asString(pick(json, ['relation', 'relationship', 'delegatorRelation'])),
      chronicTags: chronic,
      allergy: allergy,
      emergencyContact: [contact, contactPhone]
              .whereType<String>()
              .where((e) => e.isNotEmpty)
              .join(' ')
              .trim()
              .isEmpty
          ? null
          : [contact, contactPhone]
              .whereType<String>()
              .where((e) => e.isNotEmpty)
              .join(' '),
    );
  }
}
