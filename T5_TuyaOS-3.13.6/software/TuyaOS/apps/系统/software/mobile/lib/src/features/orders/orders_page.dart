import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../data/models/app_order.dart';
import '../../data/repositories/order_repository.dart';
import '../../shared/glass.dart';
import '../../shared/section_card.dart';
import '../../shared/widgets/async_view.dart';
import '../../shared/widgets/empty_state.dart';
import '../../shared/widgets/status_chip.dart';
import '../../theme/app_tokens.dart';

class OrdersPage extends StatefulWidget {
  const OrdersPage({super.key});

  @override
  State<OrdersPage> createState() => _OrdersPageState();
}

class _OrdersPageState extends State<OrdersPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  late Future<List<AppOrder>> _future;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 4, vsync: this);
    _future = _load();
  }

  Future<List<AppOrder>> _load() =>
      context.read<OrderRepository>().list();

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future.catchError((_) => <AppOrder>[]);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  List<AppOrder> _filter(List<AppOrder> all, int index) {
    switch (index) {
      case 1:
        return all.where((o) => o.isUpcoming).toList();
      case 2:
        return all.where((o) => o.isInService).toList();
      case 3:
        return all.where((o) => o.isCompleted).toList();
      default:
        return all;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('订单'),
        bottom: TabBar(
          controller: _tabs,
          isScrollable: true,
          tabs: const [
            Tab(text: '全部'),
            Tab(text: '待服务'),
            Tab(text: '进行中'),
            Tab(text: '已完成'),
          ],
        ),
      ),
      body: AsyncView<List<AppOrder>>(
        future: _future,
        onRetry: _refresh,
        builder: (context, all) {
          return TabBarView(
            controller: _tabs,
            children: List.generate(4, (index) {
              final items = _filter(all, index);
              return RefreshIndicator(
                onRefresh: _refresh,
                child: items.isEmpty
                    ? ListView(
                        children: const [
                          SizedBox(height: 120),
                          EmptyState(
                            icon: Icons.receipt_long_outlined,
                            title: '暂无订单',
                            message: '完成预约后，可在这里查看订单状态和服务进展。',
                          ),
                        ],
                      )
                    : ListView.separated(
                        padding: EdgeInsets.fromLTRB(
                          AppSpacing.md,
                          AppSpacing.md,
                          AppSpacing.md,
                          glassNavClearance(context),
                        ),
                        itemCount: items.length,
                        separatorBuilder: (_, _) =>
                            const SizedBox(height: AppSpacing.sm),
                        itemBuilder: (context, i) {
                          final order = items[i];
                          return _OrderCard(
                            order: order,
                            onTap: () async {
                              await context.push('/orders/${order.id}');
                              if (context.mounted) _refresh();
                            },
                          );
                        },
                      ),
              );
            }),
          );
        },
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.order, required this.onTap});

  final AppOrder order;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      children: [
        InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppRadius.md),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        order.serviceName,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                        ),
                      ),
                    ),
                    OrderStatusChip(
                      status: order.statusBucket,
                      label: order.statusLabel,
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                _InfoRow(Icons.schedule, order.scheduledAt),
                _InfoRow(Icons.local_hospital_outlined, order.hospital),
                _InfoRow(
                  Icons.person_outline,
                  '${order.targetName} · ${order.attendantName}',
                ),
                const SizedBox(height: AppSpacing.sm),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      order.amountLabel,
                      style: const TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const Text('查看详情 >',
                        style: TextStyle(color: AppColors.primary)),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow(this.icon, this.text);

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          Icon(icon, size: 16, color: AppColors.onSurfaceMuted),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(color: AppColors.onSurfaceMuted),
            ),
          ),
        ],
      ),
    );
  }
}
