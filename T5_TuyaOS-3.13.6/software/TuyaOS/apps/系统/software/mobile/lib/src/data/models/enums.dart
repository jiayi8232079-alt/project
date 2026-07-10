// 领域枚举 —— 在真实数据层与 UI（含 mock_catalog）间共用。
// 这些枚举既被后端模型映射使用，也被现有页面/组件引用；
// 因此独立成文件，避免页面与数据层耦合到 mock_catalog。

enum OrderStatus {
  pending('待确认'),
  confirmed('待服务'),
  inService('服务中'),
  completed('已完成'),
  cancelled('已取消');

  const OrderStatus(this.label);
  final String label;
}

enum AlertSeverity { low, medium, high }

enum AlertStatus { pending, acknowledged, closed }

enum DialogRole { user, assistant }
