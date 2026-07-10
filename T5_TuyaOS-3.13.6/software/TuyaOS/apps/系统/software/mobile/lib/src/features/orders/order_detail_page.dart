import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/network/api_exception.dart';
import '../../data/models/app_order.dart';
import '../../data/models/enums.dart';
import '../../data/repositories/order_repository.dart';
import '../../shared/section_card.dart';
import '../../shared/widgets/async_view.dart';
import '../../shared/widgets/status_chip.dart';
import '../../theme/app_tokens.dart';

class OrderDetailPage extends StatefulWidget {
  const OrderDetailPage({super.key, required this.orderId});

  final String orderId;

  @override
  State<OrderDetailPage> createState() => _OrderDetailPageState();
}

class _OrderDetailPageState extends State<OrderDetailPage> {
  late Future<AppOrder> _future;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<AppOrder> _load() =>
      context.read<OrderRepository>().detail(widget.orderId);

  void _refresh() => setState(() => _future = _load());

  Future<void> _cancel() async {
    final reasonCtrl = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('取消订单'),
        content: TextField(
          controller: reasonCtrl,
          maxLines: 2,
          decoration: const InputDecoration(labelText: '取消原因（选填）'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('再想想'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('确认取消'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _submitting = true);
    final messenger = ScaffoldMessenger.of(context);
    final repo = context.read<OrderRepository>();
    try {
      await repo.cancel(widget.orderId, reason: reasonCtrl.text.trim());
      messenger.showSnackBar(const SnackBar(content: Text('订单已取消')));
      if (mounted) _refresh();
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _review() async {
    var rating = 5;
    final contentCtrl = TextEditingController();
    final submitted = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: const Text('评价服务'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(5, (i) {
                  final filled = i < rating;
                  return IconButton(
                    onPressed: () => setLocal(() => rating = i + 1),
                    icon: Icon(
                      filled ? Icons.star : Icons.star_border,
                      color: AppColors.warning,
                    ),
                  );
                }),
              ),
              TextField(
                controller: contentCtrl,
                maxLines: 3,
                decoration: const InputDecoration(labelText: '说点什么（选填）'),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('取消'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('提交评价'),
            ),
          ],
        ),
      ),
    );
    if (submitted != true || !mounted) return;

    setState(() => _submitting = true);
    final messenger = ScaffoldMessenger.of(context);
    final repo = context.read<OrderRepository>();
    try {
      await repo.review(
        widget.orderId,
        rating: rating,
        content: contentCtrl.text.trim(),
      );
      messenger.showSnackBar(const SnackBar(content: Text('感谢您的评价')));
      if (mounted) _refresh();
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('订单详情')),
      body: AsyncView<AppOrder>(
        future: _future,
        onRetry: _refresh,
        builder: (context, order) {
          return ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              SectionCard(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          order.serviceName,
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                fontWeight: FontWeight.w800,
                              ),
                        ),
                      ),
                      OrderStatusChip(
                        status: order.statusBucket,
                        label: order.statusLabel,
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),
                  if (order.orderNumber.isNotEmpty)
                    _Row('订单号', order.orderNumber),
                  _Row('服务时间', order.scheduledAt),
                  _Row('服务地点', order.hospital),
                  _Row('服务对象', order.targetName),
                  _Row('陪诊员', order.attendantName),
                  _Row('订单金额', order.amountLabel),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              if (order.statusBucket == OrderStatus.pending ||
                  order.statusBucket == OrderStatus.confirmed)
                OutlinedButton(
                  onPressed: _submitting ? null : _cancel,
                  child: const Text('取消订单'),
                ),
              if (order.statusBucket == OrderStatus.completed)
                FilledButton(
                  onPressed: _submitting ? null : _review,
                  child: const Text('评价服务'),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 80,
            child: Text(label,
                style: const TextStyle(color: AppColors.onSurfaceMuted)),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
