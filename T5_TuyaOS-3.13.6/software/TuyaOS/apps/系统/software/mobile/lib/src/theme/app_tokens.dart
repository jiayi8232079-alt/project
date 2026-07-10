import 'package:flutter/material.dart';

/// 设计令牌 —— 所有 UI 共用的间距、圆角、阴影、颜色等基础参数。
///
/// 视觉风格：医疗可信「Apple Liquid Glass / 液态毛玻璃」
/// - 背景：浅蓝 → 白 渐变，叠加柔和模糊光晕，营造通透层次
/// - 卡片：半透明白色毛玻璃（淡），背景模糊 + 顶部高光描边 + 极柔阴影
/// - 主色：可信医疗蓝；薄荷青表健康；珊瑚红表 SOS / 告警
///
/// 适老化：
/// - 基础字号 16（普通模式）/ 20（老人模式）
/// - 按钮高度 56（普通）/ 64（老人）
/// - 间距、圆角、动效在两种模式下保持一致，避免老人切换后认知突变
class AppSpacing {
  static const xxs = 4.0;
  static const xs = 8.0;
  static const sm = 12.0;
  static const md = 16.0;
  static const lg = 20.0;
  static const xl = 24.0;
  static const xxl = 32.0;
}

class AppRadius {
  static const sm = 10.0;
  static const md = 16.0;
  static const lg = 22.0;
  static const xl = 28.0;
  static const round = 999.0;
}

/// 毛玻璃参数（Apple 液态玻璃 · 淡风格）。
class AppGlass {
  /// 卡片背景模糊强度（sigma）。磨砂感更足。
  static const blur = 22.0;

  /// 导航 / 浮层模糊强度（更强以突出悬浮层次）。
  static const blurStrong = 34.0;

  /// 卡片白色填充透明度（淡 → 偏透，仍保证老人模式文字对比）。
  static const fill = 0.55;

  /// 强调容器（hero / 导航）的白色填充透明度。
  static const fillStrong = 0.62;

  /// 玻璃四周描边透明度（细腻不抢眼）。
  static const border = 0.5;

  /// 顶部受光高光描边透明度（Apple 玻璃的标志性亮边）。
  static const highlight = 0.9;

  /// 背景饱和度提升倍数（液态玻璃通透感：模糊前先增艳，对标 liquid-glass ~140%）。
  static const saturation = 1.38;
}

class AppColors {
  // —— 主色（可信医疗蓝，整体偏淡）——
  static const primary = Color(0xFF2E86F0);
  static const primaryDark = Color(0xFF1F6FD6);
  static const primarySoft = Color(0xFFEAF3FE);

  // —— 健康辅助色（薄荷青）——
  static const mint = Color(0xFF2BBFA6);
  static const mintSoft = Color(0xFFE2F6F1);

  // —— 背景渐变基底（浅蓝 → 淡薰衣草 → 白）——
  static const bgTop = Color(0xFFE6F0FF);
  static const bgMid = Color(0xFFEDEBFD);
  static const bgBottom = Color(0xFFFBFDFF);

  // —— 背景光晕（柔和模糊球，向后兼容）——
  static const orbBlue = Color(0xFFBFD9FB);
  static const orbMint = Color(0xFFC9EFE6);

  // —— 极光网格（液态玻璃折射用，鲜艳但克制的冷调极光）——
  static const auroraBlue = Color(0xFF6BB0FF);
  static const auroraCyan = Color(0xFF55DBF5);
  static const auroraViolet = Color(0xFF9E8CFF);
  static const auroraMint = Color(0xFF5FE6C6);
  static const auroraBlush = Color(0xFFC9A6FF);

  // —— 玻璃表面 ——
  static const glassFill = Color(0xFFFFFFFF);
  static const glassBorder = Color(0xFFFFFFFF);

  // —— 文字与中性 ——
  static const surface = Color(0xFFF3F7FD);
  static const surfaceVariant = Color(0xFFEFF4FA);
  static const outline = Color(0xFFDCE6F2);
  static const onSurface = Color(0xFF12243B);
  static const onSurfaceMuted = Color(0xFF5C6E84);

  // —— 语义色 ——
  static const danger = Color(0xFFE5484D);
  static const dangerSoft = Color(0xFFFDECEC);
  static const warning = Color(0xFFE6A23C);
  static const warningSoft = Color(0xFFFFF6E8);
  static const success = Color(0xFF2BBFA6);
  static const successSoft = Color(0xFFE2F6F1);
  static const info = Color(0xFF2E86F0);
  static const infoSoft = Color(0xFFEAF3FE);
}

class AppGradients {
  /// 全局页面背景渐变（浅蓝白）。
  static const background = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [AppColors.bgTop, AppColors.bgMid, AppColors.bgBottom],
    stops: [0.0, 0.45, 1.0],
  );

  /// 主色渐变（用于主按钮 / hero 强调）。
  static const primary = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF3E96FF), AppColors.primary],
  );

  /// Hero 卡片淡蓝渐变。
  static const hero = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF4C9BFF), Color(0xFF2E86F0)],
  );
}

class AppShadows {
  static const _ink = Color(0xFF1E5B9E);

  /// 玻璃卡片柔和阴影（双层：大而散 + 紧贴接触阴影，更有漂浮感）。
  static List<BoxShadow> card = [
    BoxShadow(
      color: _ink.withValues(alpha: 0.10),
      blurRadius: 28,
      spreadRadius: -6,
      offset: const Offset(0, 14),
    ),
    BoxShadow(
      color: _ink.withValues(alpha: 0.05),
      blurRadius: 8,
      spreadRadius: -3,
      offset: const Offset(0, 3),
    ),
  ];
  static List<BoxShadow> cardSoft = [
    BoxShadow(
      color: _ink.withValues(alpha: 0.07),
      blurRadius: 18,
      spreadRadius: -8,
      offset: const Offset(0, 8),
    ),
    BoxShadow(
      color: _ink.withValues(alpha: 0.04),
      blurRadius: 6,
      spreadRadius: -2,
      offset: const Offset(0, 2),
    ),
  ];

  /// 浮动导航 / 浮层阴影（更深的悬浮层级）。
  static List<BoxShadow> floating = [
    BoxShadow(
      color: _ink.withValues(alpha: 0.14),
      blurRadius: 34,
      spreadRadius: -8,
      offset: const Offset(0, 16),
    ),
    BoxShadow(
      color: _ink.withValues(alpha: 0.06),
      blurRadius: 10,
      spreadRadius: -4,
      offset: const Offset(0, 4),
    ),
  ];
}
