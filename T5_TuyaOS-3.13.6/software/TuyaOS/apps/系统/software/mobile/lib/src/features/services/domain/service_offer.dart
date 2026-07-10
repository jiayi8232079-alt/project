import '../../../data/models/parsing.dart';

/// 平台可购服务 SKU。
class ServiceOffer {
  const ServiceOffer({
    required this.code,
    required this.name,
    required this.shortDesc,
    required this.longDesc,
    required this.priceCents,
    required this.unit,
    required this.iconCode,
    required this.color,
    required this.features,
    this.priceText,
  });

  final String code;
  final String name;
  final String shortDesc;
  final String longDesc;
  final int priceCents;
  final String unit;
  final int iconCode;
  final int color;
  final List<String> features;

  /// 后端用展示文案（如"¥298 起"），优先于 priceCents 计算。
  final String? priceText;

  String get priceLabel =>
      priceText ?? '¥${(priceCents / 100).toStringAsFixed(0)}/$unit';

  /// 由后端 professional-services 接口构造。
  factory ServiceOffer.fromJson(Map<String, dynamic> json) {
    final highlights = asStringList(pick(json, ['highlights', 'features']));
    return ServiceOffer(
      code: pickString(json, ['code'], fallback: ''),
      name: pickString(json, ['name', 'title'], fallback: '服务'),
      shortDesc: pickString(json, ['shortDesc', 'short_desc', 'subtitle'], fallback: ''),
      longDesc: pickString(json, ['detail', 'longDesc', 'description'], fallback: ''),
      priceCents: 0,
      unit: pickString(json, ['unit'], fallback: '次'),
      iconCode: 0xe3f3,
      color: 0xFF2F8F5B,
      features: highlights,
      priceText: asString(
        pick(json, ['priceDisplayText', 'price_display_text', 'priceText']),
      ),
    );
  }
}
