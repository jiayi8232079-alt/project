import 'package:flutter/material.dart';

import '../../core/network/api_exception.dart';
import '../../theme/app_tokens.dart';

/// 通用异步视图：统一处理 加载中 / 出错（带重试）/ 成功 三态。
///
/// 配合页面把 future 存在 State 里、`onRetry` 重新发起请求，即可获得
/// 一致的加载体验。空数据态请在 [builder] 内部按业务判断（用 EmptyState）。
class AsyncView<T> extends StatelessWidget {
  const AsyncView({
    super.key,
    required this.future,
    required this.builder,
    this.onRetry,
  });

  final Future<T> future;
  final Widget Function(BuildContext context, T data) builder;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<T>(
      future: future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(AppSpacing.xxl),
              child: CircularProgressIndicator(),
            ),
          );
        }
        if (snapshot.hasError) {
          return ErrorView(error: snapshot.error, onRetry: onRetry);
        }
        return builder(context, snapshot.data as T);
      },
    );
  }
}

class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.error, this.onRetry});

  final Object? error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final message =
        error is ApiException ? (error as ApiException).message : '加载失败，请稍后重试';
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xxl),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.cloud_off_outlined,
              size: 56,
              color: AppColors.onSurfaceMuted.withValues(alpha: 0.7),
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: AppColors.onSurfaceMuted,
                  ),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: AppSpacing.lg),
              FilledButton.tonalIcon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('重试'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
