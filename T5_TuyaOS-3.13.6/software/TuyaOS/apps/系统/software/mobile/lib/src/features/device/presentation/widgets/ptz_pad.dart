import 'package:flutter/material.dart';

import '../../domain/device_state.dart';

/// 云台方向盘（可调大小）。[size] 控制整体直径，内部按钮按比例缩放。
class PtzPad extends StatelessWidget {
  const PtzPad({
    super.key,
    required this.onPressed,
    required this.onReleased,
    required this.onCenter,
    this.enabled = true,
    this.size = 200,
    this.onDark = false,
  });

  final void Function(PtzDirection direction) onPressed;
  final VoidCallback onReleased;
  final VoidCallback onCenter;
  final bool enabled;
  final double size;

  /// 深色背景（全屏视频上）时用半透明白底，提升对比。
  final bool onDark;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final dir = size * 0.27;
    final center = size * 0.34;
    final edge = size * 0.03;
    final padColor = onDark
        ? Colors.white.withValues(alpha: 0.12)
        : scheme.surfaceContainerHighest;

    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: padColor,
              boxShadow: onDark
                  ? null
                  : [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.04),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
            ),
          ),
          Positioned(
            top: edge,
            child: _DirButton(
                icon: Icons.keyboard_arrow_up,
                enabled: enabled,
                size: dir,
                onDark: onDark,
                onPressed: () => onPressed(PtzDirection.up),
                onReleased: onReleased,
                label: '上'),
          ),
          Positioned(
            bottom: edge,
            child: _DirButton(
                icon: Icons.keyboard_arrow_down,
                enabled: enabled,
                size: dir,
                onDark: onDark,
                onPressed: () => onPressed(PtzDirection.down),
                onReleased: onReleased,
                label: '下'),
          ),
          Positioned(
            left: edge,
            child: _DirButton(
                icon: Icons.keyboard_arrow_left,
                enabled: enabled,
                size: dir,
                onDark: onDark,
                onPressed: () => onPressed(PtzDirection.left),
                onReleased: onReleased,
                label: '左'),
          ),
          Positioned(
            right: edge,
            child: _DirButton(
                icon: Icons.keyboard_arrow_right,
                enabled: enabled,
                size: dir,
                onDark: onDark,
                onPressed: () => onPressed(PtzDirection.right),
                onReleased: onReleased,
                label: '右'),
          ),
          GestureDetector(
            onTap: enabled ? onCenter : null,
            child: Container(
              width: center,
              height: center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: enabled ? scheme.primary : scheme.outlineVariant,
              ),
              alignment: Alignment.center,
              child: Text('回正',
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: size * 0.07,
                      fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }
}

class _DirButton extends StatelessWidget {
  const _DirButton({
    required this.icon,
    required this.onPressed,
    required this.onReleased,
    required this.enabled,
    required this.label,
    required this.size,
    required this.onDark,
  });

  final IconData icon;
  final VoidCallback onPressed;
  final VoidCallback onReleased;
  final bool enabled;
  final String label;
  final double size;
  final bool onDark;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final bg = onDark
        ? Colors.white.withValues(alpha: enabled ? 0.92 : 0.4)
        : (enabled ? Colors.white : scheme.surface);
    return GestureDetector(
      onTapDown: enabled ? (_) => onPressed() : null,
      onTapUp: enabled ? (_) => onReleased() : null,
      onTapCancel: enabled ? onReleased : null,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: bg,
          border: onDark ? null : Border.all(color: scheme.outlineVariant),
        ),
        alignment: Alignment.center,
        child: Icon(icon,
            size: size * 0.56,
            color: enabled ? scheme.onSurface : scheme.outline,
            semanticLabel: label),
      ),
    );
  }
}
