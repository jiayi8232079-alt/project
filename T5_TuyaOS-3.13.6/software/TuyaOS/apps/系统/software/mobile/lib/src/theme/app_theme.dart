import 'package:flutter/material.dart';

import 'app_tokens.dart';

/// 构建应用主题。
///
/// 适老化原则：
/// 1. 字号基线 16（普通）/ 20（老人，通过 MediaQuery textScaler 全局放大）
/// 2. 按钮高度 56dp，文字 18sp，圆角 12，触摸目标 ≥ 48dp（WCAG）
/// 3. 颜色对比度 ≥ AA 级，主色 #2F8F5B 与白底对比 4.7:1
/// 4. 动效曲线统一 emphasized，避免老人头晕
ThemeData buildAppTheme({bool elderlyMode = false}) {
  final scheme = ColorScheme.fromSeed(
    seedColor: AppColors.primary,
    brightness: Brightness.light,
    primary: AppColors.primary,
    onPrimary: Colors.white,
    surface: Colors.white,
    onSurface: AppColors.onSurface,
    surfaceContainerHighest: AppColors.surfaceVariant,
    error: AppColors.danger,
    onError: Colors.white,
    outline: AppColors.outline,
  );

  final baseFontSize = elderlyMode ? 20.0 : 16.0;
  final buttonHeight = elderlyMode ? 64.0 : 56.0;

  final textTheme = TextTheme(
    displayLarge: TextStyle(
      fontSize: baseFontSize + 16,
      fontWeight: FontWeight.w800,
      height: 1.2,
      color: AppColors.onSurface,
    ),
    displayMedium: TextStyle(
      fontSize: baseFontSize + 12,
      fontWeight: FontWeight.w800,
      height: 1.25,
      color: AppColors.onSurface,
    ),
    headlineLarge: TextStyle(
      fontSize: baseFontSize + 8,
      fontWeight: FontWeight.w700,
      height: 1.3,
      color: AppColors.onSurface,
    ),
    headlineMedium: TextStyle(
      fontSize: baseFontSize + 4,
      fontWeight: FontWeight.w700,
      height: 1.3,
      color: AppColors.onSurface,
    ),
    titleLarge: TextStyle(
      fontSize: baseFontSize + 2,
      fontWeight: FontWeight.w700,
      height: 1.35,
      color: AppColors.onSurface,
    ),
    titleMedium: TextStyle(
      fontSize: baseFontSize,
      fontWeight: FontWeight.w600,
      height: 1.4,
      color: AppColors.onSurface,
    ),
    bodyLarge: TextStyle(
      fontSize: baseFontSize,
      fontWeight: FontWeight.w400,
      height: 1.5,
      color: AppColors.onSurface,
    ),
    bodyMedium: TextStyle(
      fontSize: baseFontSize - 2,
      fontWeight: FontWeight.w400,
      height: 1.5,
      color: AppColors.onSurface,
    ),
    bodySmall: TextStyle(
      fontSize: baseFontSize - 4,
      fontWeight: FontWeight.w400,
      height: 1.45,
      color: AppColors.onSurfaceMuted,
    ),
    labelLarge: TextStyle(
      fontSize: baseFontSize - 2,
      fontWeight: FontWeight.w600,
      height: 1.3,
      color: AppColors.onSurface,
    ),
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    // 透明 Scaffold，让全局 AppBackground 的浅蓝白渐变透出。
    scaffoldBackgroundColor: Colors.transparent,
    textTheme: textTheme,
    fontFamily: 'PingFang SC',
    appBarTheme: const AppBarTheme(
      centerTitle: false,
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      scrolledUnderElevation: 0,
      elevation: 0,
      titleTextStyle: TextStyle(
        color: AppColors.onSurface,
        fontWeight: FontWeight.w700,
        fontSize: 20,
      ),
      iconTheme: IconThemeData(color: AppColors.onSurface),
    ),
    cardTheme: CardThemeData(
      color: AppColors.glassFill.withValues(alpha: 0.6),
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: Size(double.infinity, buttonHeight),
        textStyle: TextStyle(
          fontSize: baseFontSize + 2,
          fontWeight: FontWeight.w600,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
        ),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        minimumSize: Size(double.infinity, buttonHeight),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        textStyle: TextStyle(
          fontSize: baseFontSize + 2,
          fontWeight: FontWeight.w600,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: Size(double.infinity, buttonHeight),
        side: const BorderSide(color: AppColors.primary, width: 1.5),
        foregroundColor: AppColors.primary,
        textStyle: TextStyle(
          fontSize: baseFontSize + 2,
          fontWeight: FontWeight.w600,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
        ),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: AppColors.primary,
        textStyle: TextStyle(
          fontSize: baseFontSize,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.glassFill.withValues(alpha: 0.55),
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.md,
      ),
      hintStyle: TextStyle(color: AppColors.onSurfaceMuted, fontSize: baseFontSize),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      height: buttonHeight + 4,
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      indicatorColor: AppColors.primarySoft,
      labelTextStyle: WidgetStateProperty.all(
        TextStyle(
          fontSize: baseFontSize - 2,
          fontWeight: FontWeight.w600,
        ),
      ),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return const IconThemeData(color: AppColors.primary, size: 28);
        }
        return const IconThemeData(color: AppColors.onSurfaceMuted, size: 24);
      }),
    ),
    dividerTheme: const DividerThemeData(
      color: AppColors.outline,
      thickness: 1,
      space: 1,
    ),
    chipTheme: ChipThemeData(
      labelStyle: TextStyle(fontSize: baseFontSize - 2),
      side: const BorderSide(color: AppColors.outline),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.round),
      ),
    ),
  );
}
