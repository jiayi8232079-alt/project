import 'dart:ui';

import 'package:flutter/material.dart';

import '../theme/app_tokens.dart';

/// 浮动毛玻璃底栏需要的底部留白（含系统手势条安全区），
/// 供使用 `extendBody: true` 的主 Tab 页给滚动内容预留空间。
double glassNavClearance(BuildContext context) =>
    84 + MediaQuery.of(context).padding.bottom;

/// 全局页面背景：浅蓝白渐变 + 柔和模糊光晕，营造液态玻璃通透层次。
///
/// 在 [MaterialApp.builder] 中包裹整个导航树，配合透明 Scaffold，
/// 让所有页面自动获得统一的医疗可信背景。
class AppBackground extends StatelessWidget {
  const AppBackground({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(gradient: AppGradients.background),
      child: Stack(
        children: [
          // 极光网格层：多彩光球 + 大尺度模糊融合成柔和 mesh gradient，
          // 玻璃卡片在其上折射出真实色彩 —— liquid-glass 高端感的来源。
          Positioned.fill(
            child: IgnorePointer(
              child: ImageFiltered(
                imageFilter: ImageFilter.blur(sigmaX: 55, sigmaY: 55),
                child: const Stack(
                  children: [
                    _Orb(
                        top: -120,
                        right: -90,
                        size: 360,
                        color: AppColors.auroraCyan,
                        opacity: 0.55),
                    _Orb(
                        top: -80,
                        left: -100,
                        size: 300,
                        color: AppColors.auroraViolet,
                        opacity: 0.5),
                    _Orb(
                        top: 200,
                        left: -140,
                        size: 380,
                        color: AppColors.auroraMint,
                        opacity: 0.5),
                    _Orb(
                        top: 360,
                        right: -120,
                        size: 340,
                        color: AppColors.auroraBlue,
                        opacity: 0.52),
                    _Orb(
                        bottom: -150,
                        right: -70,
                        size: 320,
                        color: AppColors.auroraBlush,
                        opacity: 0.5),
                    _Orb(
                        bottom: -120,
                        left: -90,
                        size: 300,
                        color: AppColors.auroraCyan,
                        opacity: 0.42),
                  ],
                ),
              ),
            ),
          ),
          Positioned.fill(child: child),
        ],
      ),
    );
  }
}

class _Orb extends StatelessWidget {
  const _Orb({
    this.top,
    this.left,
    this.right,
    this.bottom,
    required this.size,
    required this.color,
    required this.opacity,
  });

  final double? top;
  final double? left;
  final double? right;
  final double? bottom;
  final double size;
  final Color color;
  final double opacity;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top: top,
      left: left,
      right: right,
      bottom: bottom,
      child: IgnorePointer(
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: RadialGradient(
              colors: [
                color.withValues(alpha: opacity),
                color.withValues(alpha: 0),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// 毛玻璃表面（低层）：背景模糊 + 半透明白填充 + 顶部高光描边 + 柔和阴影。
class GlassSurface extends StatelessWidget {
  const GlassSurface({
    super.key,
    required this.child,
    this.padding = EdgeInsets.zero,
    this.radius = AppRadius.lg,
    this.blur = AppGlass.blur,
    this.fill = AppGlass.fill,
    this.onTap,
    this.border = true,
    this.shadow,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;
  final double blur;
  final double fill;
  final VoidCallback? onTap;
  final bool border;
  final List<BoxShadow>? shadow;

  @override
  Widget build(BuildContext context) {
    final br = BorderRadius.circular(radius);

    // 受光填充：顶部更亮（玻璃圆顶迎光）→ 底部回落，制造体积层次。
    Widget content = DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: br,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.glassFill.withValues(alpha: _clampAlpha(fill + 0.18)),
            AppColors.glassFill.withValues(alpha: fill),
            AppColors.glassFill.withValues(alpha: _clampAlpha(fill - 0.05)),
          ],
          stops: const [0.0, 0.5, 1.0],
        ),
      ),
      child: Padding(padding: padding, child: child),
    );

    if (onTap != null) {
      content = Material(
        type: MaterialType.transparency,
        child: InkWell(
          onTap: onTap,
          borderRadius: br,
          child: content,
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        borderRadius: br,
        boxShadow: shadow ?? AppShadows.cardSoft,
      ),
      child: ClipRRect(
        borderRadius: br,
        // 背景先增艳再模糊：液态玻璃的通透与色彩贯穿感。
        child: BackdropFilter(
          filter: glassBackdropFilter(blur),
          // 镜面斜面亮边：左上受光最亮 → 右下隐入，模拟玻璃厚边折光。
          child: border
              ? CustomPaint(
                  foregroundPainter: _GlassRimPainter(radius: radius),
                  child: content,
                )
              : content,
        ),
      ),
    );
  }
}

/// 玻璃镜面斜边描边 —— liquid-glass 的核心立体感来源：
/// 顶/左受光最亮，底/右隐入，形成一圈会折光的玻璃厚边。
class _GlassRimPainter extends CustomPainter {
  const _GlassRimPainter({required this.radius});

  final double radius;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final shader = const LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        Color(0xE6FFFFFF), // 左上：强高光 (~0.9)
        Color(0x80FFFFFF), // 中段：柔和 (~0.5)
        Color(0x1AFFFFFF), // 右下：隐入 (~0.1)
      ],
      stops: [0.0, 0.45, 1.0],
    ).createShader(rect);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.3
      ..shader = shader;
    final rrect = RRect.fromRectAndRadius(
      rect.deflate(0.65),
      Radius.circular(radius),
    );
    canvas.drawRRect(rrect, paint);
  }

  @override
  bool shouldRepaint(covariant _GlassRimPainter oldDelegate) =>
      oldDelegate.radius != radius;
}

double _clampAlpha(double v) => v.clamp(0.0, 1.0);

/// 玻璃背景滤镜：先做饱和度提升（增艳），再做高斯模糊（磨砂）。
/// 这是 Apple「液态玻璃」通透质感的核心 —— 背景色彩透过磨砂层依旧鲜活。
ImageFilter glassBackdropFilter(double blur) {
  return ImageFilter.compose(
    outer: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
    inner: ColorFilter.matrix(_saturationMatrix(AppGlass.saturation)),
  );
}

/// 保亮度的饱和度矩阵（s=1 不变，s>1 增艳）。
List<double> _saturationMatrix(double s) {
  const lumR = 0.213, lumG = 0.715, lumB = 0.072;
  final a = (1 - s) * lumR;
  final b = (1 - s) * lumG;
  final c = (1 - s) * lumB;
  return <double>[
    a + s, b, c, 0, 0, //
    a, b + s, c, 0, 0, //
    a, b, c + s, 0, 0, //
    0, 0, 0, 1, 0, //
  ];
}

/// 毛玻璃卡片（带内边距，业务最常用）。
class GlassCard extends StatelessWidget {
  const GlassCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(AppSpacing.md),
    this.radius = AppRadius.lg,
    this.onTap,
    this.fill = AppGlass.fill,
    this.blur = AppGlass.blur,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;
  final VoidCallback? onTap;
  final double fill;
  final double blur;

  @override
  Widget build(BuildContext context) {
    return GlassSurface(
      padding: padding,
      radius: radius,
      onTap: onTap,
      fill: fill,
      blur: blur,
      child: child,
    );
  }
}
