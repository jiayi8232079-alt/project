import 'package:flutter/material.dart';

import '../../../../theme/app_tokens.dart';

class SosButton extends StatelessWidget {
  const SosButton({super.key, required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: [
          BoxShadow(
            color: AppColors.danger.withValues(alpha: 0.32),
            blurRadius: 22,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: ElevatedButton.icon(
        onPressed: () => _confirm(context),
        icon: const Icon(Icons.emergency_share),
        label: const Text('一键求助 SOS'),
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.danger,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(58),
          textStyle: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
        ),
      ),
    );
  }

  void _confirm(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('模拟 SOS 触发'),
        content: const Text('此操作仅用于开发联调，将向后端推送一条 mock SOS 事件，确认继续？'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              onPressed();
            },
            child: const Text('确认触发'),
          ),
        ],
      ),
    );
  }
}
