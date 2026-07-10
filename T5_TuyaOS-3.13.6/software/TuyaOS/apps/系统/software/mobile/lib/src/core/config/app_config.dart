class AppConfig {
  static const appName = '陪了个伴';
  static const onlineBaseUrl = 'https://api.qiaoguo.vip';
  static const localBaseUrl = 'http://localhost:3000';
  static const lanBaseUrl = 'http://192.168.10.104:3000';

  static const baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: localBaseUrl,
  );
}
