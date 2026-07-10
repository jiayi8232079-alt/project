import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/network/api_exception.dart';
import '../../data/models/service_target.dart';
import '../../data/repositories/order_repository.dart';
import '../../data/repositories/service_repository.dart';
import '../../data/repositories/service_target_repository.dart';
import '../../shared/section_card.dart';
import '../../shared/widgets/async_view.dart';
import '../../theme/app_tokens.dart';
import 'domain/service_offer.dart';

class ServiceDetailPage extends StatefulWidget {
  const ServiceDetailPage({super.key, required this.code});

  final String code;

  @override
  State<ServiceDetailPage> createState() => _ServiceDetailPageState();
}

class _ServiceDetailPageState extends State<ServiceDetailPage> {
  late Future<ServiceOffer> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<ServiceOffer> _load() =>
      context.read<ServiceRepository>().detailByCode(widget.code);

  void _refresh() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('服务详情')),
      body: AsyncView<ServiceOffer>(
        future: _future,
        onRetry: _refresh,
        builder: (context, offer) {
          return ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              SectionCard(
                children: [
                  Text(
                    offer.name,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                  if (offer.longDesc.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      offer.longDesc,
                      style: Theme.of(context)
                          .textTheme
                          .bodyLarge
                          ?.copyWith(height: 1.6),
                    ),
                  ],
                  if (offer.priceLabel.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      offer.priceLabel,
                      style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                  ],
                ],
              ),
              if (offer.features.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.md),
                SectionCard(
                  title: '服务内容',
                  children: offer.features
                      .map(
                        (f) => ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading:
                              Icon(Icons.check_circle, color: AppColors.primary),
                          title: Text(f),
                        ),
                      )
                      .toList(),
                ),
              ],
            ],
          );
        },
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: ElevatedButton(
            onPressed: () => context.push('/services/${widget.code}/book'),
            child: const Text('立即预约'),
          ),
        ),
      ),
    );
  }
}

class ServiceBookingPage extends StatefulWidget {
  const ServiceBookingPage({super.key, required this.code});

  final String code;

  @override
  State<ServiceBookingPage> createState() => _ServiceBookingPageState();
}

class _ServiceBookingPageState extends State<ServiceBookingPage> {
  final _hospitalCtrl = TextEditingController();
  final _dateCtrl = TextEditingController();
  final _timeCtrl = TextEditingController(text: '09:00');
  final _remarkCtrl = TextEditingController();

  late Future<_BookingData> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_BookingData> _load() async {
    final offer = context.read<ServiceRepository>().detailByCode(widget.code);
    final targets =
        context.read<ServiceTargetRepository>().listMine().catchError(
              (_) => <ServiceTarget>[],
            );
    final results = await Future.wait([offer, targets]);
    return _BookingData(
      offer: results[0] as ServiceOffer,
      target: (results[1] as List<ServiceTarget>).isNotEmpty
          ? (results[1] as List<ServiceTarget>).first
          : null,
    );
  }

  @override
  void dispose() {
    _hospitalCtrl.dispose();
    _dateCtrl.dispose();
    _timeCtrl.dispose();
    _remarkCtrl.dispose();
    super.dispose();
  }

  bool _submitting = false;

  Future<void> _submit(_BookingData data) async {
    final target = data.target;
    if (target == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('请先在“健康”页添加服务对象')),
      );
      return;
    }
    final date = _dateCtrl.text.trim();
    final time = _timeCtrl.text.trim();
    final dateOk = RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(date);
    final timeOk = RegExp(r'^\d{2}:\d{2}$').hasMatch(time);
    if (!dateOk || !timeOk) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('请填写正确的日期(YYYY-MM-DD)与时间(HH:MM)')),
      );
      return;
    }

    setState(() => _submitting = true);
    final messenger = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);
    try {
      await context.read<OrderRepository>().create(
            serviceTargetId: int.tryParse(target.id) ?? 0,
            serviceType: data.offer.name,
            professionalServiceCode: data.offer.code,
            serviceTime: '${date}T$time:00',
            hospital: _hospitalCtrl.text.trim(),
            notes: _remarkCtrl.text.trim(),
          );
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('预约已提交'),
          content: const Text('我们已收到您的预约，客服会尽快与您确认。'),
          actions: [
            FilledButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('查看订单'),
            ),
          ],
        ),
      );
      router.go('/orders');
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('预约服务')),
      body: AsyncView<_BookingData>(
        future: _future,
        onRetry: () => setState(() => _future = _load()),
        builder: (context, data) {
          return ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              SectionCard(
                title: '服务对象',
                children: [
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const CircleAvatar(child: Icon(Icons.person)),
                    title: Text(data.target?.name ?? '请先添加服务对象'),
                    subtitle: Text(
                      data.target == null
                          ? '在“健康”页可添加家中老人'
                          : [
                              data.target!.relation,
                              if (data.target!.age != null) '${data.target!.age} 岁',
                            ].whereType<String>().join(' · '),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              SectionCard(
                title: '预约信息',
                children: [
                  TextField(
                    controller: _hospitalCtrl,
                    decoration:
                        const InputDecoration(labelText: '医院 / 服务地点'),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _dateCtrl,
                          decoration: const InputDecoration(
                              labelText: '日期（如 2026-06-20）'),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: TextField(
                          controller: _timeCtrl,
                          decoration: const InputDecoration(labelText: '时间'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  TextField(
                    controller: _remarkCtrl,
                    maxLines: 3,
                    decoration: const InputDecoration(labelText: '备注（选填）'),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              SectionCard(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('预估费用'),
                      Text(
                        data.offer.priceLabel,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary,
                          fontSize: 18,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              ElevatedButton(
                onPressed: _submitting ? null : () => _submit(data),
                child: _submitting
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('确认提交预约'),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _BookingData {
  const _BookingData({required this.offer, required this.target});

  final ServiceOffer offer;
  final ServiceTarget? target;
}
