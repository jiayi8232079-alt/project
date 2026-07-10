import 'package:flutter/material.dart';

import '../theme/app_tokens.dart';
import 'glass.dart';

/// 通用分组卡片（液态毛玻璃）。
class SectionCard extends StatelessWidget {
  const SectionCard({
    super.key,
    this.title,
    this.action,
    this.padding = const EdgeInsets.all(AppSpacing.md),
    required this.children,
  });

  final String? title;
  final Widget? action;
  final EdgeInsetsGeometry padding;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return GlassSurface(
      padding: padding,
      radius: AppRadius.lg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (title != null)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      title!,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  ?action,
                ],
              ),
            ),
          ...children,
        ],
      ),
    );
  }
}
