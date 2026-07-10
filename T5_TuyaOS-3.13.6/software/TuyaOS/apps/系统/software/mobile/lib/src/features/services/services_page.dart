import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../data/repositories/service_repository.dart';
import '../../shared/glass.dart';
import '../../shared/section_card.dart';
import '../../shared/widgets/async_view.dart';
import '../../shared/widgets/empty_state.dart';
import '../../theme/app_tokens.dart';
import 'domain/service_offer.dart';

class ServicesPage extends StatefulWidget {
  const ServicesPage({super.key});

  @override
  State<ServicesPage> createState() => _ServicesPageState();
}

class _ServicesPageState extends State<ServicesPage> {
  late Future<List<ServiceOffer>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<ServiceOffer>> _load() =>
      context.read<ServiceRepository>().listPublic();

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future.catchError((_) => <ServiceOffer>[]);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('服务'),
        actions: [
          TextButton.icon(
            onPressed: () => context.push('/hospitals'),
            icon: const Icon(Icons.local_hospital_outlined, size: 20),
            label: const Text('合作医院'),
          ),
          TextButton.icon(
            onPressed: () => context.push('/orders'),
            icon: const Icon(Icons.receipt_long_outlined, size: 20),
            label: const Text('订单'),
          ),
        ],
      ),
      body: AsyncView<List<ServiceOffer>>(
        future: _future,
        onRetry: _refresh,
        builder: (context, offers) {
          if (offers.isEmpty) {
            return RefreshIndicator(
              onRefresh: _refresh,
              child: ListView(
                children: const [
                  SizedBox(height: 120),
                  EmptyState(
                    icon: Icons.medical_services_outlined,
                    title: '暂无可预约服务',
                    message: '平台服务上架后会显示在这里。',
                  ),
                ],
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView.separated(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.md,
                glassNavClearance(context),
              ),
              itemCount: offers.length,
              separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
              itemBuilder: (context, index) {
                final offer = offers[index];
                return _ServiceCard(
                  offer: offer,
                  onTap: () => context.push('/services/${offer.code}'),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

class _ServiceCard extends StatelessWidget {
  const _ServiceCard({required this.offer, required this.onTap});

  final ServiceOffer offer;
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
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: Color(offer.color).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(AppRadius.md),
                      ),
                      child: Icon(
                        Icons.medical_services,
                        color: Color(offer.color),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            offer.name,
                            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                          if (offer.shortDesc.isNotEmpty)
                            Text(
                              offer.shortDesc,
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                        ],
                      ),
                    ),
                    if (offer.priceLabel.isNotEmpty)
                      Text(
                        offer.priceLabel,
                        style: TextStyle(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                        ),
                      ),
                  ],
                ),
                if (offer.features.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Wrap(
                    spacing: AppSpacing.xs,
                    runSpacing: AppSpacing.xs,
                    children: offer.features
                        .map(
                          (f) => Chip(
                            label: Text(f),
                            visualDensity: VisualDensity.compact,
                            backgroundColor: AppColors.surfaceVariant,
                            side: BorderSide.none,
                          ),
                        )
                        .toList(),
                  ),
                ],
                const SizedBox(height: AppSpacing.sm),
                Align(
                  alignment: Alignment.centerRight,
                  child: FilledButton.tonal(
                    onPressed: onTap,
                    child: const Text('了解并预约'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
